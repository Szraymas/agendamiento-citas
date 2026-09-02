import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, Phone, FileText, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatCOP } from '../utils/formatCurrency';

const getColombiaDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
};

const getColombiaTimeString = () => {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

export default function ClientPortal({ settings, onAppointmentCreated }) {
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState(settings?.services?.[0] || null);
  const [selectedDate, setSelectedDate] = useState(getColombiaDateString());
  const [availability, setAvailability] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Form & Validation State
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: ''
  });

  const [formErrors, setFormErrors] = useState({
    clientName: '',
    clientEmail: '',
    clientPhone: ''
  });

  const [bookingResult, setBookingResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Update selected service if settings change
  useEffect(() => {
    if (settings?.services && !selectedService) {
      setSelectedService(settings.services[0]);
    }
  }, [settings]);

  // Fetch availability whenever date or service changes
  useEffect(() => {
    if (selectedService && selectedDate) {
      fetchAvailability(selectedDate, selectedService.id);
    }
  }, [selectedDate, selectedService]);

  const fetchAvailability = async (dateStr, serviceId) => {
    setLoadingSlots(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/availability?date=${dateStr}&serviceId=${serviceId}`);
      const data = await res.json();
      setAvailability(data);
      setSelectedSlot(null);
    } catch (err) {
      console.error('Error cargando disponibilidad:', err);
      setErrorMsg('No se pudo conectar con el servidor para consultar disponibilidad.');
    } finally {
      setLoadingSlots(false);
    }
  };

  // Real-time Field Validations
  const validateField = (field, value) => {
    let error = '';

    if (field === 'clientName') {
      if (!value.trim()) {
        error = 'El nombre completo es requerido.';
      } else if (value.trim().length < 3) {
        error = 'El nombre debe tener al menos 3 caracteres.';
      }
    }

    if (field === 'clientEmail') {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!value.trim()) {
        error = 'El correo electrónico es requerido.';
      } else if (!emailRegex.test(value)) {
        error = 'Introduce un correo válido (ej: usuario@gmail.com).';
      }
    }

    if (field === 'clientPhone') {
      const phoneDigits = value.replace(/\D/g, '');
      if (!value.trim()) {
        error = 'El teléfono es requerido para notificaciones.';
      } else if (!/^(?:57)?3\d{9}$/.test(phoneDigits)) {
        error = 'Ingresa un celular colombiano válido (ej: 300 123 4567 o +57 300 123 4567)';
      }
    }

    setFormErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const isFormValid = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const phoneDigits = formData.clientPhone.replace(/\D/g, '');

    return (
      formData.clientName.trim().length >= 3 &&
      emailRegex.test(formData.clientEmail) &&
      /^(?:57)?3\d{9}$/.test(phoneDigits) &&
      !formErrors.clientName &&
      !formErrors.clientEmail &&
      !formErrors.clientPhone
    );
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !isFormValid()) return;

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      clientName: formData.clientName,
      clientEmail: formData.clientEmail,
      clientPhone: formData.clientPhone,
      serviceId: selectedService.id,
      date: selectedDate,
      startTime: selectedSlot.startTime,
      notes: formData.notes
    };

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        setBookingResult(data);
        setStep(4);
        if (onAppointmentCreated) {
          onAppointmentCreated(data.appointment);
        }
      } else {
        setErrorMsg(data.error || 'Ocurrió un error al procesar el agendamiento.');
      }
    } catch (err) {
      setErrorMsg('Error de conexión al servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setBookingResult(null);
    setSelectedSlot(null);
    setFormData({ clientName: '', clientEmail: '', clientPhone: '', notes: '' });
    setFormErrors({ clientName: '', clientEmail: '', clientPhone: '' });
  };

  const todayStr = getColombiaDateString();

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', width: '100%', padding: '0 2px' }}>
      {/* Wizard Progress Steps */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '14px 16px' }}>
        <div className="wizard-steps-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {[
            { num: 1, label: 'Servicio' },
            { num: 2, label: 'Fecha y Hora' },
            { num: 3, label: 'Tus Datos' },
            { num: 4, label: 'Confirmación' }
          ].map((item) => (
            <div
              key={item.num}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: step >= item.num ? 1 : 0.4
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: step >= item.num ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: step >= item.num ? 'white' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  flexShrink: 0
                }}
              >
                {step > item.num ? '✓' : item.num}
              </div>
              <span className="wizard-step-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            background: 'var(--accent-danger-bg)',
            border: '1px solid var(--accent-danger)',
            color: 'var(--accent-danger)',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem'
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: Select Service */}
      {step === 1 && (
        <div className="glass-card">
          <h2 style={{ marginBottom: '6px' }}>Paso 1: Selecciona el Servicio</h2>
          <p style={{ marginBottom: '20px' }}>Elige el servicio que deseas agendar. Cada servicio tiene días de atención específicos.</p>

          <div className="service-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            {settings?.services?.map((service) => {
              const isSelected = selectedService?.id === service.id;
              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'var(--accent-secondary-bg)' : '#ffffff',
                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {service.name}
                      </h3>
                      <span className="badge badge-available" style={{ background: `${service.color}15`, color: service.color, border: 'none', fontWeight: 'bold' }}>
                        {formatCOP(service.price)}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.85rem', marginBottom: '14px', minHeight: '38px' }}>{service.description}</p>

                    <div style={{ marginBottom: '12px' }}>
                      <span className="badge badge-days">
                        📅 Días: <strong>{service.daysText}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.82rem', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                    <Clock size={14} />
                    <span>Duración: {service.duration} minutos</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!selectedService}>
              Elegir Fecha y Hora <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Select Date & Slot */}
      {step === 2 && (
        <div className="glass-card">
          <h2 style={{ marginBottom: '6px' }}>Paso 2: Fecha y Horarios Disponibles</h2>
          <p style={{ marginBottom: '18px' }}>
            Servicio seleccionado: <strong style={{ color: 'var(--accent-primary)' }}>{selectedService?.name}</strong>
          </p>

          <div className="date-info-bar" style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
              Días habilitados para este servicio: <span style={{ color: 'var(--accent-primary)' }}>{selectedService?.daysText}</span>
            </span>
          </div>

          <div className="form-group" style={{ maxWidth: '280px' }}>
            <label className="form-label">Selecciona el día para tu cita:</label>
            <input
              type="date"
              className="form-input"
              min={todayStr}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {loadingSlots ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Consultando horarios disponibles...
            </div>
          ) : availability && !availability.isWorkingDay ? (
            <div style={{ padding: '24px', background: 'var(--accent-danger-bg)', border: '1px solid var(--accent-danger)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <p style={{ color: 'var(--accent-danger)', fontWeight: 700, marginBottom: '6px' }}>
                {availability.message}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                Por favor selecciona una fecha que corresponda a los días de atención de este servicio.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0 }}>Horarios libres para {selectedDate}:</h4>
                <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem' }}>
                  <span className="badge badge-available">Disponible</span>
                  <span className="badge badge-booked">Ocupado</span>
                </div>
              </div>

              {availability?.slots?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No hay horarios disponibles en esta fecha.</p>
              ) : (
                <div className="slots-grid">
                  {availability?.slots?.map((slot, i) => {
                    const isToday = selectedDate === todayStr;
                    const currentTime = getColombiaTimeString();
                    const isPast = isToday && slot.startTime <= currentTime;
                    const isAvailable = slot.available && !isPast;
                    const isSelected = selectedSlot?.startTime === slot.startTime;

                    return (
                      <div
                        key={i}
                        className={`slot-card ${isAvailable ? 'available' : 'disabled'} ${isSelected ? 'selected' : ''}`}
                        onClick={() => isAvailable && setSelectedSlot(slot)}
                      >
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{slot.startTime}</span>
                        <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>a {slot.endTime}</span>
                        {isAvailable ? (
                          <span style={{ fontSize: '0.68rem', color: isSelected ? '#fff' : 'var(--accent-secondary)', fontWeight: 'bold', marginTop: '2px' }}>
                            Disponible
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', color: 'var(--accent-danger)', fontWeight: 'bold', marginTop: '2px' }}>
                            {isPast ? 'Hora pasada' : (slot.reason || 'Ocupado')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Volver
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!selectedSlot}>
              Ingresar Mis Datos <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Client Details & Validations */}
      {step === 3 && (
        <div className="glass-card">
          <h2 style={{ marginBottom: '6px' }}>Paso 3: Tus Datos de Contacto</h2>
          <p style={{ marginBottom: '20px' }}>
            Cita para el día <strong>{selectedDate}</strong> a las <strong>{selectedSlot?.startTime} hs</strong> ({selectedService?.name}).
          </p>

          <form onSubmit={handleSubmitBooking}>
            <div className="form-group">
              <label className="form-label"><User size={15} style={{ display: 'inline', marginRight: '6px' }} />Nombre Completo *</label>
              <input
                type="text"
                required
                className={`form-input ${formErrors.clientName ? 'error' : ''}`}
                placeholder="Ej: Laura Restrepo"
                value={formData.clientName}
                onChange={(e) => handleInputChange('clientName', e.target.value)}
              />
              {formErrors.clientName && <span className="error-text">{formErrors.clientName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label"><Mail size={15} style={{ display: 'inline', marginRight: '6px' }} />Correo Electrónico *</label>
              <input
                type="email"
                required
                className={`form-input ${formErrors.clientEmail ? 'error' : ''}`}
                placeholder="ejemplo@gmail.com"
                value={formData.clientEmail}
                onChange={(e) => handleInputChange('clientEmail', e.target.value)}
              />
              {formErrors.clientEmail && <span className="error-text">{formErrors.clientEmail}</span>}
            </div>

            <div className="form-group">
              <label className="form-label"><Phone size={15} style={{ display: 'inline', marginRight: '6px' }} />Teléfono / WhatsApp *</label>
              <input
                type="tel"
                required
                className={`form-input ${formErrors.clientPhone ? 'error' : ''}`}
                placeholder="+57 300 123 4567"
                value={formData.clientPhone}
                onChange={(e) => handleInputChange('clientPhone', e.target.value)}
              />
              {formErrors.clientPhone && <span className="error-text">{formErrors.clientPhone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label"><FileText size={15} style={{ display: 'inline', marginRight: '6px' }} />Notas o Motivo de la Cita</label>
              <textarea
                className="form-textarea"
                rows="3"
                placeholder="Detalles adicionales para quien te va a atender..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                style={{ resize: "none" }}
              ></textarea>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                <ArrowLeft size={16} /> Volver
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || !isFormValid()}>
                {submitting ? 'Confirmando...' : 'Confirmar y Notificar'} <CheckCircle size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 4: Success Message for Client */}
      {step === 4 && bookingResult && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--accent-secondary-bg)',
              color: 'var(--accent-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <CheckCircle size={40} />
          </div>

          <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', marginBottom: '8px' }}>
            ¡Servicio Agendado!
          </h2>

          <p style={{ fontSize: '1rem', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '20px' }}>
            {bookingResult.appointment.serviceName} — {bookingResult.appointment.date} a las {bookingResult.appointment.startTime} hs
          </p>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 20px',
              textAlign: 'center',
              marginBottom: '28px',
              maxWidth: '560px',
              margin: '0 auto 28px auto',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p style={{ fontSize: '0.98rem', color: 'var(--text-primary)', margin: '0 0 16px 0', lineHeight: '1.6' }}>
              En caso de que desees cancelar o modificar tu cita, por favor envíame un mensaje por <strong>WhatsApp</strong> o por <strong>correo electrónico</strong>. ¡Muchas gracias!
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-secondary)', fontWeight: 700 }}>
                <Phone size={16} />
                <span>WhatsApp: {settings?.providerPhone || ''}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontWeight: 700 }}>
                <Mail size={16} />
                <span>Correo: {settings?.providerEmail || ''}</span>
              </div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleReset}>
            Agendar otra cita
          </button>
        </div>
      )}
    </div>
  );
}
