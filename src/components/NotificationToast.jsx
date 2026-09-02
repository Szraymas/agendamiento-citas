import React from 'react';
import { Bell, X, Calendar, Clock } from 'lucide-react';

export default function NotificationToast({ notifications, onDismiss, onViewNotification }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="toast-container">
      {notifications.map((notif) => (
        <div key={notif.id} className="toast">
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: 'var(--accent-secondary-bg)',
              color: 'var(--accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Bell size={18} />
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>¡Nueva Cita Agendada!</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '3px 0 6px 0' }}>
              <strong>{notif.clientName}</strong> reservó <strong>{notif.serviceName}</strong>.
            </p>

            <div style={{ display: 'flex', gap: '10px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span><Calendar size={11} style={{ display: 'inline', marginRight: '3px' }} />{notif.date}</span>
              <span><Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />{notif.startTime} hs</span>
            </div>

            <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.72rem', padding: '3px 8px', minHeight: '28px' }}
                onClick={() => {
                  onViewNotification(notif);
                  onDismiss(notif.id);
                }}
              >
                Ver en Agenda
              </button>
            </div>
          </div>

          <button
            onClick={() => onDismiss(notif.id)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
