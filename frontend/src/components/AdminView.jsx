import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, UserPlus, Calendar, User, CheckCircle, PieChart, Crown, Users, Trash2, Edit, Save, X, ShoppingBag, DollarSign, PackagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const AdminView = ({ users, handleCreateUser, handleUpdateUser, handleDeleteUser, appointments, updateAppointments, piojologists, products, updateProducts, serviceCatalog }) => {
  const { toast } = useToast();
  
  // User Management State
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client',
    specialty: '',
    available: true
  });

  // Product Management State
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
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
      role: 'client',
      specialty: '',
      available: true
    });
    setEditingUser(null);
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

  const handleUserSubmit = (e) => {
    e.preventDefault();
    if (editingUser) {
      handleUpdateUser({ ...userFormData, id: editingUser.id });
      toast({ title: "¡Usuario Actualizado! 🎉", className: "bg-green-100 text-green-800 rounded-2xl border-2 border-green-200" });
    } else {
      handleCreateUser(userFormData);
      toast({ title: "¡Nuevo Amigo Añadido! 🎈", className: "bg-blue-100 text-blue-800 rounded-2xl border-2 border-blue-200" });
    }
    setIsUserDialogOpen(false);
    resetUserForm();
  };

  // Product Logic
  const handleProductSubmit = (e) => {
    e.preventDefault();
    const newProduct = {
      id: Date.now(),
      name: productFormData.name,
      price: parseFloat(productFormData.price),
      stock: parseInt(productFormData.stock),
      image: productFormData.image || 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=200'
    };
    updateProducts([...products, newProduct]);
    setIsProductDialogOpen(false);
    setProductFormData({ name: '', price: '', stock: '', image: '' });
    toast({ title: "¡Producto en Estantería! 🛍️", className: "bg-pink-100 text-pink-800 rounded-2xl border-2 border-pink-200" });
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
          <TabsTrigger value="products" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-pink-400 data-[state=active]:text-white transition-all">
            🛍️ Productos
          </TabsTrigger>
          <TabsTrigger value="earnings" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-green-400 data-[state=active]:text-white transition-all">
            💰 Ganancias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Citas', val: appointments.length, color: 'bg-blue-100 text-blue-600', icon: PieChart },
              { label: 'Pendientes', val: appointments.filter(a => a.status === 'pending').length, color: 'bg-yellow-100 text-yellow-600', icon: Calendar },
              { label: 'Héroes', val: piojologists.length, color: 'bg-green-100 text-green-600', icon: Users },
              { label: 'Ingresos Totales', val: `$${appointments.filter(a => a.status === 'completed').reduce((acc, curr) => acc + (curr.price || 0), 0)}`, color: 'bg-purple-100 text-purple-600', icon: DollarSign },
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

          {/* Assignments Panel */}
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-yellow-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 rounded-bl-full opacity-50 -mr-4 -mt-4"></div>
             
             <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3 relative z-10">
               <span className="text-3xl">🧙‍♂️</span> Asignar Misiones
             </h3>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                {unassignedAppointments.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-yellow-50 rounded-[2rem] border-2 border-dashed border-yellow-300">
                    <p className="text-xl font-bold text-yellow-600">¡Todo tranquilo por aquí! 🌟</p>
                  </div>
                ) : (
                  unassignedAppointments.map(apt => (
                    <div key={apt.id} className="bg-white border-2 border-gray-100 p-5 rounded-3xl shadow-md hover:border-yellow-300 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <span className="font-bold text-lg truncate">{apt.clientName}</span>
                        <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded-full">Pendiente</span>
                      </div>
                      <p className="text-sm text-gray-500 mb-4 font-medium flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> {apt.date} at {apt.time}
                      </p>
                      
                      <select 
                        className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-xl font-bold text-sm outline-none focus:border-yellow-400 cursor-pointer"
                        onChange={(e) => handleAssignPiojologist(apt.id, e.target.value)}
                        defaultValue=""
                      >
                        <option value="" disabled>Elegir Héroe...</option>
                        {piojologists.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
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
                <span className="text-3xl">👪</span> La Familia ChaoPiojos
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
                <div key={product.id} className="bg-white border-4 border-pink-100 rounded-[2rem] p-4 flex flex-col gap-4 shadow-sm hover:border-pink-300 transition-colors">
                  <div className="w-full h-32 bg-gray-100 rounded-2xl overflow-hidden relative">
                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" src="https://images.unsplash.com/photo-1635865165118-917ed9e20936" />
                    <div className="absolute top-2 right-2 bg-white px-2 py-1 rounded-lg text-xs font-black shadow-sm">
                      Stock: {product.stock}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-gray-800">{product.name}</h4>
                    <p className="text-pink-500 font-bold text-xl">${product.price}</p>
                  </div>
                  <Button 
                    onClick={() => handleDeleteProduct(product.id)}
                    variant="ghost" 
                    className="mt-auto bg-red-50 text-red-500 hover:bg-red-100 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                  </Button>
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
                         <td className="p-4 text-right font-medium text-blue-600">${grossEarnings.toFixed(2)}</td>
                         <td className="p-4 text-right font-medium text-red-500">-${totalDeductions.toFixed(2)}</td>
                         <td className="p-4 text-right">
                           <span className="bg-green-100 text-green-700 px-3 py-1 rounded-xl font-black">
                             ${netPayable.toFixed(2)}
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
      </Tabs>

      {/* User Dialog Modal */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-8 border-blue-100 p-0 overflow-hidden sm:max-w-md bg-white">
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                 <Label className="font-bold text-gray-500 ml-2 mb-1 block">Rol</Label>
                 <select 
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-blue-400 cursor-pointer appearance-none"
                    value={userFormData.role}
                    onChange={e => setUserFormData({...userFormData, role: e.target.value})}
                 >
                   <option value="client">👶 Cliente</option>
                   <option value="piojologist">🦸 Piojólogo</option>
                   <option value="admin">👑 Admin</option>
                 </select>
              </div>
               <div>
                <Label className="font-bold text-gray-500 ml-2 mb-1 block">Password</Label>
                <input 
                  required
                  type="text"
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                  value={userFormData.password}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                  placeholder="***"
                />
              </div>
            </div>

            <div>
              <Label className="font-bold text-gray-500 ml-2 mb-1 block">Email</Label>
              <input 
                required
                type="email"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-bold outline-none focus:border-blue-400 focus:bg-white transition-all"
                value={userFormData.email}
                onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                placeholder="correo@ejemplo.com"
              />
            </div>

            {userFormData.role === 'piojologist' && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                <Label className="font-bold text-gray-500 ml-2 mb-1 block">Especialidad (Súper Poder)</Label>
                <input 
                  className="w-full bg-green-50 border-2 border-green-200 rounded-2xl p-4 font-bold text-green-700 outline-none focus:border-green-400 focus:bg-white transition-all placeholder-green-300"
                  value={userFormData.specialty || ''}
                  onChange={e => setUserFormData({...userFormData, specialty: e.target.value})}
                  placeholder="Ej. Visión de Rayos X"
                />
              </motion.div>
            )}

            <div className="pt-4 flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsUserDialogOpen(false)}
                className="flex-1 rounded-2xl py-6 font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 transition-all"
              >
                {editingUser ? 'Guardar Cambios' : '¡Crear!'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminView;