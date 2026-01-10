import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Calendar, User, Check, X, Clock, Zap, Star, DollarSign, ShoppingBag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import ScheduleCalendar from '@/components/ScheduleCalendar';

const PiojologistView = ({ currentUser, appointments, updateAppointments, products, handleCompleteService, formatCurrency }) => {
  const { toast } = useToast();
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [finishingAppointmentId, setFinishingAppointmentId] = useState(null);

  const handleAccept = (appointmentId) => {
    const updatedAppointments = appointments.map(apt => 
      apt.id === appointmentId ? { ...apt, status: 'confirmed' } : apt
    );
    updateAppointments(updatedAppointments);
    
    toast({
      title: "¡Misión Aceptada! ⭐",
      description: "¡A cazar piojitos!",
      className: "bg-green-100 border-2 border-green-200 text-green-700 rounded-2xl font-bold"
    });
  };

  const handleReject = (appointmentId) => {
    const updatedAppointments = appointments.map(apt => 
      apt.id === appointmentId ? { ...apt, status: 'cancelled' } : apt
    );
    updateAppointments(updatedAppointments);
    toast({ title: "Misión rechazada 🙅", className: "bg-red-100 rounded-2xl" });
  };

  const handleProductToggle = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  const onCompleteService = () => {
    if (!finishingAppointmentId) return;

    handleCompleteService(finishingAppointmentId, selectedProducts);
    
    setFinishingAppointmentId(null);
    setSelectedProducts([]);
    toast({
      title: "¡Victoria Total! 🏆",
      description: "Servicio completado y ganancias registradas.",
      className: "bg-yellow-100 border-2 border-yellow-200 text-yellow-800 rounded-2xl font-bold"
    });
  };

  const assignedToMe = appointments.filter(apt => apt.piojologistId === currentUser.id && apt.status === 'confirmed');
  const myCalendarAppointments = appointments.filter(apt => apt.piojologistId === currentUser.id && apt.status !== 'cancelled');
  const completedHistory = appointments.filter(apt => apt.piojologistId === currentUser.id && apt.status === 'completed');

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
              <span className="block text-4xl font-black">{formatCurrency(currentUser.earnings || 0)}</span>
              <span className="text-sm font-bold opacity-90">Mis Ganancias</span>
            </div>
            <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md text-center min-w-[150px]">
              <span className="block text-4xl font-black">{assignedToMe.length}</span>
              <span className="text-sm font-bold opacity-90">Servicios Asignados</span>
            </div>
           </div>
         </div>
      </motion.div>

      <Tabs defaultValue="agenda" className="w-full">
        <TabsList className="w-full bg-white/50 p-2 rounded-[2rem] border-2 border-green-100 mb-8 flex-wrap h-auto gap-2">
          <TabsTrigger value="agenda" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-green-400 data-[state=active]:text-white transition-all">
            📅 Mis Servicios ({assignedToMe.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 min-w-[150px] rounded-3xl py-3 font-bold text-lg data-[state=active]:bg-blue-400 data-[state=active]:text-white transition-all">
            📜 Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda">
          <div className="mb-8">
            <ScheduleCalendar
              appointments={myCalendarAppointments}
              piojologists={[currentUser]}
              title="Mi Agenda"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignedToMe.length === 0 ? (
               <div className="col-span-full py-20 text-center bg-white/60 rounded-[3rem] border-4 border-dashed border-green-200">
                <Calendar className="w-24 h-24 mx-auto mb-4 text-green-200" />
                <p className="text-2xl font-black text-gray-400">No hay servicios asignados todavía.</p>
              </div>
            ) : (
              assignedToMe.map(apt => (
                <div key={apt.id} className="bg-white rounded-[2rem] p-6 shadow-lg border-4 border-green-200 relative overflow-hidden flex flex-col">
                   <div className="absolute top-0 right-0 bg-green-400 text-white px-4 py-1 rounded-bl-2xl font-black text-xs uppercase tracking-wider">
                     Confirmado
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

                   <div className="bg-green-50 p-4 rounded-2xl space-y-2 mb-4">
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

                   <div className="mt-auto">
                     <Dialog>
                       <DialogTrigger asChild>
                         <Button 
                           onClick={() => {
                             setFinishingAppointmentId(apt.id);
                             setSelectedProducts([]);
                           }}
                           className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-2xl py-6 font-bold shadow-md border-b-4 border-blue-700 active:border-b-0 active:translate-y-1"
                         >
                           <Check className="mr-2" /> Completar Servicio
                         </Button>
                       </DialogTrigger>
                       <DialogContent className="rounded-[2.5rem] border-8 border-blue-100 p-0 overflow-hidden sm:max-w-md bg-white">
                        <div className="bg-blue-400 p-6 text-white text-center">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Reporte de Misión 📋</DialogTitle>
                          </DialogHeader>
                        </div>
                        <div className="p-6">
                          <p className="mb-4 font-bold text-gray-600">¿Usaste algún producto mágico?</p>
                          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                            {products.length === 0 ? (
                              <p className="text-gray-400 text-sm italic">No hay productos en inventario.</p>
                            ) : (
                              products.map(product => (
                                <div key={product.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                  <Checkbox 
                                    id={`prod-${product.id}`}
                                    checked={selectedProducts.includes(product.id)}
                                    onCheckedChange={() => handleProductToggle(product.id)}
                                  />
                                  <Label htmlFor={`prod-${product.id}`} className="flex-grow font-bold text-gray-700 cursor-pointer">
                                    {product.name}
                                  </Label>
                                  <span className="text-xs font-black bg-pink-100 text-pink-600 px-2 py-1 rounded-md">
                                    -{formatCurrency(product.price)}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="mt-6 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                            <p className="text-xs text-yellow-800 font-bold text-center">
                              ⚠️ Los costos de los productos seleccionados se deducirán de tu ganancia del servicio.
                            </p>
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
                    </div>
                    <div className="text-right">
                      <p className="text-green-600 font-black text-lg">+{formatCurrency(apt.earnings || 0)}</p>
                      {apt.deductions > 0 && (
                        <p className="text-xs text-red-400 font-bold">-{formatCurrency(apt.deductions)} en productos</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PiojologistView;