import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Clock, Sparkles, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion } from 'framer-motion';
import { bookingService, boldPaymentService, serviceService, referralService, sellerReferralService, settingsService } from '@/lib/api';
import {
  DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE,
  BUSINESS_WHATSAPP_NUMBER,
  BUSINESS_WHATSAPP_API_NUMBER,
  buildBookingWhatsappMessage
} from '@/lib/bookingSmsTemplate';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { formatTime12Hour } from '@/lib/utils';

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

const defaultServiceCatalog = [
  { name: 'Normal', value: 70000 },
  { name: 'Elevado', value: 100000 },
  { name: 'Muy Alto', value: 130000 }
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

const buildDefaultFormState = (serviceOptions = []) => {
  const defaultService = serviceOptions[0]?.value || 'Normal';

  return {
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    serviceType: defaultService,
    whatsapp: '',
    direccion: '',
    barrio: '',
    descripcionUbicacion: '',
    lat: null,
    lng: null,
    numPersonas: '1',
    edad: '',
    servicesPerPerson: [defaultService],
    hasAlergias: false,
    detalleAlergias: '',
    referidoPor: '',
    terminosAceptados: false,
    paymentMethod: 'pay_later'
  };
};

const PublicBooking = () => {
  const modalScrollRef = React.useRef(null);
  const touchStartYRef = React.useRef(null);
  const [serviceOptions, setServiceOptions] = useState(() => loadServiceCatalog());
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingBoldLink, setIsGeneratingBoldLink] = useState(false);
  const [hasOpenedBoldCheckout, setHasOpenedBoldCheckout] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isEmbeddedMobile, setIsEmbeddedMobile] = useState(false);
  const [requireAdvance12h, setRequireAdvance12h] = useState(() => {
    try {
      const raw = localStorage.getItem('booking_require_12h');
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch (e) {
      // ignore
    }
    return true;
  });
  const [whatsappConfirmationTemplate, setWhatsappConfirmationTemplate] = useState(() => {
    try {
      const raw = localStorage.getItem('booking_whatsapp_template');
      if (raw && raw.trim()) return raw;
    } catch (e) {
      // ignore
    }
    return DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE;
  });
  
  // Estados para código de referido
  const [referralCode, setReferralCode] = useState('');
  const [referralValidation, setReferralValidation] = useState({ isValid: false, isValidating: false, message: '', referrerName: '', referrerRoleLabel: '' });
  const [sellerReferralContext, setSellerReferralContext] = useState({ isActive: false, token: '', businessName: '', sellerName: '', sellerReferralId: null });
  
  const [form, setForm] = useState(() => buildDefaultFormState(serviceOptions));

  
  // Calcular total sumando todos los servicios de las personas
  const totalServiceValue = form.servicesPerPerson.reduce((total, serviceType) => {
    const serviceValue = serviceOptions.find((service) => service.value === serviceType)?.amount || 0;
    return total + serviceValue;
  }, 0);
  
  const finalTotal = totalServiceValue;
  const paymentFingerprint = `${form.paymentMethod}|${(form.servicesPerPerson || []).join('|')}|${finalTotal}`;

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadServices = async () => {
      const result = await serviceService.getAll();
      if (result.success && Array.isArray(result.services) && result.services.length) {
        const normalized = normalizeServiceCatalog(result.services);
        if (isMounted && normalized.length) {
          setServiceOptions(normalized);
          setForm(prev => ({
            ...prev,
            serviceType: normalized[0]?.value || prev.serviceType,
            servicesPerPerson: prev.servicesPerPerson?.length
              ? prev.servicesPerPerson.map((service) => service || normalized[0]?.value || 'Normal')
              : [normalized[0]?.value || 'Normal']
          }));
        }
      }
    };
    loadServices();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    setHasOpenedBoldCheckout(false);
  }, [paymentFingerprint]);

  useEffect(() => {
    let isMounted = true;
    const loadBookingSettings = async () => {
      const result = await settingsService.getBookingSettings();
      if (isMounted && result.success) {
        const next = !!result.settings?.requireAdvance12h;
        const nextTemplate = result.settings?.whatsappConfirmationTemplate || DEFAULT_WHATSAPP_CONFIRMATION_TEMPLATE;
        setRequireAdvance12h(next);
        setWhatsappConfirmationTemplate(nextTemplate);
        try {
          localStorage.setItem('booking_require_12h', next ? '1' : '0');
          localStorage.setItem('booking_whatsapp_template', nextTemplate);
        } catch (e) {
          // ignore
        }
      }
    };
    loadBookingSettings();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    const onSettingsUpdated = (event) => {
      if (typeof event?.detail?.requireAdvance12h !== 'undefined') {
        const next = !!event.detail.requireAdvance12h;
        setRequireAdvance12h(next);
      }
      if (typeof event?.detail?.whatsappConfirmationTemplate === 'string' && event.detail.whatsappConfirmationTemplate.trim()) {
        setWhatsappConfirmationTemplate(event.detail.whatsappConfirmationTemplate);
      }
    };

    const onStorage = (event) => {
      if (event.key === 'booking_require_12h') {
        const next = event.newValue !== '0';
        setRequireAdvance12h(next);
      }
      if (event.key === 'booking_whatsapp_template' && typeof event.newValue === 'string' && event.newValue.trim()) {
        setWhatsappConfirmationTemplate(event.newValue);
      }
    };

    window.addEventListener('booking-settings-updated', onSettingsUpdated);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('booking-settings-updated', onSettingsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    const previousBodyBackgroundColor = document.body.style.backgroundColor;
    const previousBodyBackgroundImage = document.body.style.backgroundImage;

    const applyResponsiveBackground = () => {
      const isMobile = window.innerWidth < 768;
      document.body.style.backgroundColor = isMobile ? '#6EC1E4' : '#ffffff';
      document.body.style.backgroundImage = 'none';
    };

    applyResponsiveBackground();
    window.addEventListener('resize', applyResponsiveBackground);

    return () => {
      window.removeEventListener('resize', applyResponsiveBackground);
      document.body.style.backgroundColor = previousBodyBackgroundColor;
      document.body.style.backgroundImage = previousBodyBackgroundImage;
    };
  }, []);

  useEffect(() => {
    const detectEmbeddedMobile = () => {
      let embedded = false;
      try {
        embedded = window.self !== window.top;
      } catch (e) {
        embedded = true;
      }
      setIsEmbeddedMobile(embedded && window.innerWidth < 768);
    };

    detectEmbeddedMobile();
    window.addEventListener('resize', detectEmbeddedMobile);

    return () => {
      window.removeEventListener('resize', detectEmbeddedMobile);
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen || !isEmbeddedMobile) return;

    const scrollElement = modalScrollRef.current;
    if (!scrollElement) return;

    const forwardScrollToParent = (deltaY) => {
      if (!deltaY) return;

      try {
        if (window.parent && window.parent !== window && typeof window.parent.scrollBy === 'function') {
          window.parent.scrollBy({ top: deltaY, behavior: 'auto' });
        }
      } catch (e) {
        // ignore same-origin restrictions
      }

      try {
        window.parent?.postMessage({
          type: 'chaopiojos-scroll-parent',
          deltaY
        }, '*');
      } catch (e) {
        // ignore
      }
    };

    const tryBubbleScroll = (deltaY) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop >= maxScrollTop - 1;

      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        forwardScrollToParent(deltaY);
      }
    };

    const handleWheel = (event) => {
      tryBubbleScroll(event.deltaY);
    };

    const handleTouchStart = (event) => {
      touchStartYRef.current = event.touches?.[0]?.clientY ?? null;
    };

    const handleTouchMove = (event) => {
      const currentY = event.touches?.[0]?.clientY;
      if (typeof currentY !== 'number' || touchStartYRef.current === null) return;

      const deltaY = touchStartYRef.current - currentY;
      tryBubbleScroll(deltaY);
      touchStartYRef.current = currentY;
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: true });
    scrollElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollElement.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      scrollElement.removeEventListener('wheel', handleWheel);
      scrollElement.removeEventListener('touchstart', handleTouchStart);
      scrollElement.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isModalOpen, isEmbeddedMobile]);

  // Leer código de referido desde la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sellerReferralToken = params.get('sr');

    if (sellerReferralToken) {
      resolveSellerReferralLink(sellerReferralToken.trim());
      return;
    }

    const refCode = params.get('ref');
    if (refCode) {
      const normalizedCode = refCode.trim().toUpperCase();
      setReferralCode(normalizedCode);
      validateReferralCode(normalizedCode);
    }
  }, []);

  const resolveSellerReferralLink = async (token) => {
    if (!token) {
      setSellerReferralContext({ isActive: false, token: '', businessName: '', sellerName: '', sellerReferralId: null });
      return;
    }

    setReferralValidation((prev) => ({ ...prev, isValidating: true }));

    try {
      const result = await sellerReferralService.resolveLink(token);
      if (!result.success || !result.referral) {
        setSellerReferralContext({ isActive: false, token: '', businessName: '', sellerName: '', sellerReferralId: null });
        setReferralValidation({
          isValid: false,
          isValidating: false,
          message: result.message || 'Link de peluquería no válido',
          referrerName: '',
          referrerRoleLabel: ''
        });
        return;
      }

      const sellerName = result.referral?.seller?.name || '';
      const sellerCode = result.referral?.seller?.referral_code || '';
      const businessName = result.referral?.business_name || '';

      setSellerReferralContext({
        isActive: true,
        token,
        businessName,
        sellerName,
        sellerReferralId: result.referral.id || null
      });
      setReferralCode(sellerCode);
      setReferralValidation({
        isValid: true,
        isValidating: false,
        message: `Link activo de ${businessName} referido por vendedor ${sellerName}`,
        referrerName: sellerName,
        referrerRoleLabel: 'vendedor'
      });
    } catch (error) {
      setSellerReferralContext({ isActive: false, token: '', businessName: '', sellerName: '', sellerReferralId: null });
      setReferralValidation({
        isValid: false,
        isValidating: false,
        message: 'Error al validar link de peluquería',
        referrerName: '',
        referrerRoleLabel: ''
      });
    }
  };

  // Función para validar código de referido
  const validateReferralCode = async (code) => {
    if (!code || code.trim() === '') {
      setReferralValidation({ isValid: false, isValidating: false, message: '', referrerName: '', referrerRoleLabel: '' });
      return;
    }

    setReferralValidation(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await referralService.validateCode(code);
      
      if (result.success && result.data.valid) {
        setReferralValidation({
          isValid: true,
          isValidating: false,
          message: `¡Código válido! Referido por ${result.data.referrer.roleLabel || 'referido'} ${result.data.referrer.name}`,
          referrerName: result.data.referrer.name,
          referrerRoleLabel: result.data.referrer.roleLabel || 'referido'
        });
        toast({
          title: "✨ ¡Código aplicado!",
          description: "Tu referido ha sido registrado correctamente.",
          className: "bg-green-100 border-2 border-green-200 text-green-800 rounded-2xl font-bold"
        });
      } else {
        setReferralValidation({
          isValid: false,
          isValidating: false,
          message: 'Código no válido',
          referrerName: '',
          referrerRoleLabel: ''
        });
      }
    } catch (error) {
      setReferralValidation({
        isValid: false,
        isValidating: false,
        message: 'Error al validar código',
        referrerName: '',
        referrerRoleLabel: ''
      });
    }
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
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleCloseConfirmation = () => {
    setShowConfirmation(false);
    setConfirmedBooking(null);
    setSelectedSlot('');
    setSelectedDate(null);
    setIsModalOpen(false);
    setHasOpenedBoldCheckout(false);
    setForm(buildDefaultFormState(serviceOptions));
  };

  const handleGoToBold = async () => {
    if (isGeneratingBoldLink) {
      return;
    }

    if (!Array.isArray(form.servicesPerPerson) || form.servicesPerPerson.length === 0) {
      toast({
        title: '⚠️ Servicio requerido',
        description: 'Selecciona al menos un servicio antes de generar el pago.',
        duration: 4000,
        variant: 'destructive'
      });
      return;
    }

    if (finalTotal < 1000) {
      toast({
        title: '⚠️ Monto inválido',
        description: 'El monto mínimo permitido por Bold es de $1.000 COP.',
        duration: 4000,
        variant: 'destructive'
      });
      return;
    }

    let checkoutWindow = null;

    try {
      checkoutWindow = window.open('', '_blank');
      if (checkoutWindow) {
        checkoutWindow.opener = null;
        checkoutWindow.document.write(`
          <!doctype html>
          <html lang="es">
            <head>
              <meta charset="utf-8" />
              <title>Redirigiendo a Bold...</title>
            </head>
            <body style="font-family: sans-serif; margin: 0; padding: 32px; color: #1f2937;">
              <p style="font-size: 18px; font-weight: 700; margin: 0 0 12px;">Redirigiendo a Bold...</p>
              <p style="margin: 0;">Estamos generando tu link de pago seguro.</p>
            </body>
          </html>
        `);
        checkoutWindow.document.close();
      }

      setIsGeneratingBoldLink(true);

      const result = await boldPaymentService.createLink({
        serviceType: form.servicesPerPerson[0],
        servicesPerPerson: form.servicesPerPerson,
        clientName: form.name || null,
        email: form.email || null,
      });

      if (!result.success || !result.url) {
        if (checkoutWindow && !checkoutWindow.closed) {
          checkoutWindow.close();
        }

        toast({
          title: '❌ No se pudo abrir Bold',
          description: result.message || 'No fue posible generar el link de pago.',
          duration: 5000,
          variant: 'destructive'
        });
        return;
      }

      setHasOpenedBoldCheckout(true);

      if (checkoutWindow && !checkoutWindow.closed) {
        checkoutWindow.location.replace(result.url);
      } else {
        window.location.href = result.url;
      }
    } catch (error) {
      if (checkoutWindow && !checkoutWindow.closed) {
        checkoutWindow.close();
      }

      toast({
        title: '❌ Error inesperado',
        description: 'No pudimos generar el link de pago con Bold.',
        duration: 5000,
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingBoldLink(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    // Evitar múltiples envíos
    if (isSubmitting) {
      return;
    }
    
    // Limpiar errores previos
    setFieldErrors({});
    
    // Validar fecha y hora
    if (!selectedDate || !selectedSlot) {
      toast({
        title: '⚠️ Campos requeridos',
        description: 'Debes seleccionar una fecha y una hora para tu cita',
        duration: 4000,
        variant: 'destructive'
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

    // Validaciones específicas para cada campo
    const errors = {};
    
    if (!form.name || form.name.trim() === '') {
      errors.name = 'Debes ingresar tu nombre completo';
    }
    
    if (!form.whatsapp || form.whatsapp.trim() === '') {
      errors.whatsapp = 'El número de WhatsApp es obligatorio';
    } else {
      // Validar formato de número de WhatsApp (Colombia: 10 dígitos, empieza con 3)
      const whatsappClean = form.whatsapp.replace(/\D/g, '');
      if (whatsappClean.length !== 10) {
        errors.whatsapp = 'Debe tener exactamente 10 dígitos';
      } else if (!whatsappClean.startsWith('3')) {
        errors.whatsapp = 'El número debe iniciar con 3 (celular colombiano)';
      }
    }

    if (!form.direccion || form.direccion.trim() === '') {
      errors.direccion = 'La dirección es obligatoria para realizar el servicio';
    }
    
    if (!form.barrio || form.barrio.trim() === '') {
      errors.barrio = 'El barrio nos ayuda a ubicar mejor tu dirección';
    }

    if (!form.terminosAceptados) {
      errors.terminosAceptados = 'Debes aceptar los términos y condiciones';
    }
    
    // Si hay errores, mostrarlos
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      
      // Mostrar primer error en toast
      const firstError = Object.entries(errors)[0];
      const fieldNames = {
        name: 'Nombre',
        whatsapp: 'WhatsApp',
        direccion: 'Dirección',
        barrio: 'Barrio',
        terminosAceptados: 'Términos'
      };
      
      toast({
        title: `❌ ${fieldNames[firstError[0]] || 'Error'}`,
        description: firstError[1],
        duration: 5000,
        variant: 'destructive'
      });
      
      // Scroll al primer campo con error
      const firstErrorField = document.querySelector(`[name="${firstError[0]}"]`);
      if (firstErrorField) {
        firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => firstErrorField.focus(), 300);
      }
      
      return;
    }

    if (requireAdvance12h) {
      // Validar anticipación mínima de 12 horas
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
    }

    try {
      // Activar estado de carga
      setIsSubmitting(true);
      
      // Formatear la fecha en formato YYYY-MM-DD
      const fecha = buildDateKey(selectedDate);

      const bookingData = {
        fecha: fecha,
        hora: selectedSlot,
        clientName: form.name,
        serviceType: form.servicesPerPerson[0], // Primer servicio como principal
        servicesPerPerson: form.servicesPerPerson, // Array completo de servicios
        whatsapp: form.whatsapp,
        email: form.email || null,
        direccion: form.direccion,
        barrio: form.barrio,
        descripcionUbicacion: form.descripcionUbicacion || null,
        lat: form.lat,
        lng: form.lng,
        numPersonas: parseInt(form.numPersonas),
        edad: form.edad,
        hasAlergias: form.hasAlergias,
        detalleAlergias: form.detalleAlergias || null,
        referidoPor: form.referidoPor || null,
        paymentMethod: form.paymentMethod,
        referralCode: referralValidation.isValid ? referralCode : null, // Enviar código si es válido
        sellerReferralToken: sellerReferralContext.isActive ? sellerReferralContext.token : null
      };

      const result = await bookingService.create(bookingData);
      if (!result.success) {
        // Si hay errores de validación del backend, mostrarlos
        if (result.errors) {
          const backendErrors = {};
          const fieldMapping = {
            'clientName': 'name',
            'whatsapp': 'whatsapp',
            'direccion': 'direccion',
            'barrio': 'barrio',
            'numPersonas': 'numPersonas',
            'email': 'email'
          };
          
          // Mapear errores del backend a nombres de campos del frontend
          Object.keys(result.errors).forEach(backendField => {
            const frontendField = fieldMapping[backendField] || backendField;
            backendErrors[frontendField] = result.errors[backendField][0]; // Primer error
          });
          
          setFieldErrors(backendErrors);
          
          // Construir mensaje con todos los errores
          const errorList = Object.entries(backendErrors)
            .map(([field, msg]) => {
              const fieldNames = {
                name: 'Nombre',
                whatsapp: 'WhatsApp',
                direccion: 'Dirección',
                barrio: 'Barrio',
                numPersonas: 'Número de personas',
                email: 'Email'
              };
              return `• ${fieldNames[field] || field}: ${msg}`;
            })
            .join('\n');
          
          toast({
            title: '❌ Errores en el formulario',
            description: errorList,
            duration: 6000,
            variant: 'destructive'
          });
        } else {
          toast({
            title: '❌ Error',
            description: result.message || 'No se pudo crear la reserva. Verifica los datos.',
            duration: 4000,
            variant: 'destructive'
          });
        }
        return;
      }

      // Guardar info de reserva confirmada y mostrar vista de confirmacion
      const confirmedData = {
        clientName: form.name,
        fecha: formatLongDate(selectedDate),
        hora: selectedSlot,
        serviceType: form.servicesPerPerson[0],
        servicesPerPerson: form.servicesPerPerson,
        numPersonas: form.numPersonas,
        totalValue: totalServiceValue,
        finalTotal: finalTotal,
        hasReferral: referralValidation.isValid,
        referrerName: referralValidation.referrerName,
        referrerRoleLabel: referralValidation.referrerRoleLabel,
        referralCode: referralCode,
        sellerReferralBusinessName: sellerReferralContext.businessName,
        whatsapp: form.whatsapp,
        direccion: form.direccion,
        barrio: form.barrio,
        descripcionUbicacion: form.descripcionUbicacion
      };

      setConfirmedBooking(confirmedData);
      setIsModalOpen(false); // Cerrar el modal
      setShowConfirmation(true); // Mostrar confirmacion en la pagina principal
      setShowForm(false);
      
      // Scroll hacia arriba para ver el mensaje de confirmacion
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error al crear reserva:', error);
      toast({
        title: '❌ Error inesperado',
        description: 'Ocurrió un problema al procesar tu reserva. Inténtalo nuevamente.',
        duration: 4000,
        variant: 'destructive'
      });
    } finally {
      // Desactivar estado de carga
      setIsSubmitting(false);
    }
  };

  const whatsappConfirmationMessage = useMemo(() => {
    if (!confirmedBooking) return '';
    const servicesList = Array.isArray(confirmedBooking.servicesPerPerson) && confirmedBooking.servicesPerPerson.length
      ? confirmedBooking.servicesPerPerson.map((service, idx) => `   ${idx + 1}. ${service}`).join('\n')
      : '';

    return buildBookingWhatsappMessage(whatsappConfirmationTemplate, {
      clientName: confirmedBooking.clientName || '',
      fecha: confirmedBooking.fecha || '',
      hora: confirmedBooking.hora || '',
      direccion: confirmedBooking.direccion || '',
      detailsLine: confirmedBooking.descripcionUbicacion
        ? `Detalles: ${confirmedBooking.descripcionUbicacion}`
        : '',
      barrio: confirmedBooking.barrio || 'No especificado',
      numPersonas: confirmedBooking.numPersonas || '',
      edad: confirmedBooking.edad || 'No especificada',
      servicesList,
      total: formatCurrency(confirmedBooking.finalTotal || 0),
      businessWhatsapp: BUSINESS_WHATSAPP_NUMBER
    });
  }, [confirmedBooking, whatsappConfirmationTemplate]);

  return (
    <>
      <div className="min-h-0 md:min-h-screen bg-[#8bb6d9] font-sans text-gray-800 text-[20px] md:text-xl leading-relaxed md:leading-normal relative overflow-hidden flex items-start md:items-center justify-center px-2 md:px-6 py-2 md:py-6">

      {/* Floating Elements - Same as Login */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] text-5xl opacity-35"
      >🦠</motion.div>
      <motion.div
        animate={{ y: [0, 14, 0], x: [0, 8, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
        className="absolute top-32 right-[18%] text-4xl opacity-35"
      >🦠</motion.div>
      <motion.div
        animate={{ y: [0, -12, 0], x: [0, -10, 0] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
        className="absolute top-[42%] left-[6%] text-6xl opacity-30"
      >🪳</motion.div>
      <motion.div
        animate={{ y: [0, 16, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
        className="absolute top-[58%] right-[8%] text-5xl opacity-35"
      >🦠</motion.div>
      <motion.div
        animate={{ y: [0, -18, 0], x: [0, 12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
        className="absolute bottom-24 left-[14%] text-4xl opacity-30"
      >🪳</motion.div>
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-20 right-[10%] w-20 h-20 opacity-45"
      >
        <img src="/logo.png" alt="Chao Piojos" className="w-full h-full object-contain drop-shadow" />
      </motion.div>

      <div className="max-w-7xl w-full mx-auto px-0 md:px-2 py-4 md:py-8 relative z-10 flex justify-center">
          <div className="relative max-w-6xl w-full mx-auto">
            <div className="mb-3 md:mb-6 rounded-[1.5rem] md:rounded-[2rem] border-4 border-cyan-100 bg-gradient-to-r from-white via-cyan-50 to-blue-50 p-3 md:p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 md:w-20 md:h-20 rounded-[1rem] md:rounded-[1.5rem] bg-white border-2 border-cyan-100 p-1.5 md:p-2 shadow-md shrink-0">
                    <img src="/logo.png" alt="Chao Piojos" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <p className="text-[10px] md:text-sm font-black uppercase tracking-[0.22em] md:tracking-[0.28em] text-cyan-600">Agenda Oficial</p>
                    <h1 className="text-2xl md:text-5xl font-black leading-none">
                      <span className="text-orange-500">Chao</span>{' '}
                      <span className="text-blue-600">Piojos</span>
                    </h1>
                    <p className="mt-1 md:mt-2 text-xs md:text-base font-bold text-slate-600">
                      Reserva tu cita a domicilio en pocos pasos.
                    </p>
                  </div>
                </div>
                <motion.a
                  href="https://chaopiojos.com/"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="font-lobster-two inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 md:px-6 md:py-4 font-bold shadow-md border-b-4 border-orange-700 active:border-b-0 active:translate-y-1 transition-all text-base md:text-xl"
                >
                  <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                  Volver al inicio
                </motion.a>
              </div>
            </div>
            {/* Calendar o Vista de Confirmacion */}
            {!showConfirmation ? (
            <div className="bg-white rounded-2xl md:rounded-[2rem] p-5 md:p-8 shadow-xl space-y-5 md:space-y-6">
              {/* Month navigation */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="font-lobster-two text-3xl md:text-4xl font-bold text-gray-800 flex items-center gap-2 capitalize">
                    <span className="text-2xl md:text-3xl"></span>
                    Horarios Disponibles
                  </h3>
                  <p className="text-xs md:text-sm font-bold text-gray-500 mt-1 capitalize">{monthLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={goToPreviousMonth}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1 md:gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-orange-200 transition-all duration-200 text-base md:text-lg"
                  >
                    <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={goToToday}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1 md:gap-2 bg-orange-100 hover:bg-orange-200 text-orange-600 font-bold px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-orange-200 transition-all duration-200 text-base md:text-lg"
                  >
                    <CalendarDays className="w-3 h-3 md:w-4 md:h-4" />
                    Hoy
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={goToNextMonth}
                    whileHover={{ scale: 1.03, y: -1 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center gap-1 md:gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl border-2 border-orange-200 transition-all duration-200 text-base md:text-lg"
                  >
                    <span className="hidden sm:inline">Siguiente</span>
                    <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-2 md:gap-3 text-center font-bold text-gray-500">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="uppercase tracking-wide text-xs md:text-sm text-gray-400">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {calendarDays.map((dayInfo) => {
                  const { date, key, isToday, isCurrentMonth, slots } = dayInfo;
                  const dateLabel = date.getDate();
                  const isPast = date < today;
                  const hasSlots = slots.length > 0 && isCurrentMonth && !isPast;
                  const isSelected = selectedDate ? key === buildDateKey(selectedDate) : false;
                  
                  const cellClasses = [
                    'rounded-xl md:rounded-2xl border-2 min-h-[82px] md:min-h-[118px] flex items-center justify-center p-2 md:p-3 transition-all',
                    isCurrentMonth ? 'bg-white border-orange-100' : 'bg-gray-50 border-gray-100 opacity-40',
                    isToday ? 'shadow-md md:shadow-lg border-orange-300 ring-1 md:ring-2 ring-orange-200 ring-offset-1 md:ring-offset-2' : '',
                    hasSlots ? 'cursor-pointer hover:-translate-y-0.5 md:hover:-translate-y-1 hover:shadow-md md:hover:shadow-lg hover:border-orange-400 active:translate-y-0' : 'cursor-default',
                    isSelected ? 'border-4 border-orange-400 shadow-lg md:shadow-xl bg-orange-50' : ''
                  ].join(' ');

                  return (
                    <motion.div
                      key={key}
                      className={cellClasses}
                      whileTap={hasSlots ? { scale: 0.94 } : undefined}
                      whileHover={hasSlots ? { y: -2 } : undefined}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
                      <div className={`w-12 h-12 md:w-20 md:h-20 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-2xl md:text-4xl ${
                        isToday 
                          ? 'bg-orange-500 text-white shadow-md' 
                          : isCurrentMonth && hasSlots
                            ? 'bg-orange-100 text-orange-700'
                            : isCurrentMonth
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-gray-50 text-gray-400'
                      }`}>
                        {dateLabel}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-xs md:text-sm text-gray-600 font-bold text-center">
                Toca un día para ver los horarios disponibles.
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
                          <p className="text-base md:text-lg font-black text-green-600">{formatTime12Hour(confirmedBooking?.hora)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 md:p-5 rounded-2xl border-2 border-green-200 shadow-md">
                      <div className="flex items-center justify-center gap-3">
                        <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-green-600" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-green-500 uppercase">{confirmedBooking?.numPersonas > 1 ? 'Servicio para' : 'Servicio'}</p>
                          <p className="text-sm md:text-base font-black text-gray-800">
                            {confirmedBooking?.numPersonas > 1 ? `${confirmedBooking.numPersonas} personas` : confirmedBooking?.serviceType}
                          </p>
                          <p className="text-xs font-bold text-green-600">Total: {formatCurrency(confirmedBooking?.finalTotal || 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {confirmedBooking?.hasReferral && (
                    <div className="max-w-2xl mx-auto w-full bg-slate-50 p-4 md:p-5 rounded-2xl border-2 border-slate-200 shadow-md">
                      <p className="text-xs font-black text-slate-600 uppercase">Referido aplicado</p>
                      <p className="text-base md:text-lg font-black text-slate-700">
                        Código: {confirmedBooking?.referralCode}
                      </p>
                      <p className="text-sm md:text-base font-bold text-slate-700">
                        Referido por {confirmedBooking?.referrerRoleLabel || 'referido'} {confirmedBooking?.referrerName}
                      </p>
                      {confirmedBooking?.sellerReferralBusinessName && (
                        <p className="text-sm md:text-base font-bold text-slate-700">
                          Peluquería origen: {confirmedBooking.sellerReferralBusinessName}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Mensaje informativo */}
                  <div className="bg-blue-50 p-4 md:p-5 rounded-2xl border-2 border-blue-200 max-w-2xl mx-auto space-y-3">
                    <p className="text-sm md:text-base text-gray-700 font-bold">
                      📱 Te contactaremos vía <span className="text-blue-600">WhatsApp</span> al número{' '}
                      <span className="text-blue-600 font-black">{confirmedBooking?.whatsapp}</span> para confirmar tu visita.
                    </p>
                    
                    {/* Botón para enviar confirmación por WhatsApp */}
                    <motion.a
                      href={`https://wa.me/${BUSINESS_WHATSAPP_API_NUMBER}?text=${encodeURIComponent(whatsappConfirmationMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-black text-sm md:text-base px-6 py-4 rounded-2xl shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Enviar Confirmación por WhatsApp
                    </motion.a>
                  </div>

                  {/* Recomendaciones */}
                  <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 md:p-5 space-y-3 shadow-sm">
                      <p className="text-base md:text-lg font-black text-emerald-700 flex items-center gap-2">
                        <span aria-hidden="true"></span> Recomendaciones para tu visita
                      </p>
                      <p className="text-sm md:text-base font-black text-gray-800">
                        Si tienes dudas o cambios escríbenos al WhatsApp <span className="text-emerald-600">{BUSINESS_WHATSAPP_NUMBER}</span>.
                      </p>
                      <div className="space-y-2 text-sm md:text-base text-gray-700 font-bold">
                        <p className="text-emerald-700 font-black">Cómo prepararte para recibir al piojólogo certificado</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Cabello seco, limpio y sin productos; lávalo el día anterior y llega con el cabello totalmente seco.</li>
                          <li>Cabello desenredado para facilitar la extracción.</li>
                          <li>No aplicar tratamientos antipiojos antes del servicio.</li>
                          <li>Ten un espacio cómodo y una toalla limpia para los hombros.</li>
                          <li>Informa si hay condiciones dermatológicas o alergias.</li>
                          <li>El procedimiento puede tomar entre 30 y 60 minutos.</li>
                          <li>Menores de edad deben estar acompañados por un adulto responsable.</li>
                        </ul>
                      </div>
                      <div className="space-y-2 text-sm md:text-base text-gray-700 font-bold">
                        <p className="text-emerald-700 font-black">Cuidados después de la limpieza</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Lava el cabello después de la limpieza.</li>
                          <li>Cambia ropa de cama y pijamas de los últimos 3 días (usa agua caliente si es posible).</li>
                          <li>Lava y desinfecta peines, cepillos, ligas, gorras y diademas.</li>
                          <li>Evita compartir objetos de cabeza (peines, almohadas, audífonos, bufandas, gorras).</li>
                          <li>Aspira sillones, almohadas, colchones y asientos del vehículo como medida adicional.</li>
                          <li>Haz revisiones semanales en casa.</li>
                          <li>Viste al niño con ropa limpia tras la limpieza.</li>
                        </ul>
                      </div>
                      <p className="text-sm md:text-base font-black text-emerald-700">Gracias por confiar en Chao Piojos </p>
                    </div>
                  </div>

                  {/* Botn para agendar otra cita */}
                  <Button
                    onClick={handleCloseConfirmation}
                    className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-700 hover:to-cyan-700 text-white font-black text-base md:text-lg px-8 md:px-12 py-4 md:py-6 rounded-2xl shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 transition-all duration-200 hover:scale-[1.02]"
                  >
                    <CalendarDays className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                    Agendar Otra Cita
                  </Button>
                </div>
              </motion.div>
            )}
        </div>
      </div>
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open && showConfirmation) {
          handleCloseConfirmation();
        } else if (!open) {
          setIsModalOpen(false);
          setShowForm(false);
          setSelectedSlot('');
          setHasOpenedBoldCheckout(false);
        }
      }}>
        <DialogContent className={`text-[20px] md:text-xl leading-relaxed md:leading-normal bg-gradient-to-b from-blue-50 to-white font-sans ${
          isEmbeddedMobile
            ? '!fixed !inset-0 !translate-x-0 !translate-y-0 !w-full !max-w-none !h-[100dvh] !max-h-[100dvh] !rounded-none flex flex-col overflow-hidden'
            : 'flex flex-col w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none p-0 sm:w-[90%] sm:max-w-4xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl md:rounded-[3rem]'
        }`}>
          <DialogHeader className="pt-8 pb-6 text-center bg-gradient-to-b from-blue-100 to-blue-50 shrink-0">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CalendarDays className="w-8 h-8 text-blue-700" strokeWidth={2.5} />
              <DialogTitle className="font-lobster-two text-3xl md:text-4xl font-bold uppercase text-blue-700 tracking-wide" style={{ WebkitTextStroke: '1px rgba(30, 64, 175, 0.25)' }}>
                Agenda tu Cita
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">{dialogDescriptionText}</DialogDescription>
          </DialogHeader>
          <div
            ref={modalScrollRef}
            className={`relative ${isEmbeddedMobile ? 'flex-1 overflow-y-auto min-h-0 overscroll-contain' : 'flex-1 overflow-y-auto min-h-0'}`}
            style={isEmbeddedMobile ? { WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' } : undefined}
          >
            <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-5">
            {!showForm ? (
              /* Slot selection */
              <div className="space-y-4 pt-2">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full mb-2">
                    <Clock className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-black text-blue-700 uppercase">Selecciona tu Horario</span>
                  </div>
                  <p className="font-lobster-two text-2xl md:text-3xl font-bold text-gray-800">¿A qué hora prefieres?</p>
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
                        <motion.button
                          key={slot}
                          onClick={() => {
                            if (requireAdvance12h) {
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
                            }

                            setSelectedSlot(slot);
                            setShowForm(true);
                          }}
                          whileHover={{ scale: 1.015, y: -4 }}
                          whileTap={{ scale: 0.97 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                          className="group relative bg-white border-4 border-orange-200 hover:border-orange-400 rounded-2xl md:rounded-3xl p-6 md:p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="bg-orange-100 group-hover:bg-orange-500 p-4 rounded-2xl transition-colors">
                                <Clock className="w-8 h-8 md:w-10 md:h-10 text-orange-700 group-hover:text-white transition-colors" />
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
                        </motion.button>
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
              <form id="public-booking-form" className="space-y-5 md:space-y-6 text-[20px] md:text-xl pt-2 pb-4" onSubmit={handleSubmit}>
                {/* Hora seleccionada */}
                <div className="bg-blue-50 border-4 border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-700" />
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase">Hora seleccionada</p>
                      <p className="text-lg md:text-xl font-black text-gray-800">{formatTime12Hour(selectedSlot)}</p>
                    </div>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setSelectedSlot('');
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="text-sm font-bold text-blue-700 hover:text-blue-800 underline transition-colors"
                  >
                    Cambiar
                  </motion.button>
                </div>

                {/* Datos del Cliente */}
                <div className="space-y-3">
                  <p className="font-lobster-two text-2xl md:text-3xl font-bold text-gray-700">👤 Datos del Cliente</p>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Nombre Completo *</label>
                    <input
                      required
                      type="text"
                      name="name"
                      className={`w-full rounded-xl md:rounded-2xl border-2 ${fieldErrors.name ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-blue-50'} px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none ${fieldErrors.name ? 'focus:border-red-500' : 'focus:border-blue-500'} text-base md:text-lg`}
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Ej: Ana Pérez García"
                    />
                    {fieldErrors.name && (
                      <p className="text-red-600 text-sm font-bold ml-2 mt-1 flex items-center gap-1">
                        <span>❌</span> {fieldErrors.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">👥 Número de Personas *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="10"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-blue-500 text-base md:text-lg"
                      value={form.numPersonas}
                      onChange={(e) => {
                        const numPersonas = parseInt(e.target.value) || 1;
                        const newServicesPerPerson = Array(numPersonas).fill(null).map((_, idx) => 
                          form.servicesPerPerson[idx] || serviceOptions[0]?.value || 'Normal'
                        );
                        setForm({
                          ...form,
                          numPersonas: e.target.value,
                          servicesPerPerson: newServicesPerPerson
                        });
                      }}
                      placeholder="1"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">🎂 Edad de la(s) Persona(s) que Recibirán el Servicio *</label>
                    <input
                      required
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-blue-200 bg-blue-50 px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-blue-500 text-base md:text-lg"
                      value={form.edad}
                      onChange={(e) => handleChange('edad', e.target.value)}
                      placeholder="Ej: 4 y 9, o 25"
                    />
                  </div>

                  {/* Niveles de Infestación por Persona */}
                  <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                    <p className="text-base md:text-lg font-black text-slate-700 uppercase tracking-wide">💆 Nivel de Infestación por Persona</p>
                    {Array(parseInt(form.numPersonas) || 1).fill(null).map((_, idx) => (
                      <div key={idx} className="space-y-1">
                        <label className="text-sm md:text-base font-bold text-gray-700 ml-2 mb-1 block">
                          {parseInt(form.numPersonas) === 1 
                            ? 'Nivel de Infestación *' 
                            : `Nivel de Infestación para la ${idx === 0 ? 'primera' : idx === 1 ? 'segunda' : idx === 2 ? 'tercera' : idx === 3 ? 'cuarta' : idx === 4 ? 'quinta' : `persona ${idx + 1}`} *`
                          }
                        </label>
                        <select
                          required
                          className="w-full rounded-xl md:rounded-2xl border-2 border-slate-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-slate-500 text-base md:text-lg cursor-pointer"
                          value={form.servicesPerPerson[idx] || serviceOptions[0]?.value}
                          onChange={(e) => {
                            const newServices = [...form.servicesPerPerson];
                            newServices[idx] = e.target.value;
                            setForm({ ...form, servicesPerPerson: newServices });
                          }}
                        >
                          {serviceOptions.map((service) => (
                            <option key={service.value} value={service.value}>
                              {service.label} · {formatCurrency(service.amount)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    {/* Mostrar Total */}
                    <div className="space-y-2">
                      <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 rounded-xl shadow-lg border-2 border-green-400">
                        <div className="flex items-center justify-between">
                            <span className="text-white font-black text-base md:text-lg uppercase">💰 Total del Servicio:</span>
                            <span className="text-white font-black text-xl md:text-2xl">{formatCurrency(totalServiceValue)}</span>
                          </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Contacto del Cliente */}
                <div className="bg-[#eef5fb] p-4 rounded-2xl border-2 border-[#c8dceb] space-y-3">
                  <p className="font-lobster-two text-2xl md:text-3xl font-bold text-blue-600">Contacto</p>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">WhatsApp *</label>
                    <input
                      required
                      type="tel"
                      name="whatsapp"
                      pattern="[0-9]{10}"
                      maxLength="10"
                      className={`w-full rounded-xl md:rounded-2xl border-2 ${fieldErrors.whatsapp ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-white'} px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none ${fieldErrors.whatsapp ? 'focus:border-red-500' : 'focus:border-blue-400'} text-base md:text-lg`}
                      value={form.whatsapp}
                      onChange={(e) => {
                        // Solo permitir números
                        const value = e.target.value.replace(/\D/g, '');
                        handleChange('whatsapp', value);
                      }}
                      placeholder="3001234567"
                    />
                    {fieldErrors.whatsapp && (
                      <p className="text-red-600 text-sm font-bold ml-2 mt-1 flex items-center gap-1">
                        <span>❌</span> {fieldErrors.whatsapp}
                      </p>
                    )}
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
                  
                  {/* Código de Referido */}
                  {sellerReferralContext.isActive ? (
                    <div className="space-y-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-base md:text-lg font-black text-emerald-700">Peluquería vinculada al link</p>
                      <p className="text-sm md:text-base font-bold text-gray-700">
                        Peluquería: <span className="text-emerald-700">{sellerReferralContext.businessName}</span>
                      </p>
                      <p className="text-sm md:text-base font-bold text-gray-700">
                        Vendedor: <span className="text-emerald-700">{sellerReferralContext.sellerName}</span>
                      </p>
                      <p className="text-xs md:text-sm font-bold text-emerald-700">
                        Este agendamiento quedará asociado automáticamente a esa peluquería y a ese vendedor.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">
                        🎁 Código de Referido <span className="text-sm text-gray-500 font-normal">(opcional)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className={`w-full rounded-xl md:rounded-2xl border-2 ${
                            referralValidation.isValid 
                              ? 'border-green-400 bg-green-50' 
                              : referralCode && !referralValidation.isValid && !referralValidation.isValidating
                              ? 'border-red-400 bg-red-50'
                              : 'border-slate-200 bg-slate-50'
                          } px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none ${
                            referralValidation.isValid 
                              ? 'focus:border-green-500' 
                              : 'focus:border-slate-500'
                          } text-base md:text-lg uppercase`}
                          value={referralCode}
                          onChange={(e) => {
                            const code = e.target.value.toUpperCase();
                            setReferralCode(code);
                            if (code.length >= 4) {
                              validateReferralCode(code);
                            } else {
                              setReferralValidation({ isValid: false, isValidating: false, message: '', referrerName: '', referrerRoleLabel: '' });
                            }
                          }}
                          placeholder="Ingresa el código de referido"
                        />
                        {referralValidation.isValidating && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-slate-600"></div>
                          </div>
                        )}
                        {referralValidation.isValid && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-600">
                            ✓
                          </div>
                        )}
                      </div>
                      {referralValidation.message && (
                        <p className={`text-sm font-bold ml-2 mt-1 flex items-center gap-1 ${
                          referralValidation.isValid ? 'text-green-600' : 'text-red-600'
                        }`}>
                          <span>{referralValidation.isValid ? '✨' : '❌'}</span> {referralValidation.message}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">📍 Dirección *</label>
                    <AddressAutocomplete
                      value={form.direccion}
                      onChange={(value) => handleChange('direccion', value)}
                      hasError={!!fieldErrors.direccion}
                      forceRedStyle={true}
                      onSelect={(suggestion) => {
                        handleChange('direccion', suggestion.fullName);
                        // Guardar coordenadas
                        if (suggestion.lat && suggestion.lng) {
                          setForm(prev => ({
                            ...prev,
                            direccion: suggestion.fullName,
                            lat: suggestion.lat,
                            lng: suggestion.lng
                          }));
                        }
                        toast({
                          title: '📍 Dirección seleccionada',
                          description: suggestion.name,
                          className: 'bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl font-bold'
                        });
                      }}
                    />
                    {fieldErrors.direccion && (
                      <p className="text-red-600 text-sm font-bold ml-2 mt-1 flex items-center gap-1">
                        <span>❌</span> {fieldErrors.direccion}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">🏘️ Barrio</label>
                    <input
                      type="text"
                      name="barrio"
                      className={`w-full rounded-xl md:rounded-2xl border-2 ${fieldErrors.barrio ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-white'} px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none ${fieldErrors.barrio ? 'focus:border-red-500' : 'focus:border-blue-400'} text-base md:text-lg`}
                      value={form.barrio}
                      onChange={(e) => handleChange('barrio', e.target.value)}
                      placeholder="Ej: Centro"
                    />
                    {fieldErrors.barrio && (
                      <p className="text-red-600 text-sm font-bold ml-2 mt-1 flex items-center gap-1">
                        <span>❌</span> {fieldErrors.barrio}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">🏢 Descripción de la ubicación</label>
                    <input
                      type="text"
                      name="descripcionUbicacion"
                      className={`w-full rounded-xl md:rounded-2xl border-2 ${fieldErrors.descripcionUbicacion ? 'border-red-400 bg-red-50' : 'border-blue-200 bg-white'} px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none ${fieldErrors.descripcionUbicacion ? 'focus:border-red-500' : 'focus:border-blue-400'} text-base md:text-lg`}
                      value={form.descripcionUbicacion}
                      onChange={(e) => handleChange('descripcionUbicacion', e.target.value)}
                      placeholder="Ej: Conjunto La Esperanza, Apto 302, Torre 3"
                    />
                    {fieldErrors.descripcionUbicacion && (
                      <p className="text-red-600 text-sm font-bold ml-2 mt-1 flex items-center gap-1">
                        <span>❌</span> {fieldErrors.descripcionUbicacion}
                      </p>
                    )}
                  </div>
                </div>

                {/* Datos de Salud */}
                <div className="bg-[#f8f3f3] p-4 rounded-2xl border-2 border-[#e2d7d7] space-y-3">
                  <p className="font-lobster-two text-2xl md:text-3xl font-bold text-red-600">Datos de Salud</p>
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
                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 space-y-3">
                  <p className="font-lobster-two text-2xl md:text-3xl font-bold text-slate-700">Referencias</p>
                  <div className="space-y-1">
                    <label className="text-base md:text-lg font-bold text-gray-700 ml-2 mb-1 block">Referido Por (opcional)</label>
                    <input
                      type="text"
                      className="w-full rounded-xl md:rounded-2xl border-2 border-slate-200 bg-white px-4 md:px-5 py-3 md:py-4 font-bold text-gray-800 focus:outline-none focus:border-slate-500 text-base md:text-lg"
                      value={form.referidoPor}
                      onChange={(e) => handleChange('referidoPor', e.target.value)}
                      placeholder="Nombre o fuente"
                    />
                  </div>
                </div>

                {/* Pago */}
                <div className="bg-amber-50 p-4 rounded-2xl border-2 border-amber-200 space-y-3">
                  <p className="font-lobster-two text-2xl md:text-3xl font-bold text-amber-700">Pago</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleChange('paymentMethod', 'pay_now')}
                      className={`w-full text-left rounded-xl md:rounded-2xl border-2 p-4 font-black transition-all ${
                        form.paymentMethod === 'pay_now'
                          ? 'bg-orange-100 border-orange-300 shadow-md'
                          : 'bg-white border-amber-200 hover:border-orange-300'
                      }`}
                    >
                      <p className="text-base md:text-lg text-gray-800">⚡ Pagar ahora</p>
                      <p className="text-sm text-gray-600 font-bold mt-1">Genera un link dinámico con Bold por {formatCurrency(finalTotal)}</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChange('paymentMethod', 'pay_later')}
                      className={`w-full text-left rounded-xl md:rounded-2xl border-2 p-4 font-black transition-all ${
                        form.paymentMethod === 'pay_later'
                          ? 'bg-green-100 border-green-300 shadow-md'
                          : 'bg-white border-amber-200 hover:border-green-300'
                      }`}
                    >
                      <p className="text-base md:text-lg text-gray-800">⏳ Pagar después</p>
                      <p className="text-sm text-gray-600 font-bold mt-1">El pago se realiza al finalizar el servicio</p>
                    </button>
                  </div>

                  {form.paymentMethod === 'pay_now' && (
                    <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-1 flex-1">
                        <p className="text-xs uppercase tracking-wide text-amber-600 font-black">Paga seguro con Bold</p>
                        <p className="text-base md:text-lg font-black text-gray-800">
                          Total a pagar <span className="text-amber-600">• {formatCurrency(finalTotal)}</span>
                        </p>
                        {hasOpenedBoldCheckout ? (
                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-2 text-green-700 text-xs font-black inline-flex items-center gap-2 mt-1">
                            ✅ Link de pago abierto. Ya puedes confirmar la reserva.
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-gray-600 font-bold">Se abrirá una pestaña con el checkout de Bold.</p>
                            <p className="text-xs text-orange-600 font-black">Debes abrir Bold para habilitar la confirmación.</p>
                          </>
                        )}
                      </div>

                      <Button
                        type="button"
                        onClick={handleGoToBold}
                        disabled={isGeneratingBoldLink}
                        className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-black px-6 py-4 rounded-xl shadow-md border-b-4 border-orange-600 active:border-b-0 active:translate-y-0.5 transition"
                      >
                        {isGeneratingBoldLink ? 'Generando link...' : 'Ir a Bold'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Términos */}
                <div className={`p-4 rounded-2xl border-2 ${fieldErrors.terminosAceptados ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terminosAceptados"
                      name="terminosAceptados"
                      checked={form.terminosAceptados}
                      onChange={(e) => handleChange('terminosAceptados', e.target.checked)}
                      className={`w-5 h-5 rounded border-2 ${fieldErrors.terminosAceptados ? 'border-red-400' : 'border-green-300'} mt-1`}
                    />
                    <label htmlFor="terminosAceptados" className="font-bold text-gray-700 cursor-pointer text-xs md:text-sm">
                      ✅ Acepto los términos y condiciones del servicio junto con la política de bioseguridad.
                    </label>
                  </div>
                  {fieldErrors.terminosAceptados && (
                    <p className="text-red-600 text-sm font-bold ml-8 mt-2 flex items-center gap-1">
                      <span>❌</span> {fieldErrors.terminosAceptados}
                    </p>
                  )}
                </div>

                <p className="text-sm md:text-base text-gray-500 font-bold text-center">
                  Al reservar aceptas ser contactado por WhatsApp para confirmar la visita.
                </p>
              </form>
            )}
            </div>
          </div>
          {showForm && (
            <div className={`${isEmbeddedMobile ? '' : 'shrink-0'} border-t border-blue-200 bg-white px-4 md:px-6 lg:px-8 py-4 shadow-[0_-8px_24px_rgba(59,130,246,0.12)]`}>
              <Button
                form="public-booking-form"
                type="submit"
                disabled={isSubmitting || (form.paymentMethod === 'pay_now' && !hasOpenedBoldCheckout)}
                className="font-lobster-two w-full bg-orange-500 hover:bg-orange-600 disabled:hover:bg-orange-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-xl md:text-2xl py-4 md:py-5 rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl border-b-4 border-orange-700 active:border-b-0 active:translate-y-0.5 transition-all duration-200 hover:scale-[1.01]"
              >
                <Check className="w-5 h-5 md:w-6 md:h-6 mr-2" /> {isSubmitting ? 'Procesando...' : 'Confirmar Reserva'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
      <Toaster />
    </>
  );
};

export default PublicBooking;
