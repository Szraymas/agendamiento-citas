import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ClientPortal from './components/ClientPortal';
import ProviderDashboard from './components/ProviderDashboard';
import SettingsModal from './components/SettingsModal';
import NotificationToast from './components/NotificationToast';
import Footer from './components/Footer';
import { X, AlertCircle } from 'lucide-react';

export default function App() {
  const [activeRole, setActiveRole] = useState('client'); // 'client' | 'provider'
  const [isProviderAuthenticated, setIsProviderAuthenticated] = useState(false);
  const [providerUser, setProviderUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [settings, setSettings] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Initial Settings & Check Provider Session
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Listen for OAuth messages from popup window
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const user = event.data.user;
        setIsProviderAuthenticated(true);
        setProviderUser(user || null);
        setActiveRole('provider');
        setShowAuthModal(false);
        setAuthError('');
        setLoggingIn(false);
        fetchInitialData();
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setAuthError(event.data.error || 'Acceso Denegado. Tu correo no está en la lista de autorizados.');
        setLoggingIn(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [resSettings, resAppts, resAuth] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/appointments'),
        fetch('/api/auth/me')
      ]);
      const dataSettings = await resSettings.json();
      const dataAppts = await resAppts.json();
      const dataAuth = await resAuth.json();

      setSettings(dataSettings);
      setAppointments(dataAppts);

      if (dataAuth.isAuthenticated) {
        setIsProviderAuthenticated(true);
        setProviderUser(dataAuth.user);
      }
    } catch (err) {
      console.error('Error cargando datos iniciales:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/appointments');
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error('Error actualizando citas:', err);
    }
  };

  // Launch Google OAuth Login Flow
  const handleGoogleLogin = async () => {
    setLoggingIn(true);
    setAuthError('');
    try {
      const res = await fetch('/api/google/auth-url');
      const data = await res.json();
      if (data.url) {
        window.open(data.url, 'google_oauth_popup', 'width=600,height=700');
      } else {
        setAuthError(data.error || 'Asegúrate de haber configurado el Client ID y Client Secret en Configuración.');
        setLoggingIn(false);
      }
    } catch (err) {
      setAuthError('Error conectando con el servidor backend.');
      setLoggingIn(false);
    }
  };

  const handleLogoutProvider = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    setIsProviderAuthenticated(false);
    setProviderUser(null);
    setActiveRole('client');
  };

  const handleSwitchToClient = () => {
    if (activeRole === 'provider') {
      setActiveRole('client');
    } else if (isProviderAuthenticated) {
      setActiveRole('provider');
    }
  };

  // Triggered when client books a new appointment
  const handleAppointmentCreated = (newAppointment) => {
    fetchAppointments();

    const notifObj = {
      id: `notif-${Date.now()}`,
      clientName: newAppointment.clientName,
      serviceName: newAppointment.serviceName,
      date: newAppointment.date,
      startTime: newAppointment.startTime
    };
    setNotifications(prev => [notifObj, ...prev]);

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
      // Audio safeguard
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchAppointments();
      }
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const handleDeleteAppointment = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta cita?')) return;
    try {
      const res = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAppointments();
      }
    } catch (err) {
      console.error('Error al eliminar cita:', err);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        fetchAppointments();
      }
    } catch (err) {
      console.error('Error guardando ajustes:', err);
    }
  };

  const handleDismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleViewNotification = () => {
    if (isProviderAuthenticated) {
      setActiveRole('provider');
    } else {
      setShowAuthModal(true);
    }
  };

  if (loading) {
    return (
      <div className="app-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--accent-primary)', marginBottom: '8px' }}>Cargando Sistema de Agendamiento...</h2>
          <p>Conectando con el servidor y verificando disponibilidad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header Navigation */}
      <Navbar
        activeRole={activeRole}
        isProviderAuthenticated={isProviderAuthenticated}
        providerUser={providerUser}
        onOpenProviderAuth={() => {
          setAuthError('');
          setShowAuthModal(true);
        }}
        onSwitchToClient={handleSwitchToClient}
        onOpenSettings={() => setShowSettings(true)}
        onLogoutProvider={handleLogoutProvider}
        settings={settings}
        notificationCount={notifications.length}
      />

      {/* Main Active View */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {activeRole === 'client' || !isProviderAuthenticated ? (
          <ClientPortal
            settings={settings}
            onAppointmentCreated={handleAppointmentCreated}
          />
        ) : (
          <ProviderDashboard
            settings={settings}
            appointments={appointments}
            onRefresh={fetchAppointments}
            onUpdateStatus={handleUpdateStatus}
            onDeleteAppointment={handleDeleteAppointment}
          />
        )}
      </main>

      {/* App Footer */}
      <Footer />

      {/* Provider Google OAuth Modal */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAuthModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              Acceso a Panel de Proveedor
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
              Inicia sesión con tu cuenta de <strong>Google</strong> autorizada. Sincronizaremos automáticamente tus citas en <strong>Google Calendar</strong> en segundo plano.
            </p>

            {authError && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  marginBottom: '18px',
                  color: '#991b1b',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textAlign: 'left'
                }}
              >
                <AlertCircle size={18} style={{ shrink: 0, color: '#dc2626' }} />
                <div>{authError}</div>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGoogleLogin}
              disabled={loggingIn}
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px 16px',
                fontSize: '0.95rem',
                fontWeight: 600,
                marginBottom: '14px',
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              {loggingIn ? 'Abriendo Google Sign-In...' : 'Iniciar Sesión con Google'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAuthModal(false)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal (Only accessible for authenticated provider) */}
      {showSettings && isProviderAuthenticated && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaveSettings={handleSaveSettings}
        />
      )}

      {/* Real-time Notification Toast System */}
      {isProviderAuthenticated && (
        <NotificationToast
          notifications={notifications}
          onDismiss={handleDismissNotification}
          onViewNotification={handleViewNotification}
        />
      )}
    </div>
  );
}
