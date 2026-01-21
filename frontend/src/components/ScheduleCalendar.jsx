import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, UserCircle2, ShieldCheck, Grid3x3, List } from 'lucide-react';
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
  accepted: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  assigned: 'bg-cyan-100 text-cyan-700 border-cyan-200'
};

const statusLabels = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  completed: 'Completado',
  assigned: 'Asignado'
};

const statusBadgeStyles = {
  pending: 'bg-yellow-200 text-yellow-700 border-yellow-300',
  accepted: 'bg-green-200 text-green-700 border-green-300',
  rejected: 'bg-red-200 text-red-700 border-red-300',
  completed: 'bg-blue-200 text-blue-700 border-blue-300',
  assigned: 'bg-cyan-200 text-cyan-700 border-cyan-300'
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

const getWeekRange = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const start = new Date(d.setDate(diff));
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
};

const ScheduleCalendar = ({
  appointments = [],
  piojologists = [],
  enablePiojologistFilter = false,
  title = 'Calendario de Servicios',
  onAssign
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [selectedPiojologist, setSelectedPiojologist] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [filterMode, setFilterMode] = useState('piojologist'); // 'piojologist' o 'status'
  const [selectedDay, setSelectedDay] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [assignments, setAssignments] = useState({});
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'

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

    let filtered = enriched;

    // Filtrar por modo
    if (filterMode === 'piojologist' && enablePiojologistFilter && selectedPiojologist !== 'all') {
      filtered = filtered.filter(({ piojologistId }) => Number(piojologistId) === Number(selectedPiojologist));
    } else if (filterMode === 'status' && selectedStatus !== 'all') {
      filtered = filtered.filter(({ status }) => status === selectedStatus);
    }
    return filtered;
  }, [appointments, enablePiojologistFilter, selectedPiojologist, selectedStatus, filterMode]);

  const calendarDays = useMemo(() => {
    const range = getCalendarRange(currentMonth);
    const eventsByDay = filteredAppointments.reduce((acc, appointment) => {
      if (!appointment.dateKey) return acc;
      if (!acc[appointment.dateKey]) acc[appointment.dateKey] = [];
      const exists = acc[appointment.dateKey].some((item) => item.id === appointment.id);
      if (exists) return acc; // evita duplicados con el mismo id en el mismo día
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
    setAssignments({});
    setIsDialogOpen(true);
  };

  const handleDialogChange = (open) => {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedDay(null);
      setAssignments({});
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

  const getViewLabel = () => {
    if (viewMode === 'week') {
      const weekStart = getWeekRange(currentMonth)[0];
      const weekEnd = getWeekRange(currentMonth)[6];
      return `${pad(weekStart.getDate())}/${pad(weekStart.getMonth() + 1)} - ${pad(weekEnd.getDate())}/${pad(weekEnd.getMonth() + 1)}/${weekEnd.getFullYear()}`;
    } else if (viewMode === 'day') {
      return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(currentMonth);
    }
    return monthLabel;
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-xl border-4 border-orange-100 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3 capitalize">
            <span className="text-3xl">📆</span>
            {title}
          </h3>
          <p className="text-sm font-bold text-gray-500 mt-1 capitalize">{getViewLabel()}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-center">
          {/* View Mode Selector */}
          <div className="flex gap-2 bg-orange-50 border-2 border-orange-200 rounded-2xl p-2">
            <button
              onClick={() => setViewMode('month')}
              title="Vista de mes"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${
                viewMode === 'month' 
                  ? 'bg-orange-400 text-white' 
                  : 'bg-white text-orange-600 hover:bg-orange-100'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              Mes
            </button>
            <button
              onClick={() => setViewMode('week')}
              title="Vista de semana"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${
                viewMode === 'week' 
                  ? 'bg-orange-400 text-white' 
                  : 'bg-white text-orange-600 hover:bg-orange-100'
              }`}
            >
              <List className="w-4 h-4" />
              Semana
            </button>
            <button
              onClick={() => setViewMode('day')}
              title="Vista de día"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors ${
                viewMode === 'day' 
                  ? 'bg-orange-400 text-white' 
                  : 'bg-white text-orange-600 hover:bg-orange-100'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Día
            </button>
          </div>
          {/* Navigation Buttons */}
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
        <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-4">
          <div className="mb-3">
            <label className="text-sm font-bold text-gray-500 mb-2 block">
              Filtrar agenda por:
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setFilterMode('piojologist');
                  setSelectedStatus('all');
                }}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors ${
                  filterMode === 'piojologist'
                    ? 'bg-orange-400 text-white'
                    : 'bg-white text-gray-600 border-2 border-orange-200'
                }`}
              >
                👥 Piojólogas
              </button>
              <button
                onClick={() => {
                  setFilterMode('status');
                  setSelectedPiojologist('all');
                }}
                className={`flex-1 px-4 py-2 rounded-xl font-bold transition-colors ${
                  filterMode === 'status'
                    ? 'bg-orange-400 text-white'
                    : 'bg-white text-gray-600 border-2 border-orange-200'
                }`}
              >
                📊 Estados
              </button>
            </div>
          </div>

          {filterMode === 'piojologist' ? (
            <select
              value={selectedPiojologist}
              onChange={(event) => setSelectedPiojologist(event.target.value)}
              className="w-full bg-white border-2 border-orange-200 rounded-2xl px-4 py-3 font-bold text-gray-700 focus:outline-none focus:border-orange-400"
            >
              <option value="all">Todas las piojólogas</option>
              {piojologists.map((piojologist) => (
                <option key={piojologist.id} value={piojologist.id}>
                  {piojologist.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
              className="w-full bg-white border-2 border-orange-200 rounded-2xl px-4 py-3 font-bold text-gray-700 focus:outline-none focus:border-orange-400"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendiente</option>
              <option value="accepted">Aceptado</option>
              <option value="rejected">Rechazado</option>
              <option value="completed">Completado</option>
            </select>
          )}
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

      {/* VISTA MES */}
      {viewMode === 'month' && (
        <>
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
                        const isPublicBooking = appointment.isPublicBooking === true;
                        
                        return (
                          <div
                            key={`${appointment.id}-${appointment.time || 'no-time'}`}
                            className={`rounded-2xl border-2 px-3 py-2 text-left text-xs font-bold space-y-1 ${color} ${
                              appointment.isExternal ? 'border-dashed' : ''
                            } cursor-pointer hover:shadow-md transition`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDayClick(dayInfo);
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1 truncate max-w-[110px]">
                                {appointment.isExternal && <span>🔗</span>}
                                {isPublicBooking && <span>🌐</span>}
                                <span className="truncate">{appointment.clientName}</span>
                              </div>
                              <span className="text-[10px] uppercase">{time}</span>
                            </div>
                            {piojologist && (
                              <p className="text-[10px] text-gray-500 font-semibold opacity-80">
                                👩‍⚕️ {piojologist.name}
                              </p>
                            )}
                            {isPublicBooking && !piojologist && (
                              <p className="text-[10px] text-pink-600 font-semibold opacity-80">
                                📱 Sin asignar
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
        </>
      )}

      {/* VISTA SEMANA */}
      {viewMode === 'week' && (
        <div className="space-y-4">
          {getWeekRange(currentMonth).map((dayDate) => {
            const key = buildDateKey(dayDate);
            const dayAppointments = filteredAppointments.filter(apt => apt.dateKey === key);
            const isToday = buildDateKey(new Date(new Date().setHours(0, 0, 0, 0))) === key;
            const dateStr = new Intl.DateTimeFormat('es-ES', {
              weekday: 'short',
              day: 'numeric',
              month: 'short'
            }).format(dayDate);
            
            return (
              <div key={key} className={`rounded-2xl border-4 p-4 ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-orange-100'}`}>
                <h4 className={`font-black text-lg mb-3 capitalize ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                  {dateStr}
                </h4>
                {dayAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {dayAppointments.map((apt, idx) => {
                      const statusKey = apt.isExternal ? 'external' : apt.status;
                      const color = statusColors[statusKey] || 'bg-blue-100 text-blue-700 border-blue-200';
                      const piojologist = piojologists.find((p) => Number(p.id) === Number(apt.piojologistId));
                      return (
                        <div key={`${apt.id}-${apt.time || 'no-time'}`} className={`rounded-xl border-3 p-3 ${color}`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-sm">{apt.clientName}</p>
                              <p className="text-xs text-gray-600 font-semibold mt-1">{apt.serviceType} • {apt.time || 'Sin hora'}</p>
                            </div>
                            <span className="text-xs font-black bg-white/70 px-2 py-1 rounded">{statusLabels[statusKey]}</span>
                          </div>
                          {piojologist && (
                            <p className="text-xs mt-2 text-gray-700 font-semibold">👩‍⚕️ {piojologist.name}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 font-semibold italic">Sin servicios</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VISTA DÍA */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          {(() => {
            const dayAppointments = filteredAppointments.filter(apt => apt.dateKey === buildDateKey(currentMonth));
            return (
              <div>
                {dayAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {dayAppointments.map((apt, idx) => {
                      const statusKey = apt.isExternal ? 'external' : apt.status;
                      const color = statusColors[statusKey] || 'bg-blue-100 text-blue-700 border-blue-200';
                      const piojologist = piojologists.find((p) => Number(p.id) === Number(apt.piojologistId));
                      return (
                        <div key={`${apt.id}-${apt.time || 'no-time'}`} className={`rounded-2xl border-4 p-4 ${color} cursor-pointer hover:shadow-lg transition`} onClick={() => {setSelectedDay({date: currentMonth, appointments: [apt]}); setIsDialogOpen(true);}}>
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                              <p className="font-black text-lg">{apt.clientName}</p>
                              <p className="text-sm text-gray-600 font-semibold mt-2">{apt.serviceType}</p>
                              <p className="text-sm font-bold mt-1">⏰ {apt.time || 'Sin hora'}</p>
                            </div>
                            <span className="text-xs font-black bg-white/70 px-3 py-1.5 rounded-full">{statusLabels[statusKey]}</span>
                          </div>
                          {piojologist && (
                            <p className="text-sm mt-3 text-gray-700 font-semibold">👩‍⚕️ {piojologist.name}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border-4 border-dashed border-gray-300 p-8 text-center bg-gray-50">
                    <p className="text-lg font-bold text-gray-400">📭 Sin servicios este día</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* MODAL - igual para todas las vistas */}
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
            {selectedDay?.appointments.map((appointment, idx) => {
              const statusKey = appointment.isExternal ? 'external' : appointment.status;
              const statusStyle = statusBadgeStyles[statusKey] || 'bg-blue-200 text-blue-700 border-blue-300';
              const cardColor = statusColors[statusKey] || 'bg-blue-100 text-blue-700 border-blue-200';
              const timeLabel = formatTimeRange(appointment);
              const label = statusLabels[statusKey] || appointment.status;
              const assignedPiojologist = piojologists.find((p) => Number(p.id) === Number(appointment.piojologistId));
              const isPublicBooking = appointment.isPublicBooking === true;
              const assignValue = assignments[appointment.id] || (appointment.piojologistId ? String(appointment.piojologistId) : '');
              const serviceNumber = idx + 1;

              return (
                <div
                  key={`${appointment.id}-${appointment.time || 'no-time'}`}
                  className={`rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all border-4 ${cardColor} ${
                    appointment.isExternal ? 'border-dashed' : ''
                  } ${isPublicBooking ? 'ring-2 ring-pink-200 ring-offset-2' : ''}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-black text-gray-800 flex items-center gap-2">
                        {appointment.isExternal && <span>🔗</span>}
                        {isPublicBooking && <span>🌐</span>}
                        {!appointment.isExternal && !isPublicBooking && <ShieldCheck className="w-5 h-5 text-orange-500" />}
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
                      {isPublicBooking && (
                        <p className="text-xs font-bold text-pink-600 mt-2">
                          🌐 Solicitud Web {!assignedPiojologist && '(Sin asignar)'}
                        </p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${statusStyle}`}>
                      {label}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-bold text-gray-600">
                    <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      {timeLabel}
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2">
                      <CalendarDays className="w-4 h-4 text-gray-500" />
                      Servicio #{serviceNumber}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700">
                    <UserCircle2 className="w-4 h-4 text-gray-500" />
                    {assignedPiojologist ? `Asignado a ${assignedPiojologist.name}` : 'Sin piojóloga asignada'}
                  </div>

                  {statusKey === 'pending' && onAssign && (
                    <div className="mt-4 bg-white border-2 border-gray-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-black text-gray-600 uppercase">Asignar a piojóloga</p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={assignValue}
                          onChange={(e) => setAssignments((prev) => ({ ...prev, [appointment.id]: e.target.value }))}
                          className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl p-2 text-sm font-semibold text-gray-700 focus:border-orange-400 outline-none"
                        >
                          <option value="">Seleccionar...</option>
                          {piojologists.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            onAssign(appointment, assignValue);
                            handleDialogChange(false);
                          }}
                          disabled={!assignValue}
                          className="bg-orange-400 hover:bg-orange-500 text-white rounded-xl px-4 py-2 font-bold border-b-4 border-orange-600 active:border-b-0 active:translate-y-1"
                        >
                          Asignar
                        </button>
                      </div>
                    </div>
                  )}

                    {isPublicBooking && (
                    <div className="mt-4 bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                      <p className="text-xs font-black text-gray-600 uppercase mb-3 flex items-center gap-2">
                        <span>🌐</span> Información de contacto
                      </p>
                      <div className="space-y-2">
                        {appointment.whatsapp && (
                          <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>📱</span>
                            <span>WhatsApp: {appointment.whatsapp}</span>
                          </div>
                        )}
                        {appointment.email && (
                          <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>📧</span>
                            <span>Email: {appointment.email}</span>
                          </div>
                        )}
                        {appointment.direccion && (
                          <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>📍</span>
                            <span>Dirección: {appointment.direccion}</span>
                          </div>
                        )}
                        {appointment.barrio && (
                          <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>🏘️</span>
                            <span>Barrio: {appointment.barrio}</span>
                          </div>
                        )}
                        {appointment.numPersonas && (
                          <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>👥</span>
                            <span>Personas: {appointment.numPersonas}</span>
                          </div>
                        )}
                        {appointment.hasAlergias === 'si' && appointment.detalleAlergias && (
                          <div className="text-xs font-semibold text-red-700 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
                            <span>⚠️</span>
                            <span>Alergias: {appointment.detalleAlergias}</span>
                          </div>
                        )}
                        {appointment.referidoPor && (
                          <div className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                            <span>💬</span>
                            <span>Referido por: {appointment.referidoPor}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {appointment.notes && (
                    <div className="mt-4 bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 text-xs font-semibold text-gray-700">
                      <span className="font-black text-gray-600">Nota:</span> {appointment.notes}
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
