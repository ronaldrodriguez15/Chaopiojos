import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CalendarDays, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { bookingService, referralService } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ScheduleCalendar from '@/components/ScheduleCalendar';

const ScheduleManagement = ({
  appointments,
  piojologists,
  serviceCatalog,
  formatCurrency,
  reloadBookings,
  requireAdvance12hSetting = true,
  onToggleRequireAdvance12h,
  bookingSettingsLoading = false,
  onAssignFromCalendar,
  onDeleteBooking
}) => {
  const getTodayDateString = () => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };
  const todayDateString = getTodayDateString();

  // Función auxiliar para calcular el total del servicio
  const calculateServiceTotal = (appointment) => {
    // Si tiene services_per_person, sumar todos los servicios
    if (appointment.services_per_person && Array.isArray(appointment.services_per_person)) {
      return appointment.services_per_person.reduce((total, serviceType) => {
        return total + (serviceCatalog[serviceType] || 0);
      }, 0);
    }
    if (appointment.servicesPerPerson && Array.isArray(appointment.servicesPerPerson)) {
      return appointment.servicesPerPerson.reduce((total, serviceType) => {
        return total + (serviceCatalog[serviceType] || 0);
      }, 0);
    }
    // Si no, usar el serviceType simple
    return serviceCatalog[appointment.serviceType] || 0;
  };

  const { toast } = useToast();
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isServiceDetailOpen, setIsServiceDetailOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [assignPiojologistId, setAssignPiojologistId] = useState('');
  const [servicesPage, setServicesPage] = useState(1);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState(null);
  const [liveRequireAdvance12h, setLiveRequireAdvance12h] = useState(!!requireAdvance12hSetting);
  const servicesPerPage = 6;
  const [serviceFilters, setServiceFilters] = useState({
    clientName: '',
    serviceType: '',
    piojologist: '',
    status: 'all',
    rejections: 'all' // all | has
  });
  const serviceTypeOptions = Object.keys(serviceCatalog || {});
  const defaultServiceType = serviceTypeOptions[0] || '';
  const timeSlotOptions = [
    { value: '08:00', label: '08:00 AM' },
    { value: '10:00', label: '10:00 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '14:00', label: '02:00 PM' },
    { value: '16:00', label: '04:00 PM' }
  ];
  const buildInitialFormData = () => ({
    clientName: '',
    date: '',
    time: '',
    piojologistId: '',
    whatsapp: '',
    email: '',
    direccion: '',
    barrio: '',
    descripcionUbicacion: '',
    lat: null,
    lng: null,
    numPersonas: '1',
    edad: '',
    servicesPerPerson: [defaultServiceType],
    hasAlergias: false,
    detalleAlergias: '',
    terminosAceptados: false
  });
  const [serviceFormData, setServiceFormData] = useState(buildInitialFormData);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmittingService, setIsSubmittingService] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralValidation, setReferralValidation] = useState({
    isValid: false,
    isValidating: false,
    message: '',
    referrerName: ''
  });

  useEffect(() => {
    setLiveRequireAdvance12h(!!requireAdvance12hSetting);
  }, [requireAdvance12hSetting]);

  useEffect(() => {
    const clearTimeError = () => {
      setFieldErrors((prev) => {
        if (!prev?.time) return prev;
        const cloned = { ...prev };
        delete cloned.time;
        return cloned;
      });
    };

    const onSettingsUpdated = (event) => {
      const next = !!event?.detail?.requireAdvance12h;
      setLiveRequireAdvance12h(next);
      clearTimeError();
    };

    const onStorage = (event) => {
      if (event.key !== 'booking_require_12h') return;
      const next = event.newValue !== '0';
      setLiveRequireAdvance12h(next);
      clearTimeError();
    };

    window.addEventListener('booking-settings-updated', onSettingsUpdated);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('booking-settings-updated', onSettingsUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const resolveRequireAdvance12h = useCallback(() => {
    try {
      const raw = window.localStorage.getItem('booking_require_12h');
      if (raw === '0') return false;
      if (raw === '1') return true;
    } catch (e) {
      // ignore storage access errors
    }
    return !!liveRequireAdvance12h;
  }, [liveRequireAdvance12h]);

  useEffect(() => {
    if (!isServiceDialogOpen) return;
    const next = resolveRequireAdvance12h();
    setLiveRequireAdvance12h(next);
    if (!next) {
      setFieldErrors((prev) => {
        if (!prev?.time) return prev;
        const cloned = { ...prev };
        delete cloned.time;
        return cloned;
      });
    }
  }, [isServiceDialogOpen, resolveRequireAdvance12h]);

  const resetServiceForm = () => {
    setServiceFormData(buildInitialFormData());
    setFieldErrors({});
    setReferralCode('');
    setReferralValidation({ isValid: false, isValidating: false, message: '', referrerName: '' });
  };

  const validateReferralCode = async (code) => {
    if (!code || code.trim() === '') {
      setReferralValidation({ isValid: false, isValidating: false, message: '', referrerName: '' });
      return;
    }

    setReferralValidation((prev) => ({ ...prev, isValidating: true }));
    try {
      const result = await referralService.validateCode(code);
      if (result.success && result.data?.valid) {
        setReferralValidation({
          isValid: true,
          isValidating: false,
          message: `Codigo valido. Referido por ${result.data.referrer.name}`,
          referrerName: result.data.referrer.name
        });
      } else {
        setReferralValidation({
          isValid: false,
          isValidating: false,
          message: 'Codigo no valido',
          referrerName: ''
        });
      }
    } catch (error) {
      setReferralValidation({
        isValid: false,
        isValidating: false,
        message: 'Error al validar codigo',
        referrerName: ''
      });
    }
  };

  const handleServiceSubmit = async (e, closeDialog = true) => {
    e.preventDefault();
    if (isSubmittingService) return;

    const errors = {};
    const whatsappClean = (serviceFormData.whatsapp || '').replace(/\D/g, '');
    const numPersonas = Math.max(1, parseInt(serviceFormData.numPersonas, 10) || 1);
    const servicesPerPerson = Array(numPersonas).fill(null).map((_, idx) =>
      serviceFormData.servicesPerPerson[idx] || defaultServiceType
    );

    if (!serviceFormData.clientName?.trim()) errors.clientName = 'Debes ingresar el nombre del cliente';
    if (!serviceFormData.date) errors.date = 'La fecha es obligatoria';
    if (!serviceFormData.time) errors.time = 'La hora es obligatoria';
    if (serviceFormData.time && !timeSlotOptions.some((slot) => slot.value === serviceFormData.time)) {
      errors.time = 'La hora debe ser una de las opciones disponibles';
    }
    if (!serviceFormData.piojologistId) errors.piojologistId = 'Debes seleccionar una piojologa';
    if (!whatsappClean) errors.whatsapp = 'El numero de WhatsApp es obligatorio';
    else if (whatsappClean.length !== 10 || !whatsappClean.startsWith('3')) errors.whatsapp = 'WhatsApp debe tener 10 digitos y empezar por 3';
    if (!serviceFormData.direccion?.trim()) errors.direccion = 'La direccion es obligatoria';
    if (!serviceFormData.barrio?.trim()) errors.barrio = 'El barrio es obligatorio';
    if (!serviceFormData.edad?.trim()) errors.edad = 'La edad es obligatoria';
    if (servicesPerPerson.some((svc) => !svc)) errors.servicesPerPerson = 'Selecciona un nivel de infestacion para cada persona';
    if (!serviceFormData.terminosAceptados) errors.terminosAceptados = 'Debes aceptar los terminos y condiciones';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (serviceFormData.date) {
      const selectedDate = new Date(serviceFormData.date);
      selectedDate.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        errors.date = 'Solo puedes agendar desde hoy en adelante';
      }
    }

    const shouldRequireAdvance12h = resolveRequireAdvance12h();
    if (shouldRequireAdvance12h && serviceFormData.date && serviceFormData.time) {
      const now = new Date();
      const selectedDateTime = new Date(serviceFormData.date);
      const [hour, minute] = serviceFormData.time.split(':').map((v) => parseInt(v, 10));
      selectedDateTime.setHours(hour, minute, 0, 0);
      if (selectedDateTime.getTime() - now.getTime() < 12 * 60 * 60 * 1000) {
        errors.time = 'Debe existir minimo 12 horas de anticipacion';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast({
        title: 'Campos requeridos',
        description: Object.values(errors)[0],
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSubmittingService(true);
      setFieldErrors({});

      const createPayload = {
        fecha: serviceFormData.date,
        hora: serviceFormData.time,
        clientName: serviceFormData.clientName.trim(),
        serviceType: servicesPerPerson[0],
        servicesPerPerson,
        whatsapp: whatsappClean,
        email: serviceFormData.email?.trim() ? serviceFormData.email.trim() : null,
        direccion: serviceFormData.direccion.trim(),
        barrio: serviceFormData.barrio.trim(),
        descripcionUbicacion: serviceFormData.descripcionUbicacion?.trim() ? serviceFormData.descripcionUbicacion.trim() : null,
        lat: serviceFormData.lat,
        lng: serviceFormData.lng,
        numPersonas,
        edad: serviceFormData.edad.trim(),
        hasAlergias: !!serviceFormData.hasAlergias,
        detalleAlergias: serviceFormData.hasAlergias ? (serviceFormData.detalleAlergias?.trim() || null) : null,
        referidoPor: referralValidation.isValid ? (referralValidation.referrerName || null) : null,
        paymentMethod: 'pay_later',
        referralCode: referralValidation.isValid ? referralCode : null
      };

      const createResult = await bookingService.create(createPayload);
      if (!createResult.success || !createResult.booking?.id) {
        toast({
          title: 'No se pudo crear el agendamiento',
          description: createResult.message || 'Verifica los datos del formulario',
          variant: 'destructive'
        });
        return;
      }

      const bookingId = createResult.booking.id;
      const assignResult = await bookingService.update(bookingId, {
        piojologistId: Number(serviceFormData.piojologistId),
        status: 'assigned'
      });

      if (!assignResult.success) {
        toast({
          title: 'Creado con advertencia',
          description: 'Se creo la reserva, pero no se pudo asignar automaticamente la piojologa.',
          variant: 'destructive'
        });
      }

      if (typeof reloadBookings === 'function') {
        await reloadBookings();
      }

      if (closeDialog) {
        setIsServiceDialogOpen(false);
      }

      resetServiceForm();
      toast({
        title: closeDialog ? 'Servicio creado' : 'Servicio creado. Puedes agregar otro',
        className: 'bg-yellow-100 text-yellow-800 rounded-2xl border-2 border-yellow-200'
      });
    } catch (error) {
      toast({
        title: 'Error inesperado',
        description: 'No fue posible crear el agendamiento',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingService(false);
    }
  };

  const handleAssignService = async () => {
    // Permitir asignar/reasignar si está en pending, assigned o accepted
    if (!selectedService || !['pending', 'assigned', 'accepted'].includes(selectedService.status)) {
      toast({
        title: 'No se puede reasignar',
        description: 'Solo se pueden asignar/reasignar servicios pendientes, asignados o aceptados.',
        className: 'rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 font-bold'
      });
      return;
    }
    
    if (!assignPiojologistId) {
      toast({
        title: 'Selecciona una piojóloga',
        description: 'Debes elegir a quien asignar este agendamiento.',
        className: 'rounded-2xl border-2 border-yellow-200 bg-yellow-50 text-yellow-700 font-bold'
      });
      return;
    }

    const selectedPio = piojologists.find(p => String(p.id) === String(assignPiojologistId));
    const wasReassignment = selectedService.piojologistId !== null && selectedService.piojologistId !== undefined;

    // Usar callback para persistir en backend y refrescar estado global
    if (onAssignFromCalendar) {
      await onAssignFromCalendar(selectedService, assignPiojologistId);
    }
    setSelectedService(prev => prev ? {
      ...prev,
      status: 'assigned',
      piojologistId: Number(assignPiojologistId),
      piojologistName: selectedPio?.name || prev.piojologistName
    } : prev);

    setIsServiceDetailOpen(false);
    toast({
      title: wasReassignment ? '?? Reasignado con éxito' : '? Asignado con éxito',
      description: selectedPio ? `${wasReassignment ? 'Reasignado' : 'Asignado'} a ${selectedPio.name}` : 'Asignación guardada',
      className: 'rounded-2xl border-2 border-green-200 bg-green-50 text-green-700 font-bold'
    });
  };

  return (
    <div className="space-y-6">
      {/* Gestion de Servicios */}
      <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-yellow-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-bl-full opacity-50 -mr-4 -mt-4"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 relative z-10">
          <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
            Servicios Activos
          </h3>
          <div className="w-full sm:w-auto bg-blue-50 border-2 border-blue-200 rounded-2xl px-4 py-3">
            <label className="flex items-center gap-3 font-bold text-gray-700 text-sm sm:text-base">
              <input
                type="checkbox"
                checked={!!liveRequireAdvance12h}
                disabled={bookingSettingsLoading}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setLiveRequireAdvance12h(checked);
                  setFieldErrors((prev) => {
                    if (!prev?.time) return prev;
                    const cloned = { ...prev };
                    delete cloned.time;
                    return cloned;
                  });
                  onToggleRequireAdvance12h && onToggleRequireAdvance12h(checked);
                }}
                className="w-5 h-5 border-blue-300"
              />
              Agendamiento con anticipacion 12h
            </label>
            <p className="text-xs text-blue-700 font-semibold mt-1 ml-8">
              Regla global (aplica admin y /agenda)
            </p>
          </div>
          <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-2xl px-4 sm:px-6 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-md hover:shadow-lg border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 w-full sm:w-auto justify-center">
                <Calendar className="w-6 h-6 mr-2" />
                Crear Servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 overflow-hidden sm:max-w-4xl bg-yellow-50 shadow-2xl">
              <DialogHeader className="sr-only">
                <DialogTitle>Nuevo Servicio</DialogTitle>
              </DialogHeader>
              <div className="text-center pt-8 pb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Calendar className="w-6 h-6 text-yellow-600" />
                  <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                    NUEVO SERVICIO
                  </h2>
                </div>
              </div>
              <form onSubmit={handleServiceSubmit} className="relative px-6 md:px-8 pb-8 space-y-4 flex-1 overflow-y-auto max-h-[72vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Hora *</Label>
                    <select
                      required
                      value={serviceFormData.time}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, time: e.target.value })}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none cursor-pointer ${fieldErrors.time ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                    >
                      <option value="">Seleccionar hora...</option>
                      {timeSlotOptions.map((slot) => (
                        <option key={slot.value} value={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Fecha *</Label>
                    <div className={`relative rounded-2xl border-2 ${fieldErrors.date ? 'border-red-300 bg-red-50' : 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-white'} px-4 py-3 shadow-sm`}>
                      <CalendarDays className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${fieldErrors.date ? 'text-red-500' : 'text-yellow-600'}`} />
                      <input
                        required
                        type="date"
                        min={todayDateString}
                        value={serviceFormData.date}
                        onChange={(e) => {
                          const selected = e.target.value;
                          if (selected && selected < todayDateString) {
                            setFieldErrors((prev) => ({ ...prev, date: 'Solo puedes agendar desde hoy en adelante' }));
                            return;
                          }
                          setFieldErrors((prev) => {
                            const next = { ...prev };
                            delete next.date;
                            return next;
                          });
                          setServiceFormData({ ...serviceFormData, date: selected });
                        }}
                        className="w-full bg-transparent pl-8 pr-2 py-1 font-bold outline-none text-gray-800 cursor-pointer"
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Nombre Completo *</Label>
                    <input
                      required
                      value={serviceFormData.clientName}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, clientName: e.target.value })}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none ${fieldErrors.clientName ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                      placeholder="Ej. Ana Perez Garcia"
                    />
                  </div>

                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Numero de Personas *</Label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="10"
                      value={serviceFormData.numPersonas}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const count = Math.max(1, parseInt(raw || '1', 10));
                        const servicesPerPerson = Array(count).fill(null).map((_, idx) =>
                          serviceFormData.servicesPerPerson[idx] || defaultServiceType
                        );
                        setServiceFormData({ ...serviceFormData, numPersonas: raw, servicesPerPerson });
                      }}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none ${fieldErrors.numPersonas ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Edad *</Label>
                    <input
                      required
                      type="text"
                      value={serviceFormData.edad}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, edad: e.target.value })}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none ${fieldErrors.edad ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                      placeholder="Ej: 4 y 9, o 25"
                    />
                  </div>

                  <div className="md:col-span-2 bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 space-y-3">
                    <p className="font-black text-purple-700 uppercase">Nivel de Infestacion por Persona</p>
                    {Array(parseInt(serviceFormData.numPersonas, 10) || 1).fill(null).map((_, idx) => (
                      <div key={idx}>
                        <Label className="font-bold text-gray-600 ml-2 mb-1 block">
                          {parseInt(serviceFormData.numPersonas, 10) === 1 ? 'Nivel de Infestacion *' : `Persona ${idx + 1} *`}
                        </Label>
                        <select
                          required
                          value={serviceFormData.servicesPerPerson[idx] || defaultServiceType}
                          onChange={(e) => {
                            const next = [...serviceFormData.servicesPerPerson];
                            next[idx] = e.target.value;
                            setServiceFormData({ ...serviceFormData, servicesPerPerson: next });
                          }}
                          className={`w-full border-2 rounded-2xl p-4 font-bold outline-none cursor-pointer ${fieldErrors.servicesPerPerson ? 'border-red-300 bg-red-50' : 'border-purple-200 bg-white focus:border-purple-400'}`}
                        >
                          {serviceTypeOptions.map((service) => (
                            <option key={service} value={service}>
                              {service} - {formatCurrency(serviceCatalog[service] || 0)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <div className="bg-green-500 text-white rounded-2xl p-3 font-black flex items-center justify-between">
                      <span>Total del Servicio:</span>
                      <span>
                        {formatCurrency((serviceFormData.servicesPerPerson || []).reduce((sum, serviceName) => sum + (serviceCatalog[serviceName] || 0), 0))}
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">WhatsApp *</Label>
                    <input
                      required
                      type="tel"
                      value={serviceFormData.whatsapp}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, whatsapp: e.target.value.replace(/\D/g, '') })}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none ${fieldErrors.whatsapp ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                      placeholder="3001234567"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Correo (opcional)</Label>
                    <input
                      type="email"
                      value={serviceFormData.email}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, email: e.target.value })}
                      className="w-full border-2 border-gray-200 bg-white rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                      placeholder="cliente@email.com"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Direccion *</Label>
                    <AddressAutocomplete
                      value={serviceFormData.direccion}
                      onChange={(value) => setServiceFormData({ ...serviceFormData, direccion: value })}
                      hasError={!!fieldErrors.direccion}
                      onSelect={(suggestion) => {
                        setServiceFormData((prev) => ({
                          ...prev,
                          direccion: suggestion.fullName,
                          lat: suggestion.lat,
                          lng: suggestion.lng
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Barrio *</Label>
                    <input
                      required
                      value={serviceFormData.barrio}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, barrio: e.target.value })}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none ${fieldErrors.barrio ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Descripcion de Ubicacion</Label>
                    <input
                      value={serviceFormData.descripcionUbicacion}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, descripcionUbicacion: e.target.value })}
                      className="w-full border-2 border-gray-200 bg-white rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                      placeholder="Conjunto, torre, apto..."
                    />
                  </div>

                  <div className="md:col-span-2 bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3">
                    <label className="flex items-center gap-3 font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={serviceFormData.hasAlergias}
                        onChange={(e) => setServiceFormData({ ...serviceFormData, hasAlergias: e.target.checked })}
                        className="w-5 h-5"
                      />
                      Tiene alergias o afectaciones de salud?
                    </label>
                    {serviceFormData.hasAlergias && (
                      <textarea
                        rows={3}
                        value={serviceFormData.detalleAlergias}
                        onChange={(e) => setServiceFormData({ ...serviceFormData, detalleAlergias: e.target.value })}
                        className="w-full border-2 border-red-200 bg-white rounded-2xl p-4 font-bold outline-none focus:border-red-400 resize-none"
                        placeholder="Describe las alergias o afectaciones..."
                      />
                    )}
                  </div>

                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Codigo de Referido (opcional)</Label>
                    <div className="relative">
                      <input
                        value={referralCode}
                        onChange={(e) => {
                          const code = e.target.value.toUpperCase();
                          setReferralCode(code);
                          if (code.length >= 4) validateReferralCode(code);
                          else setReferralValidation({ isValid: false, isValidating: false, message: '', referrerName: '' });
                        }}
                        className="w-full border-2 border-gray-200 bg-white rounded-2xl p-4 font-bold outline-none focus:border-yellow-400 uppercase"
                        placeholder="Ingresa codigo"
                      />
                      {referralValidation.isValidating && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm">...</span>}
                    </div>
                    {referralValidation.message && (
                      <p className={`text-xs font-bold mt-1 ${referralValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {referralValidation.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="font-bold text-gray-600 ml-2 mb-1 block">Asignar a Piojologa *</Label>
                    <select
                      required
                      value={serviceFormData.piojologistId}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, piojologistId: e.target.value })}
                      className={`w-full border-2 rounded-2xl p-4 font-bold outline-none cursor-pointer ${fieldErrors.piojologistId ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white focus:border-yellow-400'}`}
                    >
                      <option value="">Seleccionar piojologa...</option>
                      {piojologists.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} - {p.specialty}</option>
                      ))}
                    </select>
                  </div>
                  <div className={`md:col-span-2 p-4 rounded-2xl border-2 ${fieldErrors.terminosAceptados ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'}`}>
                    <label className="flex items-start gap-3 font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={serviceFormData.terminosAceptados}
                        onChange={(e) => setServiceFormData({ ...serviceFormData, terminosAceptados: e.target.checked })}
                        className={`w-5 h-5 mt-1 ${fieldErrors.terminosAceptados ? 'border-red-400' : 'border-green-300'}`}
                      />
                      Acepto los terminos y condiciones del servicio y la politica de bioseguridad.
                    </label>
                  </div>

                </div>

                <div className="space-y-3 mt-4">
                  <Button
                    type="button"
                    disabled={isSubmittingService}
                    onClick={(e) => handleServiceSubmit(e, false)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-green-700 disabled:opacity-60"
                  >
                    {isSubmittingService ? 'Guardando...' : 'Crear y Agregar Otro'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingService}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-yellow-700 disabled:opacity-60"
                  >
                    {isSubmittingService ? 'Guardando...' : 'Crear y Cerrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Filters */}
        <div className="mb-6 bg-yellow-50 rounded-2xl p-4 border-2 border-yellow-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1 block"> Cliente</Label>
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={serviceFilters.clientName}
                onChange={(e) => {
                  setServiceFilters({...serviceFilters, clientName: e.target.value});
                  setServicesPage(1);
                }}
                className="w-full bg-white border-2 border-yellow-200 rounded-xl p-2 text-sm font-medium outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1 block"> Tipo</Label>
              <select
                value={serviceFilters.serviceType}
                onChange={(e) => {
                  setServiceFilters({...serviceFilters, serviceType: e.target.value});
                  setServicesPage(1);
                }}
                className="w-full bg-white border-2 border-yellow-200 rounded-xl p-2 text-sm font-medium outline-none focus:border-yellow-400"
              >
                <option value="">Todos</option>
                {Object.keys(serviceCatalog).map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1 block">Piojóloga</Label>
              <select
                value={serviceFilters.piojologist}
                onChange={(e) => {
                  setServiceFilters({...serviceFilters, piojologist: e.target.value});
                  setServicesPage(1);
                }}
                className="w-full bg-white border-2 border-yellow-200 rounded-xl p-2 text-sm font-medium outline-none focus:border-yellow-400"
              >
                <option value="">Todas</option>
                {piojologists.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1 block"> Estado</Label>
              <select
                value={serviceFilters.status}
                onChange={(e) => {
                  setServiceFilters({...serviceFilters, status: e.target.value});
                  setServicesPage(1);
                }}
                className="w-full bg-white border-2 border-yellow-200 rounded-xl p-2 text-sm font-medium outline-none focus:border-yellow-400"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendiente</option>
                <option value="assigned">Asignado</option>
                <option value="accepted">Aceptado</option>
                <option value="completed">Completado</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1 block"> Rechazos</Label>
              <select
                value={serviceFilters.rejections}
                onChange={(e) => {
                  setServiceFilters({...serviceFilters, rejections: e.target.value});
                  setServicesPage(1);
                }}
                className="w-full bg-white border-2 border-yellow-200 rounded-xl p-2 text-sm font-medium outline-none focus:border-yellow-400"
              >
                <option value="all">Todos</option>
                <option value="has">Con rechazos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {(() => {
            const filteredAppointments = appointments
              .filter(apt => apt.status !== 'completed')
              .filter(apt => {
                const hasRejections = (() => {
                  const rh = apt.rejectionHistory || apt.rejection_history || apt.rejections;
                  if (Array.isArray(rh)) return rh.length > 0;
                  if (typeof rh === 'string') return rh.trim().length > 0;
                  return false;
                })();

                if (serviceFilters.clientName && !apt.clientName.toLowerCase().includes(serviceFilters.clientName.toLowerCase())) {
                  return false;
                }
                if (serviceFilters.serviceType && apt.serviceType !== serviceFilters.serviceType) {
                  return false;
                }
                if (serviceFilters.piojologist && apt.piojologistId !== parseInt(serviceFilters.piojologist)) {
                  return false;
                }
                if (serviceFilters.status !== 'all' && apt.status !== serviceFilters.status) {
                  return false;
                }
                if (serviceFilters.rejections === 'has' && !hasRejections) {
                  return false;
                }
                return true;
              });

            const seenIds = new Set();
            const uniqueAppointments = filteredAppointments.filter((apt) => {
              const key = apt.id;
              if (seenIds.has(key)) return false;
              seenIds.add(key);
              return true;
            });

            if (uniqueAppointments.length === 0) {
              return (
                <div className="col-span-full py-12 text-center bg-yellow-50 rounded-[2rem] border-2 border-dashed border-yellow-300">
                  <p className="text-xl font-bold text-yellow-600">
                    {serviceFilters.clientName || serviceFilters.serviceType || serviceFilters.piojologist || serviceFilters.status !== 'all'
                      ? ' No se encontraron servicios con esos filtros'
                      : 'No hay servicios activos! '
                    }
                  </p>
                </div>
              );
            }

            const statusConfig = {
              pending: { bg: 'bg-yellow-100', border: 'border-yellow-300', badge: 'bg-yellow-200 text-yellow-800', label: 'Pendiente' },
              assigned: { bg: 'bg-cyan-100', border: 'border-cyan-300', badge: 'bg-cyan-200 text-cyan-800', label: 'Asignado' },
              accepted: { bg: 'bg-green-100', border: 'border-green-300', badge: 'bg-green-200 text-green-800', label: 'Aceptado' },
              completed: { bg: 'bg-blue-100', border: 'border-blue-300', badge: 'bg-blue-200 text-blue-800', label: 'Completado' }
            };

            return uniqueAppointments
              .slice((servicesPage - 1) * servicesPerPage, servicesPage * servicesPerPage)
              .map(apt => {
                const config = statusConfig[apt.status] || { bg: 'bg-gray-100', border: 'border-gray-300', badge: 'bg-gray-200 text-gray-800', label: apt.status };
                
                return (
                  <div
                    key={`${apt.id}-${apt.date}-${apt.time || 'no-time'}`}
                    className={`${config.bg} border-3 ${config.border} p-5 rounded-3xl shadow-md hover:shadow-lg hover:border-opacity-75 transition-all cursor-pointer`}
                    onClick={() => {
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

                      setSelectedService({
                        ...apt,
                        rejectionHistory: normalizeHistory(apt.rejectionHistory || apt.rejection_history || apt.rejections)
                      });
                      setAssignPiojologistId(apt.piojologistId ? String(apt.piojologistId) : '');
                      setIsServiceDetailOpen(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-black text-xl text-gray-800 truncate">{apt.clientName}</span>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 ${config.badge} shadow-sm`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm mb-1 font-bold text-gray-700 opacity-80">
                      {apt.serviceType}
                      {apt.numPersonas && parseInt(apt.numPersonas) > 1 && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {apt.numPersonas} personas
                        </span>
                      )}
                    </p>
                    <p className="text-lg text-purple-600 mb-2 font-black">{formatCurrency(calculateServiceTotal(apt))}</p>
                    <p className="text-sm text-gray-500 mb-3 font-medium"> {apt.date} - {apt.time}</p>
                    <div className="bg-green-50 p-2 rounded-xl border border-green-200">
                      <p className="text-xs font-bold text-green-700">
                         {apt.piojologistName || 'Sin asignar'}
                      </p>
                    </div>
                  </div>
                );
              });
          })()}
        </div>

        {/* Pagination */}
        {(() => {
          const filteredCount = appointments
            .filter(apt => apt.status !== 'completed')
            .filter(apt => {
              if (serviceFilters.clientName && !apt.clientName.toLowerCase().includes(serviceFilters.clientName.toLowerCase())) {
                return false;
              }
              if (serviceFilters.serviceType && apt.serviceType !== serviceFilters.serviceType) {
                return false;
              }
              if (serviceFilters.piojologist && apt.piojologistId !== parseInt(serviceFilters.piojologist)) {
                return false;
              }
              if (serviceFilters.status !== 'all' && apt.status !== serviceFilters.status) {
                return false;
              }
              return true;
            }).length;
          
          return filteredCount > servicesPerPage && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                onClick={() => setServicesPage(prev => Math.max(1, prev - 1))}
                disabled={servicesPage === 1}
                className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-xl px-4 py-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 Anterior
              </Button>
              <span className="text-sm font-bold text-gray-600">
                Pgina {servicesPage} de {Math.ceil(filteredCount / servicesPerPage)}
              </span>
              <Button
                onClick={() => setServicesPage(prev => prev + 1)}
                disabled={servicesPage >= Math.ceil(filteredCount / servicesPerPage)}
                className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-xl px-4 py-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente 
              </Button>
            </div>
          );
        })()}
      </div>

      {/* Calendario (al final) */}
      <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-yellow-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-bl-full opacity-50 -mr-4 -mt-4"></div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 relative z-10">
          <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
            Agenda General
          </h3>
        </div>
        <div className="relative z-10">
          <ScheduleCalendar
            appointments={appointments}
            piojologists={piojologists}
            enablePiojologistFilter
            title="Agenda General"
            onAssign={onAssignFromCalendar}
            serviceCatalog={serviceCatalog}
            formatCurrency={formatCurrency}
          />
        </div>
      </div>

      {/* Service Detail Modal */}
      <Dialog
        open={isServiceDetailOpen}
        onOpenChange={(open) => {
          setIsServiceDetailOpen(open);
          if (!open) setSelectedService(null);
        }}
      >
        <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 overflow-hidden bg-yellow-50 max-w-xl shadow-2xl">
          {selectedService && (
            <div className="bg-transparent">
              <DialogHeader className="sr-only">
                <DialogTitle>Detalle del Servicio: {selectedService.clientName}</DialogTitle>
              </DialogHeader>
              <div className="text-center pt-8 pb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <ClipboardList className="w-6 h-6 text-yellow-600" />
                  <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                    DETALLE DEL SERVICIO
                  </h2>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                <div className="px-6 md:px-8 pb-8 space-y-6">
                  <div className="text-center">
                    <h3 className="text-2xl md:text-3xl font-black text-gray-800">{selectedService.clientName}</h3>
                    <p className="text-sm font-bold text-gray-600 mt-1">{selectedService.serviceType}</p>
                    
                    {/* Valor del servicio destacado */}
                    <div className="mt-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-4 shadow-lg border-2 border-green-400">
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-white font-black text-base uppercase">?? Valor del Servicio:</span>
                        <span className="text-white font-black text-2xl">{formatCurrency(calculateServiceTotal(selectedService))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700">
                    ?? {selectedService.date} - {selectedService.time}
                  </div>
                </div>

                <div className="bg-white border-2 border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-700 flex items-center justify-between">
                  <div>
                     Método de pago<br />
                    <span className="text-gray-800">
                      {(() => {
                        const payment = selectedService.paymentMethod || selectedService.payment_method;
                        if (payment === 'pay_now') return 'Paga en lnea';
                        if (payment === 'pay_later') return 'Paga despus del servicio';
                        return 'Paga despus del servicio';
                      })()}
                    </span>
                  </div>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-black">
                    {(selectedService.paymentMethod || selectedService.payment_method || 'pay_later') === 'pay_now' ? 'Online' : 'Contraentrega'}
                  </span>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-700">
                   {selectedService.piojologistName || 'Sin asignar'}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                     Dirección:<br />
                    <span className="font-bold text-gray-800">{selectedService.direccion || selectedService.address || 'No registrada'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                     Barrio:<br />
                    <span className="font-bold text-gray-800">{selectedService.barrio || 'No registrado'}</span>
                  </div>
                  {selectedService.descripcionUbicacion && (
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 col-span-1 md:col-span-2">
                       Detalles de ubicación:<br />
                      <span className="font-bold text-gray-800">{selectedService.descripcionUbicacion}</span>
                    </div>
                  )}
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                     WhatsApp:<br />
                    <span className="font-bold text-gray-800">{selectedService.whatsapp || 'No registrado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                     Email:<br />
                    <span className="font-bold text-gray-800">{selectedService.email || 'No registrado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                     Personas:<br />
                    <span className="font-bold text-gray-800">{selectedService.numPersonas || 'No informado'}</span>
                    {selectedService.services_per_person && Array.isArray(selectedService.services_per_person) && selectedService.services_per_person.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs">
                        {selectedService.services_per_person.map((service, idx) => (
                          <div key={idx} className="text-gray-600">
                            {idx + 1}. {service} - {formatCurrency(serviceCatalog[service] || 0)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    ?? Edad:<br />
                    <span className="font-bold text-gray-800">{selectedService.edad || 'No informado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                     Referido por:<br />
                    <span className="font-bold text-gray-800">{selectedService.referidoPor || 'No informado'}</span>
                  </div>
                </div>

                {Array.isArray(selectedService.rejectionHistory) && selectedService.rejectionHistory.length > 0 && (
                  (() => {
                    const counts = selectedService.rejectionHistory.reduce((acc, name) => {
                      const key = name || 'Piojóloga';
                      acc[key] = (acc[key] || 0) + 1;
                      return acc;
                    }, {});
                    const entries = Object.entries(counts);

                    return (
                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-sm font-semibold text-red-700 space-y-2">
                        <div className="flex items-center gap-2">
                          <span> Rechazos previos</span>
                          <span className="text-xs text-red-600 font-bold bg-white/70 px-2 py-0.5 rounded-full border border-red-200">
                            {selectedService.rejectionHistory.length}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {entries.map(([name, total]) => (
                            <span
                              key={name}
                              className="bg-white text-red-700 border border-red-200 rounded-full px-3 py-1 text-xs font-bold shadow-sm"
                            >
                              {name}{total > 1 ? ` (x${total})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()
                )}

                {(selectedService.status === 'pending' || selectedService.status === 'assigned' || selectedService.status === 'accepted') && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-black text-gray-600 uppercase">
                      {selectedService.piojologistName ? '?? Reasignar a otra piojóloga' : 'Asignar a piojóloga'}
                    </p>
                    <div className="flex flex-col gap-2">
                      <select
                        value={assignPiojologistId}
                        onChange={(e) => setAssignPiojologistId(e.target.value)}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2 text-sm font-semibold text-gray-700 focus:border-yellow-400 outline-none"
                      >
                        <option value="">Seleccionar...</option>
                        {piojologists.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        onClick={handleAssignService}
                        className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-xl px-4 py-2 font-bold border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1"
                      >
                        {selectedService.piojologistName ? '?? Reasignar' : 'Asignar'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Botón Eliminar - Solo para pending y assigned */}
                {(selectedService.status === 'pending' || selectedService.status === 'assigned') && onDeleteBooking && (
                  <div className="mt-4 pt-4 border-t-2 border-gray-200">
                    <Button
                      type="button"
                      onClick={() => {
                        setBookingToDelete(selectedService);
                        setDeleteConfirmOpen(true);
                      }}
                      className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-3 font-bold border-b-4 border-red-700 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar Agendamiento
                    </Button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Solo se pueden eliminar agendamientos pendientes o asignados
                    </p>
                  </div>
                )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden sm:max-w-md bg-red-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Trash2 className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-black text-red-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                CONFIRMAR ELIMINACIÓN
              </h2>
            </div>
          </div>
          <div className="px-6 md:px-8 pb-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <h3 className="text-xl font-black text-gray-800">
                  ¿Estás seguro?
                </h3>
                <p className="text-base text-gray-600 font-bold">
                  {bookingToDelete ? (
                    <>
                      El agendamiento de{' '}
                      <span className="text-red-600 font-black">"{bookingToDelete.clientName}"</span>{' '}
                      será eliminado permanentemente.
                    </>
                  ) : (
                    'Este agendamiento será eliminado permanentemente.'
                  )}
                </p>
                {bookingToDelete && (
                  <div className="bg-white rounded-2xl p-4 border-2 border-red-200 mt-4">
                    <p className="text-sm font-bold text-gray-700">
                      ?? {bookingToDelete.date} - {bookingToDelete.time}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      {bookingToDelete.serviceType}
                    </p>
                  </div>
                )}
                <p className="text-sm text-gray-500 mt-3">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setBookingToDelete(null);
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl py-4 font-bold border-2 border-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (bookingToDelete && onDeleteBooking) {
                    const backendId = bookingToDelete.backendId || bookingToDelete.bookingId || bookingToDelete.id;
                    const result = await onDeleteBooking(backendId);
                    if (result && result.success) {
                      setDeleteConfirmOpen(false);
                      setBookingToDelete(null);
                      setIsServiceDetailOpen(false);
                      setSelectedService(null);
                      toast({
                        title: "??? Agendamiento Eliminado",
                        description: "El agendamiento ha sido eliminado exitosamente",
                        className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
                      });
                    } else {
                      setDeleteConfirmOpen(false);
                      toast({
                        title: "? No se puede eliminar",
                        description: result?.message || "El agendamiento no puede ser eliminado",
                        variant: "destructive",
                        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
                      });
                    }
                  }
                }}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-4 font-bold shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleManagement;


