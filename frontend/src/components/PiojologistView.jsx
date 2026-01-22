import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, Calendar, User, Check, X, Clock, Zap, Star, DollarSign, ShoppingBag, ArrowRight, Clock3, CalendarClock, Users, BarChart3, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
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
import ScheduleCalendar from '@/components/ScheduleCalendar';
import ProductRequestView from '@/components/ProductRequestView';
import { bookingService } from '@/lib/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const PiojologistView = ({ currentUser, appointments, updateAppointments, bookings = [], updateBookings, products, handleCompleteService, serviceCatalog = {}, formatCurrency, productRequests, onCreateProductRequest, onNotify }) => {
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [finishingAppointmentId, setFinishingAppointmentId] = useState(null);
  const [finishingPlan, setFinishingPlan] = useState('');
  const [finishingPrice, setFinishingPrice] = useState('');
  const [finishingNotes, setFinishingNotes] = useState('');
  const [servicesView, setServicesView] = useState(() => localStorage.getItem('piojoServicesView') || 'assigned'); // assigned | rejected
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('piojoTab') || 'panel');

  useEffect(() => {
    localStorage.setItem('piojoServicesView', servicesView);
  }, [servicesView]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    localStorage.setItem('piojoTab', value);
  };

  const getServicePrice = (apt = {}) => {
    const raw = apt.price ?? apt.price_confirmed ?? apt.estimatedPrice ?? serviceCatalog[apt.serviceType] ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
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

  const handleReject = async (appointmentId) => {
    const appointment = appointments.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId);
    const backendId = appointment?.backendId || appointment?.bookingId || appointmentId;
    const addRejectionHistory = (apt) => {
      const history = Array.isArray(apt.rejectionHistory) ? apt.rejectionHistory : [];
      return [...history, currentUser.name];
    };
    
    try {
      // Actualizar en el backend devolviendo a pendiente
      if (appointment?.isPublicBooking || appointment?.backendId || appointmentId?.toString().startsWith('booking-')) {
        const rejectionHistory = addRejectionHistory(appointment);
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
      if (appointment?.isPublicBooking) {
        const rejectionHistory = addRejectionHistory(appointment);
        const updatedBookings = bookings.map(apt => 
          (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
            ? { ...apt, status: 'pending', piojologistId: null, piojologistName: null, rejectionHistory } 
            : apt
        );
        updateBookings && updateBookings(updatedBookings);
      } else {
        const rejectionHistory = addRejectionHistory(appointment);
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
          message: `${currentUser.name} rechazó el agendamiento de ${appointment?.clientName}. Necesita reasignación.`,
          appointment: appointment
        });
      }
      
      toast({ 
        title: "Misión rechazada 🙅", 
        description: "El agendamiento regresó a pendientes para reasignación.",
        className: "bg-red-100 rounded-2xl border-2 border-red-200 text-red-700 font-bold" 
      });
    } catch (error) {
      console.error('Error al rechazar agendamiento:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al rechazar el agendamiento",
        variant: "destructive",
        className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
      });
    }
  };

  const handleProductToggle = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const onCompleteService = async () => {
    if (!finishingAppointmentId) return;

    const priceValue = parseFloat(finishingPrice || '0');
    if (!finishingPlan) {
      toast({ title: 'Selecciona un plan', className: 'bg-red-100 border-2 border-red-200 text-red-700 font-bold' });
      return;
    }
    if (isNaN(priceValue) || priceValue <= 0) {
      toast({ title: 'Ingresa un valor válido', className: 'bg-red-100 border-2 border-red-200 text-red-700 font-bold' });
      return;
    }

    await handleCompleteService(finishingAppointmentId, selectedProducts, {
      planType: finishingPlan,
      priceConfirmed: priceValue,
      notes: finishingNotes
    });
    
    setFinishingAppointmentId(null);
    setSelectedProducts([]);
    setFinishingPlan('');
    setFinishingPrice('');
    setFinishingNotes('');
    toast({
      title: "¡Victoria Total! 🏆",
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

  const pendingAssignments = appointments.filter(apt => apt.piojologistId === currentUser.id && apt.status === 'assigned');
  const assignedToMe = appointments.filter(apt => apt.piojologistId === currentUser.id && (apt.status === 'accepted' || apt.status === 'confirmed'));
  const myCalendarAppointments = appointments.filter(apt => apt.piojologistId === currentUser.id && apt.status !== 'cancelled');
  const completedHistory = appointments.filter(apt => apt.piojologistId === currentUser.id && apt.status === 'completed');
  const myRejectedServices = appointments.filter(apt => normalizeHistory(apt.rejectionHistory || apt.rejection_history || apt.rejections).includes(currentUser.name));
  const visibleServices = servicesView === 'rejected' ? myRejectedServices : assignedToMe;
  const totalEarnings = completedHistory.reduce((acc, apt) => acc + (getServicePrice(apt) * 0.5 - (Number(apt.deductions) || 0)), 0);
  const myProductRequests = (productRequests || []).filter(req => req.piojologistId === currentUser.id);
  const kitRequestedOnce = myProductRequests.some(req => req.isKitCompleto);
  const pendingRequests = myProductRequests.filter(req => req.status === 'pending').length;
  const approvedRequests = myProductRequests.filter(req => req.status === 'approved').length;
  const rejectedRequests = myProductRequests.filter(req => req.status === 'rejected').length;
  const upcomingServices = assignedToMe.slice(0, 3);

  // Datos para charts
  const serviceCounts = {
    asignados: pendingAssignments.length + assignedToMe.length,
    completados: completedHistory.length,
    pendientes: pendingAssignments.length
  };

  const statusCounts = {
    pendiente: appointments.filter(a => a.piojologistId === currentUser.id && (a.status === 'pending')).length,
    asignado: appointments.filter(a => a.piojologistId === currentUser.id && (a.status === 'assigned')).length,
    aceptado: appointments.filter(a => a.piojologistId === currentUser.id && (a.status === 'accepted')).length,
    completado: completedHistory.length
  };

  const barData = {
    labels: ['Asignados', 'Completados', 'Pendientes'],
    datasets: [
      {
        label: 'Servicios',
        data: [serviceCounts.asignados, serviceCounts.completados, serviceCounts.pendientes],
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b'],
        borderRadius: 12
      }
    ]
  };

  const earningsByMonthMap = completedHistory.reduce((acc, apt) => {
    const date = apt.date ? new Date(apt.date) : new Date();
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const net = getServicePrice(apt) * 0.5 - (Number(apt.deductions) || 0);
    acc[key] = (acc[key] || 0) + net;
    return acc;
  }, {});

  const monthKeys = Object.keys(earningsByMonthMap).sort().slice(-6);
  const earningsLabels = monthKeys.map(key => {
    const [year, month] = key.split('-');
    return new Date(Number(year), Number(month) - 1).toLocaleDateString('es-ES', { month: 'short' });
  });
  const earningsValues = monthKeys.map(key => earningsByMonthMap[key]);

  const earningsBarData = {
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

  const statusPieData = {
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
  };

  return (
    <div className="space-y-8">
      <motion.div
        className="bg-gradient-to-r from-lime-400 to-green-400 rounded-[3rem] shadow-xl p-8 text-white relative overflow-hidden border-4 border-white"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
         <div className="absolute -right-10 -top-10 w-48 h-48 bg-white opacity-20 rounded-full animate-pulse"></div>
         
         <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
           <div className="flex items-center gap-6">
             <div className="p-4 bg-white/30 rounded-3xl backdrop-blur-md shadow-lg">
               <Zap className="w-12 h-12 text-white" />
             </div>
             <div>
               <h2 className="text-4xl font-black mb-1 drop-shadow-md">Central de Héroes</h2>
               <p className="text-lime-100 text-xl font-bold">¡Hola, {currentUser.name}!</p>
               <span className="inline-block mt-2 bg-white/20 px-3 py-1 rounded-full text-sm font-medium border border-white/30">
                 {currentUser.specialty || 'Experto General'}
               </span>
             </div>
           </div>
           
           <div className="flex gap-4">
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md text-center min-w-[150px]">
              <span className="block text-4xl font-black">{formatCurrency(totalEarnings)}</span>
              <span className="text-sm font-bold opacity-90">Mis Ganancias</span>
            </div>
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md text-center min-w-[150px]">
              <span className="block text-4xl font-black">{assignedToMe.length}</span>
              <span className="text-sm font-bold opacity-90">Servicios Asignados</span>
            </div>
           </div>
         </div>
      </motion.div>

      {/* Sección de Asignaciones Pendientes */}
      {pendingAssignments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-200 via-teal-100 to-cyan-100 rounded-[3rem] p-8 shadow-2xl border-4 border-emerald-300 mb-8"
        >
          <h2 className="text-3xl font-black text-emerald-900 mb-6 flex items-center gap-3">
            🔔 Asignaciones Pendientes ({pendingAssignments.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingAssignments.map(apt => (
              <div key={apt.id} className="bg-white rounded-[2rem] p-6 shadow-lg border-4 border-emerald-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-400 text-white px-4 py-1 rounded-bl-2xl font-black text-xs uppercase tracking-wider">
                  Esperando Aceptación
                </div>
                
                <div className="flex items-center gap-3 mb-4 mt-2">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-2xl text-emerald-700">
                    ⏳
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-black text-gray-800 text-lg leading-tight">{apt.clientName}</h3>
                    <p className="text-xs text-emerald-700 font-bold uppercase">{apt.serviceType}</p>
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-2xl space-y-2 mb-4">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                    <span>💰 Valor:</span>
                    <span className="text-purple-600">{formatCurrency(apt.estimatedPrice || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                    <span>📅 Fecha:</span>
                    <span className="text-emerald-700">{new Date(apt.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                    <span>⏰ Hora:</span>
                    <span className="text-emerald-700">{apt.time}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                    <span>📍 Dirección:</span>
                    <span className="text-gray-800 text-xs">{apt.direccion || apt.address || apt.addressLine || 'Sin dirección registrada'}</span>
                  </div>
                </div>

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
            ))}
          </div>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full bg-white/50 p-2 rounded-[2rem] border-2 border-green-100 mb-8 flex-wrap h-auto gap-2">
          <TabsTrigger value="panel" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-amber-400 data-[state=active]:text-white transition-all">
            📊 Mi Panel
          </TabsTrigger>
          <TabsTrigger value="agenda" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-green-400 data-[state=active]:text-white transition-all">
            📅 Mis Servicios ({assignedToMe.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-blue-400 data-[state=active]:text-white transition-all">
            📜 Historial
          </TabsTrigger>
          <TabsTrigger value="products" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-purple-400 data-[state=active]:text-white transition-all">
            📦 Productos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="panel">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-[1.75rem] p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-4 border-blue-200 shadow-xl flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/70 text-blue-700 border-2 border-blue-100">
                <Clock3 className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-blue-700">Total Citas</p>
                <p className="text-4xl font-black text-blue-800 leading-tight">{myCalendarAppointments.length}</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-4 border-yellow-200 shadow-xl flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/70 text-yellow-600 border-2 border-yellow-100">
                <CalendarClock className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-yellow-700">Pendientes</p>
                <p className="text-4xl font-black text-yellow-700 leading-tight">{statusCounts.pendiente + statusCounts.asignado}</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] p-6 bg-gradient-to-br from-emerald-50 to-emerald-100 border-4 border-emerald-200 shadow-xl flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/70 text-emerald-700 border-2 border-emerald-100">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-emerald-700">Servicios Activos</p>
                <p className="text-4xl font-black text-emerald-800 leading-tight">{pendingAssignments.length + assignedToMe.length}</p>
              </div>
            </div>
            <div className="rounded-[1.75rem] p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-4 border-purple-200 shadow-xl flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/70 text-purple-700 border-2 border-purple-100">
                <DollarSign className="w-8 h-8" />
              </div>
              <div>
                <p className="text-sm font-black text-purple-700">Ingresos Totales</p>
                <p className="text-4xl font-black text-purple-800 leading-tight">{formatCurrency(totalEarnings)}</p>
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
          <div className="mb-8">
            <ScheduleCalendar
              appointments={myCalendarAppointments}
              piojologists={[currentUser]}
              title="Mi Agenda"
            />
          </div>

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
                      <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                        <span>💰 Valor:</span>
                        <span className="text-purple-600">{formatCurrency(apt.estimatedPrice || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                        <span>📅 Fecha:</span>
                        <span className="text-green-600">{new Date(apt.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold text-gray-600">
                        <span>⏰ Hora:</span>
                        <span className="text-green-600">{apt.time}</span>
                      </div>
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

                   <div className="mt-auto space-y-2">
                     {servicesView === 'rejected' && Array.isArray(apt.rejectionHistory) && (
                       <div className="bg-white border-2 border-red-100 rounded-xl p-3 text-xs font-bold text-red-700 flex items-center gap-2">
                         <span>⚠️ Rechazos registrados:</span>
                         <span className="bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{apt.rejectionHistory.filter(name => name === currentUser.name).length}</span>
                       </div>
                     )}
                     {apt.status === 'pending' && servicesView !== 'rejected' && (
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
                                const basePrice = getServicePrice(apt);
                                setFinishingPlan(apt.planType || apt.serviceType || 'Normal');
                                setFinishingPrice(basePrice);
                                setFinishingNotes(apt.serviceNotes || '');
                             }}
                             className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-blue-700 active:border-b-0 active:translate-y-1"
                           >
                             <Check className="mr-2" /> Completar Servicio
                           </Button>
                         </DialogTrigger>
                         <DialogContent className="rounded-[2.5rem] border-8 border-blue-100 p-0 overflow-hidden sm:max-w-md w-[95vw] max-h-[90vh] bg-white">
                        <div className="bg-blue-400 p-6 text-white text-center">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Reporte de Misión 📋</DialogTitle>
                          </DialogHeader>
                        </div>
                          <div className="p-6 space-y-6 bg-gradient-to-b from-blue-50 via-white to-blue-50">
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
                                  <p className="text-base">{apt.time}</p>
                                </div>
                                <div className="col-span-2 bg-pink-50 border border-pink-100 rounded-xl p-3">
                                  <p className="text-pink-600 text-[11px] font-black uppercase">Dirección</p>
                                  <p className="text-xs text-gray-800 font-black">{apt.direccion || apt.address || apt.addressLine || 'Sin dirección registrada'}</p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                            <div className="bg-white border-2 border-blue-100 rounded-2xl p-3 shadow-sm">
                              <Label className="font-black text-gray-700 text-sm mb-1 block flex items-center gap-2">
                                🎯 Plan ejecutado
                              </Label>
                              <select
                                value={finishingPlan}
                                onChange={(e) => setFinishingPlan(e.target.value)}
                                className="w-full bg-gradient-to-r from-white to-blue-50 border-2 border-blue-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:border-blue-400 outline-none"
                              >
                                <option value="">Selecciona el plan</option>
                                <option value="Normal">Normal</option>
                                <option value="Elevado">Elevado</option>
                                <option value="Muy Alto">Muy Alto</option>
                              </select>
                            </div>

                            <div className="bg-white border-2 border-amber-100 rounded-2xl p-3 shadow-sm">
                              <Label className="font-black text-gray-700 text-sm mb-1 block flex items-center gap-2">
                                💰 Valor cobrado
                              </Label>
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={finishingPrice}
                                onChange={(e) => setFinishingPrice(e.target.value)}
                                className="w-full bg-gradient-to-r from-white to-amber-50 border-2 border-amber-200 rounded-xl p-3 text-sm font-semibold text-gray-700 focus:border-amber-400 outline-none"
                                placeholder="Ingresa el valor final"
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
        </TabsContent>

        <TabsContent value="history">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-blue-100">
            <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-blue-500" /> Historial de Ganancias
            </h3>
            {completedHistory.length === 0 ? (
               <div className="text-center py-12 text-gray-400 font-bold">Aún no hay misiones completadas.</div>
            ) : (
              <div className="space-y-4">
                {completedHistory.map(apt => (
                  <div key={apt.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:bg-white hover:shadow-md transition-all">
                    <div>
                      <p className="font-black text-gray-800">{apt.clientName}</p>
                      <p className="text-xs text-gray-500">{new Date(apt.date).toLocaleDateString()} - {apt.serviceType}</p>
                      {(apt.yourLoss || apt.ourPayment || apt.age) && (
                        <p className="text-xs text-yellow-600 font-bold mt-1">
                          📊 {apt.age ? `${apt.age}a ` : ''}| Pierdes: {formatCurrency(parseFloat(apt.yourLoss) || 0)} | Te pagamos: {formatCurrency(parseFloat(apt.ourPayment) || 0)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {(() => {
                        const gross = getServicePrice(apt) * 0.5;
                        const deductions = Number(apt.deductions) || 0;
                        const net = gross - deductions;
                        return (
                          <>
                            <p className="text-green-600 font-black text-lg">+{formatCurrency(net)}</p>
                            {deductions > 0 && (
                              <p className="text-xs text-red-400 font-bold">-{formatCurrency(deductions)} en productos</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="products">
          <ProductRequestView
            products={products}
            currentUser={currentUser}
            onCreateRequest={onCreateProductRequest}
            productRequests={productRequests || []}
            formatCurrency={formatCurrency}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PiojologistView;