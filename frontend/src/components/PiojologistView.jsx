import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Check, X, Zap, DollarSign, Clock3, CalendarClock, Users, BarChart3, LineChart, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { bookingService, referralService } from '@/lib/api';

const ASSIGNED_AT_STORAGE_KEY = 'piojoAssignedAtMap';

const loadAssignedAtFromStorage = () => {
  try {
    const saved = localStorage.getItem(ASSIGNED_AT_STORAGE_KEY);
    if (!saved) return new Map();
    const parsed = JSON.parse(saved);
    return new Map(parsed.map(([id, ts]) => [id, new Date(ts)]));
  } catch (e) {
    console.error('No se pudo cargar tiempos de asignación locales', e);
    return new Map();
  }
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const ScheduleCalendar = lazy(() => import('@/components/ScheduleCalendar'));
const ProductRequestView = lazy(() => import('@/components/ProductRequestView'));
const HistoryTab = lazy(() => import('@/components/piojologist/HistoryTab'));
const ReferralsTab = lazy(() => import('@/components/piojologist/ReferralsTab'));

const PiojologistView = ({ currentUser, appointments, updateAppointments, bookings = [], updateBookings, products, handleCompleteService, serviceCatalog = {}, formatCurrency, productRequests, onCreateProductRequest, onNotify }) => {
  const { toast } = useToast();
  const [, setForceUpdate] = useState(0);
  
  // Función para convertir hora 24h a 12h con AM/PM
  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    try {
      const [hours, minutes] = time24.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (e) {
      return time24; // Retorna el formato original si hay error
    }
  };

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [finishingAppointmentId, setFinishingAppointmentId] = useState(null);
  const [finishingPlansPerPerson, setFinishingPlansPerPerson] = useState([]);
  const [finishingPricesPerPerson, setFinishingPricesPerPerson] = useState([]);
  const [finishingNotes, setFinishingNotes] = useState('');
  const [finishingAdditionalCosts, setFinishingAdditionalCosts] = useState('');
  const [servicesView, setServicesView] = useState(() => localStorage.getItem('piojoServicesView') || 'assigned'); // assigned | rejected
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('piojoTab') || 'panel');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const releaseRequestsRef = useRef(new Set());
  const assignedAtFallbackRef = useRef(loadAssignedAtFromStorage());
  
  // Estados para diálogo de confirmación de rechazo
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [appointmentToReject, setAppointmentToReject] = useState(null);
  
  // Estado para modal de desglose de servicios
  const [serviceBreakdownOpen, setServiceBreakdownOpen] = useState(false);
  const [selectedServiceBreakdown, setSelectedServiceBreakdown] = useState(null);

  // Referral state
  const [referralCommissions, setReferralCommissions] = useState([]);
  const [myReferrals, setMyReferrals] = useState([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const persistAssignedFallback = () => {
    try {
      const entries = Array.from(assignedAtFallbackRef.current.entries()).map(([id, date]) => [id, date.toISOString()]);
      localStorage.setItem(ASSIGNED_AT_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('No se pudo guardar tiempos de asignación locales', e);
    }
  };

  // Mantener referencia a la hora actual para los contadores
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Escuchar eventos de asignación de servicios para actualización en tiempo real
  useEffect(() => {
    const handleServiceAssigned = async (event) => {
      const { piojologistId, appointment } = event.detail;
      
      // Solo procesar si el servicio fue asignado a esta piojóloga
      if (piojologistId === currentUser.id) {
        // Forzar re-render para que se actualicen las listas
        setForceUpdate(prev => prev + 1);
        
        // Mostrar notificación visual
        toast({
          title: "🎉 ¡Nuevo Servicio Asignado!",
          description: `${appointment?.clientName || 'Cliente'} - ${appointment?.serviceType || 'Servicio'}`,
          className: "bg-green-100 border-2 border-green-200 text-green-800 rounded-2xl font-bold"
        });
      }
    };

    // Escuchar cambios en localStorage desde otros tabs/ventanas
    const handleStorageChange = (event) => {
      // Detectar cambios en appointments o bookings desde otro tab
      if (event.key === 'appointments' || event.key === 'bookings') {
        try {
          // Recargar datos desde localStorage
          if (event.key === 'appointments' && event.newValue) {
            const newAppointments = JSON.parse(event.newValue);
            // Verificar si hay nuevas asignaciones para esta piojóloga
            const myNewAssignments = newAppointments.filter(
              apt => apt.piojologistId === currentUser.id && 
              (apt.status === 'assigned' || apt.status === 'pending')
            );
            if (myNewAssignments.length > 0 && updateAppointments) {
              updateAppointments(newAppointments);
            }
          } else if (event.key === 'bookings' && event.newValue) {
            const newBookings = JSON.parse(event.newValue);
            // Verificar si hay nuevas asignaciones para esta piojóloga
            const myNewAssignments = newBookings.filter(
              apt => apt.piojologistId === currentUser.id && 
              (apt.status === 'assigned' || apt.status === 'pending')
            );
            if (myNewAssignments.length > 0 && updateBookings) {
              updateBookings(newBookings);
            }
          }
          
          // Forzar re-render
          setForceUpdate(prev => prev + 1);
        } catch (e) {
          console.error('Error al procesar cambios de storage:', e);
        }
      }
    };

    // Escuchar el evento personalizado (misma ventana)
    window.addEventListener('serviceAssigned', handleServiceAssigned);
    
    // Escuchar cambios en localStorage (otros tabs)
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('serviceAssigned', handleServiceAssigned);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [currentUser.id, toast, updateAppointments, updateBookings]);

  useEffect(() => {
    localStorage.setItem('piojoServicesView', servicesView);
  }, [servicesView]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    localStorage.setItem('piojoTab', value);
  };

  const handleAutoUnassign = async (apt) => {
    if (!apt || apt.status !== 'assigned') return;
    const backendId = apt.backendId || apt.bookingId || apt.id;

    try {
      if (apt?.isPublicBooking || apt?.backendId || apt?.id?.toString().startsWith('booking-')) {
        await bookingService.update(backendId, {
          status: 'pending',
          piojologistId: null,
          piojologistName: null
        });
      }

      if (apt?.isPublicBooking) {
        const updatedBookings = bookings.map((b) =>
          (b.id === apt.id || b.backendId === apt.backendId || b.bookingId === apt.bookingId)
            ? { ...b, status: 'pending', piojologistId: null, piojologistName: null }
            : b
        );
        updateBookings && updateBookings(updatedBookings);
      } else {
        const updatedAppointments = appointments
          .filter((a) => !a.isPublicBooking)
          .map((a) =>
            (a.id === apt.id || a.backendId === apt.backendId || a.bookingId === apt.bookingId)
              ? { ...a, status: 'pending', piojologistId: null, piojologistName: null }
              : a
          );
        updateAppointments(updatedAppointments);
      }

      toast({
        title: '⏳ Tiempo agotado',
        description: 'El servicio se liberó para reasignación.',
        className: 'bg-yellow-100 border-2 border-yellow-200 text-yellow-800 rounded-2xl font-bold'
      });
    } catch (error) {
      console.error('Error al liberar asignación por tiempo:', error);
    } finally {
      releaseRequestsRef.current.delete(apt.id);
      clearAssignmentFallback(apt.id);
    }
  };

  useEffect(() => {
    setIsNavOpen(false);
  }, [activeTab]);

  // Cargar datos de referidos cuando se cambia a la pestaña de referidos
  useEffect(() => {
    if (activeTab === 'referrals') {
      loadReferralData();
    }
  }, [activeTab]);

  const loadReferralData = async () => {
    setLoadingReferrals(true);
    try {
      const [commissionsResult, referralsResult] = await Promise.all([
        referralService.getMyCommissions(),
        referralService.getMyReferrals()
      ]);

      if (commissionsResult.success) {
        setReferralCommissions(commissionsResult.data.commissions || []);
      }

      if (referralsResult.success) {
        setMyReferrals(referralsResult.data.referrals || []);
      }
    } catch (error) {
      console.error('Error cargando datos de referidos:', error);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const copyReferralCode = () => {
    if (currentUser.referral_code) {
      const code = currentUser.referral_code;
      const piojologistName = currentUser.name || 'tu piojologa';
      const message =
        `\u00a1Holaa! \ud83d\udc4b mi nombre es ${piojologistName} y tengo algo especial para ti \u2728\n\n` +
        `\ud83d\udcf1 Usa mi codigo: ${code}\n\n` +
        `\ud83c\udf10 Agenda aqui: https://app.chaopiojos.com/agenda?ref=${code}\n\n` +
        `\u00a1Te espero! \ud83d\udc9c`;
      navigator.clipboard.writeText(message);
      setCopiedCode(true);
      toast({
        title: "✨ ¡Mensaje copiado!",
        description: "Ahora puedes compartirlo con tus clientes",
        className: "bg-purple-100 border-2 border-purple-200 text-purple-800 rounded-2xl font-bold"
      });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getServicePrice = (apt = {}) => {
    // Priorizar siempre el valor confirmado/guardado en la reserva
    const raw = apt.price ?? apt.price_confirmed ?? apt.estimatedPrice;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) return num;

    // Fallback: calcular por servicios por persona si no hay precio confirmado
    if (apt.services_per_person && Array.isArray(apt.services_per_person)) {
      return apt.services_per_person.reduce((sum, serviceType) => {
        return sum + (serviceCatalog[serviceType] || 0);
      }, 0);
    }

    return Number(serviceCatalog[apt.serviceType] || 0);
  };

  const getPerServiceBreakdown = (apt = {}, rate = 0) => {
    const servicesPerPerson = Array.isArray(apt.services_per_person) ? apt.services_per_person : [];
    if (servicesPerPerson.length > 0) {
      const breakdown = servicesPerPerson.map((serviceName, idx) => {
        const basePrice = Number(serviceCatalog?.[serviceName] || 0);
        return {
          idx,
          serviceName,
          basePrice,
          commission: basePrice * rate
        };
      });

      const sumBase = breakdown.reduce((acc, item) => acc + item.basePrice, 0);
      if (sumBase > 0) return breakdown;

      const fallbackPerPerson = Number(getServicePrice(apt) || 0) / servicesPerPerson.length;
      return breakdown.map((item) => ({
        ...item,
        basePrice: fallbackPerPerson,
        commission: fallbackPerPerson * rate
      }));
    }

    const fallbackPrice = Number(getServicePrice(apt) || 0);
    return [{
      idx: 0,
      serviceName: apt.serviceType || 'Servicio',
      basePrice: fallbackPrice,
      commission: fallbackPrice * rate
    }];
  };

  const getPiojologistShareByService = (apt = {}, rate = 0.5) => {
    return getPerServiceBreakdown(apt, rate)
      .reduce((sum, item) => sum + Number(item.commission || 0), 0);
  };

  const getAssignmentTime = (apt = {}) => {
    const raw = apt.assignedAt || apt.assigned_at || apt.createdAt || apt.created_at;
    if (raw) return new Date(raw);
    if (!assignedAtFallbackRef.current.has(apt.id)) {
      assignedAtFallbackRef.current.set(apt.id, new Date());
      persistAssignedFallback();
    }
    return assignedAtFallbackRef.current.get(apt.id);
  };

  const clearAssignmentFallback = (aptId) => {
    if (assignedAtFallbackRef.current.has(aptId)) {
      assignedAtFallbackRef.current.delete(aptId);
      persistAssignedFallback();
    }
  };

  const getResponseDeadline = (apt = {}) => {
    const assignmentTime = getAssignmentTime(apt);
    const deadline = new Date(assignmentTime.getTime() + 2 * 60 * 60 * 1000); // 2 horas desde asignación
    return deadline;
  };

  const formatCountdown = (deadline) => {
    const diff = deadline.getTime() - nowTs;
    if (diff <= 0) return '00:00:00';
    let seconds = Math.floor(diff / 1000);
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds - minutes * 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  };

  const handleAccept = async (appointmentId) => {
    const appointment = appointments.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId);
    const backendId = appointment?.backendId || appointment?.bookingId || appointmentId;
    
    try {
      // Actualizar en el backend
      if (appointment?.isPublicBooking || appointment?.backendId || appointmentId?.toString().startsWith('booking-')) {
        const result = await bookingService.update(backendId, {
          status: 'accepted'
        });

        if (!result.success) {
          toast({
            title: "Error",
            description: result.message || "No se pudo aceptar el agendamiento",
            variant: "destructive",
            className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
          });
          return;
        }
      }

      // Actualizar estado local
      if (appointment?.isPublicBooking) {
        const updatedBookings = bookings.map(apt => 
          (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) ? { ...apt, status: 'accepted' } : apt
        );
        updateBookings && updateBookings(updatedBookings);
      } else {
        const updatedAppointments = appointments
          .filter(a => !a.isPublicBooking)
          .map(apt => (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) ? { ...apt, status: 'accepted' } : apt);
        updateAppointments(updatedAppointments);
      }
      
      // Notify admins about acceptance
      if (onNotify) {
        onNotify({
          type: 'accepted',
          appointmentId: appointmentId,
          piojologistId: currentUser.id,
          piojologistName: currentUser.name,
          message: `${currentUser.name} aceptó el agendamiento de ${appointment?.clientName}`,
          appointment: appointment
        });
      }
      
      toast({
        title: "¡Misión Aceptada! ⭐",
        description: "¡A cazar piojitos!",
        className: "bg-green-100 border-2 border-green-200 text-green-700 rounded-2xl font-bold"
      });
      clearAssignmentFallback(appointmentId);
    } catch (error) {
      console.error('Error al aceptar agendamiento:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al aceptar el agendamiento",
        variant: "destructive",
        className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
      });
    }
  };

  const handleReject = (appointmentId) => {
    const appointment = appointments.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId);
    setAppointmentToReject(appointment);
    setRejectDialogOpen(true);
  };
  
  const handleConfirmReject = async () => {
    if (!appointmentToReject) return;
    
    const appointmentId = appointmentToReject.id;
    const backendId = appointmentToReject.backendId || appointmentToReject.bookingId || appointmentId;
    const addRejectionHistory = (apt) => {
      const history = Array.isArray(apt.rejectionHistory) ? apt.rejectionHistory : [];
      return [...history, currentUser.name];
    };
    
    // Cerrar diálogo
    setRejectDialogOpen(false);
    
    try {
      // Actualizar en el backend devolviendo a pendiente
      if (appointmentToReject?.isPublicBooking || appointmentToReject?.backendId || appointmentId?.toString().startsWith('booking-')) {
        const rejectionHistory = addRejectionHistory(appointmentToReject);
        const result = await bookingService.update(backendId, {
          status: 'pending',
          piojologistId: null,
          rejection_history: rejectionHistory
        });

        if (!result.success) {
          toast({
            title: "Error",
            description: result.message || "No se pudo rechazar el agendamiento",
            variant: "destructive",
            className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
          });
          return;
        }
      }

      // Actualizar estado local
      if (appointmentToReject?.isPublicBooking) {
        const rejectionHistory = addRejectionHistory(appointmentToReject);
        const updatedBookings = bookings.map(apt => 
          (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
            ? { ...apt, status: 'pending', piojologistId: null, piojologistName: null, rejectionHistory } 
            : apt
        );
        updateBookings && updateBookings(updatedBookings);
      } else {
        const rejectionHistory = addRejectionHistory(appointmentToReject);
        const updatedAppointments = appointments
          .filter(a => !a.isPublicBooking)
          .map(apt => (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
            ? { ...apt, status: 'pending', piojologistId: null, piojologistName: null, rejectionHistory } 
            : apt);
        updateAppointments(updatedAppointments);
      }
      
      // Notify admins about rejection so they can reassign
      if (onNotify) {
        onNotify({
          type: 'rejected',
          appointmentId: appointmentId,
          piojologistId: currentUser.id,
          piojologistName: currentUser.name,
          message: `${currentUser.name} rechazó el agendamiento de ${appointmentToReject?.clientName}. Necesita reasignación.`,
          appointment: appointmentToReject
        });
      }
      
      toast({ 
        title: "Misión rechazada 🙅", 
        description: "El agendamiento regresó a pendientes para reasignación.",
        className: "bg-red-100 rounded-2xl border-2 border-red-200 text-red-700 font-bold" 
      });
      clearAssignmentFallback(appointmentId);
    } catch (error) {
      console.error('Error al rechazar agendamiento:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al rechazar el agendamiento",
        variant: "destructive",
        className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
      });
    } finally {
      setAppointmentToReject(null);
    }
  };
  
  const openGoogleMaps = (direccion, barrio, lat, lng) => {
    // Si hay coordenadas, abrir con ubicación exacta
    if (lat && lng) {
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      window.open(url, '_blank');
      return;
    }
    
    // Fallback: usar dirección como texto si no hay coordenadas
    if (!direccion && !barrio) return;
    const query = encodeURIComponent(`${direccion || ''} ${barrio || ''} Bogotá Colombia`.trim());
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  };
  
  const handleCancelReject = () => {
    setRejectDialogOpen(false);
    setAppointmentToReject(null);
  };

  const onCompleteService = async () => {
    if (!finishingAppointmentId) return;

    const priceValue = finishingTotalPrice;
    const additionalCostsValue = parseFloat(finishingAdditionalCosts || '0');
    if (!finishingPlansPerPerson.length || finishingPlansPerPerson.some((plan) => !plan)) {
      toast({ title: 'Selecciona un plan por persona', className: 'bg-red-100 border-2 border-red-200 text-red-700 font-bold' });
      return;
    }
    if (
      finishingPricesPerPerson.length !== finishingPlansPerPerson.length ||
      finishingPricesPerPerson.some((price) => isNaN(Number(price)) || Number(price) <= 0)
    ) {
      toast({ title: 'Ingresa un valor valido por persona', className: 'bg-red-100 border-2 border-red-200 text-red-700 font-bold' });
      return;
    }

    const uniquePlans = Array.from(new Set(finishingPlansPerPerson));
    const resolvedPlanType = uniquePlans.length === 1 ? uniquePlans[0] : 'Mixto';

    await handleCompleteService(finishingAppointmentId, selectedProducts, {
      planType: resolvedPlanType,
      priceConfirmed: priceValue,
      servicesPerPerson: finishingPlansPerPerson,
      pricesPerPerson: finishingPricesPerPerson.map((price) => Number(price) || 0),
      notes: finishingNotes,
      additionalCosts: additionalCostsValue
    });
    
    setFinishingAppointmentId(null);
    setSelectedProducts([]);
    setFinishingPlansPerPerson([]);
    setFinishingPricesPerPerson([]);
    setFinishingNotes('');
    setFinishingAdditionalCosts('');
    toast({
      title: "Victoria total",
      description: "Servicio completado y ganancias registradas.",
      className: "bg-yellow-100 border-2 border-yellow-200 text-yellow-800 rounded-2xl font-bold"
    });
  };

  const normalizeHistory = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        return value.split(',').map(v => v.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const pendingAssignments = useMemo(
    () => appointments.filter((apt) => apt.piojologistId === currentUser.id && (apt.status === 'assigned' || apt.status === 'pending')),
    [appointments, currentUser.id]
  );
  const servicePlanOptions = useMemo(() => {
    const plans = Object.keys(serviceCatalog || {});
    return plans.length ? plans : ['Normal'];
  }, [serviceCatalog]);
  const getPeopleCount = (apt = {}) => Math.max(1, Number(apt.numPersonas) || 1);
  const getPlanPrice = (planName) => Number(serviceCatalog[planName]) || 0;
  const buildInitialPlansForAppointment = (apt = {}) => {
    const people = getPeopleCount(apt);
    const basePreferredPlan = apt.planType || apt.serviceType || servicePlanOptions[0];
    const fallbackPlan = servicePlanOptions.includes(basePreferredPlan) ? basePreferredPlan : servicePlanOptions[0];
    const incomingServices = Array.isArray(apt.services_per_person) ? apt.services_per_person : [];
    return Array.from({ length: people }, (_, idx) => {
      const candidate = incomingServices[idx] || fallbackPlan;
      return servicePlanOptions.includes(candidate) ? candidate : fallbackPlan;
    });
  };
  const buildInitialPricesFromPlans = (plans = []) => plans.map((planName) => String(getPlanPrice(planName)));
  const finishingTotalPrice = finishingPricesPerPerson.reduce((sum, price) => sum + (Number(price) || 0), 0);
  const setPersonPlanAndPrice = (index, selectedPlan) => {
    setFinishingPlansPerPerson((prev) => {
      const nextPlans = [...prev];
      nextPlans[index] = selectedPlan;
      return nextPlans;
    });
    setFinishingPricesPerPerson((prev) => {
      const nextPrices = [...prev];
      nextPrices[index] = String(getPlanPrice(selectedPlan));
      return nextPrices;
    });
  };
  const assignedToMe = useMemo(
    () => appointments.filter((apt) => apt.piojologistId === currentUser.id && (apt.status === 'accepted' || apt.status === 'confirmed')),
    [appointments, currentUser.id]
  );
  const myCalendarAppointments = useMemo(
    () => appointments.filter((apt) => apt.piojologistId === currentUser.id && apt.status !== 'cancelled'),
    [appointments, currentUser.id]
  );
  const completedHistory = useMemo(
    () => appointments.filter((apt) => apt.piojologistId === currentUser.id && apt.status === 'completed'),
    [appointments, currentUser.id]
  );
  const myRejectedServices = useMemo(
    () => appointments.filter((apt) => normalizeHistory(apt.rejectionHistory || apt.rejection_history || apt.rejections).includes(currentUser.name)),
    [appointments, currentUser.name]
  );
  const visibleServices = useMemo(
    () => (servicesView === 'rejected' ? myRejectedServices : assignedToMe),
    [servicesView, myRejectedServices, assignedToMe]
  );

  const commissionRate = (currentUser.commission_rate || 50) / 100;

  const totalEarnings = useMemo(() => (
    completedHistory.filter((apt) => {
      const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
      return paymentStatus === 'pending';
    })
    .reduce((acc, apt) => acc + (getPiojologistShareByService(apt, commissionRate) - (Number(apt.deductions) || 0)), 0)
  ), [completedHistory, commissionRate, serviceCatalog]);

  useEffect(() => {
    pendingAssignments.forEach((apt) => {
      const deadline = getResponseDeadline(apt);
      const diff = deadline.getTime() - nowTs;
      if (diff <= 0 && !releaseRequestsRef.current.has(apt.id)) {
        releaseRequestsRef.current.add(apt.id);
        handleAutoUnassign(apt);
      }
    });
  }, [pendingAssignments, nowTs]);

  const statusCounts = useMemo(() => ({
    pendiente: appointments.filter((a) => a.piojologistId === currentUser.id && a.status === 'pending').length,
    asignado: appointments.filter((a) => a.piojologistId === currentUser.id && a.status === 'assigned').length,
    aceptado: appointments.filter((a) => a.piojologistId === currentUser.id && a.status === 'accepted').length,
    completado: completedHistory.length
  }), [appointments, currentUser.id, completedHistory.length]);

  const earningsBarData = useMemo(() => {
    const earningsByMonthMap = completedHistory.reduce((acc, apt) => {
      const date = apt.date ? new Date(apt.date) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const net = getPiojologistShareByService(apt, commissionRate) - (Number(apt.deductions) || 0);
      acc[key] = (acc[key] || 0) + net;
      return acc;
    }, {});

    const monthKeys = Object.keys(earningsByMonthMap).sort().slice(-6);
    const earningsLabels = monthKeys.map((key) => {
      const [year, month] = key.split('-');
      return new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', { month: 'short' });
    });
    const earningsValues = monthKeys.map((key) => earningsByMonthMap[key]);

    return {
      labels: earningsLabels,
      datasets: [
        {
          label: 'Ganancias',
          data: earningsValues,
          backgroundColor: '#f97316',
          borderRadius: 12
        }
      ]
    };
  }, [completedHistory, commissionRate, serviceCatalog]);

  const statusPieData = useMemo(() => ({
    labels: ['Pendientes', 'Asignados', 'Aceptados', 'Completados'],
    datasets: [
      {
        data: [statusCounts.pendiente, statusCounts.asignado, statusCounts.aceptado, statusCounts.completado],
        backgroundColor: ['#FBBF24', '#22D3EE', '#4ADE80', '#60A5FA'],
        borderColor: ['#F59E0B', '#06B6D4', '#22C55E', '#3B82F6'],
        borderWidth: 2,
        borderRadius: 8
      }
    ]
  }), [statusCounts]);

  return (
    <div className="space-y-8 overflow-x-hidden">
      <motion.div
        className="bg-gradient-to-r from-lime-400 to-green-400 rounded-[2.5rem] sm:rounded-[3rem] shadow-xl p-4 sm:p-6 md:p-8 text-white relative overflow-hidden border-4 border-white"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
         <div className="absolute -right-10 -top-10 w-48 h-48 bg-white opacity-20 rounded-full animate-pulse"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
           <div className="flex items-center gap-4 sm:gap-6 min-w-0">
             <div className="p-3 sm:p-4 bg-white/30 rounded-3xl backdrop-blur-md shadow-lg">
               <Zap className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
             </div>
             <div className="min-w-0 [&>h2]:!text-2xl sm:[&>h2]:!text-3xl md:[&>h2]:!text-4xl [&>h2]:break-words [&>p]:!text-base sm:[&>p]:!text-lg md:[&>p]:!text-xl [&>p]:break-words [&>span]:!text-xs sm:[&>span]:!text-sm">
               <h2 className="text-4xl font-black mb-1 drop-shadow-md">Central de Héroes</h2>
               <p className="text-lime-100 text-xl font-bold">¡Hola, {currentUser.name}!</p>
               <div className="flex flex-wrap gap-2 mt-2">
                 <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-sm font-medium border border-white/30">
                   {currentUser.specialty || 'Experto General'}
                 </span>
                 <span className="inline-block bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold border-2 border-yellow-500">
                   💰 {currentUser.commission_rate || 50}% Comisión
                 </span>
               </div>
             </div>
           </div>
           
           <div className="flex flex-wrap justify-center md:justify-end gap-3 sm:gap-4 w-full md:w-auto">
            <div className="bg-white/20 p-3 sm:p-4 rounded-3xl backdrop-blur-md text-center min-w-[120px] sm:min-w-[150px]">
              <span className="block text-2xl sm:text-3xl md:text-4xl font-black">{formatCurrency(totalEarnings)}</span>
              <span className="text-xs sm:text-sm font-bold opacity-90">Mis Ganancias por Cobrar</span>
            </div>
            <div className="bg-white/20 p-3 sm:p-4 rounded-3xl backdrop-blur-md text-center min-w-[120px] sm:min-w-[150px]">
              <span className="block text-2xl sm:text-3xl md:text-4xl font-black">{assignedToMe.length}</span>
              <span className="text-xs sm:text-sm font-bold opacity-90">Servicios Asignados</span>
            </div>
           </div>
         </div>
      </motion.div>

      {/* Sección de Asignaciones Pendientes */}
      {pendingAssignments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-200 via-teal-100 to-cyan-100 rounded-[2.5rem] sm:rounded-[3rem] p-4 sm:p-6 md:p-8 shadow-2xl border-4 border-emerald-300 mb-8"
        >
          <h2 className="text-2xl sm:text-3xl font-black text-emerald-900 mb-6 flex items-center gap-3">
            🔔 Asignaciones Pendientes ({pendingAssignments.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingAssignments.map(apt => {
              const deadline = getResponseDeadline(apt);
              const countdown = formatCountdown(deadline);
              const timeLeftMs = deadline.getTime() - nowTs;
              const isUrgent = timeLeftMs > 0 && timeLeftMs <= 20 * 60 * 1000;
              return (
              <div
                key={apt.id}
                className={`bg-white rounded-[2rem] p-4 sm:p-6 shadow-lg border-4 border-emerald-200 relative overflow-hidden ${isUrgent ? 'ring-4 ring-red-200 animate-pulse' : ''}`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl text-emerald-700">
                    ⏳
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-black text-gray-800 text-lg leading-tight truncate">{apt.clientName}</h3>
                    <p className="text-xs text-emerald-700 font-bold uppercase">{apt.serviceType}</p>
                  </div>
                </div>

                <div className="mb-4 w-full text-center bg-emerald-500 text-white px-4 py-3 rounded-2xl font-black uppercase tracking-wider leading-tight shadow-md [&>span:last-child]:!text-xl sm:[&>span:last-child]:!text-2xl md:[&>span:last-child]:!text-3xl">
                  <span className="block text-xs">Esperando aceptación</span>
                  <span className="block text-2xl md:text-3xl font-black mt-1">⏳ {countdown}</span>
                </div>

                <div className="bg-emerald-50 p-4 rounded-2xl space-y-2 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>💰 Valor Total:</span>
                    <span className="text-purple-600">{formatCurrency(getServicePrice(apt))}</span>
                  </div>
                  {apt.numPersonas && parseInt(apt.numPersonas) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServiceBreakdown(apt);
                        setServiceBreakdownOpen(true);
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs border-b-2 border-purple-700 active:border-b-0 active:translate-y-0.5"
                    >
                      👥 Ver desglose de {apt.numPersonas} personas
                    </button>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>📅 Fecha:</span>
                    <span className="text-emerald-700">{new Date(apt.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>⏰ Hora:</span>
                    <span className="text-emerald-700">{formatTime12Hour(apt.time)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>📍 Dirección:</span>
                    <span className="text-gray-800 text-xs">{apt.direccion || apt.address || apt.addressLine || 'Sin dirección registrada'}</span>
                  </div>
                  {apt.barrio && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                      <span>🏘️ Barrio:</span>
                      <span className="text-amber-700 text-xs font-black">{apt.barrio}</span>
                    </div>
                  )}
                  {apt.descripcionUbicacion && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                      <span>🏢 Detalles:</span>
                      <span className="text-blue-700 text-xs font-black">{apt.descripcionUbicacion}</span>
                    </div>
                  )}
                  {apt.whatsapp && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                      <span>📱 WhatsApp:</span>
                      <span className="text-green-700 text-xs font-black">{apt.whatsapp}</span>
                    </div>
                  )}
                </div>

                {/* Botón Google Maps */}
                {(apt.direccion || apt.barrio) && (
                  <button
                    type="button"
                    onClick={() => openGoogleMaps(apt.direccion || apt.address, apt.barrio, apt.lat, apt.lng)}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 mb-4"
                  >
                    <span>🗺️</span>
                    <span>Ver en Google Maps</span>
                  </button>
                )}

                {/* Botones Aceptar/Rechazar */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleAccept(apt.id)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-3 px-4 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                  >
                    ✓ Aceptar
                  </button>
                  <button
                    onClick={() => handleReject(apt.id)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-3 px-4 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Sección de Servicios Confirmados/Aceptados */}
      {assignedToMe.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-200 via-lime-100 to-emerald-100 rounded-[2.5rem] sm:rounded-[3rem] p-4 sm:p-6 md:p-8 shadow-2xl border-4 border-green-300 mb-8"
        >
          <h2 className="text-2xl sm:text-3xl font-black text-green-900 mb-6 flex items-center gap-3">
            ✅ Mis Servicios Confirmados ({assignedToMe.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedToMe.map(apt => (
              <div
                key={apt.id}
                className="bg-white rounded-[2rem] p-4 sm:p-6 shadow-lg border-4 border-green-200 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-1 rounded-bl-2xl font-black text-xs uppercase tracking-wider">
                  Confirmado
                </div>

                <div className="flex items-center gap-3 mb-3 mt-2">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                    😊
                  </div>
                  <div className="flex-grow min-w-0">
                    <h3 className="font-black text-gray-800 text-lg leading-tight truncate">{apt.clientName}</h3>
                    <p className="text-xs text-green-700 font-bold uppercase">{apt.serviceType}</p>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-2xl space-y-2 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>💰 Valor Total:</span>
                    <span className="text-purple-600">{formatCurrency(getServicePrice(apt))}</span>
                  </div>
                  {apt.numPersonas && parseInt(apt.numPersonas) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedServiceBreakdown(apt);
                        setServiceBreakdownOpen(true);
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-3 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs border-b-2 border-purple-700 active:border-b-0 active:translate-y-0.5"
                    >
                      👥 Ver desglose de {apt.numPersonas} personas
                    </button>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>📅 Fecha:</span>
                    <span className="text-green-700">{new Date(apt.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>⏰ Hora:</span>
                    <span className="text-green-700">{formatTime12Hour(apt.time)}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                    <span>📍 Dirección:</span>
                    <span className="text-gray-800 text-xs">{apt.direccion || apt.address || apt.addressLine || 'Sin dirección registrada'}</span>
                  </div>
                  {apt.barrio && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                      <span>🏘️ Barrio:</span>
                      <span className="text-amber-700 text-xs font-black">{apt.barrio}</span>
                    </div>
                  )}
                  {apt.descripcionUbicacion && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                      <span>🏢 Detalles:</span>
                      <span className="text-blue-700 text-xs font-black">{apt.descripcionUbicacion}</span>
                    </div>
                  )}
                  {apt.whatsapp && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                      <span>📱 WhatsApp:</span>
                      <span className="text-green-700 text-xs font-black">{apt.whatsapp}</span>
                    </div>
                  )}
                </div>

                {/* Datos Críticos del Vendedor */}
                {(apt.yourLoss || apt.ourPayment || apt.total || apt.age) && (
                  <div className="bg-yellow-50 p-3 rounded-xl mb-4 border border-yellow-200">
                    <p className="text-xs font-bold text-yellow-600 uppercase mb-2">📊 Datos del Vendedor</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {apt.yourLoss && (
                        <div className="bg-red-100 p-2 rounded-lg">
                          <p className="text-red-600 font-bold">Tu Pierdes</p>
                          <p className="text-red-700 font-black">{formatCurrency(parseFloat(apt.yourLoss) || 0)}</p>
                        </div>
                      )}
                      {apt.ourPayment && (
                        <div className="bg-green-100 p-2 rounded-lg">
                          <p className="text-green-600 font-bold">Te Pagamos</p>
                          <p className="text-green-700 font-black">{formatCurrency(parseFloat(apt.ourPayment) || 0)}</p>
                        </div>
                      )}
                      {apt.total && (
                        <div className="bg-blue-100 p-2 rounded-lg">
                          <p className="text-blue-600 font-bold">Total</p>
                          <p className="text-blue-700 font-black">{formatCurrency(parseFloat(apt.total) || 0)}</p>
                        </div>
                      )}
                      {apt.age && (
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <p className="text-purple-600 font-bold">Edad</p>
                          <p className="text-purple-700 font-black">{apt.age} años</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Información de personas y alergias */}
                {apt.numPersonas && (
                  <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-200">
                    <p className="text-xs font-bold text-blue-600 mb-2">👥 Personas: <span className="text-blue-800 font-black">{apt.numPersonas}</span></p>
                    {apt.edad && (
                      <p className="text-xs font-bold text-blue-600 mb-2">🎂 Edad: <span className="text-blue-800 font-black">{apt.edad}</span></p>
                    )}
                    {apt.services_per_person && Array.isArray(apt.services_per_person) && apt.services_per_person.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        <p className="font-bold text-blue-600 mb-1">Servicios por persona:</p>
                        {apt.services_per_person.map((service, idx) => (
                          <div key={idx} className="flex justify-between items-center text-gray-700 bg-white p-1.5 rounded">
                            <span>{idx + 1}. {service}</span>
                            <span className="font-black text-emerald-600">{formatCurrency(serviceCatalog[service] || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {apt.hasAlergias && apt.detalleAlergias && (
                  <div className="bg-red-50 p-3 rounded-xl mb-4 border border-red-200">
                    <p className="text-xs font-bold text-red-600 mb-1">⚠️ ALERGIAS:</p>
                    <p className="text-xs text-red-800 font-black">{apt.detalleAlergias}</p>
                  </div>
                )}

                {/* Botón Google Maps */}
                {(apt.direccion || apt.barrio) && (
                  <button
                    type="button"
                    onClick={() => openGoogleMaps(apt.direccion || apt.address, apt.barrio, apt.lat, apt.lng)}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 mb-3"
                  >
                    <span>🗺️</span>
                    <span>Ver en Google Maps</span>
                  </button>
                )}

                {/* Botón Completar Servicio - Solo para servicios aceptados */}
                {apt.status === 'accepted' && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        onClick={() => {
                          setFinishingAppointmentId(apt.id);
                          setSelectedProducts([]);
                          const initialPlans = buildInitialPlansForAppointment(apt);
                          const initialPrices = buildInitialPricesFromPlans(initialPlans);
                          setFinishingPlansPerPerson(initialPlans);
                          setFinishingPricesPerPerson(initialPrices);
                          setFinishingNotes(apt.serviceNotes || '');
                          setFinishingAdditionalCosts('');
                        }}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-black py-3 px-4 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
                      >
                        <span>✓</span>
                        <span>Completar Servicio</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[3rem] border-4 border-blue-400 p-0 overflow-hidden sm:max-w-md w-[95vw] max-h-[90vh] bg-blue-50 shadow-2xl">
                      <DialogHeader className="sr-only">
                        <DialogTitle>Reporte de Misión</DialogTitle>
                      </DialogHeader>
                      <div className="text-center pt-8 pb-6">
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <Check className="w-6 h-6 text-blue-600" />
                          <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                            REPORTE DE MISIÓN
                          </h2>
                        </div>
                      </div>
                      <div className="relative px-6 space-y-6 pb-8 overflow-y-auto max-h-[70vh]">
                        <div className="rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-inner space-y-2 relative overflow-hidden">
                          <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-100 rounded-full opacity-40 blur-2xl"></div>
                          <p className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">
                            🧭 Detalles del servicio
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                              <p className="text-gray-500 text-[11px] font-black uppercase">Cliente</p>
                              <p className="text-base">{apt.clientName}</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                              <p className="text-emerald-600 text-[11px] font-black uppercase">Servicio</p>
                              <p className="text-base">{apt.serviceType}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                              <p className="text-amber-600 text-[11px] font-black uppercase">Fecha</p>
                              <p className="text-base">{new Date(apt.date).toLocaleDateString()}</p>
                            </div>
                            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                              <p className="text-purple-600 text-[11px] font-black uppercase">Hora</p>
                              <p className="text-base">{formatTime12Hour(apt.time)}</p>
                            </div>
                            {apt.edad && (
                              <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-xl p-3">
                                <p className="text-orange-600 text-[11px] font-black uppercase">🎂 Edad</p>
                                <p className="text-base font-black text-orange-700">{apt.edad}</p>
                              </div>
                            )}
                            <div className="col-span-2 bg-pink-50 border border-pink-100 rounded-xl p-3">
                              <p className="text-pink-600 text-[11px] font-black uppercase">Dirección</p>
                              <p className="text-xs text-gray-800 font-black">{apt.direccion || apt.address || apt.addressLine || 'Sin dirección registrada'}</p>
                            </div>
                            {apt.whatsapp && (
                              <div className="col-span-2 bg-green-50 border border-green-100 rounded-xl p-3">
                                <p className="text-green-600 text-[11px] font-black uppercase">📱 WhatsApp</p>
                                <p className="text-base font-black text-green-700">{apt.whatsapp}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {/* Valor del Servicio - Seleccionable */}
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl p-4 shadow-sm">
                            <Label className="font-black text-blue-700 text-sm mb-2 block">
                              Valor del Servicio
                            </Label>
                            <p className="text-xs text-blue-600 font-semibold mb-2">
                              {apt.numPersonas > 1 ? `${apt.numPersonas} personas` : apt.serviceType}
                            </p>
                            <div className="space-y-2">
                              {Array.from({ length: getPeopleCount(apt) }, (_, idx) => (
                                <div key={`finish-person-${apt.id}-${idx}`} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white border-2 border-blue-200 rounded-xl p-2">
                                  <select
                                    value={finishingPlansPerPerson[idx] || servicePlanOptions[0]}
                                    onChange={(e) => setPersonPlanAndPrice(idx, e.target.value)}
                                    className="w-full bg-white border-2 border-blue-200 rounded-xl p-2 text-sm font-black text-blue-700 focus:border-blue-400 outline-none"
                                  >
                                    {servicePlanOptions.map((planName) => (
                                      <option key={`finish-plan-${idx}-${planName}`} value={planName}>
                                        Persona {idx + 1}: {planName}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl p-2 text-sm font-black text-blue-700 flex items-center justify-between">
                                    <span>Valor</span>
                                    <span>{formatCurrency(Number(finishingPricesPerPerson[idx]) || 0)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <p className="text-right text-2xl font-black text-blue-700 mt-2">
                              {formatCurrency(Number(finishingTotalPrice) || 0)}
                            </p>
                          </div>

                          <div className="bg-white border-2 border-purple-100 rounded-2xl p-3 shadow-sm">
                            <Label className="font-black text-gray-700 text-sm mb-1 block flex items-center gap-2">
                              💵 Costos adicionales <span className="text-xs text-gray-500 font-normal">(opcional)</span>
                            </Label>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={finishingAdditionalCosts}
                              onChange={(e) => setFinishingAdditionalCosts(e.target.value)}
                              className="w-full bg-gradient-to-r from-white to-purple-50 border-2 border-purple-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:border-purple-400 outline-none"
                              placeholder="Ej: transporte, materiales extras"
                            />
                          </div>

                          <div className="bg-white border-2 border-green-100 rounded-2xl p-3 shadow-sm">
                            <Label className="font-black text-gray-700 text-sm mb-1 block flex items-center gap-2">
                              ✏️ Descripción / Notas
                            </Label>
                            <textarea
                              value={finishingNotes}
                              onChange={(e) => setFinishingNotes(e.target.value)}
                              className="w-full bg-gradient-to-r from-white to-green-50 border-2 border-green-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:border-green-400 outline-none"
                              rows={3}
                              placeholder="Notas divertidas o detalles importantes"
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={onCompleteService}
                          className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-6 font-bold mt-6 shadow-md border-b-4 border-green-700"
                        >
                          Confirmar y Cobrar 💰
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="flex items-center justify-between md:justify-start gap-3 mb-4 md:mb-6">
          <h2 className="text-xl font-black text-gray-800 md:hidden">Módulos</h2>
          <Button
            type="button"
            variant="outline"
            className="md:hidden rounded-2xl border-2 border-green-200 text-green-600 bg-white/90"
            onClick={() => setIsNavOpen(prev => !prev)}
            aria-expanded={isNavOpen}
            aria-label="Abrir menú de módulos"
          >
            <Menu className="w-5 h-5 mr-2" />
            {isNavOpen ? 'Cerrar' : 'Abrir'}
          </Button>
        </div>

        <TabsList className={`w-full bg-white/50 p-2 rounded-[2rem] border-2 border-green-100 mb-8 h-auto gap-2 ${isNavOpen ? 'grid grid-cols-2' : 'hidden'} sm:flex sm:flex-wrap md:flex`}>
          <TabsTrigger value="panel" className="flex-1 min-w-[120px] sm:min-w-[150px] w-full rounded-3xl py-2 sm:py-3 font-bold text-base sm:text-lg text-center data-[state=active]:bg-amber-400 data-[state=active]:text-white transition-all">
            📊 Mi Panel
          </TabsTrigger>
          <TabsTrigger value="agenda" className="flex-1 min-w-[120px] sm:min-w-[150px] w-full rounded-3xl py-2 sm:py-3 font-bold text-base sm:text-lg text-center data-[state=active]:bg-green-400 data-[state=active]:text-white transition-all">
            📅 Mis Servicios ({assignedToMe.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[120px] sm:min-w-[150px] w-full rounded-3xl py-2 sm:py-3 font-bold text-base sm:text-lg text-center data-[state=active]:bg-blue-400 data-[state=active]:text-white transition-all">
            📜 Historial
          </TabsTrigger>
          <TabsTrigger value="products" className="flex-1 min-w-[120px] sm:min-w-[150px] w-full rounded-3xl py-2 sm:py-3 font-bold text-base sm:text-lg text-center data-[state=active]:bg-purple-400 data-[state=active]:text-white transition-all">
            📦 Productos
          </TabsTrigger>
          <TabsTrigger value="referrals" className="flex-1 min-w-[120px] sm:min-w-[150px] w-full rounded-3xl py-2 sm:py-3 font-bold text-base sm:text-lg text-center data-[state=active]:bg-pink-400 data-[state=active]:text-white transition-all">
            🎁 Referidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="panel">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-[1.75rem] p-4 sm:p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-4 border-blue-200 shadow-xl flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-2xl bg-white/70 text-blue-700 border-2 border-blue-100">
                <Clock3 className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-blue-700">Total Citas</p>
                <p className="text-3xl sm:text-4xl font-black text-blue-800 leading-tight">{myCalendarAppointments.length}</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] p-4 sm:p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-4 border-yellow-200 shadow-xl flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-2xl bg-white/70 text-yellow-600 border-2 border-yellow-100">
                <CalendarClock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-yellow-700">Pendientes</p>
                <p className="text-3xl sm:text-4xl font-black text-yellow-700 leading-tight">{statusCounts.pendiente + statusCounts.asignado}</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] p-4 sm:p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-4 border-emerald-200 shadow-xl flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-2xl bg-white/70 text-emerald-700 border-2 border-emerald-100">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-700">Servicios Activos</p>
                <p className="text-3xl sm:text-4xl font-black text-emerald-800 leading-tight">{pendingAssignments.length + assignedToMe.length}</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-4 border-purple-200 shadow-xl flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-2xl bg-white/70 text-purple-700 border-2 border-purple-100">
                <DollarSign className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-purple-700">Ingresos por Cobrar</p>
                <p className="text-3xl sm:text-4xl font-black text-purple-800 leading-tight">{formatCurrency(totalEarnings)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-purple-100 shadow-xl">
              <h3 className="text-2xl font-black text-purple-700 mb-4 flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-purple-600" /> Distribución de Estados
              </h3>
              <div className="h-80 flex items-center justify-center">
                <Pie
                  data={statusPieData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                        labels: {
                          font: { family: 'Fredoka', size: 12, weight: 700 },
                          color: '#374151',
                          padding: 12,
                          usePointStyle: true,
                          pointStyle: 'circle'
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { family: 'Fredoka', size: 14, weight: 700 },
                        bodyFont: { family: 'Fredoka', size: 12, weight: 600 },
                        borderColor: '#60A5FA',
                        borderWidth: 1,
                        borderRadius: 8
                      }
                    }
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-6 border-4 border-green-100 shadow-xl">
              <h3 className="text-2xl font-black text-green-700 mb-4 flex items-center gap-3">
                <LineChart className="w-7 h-7 text-green-600" /> Ingresos por Mes
              </h3>
              <Bar
                data={earningsBarData}
                options={{
                  responsive: true,
                  indexAxis: 'y',
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (ctx) => `${formatCurrency(ctx.parsed.x || ctx.parsed.y || 0)}`
                      }
                    }
                  },
                  scales: {
                    x: { beginAtZero: true, ticks: { callback: (v) => formatCurrency(v) } },
                    y: { ticks: { font: { weight: 'bold' } } }
                  }
                }}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="agenda">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setServicesView('assigned')}
              className={`px-4 py-2 rounded-2xl font-bold border-2 transition-colors ${servicesView === 'assigned' ? 'bg-green-500 text-white border-green-600' : 'bg-white text-green-700 border-green-200'}`}
            >
              Mis asignados
            </button>
            <button
              onClick={() => setServicesView('rejected')}
              className={`px-4 py-2 rounded-2xl font-bold border-2 transition-colors flex items-center gap-2 ${servicesView === 'rejected' ? 'bg-red-500 text-white border-red-600' : 'bg-white text-red-700 border-red-200'}`}
            >
              Mis rechazos
              <span className="bg-white/30 text-xs px-2 py-0.5 rounded-full">{myRejectedServices.length}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleServices.length === 0 ? (
               <div className="col-span-full py-20 text-center bg-white/60 rounded-[3rem] border-4 border-dashed border-green-200">
                <Calendar className="w-24 h-24 mx-auto mb-4 text-green-200" />
                <p className="text-2xl font-black text-gray-400">{servicesView === 'rejected' ? 'No has rechazado servicios.' : 'No hay servicios asignados todavía.'}</p>
              </div>
            ) : (
              visibleServices.map(apt => (
                <div key={apt.id} className={`bg-white rounded-[2rem] p-6 shadow-lg border-4 relative overflow-hidden flex flex-col ${servicesView === 'rejected' ? 'border-red-200' : 'border-green-200'}`}>
                   <div className={`absolute top-0 right-0 text-white px-4 py-1 rounded-bl-2xl font-black text-xs uppercase tracking-wider ${servicesView === 'rejected' ? 'bg-red-400' : 'bg-green-400'}`}>
                     {servicesView === 'rejected' ? 'Rechazado por ti' : 'Confirmado'}
                   </div>
                   
                   <div className="flex items-center gap-3 mb-4 mt-2">
                     <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                       😊
                     </div>
                     <div className="flex-grow">
                       <h3 className="font-black text-gray-800 text-lg leading-tight">{apt.clientName}</h3>
                       <p className="text-xs text-green-600 font-bold uppercase">{apt.serviceType}</p>
                     </div>
                   </div>

                   <div className={`${servicesView === 'rejected' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'} p-4 rounded-2xl space-y-2 mb-4 border`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                        <span>💰 Valor:</span>
                        <span className="text-purple-600">{formatCurrency(getServicePrice(apt))}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                        <span>📅 Fecha:</span>
                        <span className="text-green-600">{new Date(apt.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-gray-600 [&>span:last-child]:basis-full sm:[&>span:last-child]:basis-auto [&>span:last-child]:text-right [&>span:last-child]:break-words">
                        <span>⏰ Hora:</span>
                        <span className="text-green-600">{formatTime12Hour(apt.time)}</span>
                      </div>
                      
                      {/* Botón Ver Desglose */}
                      {apt.numPersonas > 1 && apt.services_per_person && apt.services_per_person.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedServiceBreakdown(apt);
                            setServiceBreakdownOpen(true);
                          }}
                          className="w-full mt-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-3 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-xs border-b-2 border-purple-700 active:border-b-0 active:translate-y-0.5"
                        >
                          <span>👥</span>
                          <span>Ver desglose de {apt.numPersonas} personas</span>
                        </button>
                      )}
                   </div>

                   {/* Datos Críticos */}
                   {(apt.yourLoss || apt.ourPayment || apt.total || apt.age) && (
                     <div className="bg-yellow-50 p-3 rounded-xl mb-4 border border-yellow-200">
                       <p className="text-xs font-bold text-yellow-600 uppercase mb-2">📊 Datos del Vendedor</p>
                       <div className="grid grid-cols-2 gap-2 text-xs">
                         {apt.yourLoss && (
                           <div className="bg-red-100 p-2 rounded-lg">
                             <p className="text-red-600 font-bold">Tu Pierdes</p>
                             <p className="text-red-700 font-black">{formatCurrency(parseFloat(apt.yourLoss) || 0)}</p>
                           </div>
                         )}
                         {apt.ourPayment && (
                           <div className="bg-green-100 p-2 rounded-lg">
                             <p className="text-green-600 font-bold">Te Pagamos</p>
                             <p className="text-green-700 font-black">{formatCurrency(parseFloat(apt.ourPayment) || 0)}</p>
                           </div>
                         )}
                         {apt.total && (
                           <div className="bg-blue-100 p-2 rounded-lg">
                             <p className="text-blue-600 font-bold">Total</p>
                             <p className="text-blue-700 font-black">{formatCurrency(parseFloat(apt.total) || 0)}</p>
                           </div>
                         )}
                         {apt.age && (
                           <div className="bg-purple-100 p-2 rounded-lg">
                             <p className="text-purple-600 font-bold">Edad</p>
                             <p className="text-purple-700 font-black">{apt.age} años</p>
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                   
                   {/* Información de Ubicación */}
                   {(apt.direccion || apt.barrio) && (
                     <div className="bg-blue-50 p-3 rounded-xl mb-4 border border-blue-200">
                       <p className="text-xs font-bold text-blue-600 uppercase mb-2 flex items-center gap-1">
                         <span>📍</span> Ubicación
                       </p>
                       <div className="space-y-2">
                         {apt.direccion && (
                           <div className="text-xs font-semibold text-gray-700">
                             <span className="text-gray-500">Dirección:</span>
                             <p className="text-gray-800 break-words mt-0.5">{apt.direccion || apt.address || apt.addressLine}</p>
                           </div>
                         )}
                         {apt.barrio && (
                           <div className="text-xs font-semibold text-gray-700">
                             <span className="text-gray-500">Barrio:</span>
                             <p className="text-amber-700 font-black mt-0.5">{apt.barrio}</p>
                           </div>
                         )}
                         {apt.descripcionUbicacion && (
                           <div className="text-xs font-semibold text-gray-700">
                             <span className="text-gray-500">🏢 Detalles:</span>
                             <p className="text-blue-700 font-black mt-0.5">{apt.descripcionUbicacion}</p>
                           </div>
                         )}
                         {apt.whatsapp && (
                           <div className="text-xs font-semibold text-gray-700">
                             <span className="text-gray-500">📱 WhatsApp:</span>
                             <p className="text-green-700 font-black mt-0.5">{apt.whatsapp}</p>
                           </div>
                         )}
                         <button
                           type="button"
                           onClick={() => openGoogleMaps(apt.direccion || apt.address, apt.barrio, apt.lat, apt.lng)}
                           className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-2 px-3 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 text-xs border-b-2 border-blue-700 active:border-b-0 active:translate-y-0.5 mt-2"
                         >
                           <span>🗺️</span>
                           <span>Ver en Maps</span>
                         </button>
                       </div>
                     </div>
                   )}

                   <div className="mt-auto space-y-2">
                     {servicesView === 'rejected' && Array.isArray(apt.rejectionHistory) && (
                       <div className="bg-white border-2 border-red-100 rounded-xl p-3 text-xs font-bold text-red-700 flex items-center gap-2">
                         <span>⚠️ Rechazos registrados:</span>
                         <span className="bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{apt.rejectionHistory.filter(name => name === currentUser.name).length}</span>
                       </div>
                     )}
                     {(apt.status === 'pending' || apt.status === 'assigned') && servicesView !== 'rejected' && (
                       <div className="flex gap-2">
                         <Button
                           onClick={() => handleAccept(apt.id)}
                           className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-4 font-bold shadow-md border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
                         >
                           <Check className="mr-2" /> Aceptar
                         </Button>
                         <Button
                           onClick={() => handleReject(apt.id)}
                           className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-4 font-bold shadow-md border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
                         >
                           <X className="mr-2" /> Rechazar
                         </Button>
                       </div>
                     )}

                     {apt.status === 'accepted' && (
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button 
                             onClick={() => {
                               setFinishingAppointmentId(apt.id);
                               setSelectedProducts([]);
                                const initialPlans = buildInitialPlansForAppointment(apt);
                                const initialPrices = buildInitialPricesFromPlans(initialPlans);
                                setFinishingPlansPerPerson(initialPlans);
                                setFinishingPricesPerPerson(initialPrices);
                                setFinishingNotes(apt.serviceNotes || '');
                                setFinishingAdditionalCosts('');
                             }}
                             className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-blue-700 active:border-b-0 active:translate-y-1"
                           >
                             <Check className="mr-2" /> Completar Servicio
                           </Button>
                         </DialogTrigger>
                         <DialogContent className="rounded-[3rem] border-4 border-blue-400 p-0 overflow-hidden sm:max-w-md w-[95vw] max-h-[90vh] bg-blue-50 shadow-2xl">
                          <DialogHeader className="sr-only">
                            <DialogTitle>Reporte de Misión</DialogTitle>
                          </DialogHeader>
                          <div className="text-center pt-8 pb-6">
                            <div className="flex items-center justify-center gap-3 mb-2">
                              <Check className="w-6 h-6 text-blue-600" />
                              <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                                REPORTE DE MISIÓN
                              </h2>
                            </div>
                          </div>
                          <div className="relative px-6 space-y-6 pb-8 overflow-y-auto max-h-[70vh]">
                            <div className="rounded-2xl border-2 border-blue-100 bg-white p-4 shadow-inner space-y-2 relative overflow-hidden">
                              <div className="absolute -top-6 -right-6 w-24 h-24 bg-blue-100 rounded-full opacity-40 blur-2xl"></div>
                              <p className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">
                                🧭 Detalles del servicio
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                  <p className="text-gray-500 text-[11px] font-black uppercase">Cliente</p>
                                  <p className="text-base">{apt.clientName}</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                  <p className="text-emerald-600 text-[11px] font-black uppercase">Servicio</p>
                                  <p className="text-base">{apt.serviceType}</p>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                  <p className="text-amber-600 text-[11px] font-black uppercase">Fecha</p>
                                  <p className="text-base">{new Date(apt.date).toLocaleDateString()}</p>
                                </div>
                                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                                  <p className="text-purple-600 text-[11px] font-black uppercase">Hora</p>
                                  <p className="text-base">{formatTime12Hour(apt.time)}</p>
                                </div>
                                {apt.edad && (
                                  <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-xl p-3">
                                    <p className="text-orange-600 text-[11px] font-black uppercase">🎂 Edad</p>
                                    <p className="text-base font-black text-orange-700">{apt.edad}</p>
                                  </div>
                                )}
                                <div className="col-span-2 bg-pink-50 border border-pink-100 rounded-xl p-3">
                                  <p className="text-pink-600 text-[11px] font-black uppercase">Dirección</p>
                                  <p className="text-xs text-gray-800 font-black">{apt.direccion || apt.address || apt.addressLine || 'Sin dirección registrada'}</p>
                                </div>
                                {apt.whatsapp && (
                                  <div className="col-span-2 bg-green-50 border border-green-100 rounded-xl p-3">
                                    <p className="text-green-600 text-[11px] font-black uppercase">📱 WhatsApp</p>
                                    <p className="text-base font-black text-green-700">{apt.whatsapp}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-3">
                            {/* Valor del Servicio - Seleccionable */}
                            <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-2xl p-4 shadow-sm">
                              <Label className="font-black text-blue-700 text-sm mb-2 block">
                                Valor del Servicio
                              </Label>
                              <p className="text-xs text-blue-600 font-semibold mb-2">
                                {apt.numPersonas > 1 ? `${apt.numPersonas} personas` : apt.serviceType}
                              </p>
                              <div className="space-y-2">
                                {Array.from({ length: getPeopleCount(apt) }, (_, idx) => (
                                  <div key={`finish-person-${apt.id}-${idx}`} className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white border-2 border-blue-200 rounded-xl p-2">
                                    <select
                                      value={finishingPlansPerPerson[idx] || servicePlanOptions[0]}
                                      onChange={(e) => setPersonPlanAndPrice(idx, e.target.value)}
                                      className="w-full bg-white border-2 border-blue-200 rounded-xl p-2 text-sm font-black text-blue-700 focus:border-blue-400 outline-none"
                                    >
                                      {servicePlanOptions.map((planName) => (
                                        <option key={`finish-plan-${idx}-${planName}`} value={planName}>
                                          Persona {idx + 1}: {planName}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl p-2 text-sm font-black text-blue-700 flex items-center justify-between">
                                      <span>Valor</span>
                                      <span>{formatCurrency(Number(finishingPricesPerPerson[idx]) || 0)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-right text-2xl font-black text-blue-700 mt-2">
                                {formatCurrency(Number(finishingTotalPrice) || 0)}
                              </p>
                            </div>

                          <div className="bg-white border-2 border-purple-100 rounded-2xl p-3 shadow-sm">
                              <Label className="font-black text-gray-700 text-sm mb-1 block flex items-center gap-2">
                                💵 Costos adicionales <span className="text-xs text-gray-500 font-normal">(opcional)</span>
                              </Label>
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={finishingAdditionalCosts}
                                onChange={(e) => setFinishingAdditionalCosts(e.target.value)}
                                className="w-full bg-gradient-to-r from-white to-purple-50 border-2 border-purple-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:border-purple-400 outline-none"
                                placeholder="Ej: transporte, materiales extras"
                              />
                            </div>

                            <div className="bg-white border-2 border-green-100 rounded-2xl p-3 shadow-sm">
                              <Label className="font-black text-gray-700 text-sm mb-1 block flex items-center gap-2">
                                ✏️ Descripción / Notas
                              </Label>
                              <textarea
                                value={finishingNotes}
                                onChange={(e) => setFinishingNotes(e.target.value)}
                                className="w-full bg-gradient-to-r from-white to-green-50 border-2 border-green-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:border-green-400 outline-none"
                                rows={3}
                                placeholder="Notas divertidas o detalles importantes"
                              />
                            </div>
                          </div>
                          <Button 
                            onClick={onCompleteService}
                            className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-6 font-bold mt-6 shadow-md border-b-4 border-green-700"
                          >
                            Confirmar y Cobrar 💰
                          </Button>
                        </div>
                       </DialogContent>
                     </Dialog>
                     )}

                     {apt.status === 'completed' && (
                       <div className="w-full p-4 rounded-2xl text-center font-bold bg-blue-100 text-blue-700">
                         ✅ Servicio Completado
                       </div>
                     )}
                   </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8">
            <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-green-100">
              <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-green-500" /> Mi Agenda
              </h3>
              <Suspense fallback={<div className="text-center py-8 text-gray-500 font-bold">Cargando agenda...</div>}>
                <ScheduleCalendar
                  appointments={myCalendarAppointments}
                  piojologists={[currentUser]}
                  title="Mi Agenda"
                  serviceCatalog={serviceCatalog}
                  formatCurrency={formatCurrency}
                />
              </Suspense>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="history">
          <Suspense fallback={<div className="text-center py-10 text-gray-500 font-bold">Cargando historial...</div>}>
            <HistoryTab
              completedHistory={completedHistory}
              commissionRate={commissionRate}
              getServicePrice={getServicePrice}
              formatCurrency={formatCurrency}
              serviceCatalog={serviceCatalog}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="products">
          <Suspense fallback={<div className="text-center py-10 text-gray-500 font-bold">Cargando solicitudes...</div>}>
            <ProductRequestView
              products={products}
              currentUser={currentUser}
              onCreateRequest={onCreateProductRequest}
              productRequests={productRequests || []}
              formatCurrency={formatCurrency}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="referrals">
          <Suspense fallback={<div className="text-center py-10 text-gray-500 font-bold">Cargando referidos...</div>}>
            <ReferralsTab
              loadingReferrals={loadingReferrals}
              currentUser={currentUser}
              copiedCode={copiedCode}
              copyReferralCode={copyReferralCode}
              formatCurrency={formatCurrency}
              referralCommissions={referralCommissions}
              myReferrals={myReferrals}
            />
          </Suspense>
        </TabsContent>

      </Tabs>
      
      {/* Diálogo de Confirmación de Rechazo */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden bg-red-50 max-w-lg shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Rechazo</DialogTitle>
          </DialogHeader>
          
          {appointmentToReject && (
            <div className="bg-transparent">
              <div className="text-center pt-8 pb-6 bg-gradient-to-b from-red-100 to-red-50">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <span className="text-4xl">⚠️</span>
                  <h2 className="text-2xl md:text-3xl font-black text-red-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                    ¿RECHAZAR SERVICIO?
                  </h2>
                </div>
                <p className="text-sm font-bold text-red-700 mt-2 px-6">
                  Esta acción enviará el servicio de vuelta a pendientes
                </p>
              </div>

              <div className="max-h-[60vh] overflow-y-auto px-4 sm:px-6 md:px-8 pb-8 space-y-4">
                {/* Info del Cliente */}
                <div className="bg-white border-3 border-red-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                      👤
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-500 uppercase">Cliente</p>
                      <p className="text-lg font-black text-gray-800">{appointmentToReject.clientName}</p>
                    </div>
                  </div>
                  
                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-purple-600 uppercase mb-1">Servicio</p>
                    <p className="text-base font-black text-purple-700">{appointmentToReject.serviceType}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Fecha</p>
                      <p className="text-sm font-bold text-gray-800">{new Date(appointmentToReject.date).toLocaleDateString()}</p>
                    </div>
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase">Hora</p>
                      <p className="text-sm font-bold text-gray-800">{formatTime12Hour(appointmentToReject.time)}</p>
                    </div>
                  </div>
                </div>

                {/* Información de Ubicación */}
                <div className="bg-white border-3 border-blue-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">📍</span>
                    <p className="text-sm font-black text-blue-600 uppercase">Ubicación del Servicio</p>
                  </div>
                  
                  {appointmentToReject.direccion && (
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 mb-2">
                      <p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Dirección</p>
                      <p className="text-sm font-bold text-gray-800 break-words">
                        {appointmentToReject.direccion || appointmentToReject.address || appointmentToReject.addressLine}
                      </p>
                    </div>
                  )}
                  
                  {appointmentToReject.barrio && (
                    <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 mb-3">
                      <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Barrio</p>
                      <p className="text-sm font-black text-amber-700">{appointmentToReject.barrio}</p>
                    </div>
                  )}
                  
                  {appointmentToReject.whatsapp && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-3 mb-3">
                      <p className="text-[10px] font-bold text-green-600 uppercase mb-1">📱 WhatsApp</p>
                      <p className="text-sm font-black text-green-700">{appointmentToReject.whatsapp}</p>
                    </div>
                  )}
                  
                  {/* Botón Google Maps */}
                  {(appointmentToReject.direccion || appointmentToReject.barrio) && (
                    <button
                      type="button"
                      onClick={() => openGoogleMaps(
                        appointmentToReject.direccion || appointmentToReject.address, 
                        appointmentToReject.barrio,
                        appointmentToReject.lat,
                        appointmentToReject.lng
                      )}
                      className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1"
                    >
                      <span className="text-xl">🗺️</span>
                      <span>Ver en Google Maps</span>
                    </button>
                  )}
                </div>

                {/* Botones de Acción */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancelReject}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-black py-4 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg border-b-4 border-gray-500 active:border-b-0 active:translate-y-1"
                  >
                    <span className="text-lg">↩️</span> Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReject}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-4 px-6 rounded-2xl transition-all shadow-md hover:shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
                  >
                    <span className="text-lg">✗</span> Sí, Rechazar
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Desglose de Servicios */}
      <Dialog open={serviceBreakdownOpen} onOpenChange={setServiceBreakdownOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-purple-400 p-0 overflow-hidden sm:max-w-md bg-gradient-to-br from-purple-50 to-pink-50 shadow-2xl">
          {selectedServiceBreakdown && (
            <div className="relative">
              {/* Header con gradiente */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12"></div>
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-white font-black text-2xl uppercase tracking-wide mb-2">
                    💰 Desglose del Servicio
                  </DialogTitle>
                </DialogHeader>
                <p className="text-white/90 font-bold text-sm">
                  {selectedServiceBreakdown.clientName}
                </p>
              </div>

              {/* Contenido */}
              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
                {/* Número de personas */}
                <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
                  <p className="text-sm font-bold text-purple-600 mb-2">👥 Total de personas:</p>
                  <p className="text-3xl font-black text-purple-800">{selectedServiceBreakdown.numPersonas}</p>
                </div>

                {/* Lista de servicios */}
                {selectedServiceBreakdown.services_per_person && Array.isArray(selectedServiceBreakdown.services_per_person) && (
                  <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
                    <p className="text-sm font-bold text-purple-600 mb-3">📋 Servicios por persona:</p>
                    <div className="space-y-2">
                      {selectedServiceBreakdown.services_per_person.map((service, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 p-3 rounded-xl border border-purple-200">
                          <div className="flex items-center gap-2">
                            <span className="bg-purple-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-gray-700">{service}</span>
                          </div>
                          <span className="font-black text-emerald-600 text-lg">
                            {formatCurrency(serviceCatalog[service] || 0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl p-5 shadow-lg border-2 border-emerald-400">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-black text-lg uppercase">💎 Total del Servicio:</span>
                    <span className="text-white font-black text-3xl">
                      {formatCurrency(getServicePrice(selectedServiceBreakdown))}
                    </span>
                  </div>
                </div>

                {/* Botón cerrar */}
                <button
                  type="button"
                  onClick={() => setServiceBreakdownOpen(false)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-black py-4 px-6 rounded-2xl shadow-lg border-b-4 border-purple-700 active:border-b-0 active:translate-y-1 transition-all"
                >
                  ✓ Entendido
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PiojologistView;


