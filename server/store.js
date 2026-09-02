import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial default settings with COP currency prices and allowed Google provider emails
const DEFAULT_SETTINGS = {
  providerName: 'Centro de Servicios Integrales',
  providerEmail: 'contacto.servicios@gmail.com',
  allowedEmails: ['contacto.servicios@gmail.com'],
  workingDays: [0, 1, 2, 3, 4, 5, 6], // Available all days, but services filter specific days
  workStartTime: '08:00',
  workEndTime: '17:00',
  slotDurationMinutes: 45,
  bufferMinutes: 15,
  googleCalendar: {
    enabled: false,
    calendarId: 'primary',
    apiKey: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    syncStatus: 'disconnected'
  },
  services: [
    {
      id: 'serv-1',
      name: 'Peluquería y veterinaria',
      allowedDays: [2, 4], // 2=Martes, 4=Jueves
      daysText: 'Martes y Jueves',
      duration: 45,
      price: 50000,
      color: '#10b981',
      description: 'Atención integral para tu mascota: corte, baño y chequeo veterinario.'
    },
    {
      id: 'serv-2',
      name: 'Servicio de seguridad',
      allowedDays: [1, 3, 5], // 1=Lunes, 3=Miércoles, 5=Viernes
      daysText: 'Lunes, Miércoles y Viernes',
      duration: 60,
      price: 120000,
      color: '#4f46e5',
      description: 'Consultoría y prestación de servicios de seguridad privada y residencial.'
    },
    {
      id: 'serv-3',
      name: 'Servicios independientes',
      allowedDays: [6, 0], // 6=Sábado, 0=Domingo
      daysText: 'Sábado y Domingo',
      duration: 45,
      price: 80000,
      color: '#f59e0b',
      description: 'Asesorías personalizadas y trabajos independientes a medida.'
    }
  ]
};

// Initial mock appointments
function getInitialAppointments() {
  const todayStr = new Date().toISOString().split('T')[0];

  return [
    {
      id: 'apt-101',
      clientName: 'María Fernanda Gómez',
      clientEmail: 'maria.gomez@gmail.com',
      clientPhone: '+57 300 123 4567',
      serviceId: 'serv-1',
      serviceName: 'Peluquería y veterinaria',
      date: todayStr,
      startTime: '09:00',
      endTime: '09:45',
      status: 'confirmed',
      notes: 'Baño y vacunación para perrito Poodle.',
      createdAt: new Date().toISOString(),
      googleEventId: null
    }
  ];
}

class Store {
  constructor() {
    this.currentProviderSession = null;
    this.lastCleanupDate = null;
    this.init();
    // Schedule daily check for monthly rollover cleanup
    setInterval(() => {
      this.cleanOldAppointments();
    }, 24 * 60 * 60 * 1000);
  }

  init() {
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    }
    if (!fs.existsSync(APPOINTMENTS_FILE)) {
      fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(getInitialAppointments(), null, 2));
    }
    // Clean old appointments from previous months on startup
    this.cleanOldAppointments();
  }

  getSettings() {
    try {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const loaded = JSON.parse(data);
      delete loaded.providerPin; // Ensure legacy providerPin is removed
      return { ...DEFAULT_SETTINGS, ...loaded };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  updateSettings(newSettings) {
    const current = this.getSettings();

    const mergedGoogle = {
      ...(current.googleCalendar || {}),
      ...(newSettings.googleCalendar || {})
    };

    if (newSettings.googleCalendar?.clientSecret === '***HIDDEN***') {
      mergedGoogle.clientSecret = current.googleCalendar?.clientSecret || '';
    }
    if (newSettings.googleCalendar?.refreshToken === '***HIDDEN***') {
      mergedGoogle.refreshToken = current.googleCalendar?.refreshToken || '';
    }

    const updated = {
      ...current,
      ...newSettings,
      googleCalendar: mergedGoogle
    };

    delete updated.providerPin; // Keep clean

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
  }

  isEmailAllowed(email) {
    if (!email) return false;
    const settings = this.getSettings();
    const allowed = (settings.allowedEmails || []).map(e => e.toLowerCase().trim());
    const target = email.toLowerCase().trim();
    // Allow if allowed list includes target or if target matches providerEmail
    return allowed.length === 0 || allowed.includes(target) || (settings.providerEmail && settings.providerEmail.toLowerCase().trim() === target);
  }

  setProviderSession(user) {
    this.currentProviderSession = user;
  }

  getProviderSession() {
    return this.currentProviderSession;
  }

  clearProviderSession() {
    this.currentProviderSession = null;
  }

  getAppointments() {
    // Perform daily check to clean appointments if month changed
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    if (this.lastCleanupDate !== today) {
      this.cleanOldAppointments();
      this.lastCleanupDate = today;
    }

    try {
      const data = fs.readFileSync(APPOINTMENTS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  getAppointmentsRaw() {
    try {
      const data = fs.readFileSync(APPOINTMENTS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  /**
   * Cleans past appointments older than the 1st day of the current month.
   * Google Calendar retains the full historical records.
   */
  cleanOldAppointments() {
    try {
      // Colombia timezone YYYY-MM-DD
      const colombiaDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const [year, month] = colombiaDateStr.split('-');
      const currentMonthStart = `${year}-${month}-01`;

      const all = this.getAppointmentsRaw();
      const beforeCount = all.length;

      // Keep only current month and future appointments (date >= currentMonthStart)
      const valid = all.filter(apt => apt.date && apt.date >= currentMonthStart);
      const purgedCount = beforeCount - valid.length;

      if (purgedCount > 0) {
        fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(valid, null, 2));
        console.log(`[Mantenimiento Mensual] Se limpiaron ${purgedCount} citas de meses anteriores a ${currentMonthStart}. Quedan ${valid.length} citas activas.`);
      }

      this.lastCleanupDate = colombiaDateStr;
      return {
        success: true,
        purgedCount,
        remainingCount: valid.length,
        currentMonthStart
      };
    } catch (e) {
      console.error('[Error en Limpieza Mensual]:', e);
      return { success: false, purgedCount: 0, error: e.message };
    }
  }

  getAppointmentsByDate(dateStr) {
    const all = this.getAppointments();
    return all.filter(apt => apt.date === dateStr && apt.status !== 'cancelled');
  }

  addAppointment(appointment) {
    const appointments = this.getAppointments();
    const newApt = {
      id: `apt-${Date.now()}`,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      ...appointment
    };
    appointments.push(newApt);
    fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
    return newApt;
  }

  updateAppointment(id, updates) {
    const appointments = this.getAppointments();
    const index = appointments.findIndex(a => a.id === id);
    if (index === -1) return null;

    appointments[index] = { ...appointments[index], ...updates, updatedAt: new Date().toISOString() };
    fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
    return appointments[index];
  }

  deleteAppointment(id) {
    let appointments = this.getAppointments();
    appointments = appointments.filter(a => a.id !== id);
    fs.writeFileSync(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
    return true;
  }
}

export const store = new Store();
