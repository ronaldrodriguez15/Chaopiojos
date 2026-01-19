import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, UserPlus, Calendar, User, CheckCircle, PieChart, Crown, Users, Trash2, Edit, Save, X, ShoppingBag, DollarSign, PackagePlus, Map, Loader, RefreshCw } from 'lucide-react';
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
import ScheduleCalendar from '@/components/ScheduleCalendar';
import PiojologistMap from '@/components/PiojologistMap';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { geocodeAddress } from '@/lib/geocoding';

const AdminView = ({ users, handleCreateUser, handleUpdateUser, handleDeleteUser, appointments, updateAppointments, piojologists, products, updateProducts, serviceCatalog, formatCurrency, syncICalEvents }) => {
  const { toast } = useToast();
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  
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

  // Manejar sincronización manual del iCal
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncICalEvents();
      if (result.success) {
        if (result.count > 0) {
          toast({
            title: "✅ Sincronización Completada",
            description: `Se cargaron ${result.count} agendamiento${result.count !== 1 ? 's' : ''} externo${result.count !== 1 ? 's' : ''}.`,
            className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200"
          });
        } else {
          toast({
            title: "ℹ️ Sincronización Sin Cambios",
            description: "No hay nuevos agendamientos para cargar en este momento.",
            className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
          });
        }
      } else {
        toast({
          title: "⚠️ Error en la Sincronización",
          description: "No se pudo conectar con el servidor de agendamientos. Verifica que el link iCal sea válido o intenta más tarde.",
          variant: "destructive",
          className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
        });
      }
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Hubo un error durante la sincronización.",
        variant: "destructive",
        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
      });
    } finally {
      setIsSyncing(false);
    }
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

      if (editingUser) {
        handleUpdateUser({ ...userToSave, id: editingUser.id });
        toast({ title: "¡Usuario Actualizado! 🎉", className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200" });
      } else {
        handleCreateUser(userToSave);
        toast({ title: "¡Nuevo Amigo Añadido! 🎈", className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200" });
      }
      setIsUserDialogOpen(false);
      resetUserForm();
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

    updateAppointments([...appointments, newService]);
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
  const handleAssignPiojologist = (appointmentId, piojologistId) => {
    const piojologist = piojologists.find(p => p.id === parseInt(piojologistId));
    const servicePrice = serviceCatalog[appointments.find(a => a.id === appointmentId).serviceType] || 0;
    
    const updatedAppointments = appointments.map(apt => 
      apt.id === appointmentId 
        ? { 
            ...apt, 
            piojologistId: parseInt(piojologistId),
            piojologistName: piojologist?.name || null,
            status: 'confirmed',
            estimatedPrice: servicePrice
          } 
        : apt
    );
    updateAppointments(updatedAppointments);
    toast({
      title: "¡Asignación Mágica! ✨",
      description: `${piojologist?.name} va al rescate.`,
      className: "bg-purple-100 text-purple-800 rounded-2xl border-2 border-purple-200"
    });
  };

  const unassignedAppointments = appointments.filter(apt => 
    apt.status === 'pending' || (apt.status === 'confirmed' && !apt.piojologistId)
  );

  return (
    <div className="space-y-8">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="w-full bg-white/50 p-2 rounded-[2rem] border-2 border-orange-100 mb-8 flex-wrap h-auto gap-2">
          <TabsTrigger value="dashboard" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-orange-400 data-[state=active]:text-white transition-all">
            📊 Panel
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
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Botón de Sincronización Flotante */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="flex justify-end mb-4"
          >
            <Button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="bg-cyan-400 hover:bg-cyan-500 text-white rounded-2xl px-6 py-4 font-bold text-base shadow-lg hover:shadow-xl border-b-4 border-cyan-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSyncing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  🔄 Sincronizar Agendamientos
                </>
              )}
            </Button>
          </motion.div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Citas', val: appointments.length, color: 'bg-blue-100 text-blue-600', icon: PieChart },
              { label: 'Pendientes', val: appointments.filter(a => a.status === 'pending').length, color: 'bg-yellow-100 text-yellow-600', icon: Calendar },
              { label: 'Héroes', val: piojologists.length, color: 'bg-green-100 text-green-600', icon: Users },
              { label: 'Ingresos Totales', val: formatCurrency(appointments.filter(a => a.status === 'completed').reduce((acc, curr) => acc + (curr.price || 0), 0)), color: 'bg-purple-100 text-purple-600', icon: DollarSign },
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

          <ScheduleCalendar
            appointments={appointments}
            piojologists={piojologists}
            enablePiojologistFilter
            title="Agenda General"
          />

          {/* Services Management Panel */}
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
                     <div className="form-grid">
                       <div>
                         <Label className="field-label">Fecha</Label>
                         <input 
                           required
                           type="date"
                           value={serviceFormData.date}
                           onChange={e => setServiceFormData({...serviceFormData, date: e.target.value})}
                           className="form-input focus:border-yellow-400"
                         />
                       </div>
                       <div>
                         <Label className="field-label">Hora</Label>
                         <input 
                           required
                           type="time"
                           value={serviceFormData.time}
                           onChange={e => setServiceFormData({...serviceFormData, time: e.target.value})}
                           className="form-input focus:border-yellow-400"
                         />
                       </div>
                     </div>
                     <div>
                       <Label className="field-label">Asignar a Piojóloga</Label>
                       <select 
                         required
                         value={serviceFormData.piojologistId}
                         onChange={e => setServiceFormData({...serviceFormData, piojologistId: e.target.value})}
                         className="form-select focus:border-yellow-400"
                       >
                         <option value="">Seleccionar piojóloga...</option>
                         {piojologists.map(p => (
                           <option key={p.id} value={p.id}>{p.name} - {p.specialty}</option>
                         ))}
                       </select>
                     </div>

                     {/* Datos Críticos: Tu pierdes, Nosotros te pagamos, Total, Edad */}
                     {/* Contacto del Cliente */}
                     <div className="bg-blue-50 p-4 rounded-2xl border-2 border-blue-200 space-y-3">
                       <p className="text-xs font-bold text-blue-600 uppercase">📱 Contacto del Cliente</p>
                       <div>
                         <Label className="field-label text-xs">WhatsApp</Label>
                         <input 
                           type="tel"
                           value={serviceFormData.whatsapp}
                           onChange={e => setServiceFormData({...serviceFormData, whatsapp: e.target.value})}
                           className="form-input focus:border-blue-400 text-sm"
                           placeholder="Ej. +34 123 456 789"
                         />
                       </div>
                       <div>
                         <Label className="field-label text-xs">Dirección</Label>
                         <input 
                           type="text"
                           value={serviceFormData.direccion}
                           onChange={e => setServiceFormData({...serviceFormData, direccion: e.target.value})}
                           className="form-input focus:border-blue-400 text-sm"
                           placeholder="Calle, número, piso"
                         />
                       </div>
                       <div className="form-grid">
                         <div>
                           <Label className="field-label text-xs">Barrio</Label>
                           <input 
                             type="text"
                             value={serviceFormData.barrio}
                             onChange={e => setServiceFormData({...serviceFormData, barrio: e.target.value})}
                             className="form-input focus:border-blue-400 text-sm"
                             placeholder="Ej. Centro"
                           />
                         </div>
                         <div>
                           <Label className="field-label text-xs">Nº de Personas a Atender</Label>
                           <input 
                             type="number"
                             value={serviceFormData.numPersonas}
                             onChange={e => setServiceFormData({...serviceFormData, numPersonas: e.target.value})}
                             className="form-input focus:border-blue-400 text-sm"
                             placeholder="1"
                             min="1"
                           />
                         </div>
                       </div>
                     </div>

                     {/* Datos de Salud */}
                     <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-200 space-y-3">
                       <p className="text-xs font-bold text-red-600 uppercase">⚠️ Datos de Salud</p>
                       <div className="flex items-center gap-3">
                         <Checkbox 
                           id="hasAlergias"
                           checked={serviceFormData.hasAlergias}
                           onCheckedChange={checked => setServiceFormData({...serviceFormData, hasAlergias: checked})}
                           className="w-5 h-5 rounded"
                         />
                         <Label htmlFor="hasAlergias" className="font-bold text-gray-700 cursor-pointer">
                           ¿Tiene alergias o afectaciones de salud?
                         </Label>
                       </div>
                       {serviceFormData.hasAlergias && (
                         <textarea
                           value={serviceFormData.detalleAlergias}
                           onChange={e => setServiceFormData({...serviceFormData, detalleAlergias: e.target.value})}
                           className="form-input focus:border-red-400 text-sm resize-none"
                           placeholder="Describe las alergias o afectaciones..."
                           rows="3"
                         />
                       )}
                     </div>

                     {/* Referencias y Datos Críticos */}
                     <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-200 space-y-3">
                       <p className="text-xs font-bold text-purple-600 uppercase">📌 Referencias Adicionales</p>
                       <div>
                         <Label className="field-label text-xs">Referido Por</Label>
                         <input 
                           type="text"
                           value={serviceFormData.referidoPor}
                           onChange={e => setServiceFormData({...serviceFormData, referidoPor: e.target.value})}
                           className="form-input focus:border-purple-400 text-sm"
                           placeholder="Nombre o fuente de referencia (opcional)"
                         />
                       </div>
                     </div>

                     {/* Datos Críticos: Tu pierdes, Nosotros te pagamos, Total, Edad */}
                     <div className="bg-yellow-50 p-4 rounded-2xl border-2 border-yellow-200 space-y-3">
                       <p className="text-xs font-bold text-yellow-600 uppercase">📊 Datos Críticos para el Vendedor</p>
                       <div className="form-grid">
                         <div>
                           <Label className="field-label text-xs">Tu Pierdes ($)</Label>
                           <input 
                             type="number"
                             value={serviceFormData.yourLoss}
                             onChange={e => setServiceFormData({...serviceFormData, yourLoss: e.target.value})}
                             className="form-input focus:border-yellow-400 text-sm"
                             placeholder="0"
                           />
                         </div>
                         <div>
                           <Label className="field-label text-xs">Nosotros te Pagamos ($)</Label>
                           <input 
                             type="number"
                             value={serviceFormData.ourPayment}
                             onChange={e => setServiceFormData({...serviceFormData, ourPayment: e.target.value})}
                             className="form-input focus:border-yellow-400 text-sm"
                             placeholder="0"
                           />
                         </div>
                       </div>
                       <div className="form-grid">
                         <div>
                           <Label className="field-label text-xs">Total ($)</Label>
                           <input 
                             type="number"
                             value={serviceFormData.total}
                             onChange={e => setServiceFormData({...serviceFormData, total: e.target.value})}
                             className="form-input focus:border-yellow-400 text-sm"
                             placeholder="0"
                           />
                         </div>
                         <div>
                           <Label className="field-label text-xs">Edad (años)</Label>
                           <input 
                             type="number"
                             value={serviceFormData.age}
                             onChange={e => setServiceFormData({...serviceFormData, age: e.target.value})}
                             className="form-input focus:border-yellow-400 text-sm"
                             placeholder="18"
                             min="0"
                             max="150"
                           />
                         </div>
                       </div>
                     </div>

                     {/* Términos y Condiciones */}
                     <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 space-y-3">
                       <div className="flex items-start gap-3">
                         <Checkbox 
                           id="terminosAceptados"
                           checked={serviceFormData.terminosAceptados}
                           onCheckedChange={checked => setServiceFormData({...serviceFormData, terminosAceptados: checked})}
                           className="w-5 h-5 rounded mt-1"
                         />
                         <Label htmlFor="terminosAceptados" className="font-bold text-gray-700 cursor-pointer text-sm">
                           ✅ El cliente acepta que el valor de nuestros servicios incluye atención a domicilio
                         </Label>
                       </div>
                     </div>

                     <Button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl py-6 font-bold mt-4 shadow-md border-b-4 border-yellow-700">
                       Crear y Asignar Servicio
                     </Button>
                   </form>
                 </DialogContent>
               </Dialog>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {appointments.filter(apt => apt.status !== 'completed').length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-yellow-50 rounded-[2rem] border-2 border-dashed border-yellow-300">
                    <p className="text-xl font-bold text-yellow-600">¡No hay servicios activos! 🌟</p>
                  </div>
                ) : (
                  appointments.filter(apt => apt.status !== 'completed').map(apt => (
                    <div key={apt.id} className="bg-white border-2 border-gray-100 p-5 rounded-3xl shadow-md hover:border-yellow-300 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-lg truncate">{apt.clientName}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          apt.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {apt.status === 'confirmed' ? 'Asignado' : 'Pendiente'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1 font-bold">{apt.serviceType}</p>
                      <p className="text-lg text-purple-600 mb-2 font-black">{formatCurrency(serviceCatalog[apt.serviceType] || 0)}</p>
                      <p className="text-sm text-gray-500 mb-3 font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> {apt.date} - {apt.time}
                      </p>

                      {/* Datos Críticos */}
                      {(apt.yourLoss || apt.ourPayment || apt.total || apt.age) && (
                        <div className="bg-yellow-50 p-3 rounded-xl mb-3 border border-yellow-200 space-y-2">
                          <p className="text-xs font-bold text-yellow-600 uppercase">📊 Datos del Vendedor</p>
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

                      <div className="bg-green-50 p-2 rounded-xl">
                        <p className="text-xs font-bold text-green-700">
                          👨‍⚕️ {apt.piojologistName || 'Sin asignar'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
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
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            onClick={() => handleDeleteUser(user.id)}
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
                     const totalServiceValue = completedServices.reduce((acc, curr) => acc + (curr.price || 0), 0);
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
                   <option value="piojologist">🦸 Piojólogo</option>
                   <option value="admin">👑 Admin</option>
                 </select>
              </div>
               <div>
                <Label className="field-label">Password</Label>
                <input 
                  required
                  type="text"
                  className="form-input focus:border-blue-400 focus:bg-white transition-all"
                  value={userFormData.password}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder="***"
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