/**
 * Generate a Google Calendar web URL for instant "Add to Google Calendar"
 */
export function generateGoogleCalendarUrl(appointment, settings) {
  if (!appointment) return '#';

  const title = encodeURIComponent(`${appointment.serviceName} - ${settings?.providerName || 'Cita'}`);
  const details = encodeURIComponent(
    `Cita agendada para ${appointment.clientName}.\nServicio: ${appointment.serviceName}\nNotas: ${appointment.notes || 'Ninguna'}`
  );
  const location = encodeURIComponent(settings?.providerName || 'Consultorio / En línea');

  // Format dates: YYYYMMDDTHHmmssZ
  const formatDateToIso = (dateStr, timeStr) => {
    const d = new Date(`${dateStr}T${timeStr}:00`);
    return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  };

  const startIso = formatDateToIso(appointment.date, appointment.startTime);
  const endIso = formatDateToIso(appointment.date, appointment.endTime);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
}

/**
 * Generate and trigger download of an .ics file (iCalendar standard)
 */
export function downloadIcsFile(appointment, settings) {
  if (!appointment) return;

  const formatDateToIcs = (dateStr, timeStr) => {
    const d = new Date(`${dateStr}T${timeStr}:00`);
    return d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  };

  const startIso = formatDateToIcs(appointment.date, appointment.startTime);
  const endIso = formatDateToIcs(appointment.date, appointment.endTime);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AgendamientoCitas//ES',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:apt-${appointment.id}@agendamiento.app`,
    `DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, '')}`,
    `DTSTART:${startIso}`,
    `DTEND:${endIso}`,
    `SUMMARY:${appointment.serviceName} - ${settings?.providerName || 'Cita'}`,
    `DESCRIPTION:Cliente: ${appointment.clientName}\\nEmail: ${appointment.clientEmail}\\nTelefono: ${appointment.clientPhone}\\nNotas: ${appointment.notes || 'Ninguna'}`,
    `LOCATION:${settings?.providerName || 'Consultorio / En línea'}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio de Cita',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Cita_${appointment.clientName.replace(/\s+/g, '_')}_${appointment.date}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
