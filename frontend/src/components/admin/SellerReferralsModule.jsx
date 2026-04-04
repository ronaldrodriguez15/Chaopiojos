import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Eye, FileText, Building2, Wallet, X, Users, Image as ImageIcon, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import Pagination from './Pagination';
import { sellerReferralService, sellerVisitService } from '@/lib/api';

const statusConfig = {
  pending_review: { label: 'Pendiente', card: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Aprobado', card: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rechazado', card: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700 border-red-200' },
};

const SellerReferralsModule = React.memo(() => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('adminSellerRecordsTab') || 'referrals');
  const [items, setItems] = useState([]);
  const [visits, setVisits] = useState([]);
  const [supportsSellerVisits, setSupportsSellerVisits] = useState(() => sellerVisitService.isSupported());
  const [visitsLoaded, setVisitsLoaded] = useState(() => sellerVisitService.isSupported() === false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [visitsPage, setVisitsPage] = useState(1);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [earningsSummary, setEarningsSummary] = useState({ pending_amount: 0, paid_amount: 0, total_amount: 0, bookings_count: 0, heads_count: 0 });
  const itemsPerPage = 5;

  const loadData = async () => {
    setLoading(true);
    const [result, earningsResult] = await Promise.all([
      sellerReferralService.getAll(),
      sellerReferralService.getEarnings(),
    ]);
    setLoading(false);

    if (result.success) setItems(result.referrals || []);
    if (earningsResult.success) setEarningsSummary(earningsResult.summary || {});

    if (result.success && earningsResult.success) return;

    toast({
      title: 'Error',
      description: result.message || earningsResult.message || 'No se pudo cargar la gestion comercial de vendedores',
      variant: 'destructive',
      className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
    });
  };

  const loadVisits = async () => {
    const visitsResult = await sellerVisitService.getAll();
    if (visitsResult.success) {
      setVisits(visitsResult.visits || []);
      setSupportsSellerVisits(visitsResult.supported !== false);
      setVisitsLoaded(true);
      return visitsResult;
    }

    toast({
      title: 'Error',
      description: visitsResult.message || 'No se pudo cargar el historial de visitas',
      variant: 'destructive',
      className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
    });
    return visitsResult;
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (activeTab === 'visits' && !visitsLoaded) {
      loadVisits();
    }
  }, [activeTab, visitsLoaded]);

  useEffect(() => {
    const maxPage = Math.ceil(items.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
  }, [items.length, currentPage]);

  useEffect(() => {
    const maxPage = Math.ceil(visits.length / itemsPerPage);
    if (visitsPage > maxPage && maxPage > 0) setVisitsPage(maxPage);
  }, [visits.length, visitsPage]);

  useEffect(() => {
    if (activeTab === 'visits' && !supportsSellerVisits) {
      setActiveTab('referrals');
      localStorage.setItem('adminSellerRecordsTab', 'referrals');
    }
  }, [activeTab, supportsSellerVisits]);

  const handleTabChange = (value) => {
    if (value === 'visits' && !supportsSellerVisits) return;
    setActiveTab(value);
    localStorage.setItem('adminSellerRecordsTab', value);
  };

  const referralsSummary = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => item.status === 'pending_review').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
  }), [items]);

  const visitsSummary = useMemo(() => {
    const now = new Date();
    const thisMonth = visits.filter((item) => {
      const createdAt = item.created_at ? new Date(item.created_at) : null;
      return createdAt && createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
    }).length;
    const withPhoto = visits.filter((item) => item.place_photo_url).length;
    const sellers = new Set(visits.map((item) => item.seller?.name).filter(Boolean));

    return {
      total: visits.length,
      thisMonth,
      withPhoto,
      sellers: sellers.size,
    };
  }, [visits]);

  const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedVisits = visits.slice((visitsPage - 1) * itemsPerPage, visitsPage * itemsPerPage);
  const visibleRangeStart = items.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const visibleRangeEnd = Math.min(currentPage * itemsPerPage, items.length);
  const visibleVisitStart = visits.length === 0 ? 0 : ((visitsPage - 1) * itemsPerPage) + 1;
  const visibleVisitEnd = Math.min(visitsPage * itemsPerPage, visits.length);

  const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(Number(amount || 0));
  const buildBookingUrl = (relativePath) => (relativePath ? `${window.location.origin}${relativePath}` : '');

  const copyBookingLink = async (relativePath) => {
    const bookingUrl = buildBookingUrl(relativePath);
    if (!bookingUrl) return;

    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({ title: 'Link copiado', description: 'El enlace quedo copiado.', className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200' });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo copiar el enlace.', variant: 'destructive', className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold' });
    }
  };

  const submitReview = async (status) => {
    if (!reviewTarget) return;
    const result = await sellerReferralService.review(reviewTarget.id, { status, review_notes: reviewNotes.trim() });

    if (!result.success) {
      toast({ title: 'Error', description: result.message || 'No se pudo guardar la revision', variant: 'destructive', className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold' });
      return;
    }

    toast({ title: status === 'approved' ? 'Referido aprobado' : 'Referido rechazado', description: result.message, className: `${status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'} rounded-2xl border-2` });
    setApproveDialogOpen(false);
    setRejectDialogOpen(false);
    setReviewTarget(null);
    setReviewNotes('');
    await loadData();
    if (visitsLoaded) await loadVisits();
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-cyan-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl sm:text-2xl font-black text-gray-800">Gestion comercial de vendedores</h3>
          <p className="text-sm font-bold text-gray-500 mt-1">Administra establecimientos creados por vendedores y el historial de visitas comerciales.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-sm font-black">Establecimientos {referralsSummary.total}</span>
          <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-black">Visitas {visitsSummary.total}</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="w-full h-auto flex flex-wrap justify-start gap-2 rounded-[1.5rem] bg-cyan-50 p-2 border-2 border-cyan-100">
          <TabsTrigger value="referrals" className="rounded-xl px-4 py-2 font-black data-[state=active]:bg-cyan-500 data-[state=active]:text-white">Establecimientos</TabsTrigger>
          <TabsTrigger value="visits" disabled={!supportsSellerVisits} className="rounded-xl px-4 py-2 font-black data-[state=active]:bg-orange-500 data-[state=active]:text-white disabled:opacity-50 disabled:cursor-not-allowed">Visitas</TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-sm font-black">Total {referralsSummary.total}</span>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-black">Pendientes {referralsSummary.pending}</span>
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-black">Aprobados {referralsSummary.approved}</span>
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-black">Rechazados {referralsSummary.rejected}</span>
          </div>

          <div className="rounded-[2rem] border-4 border-cyan-100 bg-cyan-50/60 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-6 h-6 text-cyan-600" />
              <h4 className="text-xl font-black text-gray-800">Ganancias por links</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white border-2 border-cyan-100 p-4">
                <p className="text-xs uppercase font-black tracking-wide text-cyan-600">Pendiente</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{formatCurrency(earningsSummary.pending_amount || 0)}</p>
              </div>
              <div className="rounded-2xl bg-white border-2 border-cyan-100 p-4">
                <p className="text-xs uppercase font-black tracking-wide text-cyan-600">Pagado</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{formatCurrency(earningsSummary.paid_amount || 0)}</p>
              </div>
              <div className="rounded-2xl bg-white border-2 border-cyan-100 p-4">
                <p className="text-xs uppercase font-black tracking-wide text-cyan-600">Cabezas agendadas</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{earningsSummary.heads_count || 0}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[2rem] border-4 border-cyan-100 bg-cyan-50 p-10 text-center font-bold text-cyan-700">Cargando establecimientos...</div>
          ) : items.length === 0 ? (
            <div className="rounded-[2rem] border-4 border-dashed border-cyan-200 bg-cyan-50 p-10 text-center font-bold text-cyan-700">No hay registros enviados por vendedores.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                <p className="text-sm font-bold text-gray-600">Mostrando {visibleRangeStart}-{visibleRangeEnd} de {items.length} establecimientos</p>
                <p className="text-xs font-black uppercase tracking-wide text-cyan-600">Pagina {currentPage}</p>
              </div>

              {paginatedItems.map((item) => {
                const status = statusConfig[item.status] || statusConfig.pending_review;
                return (
                  <div key={item.id} className={`rounded-[2rem] border-4 p-5 shadow-sm ${status.card}`}>
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-white/90 flex items-center justify-center shadow-sm">
                            <Building2 className="w-6 h-6 text-cyan-600" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                            <p className="text-sm font-bold text-gray-600">{item.contact_name}</p>
                          </div>
                        </div>
                        <p className="text-xs font-bold text-gray-500">Vendedor: {item.seller?.name || 'Sin dato'} • {new Date(item.created_at).toLocaleString('es-CO')}</p>
                        <p className="text-sm font-semibold text-gray-700">Usuario de acceso: {item.referred_user?.email || item.email || 'No registrado'}</p>
                      </div>

                      <div className="flex flex-col items-start lg:items-end gap-3">
                        <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${status.badge}`}>{status.label}</span>
                        <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                          <Button type="button" onClick={() => setSelectedReferral(item)} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold"><Eye className="w-4 h-4 mr-2" />Ver detalle</Button>
                          {item.booking_link && <Button type="button" onClick={() => copyBookingLink(item.booking_link)} className="bg-sky-500 hover:bg-sky-600 text-white rounded-xl px-4 py-2 font-bold"><Copy className="w-4 h-4 mr-2" />Copiar link</Button>}
                          {item.status === 'pending_review' && (
                            <>
                              <Button type="button" onClick={() => { setReviewTarget(item); setReviewNotes(''); setApproveDialogOpen(true); }} className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 font-bold"><CheckCircle2 className="w-4 h-4 mr-2" />Aceptar</Button>
                              <Button type="button" onClick={() => { setReviewTarget(item); setReviewNotes(''); setRejectDialogOpen(true); }} className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 font-bold"><X className="w-4 h-4 mr-2" />Rechazar</Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <Pagination currentPage={currentPage} totalItems={items.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} colorScheme="cyan" />
            </div>
          )}
        </TabsContent>

        <TabsContent value="visits" className="space-y-6">
          {!supportsSellerVisits ? (
            <div className="rounded-[2rem] border-4 border-amber-200 bg-amber-50 p-8 text-center space-y-3">
              <p className="text-xl font-black text-amber-700">Historial de visitas no disponible</p>
              <p className="text-sm font-bold text-amber-800">El backend configurado para esta sesion todavia no expone la ruta `seller-visits`. La gestion de establecimientos seguira funcionando.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs uppercase tracking-wide font-black text-orange-600">Total visitas</p>
                  <p className="text-3xl font-black text-gray-800 mt-2">{visitsSummary.total}</p>
                </div>
                <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs uppercase tracking-wide font-black text-orange-600">Este mes</p>
                  <p className="text-3xl font-black text-gray-800 mt-2">{visitsSummary.thisMonth}</p>
                </div>
                <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs uppercase tracking-wide font-black text-orange-600">Con foto</p>
                  <p className="text-3xl font-black text-gray-800 mt-2">{visitsSummary.withPhoto}</p>
                </div>
                <div className="rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs uppercase tracking-wide font-black text-orange-600">Vendedores activos</p>
                  <p className="text-3xl font-black text-gray-800 mt-2">{visitsSummary.sellers}</p>
                </div>
              </div>

              {loading ? (
                <div className="rounded-[2rem] border-4 border-orange-100 bg-orange-50 p-10 text-center font-bold text-orange-700">Cargando visitas...</div>
              ) : visits.length === 0 ? (
                <div className="rounded-[2rem] border-4 border-dashed border-orange-200 bg-orange-50 p-10 text-center font-bold text-orange-700">Todavia no hay visitas registradas por vendedores.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                    <p className="text-sm font-bold text-gray-600">Mostrando {visibleVisitStart}-{visibleVisitEnd} de {visits.length} visitas</p>
                    <p className="text-xs font-black uppercase tracking-wide text-orange-600">Pagina {visitsPage}</p>
                  </div>

                  {paginatedVisits.map((item) => (
                    <div key={item.id} className="rounded-[2rem] border-4 border-orange-100 bg-orange-50/70 p-5 shadow-sm">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {item.place_photo_url ? (
                            <img src={item.place_photo_url} alt={item.business_name} className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-200 bg-white flex-shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-orange-200 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-6 h-6 text-orange-400" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-lg font-black text-gray-800">{item.business_name}</p>
                            <p className="text-sm font-bold text-gray-600">{item.owner_name || 'Dueno sin registrar'}</p>
                            <p className="text-xs font-bold text-gray-500">Vendedor: {item.seller?.name || 'Sin dato'} • {new Date(item.created_at).toLocaleString('es-CO')}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={() => setSelectedVisit(item)} className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2 font-bold"><Eye className="w-4 h-4 mr-2" />Ver detalle</Button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                        <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 text-orange-600" /><div><p>{item.whatsapp || 'Sin WhatsApp registrado'}</p><p className="text-xs text-gray-500 mt-1">Contacto del negocio</p></div></div>
                        <div className="bg-white rounded-xl border border-orange-100 p-3 flex items-start gap-2"><Users className="w-4 h-4 mt-0.5 text-orange-600" /><div><p>{item.seller?.name || 'Sin vendedor asignado'}</p><p className="text-xs text-gray-500 mt-1">Responsable del registro</p></div></div>
                      </div>
                    </div>
                  ))}

                  <Pagination currentPage={visitsPage} totalItems={visits.length} itemsPerPage={itemsPerPage} onPageChange={setVisitsPage} colorScheme="orange" />
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedReferral)} onOpenChange={(open) => !open && setSelectedReferral(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-cyan-400 p-0 overflow-hidden sm:max-w-2xl bg-cyan-50 shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Detalle del referido</DialogTitle></DialogHeader>
          {selectedReferral && (
            <div className="max-h-[80vh] overflow-y-auto p-6 md:p-8 space-y-4">
              <div className="text-center"><h2 className="text-2xl font-black text-cyan-600 uppercase tracking-wide">Detalle del Referido</h2></div>
              <div className="bg-white rounded-2xl border-2 border-cyan-200 p-4"><p className="text-xl font-black text-gray-800">{selectedReferral.business_name}</p><p className="text-sm font-bold text-gray-600 mt-1">Contacto: {selectedReferral.contact_name}</p><p className="text-xs font-bold text-gray-500 mt-2">Vendedor: {selectedReferral.seller?.name || 'Sin dato'}</p></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Email: <span className="font-bold text-gray-900">{selectedReferral.referred_user?.email || selectedReferral.email || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">WhatsApp: <span className="font-bold text-gray-900">{selectedReferral.whatsapp || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Telefono: <span className="font-bold text-gray-900">{selectedReferral.phone || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Ciudad: <span className="font-bold text-gray-900">{selectedReferral.city || 'No registrada'}</span></div>
                <div className="bg-white rounded-xl border-2 border-cyan-100 p-3 md:col-span-2">Direccion: <span className="font-bold text-gray-900">{selectedReferral.address || 'No registrada'}</span></div>
                {selectedReferral.booking_link && <div className="bg-white rounded-xl border-2 border-cyan-100 p-3 md:col-span-2">Link: <span className="font-bold text-gray-900 break-all">{buildBookingUrl(selectedReferral.booking_link)}</span></div>}
              </div>
              <div className="flex flex-wrap gap-3">
                {selectedReferral.chamber_of_commerce_url && <a href={selectedReferral.chamber_of_commerce_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700 hover:bg-cyan-100"><FileText className="w-4 h-4" />Ver Camara de Comercio</a>}
                {selectedReferral.rut_url && <a href={selectedReferral.rut_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700 hover:bg-cyan-100"><FileText className="w-4 h-4" />Ver RUT</a>}
                {selectedReferral.booking_link && <Button type="button" onClick={() => copyBookingLink(selectedReferral.booking_link)} className="rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-3 text-sm font-black"><Copy className="w-4 h-4 mr-2" />Copiar link</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedVisit)} onOpenChange={(open) => !open && setSelectedVisit(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-orange-400 p-0 overflow-hidden sm:max-w-2xl bg-orange-50 shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Detalle de la visita</DialogTitle></DialogHeader>
          {selectedVisit && (
            <div className="max-h-[80vh] overflow-y-auto p-6 md:p-8 space-y-4">
              <div className="text-center"><h2 className="text-2xl font-black text-orange-600 uppercase tracking-wide">Detalle de la Visita</h2></div>
              {selectedVisit.place_photo_url && (
                <div className="bg-white rounded-2xl border-2 border-orange-200 p-4">
                  <img src={selectedVisit.place_photo_url} alt={selectedVisit.business_name} className="w-full h-56 object-cover rounded-2xl" />
                </div>
              )}
              <div className="bg-white rounded-2xl border-2 border-orange-200 p-4">
                <p className="text-xl font-black text-gray-800">{selectedVisit.business_name}</p>
                <p className="text-sm font-bold text-gray-600 mt-1">Dueño: {selectedVisit.owner_name || 'No registrado'}</p>
                <p className="text-xs font-bold text-gray-500 mt-2">Vendedor: {selectedVisit.seller?.name || 'Sin dato'}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3">WhatsApp: <span className="font-bold text-gray-900">{selectedVisit.whatsapp || 'No registrado'}</span></div>
                <div className="bg-white rounded-xl border-2 border-orange-100 p-3">Fecha del registro: <span className="font-bold text-gray-900">{selectedVisit.created_at ? new Date(selectedVisit.created_at).toLocaleString('es-CO') : 'No registrada'}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 overflow-hidden sm:max-w-md bg-green-50 shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Aprobar referido</DialogTitle></DialogHeader>
          <div className="px-8 py-8 space-y-5">
            <h2 className="text-2xl font-black text-green-600 uppercase text-center">Aprobar Referido</h2>
            <p className="text-center text-gray-700 font-medium">Confirma si la documentacion esta correcta.</p>
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="w-full bg-white border-2 border-green-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-green-500 resize-none" rows="3" placeholder="Observacion para el vendedor" />
            <div className="flex gap-4">
              <Button type="button" onClick={() => { setApproveDialogOpen(false); setReviewTarget(null); setReviewNotes(''); }} className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all">Cancelar</Button>
              <Button type="button" onClick={() => submitReview('approved')} className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all">Si, aprobar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden sm:max-w-md bg-red-50 shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Rechazar referido</DialogTitle></DialogHeader>
          <div className="px-8 py-8 space-y-5">
            <h2 className="text-2xl font-black text-red-600 uppercase text-center">Rechazar Referido</h2>
            <p className="text-center text-gray-700 font-medium">Confirma si la documentacion debe ser rechazada.</p>
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="w-full bg-white border-2 border-red-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-red-500 resize-none" rows="3" placeholder="Explica al vendedor el motivo del rechazo" />
            <div className="flex gap-4">
              <Button type="button" onClick={() => { setRejectDialogOpen(false); setReviewTarget(null); setReviewNotes(''); }} className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all">Cancelar</Button>
              <Button type="button" onClick={() => submitReview('rejected')} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all">Si, rechazar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

SellerReferralsModule.displayName = 'SellerReferralsModule';

export default SellerReferralsModule;
