import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import PiojologistView from '@/components/PiojologistView';
import AdminView from '@/components/AdminView';
import Login from '@/components/Login';
import { LogOut, Sparkles, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { authService, userService, bookingService, serviceService } from '@/lib/api';
import { API_URL } from '@/lib/config';

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

const loadRejectionCache = () => {
  try {
    const raw = localStorage.getItem('rejectionHistoryCache');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const saveRejectionCache = (data = {}) => {
  try {
    localStorage.setItem('rejectionHistoryCache', JSON.stringify(data));
  } catch (e) {
    // ignore
  }
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Notification system
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [seenAppointmentIds, setSeenAppointmentIds] = useState([]);

  const statusLabel = (status) => {
    const map = {
      pending: 'Pendiente',
      assigned: 'Asignado',
      accepted: 'Aceptado',
      completed: 'Completado',
      rejected: 'Rechazado',
      cancelado: 'Cancelado',
      confirmado: 'Asignado'
    };
    return map[status] || status || 'Desconocido';
  };

  const pushNotification = (data) => {
    const base = {
      id: data.id || `notif-${Date.now()}`,
      type: data.type || 'info',
      message: data.message || '',
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      read: false,
      appointmentId: data.appointmentId,
      appointment: data.appointment,
      piojologistId: data.piojologistId,
      forRole: data.forRole,
      forUserId: data.forUserId,
      requestId: data.requestId,
      statusLabel: data.appointment?.status ? statusLabel(data.appointment.status) : data.statusLabel
    };
    setNotifications(prev => {
      const next = [base, ...prev];
      try {
        localStorage.setItem('notifications', JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  // Verificar sesión al cargar la aplicación
  useEffect(() => {
    // Restaurar notificaciones guardadas
    try {
      const stored = localStorage.getItem('notifications');
      if (stored) {
        const parsed = JSON.parse(stored).map(n => ({ ...n, timestamp: n.timestamp ? new Date(n.timestamp) : new Date() }));
        setNotifications(parsed);
      }
    } catch (e) {
      // ignore
    }

    // Restaurar IDs de agendamientos ya notificados
    try {
      const storedSeen = localStorage.getItem('seenAppointments');
      if (storedSeen) {
        const parsedSeen = JSON.parse(storedSeen);
        if (Array.isArray(parsedSeen)) setSeenAppointmentIds(parsedSeen);
      }
    } catch (e) {
      // ignore
    }

    const checkAuth = async () => {
      const token = authService.getToken();
      const savedUser = authService.getCurrentUser();
      
      if (token && savedUser) {
        // Verificar que el token siga siendo válido
        const result = await authService.me();
        if (result.success) {
          setCurrentUser(result.user);
        } else {
          // Token inválido o expirado, limpiar sesión
          authService.logout();
          setCurrentUser(null);
        }
      }
      setIsCheckingAuth(false);
    };
    
    checkAuth();
  }, []);

  const [appointments, setAppointments] = useState(() => {
    // Limpiar localStorage de appointments viejos de iCal
    localStorage.removeItem('appointments');
    return [];
  });

  const [bookings, setBookings] = useState([]);

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Spray Anti-Piojos', price: 15000, stock: 50, image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=200' },
      { id: 2, name: 'Peine Metálico Fino', price: 25000, stock: 30, image: 'https://images.unsplash.com/photo-1596462502278-27bfdd403cc2?auto=format&fit=crop&q=80&w=200' },
      { id: 3, name: 'Champú Repelente', price: 20000, stock: 40, image: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&q=80&w=200' }
    ];
  });

  // Product Requests State
  const [productRequests, setProductRequests] = useState(() => {
    const saved = localStorage.getItem('productRequests');
    return saved ? JSON.parse(saved) : [];
  });

  // Services with prices definition (editable from admin)
  const defaultServices = [
    { id: 1, name: 'Normal', value: 70000 },
    { id: 2, name: 'Elevado', value: 100000 },
    { id: 3, name: 'Muy Alto', value: 130000 }
  ];

  const normalizeServices = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((item, idx) => {
          if (item && typeof item === 'object') {
            const name = String(item.name ?? item.label ?? '').trim();
            const value = Number(item.value ?? item.price ?? 0);
            if (!name || !Number.isFinite(value)) return null;
            return { id: Number(item.id ?? Date.now() + idx), name, value };
          }
          return null;
        })
        .filter(Boolean);
    }
    if (typeof input === 'object') {
      return Object.entries(input).map(([name, value], idx) => ({
        id: Date.now() + idx,
        name: String(name).trim(),
        value: Number(value ?? 0)
      })).filter(item => item.name && Number.isFinite(item.value));
    }
    return [];
  };

  const [services, setServices] = useState(() => {
    try {
      const raw = localStorage.getItem('serviceCatalog');
      const parsed = raw ? JSON.parse(raw) : null;
      const normalized = normalizeServices(parsed);
      return normalized.length ? normalized : defaultServices;
    } catch (e) {
      return defaultServices;
    }
  });

  const persistServices = (nextServices) => {
    try {
      localStorage.setItem('serviceCatalog', JSON.stringify(nextServices));
    } catch (e) {
      // ignore
    }
  };

  const loadServices = async () => {
    const result = await serviceService.getAll();
    if (result.success && Array.isArray(result.services)) {
      const normalized = normalizeServices(result.services);
      const next = normalized.length ? normalized : defaultServices;
      setServices(next);
      persistServices(next);
      return;
    }
    // fallback a localStorage/defaults
    persistServices(services);
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    persistServices(services);
  }, [services]);

  const serviceCatalog = useMemo(() => {
    return services.reduce((acc, svc) => {
      if (svc?.name) acc[svc.name] = Number(svc.value) || 0;
      return acc;
    }, {});
  }, [services]);

  // Format currency to COP
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Cargar usuarios desde el backend cuando se inicia sesión
  useEffect(() => {
    if (currentUser && authService.isAuthenticated()) {
      loadUsers();
      loadBookings();
    }
  }, [currentUser]);

  // Actualización automática cada 10 segundos para reflejar cambios rápidamente
  useEffect(() => {
    if (!currentUser || !authService.isAuthenticated()) return;
    
    const intervalId = setInterval(() => {
      loadBookings();
      loadUsers();
    }, 10000); // 10 segundos para actualizaciones más rápidas

    return () => clearInterval(intervalId);
  }, [currentUser]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    const result = await userService.getAll();
    if (result.success) {
      setUsers(result.users);
    }
    setIsLoadingUsers(false);
  };

  const loadBookings = async () => {
    try {
      const token = authService.getToken();
      const response = await fetch(`${API_URL}/bookings`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
          const data = await response.json();
          // Transformar bookings al formato de appointments para compatibilidad
          const cache = loadRejectionCache();
          const transformedBookings = data.map(booking => {
            // Extraer solo la fecha del formato ISO (YYYY-MM-DD)
            const fechaISO = booking.fecha.split('T')[0];

            // Normalizar estado desde backend (es/en) -> frontend (en)
            const statusMap = {
              pendiente: 'pending',
              aceptado: 'accepted',
              rechazado: 'pending',
              completado: 'completed',
              asignado: 'assigned',
              confirmado: 'assigned',
              cancelado: 'pending',
              assigned: 'assigned',
              accepted: 'accepted',
              rejected: 'pending',
              completed: 'completed'
            };
            const estadoLower = (booking.estado || '').toLowerCase();
            const normalizedStatus = statusMap[estadoLower] || 'pending';

            const transformed = {
              id: `booking-${booking.id}`,
              backendId: booking.id,
              clientName: booking.clientName,
              serviceType: booking.serviceType,
              services_per_person: booking.services_per_person,
              date: fechaISO,
              time: booking.hora,
              whatsapp: booking.whatsapp,
              email: booking.email,
              direccion: booking.direccion,
              barrio: booking.barrio,
              descripcionUbicacion: booking.descripcion_ubicacion,
              lat: booking.lat,
              lng: booking.lng,
              numPersonas: booking.numPersonas,
              hasAlergias: booking.hasAlergias,
              detalleAlergias: booking.detalleAlergias,
              referidoPor: booking.referidoPor,
              payment_method: booking.payment_method,
              price_confirmed: booking.price_confirmed,
              estimatedPrice: serviceCatalog[booking.serviceType] || 0,
              status: normalizedStatus,
              piojologistId: booking.piojologist_id || null,
              payment_status_to_piojologist: booking.payment_status_to_piojologist || 'pending',
              rejectionHistory: normalizeRejectionHistory(booking.rejectionHistory || booking.rejection_history || booking.rejections || cache[booking.id]),
              isPublicBooking: true
            };

            return transformed;
          });

          // Merge cache for bookings that came without history
          const mergedBookings = transformedBookings.map(b => {
            if (b.rejectionHistory && b.rejectionHistory.length > 0) return b;
            const cached = cache[b.backendId] || cache[b.id];
            return cached ? { ...b, rejectionHistory: normalizeRejectionHistory(cached) } : b;
          });

          setBookings(mergedBookings);
        }
    } catch (error) {
      console.error('❌ Error al cargar bookings:', error);
    }
  };

  const handleCreateService = async (serviceData) => {
    const result = await serviceService.create(serviceData);
    if (result.success) {
      await loadServices();
    }
    return result;
  };

  const handleUpdateService = async (serviceId, serviceData) => {
    const result = await serviceService.update(serviceId, serviceData);
    if (result.success) {
      await loadServices();
    }
    return result;
  };

  const handleDeleteService = async (serviceId) => {
    const result = await serviceService.delete(serviceId);
    if (result.success) {
      await loadServices();
    }
    return result;
  };

  // Sync appointments and products with localStorage
  useEffect(() => {
    localStorage.setItem('appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  // Combinar appointments (iCal) con bookings (reservas públicas)
  const allAppointments = useMemo(() => {
    return [...appointments, ...bookings];
  }, [appointments, bookings]);

  // Detectar nuevos agendamientos y generar notificaciones
  useEffect(() => {
    if (!currentUser) return;

    // Filtrar agendamientos relevantes según el rol
    let relevantAppointments = [];
    
    if (currentUser.role === 'admin') {
      relevantAppointments = allAppointments;
    } else if (currentUser.role === 'piojologist') {
      relevantAppointments = allAppointments.filter(apt => apt.piojologistId === currentUser.id);
    }

    const prevIds = new Set(seenAppointmentIds);
    const newOnes = relevantAppointments.filter(a => !prevIds.has(a.id));

    if (newOnes.length > 0) {
      newOnes.forEach(apt => {
        pushNotification({
          id: `notif-${apt.id}-${Date.now()}`,
          type: 'appointment',
          appointmentId: apt.id,
          appointment: apt,
          message: currentUser.role === 'admin' 
            ? `Nuevo agendamiento: ${apt.clientName} - ${apt.serviceType}`
            : `Te asignaron: ${apt.clientName} - ${apt.serviceType}`,
          forRole: currentUser.role
        });
      });

      const updatedSeen = Array.from(new Set([...seenAppointmentIds, ...newOnes.map(a => a.id)]));
      setSeenAppointmentIds(updatedSeen);
      try {
        localStorage.setItem('seenAppointments', JSON.stringify(updatedSeen));
      } catch (e) {
        // ignore
      }
    }
  }, [allAppointments, currentUser, seenAppointmentIds]);

  // Marcar notificación como leída
  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
  };

  // Marcar todas como leídas
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
  };

  // Limpiar notificaciones
  const clearNotifications = () => {
    setNotifications([]);
    try {
      localStorage.removeItem('notifications');
    } catch (e) {
      // ignore
    }
  };

  // Filtrar notificaciones según el usuario actual
  const getFilteredNotifications = () => {
    if (!currentUser) return [];
    
    return notifications.filter(notif => {
      // Notificaciones de agendamientos (todos las ven según su rol)
      if (notif.type === 'appointment') return true;
      
      // Notificaciones de asignación (solo piojólogas)
      if (notif.type === 'assignment') {
        if (currentUser.role === 'admin') return true;
        return currentUser.role === 'piojologist' && notif.piojologistId === currentUser.id;
      }
      
      // Notificaciones de aceptación/rechazo/completado (solo admins)
      if (notif.type === 'accepted' || notif.type === 'rejected' || notif.type === 'completed') {
        return currentUser.role === 'admin';
      }
      
      // Notificaciones de solicitud de productos (solo admins)
      if (notif.type === 'product-request') {
        return currentUser.role === 'admin' && notif.forRole === 'admin';
      }
      
      // Notificaciones de aprobación/rechazo (solo la piojóloga específica)
      if (notif.type === 'request-approved' || notif.type === 'request-rejected') {
        return notif.forUserId === currentUser.id;
      }
      
      // Notificaciones dirigidas explícitamente a un usuario
      if (notif.forUserId && notif.forUserId === currentUser.id) return true;
      if (notif.forRole && notif.forRole === currentUser.role) return true;

      return true;
    });
  };

  // Handler para crear notificaciones desde componentes hijos
  const handleNotify = (notificationData) => {
    pushNotification({
      id: `notif-${notificationData.appointmentId || Date.now()}-${Date.now()}`,
      ...notificationData
    });
  };

  // Cerrar dropdown de notificaciones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifications && !event.target.closest('.notification-container')) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Cerrar dropdown de notificaciones al hacer scroll (solo fuera del modal)
  useEffect(() => {
    const handleScroll = (event) => {
      // Verificar si el scroll es dentro del contenedor de notificaciones
      const notificationContainer = document.querySelector('.notification-container');
      if (showNotifications && notificationContainer && !notificationContainer.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      window.addEventListener('scroll', handleScroll, true);
    }
    
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showNotifications]);

  const updateAppointments = (newAppointments) => {
    setAppointments(newAppointments);
    // Persistir en localStorage para sincronización entre tabs
    try {
      localStorage.setItem('appointments', JSON.stringify(newAppointments));
    } catch (e) {
      console.error('Error al guardar appointments en localStorage:', e);
    }
  };

  const updateBookingsState = (newBookings) => {
    setBookings(newBookings);
    // Persistir en localStorage para sincronización entre tabs
    try {
      localStorage.setItem('bookings', JSON.stringify(newBookings));
    } catch (e) {
      console.error('Error al guardar bookings en localStorage:', e);
    }
    // Persist rejection history cache for cross-role visibility
    const cache = loadRejectionCache();
    newBookings.forEach(b => {
      const rh = normalizeRejectionHistory(b.rejectionHistory || b.rejection_history || b.rejections);
      if (rh.length > 0) {
        const key = b.backendId || b.id;
        if (key) cache[key] = rh;
      }
    });
    saveRejectionCache(cache);
  };

  const updateProducts = (newProducts) => {
    setProducts(newProducts);
  };

  // Sincronizar productRequests con localStorage
  useEffect(() => {
    localStorage.setItem('productRequests', JSON.stringify(productRequests));
  }, [productRequests]);

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setUsers([]);
  };

  const handleCreateUser = async (newUser) => {
    const result = await userService.create(newUser);
    if (result.success) {
      await loadUsers(); // Recargar lista de usuarios
      return result;
    }
    return result;
  };

  const handleUpdateUser = async (updatedUser) => {
    const { id, ...userData } = updatedUser;
    const result = await userService.update(id, userData);
    if (result.success) {
      await loadUsers(); // Recargar lista de usuarios
      return result;
    }
    return result;
  };

  const handleDeleteUser = async (userId) => {
    const result = await userService.delete(userId);
    if (result.success) {
      await loadUsers(); // Recargar lista de usuarios
      return result;
    }
    return result;
  };

  // Product Request Management
  const handleCreateProductRequest = (requestData) => {
    const kitPrice = Number(requestData.kitPrice ?? 300000);
    const hasKitBefore = productRequests.some(req => req.piojologistId === currentUser.id && req.isKitCompleto);
    const isFirstKitBenefit = Boolean(requestData.isKitCompleto && !hasKitBefore);
    const itemsWithPrice = (requestData.items || []).map(item => {
      const priceNum = Number(item.price ?? 0);
      const qtyNum = Number(item.quantity ?? 1);
      return {
        ...item,
        price: priceNum,
        quantity: qtyNum,
        subtotal: priceNum * qtyNum
      };
    });
    const itemsTotal = itemsWithPrice.reduce((sum, item) => sum + item.subtotal, 0);
    const studioContribution = requestData.isKitCompleto
      ? Number(requestData.studioContribution ?? (isFirstKitBenefit ? kitPrice / 2 : 0))
      : 0;
    const totalPrice = requestData.isKitCompleto
      ? kitPrice
      : Number(requestData.totalPrice ?? itemsTotal);
    const piojologistContribution = requestData.isKitCompleto
      ? Number(requestData.piojologistContribution ?? (kitPrice - studioContribution))
      : Number(requestData.piojologistContribution ?? totalPrice);

    const newRequest = {
      id: Date.now(),
      piojologistId: currentUser.id,
      piojologistName: currentUser.name,
      items: requestData.isKitCompleto ? [] : itemsWithPrice,
      isKitCompleto: requestData.isKitCompleto || false,
      status: 'pending', // pending, approved, rejected
      requestDate: new Date().toISOString(),
      resolvedBy: null,
      resolvedByName: null,
      resolvedDate: null,
      notes: requestData.notes || '',
      kitPrice,
      totalPrice,
      studioContribution,
      piojologistContribution,
      isFirstKitBenefit
    };

    setProductRequests(prev => [newRequest, ...prev]);

    // Crear notificación para administradores
    const notificationMessage = requestData.isKitCompleto 
      ? `${currentUser.name} solicitó un Kit Completo`
      : `${currentUser.name} solicitó ${requestData.items.length} producto${requestData.items.length > 1 ? 's' : ''}`;

    const newNotification = {
      id: `notif-request-${newRequest.id}`,
      type: 'product-request',
      requestId: newRequest.id,
      message: notificationMessage,
      timestamp: new Date(),
      read: false,
      forRole: 'admin'
    };

    setNotifications(prev => [newNotification, ...prev]);

    return { success: true, request: newRequest };
  };

  const handleApproveProductRequest = (requestId, adminNotes = '') => {
    setProductRequests(prev => prev.map(req => 
      req.id === requestId 
        ? {
            ...req,
            status: 'approved',
            resolvedBy: currentUser.id,
            resolvedByName: currentUser.name,
            resolvedDate: new Date().toISOString(),
            adminNotes
          }
        : req
    ));

    // Notificar a la piojóloga
    const request = productRequests.find(r => r.id === requestId);
    if (request) {
      const newNotification = {
        id: `notif-approved-${requestId}`,
        type: 'request-approved',
        requestId: requestId,
        message: `Tu solicitud de productos fue aprobada por ${currentUser.name}`,
        timestamp: new Date(),
        read: false,
        forUserId: request.piojologistId
      };

      setNotifications(prev => [newNotification, ...prev]);
    }

    return { success: true };
  };

  const handleRejectProductRequest = (requestId, reason = '') => {
    setProductRequests(prev => prev.map(req => 
      req.id === requestId 
        ? {
            ...req,
            status: 'rejected',
            resolvedBy: currentUser.id,
            resolvedByName: currentUser.name,
            resolvedDate: new Date().toISOString(),
            adminNotes: reason
          }
        : req
    ));

    // Notificar a la piojóloga
    const request = productRequests.find(r => r.id === requestId);
    if (request) {
      const newNotification = {
        id: `notif-rejected-${requestId}`,
        type: 'request-rejected',
        requestId: requestId,
        message: `Tu solicitud de productos fue rechazada por ${currentUser.name}${reason ? ': ' + reason : ''}`,
        timestamp: new Date(),
        read: false,
        forUserId: request.piojologistId
      };

      setNotifications(prev => [newNotification, ...prev]);
    }

    return { success: true };
  };

  // Handle earnings logic: Apply commission rate from piojologist
  const handleCompleteService = async (appointmentId, productsUsedIds = [], completionData = {}) => {
    const isBookingId = typeof appointmentId === 'string' && appointmentId.startsWith('booking-');
    const bookingMatch = bookings.find(a => a.id === appointmentId || a.backendId === appointmentId || a.bookingId === appointmentId || (isBookingId && a.backendId === Number(appointmentId.replace('booking-',''))));
    const appointmentMatch = appointments.find(a => a.id === appointmentId || a.backendId === appointmentId || a.bookingId === appointmentId);
    const appointment = appointmentMatch || bookingMatch;
    if (!appointment || !appointment.piojologistId) return;

    const backendId = appointment.backendId || appointment.bookingId || (isBookingId ? appointmentId.replace('booking-','') : appointmentId);
    const servicePrice = serviceCatalog[appointment.serviceType] || 0;
    
    // Get piojologist's commission rate (default to 50% if not set)
    const piojologist = users.find(u => u.id === appointment.piojologistId);
    const commissionRate = (piojologist?.commission_rate || 50) / 100;
    const piojologistShare = servicePrice * commissionRate;

    // Calculate deductions from used products
    let productDeductions = 0;
    productsUsedIds.forEach(prodId => {
      const product = products.find(p => p.id === parseInt(prodId));
      if (product) productDeductions += product.price;
    });

    const netEarnings = piojologistShare - productDeductions;

    // Persist in backend for public bookings
    if (appointment.isPublicBooking || isBookingId || appointment.backendId) {
      try {
        await bookingService.update(backendId, { 
          status: 'completed',
          plan_type: completionData.planType || appointment.serviceType,
          price_confirmed: completionData.priceConfirmed ?? servicePrice,
          service_notes: completionData.notes || null,
          additional_costs: completionData.additionalCosts || 0
        });
      } catch (err) {
        console.error('Error actualizando booking a completed', err);
      }
    }

    // Update User Earnings
    const updatedUsers = users.map(user => {
      if (user.id === appointment.piojologistId) {
        return { 
          ...user, 
          earnings: (user.earnings || 0) + netEarnings 
        };
      }
      return user;
    });
    setUsers(updatedUsers);

    // Update Appointment/Booking Status locally
    if (appointment.isPublicBooking || isBookingId || bookingMatch) {
      const updatedBookings = bookings.map(apt => 
        (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId || (isBookingId && apt.backendId === Number(appointmentId.replace('booking-',''))))
          ? { ...apt, status: 'completed', price: completionData.priceConfirmed ?? servicePrice, price_confirmed: completionData.priceConfirmed ?? servicePrice, planType: completionData.planType || apt.planType || apt.serviceType, serviceNotes: completionData.notes || apt.serviceNotes, additionalCosts: completionData.additionalCosts || 0, earnings: netEarnings, deductions: productDeductions }
          : apt
      );
      setBookings(updatedBookings);
    } else {
      const updatedAppointments = appointments.map(apt => 
        (apt.id === appointmentId || apt.backendId === appointmentId || apt.bookingId === appointmentId)
          ? { ...apt, status: 'completed', price: completionData.priceConfirmed ?? servicePrice, price_confirmed: completionData.priceConfirmed ?? servicePrice, planType: completionData.planType || apt.planType || apt.serviceType, serviceNotes: completionData.notes || apt.serviceNotes, additionalCosts: completionData.additionalCosts || 0, earnings: netEarnings, deductions: productDeductions }
          : apt
      );
      setAppointments(updatedAppointments);
    }
    
    // Update current user if it's the one logged in
    if (currentUser.id === appointment.piojologistId) {
      setCurrentUser(prev => ({ ...prev, earnings: (prev.earnings || 0) + netEarnings }));
    }

    // Recargar bookings desde el backend para actualizar en tiempo real
    await loadBookings();

    // Notificar al admin que se completó un servicio
    pushNotification({
      type: 'completed',
      appointmentId,
      appointment,
      message: `${appointment.clientName} - ${appointment.serviceType} fue completado por ${appointment.piojologistName || 'piojóloga'}`,
      forRole: 'admin'
    });

    return netEarnings;
  };

  // Derived list of piojologists for assignment logic
  const piojologists = users.filter(u => u.role === 'piojologist');

  // Get page title based on current user role
  const getPageTitle = () => {
    if (!currentUser) return "Chao Piojos | Login";
    
    switch(currentUser.role) {
      case 'admin':
        return "Chao Piojos | Administrador";
      case 'piojologist':
        return "Chao Piojos | Piojóloga";
      default:
        return "Chao Piojos";
    }
  };

  // Mostrar loading mientras se verifica la sesión
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-orange-50 font-fredoka flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="Chao Piojos" className="w-20 h-20 mx-auto mb-4 animate-spin" />
          <p className="text-xl font-bold text-orange-500">Cargando...</p>
        </div>
      </div>
    );
  }

  const bellRect = typeof document !== 'undefined'
    ? document.getElementById('notification-bell')?.getBoundingClientRect()
    : null;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  const isMobile = viewportWidth < 768;
  
  // Para móvil: usar coordenadas del viewport directamente (fixed positioning)
  // Para desktop: usar coordenadas del documento (absolute positioning)
  const dropdownStyle = isMobile
    ? {
        position: 'fixed',
        top: (bellRect?.bottom || 0) + 8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100vw - 32px)',
        maxWidth: '26rem',
        zIndex: 99999
      }
    : {
        position: 'absolute',
        top: (bellRect?.bottom || 0) + scrollY + 8,
        right: Math.max(16, viewportWidth - (bellRect?.right || viewportWidth)),
        width: '24rem',
        zIndex: 99999
      };

  return (
    <div className="min-h-screen bg-orange-50 font-fredoka overflow-x-hidden text-gray-800">
      <Helmet>
        <title>{getPageTitle()}</title>
        <meta name="description" content="El sistema más divertido para decir adiós a los piojitos." />
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <AnimatePresence mode="wait">
          {!currentUser ? (
            <motion.div
              key="login"
              exit={{ opacity: 0, scale: 0.9, rotate: -2 }}
              transition={{ duration: 0.4 }}
            >
              <Login onLogin={handleLogin} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0.4 }}
            >
              {/* Playful Header */}
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white/80 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border-4 border-orange-200 relative">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="bg-white p-2 rounded-2xl shadow-lg transform -rotate-3 hover:rotate-3 transition-transform border-2 border-orange-200">
                    <img src="/logo.png" alt="Chao Piojos" className="w-14 h-14 object-contain" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-black tracking-wide drop-shadow-sm">
                      <span className="text-orange-500">Chao</span>{' '}
                      <span className="text-blue-500">Piojos</span>
                    </h1>
                    <p className="text-lg text-gray-500 font-bold bg-orange-100 px-3 py-1 rounded-full inline-block mt-1">
                      Hola, {currentUser.name} 👋
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 relative z-50">
                  {/* Notification Bell */}
                  <div className="relative notification-container" id="notification-bell">
                    <Button
                      onClick={() => {
                        setShowNotifications(!showNotifications);
                        // Marcar todas como leídas al abrir
                        if (!showNotifications) {
                          markAllAsRead();
                        }
                      }}
                      className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-2xl px-5 py-6 font-bold text-lg shadow-md hover:shadow-lg transition-all border-b-4 border-yellow-600 hover:border-yellow-700 active:border-b-0 active:translate-y-1 relative"
                    >
                      <Bell className="w-6 h-6" />
                      {getFilteredNotifications().filter(n => !n.read).length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center animate-pulse">
                          {getFilteredNotifications().filter(n => !n.read).length}
                        </span>
                      )}
                    </Button>

                  </div>

                  <Button 
                    onClick={handleLogout}
                    className="bg-red-400 hover:bg-red-500 text-white rounded-2xl px-6 py-6 font-bold text-lg shadow-md hover:shadow-lg transition-all border-b-4 border-red-600 hover:border-red-700 active:border-b-0 active:translate-y-1"
                  >
                    <LogOut className="w-6 h-6 mr-2" />
                    Salir
                  </Button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="bg-white/60 backdrop-blur-sm rounded-[2.5rem] p-4 md:p-8 shadow-2xl border-4 border-white relative z-0">
                {currentUser.role === 'piojologist' && (
                  <PiojologistView 
                    currentUser={currentUser}
                    appointments={allAppointments}
                    updateAppointments={updateAppointments}
                    bookings={bookings}
                    updateBookings={updateBookingsState}
                    products={products}
                    handleCompleteService={handleCompleteService}
                    serviceCatalog={serviceCatalog}
                    formatCurrency={formatCurrency}
                    productRequests={productRequests}
                    onCreateProductRequest={handleCreateProductRequest}
                    onNotify={handleNotify}
                  />
                )}

                {currentUser.role === 'admin' && (
                  <AdminView 
                    users={users}
                    handleCreateUser={handleCreateUser}
                    handleUpdateUser={handleUpdateUser}
                    handleDeleteUser={handleDeleteUser}
                    appointments={allAppointments}
                    baseAppointments={appointments}
                    bookings={bookings}
                    updateAppointments={updateAppointments}
                    updateBookings={updateBookingsState}
                    reloadBookings={loadBookings}
                    piojologists={piojologists}
                    products={products}
                    updateProducts={updateProducts}
                    services={services}
                    onCreateService={handleCreateService}
                    onUpdateService={handleUpdateService}
                    onDeleteService={handleDeleteService}
                    serviceCatalog={serviceCatalog}
                    formatCurrency={formatCurrency}
                    syncICalEvents={() => {}}
                    productRequests={productRequests}
                    onApproveRequest={handleApproveProductRequest}
                    onRejectRequest={handleRejectProductRequest}
                    onNotify={handleNotify}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Background Blobs */}
      <div className="fixed top-20 -left-10 w-48 h-48 bg-yellow-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-20 -right-10 w-64 h-64 bg-orange-300 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-pulse pointer-events-none delay-1000"></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-lime-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none"></div>

      {/* Notification Dropdown - Rendered at root level */}
      {showNotifications && currentUser && (
        <div 
          className="bg-white rounded-2xl shadow-2xl border-4 border-yellow-200 max-h-[500px] overflow-hidden flex flex-col notification-container w-full md:w-96"
          style={dropdownStyle}
        >
          <div className="bg-yellow-100 px-4 py-3 border-b-2 border-yellow-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">🔔 Notificaciones</h3>
            <div className="flex gap-2">
              {getFilteredNotifications().length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg hover:bg-blue-600 font-bold"
                  >
                    Marcar todas
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 font-bold"
                  >
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {getFilteredNotifications().length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-bold">No hay notificaciones</p>
              </div>
            ) : (
              getFilteredNotifications().map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-gray-100 hover:bg-yellow-50 transition-colors cursor-pointer ${
                    !notif.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => {
                    markAsRead(notif.id);
                    setSelectedNotification(notif);
                    setShowNotifications(false);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      !notif.read ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                    }`}></div>
                    <div className="flex-1">
                      <p className={`text-sm ${
                        !notif.read ? 'font-bold text-gray-800' : 'text-gray-600'
                      }`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notif.timestamp).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      <Dialog open={Boolean(selectedNotification)} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="rounded-[2rem] border-8 border-yellow-100 overflow-hidden w-[95vw] max-w-xl p-4 sm:p-6 md:p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <span className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                🔔 Detalle de notificación
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-3 sm:p-4">
              <p className="text-xs font-black text-yellow-700 uppercase mb-1">Mensaje</p>
              <p className="text-gray-800 font-bold text-sm sm:text-base">{selectedNotification?.message}</p>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-2">
                {selectedNotification?.timestamp ? new Date(selectedNotification.timestamp).toLocaleString('es-ES', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                }) : ''}
              </p>
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1">Tipo: <span className="font-bold uppercase">{selectedNotification?.type}</span></p>
            </div>

            {selectedNotification?.appointment && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm font-semibold text-gray-700">
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                  🧑‍🤝‍🧑 Cliente<br />
                  <span className="font-bold text-gray-900">{selectedNotification.appointment.clientName || 'N/A'}</span>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                  🧴 Servicio<br />
                  <span className="font-bold text-gray-900">{selectedNotification.appointment.serviceType || 'N/A'}</span>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                  📅 Fecha<br />
                  <span className="font-bold text-gray-900">{selectedNotification.appointment.date || 'N/A'} {selectedNotification.appointment.time ? `- ${selectedNotification.appointment.time}` : ''}</span>
                </div>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                  👩‍⚕️ Piojóloga<br />
                  <span className="font-bold text-gray-900">{selectedNotification.appointment.piojologistName || 'Sin asignar'}</span>
                </div>
                <div className="sm:col-span-2 bg-gray-50 border-2 border-gray-200 rounded-xl p-3">
                  🏷️ Estado<br />
                  <span className="font-bold text-gray-900">{selectedNotification.statusLabel || statusLabel(selectedNotification.appointment.status) || 'N/A'}</span>
                </div>
              </div>
            )}

            {selectedNotification?.rejection_history?.length > 0 && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-xs sm:text-sm font-semibold text-red-700">
                ⚠️ Rechazos: {selectedNotification.rejection_history.join(', ')}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setSelectedNotification(null)}
                className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-2xl px-6 py-3 font-bold shadow-md border-b-4 border-yellow-600 w-full sm:w-auto text-sm sm:text-base"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

export default App;
