import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Sparkles, Copy, Check, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion } from 'framer-motion';
import { bookingService, serviceService } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import AddressAutocomplete from '@/components/AddressAutocomplete';

const WEEK_DAYS = ['Lun', 'Mar', 'Mi', 'Jue', 'Vie', 'Sb', 'Dom'];

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

const defaultServiceCatalog = [
  { name: 'Normal', value: 70000 },
  { name: 'Elevado', value: 100000 },
  { name: 'Muy Alto', value: 120000 }
];

const normalizeServiceCatalog = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const name = String(item.name ?? item.label ?? '').trim();
        const value = Number(item.value ?? item.price ?? 0);
        if (!name || !Number.isFinite(value)) return null;
        return { value: name, label: name, amount: value };
      })
      .filter(Boolean);
  }
  if (typeof input === 'object') {
    return Object.entries(input)
      .map(([name, value]) => {
        const cleanName = String(name).trim();
        const amount = Number(value ?? 0);
        if (!cleanName || !Number.isFinite(amount)) return null;
        return { value: cleanName, label: cleanName, amount };
      })
      .filter(Boolean);
  }
  return [];
};

const loadServiceCatalog = () => {
  try {
    const raw = localStorage.getItem('serviceCatalog');
    const parsed = raw ? JSON.parse(raw) : null;
    const normalized = normalizeServiceCatalog(parsed);
    if (normalized.length) return normalized;
  } catch (e) {
    // ignore
  }
  return defaultServiceCatalog.map((svc) => ({
    value: svc.name,
    label: svc.name,
    amount: svc.value
  }));
};

const boldPaymentOptions = {
  Normal: {
    price: '$80.000',
    link: 'https://checkout.bold.co/payment/LNK_89Z6PUUSRS'
  },
  Elevado: {
    price: '$110.000',
    link: 'https://checkout.bold.co/payment/LNK_Y2J2USYK3U'
  },
  'Muy Alto': {
    price: '$130.000',
    link: 'https://checkout.bold.co/payment/LNK_GXTCYS2BEN'
  }
};

const PublicBooking = () => {
  const [serviceOptions, setServiceOptions] = useState(() => loadServiceCatalog());
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

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
  const [payNowAcknowledged, setPayNowAcknowledged] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    serviceType: serviceOptions[0]?.value || 'Normal',
    whatsapp: '',
    direccion: '',
    barrio: '',
    numPersonas: '1',
    hasAlergias: false,
    detalleAlergias: '',
    referidoPor: '',
    terminosAceptados: false,
    paymentMethod: 'pay_later'
  });

  const shareLink = `${window.location.origin}/agenda`;
  const currentPaymentOption = boldPaymentOptions[form.serviceType];
  const currentServiceValue = serviceOptions.find((service) => service.value === form.serviceType)?.amount || 0;
  const isPayNowAvailable = Boolean(currentPaymentOption?.link);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    if (!isPayNowAvailable && form.paymentMethod === 'pay_now') {
      setForm(prev => ({ ...prev, paymentMethod: 'pay_later' }));
      setPayNowAcknowledged(true);
    }
  }, [form.serviceType, isPayNowAvailable]);

  useEffect(() => {
    let isMounted = true;
    const loadServices = async () => {
      const result = await serviceService.getAll();
      if (result.success && Array.isArray(result.services) && result.services.length) {
        const normalized = normalizeServiceCatalog(result.services);
        if (isMounted && normalized.length) {
          setServiceOptions(normalized);
          setForm(prev => ({ ...prev, serviceType: normalized[0]?.value || prev.serviceType }));
        }
      }
    };
    loadServices();
    return () => { isMounted = false; };
  }, []);

  const selectPaymentMethod = (method) => {
    if (method === 'pay_now' && !isPayNowAvailable) {
      toast({
        title: 'Pago en lnea no disponible',
        description: 'Este servicio solo permite pago al finalizar.',
        duration: 3000
      });
      return;
    }
    handleChange('paymentMethod', method);
    setPayNowAcknowledged(method === 'pay_later');
  };

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
      // Cupos ilimitados - todos los das tienen slots disponibles
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

  const dialogTitleText = selectedDate
    ? `Reserva para ${formatLongDate(selectedDate)}`
    : 'Selecciona fecha y hora';
  const dialogDescriptionText = showForm
    ? 'Completa tus datos para confirmar la visita'
    : 'Elige un horario disponible para tu visita';

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
    setPayNowAcknowledged(false);
    setForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      serviceType: serviceOptions[0]?.value || 'Normal',
      whatsapp: '',
      direccion: '',
      barrio: '',
      numPersonas: '1',
      hasAlergias: false,
      detalleAlergias: '',
      referidoPor: '',
      terminosAceptados: false,
      paymentMethod: 'pay_later'
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({
        title: ' Enlace copiado',
        description: 'Comparte este link con tus clientes',
        duration: 2500
      });
    } catch (error) {
      toast({
        title: ' No se pudo copiar',
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
        title: ' Selecciona dia y hora',
        description: 'Escoge un da disponible y una hora libre',
        duration: 3000
      });
      return;
    }

    const selectedDateStart = new Date(selectedDate);
    selectedDateStart.setHours(0, 0, 0, 0);

    if (selectedDateStart < today) {
      toast({
        title: ' Fecha no disponible',
        description: 'Solo puedes agendar desde hoy en adelante.',
        duration: 3000,
        variant: 'destructive'
      });
      return;
    }

    // Validaciones especficas para cada campo
    if (!form.name || form.name.trim() === '') {
      toast({
        title: ' Falta tu nombre',
        description: 'Por favor ingresa tu nombre completo',
        duration: 3000
      });
      return;
    }

    if (!form.whatsapp || form.whatsapp.trim() === '') {
      toast({
        title: ' Falta nmero de WhatsApp',
        description: 'Necesitamos tu nmero para confirmar la cita',
        duration: 3000
      });
      return;
    }

    // Validar formato de nmero de WhatsApp (Colombia: 10 dgitos, empieza con 3)
    const whatsappClean = form.whatsapp.replace(/\D/g, '');
    if (whatsappClean.length !== 10 || !whatsappClean.startsWith('3')) {
      toast({
        title: ' Nmero de WhatsApp invlido',
        description: 'Debe ser un nmero de celular colombiano vlido (10 dgitos, inicia con 3)',
        duration: 4000,
        variant: 'destructive'
      });
      return;
    }

    if (!form.direccion || form.direccion.trim() === '') {
      toast({
        title: ' Falta la direccin',
        description: 'Necesitamos saber dnde realizar el servicio',
        duration: 3000
      });
      return;
    }

    if (!form.terminosAceptados) {
      toast({
        title: ' Acepta los trminos',
        description: 'Debes aceptar los trminos y condiciones',
        duration: 3000
      });
      return;
    }

    // Validar anticipacin mnima de 12 horas
    const now = new Date();
    const selectedDateTime = new Date(selectedDate);
    const [slotHour, slotMinute] = selectedSlot.split(':').map((v) => parseInt(v, 10));
    selectedDateTime.setHours(slotHour, slotMinute, 0, 0);
    const twelveHoursMs = 12 * 60 * 60 * 1000;

    if (selectedDateTime.getTime() - now.getTime() < twelveHoursMs) {
      toast({
        title: ' Anticipacin insuficiente',
        description: 'Los servicios se solicitan con mnimo 12 horas de antelacin.',
        duration: 4000,
        variant: 'destructive'
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
        referidoPor: form.referidoPor || null,
        paymentMethod: form.paymentMethod
      };

      const result = await bookingService.create(bookingData);
      if (!result.success) {
        throw new Error(result.message || 'Error al crear la reserva');
      }

      // Guardar info de reserva confirmada y mostrar vista de confirmacion
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
      setShowConfirmation(true); // Mostrar confirmacion en la pagina principal
      setShowForm(false);
      setPayNowAcknowledged(false);
      
      // Scroll hacia arriba para ver el mensaje de confirmacion
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error al crear reserva:', error);
      toast({
        title: ' Error al agendar',
        description: error.message || 'No se pudo crear la reserva. Intenta nuevamente.',
        duration: 4000,
        variant: 'destructive'
      });
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-b from-orange-50 via-amber-50 to-white font-fredoka text-gray-800 text-[20px] md:text-xl leading-relaxed md:leading-normal relative overflow-hidden flex items-center justify-center px-3 md:px-6 py-6">
      {/* Decorative Background Blobs */}
      <div className="fixed top-20 -left-10 w-48 h-48 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-20 -right-10 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse pointer-events-none"></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none"></div>

      {/* Floating Elements - Same as Login */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] text-4xl opacity-20"
      >🦠</motion.div>
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-20 right-[10%] w-16 h-16 opacity-30"
      >
        <img src="/logo.png" alt="Chao Piojos" className="w-full h-full object-contain drop-shadow" />
      </motion.div>

      <div className="max-w-7xl w-full mx-auto px-0 md:px-4 py-4 md:py-8 relative z-10 flex justify-center">
        <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-8 shadow-2xl border-4 border-orange-200 relative overflow-hidden max-w-5xl mx-auto">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-amber-200 rounded-full mix-blend-multiply opacity-60 animate-pulse pointer-events-none"></div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-orange-300 rounded-full mix-blend-multiply opacity-50 animate-pulse pointer-events-none"></div>

          <div className="relative">
            {/* Calendar o Vista de Confirmacion */}
            {!showConfirmation ? (
            <div className="bg-white rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-xl border-4 border-orange-100 space-y-4 md:space-y-5">
              {/* Month navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2 capitalize">
                    <span className="text-2xl md:text-3xl"></span>
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
                  const isPast = date < today;
                  const hasSlots = slots.length > 0 && isCurrentMonth && !isPast;
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
                        if (isPast) {
                          toast({
                            title: ' Fecha no disponible',
                            description: 'Solo puedes agendar desde hoy en adelante.',
                            duration: 3000,
                            variant: 'destructive'
                          });
                          return;
                        }

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
                Toca un da para ver los horarios disponibles.
              </p>
            </div>
            ) : (
              /* Vista de Confirmacion */
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.4 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl md:rounded-[2rem] p-6 md:p-10 shadow-xl border-4 border-green-200"
              >
                <div className="text-center space-y-6">
                  {/* Icono de xito */}
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

                  {/* Mensaje de xito */}
                  <div className="space-y-3">
                    <h2 className="text-2xl md:text-4xl font-black text-green-600">
                      Reserva Confirmada!
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
                  <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border-2 border-blue-200 max-w-2xl mx-auto space-y-3">
                    <p className="text-sm md:text-base text-gray-700 font-bold">
                      📱 Te contactaremos vía <span className="text-blue-600">WhatsApp</span> al número{' '}
                      <span className="text-blue-600 font-black">{confirmedBooking?.whatsapp}</span> para confirmar tu visita.
                    </p>
                    
                    {/* Botón para enviar confirmación por WhatsApp */}
                    <a
                      href={`https://wa.me/573227932394?text=${encodeURIComponent(
                        `✅ *Confirmación de Reserva - Chao Piojos*\n\n` +
                        `Hola! Acabo de agendar mi cita:\n\n` +
                        `👤 *Nombre:* ${confirmedBooking?.clientName}\n` +
                        `📅 *Fecha:* ${confirmedBooking?.fecha}\n` +
                        `🕐 *Hora:* ${confirmedBooking?.hora}\n` +
                        `💆 *Servicio:* ${confirmedBooking?.serviceType}\n` +
                        `📍 *Dirección:* ${confirmedBooking?.direccion}\n` +
                        `🏘️ *Barrio:* ${confirmedBooking?.barrio || 'No especificado'}\n` +
                        `📱 *WhatsApp:* ${confirmedBooking?.whatsapp}\n\n` +
                        `Confirmo mi asistencia y espero su contacto. ¡Gracias!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-black text-sm md:text-base px-6 py-4 rounded-2xl shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Enviar Confirmación por WhatsApp
                    </a>
                  </div>

                  {/* Recomendaciones */}
                  <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                      <p className="text-base md:text-lg font-black text-emerald-700 flex items-center gap-2">
                        <span aria-hidden="true"></span> Recomendaciones para tu visita
                      </p>
                      <p className="text-sm md:text-base font-black text-gray-800">
                        Si tienes dudas o cambios escrbenos al WhatsApp <span className="text-emerald-600">3227932394</span>.
                      </p>
                      <div className="space-y-2 text-sm md:text-base text-gray-700 font-bold">
                        <p className="text-emerald-700 font-black">Cmo prepararte para recibir al piojlogo certificado</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Cabello seco, limpio y sin productos; lvalo el da anterior y llega con el cabello totalmente seco.</li>
                          <li>Cabello desenredado para facilitar la extraccin.</li>
                          <li>No aplicar tratamientos antipiojos antes del servicio.</li>
                          <li>Ten un espacio cmodo y una toalla limpia para los hombros.</li>
                          <li>Informa si hay condiciones dermatolgicas o alergias.</li>
                          <li>El procedimiento puede tomar entre 30 y 60 minutos.</li>
                          <li>Menores de edad deben estar acompaados por un adulto responsable.</li>
                        </ul>
                      </div>
                      <div className="space-y-2 text-sm md:text-base text-gray-700 font-bold">
                        <p className="text-emerald-700 font-black">Cuidados despus de la limpieza</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Lava el cabello despus de la limpieza.</li>
                          <li>Cambia ropa de cama y pijamas de los ltimos 3 das (usa agua caliente si es posible).</li>
                          <li>Lava y desinfecta peines, cepillos, ligas, gorras y diademas.</li>
                          <li>Evita compartir objetos de cabeza (peines, almohadas, audfonos, bufandas, gorras).</li>
                          <li>Aspira sillones, almohadas, colchones y asientos del vehculo como medida adicional.</li>
                          <li>Haz revisiones semanales en casa.</li>
                          <li>Viste al nio con ropa limpia tras la limpieza.</li>
                        </ul>
                      </div>
                      <p className="text-sm md:text-base font-black text-emerald-700">Gracias por confiar en Chao Piojos </p>
                    </div>
                  </div>

                  {/* Botn para agendar otra cita */}
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
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl md:rounded-[2rem] border-4 border-orange-200 p-0 text-[20px] md:text-xl leading-relaxed md:leading-normal bg-gradient-to-b from-orange-50 to-white">
          <DialogHeader className="sr-only">
            <DialogTitle>{dialogTitleText}</DialogTitle>
            <DialogDescription>{dialogDescriptionText}</DialogDescription>
          </DialogHeader>
          <div className="relative p-4 md:p-6 lg:p-8 space-y-4 md:space-y-5">
            {!showForm ? (
              /* Slot selection */
              <div className="space-y-4 pt-2">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full mb-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-black text-orange-600 uppercase">Selecciona tu Horario</span>
                  </div>
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
                            const now = new Date();
                            const target = new Date(selectedDate);
                            target.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                            const twelveHoursMs = 12 * 60 * 60 * 1000;

                            if (target.getTime() - now.getTime() < twelveHoursMs) {
                              toast({
                                title: ' Anticipación insuficiente',
                                description: 'Los servicios se solicitan con mínimo 12 horas de antelación.',
                                duration: 4000,
                                variant: 'destructive'
                              });
                              return;
                            }

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
                    No hay horarios disponibles en este da.
                  </div>
                )}
              </div>
            ) : (
              /* Booking form */
              <form className="space-y-5 md:space-y-6 text-[20px] md:text-xl pt-2" onSubmit={handleSubmit}>
                {/* Encabezado del formulario */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-orange-100 px-3 py-1 rounded-full mb-2">
                    <Check className="w-4 h-4 text-orange-600" />
                    <span className="text-xs font-black text-orange-600 uppercase">Completa tu Reserva</span>
                  </div>
                </div>

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
                  <p className="text-base md:text-lg font-black text-gray-700 uppercase tracking-wide"> Datos del Cliente</p>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Nombre Completo *</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-orange-500 text-base md:text-lg"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Ej: Ana Prez Garca"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Nivel de Infestación *</label>
                    <select
                      required
                      className="w-full rounded-xl md:rounded-2xl border-2 border-orange-200 bg-orange-50 px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-orange-500 text-base md:text-lg cursor-pointer"
                      value={form.serviceType}
                      onChange={(e) => handleChange('serviceType', e.target.value)}
                    >
                    {serviceOptions.map((service) => (
                      <option key={service.value} value={service.value}>
                        {service.label}  {formatCurrency(service.amount)}
                      </option>
                    ))}
                  </select>
                  </div>
                </div>

                {/* Contacto del Cliente */}
                <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 space-y-3">
                  <p className="text-base md:text-lg font-black text-blue-600 uppercase">Contacto</p>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">WhatsApp *</label>
                    <input
                      required
                      type="tel"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-base md:text-lg"
                      value={form.whatsapp}
                      onChange={(e) => {
                        // Solo permitir nmeros
                        const value = e.target.value.replace(/\D/g, '');
                        handleChange('whatsapp', value);
                      }}
                      placeholder="3001234567"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Correo (opcional)</label>
                    <input
                      type="email"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-base md:text-lg"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="cliente@email.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Dirección *</label>
                    <AddressAutocomplete
                      value={form.direccion}
                      onChange={(value) => handleChange('direccion', value)}
                      onSelect={(suggestion) => {
                        handleChange('direccion', suggestion.fullName);
                        toast({
                          title: 'Dirección seleccionada',
                          description: suggestion.name,
                          className: 'bg-blue-50 border-2 border-blue-200 text-blue-700 rounded-2xl'
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Barrio</label>
                      <input
                        type="text"
                        className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-base md:text-lg"
                        value={form.barrio}
                        onChange={(e) => handleChange('barrio', e.target.value)}
                        placeholder="Ej: Centro"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Número de Personas</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-blue-400 text-base md:text-lg"
                        value={form.numPersonas}
                        onChange={(e) => handleChange('numPersonas', e.target.value)}
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>

                {/* Datos de Salud */}
                <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-200 space-y-3">
                  <p className="text-base md:text-lg font-bold text-red-600 uppercase"> Datos de Salud</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="hasAlergias"
                      checked={form.hasAlergias}
                      onChange={(e) => handleChange('hasAlergias', e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-red-300"
                    />
                    <label htmlFor="hasAlergias" className="font-bold text-gray-700 cursor-pointer text-base md:text-lg">
                      Tiene alergias o afectaciones de salud?
                    </label>
                  </div>
                  {form.hasAlergias && (
                    <textarea
                      className="w-full rounded-xl md:rounded-2xl border-2 border-red-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-red-400 text-base md:text-lg resize-none"
                      value={form.detalleAlergias}
                      onChange={(e) => handleChange('detalleAlergias', e.target.value)}
                      placeholder="Describe las alergias o afectaciones..."
                      rows="3"
                    />
                  )}
                </div>

                {/* Referencias */}
                <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 space-y-3">
                  <p className="text-base md:text-lg font-bold text-purple-600 uppercase"> Referencias</p>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Referido Por (opcional)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-purple-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-purple-400 text-base md:text-lg"
                      value={form.referidoPor}
                      onChange={(e) => handleChange('referidoPor', e.target.value)}
                      placeholder="Nombre o fuente"
                    />
                  </div>
                </div>

                {/* Pago */}
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 space-y-3">
                  <p className="text-xs md:text-sm font-bold text-amber-600 uppercase"> Método de Pago</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => selectPaymentMethod('pay_now')}
                      disabled={!isPayNowAvailable}
                      className={`w-full text-left rounded-xl md:rounded-2xl border-2 p-3 md:p-4 font-black transition-all flex items-center gap-3 ${
                        form.paymentMethod === 'pay_now'
                          ? 'bg-orange-100 border-orange-300 shadow-md'
                          : 'bg-white border-amber-200 hover:border-orange-300'
                      } ${!isPayNowAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-2xl"></span>
                      <div>
                        <p className="text-sm md:text-base text-gray-800">Pagar ahora</p>
                        <p className="text-xs text-gray-600 font-bold">
                          {isPayNowAvailable ? 'Puedes pagar en lnea con Bold' : 'No disponible para este servicio'}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => selectPaymentMethod('pay_later')}
                      className={`w-full text-left rounded-xl md:rounded-2xl border-2 p-3 md:p-4 font-black transition-all flex items-center gap-3 ${
                        form.paymentMethod === 'pay_later'
                          ? 'bg-green-100 border-green-300 shadow-md'
                          : 'bg-white border-amber-200 hover:border-green-300'
                      }`}
                    >
                      <span className="text-2xl"></span>
                      <div>
                        <p className="text-sm md:text-base text-gray-800">Pagar despues</p>
                        <p className="text-xs text-gray-600 font-bold">Cancelaremos al finalizar el servicio</p>
                      </div>
                    </button>
                  </div>

                  {form.paymentMethod === 'pay_now' && (
                    <div className="bg-white border-2 border-amber-200 rounded-xl md:rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <p className="text-[11px] uppercase tracking-wide text-amber-600 font-black">Paga seguro con Bold</p>
                        <p className="text-base md:text-lg font-black text-gray-800">
                          {form.serviceType} <span className="text-amber-600"> {currentPaymentOption?.price || formatCurrency(currentServiceValue)}</span>
                        </p>
                        {!isPayNowAvailable ? (
                          <p className="text-xs text-red-600 font-black">Pago en línea no disponible para este servicio.</p>
                        ) : !payNowAcknowledged ? (
                          <>
                            <p className="text-xs text-gray-600 font-bold">Se abrirá una pestaña nueva para completar el pago.</p>
                            <p className="text-xs text-orange-600 font-black">Debes abrir Bold para habilitar la confirmación.</p>
                          </>
                        ) : (
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 text-green-700 text-xs font-black inline-flex items-center gap-2 mt-1">
                             Redireccionado a Bold exitósamente
                          </div>
                        )}
                      </div>
                      {isPayNowAvailable && !payNowAcknowledged && (
                        <a
                          href={currentPaymentOption?.link || '#'}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setPayNowAcknowledged(true)}
                          className="inline-flex items-center justify-center bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-black px-4 md:px-6 py-3 rounded-xl shadow-md border-b-4 border-orange-600 active:border-b-0 active:translate-y-0.5 transition"
                        >
                          Ir a Bold
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Trminos */}
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
                       Acepto los términos y condiciones del servicio junto con la política de bioseguridad.
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={form.paymentMethod === 'pay_now' && !payNowAcknowledged}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-base md:text-lg py-4 md:py-5 rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl border-b-4 border-orange-700 active:border-b-0 active:translate-y-0.5"
                >
                  <Check className="w-5 h-5 md:w-6 md:h-6 mr-2" /> Confirmar Reserva
                </Button>

                <p className="text-sm md:text-base text-gray-500 font-bold text-center">
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


