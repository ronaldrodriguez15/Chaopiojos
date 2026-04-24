import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Upload, FileText, Briefcase, Clock3, RefreshCw, Phone, MapPin, Wallet, Copy, Users, Eye, Link2, Lock, Mail, Menu, CircleDollarSign, Store, TrendingUp, Image as ImageIcon, Camera, ClipboardList, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MessagingModule from '@/components/MessagingModule';
import StatsHighlightCard from '@/components/StatsHighlightCard';
import BackendImage from '@/components/BackendImage';
import { sellerReferralService, sellerVisitService } from '@/lib/api';
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
  logo: null,
  citizenship_card: null,
  place_photo: null,
};

const initialVisitForm = {
  business_name: '',
  owner_name: '',
  whatsapp: '',
  place_photo: null,
};

const statusConfig = {
  pending_review: { label: 'Pendiente de revisión', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Aprobado', badge: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rechazado', badge: 'bg-red-100 text-red-700 border-red-200' },
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();
const buildSellerReferralLink = (referralCode) => (
  referralCode ? `${window.location.origin}/agenda?ref=${encodeURIComponent(referralCode)}` : ''
);
const buildReferralFormFromItem = (item) => ({
  business_name: item?.business_name || '',
  owner_name: item?.owner_name || '',
  whatsapp: item?.whatsapp || item?.phone || '',
  email: item?.referred_user?.email || item?.email || '',
  password: '',
  nit: item?.nit || '',
  city: item?.city || '',
  address: item?.address || '',
  notes: item?.notes || '',
  chamber_of_commerce: null,
  rut: null,
  logo: null,
  citizenship_card: null,
  place_photo: null,
});

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
  const [sellerVisits, setSellerVisits] = useState([]);
  const [supportsSellerVisits, setSupportsSellerVisits] = useState(() => sellerVisitService.isSupported());
  const [sellerVisitsLoaded, setSellerVisitsLoaded] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [visitFormData, setVisitFormData] = useState(initialVisitForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [visitFieldErrors, setVisitFieldErrors] = useState({});
  const [createdAccess, setCreatedAccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisitSubmitting, setIsVisitSubmitting] = useState(false);
  const [referralsPage, setReferralsPage] = useState(1);
  const [earningsPage, setEarningsPage] = useState(1);
  const [commissionPage, setCommissionPage] = useState(1);
  const [visitsPage, setVisitsPage] = useState(1);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [editingReferral, setEditingReferral] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [placePhotoPreview, setPlacePhotoPreview] = useState('');
  const [visitPhotoPreview, setVisitPhotoPreview] = useState('');

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

  const loadSellerVisits = useCallback(async (options = {}) => {
    const visitsResult = await sellerVisitService.getAll({ force: options.force === true });
    if (visitsResult.success) {
      setSellerVisits(visitsResult.visits || []);
      setSupportsSellerVisits(visitsResult.supported !== false);
      setSellerVisitsLoaded(true);
      return visitsResult;
    }

    toast({
      title: 'Error',
      description: visitsResult.message || 'No se pudo cargar el historial de visitas',
      variant: 'destructive',
      className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
    });
    return visitsResult;
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab === 'visits' && !sellerVisitsLoaded) {
      loadSellerVisits({ force: true });
    }
  }, [activeTab, sellerVisitsLoaded, loadSellerVisits]);

  const handleTabChange = (value) => {
    setActiveTab(value);
    localStorage.setItem('sellerTab', value);
  };

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(referrals.length / 5));
    if (referralsPage > totalPages) setReferralsPage(totalPages);
  }, [referrals.length, referralsPage]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sellerVisits.length / 5));
    if (visitsPage > totalPages) setVisitsPage(totalPages);
  }, [sellerVisits.length, visitsPage]);

  const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));

  const buildBookingUrl = (relativePath) => (relativePath ? `${window.location.origin}${relativePath}` : '');
  const sellerReferralLink = useMemo(
    () => buildSellerReferralLink(currentUser?.referral_code),
    [currentUser?.referral_code]
  );
  const isEditingReferral = Boolean(editingReferral);
  const currentPlacePhotoPreview = placePhotoPreview || (isEditingReferral ? editingReferral?.place_photo_url || '' : '');

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
    { label: 'Referidos registrados', value: stats.total || 0, tone: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700', icon: Briefcase },
    { label: 'Pendientes de revision', value: stats.pending_review || 0, tone: 'from-amber-50 to-yellow-100 border-yellow-200 text-yellow-700', icon: Clock3 },
    { label: 'Cabezas agendadas', value: earnings.summary?.heads_count || 0, tone: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700', icon: Users },
    { label: 'Ganancia pendiente', value: formatCurrency(earnings.summary?.pending_amount || 0), tone: 'from-purple-50 to-purple-100 border-purple-200 text-purple-700', icon: Wallet },
    { label: 'Visitas comerciales', value: sellerVisits.length, tone: 'from-orange-50 to-orange-100 border-orange-200 text-orange-700', icon: ClipboardList },
  ]), [stats, earnings.summary, sellerVisits.length]);

  const referralEarnings = useMemo(() => {
    const groups = new Map();

    referrals.forEach((item) => {
      groups.set(`id:${Number(item.id)}`, {
        id: item.id,
        name: item.business_name || 'Establecimiento',
        contact: item.contact_name || item.owner_name || item.email || 'Sin contacto',
        city: item.city || 'Sin ciudad',
        status: item.status || 'pending_review',
        bookingLink: item.booking_link || '',
        bookings: 0,
        heads: 0,
        total: 0,
        paid: 0,
        pending: 0,
      });
    });

    (earnings.commissions || []).forEach((item) => {
      const booking = item.booking || {};
      const referralId = Number(booking.seller_referral_id ?? booking.sellerReferralId ?? booking.seller_referral?.id);
      let key = Number.isFinite(referralId) ? `id:${referralId}` : null;

      if (!key && booking.seller_referral_name) {
        const match = referrals.find((referral) => normalizeKey(referral.business_name) === normalizeKey(booking.seller_referral_name));
        if (match) key = `id:${Number(match.id)}`;
      }

      if (!key) key = `name:${normalizeKey(booking.seller_referral_name || 'sin referido')}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: booking.seller_referral_name || 'Establecimiento sin registro',
          contact: 'Sin contacto',
          city: 'Sin ciudad',
          status: 'pending_review',
          bookingLink: '',
          bookings: 0,
          heads: 0,
          total: 0,
          paid: 0,
          pending: 0,
        });
      }

      const current = groups.get(key);
      const amount = Number(item.commission_amount || 0);
      const headCount = Number(booking.numPersonas || 1);

      current.bookings += 1;
      current.heads += headCount;
      current.total += amount;

      if (item.status === 'paid') current.paid += amount;
      else current.pending += amount;
    });

    return [...groups.values()].sort((a, b) => b.total - a.total || b.bookings - a.bookings);
  }, [earnings.commissions, referrals]);

  const earningsCards = useMemo(() => ([
    { label: 'Total generado', value: formatCurrency(earnings.summary?.total_amount || 0), helper: `${earnings.summary?.bookings_count || 0} reservas por link`, tone: 'from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-700', icon: CircleDollarSign },
    { label: 'Pagado', value: formatCurrency(earnings.summary?.paid_amount || 0), helper: 'comisiones liquidadas', tone: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700', icon: Wallet },
    { label: 'Pendiente', value: formatCurrency(earnings.summary?.pending_amount || 0), helper: 'por confirmar o pagar', tone: 'from-amber-50 to-yellow-100 border-yellow-200 text-yellow-700', icon: TrendingUp },
    { label: 'Establecimientos', value: referralEarnings.length, helper: `${stats.approved || 0} aprobados`, tone: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700', icon: Store },
  ]), [earnings.summary, formatCurrency, referralEarnings.length, stats.approved]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(referralEarnings.length / 5));
    if (earningsPage > totalPages) setEarningsPage(totalPages);
  }, [earningsPage, referralEarnings.length]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((earnings.commissions?.length || 0) / 5));
    if (commissionPage > totalPages) setCommissionPage(totalPages);
  }, [commissionPage, earnings.commissions]);

  useEffect(() => {
    if (!formData.place_photo) {
      setPlacePhotoPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(formData.place_photo);
    setPlacePhotoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [formData.place_photo]);

  useEffect(() => {
    if (!visitFormData.place_photo) {
      setVisitPhotoPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(visitFormData.place_photo);
    setVisitPhotoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [visitFormData.place_photo]);

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

  const handleCopySellerReferralLink = async () => {
    if (!sellerReferralLink) return;

    try {
      await navigator.clipboard.writeText(sellerReferralLink);
      toast({
        title: 'Link copiado',
        description: 'El link general del vendedor quedó copiado.',
        className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el link general del vendedor.',
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

  const resetReferralForm = () => {
    setEditingReferral(null);
    setFormData(initialForm);
    setFieldErrors({});
    setCreatedAccess(null);
  };

  const startEditingReferral = (item) => {
    setEditingReferral(item);
    setFormData(buildReferralFormFromItem(item));
    setFieldErrors({});
    setCreatedAccess(null);
    setSelectedReferral(null);
    handleTabChange('referrals');
  };

  const handleVisitInputChange = (field, value) => {
    setVisitFormData((prev) => ({ ...prev, [field]: value }));
    setVisitFieldErrors((prev) => {
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
    if (!isEditingReferral && !formData.password.trim()) errors.password = 'Debes definir una contraseña';
    if (!formData.whatsapp.trim()) errors.whatsapp = 'Debes registrar el WhatsApp del referido';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateVisitForm = () => {
    const errors = {};
    if (!visitFormData.business_name.trim()) errors.business_name = 'El nombre del negocio es obligatorio';
    if (!visitFormData.whatsapp.trim()) errors.whatsapp = 'Debes registrar el WhatsApp del negocio';
    setVisitFieldErrors(errors);
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

    const isEditing = Boolean(editingReferral);
    const accessSnapshot = {
      business_name: formData.business_name,
      email: formData.email,
      password: formData.password,
    };

    setIsSubmitting(true);
    const result = isEditing
      ? await sellerReferralService.update(editingReferral.id, formData)
      : await sellerReferralService.create(formData);
    setIsSubmitting(false);

    if (!result.success) {
      setFieldErrors(result.errors || {});
      toast({
        title: 'Error',
        description: result.message || (isEditing ? 'No se pudo actualizar el establecimiento' : 'No se pudo registrar el referido'),
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    if (isEditing) {
      resetReferralForm();
      toast({
        title: 'Establecimiento actualizado',
        description: result.message || 'Los cambios quedaron guardados y el establecimiento volvió a revisión.',
        className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200'
      });
    } else {
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
    }

    setSelectedReferral(null);
    await loadDashboard();
    handleTabChange('referrals');
  };

  const handleVisitSubmit = async (event) => {
    event.preventDefault();
    if (!validateVisitForm()) {
      toast({
        title: 'Faltan datos',
        description: 'Revisa los campos marcados antes de guardar la visita.',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setIsVisitSubmitting(true);
    const result = await sellerVisitService.create(visitFormData);
    setIsVisitSubmitting(false);

    if (!result.success) {
      if (result.supported === false) {
        toast({
          title: 'Módulo no disponible',
          description: result.message,
          className: 'bg-amber-100 text-amber-800 rounded-2xl border-2 border-amber-200'
        });
        return;
      }
      setVisitFieldErrors(result.errors || {});
      toast({
        title: 'Error',
        description: result.message || 'No se pudo registrar la visita comercial',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setVisitFormData(initialVisitForm);
    setVisitFieldErrors({});
    toast({
      title: 'Visita registrada',
      description: 'La visita comercial quedó guardada en tu historial.',
      className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200'
    });
    await loadSellerVisits();
    handleTabChange('visits');
  };

  const referralItemsPerPage = 5;
  const paginatedReferrals = referrals.slice((referralsPage - 1) * referralItemsPerPage, referralsPage * referralItemsPerPage);
  const paginatedReferralEarnings = referralEarnings.slice((earningsPage - 1) * referralItemsPerPage, earningsPage * referralItemsPerPage);
  const paginatedCommissions = (earnings.commissions || []).slice((commissionPage - 1) * referralItemsPerPage, commissionPage * referralItemsPerPage);
  const paginatedVisits = sellerVisits.slice((visitsPage - 1) * referralItemsPerPage, visitsPage * referralItemsPerPage);

  return (
    <div className="w-full space-y-8 overflow-x-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[225px_minmax(0,1fr)] gap-4">
          <aside className={`${isNavOpen ? 'block' : 'hidden'} lg:block`}>
            <div className="bg-white/60 border-2 border-cyan-100 rounded-[1.5rem] p-3 sticky top-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-wide mb-2">Modulos</p>
              <TabsList className="w-full h-auto flex flex-col items-stretch bg-transparent p-0 gap-2">
                <TabsTrigger value="panel" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-cyan-500 data-[state=active]:text-white transition-all">
                  📊 Mi Panel
                </TabsTrigger>
                <TabsTrigger value="earnings" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all">
                  💰 Ganancias
                </TabsTrigger>
                <TabsTrigger value="referrals" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all">
                  🏪 Establecimientos
                </TabsTrigger>
                <TabsTrigger value="visits" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all">
                  🗂️ Visitas
                </TabsTrigger>
                <TabsTrigger value="messaging" className="w-full justify-start rounded-xl py-2 px-3 font-bold text-sm data-[state=active]:bg-teal-500 data-[state=active]:text-white transition-all">
                  💬 Mensajería
                </TabsTrigger>
              </TabsList>
            </div>
          </aside>

          <section className="space-y-6">
            <div className="md:hidden flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                className="h-8 rounded-full text-cyan-700 bg-cyan-100/90 hover:bg-cyan-200 px-3 shadow-sm"
                onClick={() => setIsNavOpen((prev) => !prev)}
                aria-expanded={isNavOpen}
                aria-label="Mostrar u ocultar modulos"
              >
                <Menu className="w-4 h-4 mr-2" />
                {isNavOpen ? 'Ocultar modulos' : 'Mostrar modulos'}
              </Button>
            </div>

            <div className="hidden md:flex bg-white/60 border-2 border-cyan-100 rounded-[1.25rem] px-3 py-2 items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  className="lg:hidden h-9 rounded-lg border-2 border-cyan-200 text-cyan-600 bg-white/90 px-3"
                  onClick={() => setIsNavOpen((prev) => !prev)}
                  aria-expanded={isNavOpen}
                  aria-label="Abrir menu lateral"
                >
                  <Menu className="w-5 h-5 mr-2" />
                  {isNavOpen ? 'Cerrar' : 'Modulos'}
                </Button>
                <h2 className="text-base sm:text-lg font-black text-gray-800 truncate">Panel de Vendedor</h2>
              </div>
              <Button
                type="button"
                className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold shadow-sm"
                onClick={loadDashboard}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            <TabsContent value="panel" className="space-y-6">
              <div className="bg-white rounded-[2rem] p-4 md:p-6 border-4 border-cyan-100 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-white flex items-center justify-center shadow-lg">
                      <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-gray-800">Panel de Vendedor</h2>
                      <p className="text-sm md:text-base font-bold text-cyan-600">{currentUser?.name} • referidos, accesos y estadisticas</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-cyan-50 border-2 border-cyan-100 px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Valor por cabeza</p>
                    <p className="text-2xl font-black text-cyan-700 mt-1">{formatCurrency(commissionPerHead)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {cards.map((card) => {
                  return (
                    <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                      <StatsHighlightCard label={card.label} value={card.value} icon={card.icon} tone={card.tone} />
                    </motion.div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="space-y-6">
                  <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <Link2 className="w-6 h-6 text-cyan-600" />
                      <h3 className="text-xl font-black text-gray-800">Tu link general de referido</h3>
                    </div>
                    {currentUser?.referral_code ? (
                      <div className="space-y-4">
                        <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Código del vendedor</p>
                          <p className="mt-2 text-3xl font-black text-gray-800">{currentUser.referral_code}</p>
                        </div>
                        <div className="rounded-2xl bg-white border-2 border-cyan-100 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Link directo</p>
                          <p className="text-sm font-bold text-slate-700 break-all mt-2">{sellerReferralLink}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button type="button" onClick={handleCopySellerReferralLink} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-3 font-bold">
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar link general
                          </Button>
                          <a
                            href={sellerReferralLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-5 py-3 font-black text-cyan-700 hover:bg-cyan-100"
                          >
                            <Link2 className="w-4 h-4 mr-2" />
                            Abrir link
                          </a>
                        </div>
                        <p className="text-sm font-bold text-gray-600">
                          Este link aplica tu código automáticamente en la agenda pública, incluso sin pasar por un establecimiento.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">
                        Aún no tienes código de referido. Pide a administración que lo genere.
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <Link2 className="w-6 h-6 text-cyan-600" />
                      <h3 className="text-xl font-black text-gray-800">Links activos por establecimiento</h3>
                    </div>
                    {activeLinkReferrals.length === 0 ? (
                      <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">Aun no tienes establecimientos con link activo.</div>
                    ) : (
                      <div className="space-y-3">
                        {activeLinkReferrals.slice(0, 3).map((item) => (
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
                        <p className="text-sm font-bold text-gray-600">En el módulo de ganancias puedes ver cuánto genera cada establecimiento que has creado.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-[2rem] p-6 shadow-lg text-white border-4 border-cyan-300">
                  <p className="text-xs uppercase tracking-[0.25em] font-black opacity-80">Resumen de ganancias</p>
                  <h3 className="text-3xl font-black mt-3">{formatCurrency(earnings.summary?.total_amount || 0)}</h3>
                  <p className="text-sm md:text-base font-bold text-cyan-50 mt-3 leading-relaxed">Seguimiento de reservas hechas con los links de los establecimientos que has registrado.</p>
                  <div className="mt-6 space-y-3">
                    <div className="rounded-2xl bg-white/15 border border-white/20 p-4 flex items-center justify-between"><span className="font-bold">Pendiente</span><span className="text-2xl font-black">{formatCurrency(earnings.summary?.pending_amount || 0)}</span></div>
                    <div className="rounded-2xl bg-white/15 border border-white/20 p-4 flex items-center justify-between"><span className="font-bold">Pagado</span><span className="text-2xl font-black">{formatCurrency(earnings.summary?.paid_amount || 0)}</span></div>
                    <div className="rounded-2xl bg-white/15 border border-white/20 p-4 flex items-center justify-between"><span className="font-bold">Establecimientos</span><span className="text-2xl font-black">{referralEarnings.length}</span></div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="earnings" className="space-y-6">
              <div className="bg-white rounded-[2rem] border-4 border-emerald-100 p-6 shadow-lg space-y-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] font-black text-emerald-600">Modulo de ganancias</p>
                  <h3 className="text-2xl font-black text-gray-800 mt-2">Ganancias por establecimientos creados</h3>
                  <p className="text-sm font-bold text-gray-500 mt-2">Aqui ves el total, lo pagado, lo pendiente y el rendimiento individual de cada establecimiento.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  {earningsCards.map((card) => {
                    return (
                      <StatsHighlightCard key={card.label} label={card.label} value={card.value} helper={card.helper} icon={card.icon} tone={card.tone} />
                    );
                  })}
                </div>

                {referralEarnings.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 p-8 text-center font-bold text-emerald-700">Aun no tienes ganancias registradas por establecimientos.</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b-2 border-emerald-100">
                            <th className="p-4 font-black text-gray-400">Establecimiento</th>
                            <th className="p-4 font-black text-gray-400 text-center">Estado</th>
                            <th className="p-4 font-black text-gray-400 text-center">Actividad</th>
                            <th className="p-4 font-black text-gray-400 text-right">Pendiente</th>
                            <th className="p-4 font-black text-gray-400 text-right">Pagado</th>
                            <th className="p-4 font-black text-gray-400 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedReferralEarnings.map((item) => {
                            const status = statusConfig[item.status] || statusConfig.pending_review;
                            return (
                              <tr key={item.id} className="border-b border-emerald-50 last:border-0 hover:bg-emerald-50/50 transition-colors">
                                <td className="p-4">
                                  <div className="space-y-1">
                                    <p className="font-bold text-gray-700">{item.name}</p>
                                    <p className="text-xs font-bold text-gray-500">{item.contact} • {item.city}</p>
                                  </div>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${status.badge}`}>{status.label}</span>
                                </td>
                                <td className="p-4 text-center">
                                  <div className="space-y-1">
                                    <p className="font-black text-gray-800">{item.bookings}</p>
                                    <p className="text-[11px] font-bold text-gray-500">{item.heads} cabezas</p>
                                  </div>
                                </td>
                                <td className="p-4 text-right font-black text-amber-600">{formatCurrency(item.pending)}</td>
                                <td className="p-4 text-right font-black text-green-600">{formatCurrency(item.paid)}</td>
                                <td className="p-4 text-right font-black text-emerald-700">{formatCurrency(item.total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <Pagination currentPage={earningsPage} totalItems={referralEarnings.length} itemsPerPage={referralItemsPerPage} onPageChange={setEarningsPage} colorScheme="green" />
                  </>
                )}
              </div>

              <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-5"><Wallet className="w-6 h-6 text-cyan-600" /><h3 className="text-xl font-black text-gray-800">Reservas que te generan comisión</h3></div>
                {earnings.commissions?.length ? (
                  <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
                    {paginatedCommissions.map((item) => (
                      <div key={item.id} className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-lg font-black text-gray-800">{item.booking?.clientName || 'Cliente'}</p>
                          <p className="text-sm font-bold text-gray-600">{item.booking?.fecha ? new Date(item.booking.fecha).toLocaleDateString('es-CO') : 'Sin fecha'} {item.booking?.hora ? `• ${item.booking.hora}` : ''}</p>
                          {item.booking?.seller_referral_name && <p className="text-sm font-bold text-cyan-700 mt-1">Establecimiento: {item.booking.seller_referral_name}</p>}
                          <p className="text-sm font-bold text-cyan-700 mt-1">{item.booking?.numPersonas || 1} cabeza(s) • Comisión {formatCurrency(item.commission_amount || 0)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${item.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{item.status === 'paid' ? 'Pagada' : 'Pendiente'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">Aun no tienes reservas generadas con los links de tus establecimientos.</div>
                )}
                {earnings.commissions?.length ? (
                  <Pagination currentPage={commissionPage} totalItems={earnings.commissions.length} itemsPerPage={referralItemsPerPage} onPageChange={setCommissionPage} colorScheme="green" />
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="referrals" className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
            <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg space-y-5">
              <div className="flex items-center gap-3"><Upload className="w-6 h-6 text-cyan-600" /><h3 className="text-xl font-black text-gray-800">{isEditingReferral ? 'Editar establecimiento' : 'Registrar nuevo establecimiento'}</h3></div>

              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4 text-sm font-bold text-gray-700">
                {isEditingReferral
                  ? 'Puedes actualizar datos y soportes del establecimiento. Si cambias la contraseña, se actualiza el acceso; si la dejas vacía, se conserva. Los cambios del vendedor vuelven a estado pendiente de revisión.'
                  : 'Al registrar un referido se crea un usuario independiente. Ese referido podrá entrar con su correo y contraseña para ver únicamente su panel estadístico y su link.'}
              </div>

              {!isEditingReferral && createdAccess && (
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
                    <label className="block text-sm font-bold text-gray-600 mb-2">{isEditingReferral ? 'Nueva contraseña' : 'Contraseña inicial *'}</label>
                    <div className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50'}`}>
                      <Lock className="w-4 h-4 text-cyan-600" />
                      <input type="text" className="w-full bg-transparent font-bold outline-none text-gray-800" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} placeholder={isEditingReferral ? 'Déjala vacía para conservar la actual' : 'Mínimo 6 caracteres'} />
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
                  <label className="block rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 cursor-pointer"><span className="block text-sm font-black text-cyan-700 mb-2">Cámara de Comercio</span><span className="block text-xs text-gray-500 font-bold mb-3">PDF o imagen, máximo 5 MB</span><input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleInputChange('chamber_of_commerce', e.target.files?.[0] || null)} /><span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700"><FileText className="w-4 h-4" />{formData.chamber_of_commerce ? formData.chamber_of_commerce.name : 'Seleccionar archivo'}</span>{isEditingReferral && editingReferral?.chamber_of_commerce_url ? <a href={editingReferral.chamber_of_commerce_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-cyan-700 underline">Ver archivo actual</a> : null}</label>
                  <label className="block rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 cursor-pointer"><span className="block text-sm font-black text-cyan-700 mb-2">RUT</span><span className="block text-xs text-gray-500 font-bold mb-3">PDF o imagen, máximo 5 MB</span><input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => handleInputChange('rut', e.target.files?.[0] || null)} /><span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700"><FileText className="w-4 h-4" />{formData.rut ? formData.rut.name : 'Seleccionar archivo'}</span>{isEditingReferral && editingReferral?.rut_url ? <a href={editingReferral.rut_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-cyan-700 underline">Ver archivo actual</a> : null}</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 cursor-pointer"><span className="block text-sm font-black text-cyan-700 mb-2">Foto del logo</span><span className="block text-xs text-gray-500 font-bold mb-3">JPG, PNG o WEBP, máximo 5 MB</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => handleInputChange('logo', e.target.files?.[0] || null)} /><span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700"><FileText className="w-4 h-4" />{formData.logo ? formData.logo.name : 'Seleccionar archivo'}</span>{isEditingReferral && editingReferral?.logo_url ? <a href={editingReferral.logo_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-cyan-700 underline">Ver archivo actual</a> : null}</label>
                  <label className="block rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 cursor-pointer"><span className="block text-sm font-black text-cyan-700 mb-2">Foto de la cédula</span><span className="block text-xs text-gray-500 font-bold mb-3">JPG, PNG o WEBP, máximo 5 MB</span><input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => handleInputChange('citizenship_card', e.target.files?.[0] || null)} /><span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700"><FileText className="w-4 h-4" />{formData.citizenship_card ? formData.citizenship_card.name : 'Seleccionar archivo'}</span>{isEditingReferral && editingReferral?.citizenship_card_url ? <a href={editingReferral.citizenship_card_url} target="_blank" rel="noreferrer" className="block mt-2 text-xs font-black text-cyan-700 underline">Ver archivo actual</a> : null}</label>
                </div>
                <div className="rounded-2xl border-2 border-dashed border-cyan-300 bg-cyan-50 p-4 space-y-3">
                  <div>
                    <span className="block text-sm font-black text-cyan-700 mb-2">Foto del lugar</span>
                    <span className="block text-xs text-gray-500 font-bold">JPG, PNG o WEBP, máximo 5 MB. En celular puedes subirla o tomarla al instante.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 cursor-pointer hover:border-cyan-400 transition-colors">
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleInputChange('place_photo', e.target.files?.[0] || null)} />
                      <span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700">
                        <ImageIcon className="w-4 h-4" />
                        Subir foto
                      </span>
                    </label>
                    <label className="flex-1 rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 cursor-pointer hover:border-cyan-400 transition-colors">
                      <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleInputChange('place_photo', e.target.files?.[0] || null)} />
                      <span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700">
                        <Camera className="w-4 h-4" />
                        Tomar foto
                      </span>
                    </label>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-black text-cyan-700">
                    <ImageIcon className="w-4 h-4" />
                    {formData.place_photo ? formData.place_photo.name : isEditingReferral && editingReferral?.place_photo_url ? 'Usando foto actual' : 'Ninguna foto seleccionada'}
                  </div>
                </div>
                {currentPlacePhotoPreview ? (
                  <div className="rounded-2xl border-2 border-cyan-200 bg-white p-4 space-y-3">
                    <p className="text-sm font-black text-cyan-700">Previsualización</p>
                    <BackendImage
                      src={currentPlacePhotoPreview}
                      alt="Vista previa del establecimiento"
                      className="w-full h-56 rounded-2xl border border-cyan-100 bg-cyan-50"
                      imgClassName="object-cover"
                      fallbackClassName="border-cyan-100"
                      iconClassName="w-12 h-12 text-cyan-300"
                    />
                  </div>
                ) : null}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="submit" disabled={isSubmitting} className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-2xl py-4 font-black text-lg shadow-lg border-b-4 border-cyan-700 active:border-b-0 active:translate-y-1">{isSubmitting ? 'Guardando...' : isEditingReferral ? 'Guardar cambios' : 'Crear usuario referido'}</Button>
                  {isEditingReferral ? <Button type="button" onClick={resetReferralForm} className="sm:w-auto bg-white hover:bg-slate-100 text-slate-700 border-2 border-slate-200 rounded-2xl px-6 py-4 font-black">Cancelar edición</Button> : null}
                </div>
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
                          <div className="flex items-start gap-3">
                            {item.place_photo_url ? (
                              <BackendImage
                                src={item.place_photo_url}
                                alt={item.business_name}
                                className="w-16 h-16 rounded-2xl border-2 border-cyan-200 bg-white flex-shrink-0"
                                imgClassName="object-cover"
                                fallbackClassName="border-cyan-200"
                                iconClassName="w-6 h-6 text-cyan-400"
                              />
                            ) : null}
                            <div>
                              <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                              <p className="text-sm font-bold text-gray-600">{item.contact_name}</p>
                              <p className="text-xs font-semibold text-gray-500 mt-1">{new Date(item.created_at).toLocaleDateString('es-CO')}</p>
                            </div>
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

                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                          <Button type="button" onClick={() => startEditingReferral(item)} className="bg-white hover:bg-cyan-100 text-cyan-700 border-2 border-cyan-200 rounded-xl px-4 py-2 font-bold"><Pencil className="w-4 h-4 mr-2" />Editar</Button>
                          <Button type="button" onClick={() => setSelectedReferral(item)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold"><Eye className="w-4 h-4 mr-2" />Ver detalle</Button>
                        </div>
                      </div>
                    );
                  })}

                  <Pagination currentPage={referralsPage} totalItems={referrals.length} itemsPerPage={referralItemsPerPage} onPageChange={setReferralsPage} colorScheme="green" />
                </div>
              )}
            </div>
            </div>
            </TabsContent>

            <TabsContent value="visits" className="space-y-6">
              {!supportsSellerVisits ? (
                <div className="rounded-[2rem] border-4 border-amber-200 bg-amber-50 p-8 text-center space-y-3">
                  <p className="text-xl font-black text-amber-700">Módulo de visitas no disponible</p>
                  <p className="text-sm font-bold text-amber-800">Oops, ocurrió un error, Por favor, contacta con el administrador.</p>
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 font-bold"
                      onClick={() => loadSellerVisits({ force: true })}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
                <div className="bg-white rounded-[2rem] border-4 border-orange-100 p-6 shadow-lg space-y-5">
                  <div className="flex items-center gap-3"><ClipboardList className="w-6 h-6 text-orange-600" /><h3 className="text-xl font-black text-gray-800">Registrar visita comercial</h3></div>

                  <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4 text-sm font-bold text-gray-700">
                    Este formulario no crea un usuario. Sirve para dejar trazabilidad de una visita presencial al negocio y conservar la evidencia comercial.
                  </div>

                  <form onSubmit={handleVisitSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-600 mb-2">Nombre del negocio *</label>
                      <input className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${visitFieldErrors.business_name ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-orange-50 focus:border-orange-400'}`} value={visitFormData.business_name} onChange={(e) => handleVisitInputChange('business_name', e.target.value)} placeholder="Ej. Barbería Central" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">Nombre del dueño</label>
                        <input className="w-full rounded-2xl border-2 border-orange-200 bg-orange-50 p-4 font-bold outline-none focus:border-orange-400" value={visitFormData.owner_name} onChange={(e) => handleVisitInputChange('owner_name', e.target.value)} placeholder="Nombre del propietario" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-600 mb-2">WhatsApp *</label>
                        <input className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${visitFieldErrors.whatsapp ? 'border-red-300 bg-red-50' : 'border-orange-200 bg-orange-50 focus:border-orange-400'}`} value={visitFormData.whatsapp} onChange={(e) => handleVisitInputChange('whatsapp', e.target.value)} placeholder="3001234567" />
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 p-4 space-y-3">
                      <div>
                        <span className="block text-sm font-black text-orange-700 mb-2">Foto del local</span>
                        <span className="block text-xs text-gray-500 font-bold">Puedes subirla desde galería o tomarla en el momento desde el celular.</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className="flex-1 rounded-2xl border-2 border-orange-200 bg-white px-4 py-3 cursor-pointer hover:border-orange-400 transition-colors">
                          <input type="file" className="hidden" accept="image/*" onChange={(e) => handleVisitInputChange('place_photo', e.target.files?.[0] || null)} />
                          <span className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
                            <ImageIcon className="w-4 h-4" />
                            Subir foto
                          </span>
                        </label>
                        <label className="flex-1 rounded-2xl border-2 border-orange-200 bg-white px-4 py-3 cursor-pointer hover:border-orange-400 transition-colors">
                          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => handleVisitInputChange('place_photo', e.target.files?.[0] || null)} />
                          <span className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
                            <Camera className="w-4 h-4" />
                            Tomar foto
                          </span>
                        </label>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm font-black text-orange-700">
                        <ImageIcon className="w-4 h-4" />
                        {visitFormData.place_photo ? visitFormData.place_photo.name : 'Ninguna foto seleccionada'}
                      </div>
                    </div>
                    {visitPhotoPreview ? (
                      <div className="rounded-2xl border-2 border-orange-200 bg-white p-4 space-y-3">
                        <p className="text-sm font-black text-orange-700">Previsualización</p>
                        <img src={visitPhotoPreview} alt="Vista previa de la visita" className="w-full h-56 rounded-2xl object-cover border border-orange-100" />
                      </div>
                    ) : null}
                    <Button type="submit" disabled={isVisitSubmitting} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl py-4 font-black text-lg shadow-lg border-b-4 border-orange-700 active:border-b-0 active:translate-y-1">{isVisitSubmitting ? 'Guardando...' : 'Guardar visita'}</Button>
                  </form>
                </div>

                <div className="bg-white rounded-[2rem] border-4 border-orange-100 p-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3"><Briefcase className="w-6 h-6 text-orange-600" /><h3 className="text-xl font-black text-gray-800">Historial de visitas</h3></div>
                    <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-black">Total {sellerVisits.length}</span>
                  </div>
                  {sellerVisits.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50 p-10 text-center text-orange-700 font-bold">Todavía no has registrado visitas comerciales.</div>
                  ) : (
                    <div className="space-y-4">
                      {paginatedVisits.map((item) => (
                        <div key={item.id} className="rounded-[1.75rem] border-2 border-orange-100 bg-orange-50/60 p-5">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {item.place_photo_url ? (
                              <BackendImage
                                src={item.place_photo_url}
                                fallbackSrc={item.place_photo_api_url}
                                alt={item.business_name}
                                className="w-16 h-16 rounded-2xl border-2 border-orange-200 bg-white flex-shrink-0"
                                imgClassName="object-cover"
                                fallbackClassName="border-orange-200"
                                iconClassName="w-6 h-6 text-orange-400"
                                />
                              ) : null}
                              <div>
                                <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                                <p className="text-sm font-bold text-gray-600">{item.owner_name || 'Dueño sin registrar'}</p>
                                <p className="text-xs font-semibold text-gray-500 mt-1">{new Date(item.created_at).toLocaleString('es-CO')}</p>
                              </div>
                            </div>
                            <Button type="button" onClick={() => setSelectedVisit(item)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-bold"><Eye className="w-4 h-4 mr-2" />Ver detalle</Button>
                          </div>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                            <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 text-orange-600" /><div><p>{item.whatsapp || 'Sin WhatsApp registrado'}</p><p className="text-xs text-gray-500 mt-1">Visita comercial</p></div></div>
                            <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2"><ClipboardList className="w-4 h-4 mt-0.5 text-orange-600" /><div><p>Registrada en historial</p><p className="text-xs text-gray-500 mt-1">Queda visible también para administración</p></div></div>
                          </div>
                        </div>
                      ))}

                      <Pagination currentPage={visitsPage} totalItems={sellerVisits.length} itemsPerPage={referralItemsPerPage} onPageChange={setVisitsPage} colorScheme="orange" />
                    </div>
                  )}
                </div>
              </div>
              )}
            </TabsContent>

            <TabsContent value="messaging" className="space-y-6">
              <MessagingModule currentUser={currentUser} />
            </TabsContent>

          </section>
        </div>

        <Dialog open={Boolean(selectedReferral)} onOpenChange={(open) => !open && setSelectedReferral(null)}>
          <DialogContent className="rounded-[3rem] border-4 border-cyan-400 p-0 overflow-hidden sm:max-w-2xl bg-cyan-50 shadow-2xl">
            <DialogHeader className="sr-only"><DialogTitle>Detalle del referido</DialogTitle></DialogHeader>
            {selectedReferral && (
              <div className="max-h-[80vh] overflow-y-auto">
                <div className="text-center pt-8 pb-6">
                  <div className="flex items-center justify-center gap-3 mb-2"><Briefcase className="w-6 h-6 text-cyan-600" /><h2 className="text-2xl font-black text-cyan-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>DETALLE DEL REFERIDO</h2></div>
                </div>
                <div className="px-6 md:px-8 pb-8 space-y-4">
                  {selectedReferral.place_photo_url && (
                    <div className="bg-white rounded-2xl border-2 border-cyan-200 p-4">
                      <BackendImage
                        src={selectedReferral.place_photo_url}
                        alt={selectedReferral.business_name}
                        className="w-full h-56 rounded-2xl border border-cyan-100 bg-cyan-50"
                        imgClassName="object-cover"
                        fallbackClassName="border-cyan-100"
                        iconClassName="w-12 h-12 text-cyan-300"
                      />
                    </div>
                  )}
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
                  <div className="flex justify-end"><Button type="button" onClick={() => startEditingReferral(selectedReferral)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold"><Pencil className="w-4 h-4 mr-2" />Editar establecimiento</Button></div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(selectedVisit)} onOpenChange={(open) => !open && setSelectedVisit(null)}>
          <DialogContent className="rounded-[3rem] border-4 border-orange-400 p-0 overflow-hidden sm:max-w-2xl bg-orange-50 shadow-2xl">
            <DialogHeader className="sr-only"><DialogTitle>Detalle de la visita</DialogTitle></DialogHeader>
            {selectedVisit && (
              <div className="max-h-[80vh] overflow-y-auto">
                <div className="text-center pt-8 pb-6">
                  <div className="flex items-center justify-center gap-3 mb-2"><ClipboardList className="w-6 h-6 text-orange-600" /><h2 className="text-2xl font-black text-orange-600 uppercase tracking-wide">DETALLE DE LA VISITA</h2></div>
                </div>
                <div className="px-6 md:px-8 pb-8 space-y-4">
                  {selectedVisit.place_photo_url && (
                    <div className="bg-white rounded-2xl border-2 border-orange-200 p-4">
                      <BackendImage
                        src={selectedVisit.place_photo_url}
                        fallbackSrc={selectedVisit.place_photo_api_url}
                        alt={selectedVisit.business_name}
                        className="w-full h-56 rounded-2xl border border-orange-100 bg-orange-50"
                        imgClassName="object-cover"
                        fallbackClassName="border-orange-100"
                        iconClassName="w-12 h-12 text-orange-300"
                      />
                    </div>
                  )}
                  <div className="bg-white rounded-2xl border-2 border-orange-200 p-4"><p className="text-xl font-black text-gray-800">{selectedVisit.business_name}</p><p className="text-sm font-bold text-gray-600 mt-1">Dueño: {selectedVisit.owner_name || 'No registrado'}</p></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                    <div className="bg-white rounded-xl border-2 border-orange-100 p-3">WhatsApp: <span className="font-bold text-gray-900">{selectedVisit.whatsapp || 'No registrado'}</span></div>
                    <div className="bg-white rounded-xl border-2 border-orange-100 p-3">Fecha: <span className="font-bold text-gray-900">{selectedVisit.created_at ? new Date(selectedVisit.created_at).toLocaleString('es-CO') : 'No registrada'}</span></div>
                  </div>
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
