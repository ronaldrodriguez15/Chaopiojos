import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, UserPlus, Calendar, User, CheckCircle, PieChart, Crown, Users, Trash2, Edit, Save, X, ShoppingBag, DollarSign, PackagePlus, Map, Loader, RefreshCw } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ScheduleManagement from '@/components/ScheduleManagement';
import PiojologistMap from '@/components/PiojologistMap';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { geocodeAddress } from '@/lib/geocoding';
import { bookingService } from '@/lib/api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);
// Aplicar estilos globales de tipografía del sistema a Chart.js
ChartJS.defaults.font.family = 'Fredoka';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.font.weight = 700;
ChartJS.defaults.color = '#374151';

const AdminView = ({ users, handleCreateUser, handleUpdateUser, handleDeleteUser, appointments, baseAppointments = [], bookings = [], updateAppointments, updateBookings, piojologists, products, updateProducts, serviceCatalog, formatCurrency, syncICalEvents, productRequests, onApproveRequest, onRejectRequest, onNotify }) => {
  const { toast } = useToast();
  
  // User Management State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isGeocodifying, setIsGeocodifying] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'piojologist',
    specialty: '',
    available: true,
    address: ''
  });

  // Service Creation State
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
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

  // Pagination for Active Services
  const [servicesPage, setServicesPage] = useState(1);
  const servicesPerPage = 6;

  // Search filters for Active Services
  const [serviceFilters, setServiceFilters] = useState({
    clientName: '',
    serviceType: '',
    piojologist: '',
    status: 'all'
  });

  // Persist active tab across refresh
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('adminTab') || 'dashboard');
  const handleTabChange = (value) => {
    setActiveTab(value);
    localStorage.setItem('adminTab', value);
  };

  // Resolver nombres de piojólogas faltantes en bookings/appointments combinados
  const normalizeRejectionHistory = (value) => {
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

  const displayAppointments = appointments.map(apt => {
    const rejectionHistory = normalizeRejectionHistory(apt.rejectionHistory || apt.rejection_history || apt.rejections);
    const base = {
      ...apt,
      rejectionHistory
    };

    if (base.piojologistName || !base.piojologistId) return base;
    const match = piojologists.find(p => Number(p.id) === Number(base.piojologistId));
    return match ? { ...base, piojologistName: match.name } : base;
  });

  const getServicePrice = (apt = {}) => {
    const raw = apt.price ?? apt.price_confirmed ?? apt.estimatedPrice ?? serviceCatalog[apt.serviceType] ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const toMoney = (amount = 0) => {
    if (typeof formatCurrency === 'function') return formatCurrency(amount);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  };

  const resolveRequestTotals = (request = {}) => {
    const baseKitPrice = Number(request.kitPrice ?? 300000);
    const itemsTotal = (request.items || []).reduce((sum, item) => sum + (Number(item.price ?? 0) * Number(item.quantity ?? 1)), 0);
    const total = request.isKitCompleto ? baseKitPrice : Number(request.totalPrice ?? itemsTotal);
    const studioShare = request.isKitCompleto ? Number(request.studioContribution ?? (request.isFirstKitBenefit ? baseKitPrice / 2 : 0)) : 0;
    const piojologistShare = request.isKitCompleto ? Number(request.piojologistContribution ?? (total - studioShare)) : total;
    return { baseKitPrice, itemsTotal, total, studioShare, piojologistShare };
  };

  // Product Management State
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productFormData, setProductFormData] = useState({
    name: '',
    price: '',
    stock: '',
    image: ''
  });

  const resetUserForm = () => {
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: 'piojologist',
      specialty: '',
      available: true,
      address: ''
    });
    setEditingUser(null);
  };

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

  const resetProductForm = () => {
    setProductFormData({
      name: '',
      price: '',
      stock: '',
      image: ''
    });
    setEditingProduct(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProductFormData({...productFormData, image: reader.result});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenUserDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserFormData(user);
    } else {
      resetUserForm();
    }
    setIsUserDialogOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setIsGeocodifying(true);

    try {
      let userToSave = { ...userFormData };

      // Si la piojóloga tiene dirección y es piojologist, ya tiene coordenadas del autocomplete
      if (userToSave.role === 'piojologist' && userToSave.address && !userToSave.lat) {
        // Si no tiene coordenadas (edición de usuario sin autocomplete), geocodificar
        const coordinates = await geocodeAddress(userToSave.address);
        if (coordinates) {
          userToSave = {
            ...userToSave,
            lat: coordinates.lat,
            lng: coordinates.lng
          };
          toast({
            title: "📍 Ubicación encontrada",
            description: `Coordenadas: ${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`,
            className: "bg-cyan-100 text-cyan-800 rounded-2xl border-2 border-cyan-200"
          });
        } else {
          toast({
            title: "⚠️ Ubicación no encontrada",
            description: "Se guardará sin coordenadas. Verifica la dirección.",
            variant: "destructive",
            className: "rounded-3xl border-4 border-yellow-200 bg-yellow-50 text-yellow-600 font-bold"
          });
        }
      }

      let result;
      if (editingUser) {
        result = await handleUpdateUser({ ...userToSave, id: editingUser.id });
        if (result.success) {
          toast({ title: "¡Usuario Actualizado! 🎉", className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200" });
          setIsUserDialogOpen(false);
          resetUserForm();
        } else {
          toast({
            title: "Error al actualizar",
            description: result.message || "No se pudo actualizar el usuario",
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
        }
      } else {
        result = await handleCreateUser(userToSave);
        if (result.success) {
          toast({ title: "¡Nuevo Amigo Añadido! 🎈", className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200" });
          setIsUserDialogOpen(false);
          resetUserForm();
        } else {
          toast({
            title: "Error al crear",
            description: result.message || "No se pudo crear el usuario",
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
        }
      }
    } catch (error) {
      console.error('Error al procesar usuario:', error);
      toast({
        title: "Error",
        description: "Hubo un error procesando el usuario",
        variant: "destructive",
        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
      });
    } finally {
      setIsGeocodifying(false);
    }
  };

  // Service Creation
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
      status: 'confirmed',
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

    const internalAppointments = baseAppointments.length ? baseAppointments : appointments.filter(a => !a.isPublicBooking);
    updateAppointments([...internalAppointments, newService]);
    setIsServiceDialogOpen(false);
    resetServiceForm();
    toast({ 
      title: "¡Servicio Creado! ✨", 
      description: `Asignado a ${piojologist?.name}`,
      className: "bg-purple-100 text-purple-800 rounded-2xl border-2 border-purple-200" 
    });
  };

  // Product Logic
  const handleProductSubmit = (e) => {
    e.preventDefault();
    
    if (editingProduct) {
      // Editar producto existente
      const updatedProducts = products.map(p => 
        p.id === editingProduct.id 
          ? {
              ...p,
              name: productFormData.name,
              price: parseFloat(productFormData.price),
              stock: parseInt(productFormData.stock),
              image: productFormData.image || p.image
            }
          : p
      );
      updateProducts(updatedProducts);
      toast({ title: "¡Producto Actualizado! ✨", className: "bg-pink-100 text-pink-800 rounded-2xl border-2 border-pink-200" });
    } else {
      // Crear nuevo producto
      const newProduct = {
        id: Date.now(),
        name: productFormData.name,
        price: parseFloat(productFormData.price),
        stock: parseInt(productFormData.stock),
        image: productFormData.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
      };
      updateProducts([...products, newProduct]);
      toast({ title: "¡Producto en Estantería! 🛍️", className: "bg-pink-100 text-pink-800 rounded-2xl border-2 border-pink-200" });
    }
    
    setIsProductDialogOpen(false);
    resetProductForm();
  };

  const handleOpenProductDialog = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        name: product.name,
        price: product.price.toString(),
        stock: product.stock.toString(),
        image: product.image
      });
    } else {
      resetProductForm();
    }
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = (prodId) => {
    updateProducts(products.filter(p => p.id !== prodId));
  };

  // Appointment Logic
  const handleAssignPiojologist = async (appointmentId, piojologistId, appointmentArg = null) => {
    const piojologist = piojologists.find(p => p.id === parseInt(piojologistId));
    const appointment = appointmentArg || appointments.find(a => a.id === appointmentId || a.backendId === appointmentId || a.bookingId === appointmentId);
    const servicePrice = serviceCatalog[appointment?.serviceType] || 0;
    const backendId = appointment?.backendId || appointment?.bookingId || appointmentId;
    
    // Actualizar en el backend (solo si viene de bookings públicos o tiene backendId)
    try {
      let assignedSnapshot = appointment;

      if (appointment?.isPublicBooking || appointment?.backendId || appointmentId?.toString().startsWith('booking-')) {
        const result = await bookingService.update(backendId, {
          piojologistId: parseInt(piojologistId),
          status: 'assigned'
        });

        if (!result.success) {
          toast({
            title: "Error",
            description: result.message || "No se pudo asignar la piojóloga",
            variant: "destructive",
            className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
          });
          return;
        }

        // Actualizar bookings
        if (updateBookings) {
          const updatedBookings = bookings.map(apt => 
            (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
              ? { 
                  ...apt, 
                  piojologistId: parseInt(piojologistId),
                  piojologistName: piojologist?.name || null,
                  status: 'assigned',
                  estimatedPrice: servicePrice
                } 
              : apt
          );
          assignedSnapshot = updatedBookings.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) || assignedSnapshot;
          updateBookings(updatedBookings);
        }
      } else {
        const baseList = (baseAppointments && baseAppointments.length) ? baseAppointments : appointments.filter(a => !a.isPublicBooking);
        const updatedInternal = baseList.map(apt => 
          (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) 
            ? { 
                ...apt, 
                piojologistId: parseInt(piojologistId),
                piojologistName: piojologist?.name || null,
                status: 'assigned',
                estimatedPrice: servicePrice
              } 
            : apt
        );
        assignedSnapshot = updatedInternal.find(apt => apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId) || assignedSnapshot;
        updateAppointments(updatedInternal);
      }
      
      // Create notification for the piojologist
      if (onNotify) {
        onNotify({
          type: 'assignment',
          appointmentId: appointmentId,
          piojologistId: parseInt(piojologistId),
          message: `Nuevo agendamiento asignado: ${assignedSnapshot?.clientName || appointment?.clientName} - ${assignedSnapshot?.serviceType || appointment?.serviceType}`,
          appointment: assignedSnapshot
        });
      }
      
      toast({
        title: "¡Asignación Mágica! ✨",
        description: `${piojologist?.name} va al rescate. Esperando aceptación...`,
        className: "bg-purple-100 text-purple-800 rounded-2xl border-2 border-purple-200"
      });
    } catch (error) {
      console.error('Error al asignar piojóloga:', error);
      toast({
        title: "Error",
        description: "Hubo un problema al asignar la piojóloga",
        variant: "destructive",
        className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200"
      });
    }
  };

  const unassignedAppointments = displayAppointments.filter(apt => 
    apt.status === 'pending' || (apt.status === 'confirmed' && !apt.piojologistId)
  );

  const handleAssignFromCalendar = (appointment, piojologistId) => {
    handleAssignPiojologist(appointment?.backendId || appointment?.bookingId || appointment?.id, piojologistId, appointment);
  };

  return (
    <div className="space-y-8">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full bg-white/50 p-2 rounded-[2rem] border-2 border-orange-100 mb-8 flex-wrap h-auto gap-2">
          <TabsTrigger value="dashboard" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-orange-400 data-[state=active]:text-white transition-all">
            📊 Panel
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-yellow-400 data-[state=active]:text-white transition-all">
            📅 Agendamientos
          </TabsTrigger>
          <TabsTrigger value="users" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-blue-400 data-[state=active]:text-white transition-all">
            👥 Usuarios
          </TabsTrigger>
          <TabsTrigger value="map" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-cyan-400 data-[state=active]:text-white transition-all">
            🗺️ Mapa
          </TabsTrigger>
          <TabsTrigger value="products" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-pink-400 data-[state=active]:text-white transition-all">
            🛍️ Productos
          </TabsTrigger>
          <TabsTrigger value="earnings" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-green-400 data-[state=active]:text-white transition-all">
            💰 Ganancias
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-purple-400 data-[state=active]:text-white transition-all">
            📦 Solicitudes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Citas', val: appointments.length, color: 'bg-blue-100 text-blue-600', icon: PieChart },
              { label: 'Pendientes', val: appointments.filter(a => a.status === 'pending').length, color: 'bg-yellow-100 text-yellow-600', icon: Calendar },
              { label: 'Héroes', val: piojologists.length, color: 'bg-green-100 text-green-600', icon: Users },
              { label: 'Ingresos Totales', val: formatCurrency(appointments.filter(a => a.status === 'completed').reduce((acc, curr) => acc + getServicePrice(curr), 0)), color: 'bg-purple-100 text-purple-600', icon: DollarSign },
            ].map((stat, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ scale: 1.05, rotate: idx % 2 === 0 ? 2 : -2 }}
                className={`${stat.color} p-6 rounded-[2rem] border-4 border-white shadow-lg flex flex-col items-center justify-center text-center`}
              >
                <stat.icon className="w-8 h-8 mb-2 opacity-80" />
                <span className="text-3xl font-black truncate w-full">{stat.val}</span>
                <span className="font-bold text-sm opacity-70">{stat.label}</span>
              </motion.div>
            ))}
          </div>

          {/* Analytics & Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution by Status - Pie Chart */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-purple-100">
              <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">📊</span> Distribución de Estados
              </h3>
              <div className="h-80 flex items-center justify-center">
                {(() => {
                  const counts = [
                    appointments.filter(a => a.status === 'pending').length,
                    appointments.filter(a => a.status === 'assigned').length,
                    appointments.filter(a => a.status === 'accepted').length,
                    appointments.filter(a => a.status === 'completed').length
                  ];
                  const total = counts.reduce((acc, v) => acc + v, 0);
                  if (total === 0) {
                    return (
                      <div className="text-center">
                        <div className="text-gray-500 font-black text-xl">Sin datos para mostrar</div>
                        <div className="text-gray-400 font-bold text-sm">No hay citas registradas aún</div>
                      </div>
                    );
                  }
                  return (
                    <Pie
                      data={{
                        labels: ['Pendientes', 'Asignados', 'Aceptados', 'Completados'],
                        datasets: [{
                          data: counts,
                          backgroundColor: ['#FBBF24', '#22D3EE', '#4ADE80', '#60A5FA'],
                          borderColor: ['#F59E0B', '#06B6D4', '#22C55E', '#3B82F6'],
                          borderWidth: 2,
                          borderRadius: 8
                        }]
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              font: { family: 'Fredoka', size: 12, weight: 700 },
                              color: '#374151',
                              padding: 15,
                              usePointStyle: true
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
                  );
                })()}
              </div>
            </div>

            {/* Revenue by Piojologist - Bar Chart */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-green-100">
              <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">💰</span> Ingresos por Piojóloga
              </h3>
              <div className="h-80">
                <Bar
                  data={{
                    labels: piojologists.map(p => p.name),
                    datasets: [{
                      label: 'Ingresos ($)',
                      data: piojologists.map(pio => 
                        appointments.filter(a => a.piojologistId === pio.id && a.status === 'completed')
                          .reduce((acc, curr) => acc + getServicePrice(curr), 0)
                      ),
                      backgroundColor: ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0'],
                      borderColor: '#059669',
                      borderWidth: 2,
                      borderRadius: 8,
                      hoverBackgroundColor: '#047857'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                      legend: {
                        labels: {
                          font: { family: 'Fredoka', size: 12, weight: 700 },
                          color: '#374151'
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 12 },
                        borderColor: '#10B981',
                        borderWidth: 1,
                        borderRadius: 8,
                        callbacks: {
                          label: function(context) {
                            return formatCurrency(context.parsed.x);
                          }
                        }
                      }
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        grid: { color: '#E5E7EB' },
                        ticks: { font: { size: 11, weight: 'bold' }, color: '#6B7280' }
                      },
                      y: {
                        grid: { display: false },
                        ticks: { font: { size: 11, weight: 'bold' }, color: '#374151' }
                      }
                    }
                  }}
                />

              </div>
            </div>

            {/* Service Popularity - Horizontal Bar Chart */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-pink-100">
              <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">⭐</span> Servicios Más Solicitados
              </h3>
              <div className="h-80">
                <Bar
                  data={{
                    labels: Object.keys(serviceCatalog),
                    datasets: [{
                      label: 'Cantidad de Servicios',
                      data: Object.keys(serviceCatalog).map(service => 
                        appointments.filter(a => a.serviceType === service).length
                      ),
                      backgroundColor: ['#EC4899', '#F472B6', '#F9A8D4', '#FBCFE8'],
                      borderColor: '#BE185D',
                      borderWidth: 2,
                      borderRadius: 8,
                      hoverBackgroundColor: '#DB2777'
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: {
                      legend: {
                        labels: {
                          font: { family: 'Fredoka', size: 12, weight: 700 },
                          color: '#374151'
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { family: 'Fredoka', size: 14, weight: 700 },
                        bodyFont: { family: 'Fredoka', size: 12, weight: 600 },
                        borderColor: '#EC4899',
                        borderWidth: 1,
                        borderRadius: 8
                      }
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        grid: { color: '#E5E7EB' },
                        ticks: { font: { family: 'Fredoka', size: 11, weight: 700 }, color: '#6B7280' }
                      },
                      y: {
                        grid: { display: false },
                        ticks: { font: { family: 'Fredoka', size: 11, weight: 700 }, color: '#374151' }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Weekly Performance - Line Chart */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-orange-100">
              <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">📈</span> Desempeño Semanal
              </h3>
              <div className="h-80">
                <Line
                  data={{
                    labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'],
                    datasets: [{
                      label: 'Citas por Día',
                      data: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sab', 'Dom'].map((day, idx) => {
                        const dayCount = appointments.filter(a => {
                          const apt = new Date(a.date);
                          const today = new Date();
                          const daysBack = 6 - idx;
                          const checkDate = new Date(today);
                          checkDate.setDate(checkDate.getDate() - daysBack);
                          return apt.toDateString() === checkDate.toDateString();
                        }).length;
                        return dayCount;
                      }),
                      backgroundColor: 'rgba(251, 191, 36, 0.1)',
                      borderColor: '#F59E0B',
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: '#F59E0B',
                      pointBorderColor: '#D97706',
                      pointBorderWidth: 2,
                      pointRadius: 5,
                      pointHoverRadius: 7
                    }]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        labels: {
                          font: { family: 'Fredoka', size: 12, weight: 700 },
                          color: '#374151'
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        padding: 12,
                        titleFont: { family: 'Fredoka', size: 14, weight: 700 },
                        bodyFont: { family: 'Fredoka', size: 12, weight: 600 },
                        borderColor: '#F59E0B',
                        borderWidth: 1,
                        borderRadius: 8
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: '#E5E7EB' },
                        ticks: { font: { family: 'Fredoka', size: 11, weight: 700 }, color: '#6B7280', stepSize: 1 }
                      },
                      x: {
                        grid: { color: '#E5E7EB' },
                        ticks: { font: { family: 'Fredoka', size: 11, weight: 700 }, color: '#374151' }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6">
          <ScheduleManagement
            appointments={displayAppointments}
            piojologists={piojologists}
            serviceCatalog={serviceCatalog}
            formatCurrency={formatCurrency}
            updateAppointments={updateAppointments}
            onAssignFromCalendar={handleAssignFromCalendar}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-blue-100">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                <span className="text-3xl">👪</span> La Familia <span className="text-orange-500">Chao</span><span className="text-blue-500">Piojos</span>
              </h3>
              <Button 
                onClick={() => handleOpenUserDialog()}
                className="bg-blue-400 hover:bg-blue-500 text-white rounded-2xl px-6 py-6 font-bold text-lg shadow-md hover:shadow-lg border-b-4 border-blue-600 active:border-b-0 active:translate-y-1"
              >
                <UserPlus className="w-6 h-6 mr-2" />
                Nuevo Miembro
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="p-4 font-black text-gray-400">Nombre</th>
                    <th className="p-4 font-black text-gray-400">Rol</th>
                    <th className="p-4 font-black text-gray-400">Email</th>
                    <th className="p-4 font-black text-gray-400 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="group hover:bg-blue-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm
                            ${user.role === 'admin' ? 'bg-purple-100' : user.role === 'piojologist' ? 'bg-green-100' : 'bg-orange-100'}
                          `}>
                            {user.role === 'admin' ? '👑' : user.role === 'piojologist' ? '🦸' : '👶'}
                          </div>
                          <span className="font-bold text-gray-700">{user.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider
                          ${user.role === 'admin' ? 'bg-purple-100 text-purple-600' : 
                            user.role === 'piojologist' ? 'bg-green-100 text-green-600' : 
                            'bg-orange-100 text-orange-600'}
                        `}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-500">{user.email}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleOpenUserDialog(user)}
                            className="h-10 w-10 rounded-xl bg-blue-100 text-blue-500 hover:bg-blue-200"
                          >
                            <Edit className="w-5 h-5" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={async () => {
                              const result = await handleDeleteUser(user.id);
                              if (result.success) {
                                toast({
                                  title: "¡Usuario Eliminado! 🗑️",
                                  description: result.message,
                                  className: "bg-orange-100 text-orange-800 rounded-2xl border-2 border-orange-200"
                                });
                              } else {
                                toast({
                                  title: "Error al eliminar",
                                  description: result.message || "No se pudo eliminar el usuario",
                                  variant: "destructive",
                                  className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
                                });
                              }
                            }}
                            className="h-10 w-10 rounded-xl bg-red-100 text-red-500 hover:bg-red-200"
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
           <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-pink-100">
             <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                <span className="text-3xl">🧼</span> Almacén de Productos
              </h3>
              <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-pink-400 hover:bg-pink-500 text-white rounded-2xl px-6 py-6 font-bold text-lg shadow-md border-b-4 border-pink-600 active:border-b-0 active:translate-y-1">
                    <PackagePlus className="w-6 h-6 mr-2" />
                    Crear Producto
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] border-8 border-pink-100 p-0 overflow-hidden sm:max-w-md bg-white">
                  <div className="bg-pink-400 p-6 text-white text-center">
                    <DialogHeader>
                      <DialogTitle className="text-3xl font-black">Nuevo Artilugio 🧴</DialogTitle>
                    </DialogHeader>
                  </div>
                  <form onSubmit={handleProductSubmit} className="p-8 space-y-4">
                    <div>
                      <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nombre del Producto</Label>
                      <input 
                        required
                        value={productFormData.name}
                        onChange={e => setProductFormData({...productFormData, name: e.target.value})}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-pink-400"
                        placeholder="Ej. Spray Mágico"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="font-bold text-gray-500 ml-2 mb-1 block">Precio ($)</Label>
                        <input 
                          required
                          type="number"
                          value={productFormData.price}
                          onChange={e => setProductFormData({...productFormData, price: e.target.value})}
                          className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-pink-400"
                          placeholder="15"
                        />
                      </div>
                      <div>
                        <Label className="font-bold text-gray-500 ml-2 mb-1 block">Stock</Label>
                        <input 
                          required
                          type="number"
                          value={productFormData.stock}
                          onChange={e => setProductFormData({...productFormData, stock: e.target.value})}
                          className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-pink-400"
                          placeholder="50"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="font-bold text-gray-500 ml-2 mb-1 block">URL Imagen</Label>
                      <input 
                        value={productFormData.image}
                        onChange={e => setProductFormData({...productFormData, image: e.target.value})}
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-pink-400"
                        placeholder="https://..."
                      />
                    </div>
                    <Button type="submit" className="w-full bg-pink-500 hover:bg-pink-600 text-white rounded-2xl py-6 font-bold mt-4 shadow-md border-b-4 border-pink-700">
                      Guardar en Inventario
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(product => (
                <div key={product.id} className="bg-white border-4 border-pink-100 rounded-[2rem] p-4 flex flex-col gap-4 shadow-sm hover:border-pink-300 hover:shadow-xl transition-all transform hover:scale-105 cursor-pointer group">
                  <div 
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsProductDetailOpen(true);
                    }}
                    className="w-full h-32 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl overflow-hidden relative"
                  >
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-black shadow-lg border-2 border-pink-200">
                      📦 {product.stock}
                    </div>
                  </div>
                  <div onClick={() => {
                    setSelectedProduct(product);
                    setIsProductDetailOpen(true);
                  }}>
                    <h4 className="text-lg font-black text-gray-800 truncate">{product.name}</h4>
                    <p className="text-pink-500 font-bold text-xl">{formatCurrency(product.price)}</p>
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <Button 
                      onClick={() => handleOpenProductDialog(product)}
                      variant="ghost" 
                      className="flex-1 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-xl font-bold"
                    >
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </Button>
                    <Button 
                      onClick={() => handleDeleteProduct(product.id)}
                      variant="ghost" 
                      className="flex-1 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
           </div>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-green-100">
             <div className="flex items-center gap-4 mb-8">
               <div className="p-4 bg-green-100 text-green-600 rounded-full">
                 <DollarSign className="w-8 h-8" />
               </div>
               <h3 className="text-2xl font-black text-gray-800">
                 Reporte Financiero
               </h3>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b-2 border-gray-100">
                     <th className="p-4 font-black text-gray-400">Piojólogo</th>
                     <th className="p-4 font-black text-gray-400">Servicios Completados</th>
                     <th className="p-4 font-black text-gray-400 text-right">Ganancias Totales (50%)</th>
                     <th className="p-4 font-black text-gray-400 text-right">Costos Productos</th>
                     <th className="p-4 font-black text-gray-400 text-right">Neto a Pagar</th>
                   </tr>
                 </thead>
                 <tbody>
                   {piojologists.map(pioj => {
                     // Calculate summary data for each piojologist directly from appointments log if needed, or use stored user.earnings
                     const completedServices = appointments.filter(a => a.piojologistId === pioj.id && a.status === 'completed');
                      const totalServiceValue = completedServices.reduce((acc, curr) => acc + getServicePrice(curr), 0);
                     const grossEarnings = totalServiceValue * 0.5;
                     const totalDeductions = completedServices.reduce((acc, curr) => acc + (curr.deductions || 0), 0);
                     const netPayable = grossEarnings - totalDeductions;

                     return (
                       <tr key={pioj.id} className="border-b border-gray-50 last:border-0 hover:bg-green-50/50 transition-colors">
                         <td className="p-4 font-bold text-gray-700 flex items-center gap-2">
                           <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-700 text-xs">
                             {pioj.name.charAt(0)}
                           </div>
                           {pioj.name}
                         </td>
                         <td className="p-4 font-medium">{completedServices.length}</td>
                         <td className="p-4 text-right font-medium text-blue-600">{formatCurrency(grossEarnings)}</td>
                         <td className="p-4 text-right font-medium text-red-500">-{formatCurrency(totalDeductions)}</td>
                         <td className="p-4 text-right">
                           <span className="bg-green-100 text-green-700 px-3 py-1 rounded-xl font-black">
                             {formatCurrency(netPayable)}
                           </span>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>
        </TabsContent>

        <TabsContent value="map" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-cyan-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-cyan-100 text-cyan-600 rounded-full">
                  <Map className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-800">
                  Ubicaciones de Piojólogas
                </h3>
              </div>
              <div className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-bold">
                🎯 {users.filter(u => u.role === 'piojologist' && u.lat && u.lng).length} ubicadas
              </div>
            </div>
            
            <div style={{ height: '600px' }} className="rounded-2xl overflow-hidden">
              <PiojologistMap key={users.length} piojologists={users} />
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-cyan-50 p-4 rounded-2xl border-2 border-cyan-200">
                <p className="text-sm text-gray-600">
                  <span className="font-bold">📍 Nota:</span> El mapa se actualiza automáticamente cuando agregas piojólogas con dirección.
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200">
                <p className="text-sm text-gray-600">
                  <span className="font-bold">💡 Tip:</span> Usa el autocomplete al crear piojólogas para ubicaciones precisas.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-purple-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
                  <PackagePlus className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-800">
                  Solicitudes de Productos
                </h3>
              </div>
              <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                {productRequests.filter(r => r.status === 'pending').length} pendientes
              </div>
            </div>

            {productRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <PackagePlus className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="font-bold text-lg">No hay solicitudes aún</p>
              </div>
            ) : (
              <div className="space-y-4">
                {productRequests.map(request => {
                  const pricing = resolveRequestTotals(request);
                  return (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-6 rounded-2xl border-4 ${
                        request.status === 'pending' 
                          ? 'bg-yellow-50 border-yellow-200' 
                          : request.status === 'approved'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-gray-800">
                            {request.piojologistName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {new Date(request.requestDate).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <span className={`px-4 py-2 rounded-xl text-sm font-bold ${
                          request.status === 'pending'
                            ? 'bg-yellow-200 text-yellow-800'
                            : request.status === 'approved'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-red-200 text-red-800'
                        }`}>
                          {request.status === 'pending' && '⏳ Pendiente'}
                          {request.status === 'approved' && '✅ Aprobada'}
                          {request.status === 'rejected' && '❌ Rechazada'}
                        </span>
                      </div>

                      <div className="mb-4">
                        <h5 className="font-bold text-gray-700 mb-2">
                          {request.isKitCompleto ? '🎁 Kit Completo' : 'Productos Solicitados:'}
                        </h5>
                        {!request.isKitCompleto && (
                          <ul className="space-y-1 bg-white p-3 rounded-xl">
                            {(request.items || []).map((item, idx) => (
                              <li key={idx} className="text-sm text-gray-700 flex items-center gap-2 justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                                  {item.productName} <span className="font-bold">x{item.quantity}</span>
                                </div>
                                {item.price ? <span className="font-bold text-purple-700">{toMoney((item.price || 0) * (item.quantity || 1))}</span> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {request.isKitCompleto ? (
                        <div className="bg-white p-3 rounded-xl border-2 border-purple-100">
                          <p className="text-sm font-bold text-gray-700">Valor kit: {toMoney(pricing.baseKitPrice)}</p>
                          <p className="text-xs font-bold text-green-700">Aporta estudio: {toMoney(pricing.studioShare)}</p>
                          <p className="text-xs font-bold text-purple-700">Aporta piojóloga: {toMoney(pricing.piojologistShare)}</p>
                          {request.isFirstKitBenefit && (
                            <p className="text-xs text-emerald-600 font-black mt-1">Beneficio de primer kit aplicado (50%)</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white p-3 rounded-xl border-2 border-gray-100 flex justify-between text-sm font-bold text-gray-700">
                          <span>Total estimado</span>
                          <span>{toMoney(pricing.total)}</span>
                        </div>
                      )}

                      {request.notes && (
                        <div className="mb-4 mt-4 bg-white p-3 rounded-xl">
                          <p className="text-sm text-gray-600">
                            <span className="font-bold">Notas:</span> {request.notes}
                          </p>
                        </div>
                      )}

                      {request.status === 'pending' ? (
                        <div className="flex gap-3 mt-4">
                          <Button
                            onClick={() => {
                              const notes = prompt('Comentario de aprobación (opcional):');
                              if (notes !== null) {
                                onApproveRequest(request.id, notes);
                                toast({
                                  title: "✅ Solicitud Aprobada",
                                  description: `La solicitud de ${request.piojologistName} fue aprobada`,
                                  className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200"
                                });
                              }
                            }}
                            className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 font-bold"
                          >
                            ✅ Aprobar
                          </Button>
                          <Button
                            onClick={() => {
                              const reason = prompt('Razón del rechazo:');
                              if (reason) {
                                onRejectRequest(request.id, reason);
                                toast({
                                  title: "❌ Solicitud Rechazada",
                                  description: `La solicitud de ${request.piojologistName} fue rechazada`,
                                  variant: "destructive",
                                  className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
                                });
                              }
                            }}
                            className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-bold"
                          >
                            ❌ Rechazar
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-white p-4 rounded-xl border-2 border-gray-200 mt-4">
                          <p className="text-sm font-bold text-gray-700 mb-1">
                            {request.status === 'approved' ? '✅ Aprobado' : '❌ Rechazado'} por {request.resolvedByName}
                          </p>
                          <p className="text-xs text-gray-600 mb-2">
                            {new Date(request.resolvedDate).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {request.adminNotes && (
                            <p className="text-sm text-gray-700">
                              <span className="font-bold">Comentario:</span> {request.adminNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* User Dialog Modal */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-8 border-blue-100 p-0 sm:max-w-md bg-white max-h-[85vh] overflow-y-auto">
          <div className="bg-blue-400 p-6 text-white text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <DialogHeader>
              <DialogTitle className="text-3xl font-black flex items-center justify-center gap-2 relative z-10">
                {editingUser ? '✏️ Editar Amigo' : '🌟 Nuevo Amigo'}
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <form onSubmit={handleUserSubmit} className="p-8 space-y-4">
            <div>
              <Label className="font-bold text-gray-500 ml-2 mb-1 block">Nombre Completo</Label>
              <input 
                required
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                value={userFormData.name}
                onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                placeholder="Ej. Pepito Pérez"
              />
            </div>
            
            <div className="form-grid">
              <div>
                <Label className="field-label">Rol</Label>
                 <select 
                  className="form-select focus:border-blue-400"
                    value={userFormData.role}
                    onChange={e => setUserFormData({...userFormData, role: e.target.value})}
                 >
                   <option value="piojologist">🦸 Piojóloga</option>
                   <option value="admin">👑 Administrador</option>
                 </select>
              </div>
               <div>
                <Label className="field-label">Contraseña {editingUser && <span className="text-xs text-gray-500">(mantener actual)</span>}</Label>
                <input 
                  required={!editingUser}
                  type="password"
                  className="form-input focus:border-blue-400 focus:bg-white transition-all"
                  value={userFormData.password}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder={editingUser ? "Dejar vacío si no cambia" : "***"}
                />
              </div>
            </div>

            <div>
              <Label className="field-label">Email</Label>
              <input 
                required
                type="email"
                className="form-input focus:border-blue-400 focus:bg-white transition-all"
                value={userFormData.email}
                onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                placeholder="correo@ejemplo.com"
              />
            </div>

            {userFormData.role === 'piojologist' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                <Label className="field-label">Especialidad (Súper Poder)</Label>
                <input 
                  className="form-input bg-green-50 border-green-200 text-green-700 focus:border-green-400 focus:bg-white transition-all placeholder-green-300"
                  value={userFormData.specialty || ''}
                  onChange={e => setUserFormData({...userFormData, specialty: e.target.value})}
                  placeholder="Ej. Visión de Rayos X"
                />
              </motion.div>
            )}

            {userFormData.role === 'piojologist' && (
              <div>
                <Label className="field-label">📍 Dirección</Label>
                <AddressAutocomplete
                  value={userFormData.address || ''}
                  onChange={(address) => setUserFormData({...userFormData, address})}
                  onSelect={(suggestion) => {
                    setUserFormData({
                      ...userFormData,
                      address: suggestion.fullName,
                      lat: suggestion.lat,
                      lng: suggestion.lng
                    });
                    toast({
                      title: "📍 Ubicación seleccionada",
                      description: `${suggestion.name}`,
                      className: "bg-cyan-100 text-cyan-800 rounded-2xl border-2 border-cyan-200"
                    });
                  }}
                />
              </div>
            )}

            {userFormData.role !== 'piojologist' && (
              <div>
                <Label className="field-label">📍 Dirección (Opcional)</Label>
                <input 
                  className="form-input focus:border-blue-400 focus:bg-white transition-all"
                  value={userFormData.address || ''}
                  onChange={e => setUserFormData({...userFormData, address: e.target.value})}
                  placeholder="Ej. Cra 7 #45-90, Bogotá"
                />
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsUserDialogOpen(false)}
                disabled={isGeocodifying}
                className="flex-1 rounded-2xl py-6 font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isGeocodifying}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGeocodifying ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Localizando...
                  </>
                ) : (
                  editingUser ? 'Guardar Cambios' : '¡Crear!'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Product Detail Modal */}
      <Dialog open={isProductDetailOpen} onOpenChange={setIsProductDetailOpen}>
        <DialogContent className="rounded-[2.5rem] border-8 border-pink-100 p-0 overflow-hidden sm:max-w-lg bg-white">
          {selectedProduct && (
            <>
              <div className="bg-gradient-to-r from-pink-400 to-purple-400 p-6 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 text-9xl opacity-10">🎨</div>
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black relative z-10">¡Producto Mágico! ✨</DialogTitle>
                </DialogHeader>
              </div>
              
              <div className="p-8 space-y-6">
                {/* Image */}
                <div className="w-full h-64 bg-gradient-to-br from-pink-50 to-purple-50 rounded-3xl overflow-hidden border-4 border-pink-200 shadow-lg relative">
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-full shadow-lg border-2 border-pink-300">
                    <span className="text-2xl font-black text-pink-500">📦 {selectedProduct.stock}</span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div className="bg-pink-50 p-4 rounded-2xl border-2 border-pink-200">
                    <h3 className="text-2xl font-black text-gray-800 mb-2">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-3xl font-black text-pink-500">
                      {formatCurrency(selectedProduct.price)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 text-center">
                      <p className="text-sm font-bold text-purple-600 mb-1">Stock Disponible</p>
                      <p className="text-3xl font-black text-purple-700">{selectedProduct.stock}</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 text-center">
                      <p className="text-sm font-bold text-blue-600 mb-1">Precio Unitario</p>
                      <p className="text-lg font-black text-blue-700">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setIsProductDetailOpen(false);
                      handleOpenProductDialog(selectedProduct);
                    }}
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-blue-700"
                  >
                    <Edit className="w-5 h-5 mr-2" /> Editar
                  </Button>
                  <Button
                    onClick={() => {
                      handleDeleteProduct(selectedProduct.id);
                      setIsProductDetailOpen(false);
                    }}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-red-700"
                  >
                    <Trash2 className="w-5 h-5 mr-2" /> Eliminar
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminView;