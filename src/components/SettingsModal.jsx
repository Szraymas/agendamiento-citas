import React, { useState } from 'react';
import { X, Save, Tag, User } from 'lucide-react';
import { formatCOP } from '../utils/formatCurrency';

const DAY_LABELS = [
  { value: 0, label: 'Dom', full: 'Domingo' },
  { value: 1, label: 'Lun', full: 'Lunes' },
  { value: 2, label: 'Mar', full: 'Martes' },
  { value: 3, label: 'Mié', full: 'Miércoles' },
  { value: 4, label: 'Jue', full: 'Jueves' },
  { value: 5, label: 'Vie', full: 'Viernes' },
  { value: 6, label: 'Sáb', full: 'Sábado' },
];

function buildDaysText(allowedDays) {
  if (!allowedDays || allowedDays.length === 0) return '';
  const sorted = [...allowedDays].sort((a, b) => a - b);
  return sorted.map(d => DAY_LABELS[d]?.full || '').filter(Boolean).join(', ');
}

export default function SettingsModal({ settings, onClose, onSaveSettings }) {
  const [formData, setFormData] = useState({
    providerName: settings?.providerName || '',
    providerEmail: settings?.providerEmail || '',
    providerPhone: settings?.providerPhone || '',
    allowedEmails: settings?.allowedEmails || (settings?.providerEmail ? [settings.providerEmail] : []),
    workStartTime: settings?.workStartTime || '08:00',
    workEndTime: settings?.workEndTime || '17:00',
    slotDurationMinutes: settings?.slotDurationMinutes || 45,
    bufferMinutes: settings?.bufferMinutes || 15,
    workingDays: settings?.workingDays || [0, 1, 2, 3, 4, 5, 6],
    services: settings?.services ? JSON.parse(JSON.stringify(settings.services)) : [],
    googleCalendar: settings?.googleCalendar
      ? { ...settings.googleCalendar }
      : { enabled: false, calendarId: 'primary', apiKey: '', clientId: '', clientSecret: '', refreshToken: '' },
  });

  const handleServiceChange = (index, field, value) => {
    const updatedServices = [...formData.services];
    updatedServices[index] = {
      ...updatedServices[index],
      [field]: field === 'price' || field === 'duration' ? Number(value) : value,
    };
    setFormData({ ...formData, services: updatedServices });
  };

  const handleServiceDayToggle = (serviceIndex, dayValue) => {
    const updatedServices = [...formData.services];
    const service = { ...updatedServices[serviceIndex] };
    const current = service.allowedDays ? [...service.allowedDays] : [];
    const exists = current.includes(dayValue);
    const next = exists ? current.filter(d => d !== dayValue) : [...current, dayValue];
    service.allowedDays = next;
    service.daysText = buildDaysText(next);
    updatedServices[serviceIndex] = service;
    setFormData({ ...formData, services: updatedServices });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Configuración del Sistema</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Administra servicios, precios, horarios y días de atención
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Provider Info */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} /> Información del Proveedor
            </h4>
            <div className="settings-provider-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Nombre del Encargado / Negocio</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.providerName}
                  onChange={(e) => setFormData({ ...formData, providerName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Correo Principal de Notificaciones</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.providerEmail}
                  onChange={(e) => setFormData({ ...formData, providerEmail: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Número de WhatsApp</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.providerPhone}
                  onChange={(e) => setFormData({ ...formData, providerPhone: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Services Section */}
          <div style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={16} /> Servicios — Precios, Duración y Días de Atención
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Configura el nombre, precio (COP), duración y los días en que se ofrece cada servicio.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {formData.services.map((service, index) => (
                <div
                  key={service.id || index}
                  style={{
                    background: '#ffffff',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Service header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: service.color, flexShrink: 0 }} />
                    <strong style={{ fontSize: '0.95rem' }}>{service.name}</strong>
                  </div>

                  {/* Name / Price / Duration row */}
                  <div className="settings-service-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Nombre del Servicio</label>
                      <input
                        type="text"
                        className="form-input"
                        value={service.name}
                        onChange={(e) => handleServiceChange(index, 'name', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Precio (COP $)</label>
                      <input
                        type="number"
                        step="1000"
                        className="form-input"
                        value={service.price}
                        onChange={(e) => handleServiceChange(index, 'price', e.target.value)}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--accent-secondary)', fontWeight: 600, marginTop: '2px', display: 'block' }}>
                        {formatCOP(service.price)}
                      </span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Duración (min)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={service.duration}
                        onChange={(e) => handleServiceChange(index, 'duration', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="form-group" style={{ margin: '0 0 12px 0' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Descripción Corta</label>
                    <input
                      type="text"
                      className="form-input"
                      value={service.description}
                      onChange={(e) => handleServiceChange(index, 'description', e.target.value)}
                    />
                  </div>

                  {/* Days of attention */}
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '6px', display: 'block' }}>
                      Días de Atención
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {DAY_LABELS.map((day) => {
                        const active = (service.allowedDays || []).includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            title={day.full}
                            className="day-toggle-pill"
                            onClick={() => handleServiceDayToggle(index, day.value)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '999px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: active
                                ? `2px solid ${service.color}`
                                : '2px solid var(--border-color)',
                              background: active ? service.color : 'transparent',
                              color: active ? '#ffffff' : 'var(--text-secondary)',
                              transition: 'all 0.15s ease',
                              minHeight: '32px',
                            }}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    {(service.allowedDays || []).length === 0 && (
                      <p style={{ fontSize: '0.74rem', color: '#ef4444', margin: '4px 0 0 0' }}>
                        Selecciona al menos un día de atención.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Working Hours */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}>Horario General de Atención</h4>
            <div className="settings-provider-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Hora Inicio</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.workStartTime}
                  onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hora Fin</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.workEndTime}
                  onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descanso entre citas (min)</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.bufferMinutes}
                  onChange={(e) => setFormData({ ...formData, bufferMinutes: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary"><Save size={16} /> Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}
