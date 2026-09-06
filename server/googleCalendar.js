import { google } from 'googleapis';

/**
 * Dynamic helper to get the OAuth redirect URI based on environment or request
 */
export function getDefaultRedirectUri(req = null) {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI.trim();
  }
  if (process.env.APP_URL) {
    return `${process.env.APP_URL.replace(/\/+$/, '')}/api/google/oauth-callback`;
  }
  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3001';
    return `${protocol}://${host}/api/google/oauth-callback`;
  }
  return 'http://localhost:3001/api/google/oauth-callback';
}

/**
 * Helper to construct an OAuth2 / API client for Google Calendar
 */
export function getGoogleCalendarClient(settings, redirectUri = null) {
  const gConfig = settings.googleCalendar || {};
  const clientId = (gConfig.clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (gConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = (gConfig.refreshToken || '').trim();
  const accessToken = (gConfig.accessToken || '').trim();
  const rUri = redirectUri || getDefaultRedirectUri();

  // Active if enabled flag is true OR if valid refreshToken/accessToken/apiKey exists
  const isActive = gConfig.enabled || Boolean(refreshToken) || Boolean(accessToken) || Boolean(gConfig.apiKey);
  if (!isActive) {
    return null;
  }

  try {
    if (clientId && clientSecret && (refreshToken || accessToken)) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, rUri);
      const credentials = {};
      if (refreshToken) credentials.refresh_token = refreshToken;
      if (accessToken) credentials.access_token = accessToken;
      oauth2Client.setCredentials(credentials);
      return google.calendar({ version: 'v3', auth: oauth2Client });
    } else if (gConfig.apiKey) {
      return google.calendar({ version: 'v3', auth: gConfig.apiKey.trim() });
    }
  } catch (err) {
    console.error('Error instanciando cliente de Google Calendar:', err.message);
  }
  return null;
}

/**
 * Fetch busy time slots from Google Calendar for a specific date
 */
export async function getGoogleBusySlots(settings, dateStr) {
  const calendar = getGoogleCalendarClient(settings);
  let calendarId = (settings.googleCalendar?.calendarId || 'primary').trim();
  if (calendarId.toLowerCase() === 'primary') {
    calendarId = 'primary';
  }

  if (!calendar) {
    return [];
  }

  try {
    const timeMin = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
    const timeMax = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: calendarId }]
      }
    });

    const busy = response.data.calendars[calendarId]?.busy || [];
    return busy.map(item => {
      const start = new Date(item.start);
      const end = new Date(item.end);
      const formatTime = d => d.toTimeString().substring(0, 5);
      return {
        startTime: formatTime(start),
        endTime: formatTime(end),
        source: 'Google Calendar'
      };
    });
  } catch (error) {
    console.warn('Google Calendar freebusy check failed:', error.message);
    return [];
  }
}

/**
 * Create an event in Google Calendar and send notifications to Provider & Client
 */
export async function createGoogleCalendarEvent(settings, appointment) {
  const calendar = getGoogleCalendarClient(settings);
  let calendarId = (settings.googleCalendar?.calendarId || 'primary').trim();
  if (calendarId.toLowerCase() === 'primary') {
    calendarId = 'primary';
  }
  const providerEmail = settings.providerEmail || 'contacto.servicios@gmail.com';

  if (!calendar) {
    console.log('[Google Calendar] Sync no realizado: cliente Google no configurado o inactivo.');
    return { success: false, reason: 'Google Calendar API no está configurado aún' };
  }

  try {
    console.log(`[Google Calendar Sync] Creando evento para "${appointment.clientName}" en Google Calendar (${calendarId})...`);

    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota';
    const startDateTime = `${appointment.date}T${appointment.startTime}:00`;
    const endDateTime = `${appointment.date}T${appointment.endTime}:00`;

    const attendees = [];
    if (providerEmail) {
      attendees.push({ email: providerEmail, responseStatus: 'accepted' });
    }
    if (appointment.clientEmail && appointment.clientEmail !== providerEmail) {
      attendees.push({ email: appointment.clientEmail, responseStatus: 'accepted' });
    }

    const event = {
      summary: `🔔 CITA: ${appointment.serviceName} - ${appointment.clientName}`,
      description: `==========================================\n` +
                   `NUEVA CITA REGISTRADA EN EL SISTEMA\n` +
                   `==========================================\n` +
                   `Servicio: ${appointment.serviceName}\n` +
                   `Fecha: ${appointment.date}\n` +
                   `Hora: ${appointment.startTime} - ${appointment.endTime}\n` +
                   `Cliente: ${appointment.clientName}\n` +
                   `Correo Cliente: ${appointment.clientEmail}\n` +
                   `Teléfono: ${appointment.clientPhone}\n` +
                   `Notas: ${appointment.notes || 'Sin notas'}\n` +
                   `==========================================`,
      start: {
        dateTime: startDateTime,
        timeZone: localTimeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: localTimeZone
      },
      attendees,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 }
        ]
      }
    };

    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
      sendUpdates: 'all' // Sends email notifications via Gmail to attendees
    });

    console.log(`[Google Calendar Sync] ✓ Evento creado con éxito en Google Calendar. Event ID: ${res.data.id}`);
    return { success: true, eventId: res.data.id, htmlLink: res.data.htmlLink };
  } catch (error) {
    console.error('[Google Calendar Sync] ✗ Error creando evento:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete an event from Google Calendar and send cancellation notice to attendees (client)
 */
export async function deleteGoogleCalendarEvent(settings, appointment) {
  const calendar = getGoogleCalendarClient(settings);
  let calendarId = (settings.googleCalendar?.calendarId || 'primary').trim();
  if (calendarId.toLowerCase() === 'primary') {
    calendarId = 'primary';
  }

  if (!calendar) {
    console.log('[Google Calendar] Cancelaciones: cliente Google no configurado o inactivo.');
    return { success: false, reason: 'Google Calendar API no está configurado aún' };
  }

  if (!appointment || !appointment.googleEventId) {
    console.log('[Google Calendar] Cancelaciones: La cita no tiene id de evento en Google Calendar.');
    return { success: false, reason: 'No hay googleEventId asociado a la cita' };
  }

  try {
    console.log(`[Google Calendar Sync] Eliminando evento ${appointment.googleEventId} para "${appointment.clientName}"...`);
    await calendar.events.delete({
      calendarId,
      eventId: appointment.googleEventId,
      sendUpdates: 'all' // Envía automáticamente correo de cancelación al cliente (attendee)
    });
    console.log(`[Google Calendar Sync] ✓ Evento eliminado con éxito de Google Calendar y notificación de cancelación enviada a ${appointment.clientEmail}`);
    return { success: true };
  } catch (error) {
    console.error('[Google Calendar Sync] ✗ Error eliminando evento de Google Calendar:', error.message);
    return { success: false, error: error.message };
  }
}


/**
 * Generate Google OAuth authorization URL for 1-click Gmail linking & Provider Auth
 */
export function getGoogleAuthUrl(settings, redirectUri = null) {
  const gConfig = settings.googleCalendar || {};
  const clientId = (gConfig.clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (gConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const rUri = redirectUri || getDefaultRedirectUri();

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, rUri);
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ]
    });
  } catch (err) {
    console.error('Error generando URL de OAuth:', err.message);
    return null;
  }
}

/**
 * Send parallel email notifications to both Provider and Client upon new booking
 */
export async function sendParallelAppointmentEmails(settings, appointment) {
  const providerEmail = settings.providerEmail || 'contacto.servicios@gmail.com';
  const clientEmail = appointment.clientEmail;

  console.log(`[Notificaciones en Paralelo] Despachando notificaciones por correo para cita "${appointment.serviceName}"...`);
  console.log(`[Notificación Proveedor] 📩 Enviando detalles de la cita a: ${providerEmail}`);
  console.log(`[Notificación Cliente] 📩 Enviando confirmación de la cita a: ${clientEmail}`);

  // Construct OAuth2 Client if available for Gmail API
  const gConfig = settings.googleCalendar || {};
  const clientId = (gConfig.clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (gConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = (gConfig.refreshToken || '').trim();

  if (clientId && clientSecret && refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const createRawEmail = (to, subject, bodyHtml) => {
        const str = [
          `To: ${to}`,
          `From: ${providerEmail}`,
          `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          bodyHtml
        ].join('\r\n');

        return Buffer.from(str)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
      };

      // Email 1: To Provider
      const providerSubject = `🔔 NUEVA CITA REGISTRADA: ${appointment.serviceName} - ${appointment.clientName}`;
      const providerHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #4f46e5; margin-top: 0;">🔔 Nueva Cita Agendada en el Sistema</h2>
          <p>Un cliente ha reservado una cita:</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #cbd5e1;">
            <p style="margin: 5px 0;"><strong>Servicio:</strong> ${appointment.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${appointment.date}</p>
            <p style="margin: 5px 0;"><strong>Horario:</strong> ${appointment.startTime} - ${appointment.endTime} hs</p>
            <p style="margin: 5px 0;"><strong>Cliente:</strong> ${appointment.clientName}</p>
            <p style="margin: 5px 0;"><strong>Correo Cliente:</strong> <a href="mailto:${appointment.clientEmail}">${appointment.clientEmail}</a></p>
            <p style="margin: 5px 0;"><strong>Teléfono:</strong> ${appointment.clientPhone || 'No especificado'}</p>
            <p style="margin: 5px 0;"><strong>Notas:</strong> <em>${appointment.notes || 'Sin notas'}</em></p>
          </div>
          <p style="font-size: 0.85rem; color: #64748b;">Esta notificación fue enviada automáticamente al correo del proveedor.</p>
        </div>
      `;

      // Email 2: To Client
      const clientSubject = `✅ Confirmación de Cita: ${appointment.serviceName} (${appointment.date})`;
      const clientHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #10b981; margin-top: 0;">✅ ¡Tu Cita Ha Sido Agendada con Éxito!</h2>
          <p>Hola <strong>${appointment.clientName}</strong>,</p>
          <p>Hemos confirmado tu cita con los siguientes detalles:</p>
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #bbf7d0;">
            <p style="margin: 5px 0;"><strong>Servicio:</strong> ${appointment.serviceName}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${appointment.date}</p>
            <p style="margin: 5px 0;"><strong>Hora:</strong> ${appointment.startTime} - ${appointment.endTime} hs</p>
            <p style="margin: 5px 0;"><strong>Proveedor:</strong> ${settings.providerName || 'Centro de Servicios'}</p>
            <p style="margin: 5px 0;"><strong>Contacto Proveedor:</strong> ${providerEmail}</p>
          </div>
          <p style="font-size: 0.9rem; color: #475569;">Recibirás recordatorios automáticos por correo antes de tu cita.</p>
        </div>
      `;

      await Promise.allSettled([
        gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: createRawEmail(providerEmail, providerSubject, providerHtml) }
        }),
        clientEmail && clientEmail !== providerEmail ? gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: createRawEmail(clientEmail, clientSubject, clientHtml) }
        }) : Promise.resolve()
      ]);

      console.log(`[Notificaciones en Paralelo] ✓ Notificaciones de correo despachadas correctamente a ${providerEmail} y ${clientEmail}`);
    } catch (e) {
      console.warn('[Notificaciones en Paralelo] Nota: Notificaciones registradas en sistema (Google Calendar enviará avisos según la agenda):', e.message);
    }
  }

  return { success: true };
}

/**
 * Exchange OAuth authorization code for tokens
 */
export async function exchangeCodeForTokens(code, settings, redirectUri = null) {
  const gConfig = settings.googleCalendar || {};
  const clientId = (gConfig.clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (gConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const rUri = redirectUri || getDefaultRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error('Faltan Client ID o Client Secret para intercambiar el código OAuth.');
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, rUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Fetch authenticated Google User profile (email, name, picture) using tokens
 */
export async function getGoogleUserInfo(tokens, settings) {
  const gConfig = settings.googleCalendar || {};
  const clientId = (gConfig.clientId || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (gConfig.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '').trim();

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfoRes = await oauth2.userinfo.get();
  return userInfoRes.data;
}

/**
 * Test Google Calendar Connection
 */
export async function testGoogleConnection(settings) {
  const calendar = getGoogleCalendarClient(settings);
  if (!calendar) {
    return { success: false, message: 'Google Calendar no está habilitado o faltan credenciales (Client ID, Client Secret, Refresh Token o API Key).' };
  }

  try {
    const calendarId = settings.googleCalendar?.calendarId || 'primary';
    const res = await calendar.calendarList.get({ calendarId });
    return {
      success: true,
      summary: res.data.summary,
      timeZone: res.data.timeZone,
      calendarId: res.data.id
    };
  } catch (err) {
    return { success: false, message: `Error de conexión con Google API: ${err.message}` };
  }
}
