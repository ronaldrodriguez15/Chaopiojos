import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, Sparkles, CheckCircle, Smile, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const ClientView = ({ currentUser, appointments, updateAppointments, serviceCatalog }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    clientName: currentUser?.name || '',
    date: '',
    time: '',
    serviceType: '',
    notes: '',
    paymentMethod: 'later'
  });

  const getBoldLink = (serviceType = '') => {
    const lower = serviceType.toLowerCase();
    if (lower.includes('muy alto')) return 'https://checkout.bold.co/payment/LNK_GXTCYS2BEN';
    if (lower.includes('elev')) return 'https://checkout.bold.co/payment/LNK_Y2J2USYK3U';
    return 'https://checkout.bold.co/payment/LNK_89Z6PUUSRS';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.clientName || !formData.date || !formData.time || !formData.serviceType) {
      toast({
        title: "¡Ups! Faltan cositas 🙈",
        description: "Llena todos los espacios para poder ayudarte.",
        variant: "destructive",
        className: "bg-red-100 border-2 border-red-200 text-red-600 rounded-2xl font-bold"
      });
      return;
    }

    const newAppointment = {
      id: Date.now(),
      ...formData,
      status: 'pending',
      piojologistId: null,
      piojologistName: null,
      createdAt: new Date().toISOString()
    };

    updateAppointments([...appointments, newAppointment]);

    toast({
      title: "¡Yuju! Misión Enviada 🚀",
      description: "Pronto un héroe confirmará tu cita.",
      className: "bg-green-100 border-2 border-green-200 text-green-700 rounded-2xl font-bold"
    });

    setFormData({
      clientName: currentUser?.name || '',
      date: '',
      time: '',
      serviceType: '',
      notes: '',
      paymentMethod: 'later'
    });
  };

  const myAppointments = appointments.filter(apt => 
    apt.clientName.toLowerCase().includes(currentUser?.name.toLowerCase().split(' ')[0].toLowerCase()) || 
    apt.clientName === formData.clientName
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", bounce: 0.5 }}
      >
        <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border-4 border-blue-200 relative overflow-hidden h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-bl-[4rem] opacity-60 -mr-6 -mt-6"></div>
          
          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="p-4 bg-blue-400 rounded-2xl text-white shadow-lg transform -rotate-6">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800">Pedir Ayuda</h2>
              <p className="text-blue-400 font-bold">¡Vamos a limpiar esas cabecitas!</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="bg-blue-50 p-6 rounded-[2rem] space-y-4 border-2 border-blue-100">
              <div>
                <Label htmlFor="clientName" className="text-blue-800 font-black text-lg mb-2 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  ¿Quién es el valiente?
                </Label>
                <input
                  id="clientName"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleInputChange}
                  className="w-full px-5 py-4 rounded-xl border-2 border-blue-200 focus:border-blue-400 outline-none bg-white text-gray-700 font-bold shadow-sm"
                  placeholder="Tu nombre aquí"
                />
              </div>

              <div className="form-grid">
                <div>
                  <Label className="text-blue-800 font-black text-lg mb-2 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    ¿Cuándo?
                  </Label>
                  <input
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="form-input px-4 rounded-xl border-blue-200 focus:border-blue-400 bg-white text-gray-700 shadow-sm"
                  />
                </div>
                <div>
                  <Label className="text-blue-800 font-black text-lg mb-2 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    ¿Hora?
                  </Label>
                  <input
                    name="time"
                    type="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    className="form-input px-4 rounded-xl border-blue-200 focus:border-blue-400 bg-white text-gray-700 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-blue-800 font-black text-lg mb-2 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Misión Especial
                </Label>
                <select
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleInputChange}
                  className="form-select px-5 rounded-xl border-blue-200 focus:border-blue-400 bg-white text-gray-700 shadow-sm"
                >
                  <option value="">Elige tu súper poder...</option>
                  {Object.keys(serviceCatalog).map((s, i) => <option key={i} value={s}>{s} (${serviceCatalog[s]})</option>)}
                </select>
              </div>

              <div className="bg-white border-2 border-blue-100 rounded-2xl p-4 space-y-3">
                <Label className="text-blue-800 font-black text-lg flex items-center gap-2">
                  💳 Método de pago
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'now' }))}
                    className={`w-full px-4 py-3 rounded-xl font-black border-2 transition-all shadow-sm ${
                      formData.paymentMethod === 'now'
                        ? 'bg-green-100 border-green-300 text-green-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-green-200'
                    }`}
                  >
                    Pagar ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'later' }))}
                    className={`w-full px-4 py-3 rounded-xl font-black border-2 transition-all shadow-sm ${
                      formData.paymentMethod === 'later'
                        ? 'bg-orange-100 border-orange-300 text-orange-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-orange-200'
                    }`}
                  >
                    Pagar después
                  </button>
                </div>

                {formData.paymentMethod === 'now' && (
                  <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-3 space-y-2">
                    <p className="text-sm font-bold text-blue-700">Completa el pago seguro con Bold y asegura tu turno.</p>
                    <Button
                      type="button"
                      disabled={!formData.serviceType}
                      onClick={() => {
                        const link = getBoldLink(formData.serviceType);
                        window.open(link, '_blank');
                      }}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black rounded-xl py-4 shadow-md disabled:opacity-60"
                    >
                      Ir a Bold 🚀
                    </Button>
                    {!formData.serviceType && (
                      <p className="text-xs text-blue-600 font-semibold">Elige primero el plan para habilitar el pago.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black text-xl py-8 rounded-2xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 border-b-8 border-blue-700 active:border-b-0 active:translate-y-2"
            >
              🚀 ¡Activar Misión!
            </Button>
          </form>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
      >
        <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border-4 border-green-200 h-full relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-green-100 rounded-bl-[4rem] opacity-60 -mr-6 -mt-6"></div>

          <div className="flex items-center gap-4 mb-8 relative z-10">
            <div className="p-4 bg-green-400 rounded-2xl text-white shadow-lg transform rotate-6">
              <Smile className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-gray-800">Mis Misiones</h2>
              <p className="text-green-500 font-bold">Historial de aventuras</p>
            </div>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar relative z-10">
            {myAppointments.length === 0 ? (
              <div className="text-center py-20 bg-green-50 rounded-[2rem] border-4 border-dashed border-green-200 opacity-70">
                <Smile className="w-20 h-20 mx-auto mb-4 text-green-300 animate-bounce" />
                <p className="text-xl font-black text-green-600">¡Todo despejado!</p>
                <p className="text-green-500 font-medium">Aún no tienes misiones activas.</p>
              </div>
            ) : (
              myAppointments.map((appointment) => (
                <motion.div 
                  key={appointment.id}
                  whileHover={{ scale: 1.02, rotate: -1 }}
                  className="bg-white border-2 border-gray-100 rounded-[1.5rem] p-5 shadow-sm hover:shadow-lg transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-gray-800 bg-gray-50 px-3 py-1 rounded-lg">{appointment.serviceType}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      appointment.status === 'confirmed' || appointment.status === 'completed' ? 'bg-green-100 text-green-700' :
                      appointment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {appointment.status === 'completed' ? 'Completada' :
                       appointment.status === 'confirmed' ? 'Confirmada' :
                       appointment.status === 'pending' ? 'Esperando' : 'Cancelada'}
                    </span>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2 text-gray-500 font-bold text-sm bg-gray-50 p-2 rounded-xl inline-block">
                    <Calendar className="w-4 h-4" />
                    {new Date(appointment.date).toLocaleDateString()} a las {appointment.time}
                  </div>
                  
                  {appointment.piojologistName && (
                    <div className="mt-3 bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-600 font-bold flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Héroe: {appointment.piojologistName}
                    </div>
                  )}

                  {/* Datos Críticos para Cliente */}
                  {(appointment.yourLoss || appointment.ourPayment || appointment.total || appointment.age) && (
                    <div className="mt-3 bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                      <p className="text-xs font-bold text-yellow-600 uppercase mb-2">📊 Información del Servicio</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {appointment.yourLoss && (
                          <div className="bg-red-100 p-2 rounded-lg text-center">
                            <p className="text-red-600 font-bold">Pierdes</p>
                            <p className="text-red-700 font-black">$ {appointment.yourLoss}</p>
                          </div>
                        )}
                        {appointment.ourPayment && (
                          <div className="bg-green-100 p-2 rounded-lg text-center">
                            <p className="text-green-600 font-bold">Te Pagamos</p>
                            <p className="text-green-700 font-black">$ {appointment.ourPayment}</p>
                          </div>
                        )}
                        {appointment.total && (
                          <div className="bg-blue-100 p-2 rounded-lg text-center">
                            <p className="text-blue-600 font-bold">Total</p>
                            <p className="text-blue-700 font-black">$ {appointment.total}</p>
                          </div>
                        )}
                        {appointment.age && (
                          <div className="bg-purple-100 p-2 rounded-lg text-center">
                            <p className="text-purple-600 font-bold">Edad</p>
                            <p className="text-purple-700 font-black">{appointment.age} años</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClientView;