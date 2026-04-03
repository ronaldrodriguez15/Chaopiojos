import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Upload, FileText, Briefcase, Clock3, RefreshCw, Phone, MapPin, Wallet, Copy, Users, Eye, Link2, Lock, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { sellerReferralService } from '@/lib/api';
import Pagination from '@/components/admin/Pagination';

const initialForm = {
  business_name: '',
  owner_name: '',
  whatsapp: '',
  email: '',
  password: '',
  nit: '',
  city: '',
  address: '',
  notes: '',
  chamber_of_commerce: null,
  rut: null,
};

const statusConfig = {
  pending_review: { label: 'Pendiente de revisión', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Aprobado', badge: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rechazado', badge: 'bg-red-100 text-red-700 border-red-200' },
};

const SellerView = ({ currentUser }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('sellerTab') || 'panel');
  const [stats, setStats] = useState({ total: 0, pending_review: 0, approved: 0, rejected: 0, with_documents: 0, this_month: 0 });
  const [referrals, setReferrals] = useState([]);
  const [earnings, setEarnings] = useState({
    seller: null,
    summary: { pending_amount: 0, paid_amount: 0, total_amount: 0, bookings_count: 0, heads_count: 0, approved_referrals: 0 },
    commissions: [],
  });
  const [formData, setFormData] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdAccess, setCreatedAccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralsPage, setReferralsPage] = useState(1);
  const [selectedReferral, setSelectedReferral] = useState(null);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsResult, referralsResult, earningsResult] = await Promise.all([
        sellerReferralService.getStatistics(),
        sellerReferralService.getAll(),
        sellerReferralService.getEarnings(),
      ]);

      if (statsResult.success) setStats(statsResult.statistics || {});
      if (referralsResult.success) setReferrals(referralsResult.referrals || []);
      if (earningsResult.success && earningsResult.earnings) setEarnings(earningsResult.earnings);

      if (!statsResult.success || !referralsResult.success || !earningsResult.success) {
        toast({
          title: 'Error',
          description: statsResult.message || referralsResult.message || earningsResult.message || 'No se pudo cargar el panel del vendedor',
          variant: 'destructive',
          className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    localStorage.setItem('sellerTab', value);
  };

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(referrals.length / 5));
    if (referralsPage > totalPages) setReferralsPage(totalPages);
  }, [referrals.length, referralsPage]);

  const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));

  const buildBookingUrl = (relativePath) => (relativePath ? `${window.location.origin}${relativePath}` : '');

  const activeLinkReferrals = useMemo(
    () => referrals.filter((item) => item.booking_link),
    [referrals]
  );
  const commissionPerHead = Number(
    earnings.seller?.effective_referral_value
    ?? earnings.summary?.per_head_value
    ?? 0
  );

  const cards = useMemo(() => ([
    { label: 'Referidos registrados', value: stats.total || 0, tone: 'bg-blue-50 border-blue-200 text-blue-700', icon: Briefcase },
    { label: 'Pendientes de revisión', value: stats.pending_review || 0, tone: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock3 },
    { label: 'Cabezas agendadas', value: earnings.summary?.heads_count || 0, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: Users },
    { label: 'Ganancia pendiente', value: formatCurrency(earnings.summary?.pending_amount || 0), tone: 'bg-purple-50 border-purple-200 text-purple-700', icon: Wallet },
  ]), [stats, earnings.summary]);

  const handleCopyBookingUrl = async (relativePath) => {
    const bookingUrl = buildBookingUrl(relativePath);
    if (!bookingUrl) return;

    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({
        title: 'Link copiado',
        description: 'El enlace del referido quedó copiado.',
        className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace.',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.business_name.trim()) errors.business_name = 'El nombre del referido es obligatorio';
    if (!formData.email.trim()) errors.email = 'El correo será el usuario de acceso';
    if (!formData.password.trim()) errors.password = 'Debes definir una contraseña';
    if (!formData.whatsapp.trim()) errors.whatsapp = 'Debes registrar el WhatsApp del referido';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) {
      toast({
        title: 'Faltan datos',
        description: 'Revisa los campos marcados antes de guardar el referido.',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    const accessSnapshot = {
      business_name: formData.business_name,
      email: formData.email,
      password: formData.password,
    };

    setIsSubmitting(true);
    const result = await sellerReferralService.create(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setFieldErrors(result.errors || {});
      toast({
        title: 'Error',
        description: result.message || 'No se pudo registrar el referido',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setFormData(initialForm);
    setFieldErrors({});
    setCreatedAccess({
      ...accessSnapshot,
      email: result.credentials?.email || accessSnapshot.email,
    });
    toast({
      title: 'Referido creado',
      description: 'El usuario del referido quedó listo con su acceso y su link.',
      className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200'
    });
    await loadDashboard();
    handleTabChange('referrals');
  };

  const referralItemsPerPage = 5;
  const paginatedReferrals = referrals.slice((referralsPage - 1) * referralItemsPerPage, referralsPage * referralItemsPerPage);

  return (
    <div className="bg-white rounded-[2.5rem] p-3 md:p-4 shadow-2xl border-4 border-cyan-100">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="bg-white rounded-[2rem] p-4 md:p-6 border-4 border-cyan-100 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-white flex items-center justify-center shadow-lg">
                <Building2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-800">Panel de Vendedor</h2>
                <p className="text-sm md:text-base font-bold text-cyan-600">{currentUser?.name} • referidos, accesos y estadísticas</p>
              </div>
            </div>
            <Button type="button" onClick={loadDashboard} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-4 font-bold shadow-md border-b-4 border-cyan-700 active:border-b-0 active:translate-y-1">
              <RefreshCw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>

          <TabsList className="mt-6 grid grid-cols-2 bg-cyan-50 border-2 border-cyan-100 rounded-2xl p-2 h-auto">
            <TabsTrigger value="panel" className="rounded-xl py-3 font-black data-[state=active]:bg-cyan-500 data-[state=active]:text-white">Panel Estadístico</TabsTrigger>
            <TabsTrigger value="referrals" className="rounded-xl py-3 font-black data-[state=active]:bg-cyan-500 data-[state=active]:text-white">Referidos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="panel" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <Link2 className="w-6 h-6 text-cyan-600" />
                <h3 className="text-xl font-black text-gray-800">Links activos por referido</h3>
              </div>
              {activeLinkReferrals.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">Aún no tienes referidos con link activo.</div>
              ) : (
                <div className="space-y-3">
                  {activeLinkReferrals.map((item) => (
                    <div key={item.id} className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                          <p className="text-sm font-bold text-gray-600">{item.referred_user?.email || item.email}</p>
                        </div>
                        <Button type="button" onClick={() => handleCopyBookingUrl(item.booking_link)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-3 font-bold">
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar link
                        </Button>
                      </div>
                      <div className="rounded-2xl bg-white border-2 border-cyan-100 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Link directo</p>
                        <p className="text-sm font-bold text-slate-700 break-all mt-2">{buildBookingUrl(item.booking_link)}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-sm font-bold text-gray-600">Cada reserva hecha con estos links te genera <span className="text-cyan-700">{formatCurrency(commissionPerHead)}</span> por cabeza agendada.</p>
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-[2rem] p-6 shadow-lg text-white border-4 border-cyan-300">
              <p className="text-xs uppercase tracking-[0.25em] font-black opacity-80">Ganancias por referidos</p>
              <h3 className="text-3xl font-black mt-3">{formatCurrency(earnings.summary?.total_amount || 0)}</h3>
              <p className="text-sm md:text-base font-bold text-cyan-50 mt-3 leading-relaxed">Seguimiento de reservas creadas con los links de tus referidos y pago por cabeza agendada.</p>
              <p className="text-sm font-black text-cyan-100 mt-3">Valor actual por cabeza: {formatCurrency(commissionPerHead)}</p>
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl bg-white/15 border border-white/20 p-4 flex items-center justify-between"><span className="font-bold">Pendiente</span><span className="text-2xl font-black">{formatCurrency(earnings.summary?.pending_amount || 0)}</span></div>
                <div className="rounded-2xl bg-white/15 border border-white/20 p-4 flex items-center justify-between"><span className="font-bold">Pagado</span><span className="text-2xl font-black">{formatCurrency(earnings.summary?.paid_amount || 0)}</span></div>
                <div className="rounded-2xl bg-white/15 border border-white/20 p-4 flex items-center justify-between"><span className="font-bold">Reservas por link</span><span className="text-2xl font-black">{earnings.summary?.bookings_count || 0}</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[2rem] border-4 p-5 shadow-lg ${card.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide font-black opacity-80">{card.label}</p>
                      <p className="text-3xl font-black mt-2">{card.value}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm"><Icon className="w-7 h-7" /></div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-5"><Wallet className="w-6 h-6 text-cyan-600" /><h3 className="text-xl font-black text-gray-800">Reservas que te generan comisión</h3></div>
            {earnings.commissions?.length ? (
              <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
                {earnings.commissions.map((item) => (
                  <div key={item.id} className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-gray-800">{item.booking?.clientName || 'Cliente'}</p>
                      <p className="text-sm font-bold text-gray-600">{item.booking?.fecha ? new Date(item.booking.fecha).toLocaleDateString('es-CO') : 'Sin fecha'} {item.booking?.hora ? `• ${item.booking.hora}` : ''}</p>
                      {item.booking?.seller_referral_name && <p className="text-sm font-bold text-cyan-700 mt-1">Referido: {item.booking.seller_referral_name}</p>}
                      <p className="text-sm font-bold text-cyan-700 mt-1">{item.booking?.numPersonas || 1} cabeza(s) • Comisión {formatCurrency(item.commission_amount || 0)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${item.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{item.status === 'paid' ? 'Pagada' : 'Pendiente'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">Aún no tienes reservas generadas con los links de tus referidos.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
            <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg space-y-5">
              <div className="flex items-center gap-3"><Upload className="w-6 h-6 text-cyan-600" /><h3 className="text-xl font-black text-gray-800">Registrar nuevo establecimiento</h3></div>

              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-gray-700">
                Al registrar un referido se crea un usuario independiente. Ese referido podrá entrar con su correo y contraseña para ver únicamente su panel estadístico y su link.
              </div>

              {createdAccess && (
                <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4 space-y-2">
                  <p className="text-sm font-black uppercase tracking-wide text-green-700">Acceso creado</p>
                  <p className="text-lg font-black text-gray-800">{createdAccess.business_name}</p>
                  <p className="text-sm font-bold text-gray-700">Correo: <span className="text-green-700">{createdAccess.email}</span></p>
                  <p className="text-sm font-bold text-gray-700">Contraseña: <span className="text-green-700">{createdAccess.password}</span></p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-600 mb-2">Nombre del referido o negocio *</label><input className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.business_name ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.business_name} onChange={(e) => handleInputChange('business_name', e.target.value)} placeholder="Ej. Peluquería Brillo Perfecto" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-gray-600 mb-2">Propietario</label><input className="w-full rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 font-bold outline-none focus:border-cyan-400" value={formData.owner_name} onChange={(e) => handleInputChange('owner_name', e.target.value)} placeholder="Nombre del dueño" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-2">WhatsApp *</label><input className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.whatsapp ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.whatsapp} onChange={(e) => handleInputChange('whatsapp', e.target.value)} placeholder="3001234567" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Correo de acceso *</label>
                    <div className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50'}`}>
                      <Mail className="w-4 h-4 text-cyan-600" />
                      <input type="email" className="w-full bg-transparent font-bold outline-none text-gray-800" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="contacto@referido.com" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-2">Contraseña inicial *</label>
                    <div className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50'}`}>
                      <Lock className="w-4 h-4 text-cyan-600" />
                      <input type="text" className="w-full bg-transparent font-bold outline-none text-gray-800" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} placeholder="Mínimo 6 caracteres" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-gray-600 mb-2">Ciudad</label><input className="w-full rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 font-bold outline-none focus:border-cyan-400" value={formData.city} onChange={(e) => handleInputChange('city', e.target.value)} placeholder="Ciudad" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-2">Dirección</label><input className="w-full rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 font-bold outline-none focus:border-cyan-400" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Dirección comercial" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-gray-600 mb-2">NIT</label><input className="w-full rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 font-bold outline-none focus:border-cyan-400" value={formData.nit} onChange={(e) => handleInputChange('nit', e.target.value)} placeholder="Identificación tributaria" /></div>
                  <div><label className="block text-sm font-bold text-gray-600 mb-2">Observaciones</label><textarea rows={3} className="w-full rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4 font-bold outline-none focus:border-cyan-400 resize-none" value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Notas comerciales, condiciones o comentarios relevantes" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 cursor-pointer"><span className="block text-sm font-black text-cyan-700 mb-2">Cámara de Comercio</span><span className="block text-xs text-gray-500 font-bold mb-3">PDF o imagen, máximo 5 MB</span><input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleInputChange('chamber_of_commerce', e.target.files?.[0] || null)} /><span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700"><FileText className="w-4 h-4" />{formData.chamber_of_commerce ? formData.chamber_of_commerce.name : 'Seleccionar archivo'}</span></label>
                  <label className="block rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 cursor-pointer"><span className="block text-sm font-black text-cyan-700 mb-2">RUT</span><span className="block text-xs text-gray-500 font-bold mb-3">PDF o imagen, máximo 5 MB</span><input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleInputChange('rut', e.target.files?.[0] || null)} /><span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700"><FileText className="w-4 h-4" />{formData.rut ? formData.rut.name : 'Seleccionar archivo'}</span></label>
                </div>
                <Button type="submit" disabled={isSubmitting} className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-2xl py-4 font-black text-lg shadow-lg border-b-4 border-cyan-700 active:border-b-0 active:translate-y-1">{isSubmitting ? 'Guardando...' : 'Crear usuario referido'}</Button>
              </form>
            </div>

            <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-5"><Briefcase className="w-6 h-6 text-cyan-600" /><h3 className="text-xl font-black text-gray-800">Establecimientos cargados</h3></div>
              {referrals.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-10 text-center text-cyan-700 font-bold">Todavía no has registrado referidos.</div>
              ) : (
                <div className="space-y-4">
                  {paginatedReferrals.map((item) => {
                    const status = statusConfig[item.status] || statusConfig.pending_review;
                    return (
                      <div key={item.id} className="rounded-[1.75rem] border-2 border-cyan-100 bg-cyan-50/60 p-5">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                            <p className="text-sm font-bold text-gray-600">{item.contact_name}</p>
                            <p className="text-xs font-semibold text-gray-500 mt-1">{new Date(item.created_at).toLocaleDateString('es-CO')}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${status.badge}`}>{status.label}</span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                          <div className="bg-white rounded-xl border border-cyan-100 p-3 flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 text-cyan-600" /><div><p>{item.whatsapp || item.phone || 'Sin teléfono registrado'}</p><p className="text-xs text-gray-500 mt-1">{item.referred_user?.email || item.email || 'Sin correo'}</p></div></div>
                          <div className="bg-white rounded-xl border border-cyan-100 p-3 flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-cyan-600" /><div><p>{item.city || 'Sin ciudad'}</p>{item.address && <p className="text-xs text-gray-500 mt-1">{item.address}</p>}</div></div>
                        </div>

                        {item.booking_link && (
                          <div className="mt-4 rounded-xl bg-white border border-cyan-100 p-3 space-y-2">
                            <p className="text-xs font-black uppercase tracking-wide text-cyan-600">Link activo</p>
                            <p className="text-xs font-bold text-gray-600 break-all">{buildBookingUrl(item.booking_link)}</p>
                            <Button type="button" onClick={() => handleCopyBookingUrl(item.booking_link)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold"><Copy className="w-4 h-4 mr-2" />Copiar link</Button>
                          </div>
                        )}

                        <div className="mt-4 flex justify-end"><Button type="button" onClick={() => setSelectedReferral(item)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold"><Eye className="w-4 h-4 mr-2" />Ver detalle</Button></div>
                      </div>
                    );
                  })}

                  <Pagination currentPage={referralsPage} totalItems={referrals.length} itemsPerPage={referralItemsPerPage} onPageChange={setReferralsPage} colorScheme="green" />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <Dialog open={Boolean(selectedReferral)} onOpenChange={(open) => !open && setSelectedReferral(null)}>
          <DialogContent className="rounded-[3rem] border-4 border-cyan-400 p-0 overflow-hidden sm:max-w-2xl bg-cyan-50 shadow-2xl">
            <DialogHeader className="sr-only"><DialogTitle>Detalle del referido</DialogTitle></DialogHeader>
            {selectedReferral && (
              <div className="max-h-[80vh] overflow-y-auto">
                <div className="text-center pt-8 pb-6">
                  <div className="flex items-center justify-center gap-3 mb-2"><Briefcase className="w-6 h-6 text-cyan-600" /><h2 className="text-2xl font-black text-cyan-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>DETALLE DEL REFERIDO</h2></div>
                </div>
                <div className="px-6 md:px-8 pb-8 space-y-4">
                  <div className="bg-white rounded-2xl border-2 border-cyan-200 p-4"><p className="text-xl font-black text-gray-800">{selectedReferral.business_name}</p><p className="text-sm font-bold text-gray-600 mt-1">Contacto: {selectedReferral.contact_name}</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Propietario: <span className="font-bold text-gray-900">{selectedReferral.owner_name || 'No registrado'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">WhatsApp: <span className="font-bold text-gray-900">{selectedReferral.whatsapp || 'No registrado'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Teléfono: <span className="font-bold text-gray-900">{selectedReferral.phone || 'No registrado'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Email de acceso: <span className="font-bold text-gray-900">{selectedReferral.referred_user?.email || selectedReferral.email || 'No registrado'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">NIT: <span className="font-bold text-gray-900">{selectedReferral.nit || 'No registrado'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Ciudad: <span className="font-bold text-gray-900">{selectedReferral.city || 'No registrada'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-cyan-100 p-3 md:col-span-2">Dirección: <span className="font-bold text-gray-900">{selectedReferral.address || 'No registrada'}</span></div>
                  </div>
                  {selectedReferral.booking_link && <div className="bg-white rounded-xl border-2 border-cyan-100 p-4"><p className="text-xs font-black text-cyan-600 uppercase mb-2">Link de agendamiento</p><p className="text-sm font-bold text-gray-700 break-all">{buildBookingUrl(selectedReferral.booking_link)}</p></div>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </Tabs>
    </div>
  );
};

export default SellerView;
