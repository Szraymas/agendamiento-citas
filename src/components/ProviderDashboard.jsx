import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  User,
  Phone,
  Mail,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  List,
  Grid,
  X
} from 'lucide-react';
import { formatCOP } from '../utils/formatCurrency';

export default function ProviderDashboard({ settings, appointments, onRefresh, onUpdateStatus, onDeleteAppointment }) {
  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 5;

  const todayObj = new Date();
  const todayStr = todayObj.toISOString().split('T')[0];

  // Helper: Find service color by serviceId or serviceName
  const getServiceColor = (serviceId, serviceName) => {
    const matched = settings?.services?.find(s => s.id === serviceId || s.name === serviceName);
    return matched?.color || 'var(--accent-primary)';
  };

  // Helper: Find service price in COP
  const getServicePrice = (serviceId, serviceName) => {
    const matched = settings?.services?.find(s => s.id === serviceId || s.name === serviceName);
    return matched?.price || 0;
  };

  // Calculate Metrics
  const todayAppts = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
  const todayCount = todayAppts.length;
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const confirmedCount = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').length;

  // Calculate total revenue in COP for confirmed/completed appointments
  const totalRevenueCOP = appointments
    .filter(a => a.status === 'confirmed' || a.status === 'completed')
    .reduce((sum, a) => sum + getServicePrice(a.serviceId, a.serviceName), 0);

  // Filtered appointments for List view
  const filteredAppointments = appointments.filter(apt => {
    if (filterStatus !== 'all' && apt.status !== filterStatus) return false;
    if (filterDate && apt.date !== filterDate) return false;
    return true;
  });

  // Reset pagination when filters or appointments change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterDate, appointments.length]);

  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE) || 1;
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calendar Grid Calculations
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleTodayMonth = () => {
    setCurrentMonthDate(new Date());
  };

  // Build calendar days array
  const calendarDays = [];
  // Days from previous month
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const d = new Date(year, month - 1, dayNum);
    const dateStr = d.toISOString().split('T')[0];
    calendarDays.push({ dayNum, dateStr, isCurrentMonth: false });
  }
  // Days from current month
  for (let d = 1; d <= daysInMonth; d++) {
    const monthFormatted = String(month + 1).padStart(2, '0');
    const dayFormatted = String(d).padStart(2, '0');
    const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;
    calendarDays.push({ dayNum: d, dateStr, isCurrentMonth: true });
  }
  // Overflow days for next month to complete 35 or 42 grid cells
  const remainingCells = (calendarDays.length <= 35 ? 35 : 42) - calendarDays.length;
  for (let d = 1; d <= remainingCells; d++) {
    const monthFormatted = String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0');
    const targetYear = month + 2 > 12 ? year + 1 : year;
    const dayFormatted = String(d).padStart(2, '0');
    const dateStr = `${targetYear}-${monthFormatted}-${dayFormatted}`;
    calendarDays.push({ dayNum: d, dateStr, isCurrentMonth: false });
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Citas para Hoy ({todayStr})</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--accent-primary)', marginTop: '4px', margin: 0 }}>{todayCount}</h2>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Pendientes por Confirmar</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--accent-warning)', marginTop: '4px', margin: 0 }}>{pendingCount}</h2>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Citas Confirmadas</span>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--accent-secondary)', marginTop: '4px', margin: 0 }}>{confirmedCount}</h2>
        </div>

        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>Ingresos Estimados (COP)</span>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-primary)', marginTop: '6px', margin: 0, fontWeight: 700 }}>
            {formatCOP(totalRevenueCOP)}
          </h2>
        </div>
      </div>

      {/* Main Agenda Section & View Controls */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Calendario y Gestión de Citas del Proveedor</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              Citas del mes en curso y futuras. El historial completo permanece respaldado en Google Calendar.
            </p>
          </div>

          <div className="dashboard-header-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Actualizar datos">
              <RefreshCw size={15} /> Actualizar
            </button>

            {/* View Mode Switcher */}
            <div className="dashboard-view-switcher" style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setViewMode('calendar')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: viewMode === 'calendar' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'calendar' ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Grid size={15} /> Vista Calendario
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'list' ? 'white' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <List size={15} /> Lista ({appointments.length})
              </button>
            </div>
          </div>
        </div>

        {/* ================= CALENDAR VIEW (Desktop only) ================= */}
        <div className={`dashboard-calendar-view ${viewMode !== 'calendar' ? 'hidden-desktop' : ''}`}>
          {/* Calendar Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                {monthNames[month]} {year}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={handleTodayMonth} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                Hoy
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth} title="Mes anterior">
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleNextMonth} title="Mes siguiente">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Service Legend */}
          <div style={{ display: 'flex', gap: '14px', marginBottom: '14px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            {settings?.services?.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                <span>{s.name} ({formatCOP(s.price)})</span>
              </div>
            ))}
          </div>

          {/* Calendar Week Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
            <div>Dom</div>
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
          </div>

          {/* Calendar Grid Cells */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {calendarDays.map((cell, idx) => {
              const dayAppts = appointments.filter(a => a.date === cell.dateStr && a.status !== 'cancelled');
              const isToday = cell.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  className="calendar-cell"
                  style={{
                    minHeight: '110px',
                    padding: '6px',
                    borderRadius: 'var(--radius-sm)',
                    background: isToday ? '#eef2ff' : cell.isCurrentMonth ? '#ffffff' : '#f8fafc',
                    border: `1px solid ${isToday ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    opacity: cell.isCurrentMonth ? 1 : 0.45,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontWeight: isToday ? 800 : 600,
                        fontSize: '0.8rem',
                        color: isToday ? 'var(--accent-primary)' : 'var(--text-primary)',
                        background: isToday ? 'var(--accent-secondary-bg)' : 'transparent',
                        padding: '2px 5px',
                        borderRadius: '999px'
                      }}
                    >
                      {cell.dayNum}
                    </span>
                    {dayAppts.length > 0 && (
                      <span className="badge badge-available" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                        {dayAppts.length}
                      </span>
                    )}
                  </div>

                  {/* Appointment Pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', maxHeight: '75px' }}>
                    {dayAppts.map(apt => {
                      const sColor = getServiceColor(apt.serviceId, apt.serviceName);
                      return (
                        <div
                          key={apt.id}
                          className="calendar-cell-pill"
                          onClick={() => setSelectedAppointment(apt)}
                          style={{
                            background: `${sColor}18`,
                            borderLeft: `3px solid ${sColor}`,
                            borderRadius: '4px',
                            padding: '3px 5px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            transition: 'transform 0.1s',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          title={`${apt.startTime} - ${apt.clientName} (${apt.serviceName})`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: sColor }}>
                            <span>{apt.startTime}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.9 }}>
                              {apt.status === 'confirmed' ? '✓' : apt.status === 'completed' ? '★' : '⌛'}
                            </span>
                          </div>
                          <span className="calendar-pill-name" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                            {apt.clientName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= LIST VIEW ================= */}
        <div className={`dashboard-list-view ${viewMode !== 'list' ? 'hidden-desktop' : ''}`}>
          <div className="provider-filter-bar" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              style={{ width: '160px', padding: '6px 10px', fontSize: '0.82rem', minHeight: '36px' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button className="btn btn-secondary btn-sm" onClick={() => setFilterDate('')}>Limpiar Fecha</button>
            )}

            <div className="provider-status-filter" style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              {['all', 'confirmed', 'pending', 'completed', 'cancelled'].map(st => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.75rem',
                    border: 'none',
                    borderRadius: '6px',
                    background: filterStatus === st ? 'var(--accent-primary)' : 'transparent',
                    color: filterStatus === st ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {st === 'all' ? 'Todas' : st === 'confirmed' ? 'Confirmadas' : st === 'pending' ? 'Pendientes' : st === 'completed' ? 'Completadas' : 'Canceladas'}
                </button>
              ))}
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <CalendarIcon size={36} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <p>No se encontraron citas con los filtros seleccionados.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paginatedAppointments.map(apt => {
                  const isToday = apt.date === todayStr;
                  const priceCOP = getServicePrice(apt.serviceId, apt.serviceName);

                  return (
                    <div
                      key={apt.id}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 'var(--radius-md)',
                        background: isToday ? '#eef2ff' : '#ffffff',
                        border: `1px solid ${isToday ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              background: 'var(--bg-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--accent-primary)',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}
                          >
                            <User size={18} />
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{apt.clientName}</h4>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', flexWrap: 'wrap' }}>
                              <span><Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />{apt.clientEmail}</span>
                              {apt.clientPhone && <span><Phone size={12} style={{ display: 'inline', marginRight: '4px' }} />{apt.clientPhone}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge badge-google">
                            {apt.serviceName} ({formatCOP(priceCOP)})
                          </span>
                          <span
                            className="badge"
                            style={{
                              background: apt.status === 'confirmed' ? 'var(--accent-secondary-bg)' : apt.status === 'pending' ? '#fffbeb' : apt.status === 'completed' ? '#f0f9ff' : 'var(--accent-danger-bg)',
                              color: apt.status === 'confirmed' ? 'var(--accent-secondary)' : apt.status === 'pending' ? 'var(--accent-warning)' : apt.status === 'completed' ? 'var(--accent-info)' : 'var(--accent-danger)'
                            }}
                          >
                            {apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '14px', fontSize: '0.85rem' }}>
                          <span><CalendarIcon size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--accent-primary)' }} /><strong>{apt.date}</strong></span>
                          <span><Clock size={14} style={{ display: 'inline', marginRight: '4px', color: 'var(--accent-secondary)' }} /><strong>{apt.startTime} - {apt.endTime} hs</strong></span>
                        </div>

                        {apt.notes && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <FileText size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            <em>"{apt.notes}"</em>
                          </div>
                        )}
                      </div>

                      {/* Actions Bar */}
                      <div className="appointment-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingTop: '4px', flexWrap: 'wrap' }}>
                        {apt.status === 'pending' && (
                          <button className="btn btn-outline-emerald btn-sm" onClick={() => onUpdateStatus(apt.id, 'confirmed')}>
                            <CheckCircle2 size={13} /> Confirmar
                          </button>
                        )}
                        {apt.status === 'confirmed' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => onUpdateStatus(apt.id, 'completed')}>
                            <CheckCircle2 size={13} /> Completar
                          </button>
                        )}
                        {apt.status !== 'cancelled' && (
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--accent-danger)' }} onClick={() => onUpdateStatus(apt.id, 'cancelled')}>
                            <XCircle size={13} /> Cancelar
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => onDeleteAppointment(apt.id)} title="Eliminar cita">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls when more than 5 appointments */}
              {filteredAppointments.length > 5 && (
                <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '24px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{ padding: '3px 12px', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    <ChevronLeft size={16} /> Anterior
                  </button>

                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={{
                          minWidth: '34px',
                          height: '34px',
                          padding: '0 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${currentPage === pageNum ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          background: currentPage === pageNum ? 'var(--accent-primary)' : '#ffffff',
                          color: currentPage === pageNum ? '#ffffff' : 'var(--text-primary)',
                          fontWeight: 500,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{ padding: '6px 12px', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                  >
                    Siguiente <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Appointment Detail Modal (when clicked from calendar) */}
      {selectedAppointment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Detalles de la Cita</h3>
              <button
                onClick={() => setSelectedAppointment(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <span className="badge badge-google" style={{ marginBottom: '8px', display: 'inline-block' }}>
                  {selectedAppointment.serviceName}
                </span>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                  {selectedAppointment.clientName}
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--accent-secondary)', fontWeight: 700, margin: '4px 0 0 0' }}>
                  Precio: {formatCOP(getServicePrice(selectedAppointment.serviceId, selectedAppointment.serviceName))}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Fecha:</span>
                  <p style={{ fontWeight: 700, margin: 0 }}>{selectedAppointment.date}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Horario:</span>
                  <p style={{ fontWeight: 700, margin: 0 }}>{selectedAppointment.startTime} - {selectedAppointment.endTime} hs</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Correo del Cliente:</span>
                  <p style={{ fontWeight: 700, margin: 0 }}>{selectedAppointment.clientEmail}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Teléfono / WhatsApp:</span>
                  <p style={{ fontWeight: 700, margin: 0 }}>{selectedAppointment.clientPhone || 'No especificado'}</p>
                </div>
              </div>

              {selectedAppointment.notes && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Notas adicionales:</span>
                  <p style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 'var(--radius-sm)', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                    "{selectedAppointment.notes}"
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '10px' }}>
                <span
                  className="badge"
                  style={{
                    background: selectedAppointment.status === 'confirmed' ? 'var(--accent-secondary-bg)' : selectedAppointment.status === 'pending' ? '#fffbeb' : selectedAppointment.status === 'completed' ? '#f0f9ff' : 'var(--accent-danger-bg)',
                    color: selectedAppointment.status === 'confirmed' ? 'var(--accent-secondary)' : selectedAppointment.status === 'pending' ? 'var(--accent-warning)' : selectedAppointment.status === 'completed' ? 'var(--accent-info)' : 'var(--accent-danger)'
                  }}
                >
                  Estado: {selectedAppointment.status === 'confirmed' ? 'Confirmada' : selectedAppointment.status === 'pending' ? 'Pendiente' : selectedAppointment.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {selectedAppointment.status === 'pending' && (
                    <button
                      className="btn btn-outline-emerald btn-sm"
                      onClick={() => {
                        onUpdateStatus(selectedAppointment.id, 'confirmed');
                        setSelectedAppointment(null);
                      }}
                    >
                      Confirmar
                    </button>
                  )}
                  {selectedAppointment.status === 'confirmed' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        onUpdateStatus(selectedAppointment.id, 'completed');
                        setSelectedAppointment(null);
                      }}
                    >
                      Completar
                    </button>
                  )}
                  {selectedAppointment.status !== 'cancelled' && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--accent-danger)' }}
                      onClick={() => {
                        onUpdateStatus(selectedAppointment.id, 'cancelled');
                        setSelectedAppointment(null);
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      onDeleteAppointment(selectedAppointment.id);
                      setSelectedAppointment(null);
                    }}
                    title="Eliminar cita"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
