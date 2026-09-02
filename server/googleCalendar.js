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
