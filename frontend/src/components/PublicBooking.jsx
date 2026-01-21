import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Sparkles, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const pad = (value) => (value < 10 ? `0${value}` : `${value}`);

const buildDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatLongDate = (date) => {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
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

const baseSlots = ['08:00', '10:00', '12:00', '14:00', '16:00'];

const piojologists = [
  { id: 101, name: 'Lola', zone: 'Norte', gradient: 'from-orange-400 to-amber-500' },
  { id: 102, name: 'Mila', zone: 'Centro', gradient: 'from-sky-400 to-cyan-500' },
  { id: 103, name: 'Vero', zone: 'Sur', gradient: 'from-lime-400 to-emerald-500' }
];

const serviceCatalog = [
  { value: 'Normal', label: 'Nivel Normal' },
  { value: 'Elevado', label: 'Nivel Elevado' },
  { value: 'Muy Alto', label: 'Nivel Muy Alto' }
];

const PublicBooking = () => {
  const [bookings, setBookings] = useState(() => {
    const saved = localStorage.getItem('publicBookings');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    serviceType: 'Normal',
    whatsapp: '',
    direccion: '',
    barrio: '',
    numPersonas: '1',
    hasAlergias: false,
    detalleAlergias: '',
    referidoPor: '',
    terminosAceptados: false
  });

  const shareLink = `${window.location.origin}/agenda`;

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric'
    }).format(currentMonth);
  }, [currentMonth]);

  const calendarDays = useMemo(() => {
    const range = getCalendarRange(currentMonth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return range.map((day) => {
      const key = buildDateKey(day);
      const isToday = buildDateKey(today) === key;
      const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
      // Cupos ilimitados - todos los días tienen slots disponibles
      const availableSlots = baseSlots;

      return {
        date: day,
        key,
        isToday,
        isCurrentMonth,
        slots: availableSlots
      };
    });
  }, [currentMonth]);

  const selectedDayInfo = calendarDays.find((day) => 
    selectedDate ? day.key === buildDateKey(selectedDate) : false
  );
  const selectedDaySlots = selectedDayInfo?.slots || [];

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

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setConfirmedBooking(null);
    setSelectedSlot('');
    setSelectedDate(null);
    setIsModalOpen(false);
    setForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      serviceType: 'Normal',
      whatsapp: '',
      direccion: '',
      barrio: '',
      numPersonas: '1',
      hasAlergias: false,
      detalleAlergias: '',
      referidoPor: '',
      terminosAceptados: false
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({
        title: '✅ Enlace copiado',
        description: 'Comparte este link con tus clientes',
        duration: 2500
      });
    } catch (error) {
      toast({
        title: '❌ No se pudo copiar',
        description: 'Copia manualmente el enlace',
        duration: 2500,
        variant: 'destructive'
      });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedDate || !selectedSlot) {
      toast({
        title: '📅 Selecciona día y hora',
        description: 'Escoge un día disponible y una hora libre',
        duration: 3000
      });
      return;
    }

    // Validaciones específicas para cada campo
    if (!form.name || form.name.trim() === '') {
      toast({
        title: '👤 Falta tu nombre',
        description: 'Por favor ingresa tu nombre completo',
        duration: 3000
      });
      return;
    }

    if (!form.whatsapp || form.whatsapp.trim() === '') {
      toast({
        title: '📱 Falta número de WhatsApp',
        description: 'Necesitamos tu número para confirmar la cita',
        duration: 3000
      });
      return;
    }

    // Validar formato de número de WhatsApp (Colombia: 10 dígitos, empieza con 3)
    const whatsappClean = form.whatsapp.replace(/\D/g, '');
    if (whatsappClean.length !== 10 || !whatsappClean.startsWith('3')) {
      toast({
        title: '⚠️ Número de WhatsApp inválido',
        description: 'Debe ser un número de celular colombiano válido (10 dígitos, inicia con 3)',
        duration: 4000,
        variant: 'destructive'
      });
      return;
    }

    if (!form.direccion || form.direccion.trim() === '') {
      toast({
        title: '📍 Falta la dirección',
        description: 'Necesitamos saber dónde realizar el servicio',
        duration: 3000
      });
      return;
    }

    if (!form.terminosAceptados) {
      toast({
        title: '✅ Acepta los términos',
        description: 'Debes aceptar los términos y condiciones',
        duration: 3000
      });
      return;
    }

    try {
      // Formatear la fecha en formato YYYY-MM-DD
      const fecha = buildDateKey(selectedDate);

      const bookingData = {
        fecha: fecha,
        hora: selectedSlot,
        clientName: form.name,
        serviceType: form.serviceType,
        whatsapp: form.whatsapp,
        email: form.email || null,
        direccion: form.direccion,
        barrio: form.barrio,
        numPersonas: parseInt(form.numPersonas),
        hasAlergias: form.hasAlergias,
        detalleAlergias: form.detalleAlergias || null,
        referidoPor: form.referidoPor || null
      };

      const response = await fetch('http://localhost:8000/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al crear la reserva');
      }

      // Guardar info de reserva confirmada y mostrar vista de confirmación
      const confirmedData = {
        clientName: form.name,
        fecha: formatLongDate(selectedDate),
        hora: selectedSlot,
        serviceType: form.serviceType,
        whatsapp: form.whatsapp,
        direccion: form.direccion,
        barrio: form.barrio
      };

      setConfirmedBooking(confirmedData);
      setIsModalOpen(false); // Cerrar el modal
      setShowConfirmation(true); // Mostrar confirmación en la página principal
      setShowForm(false);
      
      // Scroll hacia arriba para ver el mensaje de confirmación
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error al crear reserva:', error);
      toast({
        title: '❌ Error al agendar',
        description: error.message || 'No se pudo crear la reserva. Intenta nuevamente.',
        duration: 4000,
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white font-fredoka text-gray-800 relative overflow-hidden">
      {/* Decorative Background Blobs */}
      <div className="fixed top-20 -left-10 w-48 h-48 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-20 -right-10 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none"></div>

      {/* Floating Elements - Same as Login */}
      <motion.div 
        animate={{ y: [0, -20, 0] }} 
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] text-4xl md:text-5xl opacity-20 pointer-events-none z-0"
      >🦠</motion.div>
      <motion.div 
        animate={{ y: [0, 20, 0] }} 
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-20 right-[10%] text-4xl md:text-5xl opacity-20 pointer-events-none z-0"
      >✨</motion.div>
      <motion.div 
        animate={{ y: [0, -15, 0], x: [0, 10, 0] }} 
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute top-1/3 right-[20%] text-3xl md:text-4xl opacity-15 pointer-events-none z-0"
      >🪮</motion.div>
      <motion.div 
        animate={{ y: [0, 15, 0], x: [0, -10, 0] }} 
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute bottom-1/3 left-[15%] text-3xl md:text-4xl opacity-15 pointer-events-none z-0"
      >💫</motion.div>

      {/* Header Chao Piojos - Same as Login */}
      <div className="relative z-10 pt-6 md:pt-10 pb-4 md:pb-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.6 }}
            className="inline-block"
          >
            <div className="bg-white rounded-3xl px-8 py-4 md:px-12 md:py-6 shadow-2xl border-4 border-orange-200 relative inline-block">
              <div className="absolute -top-6 md:-top-8 left-1/2 transform -translate-x-1/2 bg-yellow-400 p-2 md:p-3 rounded-full border-4 border-white shadow-lg">
                <span className="text-2xl md:text-3xl">�</span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-wide drop-shadow-sm mt-2">
                <span className="text-orange-500">Chao</span>{' '}
                <span className="text-blue-500">Piojos</span>
              </h1>
              <p className="text-gray-500 font-bold text-sm md:text-base mt-1">
                ¡Agenda tu cita sin piojos!
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 md:px-4 pb-6 md:pb-10 relative z-10">
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-2xl border-4 border-orange-200 relative overflow-hidden">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-amber-200 rounded-full mix-blend-multiply opacity-60 animate-pulse pointer-events-none"></div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-orange-300 rounded-full mix-blend-multiply opacity-50 animate-pulse pointer-events-none"></div>

          <div className="relative space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <p className="text-xs md:text-sm uppercase tracking-[0.2em] text-orange-500 font-black flex items-center gap-2">
                  <Sparkles className="w-4 h-4 md:w-5 md:h-5" /> Agenda pública
                </p>
                <h1 className="text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight">
                  Agenda tu visita
                </h1>
                <p className="text-sm md:text-base lg:text-lg text-gray-600 max-w-2xl">
                  Mira los horarios libres y reserva tu cita. Te confirmamos por WhatsApp.
                </p>
              </div>

              {/* Share link */}
              <div className="bg-gradient-to-br from-orange-400 to-yellow-400 text-white p-4 md:p-5 rounded-2xl md:rounded-3xl shadow-lg border-4 border-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-[0.15em] opacity-90">Comparte este enlace</p>
                    <p className="text-xs md:text-sm text-white/90 mt-1 break-all font-bold">{shareLink}</p>
                  </div>
                  <Button 
                    onClick={handleCopy} 
                    className="bg-white text-orange-600 hover:bg-orange-50 font-black text-sm md:text-base py-2 md:py-3 px-4 md:px-6 rounded-xl shadow-md border-b-4 border-orange-200 active:border-b-0 active:translate-y-0.5"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copiar
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar o Vista de Confirmación */}
            {!showConfirmation ? (
            <div className="bg-white rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-xl border-4 border-orange-100 space-y-4 md:space-y-5">
              {/* Month navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2 capitalize">
                    <span className="text-2xl md:text-3xl">📆</span>
                    Horarios Disponibles
                  </h3>
                  <p className="text-xs md:text-sm font-bold text-gray-500 mt-1 capitalize">{monthLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPreviousMonth}
                    className="flex items-center gap-1 md:gap-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold px-3 md:px-4 py-2 rounded-xl md:rounded-2xl border-2 border-orange-200 transition-colors text-sm md:text-base"
                  >
                    <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </button>
                  <button
                    type="button"
                    onClick={goToToday}
                    className="flex items-center gap-1 md:gap-2 bg-blue-100 hover:bg-blue-200 text-blue-600 font-bold px-3 md:px-4 py-2 rounded-xl md:rounded-2xl border-2 border-blue-200 transition-colors text-sm md:text-base"
                  >
                    <CalendarDays className="w-3 h-3 md:w-4 md:h-4" />
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={goToNextMonth}
                    className="flex items-center gap-1 md:gap-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold px-3 md:px-4 py-2 rounded-xl md:rounded-2xl border-2 border-orange-200 transition-colors text-sm md:text-base"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
                </div>
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1 md:gap-2 text-center font-bold text-gray-500">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="uppercase tracking-wide text-[10px] md:text-xs text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1 md:gap-2">
                {calendarDays.map((dayInfo) => {
                  const { date, key, isToday, isCurrentMonth, slots } = dayInfo;
                  const dateLabel = date.getDate();
                  const hasSlots = slots.length > 0 && isCurrentMonth;
                  const isSelected = selectedDate ? key === buildDateKey(selectedDate) : false;
                  
                  const cellClasses = [
                    'rounded-xl md:rounded-2xl border-2 min-h-[60px] md:min-h-[80px] flex items-center justify-center p-2 transition-all',
                    isCurrentMonth ? 'bg-white border-orange-100' : 'bg-gray-50 border-gray-100 opacity-40',
                    isToday ? 'shadow-md md:shadow-lg border-blue-300 ring-1 md:ring-2 ring-blue-200 ring-offset-1 md:ring-offset-2' : '',
                    hasSlots ? 'cursor-pointer hover:-translate-y-0.5 md:hover:-translate-y-1 hover:shadow-md md:hover:shadow-lg hover:border-orange-400 active:translate-y-0' : 'cursor-default',
                    isSelected ? 'border-4 border-orange-400 shadow-lg md:shadow-xl bg-orange-50' : ''
                  ].join(' ');

                  return (
                    <div
                      key={key}
                      className={cellClasses}
                      onClick={() => {
                        if (hasSlots) {
                          setSelectedDate(date);
                          setSelectedSlot('');
                          setShowForm(false);
                          setIsModalOpen(true);
                        }
                      }}
                    >
                      <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-xl md:text-3xl ${
                        isToday 
                          ? 'bg-blue-500 text-white shadow-md' 
                          : isCurrentMonth && hasSlots
                            ? 'bg-orange-100 text-orange-600'
                            : isCurrentMonth
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-gray-50 text-gray-400'
                      }`}>
                        {dateLabel}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs md:text-sm text-gray-600 font-bold text-center">
                Toca un día para ver los horarios disponibles.
              </p>
            </div>
            ) : (
              /* Vista de Confirmación */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.4 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl md:rounded-[2rem] p-6 md:p-10 shadow-xl border-4 border-green-200"
              >
                <div className="text-center space-y-6">
                  {/* Icono de éxito */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.6, delay: 0.2 }}
                    className="mx-auto w-20 h-20 md:w-24 md:h-24 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Check className="w-10 h-10 md:w-12 md:h-12 text-white stroke-[3]" />
                    </motion.div>
                  </motion.div>

                  {/* Mensaje de éxito */}
                  <div className="space-y-3">
                    <h2 className="text-2xl md:text-4xl font-black text-green-600">
                      ¡Reserva Confirmada!
                    </h2>
                    <p className="text-base md:text-xl text-gray-700 font-bold">
                      Hola <span className="text-green-600">{confirmedBooking?.clientName}</span>, tu cita ha sido agendada exitosamente.
                    </p>
                  </div>

                  {/* Detalles de la reserva */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                    <div className="bg-white p-4 md:p-5 rounded-2xl border-2 border-green-200 shadow-md">
                      <div className="flex items-center justify-center gap-3">
                        <CalendarDays className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-green-500 uppercase">Fecha</p>
                          <p className="text-sm md:text-base font-black text-gray-800">{confirmedBooking?.fecha}</p>
                          <p className="text-base md:text-lg font-black text-green-600">{confirmedBooking?.hora}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 md:p-5 rounded-2xl border-2 border-green-200 shadow-md">
                      <div className="flex items-center justify-center gap-3">
                        <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-green-500 uppercase">Servicio</p>
                          <p className="text-sm md:text-base font-black text-gray-800">{confirmedBooking?.serviceType}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mensaje informativo */}
                  <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border-2 border-blue-200 max-w-2xl mx-auto">
                    <p className="text-sm md:text-base text-gray-700 font-bold">
                      📱 Te contactaremos vía <span className="text-blue-600">WhatsApp</span> al número{' '}
                      <span className="text-blue-600 font-black">{confirmedBooking?.whatsapp}</span> para confirmar tu visita.
                    </p>
                  </div>

                  {/* Botón para agendar otra cita */}
                  <Button
                    onClick={handleCloseConfirmation}
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-black text-base md:text-lg px-8 md:px-12 py-4 md:py-6 rounded-2xl shadow-lg border-b-4 border-orange-600 active:border-b-0 active:translate-y-1 transition-all"
                  >
                    <CalendarDays className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                    Agendar Otra Cita
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open && showConfirmation) {
          handleCloseConfirmation();
        } else if (!open) {
          setIsModalOpen(false);
          setShowForm(false);
          setSelectedSlot('');
        }
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl md:rounded-[2rem] border-4 md:border-8 border-orange-100 p-0">
          <div className="p-4 md:p-6 bg-gradient-to-r from-orange-400 to-yellow-400 text-white text-center sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle className="text-xl md:text-2xl lg:text-3xl font-black capitalize">
                {selectedDate ? formatLongDate(selectedDate) : 'Reservar'}
              </DialogTitle>
              <DialogDescription className="text-white/90 font-bold text-xs md:text-sm tracking-wide uppercase">
                {!showForm ? 'Selecciona una hora' : 'Completa tus datos'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-5">
            {!showForm ? (
              /* Slot selection */
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-xl md:text-2xl font-black text-gray-800">¿A qué hora prefieres?</p>
                  <p className="text-sm md:text-base text-gray-600 font-bold">Elige un horario disponible</p>
                </div>
                {selectedDaySlots.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-2xl mx-auto">
                    {selectedDaySlots.map((slot) => {
                      // Convertir formato 24h a 12h con AM/PM
                      const [hours, minutes] = slot.split(':');
                      const hour = parseInt(hours);
                      const period = hour >= 12 ? 'pm' : 'am';
                      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                      const timeLabel = `${displayHour}:${minutes} ${period}`;
                      
                      return (
                        <button
                          key={slot}
                          onClick={() => {
                            setSelectedSlot(slot);
                            setShowForm(true);
                          }}
                          className="group relative bg-white border-4 border-orange-200 hover:border-orange-400 rounded-2xl md:rounded-3xl p-6 md:p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="bg-orange-100 group-hover:bg-orange-400 p-4 rounded-2xl transition-colors">
                                <Clock className="w-8 h-8 md:w-10 md:h-10 text-orange-600 group-hover:text-white transition-colors" />
                              </div>
                              <div className="text-left">
                                <p className="text-sm md:text-base font-bold text-gray-500 uppercase tracking-wide">Cita</p>
                                <p className="text-2xl md:text-3xl font-black text-gray-800">{timeLabel}</p>
                              </div>
                            </div>
                            <div className="bg-green-100 px-4 py-2 rounded-xl">
                              <p className="text-xs md:text-sm font-black text-green-700">Disponible</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 md:p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl text-center text-gray-600 font-bold text-sm md:text-base">
                    No hay horarios disponibles en este día.
                  </div>
                )}
              </div>
            ) : (
              /* Booking form */
              <form className="space-y-4 md:space-y-5" onSubmit={handleSubmit}>
                {/* Hora seleccionada */}
                <div className="bg-orange-50 border-4 border-orange-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-orange-600" />
                    <div>
                      <p className="text-xs font-bold text-orange-500 uppercase">Hora seleccionada</p>
                      <p className="text-lg md:text-xl font-black text-gray-800">{selectedSlot}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedSlot('');
                    }}
                    className="text-sm font-bold text-orange-600 hover:text-orange-700 underline"
                  >
                    Cambiar
                  </button>
                </div>

                {/* Datos del Cliente */}
                <div className="space-y-3">
                  <p className="text-sm md:text-base font-black text-gray-700 uppercase tracking-wide">📝 Datos del Cliente</p>
                  <div>
                    <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Nombre Completo *</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-orange-200 bg-orange-50 px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-orange-500 text-sm md:text-base"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Ej: Ana Pérez García"
                    />
                  </div>

                  <div>
                    <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Nivel de Infestación *</label>
                    <select
                      required
                      className="w-full rounded-xl md:rounded-2xl border-2 border-orange-200 bg-orange-50 px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-orange-500 text-sm md:text-base cursor-pointer"
                      value={form.serviceType}
                      onChange={(e) => handleChange('serviceType', e.target.value)}
                    >
                      {serviceCatalog.map((service) => (
                        <option key={service.value} value={service.value}>{service.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contacto del Cliente */}
                <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 space-y-3">
                  <p className="text-xs md:text-sm font-bold text-blue-600 uppercase">📱 Contacto</p>
                  <div>
                    <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">WhatsApp *</label>
                    <input
                      required
                      type="tel"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-sm md:text-base"
                      value={form.whatsapp}
                      onChange={(e) => {
                        // Solo permitir números
                        const value = e.target.value.replace(/\D/g, '');
                        handleChange('whatsapp', value);
                      }}
                      placeholder="3001234567"
                    />
                    <p className="text-xs text-gray-500 ml-2 mt-1">Número de celular colombiano (10 dígitos)</p>
                  </div>
                  <div>
                    <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Correo (opcional)</label>
                    <input
                      type="email"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-sm md:text-base"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="cliente@email.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Dirección *</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-sm md:text-base"
                      value={form.direccion}
                      onChange={(e) => handleChange('direccion', e.target.value)}
                      placeholder="Calle, número, piso"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Barrio</label>
                      <input
                        type="text"
                        className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-sm md:text-base"
                        value={form.barrio}
                        onChange={(e) => handleChange('barrio', e.target.value)}
                        placeholder="Ej: Centro"
                      />
                    </div>
                    <div>
                      <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Nº de Personas</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-sm md:text-base"
                        value={form.numPersonas}
                        onChange={(e) => handleChange('numPersonas', e.target.value)}
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Datos de Salud */}
                <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-200 space-y-3">
                  <p className="text-xs md:text-sm font-bold text-red-600 uppercase">⚠️ Datos de Salud</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="hasAlergias"
                      checked={form.hasAlergias}
                      onChange={(e) => handleChange('hasAlergias', e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-red-300"
                    />
                    <label htmlFor="hasAlergias" className="font-bold text-gray-700 cursor-pointer text-sm md:text-base">
                      ¿Tiene alergias o afectaciones de salud?
                    </label>
                  </div>
                  {form.hasAlergias && (
                    <textarea
                      className="w-full rounded-xl md:rounded-2xl border-2 border-red-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-red-400 text-sm md:text-base resize-none"
                      value={form.detalleAlergias}
                      onChange={(e) => handleChange('detalleAlergias', e.target.value)}
                      placeholder="Describe las alergias o afectaciones..."
                      rows="3"
                    />
                  )}
                </div>

                {/* Referencias */}
                <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 space-y-3">
                  <p className="text-xs md:text-sm font-bold text-purple-600 uppercase">📌 Referencias</p>
                  <div>
                    <label className="text-xs md:text-sm font-bold text-gray-700 ml-2 mb-1 block">Referido Por (opcional)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-purple-200 bg-white px-3 md:px-4 py-2.5 md:py-3 font-bold text-gray-800 focus:outline-none focus:border-purple-400 text-sm md:text-base"
                      value={form.referidoPor}
                      onChange={(e) => handleChange('referidoPor', e.target.value)}
                      placeholder="Nombre o fuente"
                    />
                  </div>
                </div>

                {/* Términos */}
                <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terminosAceptados"
                      checked={form.terminosAceptados}
                      onChange={(e) => handleChange('terminosAceptados', e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-green-300 mt-1"
                    />
                    <label htmlFor="terminosAceptados" className="font-bold text-gray-700 cursor-pointer text-xs md:text-sm">
                      ✅ Acepto los terminos y condiciones del servicio junto con la politica de bioseguridad.
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black text-base md:text-lg py-4 md:py-5 rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl border-b-4 border-orange-700 active:border-b-0 active:translate-y-0.5"
                >
                  <Check className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Confirmar Reserva
                </Button>

                <p className="text-[10px] md:text-xs text-gray-500 font-bold text-center">
                  Al reservar aceptas ser contactado por WhatsApp para confirmar la visita.
                </p>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
      <Toaster />
    </>
  );
};

export default PublicBooking;
