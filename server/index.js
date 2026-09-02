import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { store } from './store.js';
import {
  getGoogleBusySlots,
  createGoogleCalendarEvent,
  testGoogleConnection,
  getGoogleAuthUrl,
  exchangeCodeForTokens,
  getGoogleUserInfo,
  getDefaultRedirectUri
} from './googleCalendar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helper: Parse 'HH:MM' into total minutes
function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Helper: Format total minutes into 'HH:MM'
function formatTime(m) {
  const h = Math.floor(m / 60).toString().padStart(2, '0');
  const min = (m % 60).toString().padStart(2, '0');
  return `${h}:${min}`;
}

/**
 * GET /api/auth/me (Check current provider session)
 */
app.get('/api/auth/me', (req, res) => {
  const session = store.getProviderSession();
  res.json({
    isAuthenticated: Boolean(session),
    user: session
  });
});

/**
 * POST /api/auth/logout (Logout provider session)
 */
app.post('/api/auth/logout', (req, res) => {
  store.clearProviderSession();
  res.json({ success: true });
});

/**
 * GET /api/settings
 */
app.get('/api/settings', (req, res) => {
  const settings = store.getSettings();
  const safeSettings = {
    ...settings,
    googleCalendar: {
      ...settings.googleCalendar,
      clientSecret: settings.googleCalendar?.clientSecret ? '***HIDDEN***' : '',
      refreshToken: settings.googleCalendar?.refreshToken ? '***HIDDEN***' : ''
    }
  };
  res.json(safeSettings);
});

/**
 * POST /api/settings
 */
app.post('/api/settings', (req, res) => {
  try {
    const updated = store.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/availability?date=YYYY-MM-DD&serviceId=serv-1
 */
app.get('/api/availability', async (req, res) => {
  const { date, serviceId } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Parámetro date es requerido' });
  }

  const settings = store.getSettings();
  const selectedService = settings.services.find(s => s.id === serviceId) || settings.services[0];
  const duration = selectedService ? selectedService.duration : settings.slotDurationMinutes;
  const buffer = settings.bufferMinutes || 0;

  // Validate Day of Week according to Service Rules
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

  if (selectedService.allowedDays && !selectedService.allowedDays.includes(dayOfWeek)) {
    return res.json({
      date,
      isWorkingDay: false,
      service: selectedService,
      message: `El servicio "${selectedService.name}" solo se ofrece los días: ${selectedService.daysText}. Por favor selecciona una fecha correspondiente.`,
      slots: []
    });
  }

  // Local existing appointments for that date
  const localAppointments = store.getAppointmentsByDate(date);

  // Google Calendar busy slots
  let googleBusy = [];
  if (settings.googleCalendar && settings.googleCalendar.enabled) {
    googleBusy = await getGoogleBusySlots(settings, date);
  }

  // Generate slots
  const startMin = parseTime(settings.workStartTime);
  const endMin = parseTime(settings.workEndTime);

  const slots = [];
  let currentMin = startMin;

  while (currentMin + duration <= endMin) {
    const slotStartStr = formatTime(currentMin);
    const slotEndStr = formatTime(currentMin + duration);

    // Check collision with local appointments
    const localConflict = localAppointments.find(apt => {
      const aptStart = parseTime(apt.startTime);
      const aptEnd = parseTime(apt.endTime);
      return (currentMin < aptEnd && (currentMin + duration) > aptStart);
    });

    // Check collision with Google Calendar busy slots
    const googleConflict = googleBusy.find(gb => {
      const gbStart = parseTime(gb.startTime);
      const gbEnd = parseTime(gb.endTime);
      return (currentMin < gbEnd && (currentMin + duration) > gbStart);
    });

    let available = true;
    let reason = null;

    if (localConflict) {
      available = false;
      reason = `Ocupado: ${localConflict.serviceName || 'Cita Agendada'}`;
    } else if (googleConflict) {
      available = false;
      reason = 'Ocupado (Google Calendar)';
    }

    slots.push({
      startTime: slotStartStr,
      endTime: slotEndStr,
      duration,
      available,
      reason
    });

    currentMin += duration + buffer;
  }

  res.json({
    date,
    isWorkingDay: true,
    service: selectedService,
    slots
  });
});

/**
 * GET /api/appointments
 */
app.get('/api/appointments', (req, res) => {
  const { date, status } = req.query;
  let appointments = store.getAppointments();

  if (date) {
    appointments = appointments.filter(a => a.date === date);
  }
  if (status) {
    appointments = appointments.filter(a => a.status === status);
  }

  appointments.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

  res.json(appointments);
});

/**
 * POST /api/appointments (Client booking endpoint)
 */
app.post('/api/appointments', async (req, res) => {
  const { clientName, clientEmail, clientPhone, serviceId, date, startTime, notes } = req.body;

  if (!clientName || !clientEmail || !serviceId || !date || !startTime) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el agendamiento' });
  }

  // Email Validation (Gmail / valid email)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clientEmail)) {
    return res.status(400).json({ error: 'El formato de correo electrónico introducido no es válido.' });
  }

  // Phone Validation
  const phoneDigits = (clientPhone || '').replace(/\D/g, '');
  if (phoneDigits.length < 7) {
    return res.status(400).json({ error: 'El número de teléfono debe contener al menos 7 dígitos.' });
  }

  const settings = store.getSettings();
  const service = settings.services.find(s => s.id === serviceId) || settings.services[0];

  const startMins = parseTime(startTime);
  const endMins = startMins + service.duration;
  const endTime = formatTime(endMins);

  const newAppointment = store.addAppointment({
    clientName,
    clientEmail,
    clientPhone: clientPhone || '',
    serviceId: service.id,
    serviceName: service.name,
    date,
    startTime,
    endTime,
    notes: notes || '',
    status: 'confirmed'
  });

  // Create Google Calendar event & notification for provider
  let googleResult = { success: false };
  const gConf = settings.googleCalendar || {};
  if (gConf.enabled || gConf.refreshToken || gConf.apiKey) {
    googleResult = await createGoogleCalendarEvent(settings, newAppointment);
    if (googleResult.success && googleResult.eventId) {
      store.updateAppointment(newAppointment.id, { googleEventId: googleResult.eventId });
    }
  }

  res.json({
    success: true,
    appointment: newAppointment,
    googleSynced: googleResult.success,
    googleLink: googleResult.htmlLink || null
  });
});

/**
 * PATCH /api/appointments/:id
 */
app.patch('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const updated = store.updateAppointment(id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Cita no encontrada' });
  }
  res.json({ success: true, appointment: updated });
});

/**
 * POST /api/appointments/cleanup (Trigger monthly retention cleanup manually)
 */
app.post('/api/appointments/cleanup', (req, res) => {
  const result = store.cleanOldAppointments();
  res.json(result);
});

/**
 * DELETE /api/appointments/:id
 */
app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  store.deleteAppointment(id);
  res.json({ success: true, message: 'Cita eliminada correctamente' });
});

/**
 * POST /api/google/test-connection
 */
app.post('/api/google/test-connection', async (req, res) => {
  const currentSettings = store.getSettings();
  const incomingSettings = req.body.settings || {};

  const mergedSettings = {
    ...currentSettings,
    ...incomingSettings,
    googleCalendar: {
      ...(currentSettings.googleCalendar || {}),
      ...(incomingSettings.googleCalendar || {}),
      refreshToken: incomingSettings.googleCalendar?.refreshToken && incomingSettings.googleCalendar?.refreshToken !== '***HIDDEN***'
        ? incomingSettings.googleCalendar.refreshToken
        : currentSettings.googleCalendar?.refreshToken || ''
    }
  };

  const result = await testGoogleConnection(mergedSettings);
  res.json(result);
});

/**
 * POST /api/google/auth-url & GET /api/google/auth-url
 */
const handleAuthUrl = (req, res) => {
  let settings;
  if (req.body?.settings) {
    settings = store.updateSettings(req.body.settings);
  } else {
    settings = store.getSettings();
  }

  const redirectUri = getDefaultRedirectUri(req);
  const authUrl = getGoogleAuthUrl(settings, redirectUri);
  if (!authUrl) {
    return res.status(400).json({
      error: 'Se requiere ingresar Client ID y Client Secret de Google Cloud para el inicio de sesión.'
    });
  }
  res.json({ url: authUrl });
};

app.post('/api/google/auth-url', handleAuthUrl);
app.get('/api/google/auth-url', handleAuthUrl);

/**
 * GET /api/google/oauth-callback
 */
app.get('/api/google/oauth-callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Código OAuth no provisto.');
  }

  try {
    const settings = store.getSettings();
    const redirectUri = getDefaultRedirectUri(req);
    const tokens = await exchangeCodeForTokens(code, settings, redirectUri);

    // Fetch user info from Google
    let userInfo = { email: '', name: '', picture: '' };
    try {
      userInfo = await getGoogleUserInfo(tokens, settings);
    } catch (e) {
      console.warn('No se pudo obtener el perfil de usuario de Google:', e.message);
    }

    const email = userInfo.email || settings.providerEmail;
    const isAllowed = store.isEmailAllowed(email);

    if (!isAllowed) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Acceso Denegado</title></head>
          <body style="font-family: system-ui; text-align: center; padding: 40px; background: #fef2f2; color: #991b1b;">
            <h1 style="color: #dc2626;">⛔ Acceso Denegado</h1>
            <p>El correo de Google <strong>${email}</strong> no está registrado en la lista de correos autorizados para el proveedor.</p>
            <p style="color: #4b5563; font-size: 0.9rem;">Solicita al administrador del sistema que agregue tu correo de Google en la lista de autorizados.</p>
            <script>
              if (window.opener) {
                try { window.opener.postMessage({ type: 'GOOGLE_AUTH_ERROR', error: 'El correo ${email} no está autorizado como proveedor.' }, '*'); } catch (e) {}
              }
            </script>
          </body>
        </html>
      `);
    }

    // Save tokens automatically for Google Calendar sync
    const refreshTokenToSave = tokens.refresh_token || settings.googleCalendar?.refreshToken || '';

    store.updateSettings({
      providerEmail: email || settings.providerEmail,
      providerName: userInfo.name || settings.providerName,
      googleCalendar: {
        ...settings.googleCalendar,
        enabled: true,
        refreshToken: refreshTokenToSave,
        accessToken: tokens.access_token || '',
        syncStatus: 'connected'
      }
    });

    const userObj = {
      email,
      name: userInfo.name || email,
      picture: userInfo.picture || ''
    };

    store.setProviderSession(userObj);

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Autenticación Exitosa</title></head>
        <body style="font-family: system-ui; text-align: center; padding: 50px;">
          <h1 style="color: #10b981;">¡Bienvenido ${userObj.name}!</h1>
          <p>Autenticación con Google completada y Google Calendar sincronizado correctamente por debajo.</p>
          <p>Entrando al panel de proveedor...</p>
          <script>
            if (window.opener) {
              try { window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', user: ${JSON.stringify(userObj)} }, '*'); } catch (e) {}
              setTimeout(() => { window.close(); }, 1200);
            } else {
              setTimeout(() => { window.location.href = '/?provider_logged_in=true'; }, 1500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Error vinculando Google Account: ${err.message}`);
  }
});

// Serve frontend build in production if dist directory exists
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Servidor de Agendamiento corriendo en el puerto ${PORT}`);
});
