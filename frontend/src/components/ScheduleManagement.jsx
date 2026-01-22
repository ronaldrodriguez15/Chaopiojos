import React, { useState } from 'react';
import { Calendar, Trash2, Edit } from 'lucide-react';
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

  const handleServiceSubmit = (e) => {
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
    setIsServiceDialogOpen(false);
    resetServiceForm();
    toast({ 
      title: "¡Servicio Creado! ✨", 
      className: "bg-yellow-100 text-yellow-800 rounded-2xl border-2 border-yellow-200" 
    });
  };

  const handleAssignService = async () => {
    if (!selectedService || selectedService.status !== 'pending') return;
    if (!assignPiojologistId) {
      toast({
        title: 'Selecciona una piojóloga',
        description: 'Debes elegir a quién asignar este agendamiento.',
        className: 'rounded-2xl border-2 border-yellow-200 bg-yellow-50 text-yellow-700 font-bold'
      });
      return;
    }

    const selectedPio = piojologists.find(p => String(p.id) === String(assignPiojologistId));

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
      title: 'Asignado con éxito',
      description: selectedPio ? `Asignado a ${selectedPio.name}` : 'Asignación guardada',
      className: 'rounded-2xl border-2 border-green-200 bg-green-50 text-green-700 font-bold'
    });
  };

  return (
    <div className="space-y-6">
      {/* Calendario */}
      <ScheduleCalendar
        appointments={appointments}
        piojologists={piojologists}
        enablePiojologistFilter
        title="Agenda General"
        onAssign={onAssignFromCalendar}
      />

      {/* Gestión de Servicios */}
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-yellow-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-bl-full opacity-50 -mr-4 -mt-4"></div>
        
        <div className="flex justify-between items-center mb-6 relative z-10">
          <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
            <span className="text-3xl">📋</span> Servicios Activos
          </h3>
          <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-2xl px-6 py-6 font-bold text-lg shadow-md border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1">
                <Calendar className="w-6 h-6 mr-2" />
                Crear Servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-8 border-yellow-100 p-0 overflow-hidden sm:max-w-md bg-white max-h-[90vh] flex flex-col">
              <div className="bg-yellow-400 p-6 text-white text-center flex-shrink-0">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black">Nuevo Servicio ✨</DialogTitle>
                </DialogHeader>
              </div>
              <form onSubmit={handleServiceSubmit} className="p-8 space-y-4 flex-1 overflow-y-auto">
                <div>
                  <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nombre del Cliente</Label>
                  <input 
                    required
                    value={serviceFormData.clientName}
                    onChange={e => setServiceFormData({...serviceFormData, clientName: e.target.value})}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-yellow-400"
                    placeholder="Ej. Familia Pérez"
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
                <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl py-6 font-bold mt-4 shadow-md border-b-4 border-yellow-700">
                  Crear y Asignar Servicio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Filters */}
        <div className="mb-6 bg-yellow-50 rounded-2xl p-4 border-2 border-yellow-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs font-bold text-gray-600 mb-1 block">🔍 Cliente</Label>
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
              <Label className="text-xs font-bold text-gray-600 mb-1 block">📊 Tipo</Label>
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
              <Label className="text-xs font-bold text-gray-600 mb-1 block">🦸 Piojóloga</Label>
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
              <Label className="text-xs font-bold text-gray-600 mb-1 block">🎯 Estado</Label>
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
              <Label className="text-xs font-bold text-gray-600 mb-1 block">⚠️ Rechazos</Label>
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
                      ? '🔍 No se encontraron servicios con esos filtros'
                      : '¡No hay servicios activos! 🌟'
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
                      <span className="font-bold text-lg truncate">{apt.clientName}</span>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 ${config.badge} shadow-sm`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-sm mb-1 font-bold text-gray-700 opacity-80">{apt.serviceType}</p>
                    <p className="text-lg text-purple-600 mb-2 font-black">{formatCurrency(serviceCatalog[apt.serviceType] || 0)}</p>
                    <p className="text-sm text-gray-500 mb-3 font-medium">📅 {apt.date} - {apt.time}</p>
                    <div className="bg-green-50 p-2 rounded-xl border border-green-200">
                      <p className="text-xs font-bold text-green-700">
                        👨‍⚕️ {apt.piojologistName || 'Sin asignar'}
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
                ← Anterior
              </Button>
              <span className="text-sm font-bold text-gray-600">
                Página {servicesPage} de {Math.ceil(filteredCount / servicesPerPage)}
              </span>
              <Button
                onClick={() => setServicesPage(prev => prev + 1)}
                disabled={servicesPage >= Math.ceil(filteredCount / servicesPerPage)}
                className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-xl px-4 py-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente →
              </Button>
            </div>
          );
        })()}
      </div>

      {/* Service Detail Modal */}
      <Dialog
        open={isServiceDetailOpen}
        onOpenChange={(open) => {
          setIsServiceDetailOpen(open);
          if (!open) setSelectedService(null);
        }}
      >
        <DialogContent className="rounded-[2.5rem] border-8 border-yellow-100 p-0 overflow-hidden max-w-xl">
          {selectedService && (
            <div className="bg-white">
              <div className="bg-yellow-400 p-6 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">{selectedService.clientName}</DialogTitle>
                  <p className="text-sm font-bold text-white/80">{selectedService.serviceType}</p>
                </DialogHeader>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm font-bold text-gray-700">
                    📅 {selectedService.date} - {selectedService.time}
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm font-black text-purple-700">
                    💵 {formatCurrency(serviceCatalog[selectedService.serviceType] || 0)}
                  </div>
                </div>

                <div className="bg-white border-2 border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-700 flex items-center justify-between">
                  <div>
                    💳 Método de pago<br />
                    <span className="text-gray-800">
                      {(() => {
                        const payment = selectedService.paymentMethod || selectedService.payment_method;
                        if (payment === 'pay_now') return 'Paga en línea (Bold)';
                        if (payment === 'pay_later') return 'Paga después del servicio';
                        return 'No registrado';
                      })()}
                    </span>
                  </div>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-black">
                    {(selectedService.paymentMethod || selectedService.payment_method || 'pay_later') === 'pay_now' ? 'Online' : 'Contraentrega'}
                  </span>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3 text-sm font-semibold text-gray-700">
                  👨‍⚕️ {selectedService.piojologistName || 'Sin asignar'}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    📍 Dirección:<br />
                    <span className="font-bold text-gray-800">{selectedService.direccion || selectedService.address || 'No registrada'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    🏘️ Barrio:<br />
                    <span className="font-bold text-gray-800">{selectedService.barrio || 'No registrado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    📞 WhatsApp:<br />
                    <span className="font-bold text-gray-800">{selectedService.whatsapp || 'No registrado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    ✉️ Email:<br />
                    <span className="font-bold text-gray-800">{selectedService.email || 'No registrado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    👥 Personas:<br />
                    <span className="font-bold text-gray-800">{selectedService.numPersonas || 'No informado'}</span>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                    🪱 Referido por:<br />
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
                          <span>⚠️ Rechazos previos</span>
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

                {selectedService.status === 'pending' && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-black text-gray-600 uppercase">Asignar a piojóloga</p>
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
                        Asignar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScheduleManagement;
