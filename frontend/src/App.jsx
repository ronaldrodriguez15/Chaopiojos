import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import PiojologistView from '@/components/PiojologistView';
import AdminView from '@/components/AdminView';
import Login from '@/components/Login';
import { LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchICalEvents, convertICalEventsToAppointments } from '@/lib/icalService';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Default users for the demo
  const defaultUsers = [
    { id: 1, name: 'Admin Jefe', email: 'admin@chaopiojos.com', password: '123', role: 'admin', address: 'Cra 7 #45-90, Bogotá' },
    { id: 2, name: 'Dr. María González', email: 'maria@chaopiojos.com', password: '123', role: 'piojologist', specialty: 'Experta en Rastreo', available: true, earnings: 0, address: 'Cra 11 #92-34, Bogotá', lat: 4.7110, lng: -74.0141 },
    { id: 3, name: 'Dr. Carlos Ramírez', email: 'carlos@chaopiojos.com', password: '123', role: 'piojologist', specialty: 'Cazador de Liendres', available: true, earnings: 0, address: 'Av Calle 26 #78-15, Bogotá', lat: 4.7069, lng: -74.0813 }
  ];

  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('users');
    return saved ? JSON.parse(saved) : defaultUsers;
  });

  const [appointments, setAppointments] = useState(() => {
    const saved = localStorage.getItem('appointments');
    return saved ? JSON.parse(saved) : [];
  });

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('products');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Spray Anti-Piojos', price: 15000, stock: 50, image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=200' },
      { id: 2, name: 'Peine Metálico Fino', price: 25000, stock: 30, image: 'https://images.unsplash.com/photo-1596462502278-27bfdd403cc2?auto=format&fit=crop&q=80&w=200' },
      { id: 3, name: 'Champú Repelente', price: 20000, stock: 40, image: 'https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?auto=format&fit=crop&q=80&w=200' }
    ];
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

  // Sync data with localStorage
  useEffect(() => {
    localStorage.setItem('users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('products', JSON.stringify(products));
  }, [products]);

  const updateAppointments = (newAppointments) => {
    setAppointments(newAppointments);
  };

  const updateProducts = (newProducts) => {
    setProducts(newProducts);
  };

  // URL del feed iCal externo
  const ICAL_URL = 'https://chaopiojos.com/?booked_ical&sh=f337b19223cc15bded974b91f266043c';

  // Función para sincronizar iCal (manual y automática)
  const syncICalEvents = async () => {
    try {
      console.log('🌐 Sincronizando eventos iCal...');
      const icalEvents = await fetchICalEvents(ICAL_URL);
      console.log('📥 Eventos iCal recibidos:', icalEvents.length);
      
      const convertedAppointments = convertICalEventsToAppointments(icalEvents);
      console.log('🔄 Eventos convertidos:', convertedAppointments.length);
      
      if (convertedAppointments.length > 0) {
        console.log('✅ Agregando eventos al calendario');
        setAppointments(prevAppointments => {
          const localAppointments = prevAppointments.filter(a => !a.isExternal);
          const combined = [...localAppointments, ...convertedAppointments];
          
          const uniqueMap = new Map();
          combined.forEach(app => {
            if (!uniqueMap.has(app.id)) {
              uniqueMap.set(app.id, app);
            }
          });
          
          const result = Array.from(uniqueMap.values());
          console.log('📊 Total citas en calendario:', result.length);
          return result;
        });
        return { success: true, count: convertedAppointments.length };
      } else {
        console.warn('⚠️ No hay eventos nuevos');
        return { success: true, count: 0 };
      }
    } catch (error) {
      console.error('❌ Error sincronizando iCal:', error);
      return { success: false, error: error.message };
    }
  };

  // Auto-sync cada 5 minutos
  useEffect(() => {
    syncICalEvents();
    const interval = setInterval(syncICalEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (email, password) => {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      setCurrentUser(user);
      return { success: true };
    }
    return { success: false, message: '¡Ups! Correo o contraseña incorrectos 🙈' };
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleCreateUser = (newUser) => {
    setUsers([...users, { ...newUser, id: Date.now(), earnings: 0 }]);
  };

  const handleUpdateUser = (updatedUser) => {
    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
  };

  const handleDeleteUser = (userId) => {
    setUsers(users.filter(u => u.id !== userId));
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

  return (
    <div className="min-h-screen bg-orange-50 font-fredoka overflow-x-hidden text-gray-800">
      <Helmet>
        <title>{getPageTitle()}</title>
        <meta name="description" content="El sistema más divertido para decir adiós a los piojitos." />
      </Helmet>

      <div className="container mx-auto px-4 py-6 max-w-7xl relative z-10">
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
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white/80 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border-4 border-orange-200 transform hover:scale-[1.01] transition-transform">
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
                
                <Button 
                  onClick={handleLogout}
                  className="bg-red-400 hover:bg-red-500 text-white rounded-2xl px-6 py-6 font-bold text-lg shadow-md hover:shadow-lg transition-all border-b-4 border-red-600 hover:border-red-700 active:border-b-0 active:translate-y-1"
                >
                  <LogOut className="w-6 h-6 mr-2" />
                  Salir
                </Button>
              </div>

              {/* Main Content Area */}
              <div className="bg-white/60 backdrop-blur-sm rounded-[2.5rem] p-4 md:p-8 shadow-2xl border-4 border-white">
                {currentUser.role === 'piojologist' && (
                  <PiojologistView 
                    currentUser={currentUser}
                    appointments={appointments}
                    updateAppointments={updateAppointments}
                    products={products}
                    handleCompleteService={handleCompleteService}
                    formatCurrency={formatCurrency}
                  />
                )}

                {currentUser.role === 'admin' && (
                  <AdminView 
                    users={users}
                    handleCreateUser={handleCreateUser}
                    handleUpdateUser={handleUpdateUser}
                    handleDeleteUser={handleDeleteUser}
                    appointments={appointments}
                    updateAppointments={updateAppointments}
                    piojologists={piojologists}
                    products={products}
                    updateProducts={updateProducts}
                    serviceCatalog={serviceCatalog}
                    formatCurrency={formatCurrency}
                    syncICalEvents={syncICalEvents}
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

      <Toaster />
    </div>
  );
}

export default App;