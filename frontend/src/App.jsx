import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import PiojologistView from '@/components/PiojologistView';
import AdminView from '@/components/AdminView';
import Login from '@/components/Login';
import { LogOut, Sparkles, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { authService, userService } from '@/lib/api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Notification system
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastAppointmentCount, setLastAppointmentCount] = useState(0);

  // Verificar sesión al cargar la aplicación
  useEffect(() => {
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

  // Services with prices definition
  const serviceCatalog = {
    'Normal': 70000,
    'Elevado': 100000,
    'Muy Alto': 120000
  };

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
      const response = await fetch('http://localhost:8000/api/bookings', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
          const data = await response.json();
          // Transformar bookings al formato de appointments para compatibilidad
          const transformedBookings = data.map(booking => {
            // Extraer solo la fecha del formato ISO (YYYY-MM-DD)
            const fechaISO = booking.fecha.split('T')[0];

            // Normalizar estado desde backend (es/en) -> frontend (en)
            const statusMap = {
              pendiente: 'pending',
              aceptado: 'accepted',
              rechazado: 'rejected',
              completado: 'completed',
              asignado: 'assigned',
              confirmado: 'assigned',
              cancelado: 'rejected',
              assigned: 'assigned',
              accepted: 'accepted',
              rejected: 'rejected',
              completed: 'completed'
            };
            const estadoLower = (booking.estado || '').toLowerCase();
            const normalizedStatus = statusMap[estadoLower] || 'pending';

            const transformed = {
              id: `booking-${booking.id}`,
              backendId: booking.id,
              clientName: booking.clientName,
              serviceType: booking.serviceType,
              date: fechaISO,
              time: booking.hora,
              whatsapp: booking.whatsapp,
              email: booking.email,
              direccion: booking.direccion,
              barrio: booking.barrio,
              numPersonas: booking.numPersonas,
              hasAlergias: booking.hasAlergias,
              detalleAlergias: booking.detalleAlergias,
              referidoPor: booking.referidoPor,
              status: normalizedStatus,
              piojologistId: booking.piojologist_id || null,
              isPublicBooking: true
            };

            return transformed;
          });

          setBookings(transformedBookings);
        }
    } catch (error) {
      console.error('❌ Error al cargar bookings:', error);
    }
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
      // Administrador: todos los agendamientos nuevos
      relevantAppointments = allAppointments;
    } else if (currentUser.role === 'piojologist') {
      // Piojóloga: solo los asignados a ella
      relevantAppointments = allAppointments.filter(apt => apt.piojologistId === currentUser.id);
    }

    // Detectar si hay nuevos agendamientos
    if (lastAppointmentCount > 0 && relevantAppointments.length > lastAppointmentCount) {
      const newCount = relevantAppointments.length - lastAppointmentCount;
      const newAppointments = relevantAppointments.slice(-newCount);
      
      // Crear notificaciones para los nuevos agendamientos
      const newNotifications = newAppointments.map(apt => ({
        id: `notif-${apt.id}-${Date.now()}`,
        type: 'appointment',
        appointmentId: apt.id,
        message: currentUser.role === 'admin' 
          ? `Nuevo agendamiento: ${apt.clientName} - ${apt.serviceType}`
          : `Te asignaron: ${apt.clientName} - ${apt.serviceType}`,
        timestamp: new Date(),
        read: false,
        appointment: apt
      }));

      setNotifications(prev => [...newNotifications, ...prev]);
    }

    setLastAppointmentCount(relevantAppointments.length);
  }, [allAppointments, currentUser, lastAppointmentCount]);

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
  };

  // Filtrar notificaciones según el usuario actual
  const getFilteredNotifications = () => {
    if (!currentUser) return [];
    
    return notifications.filter(notif => {
      // Notificaciones de agendamientos (todos las ven según su rol)
      if (notif.type === 'appointment') return true;
      
      // Notificaciones de asignación (solo piojólogas)
      if (notif.type === 'assignment') {
        return currentUser.role === 'piojologist' && notif.piojologistId === currentUser.id;
      }
      
      // Notificaciones de aceptación/rechazo (solo admins)
      if (notif.type === 'accepted' || notif.type === 'rejected') {
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
      
      return true;
    });
  };

  // Handler para crear notificaciones desde componentes hijos
  const handleNotify = (notificationData) => {
    const newNotification = {
      id: `notif-${notificationData.appointmentId || Date.now()}-${Date.now()}`,
      type: notificationData.type,
      appointmentId: notificationData.appointmentId,
      message: notificationData.message,
      timestamp: new Date(),
      read: false,
      appointment: notificationData.appointment,
      piojologistId: notificationData.piojologistId,
      piojologistName: notificationData.piojologistName
    };
    setNotifications(prev => [newNotification, ...prev]);
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

  const updateAppointments = (newAppointments) => {
    setAppointments(newAppointments);
  };

  const updateBookingsState = (newBookings) => {
    setBookings(newBookings);
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
    const newRequest = {
      id: Date.now(),
      piojologistId: currentUser.id,
      piojologistName: currentUser.name,
      items: requestData.items, // Array de {productId, productName, quantity} o {isKitCompleto: true}
      isKitCompleto: requestData.isKitCompleto || false,
      status: 'pending', // pending, approved, rejected
      requestDate: new Date().toISOString(),
      resolvedBy: null,
      resolvedByName: null,
      resolvedDate: null,
      notes: requestData.notes || ''
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

  // Handle earnings logic: Add 50% of service price to piojologist earnings
  const handleCompleteService = (appointmentId, productsUsedIds = []) => {
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment || !appointment.piojologistId) return;

    const servicePrice = serviceCatalog[appointment.serviceType] || 0;
    const piojologistShare = servicePrice * 0.5; // 50%

    // Calculate deductions from used products
    let productDeductions = 0;
    productsUsedIds.forEach(prodId => {
      const product = products.find(p => p.id === parseInt(prodId));
      if (product) productDeductions += product.price;
    });

    const netEarnings = piojologistShare - productDeductions;

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

    // Update Appointment Status
    const updatedAppointments = appointments.map(apt => 
      apt.id === appointmentId 
        ? { ...apt, status: 'completed', price: servicePrice, earnings: netEarnings, deductions: productDeductions } 
        : apt
    );
    setAppointments(updatedAppointments);
    
    // Update current user if it's the one logged in
    if (currentUser.id === appointment.piojologistId) {
      setCurrentUser(prev => ({ ...prev, earnings: (prev.earnings || 0) + netEarnings }));
    }

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
          <div className="animate-spin text-6xl mb-4">🦁</div>
          <p className="text-xl font-bold text-orange-500">Cargando...</p>
        </div>
      </div>
    );
  }

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
                  <div className="bg-gradient-to-tr from-orange-400 to-yellow-400 p-4 rounded-2xl shadow-lg transform -rotate-3 hover:rotate-3 transition-transform">
                    <Sparkles className="w-8 h-8 text-white animate-pulse" />
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
                      onClick={() => setShowNotifications(!showNotifications)}
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
                    piojologists={piojologists}
                    products={products}
                    updateProducts={updateProducts}
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
          className="fixed w-96 bg-white rounded-2xl shadow-2xl border-4 border-yellow-200 max-h-[500px] overflow-hidden flex flex-col notification-container"
          style={{
            top: document.getElementById('notification-bell')?.getBoundingClientRect().bottom + 8 + 'px',
            right: window.innerWidth - (document.getElementById('notification-bell')?.getBoundingClientRect().right || 0) + 'px',
            zIndex: 99999
          }}
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
                  onClick={() => markAsRead(notif.id)}
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

      <Toaster />
    </div>
  );
}

export default App;