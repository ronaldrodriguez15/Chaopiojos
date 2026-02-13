import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, startTransition } from 'react';
import { motion } from 'framer-motion';
import { Settings, UserPlus, Calendar, User, CheckCircle, PieChart, Crown, Users, Trash2, Edit, Save, X, ShoppingBag, DollarSign, PackagePlus, Map, Loader, RefreshCw, Menu, Eye, CheckCircle2, XCircle, Copy } from 'lucide-react';
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
import { Bar, Pie, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import ScheduleManagement from '@/components/ScheduleManagement';
import PiojologistMap from '@/components/PiojologistMap';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { geocodeAddress } from '@/lib/geocoding';
import { bookingService, referralService, userService } from '@/lib/api';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

// Lazy load módulos pesados para mejor rendimiento
const DashboardModule = lazy(() => import('@/components/admin/DashboardModule'));
const UsersModule = lazy(() => import('@/components/admin/UsersModule'));
const ProductsModule = lazy(() => import('@/components/admin/ProductsModule'));
const ServicesModule = lazy(() => import('@/components/admin/ServicesModule'));
const EarningsModule = lazy(() => import('@/components/admin/EarningsModule'));
const RequestsModule = lazy(() => import('@/components/admin/RequestsModule'));
const ProductDetailDialog = lazy(() => import('@/components/admin/dialogs/ProductDetailDialog'));

// Lazy load diálogos para mejor rendimiento
const ServiceCatalogDialog = lazy(() => import('@/components/admin/dialogs/ServiceCatalogDialog'));
const DeleteConfirmDialog = lazy(() => import('@/components/admin/dialogs/DeleteConfirmDialog'));
const RejectRequestDialog = lazy(() => import('@/components/admin/dialogs/RejectRequestDialog'));
const UserDetailDialog = lazy(() => import('@/components/admin/dialogs/UserDetailDialog'));
const EarningsDialog = lazy(() => import('@/components/admin/dialogs/EarningsDialog'));
const PayAllDialog = lazy(() => import('@/components/admin/dialogs/PaymentDialogs').then(module => ({ default: module.PayAllDialog })));
const PaymentConfirmDialog = lazy(() => import('@/components/admin/dialogs/PaymentDialogs').then(module => ({ default: module.PaymentConfirmDialog })));

// Loading component
const LoadingModule = () => (
  <div className="flex items-center justify-center p-12">
    <Loader className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

const AdminView = ({ users, handleCreateUser, handleUpdateUser, handleDeleteUser, appointments, baseAppointments = [], bookings = [], updateAppointments, updateBookings, reloadBookings, piojologists, products, updateProducts, services = [], onCreateService, onUpdateService, onDeleteService, serviceCatalog, formatCurrency, syncICalEvents, productRequests, onApproveRequest, onRejectRequest, onNotify }) => {
  const { toast } = useToast();
  
  // User Management State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isGeocodifying, setIsGeocodifying] = useState(false);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [referralCodeValidation, setReferralCodeValidation] = useState({ isValidating: false, isValid: null, message: '' });
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'piojologist',
    specialty: '',
    available: true,
    address: '',
    commission_rate: 50,
    referral_code_used: '', // Código de referido ingresado
    referral_code: '' // Código único generado para la piojóloga
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

  // Delete Confirmation Modals
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState(null); // 'service' or 'product'

  // Reject Request Confirmation Modal
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Earnings Modal State
  const [showEarningsModal, setShowEarningsModal] = useState(false);
  const [earningsHistory, setEarningsHistory] = useState([]);
  const [loadingEarnings, setLoadingEarnings] = useState(false);
  const [payingAll, setPayingAll] = useState(false);
  const [selectedPiojologist, setSelectedPiojologist] = useState(null);

  // Payment Confirmation Modal
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Detalles de Servicios por Piojóloga Modal
  const [openPayDialog, setOpenPayDialog] = useState(null); // ID de la piojóloga para pagar servicios
  const [openHistoryDialog, setOpenHistoryDialog] = useState(null); // ID de la piojóloga para ver historial

  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [servicesPage, setServicesPage] = useState(1);
  const [earningsPage, setEarningsPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const itemsPerPage = 10;
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
    startTransition(() => {
      setActiveTab(value);
      localStorage.setItem('adminTab', value);
    });
  };

  // Mobile nav toggle for tabs
  const [isNavOpen, setIsNavOpen] = useState(false);
  useEffect(() => {
    // Close mobile nav when tab changes
    setIsNavOpen(false);
  }, [activeTab]);

  const [appointmentFormData, setAppointmentFormData] = useState({
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
    // Si tiene services_per_person, calcular el total sumando todos
    if (apt.services_per_person && Array.isArray(apt.services_per_person)) {
      const total = apt.services_per_person.reduce((sum, serviceType) => {
        return sum + (serviceCatalog[serviceType] || 0);
      }, 0);
      return total;
    }
    
    // Fallback al comportamiento anterior
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

  // Service Management State
  const [editingService, setEditingService] = useState(null);
  const [serviceCatalogFormData, setServiceCatalogFormData] = useState({
    name: '',
    value: ''
  });

  const resetUserForm = () => {
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: 'piojologist',
      specialty: '',
      available: true,
      address: '',
      referral_code_used: '',
      referral_code: ''
    });
    setEditingUser(null);
    setReferralCodeValidation({ isValid: true, message: '' });
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

  const handleRemoveImage = () => {
    setProductFormData({...productFormData, image: ''});
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    // Si ya es una URL completa o base64, devolverla tal como está
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
      return imagePath;
    }
    // Si es una ruta relativa, construir la URL completa
    return `/storage/products/${imagePath}`;
  };

  const formatPriceInput = (value) => {
    if (!value) return '';
    // Formatear con puntos de miles al estilo colombiano
    const numericValue = value.toString().replace(/[^\d]/g, '');
    if (!numericValue) return '';
    return parseInt(numericValue).toLocaleString('es-CO');
  };

  const handlePriceChange = (e) => {
    let value = e.target.value;
    // Remover todo excepto números
    value = value.replace(/[^\d]/g, '');
    
    setProductFormData({...productFormData, price: value});
  };

  const formatDate12H = (dateString) => {
    if (!dateString) return 'No especificado';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return date.toLocaleString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Error en fecha';
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

  const handleOpenUserDetail = (user) => {
    // Buscar el usuario más reciente del array users para asegurar datos actualizados
    const freshUser = users.find(u => u.id === user.id) || user;
    setDetailUser(freshUser);
    setIsUserDetailOpen(true);
  };

  const handleOpenEarningsModal = (piojologist) => {
    setShowEarningsModal(true);
    // Aquí puedes agregar lógica adicional si necesitas filtrar por piojóloga específica
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setIsGeocodifying(true);

    try {
      let userToSave = { ...userFormData };

      // Validar código de referido si se está usando uno
      if (!editingUser && userToSave.referral_code_used && userToSave.role === 'piojologist') {
        if (!referralCodeValidation.isValid) {
          toast({
            title: "❌ Código de referido inválido",
            description: "Por favor verifica el código de referido.",
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
          setIsGeocodifying(false);
          return;
        }
      }

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
          // Si el usuario editado es el que está en detailUser, actualizarlo con los datos frescos
          if (detailUser && detailUser.id === editingUser.id) {
            setDetailUser(result.user);
          }
          toast({ title: "¡Usuario Actualizado! 🎉", className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200" });
          setIsUserDialogOpen(false);
          resetUserForm();
          setReferralCodeValidation({ isValid: true, message: '' });
        } else {
          toast({
            title: "Error al actualizar",
            description: result.message || "No se pudo actualizar el usuario",
            variant: "destructive",
            className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
          });
        }
      } else {
        // Generar código único de referido para nuevas piojólogas
        if (userToSave.role === 'piojologist') {
          try {
            // Generar código único simple
            const timestamp = Date.now().toString(36);
            const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
            const uniqueCode = `${userToSave.name?.substring(0,3).toUpperCase() || 'REF'}${randomStr}${timestamp.substr(-2)}`;
            
            userToSave.referral_code = uniqueCode;
            toast({
              title: "🎯 Código generado",
              description: `Código único asignado: ${uniqueCode}`,
              className: "bg-yellow-100 text-yellow-800 rounded-2xl border-2 border-yellow-200"
            });
          } catch (error) {
            console.warn('Error generando código único:', error);
            // Continuar sin código único - no es crítico
          }
        }

        result = await handleCreateUser(userToSave);
        if (result.success) {
          toast({ title: "¡Nuevo Amigo Añadido! 🎈", className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200" });
          setIsUserDialogOpen(false);
          resetUserForm();
          setReferralCodeValidation({ isValid: true, message: '' });
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

  // Earnings Logic
  const handleMarkServiceAsPaid = async (serviceId, piojologistId, piojologistName, amount, clientName, serviceType, serviceDate) => {
    try {
      // Buscar el appointment completo
      const appointment = appointments.find(apt => apt.id === serviceId);
      if (!appointment) {
        toast({
          title: "❌ Error",
          description: "No se encontró el servicio",
          variant: "destructive"
        });
        return;
      }

      // Obtener el ID correcto para la API (backendId, bookingId o id)
      const backendId = appointment.backendId || appointment.bookingId || appointment.id;
      
      // Actualizar en la base de datos primero
      const result = await bookingService.update(backendId, {
        payment_status_to_piojologist: 'paid'
      });

      if (!result.success) {
        toast({
          title: "❌ Error al guardar",
          description: result.message || "No se pudo guardar el pago en la base de datos",
          variant: "destructive"
        });
        return;
      }

      // Solo si la API respondió exitosamente, actualizar el estado local
      const updatedAppointments = appointments.map(apt => 
        apt.id === serviceId 
          ? { 
              ...apt, 
              payment_status_to_piojologist: 'paid',
              paymentStatusToPiojologist: 'paid'
            }
          : apt
      );
      
      if (typeof updateAppointments === 'function') {
        updateAppointments(updatedAppointments);
      }

      // Recargar bookings desde el backend para asegurar sincronización
      if (typeof reloadBookings === 'function') {
        await reloadBookings();
      }

      toast({
        title: "💰 Servicio Pagado",
        description: `Se marcó como pagado el servicio de ${piojologistName} por ${formatCurrency(amount)}`,
        className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200"
      });

    } catch (error) {
      console.error('Error marcando servicio como pagado:', error);
      toast({
        title: "❌ Error",
        description: "No se pudo marcar el servicio como pagado",
        variant: "destructive"
      });
    }
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

  // Service Catalog Logic
  const handleOpenServiceDialog = (service = null) => {
    if (service) {
      setEditingService(service);
      setServiceCatalogFormData({
        name: service.name,
        value: service.value.toString()
      });
    } else {
      setEditingService(null);
      setServiceCatalogFormData({
        name: '',
        value: ''
      });
    }
    setIsServiceDialogOpen(true);
  };

  const handleServiceCatalogSubmit = async (e) => {
    e.preventDefault();
    
    const serviceData = {
      name: serviceCatalogFormData.name.trim(),
      value: parseFloat(serviceCatalogFormData.value)
    };

    if (editingService) {
      // Actualizar servicio existente
      const result = await onUpdateService(editingService.id, serviceData);
      if (result) {
        toast({ 
          title: "✨ Servicio Actualizado", 
          description: `${serviceData.name} ahora vale ${toMoney(serviceData.value)}`,
          className: "bg-emerald-100 text-emerald-800 rounded-2xl border-2 border-emerald-200" 
        });
      }
    } else {
      // Crear nuevo servicio
      const result = await onCreateService(serviceData);
      if (result) {
        toast({ 
          title: "🌟 Servicio Creado", 
          description: `${serviceData.name} agregado al catálogo`,
          className: "bg-emerald-100 text-emerald-800 rounded-2xl border-2 border-emerald-200" 
        });
      }
    }
    
    setIsServiceDialogOpen(false);
    setEditingService(null);
    setServiceCatalogFormData({ name: '', value: '' });
  };

  const handleDeleteServiceWithConfirm = (serviceId) => {
    const service = services.find(s => s.id === serviceId);
    setItemToDelete(service);
    setDeleteType('service');
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteService = async () => {
    if (itemToDelete && deleteType === 'service') {
      const result = await onDeleteService(itemToDelete.id);
      if (result) {
        toast({ 
          title: "🗑️ Servicio Eliminado", 
          description: "El servicio ha sido removido del catálogo",
          className: "bg-red-100 text-red-800 rounded-2xl border-2 border-red-200" 
        });
      }
    }
    setDeleteConfirmOpen(false);
    setItemToDelete(null);
    setDeleteType(null);
  };

  // Appointment Logic
  const handleAssignPiojologist = async (appointmentId, piojologistId, appointmentArg = null) => {
    const piojologist = piojologists.find(p => p.id === parseInt(piojologistId));
    const appointment = appointmentArg || appointments.find(a => a.id === appointmentId || a.backendId === appointmentId || a.bookingId === appointmentId);
    const servicePrice = getServicePrice(appointment);
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

      // Disparar evento personalizado para actualización en tiempo real
      window.dispatchEvent(new CustomEvent('serviceAssigned', {
        detail: {
          appointmentId: appointmentId,
          piojologistId: parseInt(piojologistId),
          appointment: assignedSnapshot,
          timestamp: Date.now()
        }
      }));
      
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
        <div className="flex items-center justify-between md:justify-start gap-3 mb-4 md:mb-6">
          <h2 className="text-xl font-black text-gray-800 md:hidden">Módulos</h2>
          <Button
            type="button"
            variant="outline"
            className="md:hidden rounded-2xl border-2 border-orange-200 text-orange-600 bg-white/90"
            onClick={() => setIsNavOpen(prev => !prev)}
            aria-expanded={isNavOpen}
            aria-label="Abrir menú de módulos"
          >
            <Menu className="w-5 h-5 mr-2" />
            {isNavOpen ? 'Cerrar' : 'Abrir'}
          </Button>
        </div>

        <TabsList className={`w-full bg-white/50 p-2 rounded-[2rem] border-2 border-orange-100 mb-8 flex-wrap h-auto gap-2 ${isNavOpen ? 'flex' : 'hidden'} md:flex`}>
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
          <TabsTrigger value="services" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-emerald-400 data-[state=active]:text-white transition-all">
            💼 Servicios
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
          <Suspense fallback={<div>Cargando...</div>}>
            <UsersModule
              users={users}
              handleOpenUserDialog={handleOpenUserDialog}
              handleOpenUserDetail={handleOpenUserDetail}
              handleDeleteUser={handleDeleteUser}
              handleOpenEarningsModal={handleOpenEarningsModal}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <ProductsModule
              products={products}
              formatCurrency={formatCurrency}
              handleProductSubmit={handleProductSubmit}
              handleDeleteProduct={handleDeleteProduct}
              productFormData={productFormData}
              setProductFormData={setProductFormData}
              isProductDialogOpen={isProductDialogOpen}
              setIsProductDialogOpen={setIsProductDialogOpen}
              setSelectedProduct={setSelectedProduct}
              setIsProductDetailOpen={setIsProductDetailOpen}
              formatPriceInput={formatPriceInput}
              handlePriceChange={handlePriceChange}
              getImageUrl={getImageUrl}
              handleImageUpload={handleImageUpload}
              handleRemoveImage={handleRemoveImage}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <Suspense fallback={<LoadingModule />}>
            <ServicesModule
              services={services}
              toMoney={toMoney}
              onOpenServiceDialog={handleOpenServiceDialog}
              onDeleteService={handleDeleteServiceWithConfirm}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="earnings" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <EarningsModule
              piojologists={piojologists}
              appointments={appointments}
              users={users}
              getServicePrice={getServicePrice}
              formatCurrency={formatCurrency}
              handleMarkServiceAsPaid={handleMarkServiceAsPaid}
              openPayDialog={openPayDialog}
              setOpenPayDialog={setOpenPayDialog}
              openHistoryDialog={openHistoryDialog}
              setOpenHistoryDialog={setOpenHistoryDialog}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="map" className="space-y-6">
          <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-cyan-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-cyan-100 text-cyan-600 rounded-full">
                  <Map className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-800">
                  Ubicaciones de Piojólogas
                </h3>
              </div>
              <div className="px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-sm font-bold self-start sm:self-auto">
                🎯 {users.filter(u => u.role === 'piojologist' && u.lat && u.lng).length} ubicadas
              </div>
            </div>
            
            <div className="h-[400px] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden">
              <PiojologistMap key={users.length} piojologists={users} />
            </div>

            <div className="mt-4 sm:mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-cyan-50 p-3 sm:p-4 rounded-2xl border-2 border-cyan-200">
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-bold">📍 Nota:</span> El mapa se actualiza automáticamente cuando agregas piojólogas con dirección.
                </p>
              </div>
              <div className="bg-green-50 p-3 sm:p-4 rounded-2xl border-2 border-green-200">
                <p className="text-xs sm:text-sm text-gray-600">
                  <span className="font-bold">💡 Tip:</span> Usa el autocomplete al crear piojólogas para ubicaciones precisas.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="requests" className="space-y-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <RequestsModule
              productRequests={productRequests}
              resolveRequestTotals={resolveRequestTotals}
              formatCurrency={formatCurrency}
              onApproveRequest={onApproveRequest}
              onRejectRequest={onRejectRequest}
            />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* User Dialog Modal */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-blue-400 p-0 overflow-hidden sm:max-w-md bg-blue-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{editingUser ? 'Editar Miembro' : 'Nuevo Miembro'}</DialogTitle>
          </DialogHeader>
          {/* Title */}
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <User className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                {editingUser ? 'EDITAR MIEMBRO' : 'NUEVO MIEMBRO'}
              </h2>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <form onSubmit={handleUserSubmit} className="px-8 pb-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Nombre del Cliente</label>
              <input 
                required
                className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                value={userFormData.name}
                onChange={e => setUserFormData({...userFormData, name: e.target.value})}
                placeholder="Ej. Familia Pérez"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">Rol</label>
                <select 
                  className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all"
                  value={userFormData.role}
                  onChange={e => setUserFormData({...userFormData, role: e.target.value})}
                >
                  <option value="piojologist">🦸 Piojóloga</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Contraseña {editingUser && <span className="text-xs text-gray-400">(mantener actual)</span>}
                </label>
                <input 
                  required={!editingUser}
                  type="password"
                  className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                  value={userFormData.password}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder={editingUser ? "Dejar vacío si no cambia" : "***"}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Email</label>
              <input 
                required
                type="email"
                className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                value={userFormData.email}
                onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                placeholder="correo@ejemplo.com"
              />
            </div>

            {userFormData.role === 'piojologist' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Especialidad (Súper Poder)</label>
                  <input 
                    className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                    value={userFormData.specialty || ''}
                    onChange={e => setUserFormData({...userFormData, specialty: e.target.value})}
                    placeholder="Ej. Visión de Rayos X"
                  />
                </div>

                {/* Código de Referido Usado */}
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      🎁 Código de Referido <span className="text-xs text-gray-400">(opcional)</span>
                    </label>
                    <input 
                      className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-blue-500 transition-all placeholder-gray-400"
                      value={userFormData.referral_code_used || ''}
                      onChange={async (e) => {
                        const code = e.target.value.toUpperCase();
                        setUserFormData({...userFormData, referral_code_used: code});
                        
                        // Validar código si no está vacío
                        if (code.trim()) {
                          try {
                            const isValid = await referralService.validateCode(code);
                            setReferralCodeValidation({
                              isValid,
                              message: isValid ? '✅ Código válido' : '❌ Código no válido'
                            });
                          } catch (error) {
                            setReferralCodeValidation({
                              isValid: false,
                              message: '❌ Error al validar código'
                            });
                          }
                        } else {
                          setReferralCodeValidation({ isValid: true, message: '' });
                        }
                      }}
                      placeholder="Ej. MARIA2024"
                    />
                    {referralCodeValidation.message && (
                      <p className={`text-xs mt-2 font-medium ${referralCodeValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {referralCodeValidation.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Código de Referido Propio */}
                {editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      🔗 Código de Referido Único
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input 
                          className="w-full bg-white border-2 border-blue-400 rounded-2xl p-4 font-mono text-lg font-bold text-gray-700 outline-none focus:border-blue-500 transition-all h-14"
                          value={userFormData.referral_code || ''}
                          readOnly
                          placeholder="Se genera automáticamente"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={async () => {
                          try {
                            // Generar código único simple
                            const timestamp = Date.now().toString(36);
                            const randomStr = Math.random().toString(36).substr(2, 5).toUpperCase();
                            const newCode = `${userFormData.name?.substring(0,3).toUpperCase() || 'REF'}${randomStr}${timestamp.substr(-2)}`;
                            
                            setUserFormData({...userFormData, referral_code: newCode});
                            
                            toast({
                              title: "🎯 Código Regenerado",
                              description: `Nuevo código: ${newCode}`,
                              className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
                            });
                          } catch (error) {
                            toast({
                              title: "❌ Error",
                              description: "No se pudo regenerar el código",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-2xl w-14 h-14 shadow-lg transition-all"
                        title="Regenerar Código"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Este código puede ser usado por otras piojólogas para referenciarla
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {userFormData.role === 'piojologist' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">📍 Dirección</label>
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
                      className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
                    });
                  }}
                />
              </div>
            )}

            {userFormData.role !== 'piojologist' && (
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">📍 Dirección (Opcional)</label>
                <AddressAutocomplete
                  value={userFormData.address || ''}
                  onChange={(address) => setUserFormData({...userFormData, address})}
                  onSelect={(suggestion) => {
                    setUserFormData({
                      ...userFormData,
                      address: suggestion.fullName || suggestion.displayName,
                      lat: suggestion.lat,
                      lng: suggestion.lng
                    });
                    toast({
                      title: "📍 Ubicación seleccionada",
                      description: `${suggestion.name || suggestion.displayName}`,
                      className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200"
                    });
                  }}
                />
              </div>
            )}

            <div className="pt-6">
              <Button 
                type="submit"
                disabled={isGeocodifying}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-3xl py-4 px-6 font-bold text-lg shadow-lg transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGeocodifying ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Localizando...
                  </>
                ) : (
                  editingUser ? 'Guardar Cambios' : 'Crear y Asignar Miembro'
                )}
              </Button>
            </div>
          </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <ProductDetailDialog
          isOpen={isProductDetailOpen}
          onClose={setIsProductDetailOpen}
          product={selectedProduct}
          formatCurrency={formatCurrency}
          onEdit={(product) => {
            setIsProductDetailOpen(false);
            handleOpenProductDialog(product);
          }}
          onDelete={(productId) => {
            handleDeleteProduct(productId);
            setIsProductDetailOpen(false);
          }}
        />
      </Suspense>

      {/* User Detail Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <UserDetailDialog
          isOpen={isUserDetailOpen}
          onClose={() => setIsUserDetailOpen(false)}
          user={detailUser}
          formatCurrency={formatCurrency}
          formatDate12H={formatDate12H}
          onEdit={(user) => {
            setIsUserDetailOpen(false);
            handleOpenUserDialog(user);
          }}
          onDelete={(userId) => {
            handleDeleteUser(userId);
            setIsUserDetailOpen(false);
          }}
        />
      </Suspense>

      {/* Earnings Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <EarningsDialog
          isOpen={showEarningsModal}
          onClose={() => setShowEarningsModal(false)}
          piojologists={piojologists}
          appointments={appointments}
          users={users}
          formatCurrency={formatCurrency}
          formatDate12H={formatDate12H}
          earningsHistory={earningsHistory}
          loadingEarnings={loadingEarnings}
        />
      </Suspense>

      {/* Service Catalog Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <ServiceCatalogDialog
          isOpen={isServiceDialogOpen}
          onClose={() => {
            setIsServiceDialogOpen(false);
            setEditingService(null);
            setServiceCatalogFormData({ name: '', value: '' });
          }}
          editingService={editingService}
          formData={serviceCatalogFormData}
          setFormData={setServiceCatalogFormData}
          onSubmit={handleServiceCatalogSubmit}
        />
      </Suspense>

      {/* Delete Confirmation Dialog */}
      <Suspense fallback={<div>Cargando...</div>}>
        <DeleteConfirmDialog
          isOpen={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
            setDeleteType(null);
          }}
          onConfirm={() => {
            if (deleteType === 'service') {
              confirmDeleteService();
            } else if (deleteType === 'product') {
              handleDeleteProduct(itemToDelete?.id || itemToDelete);
              setDeleteConfirmOpen(false);
              setItemToDelete(null);
              setDeleteType(null);
            }
          }}
          item={itemToDelete}
          itemType={deleteType === 'service' ? 'servicio' : 'producto'}
        />
      </Suspense>
    </div>
  );
};

export default AdminView;