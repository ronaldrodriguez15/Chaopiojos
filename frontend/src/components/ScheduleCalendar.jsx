import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, UserCircle2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-purple-100 text-purple-700 border-purple-200',
  cancelled: 'bg-red-100 text-red-600 border-red-200',
  external: 'bg-blue-100 text-blue-700 border-blue-200'
};

const statusLabels = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  external: 'Cita Externa'
};

const statusBadgeStyles = {
  pending: 'bg-yellow-200 text-yellow-700 border-yellow-300',
  confirmed: 'bg-green-200 text-green-700 border-green-300',
  completed: 'bg-purple-200 text-purple-700 border-purple-300',
  cancelled: 'bg-red-200 text-red-700 border-red-300',
  external: 'bg-blue-200 text-blue-700 border-blue-300'
};

const pad = (value) => (value < 10 ? `0${value}` : `${value}`);

const buildDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseAppointmentDate = (appointment) => {
  if (!appointment?.date) return null;
  try {
    const [year, month, day] = appointment.date.split('-').map(Number);
    if (!year || !month || !day) return null;
    const hours = appointment.time ? Number(appointment.time.split(':')[0]) : 0;
    const minutes = appointment.time ? Number(appointment.time.split(':')[1]) : 0;
    return new Date(year, month - 1, day, hours, minutes);
  } catch (error) {
    return null;
  }
};

const getCalendarRange = (currentMonth) => {
  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const start = new Date(monthStart);
  const startDay = (monthStart.getDay() + 6) % 7; // Monday as first day
  start.setDate(start.getDate() - startDay);

  const end = new Date(monthEnd);
  const endDay = (monthEnd.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - endDay));

  const days = [];
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push(new Date(date));
  }
  return days;
};

const ScheduleCalendar = ({
  appointments = [],
  piojologists = [],
  enablePiojologistFilter = false,
  title = 'Calendario de Servicios'
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [selectedPiojologist, setSelectedPiojologist] = useState('all');
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric'
    }).format(currentMonth);
  }, [currentMonth]);

  const filteredAppointments = useMemo(() => {
    const enriched = appointments
      .map((appointment) => {
        const dateObj = parseAppointmentDate(appointment);
        return {
          ...appointment,
          dateObj,
          dateKey: dateObj ? buildDateKey(dateObj) : null
        };
      })
      .filter(({ dateObj }) => Boolean(dateObj));

    if (!enablePiojologistFilter || selectedPiojologist === 'all') {
      return enriched;
    }
    return enriched.filter(({ piojologistId }) => Number(piojologistId) === Number(selectedPiojologist));
  }, [appointments, enablePiojologistFilter, selectedPiojologist]);

  const calendarDays = useMemo(() => {
    const range = getCalendarRange(currentMonth);
    const eventsByDay = filteredAppointments.reduce((acc, appointment) => {
      if (!appointment.dateKey) return acc;
      if (!acc[appointment.dateKey]) acc[appointment.dateKey] = [];
      acc[appointment.dateKey].push(appointment);
      return acc;
    }, {});

    range.forEach((day) => {
      const key = buildDateKey(day);
      if (eventsByDay[key]) {
        eventsByDay[key].sort((a, b) => (a.dateObj || 0) - (b.dateObj || 0));
      }
    });

    return range.map((day) => {
      const key = buildDateKey(day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isToday = buildDateKey(today) === key;
      const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
      return {
        date: day,
        isToday,
        isCurrentMonth,
        appointments: eventsByDay[key] || []
      };
    });
  }, [currentMonth, filteredAppointments]);

  const selectedDayKey = selectedDay ? buildDateKey(selectedDay.date) : null;

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleDayClick = (day) => {
    if (!day || day.appointments.length === 0) return;
    setSelectedDay({
      ...day,
      date: new Date(day.date)
    });
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedDay(null);
    }
  };

  const dialogDateLabel = selectedDay
    ? new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(selectedDay.date)
    : '';

  const formatTimeRange = (appointment) => {
    if (!appointment?.dateObj) return appointment?.time || 'Sin hora';
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(appointment.dateObj);
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl border-4 border-orange-100 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3 capitalize">
            <span className="text-3xl">📆</span>
            {title}
          </h3>
          <p className="text-sm font-bold text-gray-500 mt-1 capitalize">{monthLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="flex items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold px-4 py-2 rounded-2xl border-2 border-orange-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-600 font-bold px-4 py-2 rounded-2xl border-2 border-blue-200 transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Hoy
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="flex items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold px-4 py-2 rounded-2xl border-2 border-orange-200 transition-colors"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {enablePiojologistFilter && (
        <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-4 flex flex-col gap-2">
          <label className="text-sm font-bold text-gray-500" htmlFor="calendar-filter">
            Ver agenda por piojóloga
          </label>
          <select
            id="calendar-filter"
            value={selectedPiojologist}
            onChange={(event) => setSelectedPiojologist(event.target.value)}
            className="bg-white border-2 border-orange-200 rounded-2xl px-4 py-3 font-bold text-gray-700 focus:outline-none focus:border-orange-400"
          >
            <option value="all">Todas las piojólogas</option>
            {piojologists.map((piojologist) => (
              <option key={piojologist.id} value={piojologist.id}>
                {piojologist.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-gray-500">
        {Object.entries(statusLabels).map(([status, label]) => (
          <span
            key={status}
            className={`px-3 py-1 rounded-full border ${statusColors[status] || 'bg-gray-100 text-gray-500 border-gray-200'}`}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 text-center font-bold text-gray-500">
        {WEEK_DAYS.map((day) => (
          <div key={day} className="uppercase tracking-wide text-xs text-gray-400">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((dayInfo) => {
          const { date, isToday, isCurrentMonth, appointments: dayAppointments } = dayInfo;
          const dateLabel = date.getDate();
          const key = buildDateKey(date);
          const isSelected = selectedDayKey === key;
          const hasAppointments = dayAppointments.length > 0;
          const cellClasses = [
            'rounded-3xl border-2 min-h-[120px] flex flex-col p-3 gap-2 transition-all',
            isCurrentMonth ? 'bg-white border-orange-100' : 'bg-gray-50 border-gray-100 opacity-60',
            isToday ? 'shadow-lg border-blue-300 ring-2 ring-blue-200 ring-offset-2' : '',
            hasAppointments ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-orange-300' : 'cursor-default',
            isSelected ? 'border-4 border-orange-300 shadow-xl' : ''
          ].join(' ');

          return (
            <div
              key={key}
              className={cellClasses}
              onClick={() => handleDayClick(dayInfo)}
            >
              <div className="flex items-center justify-between text-sm font-black text-gray-500">
                <span className="bg-orange-100 text-orange-600 px-2 py-1 rounded-xl">
                  {dateLabel}
                </span>
                {dayAppointments.length > 0 && (
                  <span className="text-xs font-bold text-purple-500">
                    {dayAppointments.length} serv.
                  </span>
                )}
              </div>

              {dayAppointments.length > 0 && (
                <div className="space-y-2 overflow-y-auto pr-1">
                  {dayAppointments.map((appointment) => {
                    const statusKey = appointment.isExternal ? 'external' : appointment.status;
                    const color = statusColors[statusKey] || 'bg-blue-100 text-blue-700 border-blue-200';
                    const time = appointment.time || 'Sin hora';
                    const piojologist = piojologists.find((p) => Number(p.id) === Number(appointment.piojologistId));
                    return (
                      <div
                        key={appointment.id}
                        className={`rounded-2xl border px-3 py-2 text-left text-xs font-bold space-y-1 ${color} ${appointment.isExternal ? 'border-2 border-dashed' : ''}`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1 truncate max-w-[110px]">
                            {appointment.isExternal && <span>🔗</span>}
                            <span className="truncate">{appointment.clientName}</span>
                          </div>
                          <span className="text-[10px] uppercase">{time}</span>
                        </div>
                        {piojologist && (
                          <p className="text-[10px] text-gray-500 font-semibold opacity-80">
                            👩‍⚕️ {piojologist.name}
                          </p>
                        )}
                        {appointment.isExternal && (
                          <p className="text-[10px] text-blue-600 font-semibold opacity-80">
                            🌐 {appointment.piojologistName}
                          </p>
                        )}
                        <div className="flex justify-between items-center text-[9px] uppercase tracking-wide">
                          <span>{appointment.serviceType}</span>
                          <span>{statusLabels[statusKey] || appointment.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="rounded-[2.5rem] border-8 border-orange-100 p-0 overflow-hidden bg-white max-w-2xl">
          <div className="bg-gradient-to-r from-orange-400 to-yellow-400 p-6 text-white text-center">
            <DialogHeader>
              <DialogTitle className="text-3xl font-black capitalize">{dialogDateLabel}</DialogTitle>
              <DialogDescription className="text-white/80 font-bold text-sm tracking-wide uppercase">
                {selectedDay?.appointments.length || 0} servicios programados
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 md:p-8 space-y-4 max-h-[420px] overflow-y-auto">
            {selectedDay?.appointments.map((appointment) => {
              const statusKey = appointment.isExternal ? 'external' : appointment.status;
              const statusStyle = statusBadgeStyles[statusKey] || 'bg-blue-200 text-blue-700 border-blue-300';
              const timeLabel = formatTimeRange(appointment);
              const label = statusLabels[statusKey] || appointment.status;
              const assignedPiojologist = piojologists.find((p) => Number(p.id) === Number(appointment.piojologistId));

              return (
                <div
                  key={appointment.id}
                  className={`bg-white border-4 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all ${appointment.isExternal ? 'border-blue-200 border-dashed' : 'border-orange-100'}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        {appointment.isExternal ? <span>🔗</span> : <ShieldCheck className="w-5 h-5 text-orange-500" />}
                        {appointment.clientName}
                      </h4>
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mt-1">
                        {appointment.serviceType}
                      </p>
                      {appointment.isExternal && (
                        <p className="text-xs font-bold text-blue-600 mt-2">
                          🌐 Vinculado desde: {appointment.piojologistName}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${statusStyle}`}>
                      {label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-bold text-gray-600">
                    <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                      <Clock className="w-4 h-4 text-orange-400" />
                      {timeLabel}
                    </div>
                    <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                      <CalendarDays className="w-4 h-4 text-purple-400" />
                      #{appointment.id}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
                    <UserCircle2 className="w-4 h-4 text-blue-400" />
                    {assignedPiojologist ? `Asignado a ${assignedPiojologist.name}` : 'Sin piojóloga asignada'}
                  </div>

                  {appointment.notes && (
                    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs font-semibold text-blue-700">
                      Nota: {appointment.notes}
                    </div>
                  )}
                </div>
              );
            })}

            {selectedDay?.appointments.length === 0 && (
              <p className="text-center text-sm font-bold text-gray-400">No hay servicios registrados.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleCalendar;
