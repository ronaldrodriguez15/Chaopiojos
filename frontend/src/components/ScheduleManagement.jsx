import React, { useState } from 'react';
import { Calendar, Trash2, Edit, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
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
  updateAppointments,
  onAssignFromCalendar
}) => {
  // Función auxiliar para calcular el total del servicio
  const calculateServiceTotal = (appointment) => {
    // Si tiene services_per_person, sumar todos los servicios
    if (appointment.services_per_person && Array.isArray(appointment.services_per_person)) {
      return appointment.services_per_person.reduce((total, serviceType) => {
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
  const servicesPerPage = 6;
  const [serviceFilters, setServiceFilters] = useState({
    clientName: '',
    serviceType: '',
    piojologist: '',
    status: 'all',
    rejections: 'all' // all | has
  });
  const [serviceFormData, setServiceFormData] = useState({
    clientName: '',
    serviceType: '',
    date: '',
    time: '',
    piojologistId: '',
    yourLoss: '',
    ourPayment: '',
    total: '',
    age: '',
    whatsapp: '',
    direccion: '',
    barrio: '',
    numPersonas: '',
    hasAlergias: false,
    detalleAlergias: '',
    referidoPor: '',
    terminosAceptados: false
  });

  const resetServiceForm = () => {
    setServiceFormData({
      clientName: '',
      serviceType: '',
      date: '',
      time: '',
      piojologistId: '',
      yourLoss: '',
      ourPayment: '',
      total: '',
      age: '',
      whatsapp: '',
      direccion: '',
      barrio: '',
      numPersonas: '',
      hasAlergias: false,
      detalleAlergias: '',
      referidoPor: '',
      terminosAceptados: false
    });
  };

  const handleServiceSubmit = (e, closeDialog = true) => {
    e.preventDefault();
    const piojologist = piojologists.find(p => p.id === parseInt(serviceFormData.piojologistId));
    const servicePrice = serviceCatalog[serviceFormData.serviceType] || 0;
    
    const newService = {
      id: Date.now(),
      clientName: serviceFormData.clientName,
      serviceType: serviceFormData.serviceType,
      date: serviceFormData.date,
      time: serviceFormData.time,
      piojologistId: parseInt(serviceFormData.piojologistId),
      piojologistName: piojologist?.name || null,
      status: 'pending',
      estimatedPrice: servicePrice,
      yourLoss: serviceFormData.yourLoss || '0',
      ourPayment: serviceFormData.ourPayment || '0',
      total: serviceFormData.total || '0',
      age: serviceFormData.age || '',
      whatsapp: serviceFormData.whatsapp || '',
      direccion: serviceFormData.direccion || '',
      barrio: serviceFormData.barrio || '',
      numPersonas: serviceFormData.numPersonas || '',
      hasAlergias: serviceFormData.hasAlergias || '',
      detalleAlergias: serviceFormData.detalleAlergias || '',
      referidoPor: serviceFormData.referidoPor || ''
    };

    updateAppointments([...appointments, newService]);
    
    // Cerrar diálogo solo si se solicita
    if (closeDialog) {
      setIsServiceDialogOpen(false);
    }
    
    resetServiceForm();
    toast({ 
      title: closeDialog ? "Servicio Creado!" : "¡Servicio Creado! Puedes agregar otro", 
      className: "bg-yellow-100 text-yellow-800 rounded-2xl border-2 border-yellow-200" 
    });
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
      title: wasReassignment ? '🔄 Reasignado con éxito' : '✓ Asignado con éxito',
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
          <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-2xl px-4 sm:px-6 py-4 sm:py-6 font-bold text-base sm:text-lg shadow-md hover:shadow-lg border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 w-full sm:w-auto justify-center">
                <Calendar className="w-6 h-6 mr-2" />
                Crear Servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 overflow-hidden sm:max-w-md bg-yellow-50 shadow-2xl">
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
              <form onSubmit={handleServiceSubmit} className="relative px-6 md:px-8 pb-8 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nombre del Cliente</Label>
                  <input 
                    required
                    value={serviceFormData.clientName}
                    onChange={e => setServiceFormData({...serviceFormData, clientName: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                    placeholder="Ej. Familia Prez"
                  />
                </div>
                <div>
                  <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nivel de Infestación</Label>
                  <select 
                    required
                    value={serviceFormData.serviceType}
                    onChange={e => setServiceFormData({...serviceFormData, serviceType: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-yellow-400 cursor-pointer"
                  >
                    <option value="">Seleccionar...</option>
                    {Object.keys(serviceCatalog).map(service => (
                      <option key={service} value={service}>
                        {service} - {formatCurrency(serviceCatalog[service])}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-bold text-gray-500 ml-2 mb-1 block">Fecha</Label>
                    <input 
                      required
                      type="date"
                      value={serviceFormData.date}
                      onChange={e => setServiceFormData({...serviceFormData, date: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <Label className="font-bold text-gray-500 ml-2 mb-1 block">Hora</Label>
                    <input 
                      required
                      type="time"
                      value={serviceFormData.time}
                      onChange={e => setServiceFormData({...serviceFormData, time: e.target.value})}
                      className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
                <div>
                  <Label className="font-bold text-gray-500 ml-2 mb-1 block">Asignar a Piojóloga</Label>
                  <select 
                    required
                    value={serviceFormData.piojologistId}
                    onChange={e => setServiceFormData({...serviceFormData, piojologistId: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                  >
                    <option value="">Seleccionar piojóloga...</option>
                    {piojologists.map(p => (
                      <option key={p.id} value={p.id}>{p.name} - {p.specialty}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3 mt-4">
                  <Button 
                    type="button"
                    onClick={(e) => handleServiceSubmit(e, false)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-green-700"
                  >
                    ➕ Crear y Agregar Otro
                  </Button>
                  <Button 
                    type="submit" 
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-yellow-700"
                  >
                    ✓ Crear y Cerrar
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
                        <span className="text-white font-black text-base uppercase">💰 Valor del Servicio:</span>
                        <span className="text-white font-black text-2xl">{formatCurrency(calculateServiceTotal(selectedService))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700">
                    🕐 {selectedService.date} - {selectedService.time}
                  </div>
                </div>

                <div className="bg-white border-2 border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-700 flex items-center justify-between">
                  <div>
                     Método de pago<br />
                    <span className="text-gray-800">
                      {(() => {
                        const payment = selectedService.paymentMethod || selectedService.payment_method;
                        if (payment === 'pay_now') return 'Paga en lnea (Bold)';
                        if (payment === 'pay_later') return 'Paga despus del servicio';
                        return 'No registrado';
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
                    🎂 Edad:<br />
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
                      {selectedService.piojologistName ? '🔄 Reasignar a otra piojóloga' : 'Asignar a piojóloga'}
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
                        {selectedService.piojologistName ? '🔄 Reasignar' : 'Asignar'}
                      </Button>
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleManagement;


