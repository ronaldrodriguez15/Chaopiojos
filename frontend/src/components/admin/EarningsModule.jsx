import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  DollarSign,
  Eye,
  RefreshCw,
  RotateCcw,
  Scissors,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Pagination from './Pagination';
import { sellerReferralService, settingsService } from '@/lib/api';
import { formatTime12Hour } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;
const EARNINGS_TAB_KEY = 'adminEarningsTab';
const DEFAULT_TIERS = [
  { from: 1, to: 20, value: 5000 },
  { from: 21, to: 40, value: 7000 },
  { from: 41, to: null, value: 100000 },
];

const money = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const heads = (item) => Math.max(1, Number(item?.numPersonas || 1));

const normalizeStatus = (value) => {
  const status = String(value || '').toLowerCase();
  return ({
    pendiente: 'pending',
    pending: 'pending',
    asignado: 'assigned',
    assigned: 'assigned',
    confirmado: 'assigned',
    aceptado: 'accepted',
    accepted: 'accepted',
    completado: 'completed',
    completed: 'completed',
  }[status] || 'pending');
};

const parseDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const tierFor = (position, tiers) => {
  const source = Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS;
  return source.find((tier) => position >= Number(tier.from || 1) && (tier.to === null || position <= Number(tier.to))) || source[source.length - 1];
};

const partnerRows = (items, tiers) => {
  const counters = new Map();
  return [...items]
    .sort((a, b) => (a.serviceDate?.getTime() || 0) - (b.serviceDate?.getTime() || 0))
    .map((item) => {
      const key = monthKey(item.serviceDate || new Date());
      const position = (counters.get(key) || 0) + 1;
      counters.set(key, position);
      const tier = tierFor(position, tiers);
      return { amount: money(tier?.value), completed: item.status === 'completed' };
    });
};

const SummaryCard = ({ label, value, helper, tone, icon: Icon }) => (
  <div className={`rounded-2xl border-2 p-4 ${tone}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide font-black opacity-70">{label}</p>
        <p className="text-2xl font-black mt-2">{value}</p>
        {helper ? <p className="text-xs font-bold mt-2 opacity-80">{helper}</p> : null}
      </div>
      <div className="w-11 h-11 rounded-2xl bg-white/90 shadow-sm flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

const EmptyState = ({ text, tone = 'border-slate-200 bg-slate-50 text-slate-500' }) => (
  <div className={`rounded-2xl border-2 border-dashed p-8 text-center font-bold ${tone}`}>
    {text}
  </div>
);

const EarningsModule = React.memo(({
  piojologists,
  appointments,
  users,
  serviceCatalog = {},
  referralPayouts = [],
  referralCommissionsList = [],
  getServicePrice,
  formatCurrency,
  handleMarkServiceAsPaid,
  handleRevertServicePayment,
  openPayDialog,
  setOpenPayDialog,
  openHistoryDialog,
  setOpenHistoryDialog,
}) => {
  const [earningsTab, setEarningsTab] = useState(() => localStorage.getItem(EARNINGS_TAB_KEY) || 'piojologas');
  const [pages, setPages] = useState({ piojologas: 1, vendedores: 1, establecimientos: 1 });
  const [confirmPayment, setConfirmPayment] = useState(null);
  const [confirmRevertPayment, setConfirmRevertPayment] = useState(null);
  const [sellerReferrals, setSellerReferrals] = useState([]);
  const [sellerEarnings, setSellerEarnings] = useState([]);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [warning, setWarning] = useState('');

  const updatePage = useCallback((tab, page) => {
    setPages((current) => ({ ...current, [tab]: page }));
  }, []);

  const loadExtraData = useCallback(async () => {
    setLoadingExtra(true);
    try {
      const [referralsResult, earningsResult, settingsResult] = await Promise.all([
        sellerReferralService.getAll(),
        sellerReferralService.getEarnings(),
        settingsService.getBookingSettings(),
      ]);

      const failures = [];
      if (referralsResult.success) setSellerReferrals(referralsResult.referrals || []);
      else failures.push(referralsResult.message || 'No se pudieron cargar los establecimientos');

      if (earningsResult.success) setSellerEarnings(earningsResult.sellers || []);
      else failures.push(earningsResult.message || 'No se pudieron cargar las ganancias de vendedores');

      if (settingsResult.success) setTiers(settingsResult.settings?.partnerCommissionTiers || DEFAULT_TIERS);
      else failures.push(settingsResult.message || 'No se pudo cargar la configuración de tramos');

      setWarning(failures[0] || '');
    } catch {
      setWarning('No se pudieron cargar las ganancias de vendedores y establecimientos');
    } finally {
      setLoadingExtra(false);
    }
  }, []);

  useEffect(() => {
    loadExtraData();
  }, [loadExtraData]);

  const services = useMemo(() => appointments.map((item, index) => ({
    ...item,
    id: item?.id ?? item?.backendId ?? `service-${index}`,
    serviceDate: parseDate(item?.date || item?.fecha || item?.created_at),
    revenue: money(typeof getServicePrice === 'function' ? getServicePrice(item) : item?.price_confirmed ?? item?.price ?? item?.estimatedPrice),
    heads: heads(item),
    status: normalizeStatus(item?.status || item?.estado),
    piojologistId: item?.piojologistId ?? item?.piojologist_id ?? null,
    paymentStatusToPiojologist: item?.payment_status_to_piojologist || item?.paymentStatusToPiojologist || 'pending',
    sellerReferralId: item?.seller_referral_id ?? item?.sellerReferralId ?? item?.seller_referral?.id ?? null,
    sellerReferralName: item?.seller_referral_name || item?.seller_referral?.business_name || '',
    sellerName: item?.seller_referral?.seller?.name || '',
  })), [appointments, getServicePrice]);

  const referralByPiojologist = useMemo(() => (
    (referralPayouts || []).reduce((acc, item) => {
      const id = Number(item.id);
      if (!Number.isFinite(id)) return acc;
      acc[id] = {
        pending: money(item.pending_amount),
        paid: money(item.total_earned),
        count: Number(item.total_commissions_count || 0),
      };
      return acc;
    }, {})
  ), [referralPayouts]);

  const referralCountsBySeller = useMemo(() => (
    sellerReferrals.reduce((acc, item) => {
      const id = Number(item?.seller_user_id || item?.seller?.id);
      if (!Number.isFinite(id)) return acc;
      acc[id] = acc[id] || { total: 0, approved: 0, pending: 0, rejected: 0 };
      acc[id].total += 1;
      acc[id][item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'] += 1;
      return acc;
    }, {})
  ), [sellerReferrals]);

  const servicesByReferral = useMemo(() => {
    const groups = new Map();
    services.forEach((item) => {
      const key = item.sellerReferralId ? `id:${Number(item.sellerReferralId)}` : item.sellerReferralName ? `name:${String(item.sellerReferralName).toLowerCase().trim()}` : null;
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return groups;
  }, [services]);

  const getServiceCommissionBreakdown = useCallback((apt = {}, commissionRate = 0.5) => {
    const servicesPerPerson = Array.isArray(apt.services_per_person) ? apt.services_per_person : [];
    if (servicesPerPerson.length > 0) {
      const confirmedTotal = Number(getServicePrice(apt) || 0);
      const catalogPrices = servicesPerPerson.map((serviceName) => Number(serviceCatalog?.[serviceName] || 0));
      const catalogTotal = catalogPrices.reduce((acc, value) => acc + value, 0);
      const resolvedPrices = (() => {
        if (confirmedTotal > 0 && catalogTotal > 0) return catalogPrices.map((value) => (value / catalogTotal) * confirmedTotal);
        if (catalogTotal > 0) return catalogPrices;
        const fallbackPerPerson = servicesPerPerson.length > 0 ? confirmedTotal / servicesPerPerson.length : 0;
        return servicesPerPerson.map(() => fallbackPerPerson);
      })();

      return servicesPerPerson.map((serviceName, idx) => {
        const basePrice = Number(resolvedPrices[idx] || 0);
        return { idx, serviceName, basePrice, commission: basePrice * commissionRate };
      });
    }

    const fallbackPrice = Number(getServicePrice(apt) || 0);
    return [{ idx: 0, serviceName: apt.serviceType || 'Servicio', basePrice: fallbackPrice, commission: fallbackPrice * commissionRate }];
  }, [getServicePrice, serviceCatalog]);

  const getPiojologistShareByService = useCallback((apt = {}, commissionRate = 0.5) => (
    getServiceCommissionBreakdown(apt, commissionRate).reduce((sum, item) => sum + Number(item.commission || 0), 0)
  ), [getServiceCommissionBreakdown]);

  const piojologistRows = useMemo(() => piojologists.map((piojologist) => {
    const completedServices = services.filter((item) => Number(item.piojologistId) === Number(piojologist.id) && item.status === 'completed');
    const commissionRate = (piojologist.commission_rate || 50) / 100;
    const referralData = referralByPiojologist[Number(piojologist.id)] || { pending: 0, paid: 0, count: 0 };

    let pendingServices = 0;
    let paidServices = 0;
    let pendingCount = 0;

    completedServices.forEach((apt) => {
      const share = getPiojologistShareByService(apt, commissionRate);
      if ((apt.paymentStatusToPiojologist || apt.payment_status_to_piojologist || 'pending') === 'paid') paidServices += share;
      else {
        pendingServices += share;
        pendingCount += 1;
      }
    });

    return {
      id: piojologist.id,
      name: piojologist.name,
      rate: piojologist.commission_rate || 50,
      completedServices,
      pendingServices,
      paidServices,
      pendingCount,
      pendingPayment: pendingServices + referralData.pending,
      paidTotal: paidServices + referralData.paid,
      referralPending: referralData.pending,
      referralPaid: referralData.paid,
    };
  }).sort((a, b) => b.pendingPayment - a.pendingPayment || b.paidTotal - a.paidTotal), [getPiojologistShareByService, piojologists, referralByPiojologist, services]);

  const piojologistSummary = useMemo(() => ({
    pendingServicesCount: piojologistRows.reduce((sum, item) => sum + item.pendingCount, 0),
    totalFactured: piojologistRows.reduce((sum, item) => sum + item.completedServices.reduce((acc, service) => acc + service.revenue, 0), 0),
    pendingServices: piojologistRows.reduce((sum, item) => sum + item.pendingServices, 0),
    pendingReferrals: piojologistRows.reduce((sum, item) => sum + item.referralPending, 0),
    paidServices: piojologistRows.reduce((sum, item) => sum + item.paidServices, 0),
    paidReferrals: piojologistRows.reduce((sum, item) => sum + item.referralPaid, 0),
  }), [piojologistRows]);

  const sellerUsers = useMemo(() => users.filter((user) => user.role === 'vendedor'), [users]);

  const sellerRows = useMemo(() => {
    const summaryBySeller = new Map(sellerEarnings.map((item) => [Number(item?.seller?.id), item]));
    const sellerMap = new Map();

    sellerUsers.forEach((user) => {
      sellerMap.set(Number(user.id), {
        id: user.id,
        name: user.name || 'Vendedor',
        email: user.email || 'Sin correo',
        code: user.referral_code || 'Sin código',
      });
    });

    sellerEarnings.forEach((item, index) => {
      const id = Number(item?.seller?.id);
      if (!Number.isFinite(id)) {
        sellerMap.set(`extra-${index}`, {
          id: `extra-${index}`,
          name: item?.seller?.name || 'Vendedor',
          email: item?.seller?.email || 'Sin correo',
          code: item?.seller?.referral_code || 'Sin código',
        });
        return;
      }
      if (!sellerMap.has(id)) {
        sellerMap.set(id, {
          id,
          name: item?.seller?.name || 'Vendedor',
          email: item?.seller?.email || 'Sin correo',
          code: item?.seller?.referral_code || 'Sin código',
        });
      }
    });

    return [...sellerMap.values()].map((seller) => {
      const summary = summaryBySeller.get(Number(seller.id));
      const counts = referralCountsBySeller[Number(seller.id)] || { total: 0, approved: 0, pending: 0, rejected: 0 };
      return {
        ...seller,
        perHead: money(summary?.seller?.effective_referral_value ?? summary?.summary?.per_head_value),
        total: money(summary?.summary?.total_amount),
        pending: money(summary?.summary?.pending_amount),
        paid: money(summary?.summary?.paid_amount),
        bookings: Number(summary?.summary?.bookings_count || 0),
        heads: Number(summary?.summary?.heads_count || 0),
        referrals: counts.total,
        approved: Number(summary?.summary?.approved_referrals || counts.approved),
        pendingReferrals: counts.pending,
        rejected: counts.rejected,
      };
    }).sort((a, b) => b.total - a.total || b.pending - a.pending || b.referrals - a.referrals);
  }, [referralCountsBySeller, sellerEarnings, sellerUsers]);

  const sellerSummary = useMemo(() => ({
    sellers: sellerRows.length,
    total: sellerRows.reduce((sum, item) => sum + item.total, 0),
    pending: sellerRows.reduce((sum, item) => sum + item.pending, 0),
    paid: sellerRows.reduce((sum, item) => sum + item.paid, 0),
    bookings: sellerRows.reduce((sum, item) => sum + item.bookings, 0),
    approved: sellerRows.reduce((sum, item) => sum + item.approved, 0),
  }), [sellerRows]);

  const establishmentRows = useMemo(() => sellerReferrals.map((item) => {
    const rows = servicesByReferral.get(`id:${Number(item.id)}`) || [];
    const commissions = partnerRows(rows, tiers);
    const estimatedTotal = commissions.reduce((sum, row) => sum + row.amount, 0);
    const pendingEstimated = commissions.filter((row) => !row.completed).reduce((sum, row) => sum + row.amount, 0);

    return {
      id: item.id,
      name: item.business_name || 'Establecimiento',
      seller: item.seller?.name || 'Sin vendedor',
      contact: item.contact_name || item.owner_name || item.email || 'Sin contacto',
      city: item.city || 'Sin ciudad',
      status: item.status || 'pending_review',
      bookings: rows.length,
      heads: rows.reduce((sum, row) => sum + row.heads, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      estimatedTotal,
      pendingEstimated,
      confirmedEstimated: Math.max(0, estimatedTotal - pendingEstimated),
      hasLink: Boolean(item.booking_link),
      hasDocuments: Boolean(item.chamber_of_commerce_url && item.rut_url),
    };
  }).sort((a, b) => b.estimatedTotal - a.estimatedTotal || b.bookings - a.bookings), [sellerReferrals, servicesByReferral, tiers]);

  const establishmentSummary = useMemo(() => ({
    total: establishmentRows.length,
    approved: establishmentRows.filter((item) => item.status === 'approved').length,
    bookings: establishmentRows.reduce((sum, item) => sum + item.bookings, 0),
    revenue: establishmentRows.reduce((sum, item) => sum + item.revenue, 0),
    estimated: establishmentRows.reduce((sum, item) => sum + item.estimatedTotal, 0),
    pending: establishmentRows.reduce((sum, item) => sum + item.pendingEstimated, 0),
  }), [establishmentRows]);

  const paginatedPiojologists = piojologistRows.slice((pages.piojologas - 1) * ITEMS_PER_PAGE, pages.piojologas * ITEMS_PER_PAGE);
  const paginatedSellers = sellerRows.slice((pages.vendedores - 1) * ITEMS_PER_PAGE, pages.vendedores * ITEMS_PER_PAGE);
  const paginatedEstablishments = establishmentRows.slice((pages.establecimientos - 1) * ITEMS_PER_PAGE, pages.establecimientos * ITEMS_PER_PAGE);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(piojologistRows.length / ITEMS_PER_PAGE));
    if (pages.piojologas > max) updatePage('piojologas', max);
  }, [pages.piojologas, piojologistRows.length, updatePage]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(sellerRows.length / ITEMS_PER_PAGE));
    if (pages.vendedores > max) updatePage('vendedores', max);
  }, [pages.vendedores, sellerRows.length, updatePage]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(establishmentRows.length / ITEMS_PER_PAGE));
    if (pages.establecimientos > max) updatePage('establecimientos', max);
  }, [establishmentRows.length, pages.establecimientos, updatePage]);

  const piojologistLookup = useMemo(() => new Map(piojologists.map((item) => [Number(item.id), item])), [piojologists]);

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-green-100 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
            <span className="text-3xl">💰</span>
            Control de Ganancias
          </h3>
          <p className="text-sm font-bold text-gray-500 mt-2">Pestañas separadas para piojólogas, vendedores y establecimientos.</p>
        </div>
        <Button type="button" onClick={loadExtraData} className="bg-green-500 hover:bg-green-600 text-white rounded-2xl px-5 py-3 font-black self-start">
          <RefreshCw className={`w-4 h-4 mr-2 ${loadingExtra ? 'animate-spin' : ''}`} />
          Recargar
        </Button>
      </div>

      {warning ? <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">{warning}</div> : null}

      <Tabs value={earningsTab} onValueChange={(value) => { setEarningsTab(value); localStorage.setItem(EARNINGS_TAB_KEY, value); }} className="space-y-6">
        <TabsList className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-2 border-slate-200 rounded-2xl p-2 h-auto gap-2">
          <TabsTrigger value="piojologas" className="rounded-xl py-3 font-black data-[state=active]:bg-green-500 data-[state=active]:text-white">Piojólogas</TabsTrigger>
          <TabsTrigger value="vendedores" className="rounded-xl py-3 font-black data-[state=active]:bg-violet-500 data-[state=active]:text-white">Vendedores</TabsTrigger>
          <TabsTrigger value="establecimientos" className="rounded-xl py-3 font-black data-[state=active]:bg-cyan-500 data-[state=active]:text-white">Establecimientos</TabsTrigger>
        </TabsList>

        <TabsContent value="piojologas" className="space-y-5">
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 md:p-5 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-green-600">Submódulo</p>
              <h4 className="text-xl font-black text-green-800">Piojólogas</h4>
              <p className="text-sm font-bold text-green-700">Pagos por servicios completados y bonos por referidos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard label="Pendientes" value={piojologistSummary.pendingServicesCount} helper="servicios por pagar" tone="bg-white border-amber-200 text-amber-700" icon={Scissors} />
              <SummaryCard label="Facturado" value={formatCurrency(piojologistSummary.totalFactured)} helper="servicios completados" tone="bg-white border-blue-200 text-blue-700" icon={DollarSign} />
              <SummaryCard label="Pendiente de pago" value={formatCurrency(piojologistSummary.pendingServices + piojologistSummary.pendingReferrals)} helper={`Servicios ${formatCurrency(piojologistSummary.pendingServices)} | Referidos ${formatCurrency(piojologistSummary.pendingReferrals)}`} tone="bg-white border-red-200 text-red-700" icon={TrendingUp} />
              <SummaryCard label="Ya pagado" value={formatCurrency(piojologistSummary.paidServices + piojologistSummary.paidReferrals)} helper={`Servicios ${formatCurrency(piojologistSummary.paidServices)} | Referidos ${formatCurrency(piojologistSummary.paidReferrals)}`} tone="bg-white border-green-200 text-green-700" icon={Wallet} />
            </div>

            {piojologistRows.length === 0 ? (
              <EmptyState text="No hay piojólogas con información de ganancias." tone="border-green-200 bg-white text-green-700" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-green-100">
                        <th className="p-4 font-black text-gray-400">Piojóloga</th>
                        <th className="p-4 font-black text-gray-400 text-center">Comisión</th>
                        <th className="p-4 font-black text-gray-400 text-center">Pendientes</th>
                        <th className="p-4 font-black text-gray-400 text-right">Pendiente Pago</th>
                        <th className="p-4 font-black text-gray-400 text-right">Ya Pagado</th>
                        <th className="p-4 font-black text-gray-400 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPiojologists.map((piojologist) => (
                        <tr key={piojologist.id} className="border-b border-green-50 last:border-0 hover:bg-white/70 transition-colors">
                          <td className="p-4 font-bold text-gray-700">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-green-200 text-green-700 flex items-center justify-center text-sm font-black">
                                {String(piojologist.name || '?').charAt(0)}
                              </div>
                              <div>
                                <p>{piojologist.name}</p>
                                <p className="text-xs text-gray-500 font-bold mt-1">{piojologist.completedServices.length} servicios completados</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-bold text-sm">{piojologist.rate}%</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-xl font-black">{piojologist.pendingCount}</span>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-red-600">{formatCurrency(piojologist.pendingPayment)}</span>
                            <p className="text-[11px] text-gray-600 font-bold mt-1">Servicios: {formatCurrency(piojologist.pendingServices)}</p>
                            <p className="text-[11px] text-purple-600 font-bold mt-1">Referidos: {formatCurrency(piojologist.referralPending)}</p>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-green-600">{formatCurrency(piojologist.paidTotal)}</span>
                            <p className="text-[11px] text-gray-600 font-bold mt-1">Servicios: {formatCurrency(piojologist.paidServices)}</p>
                            <p className="text-[11px] text-purple-600 font-bold mt-1">Referidos: {formatCurrency(piojologist.referralPaid)}</p>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {(piojologist.pendingCount > 0 || piojologist.referralPending > 0) && (
                                <Button size="icon" variant="ghost" onClick={() => setOpenPayDialog(piojologist.id)} className="h-10 w-10 rounded-xl bg-green-100 text-green-600 hover:bg-green-200" title="Pagar y ver detalle">
                                  <DollarSign className="w-5 h-5" />
                                </Button>
                              )}
                              {piojologist.completedServices.length > 0 && (
                                <Button size="icon" variant="ghost" onClick={() => setOpenHistoryDialog(piojologist.id)} className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200" title="Ver historial">
                                  <Eye className="w-5 h-5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination currentPage={pages.piojologas} totalItems={piojologistRows.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={(page) => updatePage('piojologas', page)} colorScheme="green" />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="vendedores" className="space-y-5">
          <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 md:p-5 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-violet-600">Submódulo</p>
              <h4 className="text-xl font-black text-violet-800">Vendedores</h4>
              <p className="text-sm font-bold text-violet-700">Ganancias por links, reservas generadas y estado de sus establecimientos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard label="Vendedores" value={sellerSummary.sellers} helper={`${sellerSummary.approved} establecimientos aprobados`} tone="bg-white border-violet-200 text-violet-700" icon={Users} />
              <SummaryCard label="Total generado" value={formatCurrency(sellerSummary.total)} helper={`${sellerSummary.bookings} reservas`} tone="bg-white border-purple-200 text-purple-700" icon={DollarSign} />
              <SummaryCard label="Pendiente" value={formatCurrency(sellerSummary.pending)} helper="por confirmar o pagar" tone="bg-white border-amber-200 text-amber-700" icon={TrendingUp} />
              <SummaryCard label="Pagado" value={formatCurrency(sellerSummary.paid)} helper="ganancias ya liquidadas" tone="bg-white border-emerald-200 text-emerald-700" icon={Wallet} />
            </div>

            {loadingExtra && sellerRows.length === 0 ? (
              <EmptyState text="Cargando ganancias de vendedores..." tone="border-violet-200 bg-white text-violet-700" />
            ) : sellerRows.length === 0 ? (
              <EmptyState text="No hay vendedores con información de ganancias." tone="border-violet-200 bg-white text-violet-700" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-violet-100">
                        <th className="p-4 font-black text-gray-400">Vendedor</th>
                        <th className="p-4 font-black text-gray-400 text-center">Links</th>
                        <th className="p-4 font-black text-gray-400 text-center">Reservas</th>
                        <th className="p-4 font-black text-gray-400 text-right">Pendiente</th>
                        <th className="p-4 font-black text-gray-400 text-right">Pagado</th>
                        <th className="p-4 font-black text-gray-400 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSellers.map((seller) => (
                        <tr key={seller.id} className="border-b border-violet-50 last:border-0 hover:bg-white/70 transition-colors">
                          <td className="p-4">
                            <div className="space-y-1">
                              <p className="font-bold text-gray-700">{seller.name}</p>
                              <p className="text-xs font-bold text-gray-500">{seller.email}</p>
                              <p className="text-xs font-black text-violet-600">Código: {seller.code}</p>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="space-y-1">
                              <p className="font-black text-violet-700">{seller.referrals}</p>
                              <p className="text-[11px] font-bold text-gray-500">Aprobados {seller.approved} | Pendientes {seller.pendingReferrals}</p>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="space-y-1">
                              <p className="font-black text-gray-800">{seller.bookings}</p>
                              <p className="text-[11px] font-bold text-gray-500">{seller.heads} cabezas</p>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-amber-600">{formatCurrency(seller.pending)}</span>
                            <p className="text-[11px] font-bold text-gray-500 mt-1">Valor/cabeza {formatCurrency(seller.perHead)}</p>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-green-600">{formatCurrency(seller.paid)}</span>
                            <p className="text-[11px] font-bold text-gray-500 mt-1">Rechazados {seller.rejected}</p>
                          </td>
                          <td className="p-4 text-right font-black text-violet-700">{formatCurrency(seller.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination currentPage={pages.vendedores} totalItems={sellerRows.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={(page) => updatePage('vendedores', page)} colorScheme="purple" />
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="establecimientos" className="space-y-5">
          <div className="bg-cyan-50 border-2 border-cyan-200 rounded-2xl p-4 md:p-5 space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-cyan-600">Submódulo</p>
              <h4 className="text-xl font-black text-cyan-800">Establecimientos</h4>
              <p className="text-sm font-bold text-cyan-700">Comisión estimada generada por reservas y estado de cada establecimiento.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard label="Establecimientos" value={establishmentSummary.total} helper={`${establishmentSummary.approved} aprobados`} tone="bg-white border-cyan-200 text-cyan-700" icon={Store} />
              <SummaryCard label="Facturación" value={formatCurrency(establishmentSummary.revenue)} helper={`${establishmentSummary.bookings} reservas`} tone="bg-white border-blue-200 text-blue-700" icon={DollarSign} />
              <SummaryCard label="Comisión estimada" value={formatCurrency(establishmentSummary.estimated)} helper="calculada por tramos" tone="bg-white border-cyan-200 text-cyan-700" icon={Wallet} />
              <SummaryCard label="Pendiente estimado" value={formatCurrency(establishmentSummary.pending)} helper="servicios aún no completados" tone="bg-white border-amber-200 text-amber-700" icon={TrendingUp} />
            </div>

            {loadingExtra && establishmentRows.length === 0 ? (
              <EmptyState text="Cargando ganancias de establecimientos..." tone="border-cyan-200 bg-white text-cyan-700" />
            ) : establishmentRows.length === 0 ? (
              <EmptyState text="No hay establecimientos con información de ganancias." tone="border-cyan-200 bg-white text-cyan-700" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b-2 border-cyan-100">
                        <th className="p-4 font-black text-gray-400">Establecimiento</th>
                        <th className="p-4 font-black text-gray-400 text-center">Estado</th>
                        <th className="p-4 font-black text-gray-400 text-center">Actividad</th>
                        <th className="p-4 font-black text-gray-400 text-right">Pendiente</th>
                        <th className="p-4 font-black text-gray-400 text-right">Confirmado</th>
                        <th className="p-4 font-black text-gray-400 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEstablishments.map((item) => (
                        <tr key={item.id} className="border-b border-cyan-50 last:border-0 hover:bg-white/70 transition-colors">
                          <td className="p-4">
                            <div className="space-y-1">
                              <p className="font-bold text-gray-700">{item.name}</p>
                              <p className="text-xs font-bold text-gray-500">{item.contact} • {item.city}</p>
                              <p className="text-xs font-black text-cyan-600">Vendedor: {item.seller}</p>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide ${item.status === 'approved' ? 'bg-green-100 text-green-700' : item.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {item.status === 'approved' ? 'Aprobado' : item.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="space-y-1">
                              <p className="font-black text-gray-800">{item.bookings}</p>
                              <p className="text-[11px] font-bold text-gray-500">{item.heads} cabezas</p>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-amber-600">{formatCurrency(item.pendingEstimated)}</span>
                            <p className="text-[11px] font-bold text-gray-500 mt-1">{item.hasDocuments ? 'Docs completos' : 'Docs pendientes'}</p>
                          </td>
                          <td className="p-4 text-right">
                            <span className="font-black text-green-600">{formatCurrency(item.confirmedEstimated)}</span>
                            <p className="text-[11px] font-bold text-gray-500 mt-1">{item.hasLink ? 'Link activo' : 'Sin link'}</p>
                          </td>
                          <td className="p-4 text-right font-black text-cyan-700">{formatCurrency(item.estimatedTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination currentPage={pages.establecimientos} totalItems={establishmentRows.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={(page) => updatePage('establecimientos', page)} colorScheme="cyan" />
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!openPayDialog} onOpenChange={(open) => !open && setOpenPayDialog(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 overflow-hidden sm:max-w-2xl bg-green-50 shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Pagar servicios cobrados</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-black text-green-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
                PAGAR SERVICIOS COBRADOS
              </h2>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-4 overflow-y-auto">
            {openPayDialog && (() => {
              const piojologist = piojologistLookup.get(Number(openPayDialog));
              if (!piojologist) return <p className="text-gray-500">Piojóloga no encontrada</p>;

              const pendingReferralCommissions = (referralCommissionsList || []).filter((commission) => {
                const referrerId = Number(commission.referrer_id ?? commission.referrer?.id);
                return referrerId === Number(openPayDialog) && commission.status === 'pending';
              });

              const pendingServicesRaw = appointments.filter((appointment) =>
                appointment.piojologistId === openPayDialog
                && appointment.status === 'completed'
                && (appointment.payment_status_to_piojologist || appointment.paymentStatusToPiojologist || 'pending') === 'pending'
              );

              const seenIds = new Set();
              const pendingServices = pendingServicesRaw.filter((appointment) => {
                if (seenIds.has(appointment.id)) return false;
                seenIds.add(appointment.id);
                return true;
              });

              if (pendingServices.length === 0 && pendingReferralCommissions.length === 0) {
                return <p className="text-center text-gray-500 py-8 font-bold">No hay cobros pendientes para esta piojóloga</p>;
              }

              const commissionRate = (piojologist.commission_rate || 50) / 100;
              const pendingServicesTotal = pendingServices.reduce((sum, appointment) => sum + getPiojologistShareByService(appointment, commissionRate), 0);
              const pendingReferralsTotal = pendingReferralCommissions.reduce((sum, commission) => sum + Number(commission.commission_amount || 0), 0);
              const pendingCombinedTotal = pendingServicesTotal + pendingReferralsTotal;

              return (
                <>
                  <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 mb-4">
                    <h4 className="font-black text-gray-700 text-lg mb-2">{piojologist.name}</h4>
                    <p className="text-sm text-gray-600"><span className="font-bold">Comisión:</span> {piojologist.commission_rate || 50}%</p>
                    <p className="text-sm text-gray-600"><span className="font-bold">Servicios pendientes:</span> {pendingServices.length}</p>
                    <p className="text-sm text-gray-600"><span className="font-bold">Referidos pendientes:</span> {pendingReferralCommissions.length}</p>
                    <p className="text-sm text-gray-700 font-bold">Servicios: {formatCurrency(pendingServicesTotal)} | Referidos: {formatCurrency(pendingReferralsTotal)}</p>
                    <p className="text-base text-green-700 font-black">Total por cobrar: {formatCurrency(pendingCombinedTotal)}</p>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pendingServices.length > 0 && (
                      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                        <p className="text-sm font-black text-emerald-700">Servicios pendientes</p>
                      </div>
                    )}
                    {pendingServices.map((appointment) => {
                      const servicePrice = getServicePrice(appointment);
                      const piojologistShare = getPiojologistShareByService(appointment, commissionRate);
                      const breakdown = getServiceCommissionBreakdown(appointment, commissionRate);

                      return (
                        <div key={appointment.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-800">{appointment.clientName}</p>
                              <p className="text-sm text-gray-500">{appointment.serviceType}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-blue-700 text-sm">Servicio: {formatCurrency(servicePrice)}</p>
                              <p className="font-black text-green-600 text-lg">Comisión: {formatCurrency(piojologistShare)}</p>
                              <p className="text-xs text-gray-500">Tasa {piojologist.commission_rate || 50}%</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                            <span>{new Date(appointment.date).toLocaleDateString('es-ES')}</span>
                            <span>{formatTime12Hour(appointment.time) || 'Sin hora'}</span>
                          </div>
                          <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
                            <p className="text-[11px] font-black text-emerald-700 uppercase">Comisión por servicio</p>
                            {breakdown.map((item) => (
                              <div key={`${appointment.id}-commission-${item.idx}`} className="flex items-center justify-between text-xs font-bold text-gray-700">
                                <span>Persona {item.idx + 1}: {item.serviceName}</span>
                                <span className="text-emerald-700">{formatCurrency(item.commission)}</span>
                              </div>
                            ))}
                          </div>
                          <Button
                            onClick={() => {
                              setConfirmPayment({
                                serviceId: appointment.id,
                                piojologistId: piojologist.id,
                                piojologistName: piojologist.name,
                                amount: piojologistShare,
                                clientName: appointment.clientName,
                                serviceType: appointment.serviceType,
                                date: appointment.date,
                                time: appointment.time,
                              });
                            }}
                            className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl py-2 font-bold"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Marcar servicio como pagado
                          </Button>
                        </div>
                      );
                    })}

                    {pendingReferralCommissions.length > 0 && (
                      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 mt-4">
                        <p className="text-sm font-black text-purple-700">Referidos pendientes</p>
                        <p className="text-xs text-purple-600 font-bold">Desglose informativo de cobros por referido.</p>
                      </div>
                    )}
                    {pendingReferralCommissions.map((commission) => (
                      <div key={`ref-${commission.id}`} className="bg-white border-2 border-purple-200 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-800">{commission.booking?.clientName || 'Cliente referido'}</p>
                            <p className="text-sm text-gray-500">Comisión por referido</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-purple-600 text-lg">{formatCurrency(commission.commission_amount || 0)}</p>
                            <p className="text-xs text-purple-500 font-bold">Pendiente</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>Fecha: {commission.booking?.fecha ? new Date(commission.booking.fecha).toLocaleDateString('es-ES') : '-'}</span>
                          <span>ID #{commission.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!openHistoryDialog} onOpenChange={(open) => !open && setOpenHistoryDialog(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-blue-400 p-0 overflow-hidden sm:max-w-2xl bg-blue-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Historial de servicios</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Eye className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
                HISTORIAL DE SERVICIOS
              </h2>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            <div className="px-6 sm:px-8 pb-8 space-y-4">
              {openHistoryDialog && (() => {
                const piojologist = piojologistLookup.get(Number(openHistoryDialog));
                if (!piojologist) return <p className="text-gray-500">Piojóloga no encontrada</p>;

                const referralData = referralByPiojologist[Number(piojologist.id)] || { pending: 0, paid: 0 };
                const allServices = appointments.filter((appointment) => appointment.piojologistId === openHistoryDialog && appointment.status === 'completed');

                if (allServices.length === 0) {
                  return <p className="text-center text-gray-500 py-8 font-bold">No hay servicios completados</p>;
                }

                const commissionRate = (piojologist.commission_rate || 50) / 100;
                const paidServices = allServices.filter((appointment) => (appointment.payment_status_to_piojologist || appointment.paymentStatusToPiojologist || 'pending') === 'paid');
                const pendingServices = allServices.filter((appointment) => (appointment.payment_status_to_piojologist || appointment.paymentStatusToPiojologist || 'pending') === 'pending');

                return (
                  <>
                    <div className="bg-white p-4 rounded-2xl border-2 border-blue-400 mb-4">
                      <h4 className="font-black text-gray-700 text-lg mb-3">{piojologist.name}</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-blue-50 p-2.5 rounded-lg">
                          <span className="text-gray-600 block mb-1">Total servicios</span>
                          <span className="font-black text-base text-gray-800">{allServices.length}</span>
                        </div>
                        <div className="bg-purple-50 p-2.5 rounded-lg">
                          <span className="text-gray-600 block mb-1">Comisión</span>
                          <span className="font-black text-base text-purple-600">{piojologist.commission_rate || 50}%</span>
                        </div>
                        <div className="bg-green-50 p-2.5 rounded-lg">
                          <span className="text-gray-600 block mb-1">Pagados</span>
                          <span className="font-black text-base text-green-700">{paidServices.length}</span>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-lg">
                          <span className="text-gray-600 block mb-1">Pendientes</span>
                          <span className="font-black text-base text-amber-700">{pendingServices.length}</span>
                        </div>
                        <div className="bg-purple-50 p-2.5 rounded-lg col-span-2">
                          <span className="text-gray-600 block mb-1">Bonos referidos</span>
                          <span className="font-black text-base text-purple-700">Pendiente: {formatCurrency(referralData.pending)} | Pagado: {formatCurrency(referralData.paid)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {allServices.map((appointment) => {
                        const servicePrice = getServicePrice(appointment);
                        const piojologistShare = getPiojologistShareByService(appointment, commissionRate);
                        const isPaid = (appointment.payment_status_to_piojologist || appointment.paymentStatusToPiojologist || 'pending') === 'paid';

                        return (
                          <div key={appointment.id} className={`border-2 rounded-xl p-3 sm:p-4 ${isPaid ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{appointment.clientName}</p>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black whitespace-nowrap ${isPaid ? 'bg-green-200 text-green-800' : 'bg-amber-200 text-amber-800'}`}>
                                    {isPaid ? '✔ Pagado' : 'Pendiente'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600 truncate">{appointment.serviceType}</p>
                              </div>
                              <div className="text-right ml-2 flex-shrink-0">
                                <p className={`font-black text-base sm:text-lg ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>{formatCurrency(piojologistShare)}</p>
                                <p className="text-xs text-gray-500">Total: {formatCurrency(servicePrice)}</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500 gap-2">
                              <span>📅 {new Date(appointment.date).toLocaleDateString('es-ES')}</span>
                              <span>⏰ {formatTime12Hour(appointment.time) || 'Sin hora'}</span>
                            </div>
                            {isPaid && (
                              <div className="mt-3 pt-3 border-t border-green-200">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setConfirmRevertPayment({
                                      serviceId: appointment.id,
                                      piojologistId: piojologist.id,
                                      piojologistName: piojologist.name,
                                      amount: piojologistShare,
                                      clientName: appointment.clientName,
                                      serviceType: appointment.serviceType,
                                      date: appointment.date,
                                      time: appointment.time,
                                    });
                                  }}
                                  className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2 font-bold"
                                >
                                  <RotateCcw className="w-4 h-4 mr-2" />
                                  Revertir pago
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmPayment} onOpenChange={(open) => !open && setConfirmPayment(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 sm:max-w-md bg-green-50 shadow-2xl">
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-black text-green-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
                CONFIRMAR PAGO
              </h2>
            </div>
          </div>

          <div className="px-8 pb-8 text-center space-y-6">
            <div className="text-6xl mb-4">💵</div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">¿Confirmar pago de este servicio?</h3>
            {confirmPayment && (
              <div className="bg-white rounded-2xl p-4 border-2 border-green-400">
                <p className="text-lg font-bold text-gray-800">{confirmPayment.clientName}</p>
                <p className="text-sm text-gray-600">{confirmPayment.serviceType}</p>
                <p className="text-2xl font-black text-green-600 mt-2">{formatCurrency(confirmPayment.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">Para: {confirmPayment.piojologistName}</p>
              </div>
            )}
            <p className="text-gray-600 text-sm">Este servicio se marcará como pagado y aparecerá en el historial.</p>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmPayment(null)}
                className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!confirmPayment) return;
                  await handleMarkServiceAsPaid(
                    confirmPayment.serviceId,
                    confirmPayment.piojologistId,
                    confirmPayment.piojologistName,
                    confirmPayment.amount,
                    confirmPayment.clientName,
                    confirmPayment.serviceType,
                    confirmPayment.date,
                    formatTime12Hour(confirmPayment.time) || 'Sin hora'
                  );
                  setConfirmPayment(null);
                }}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
              >
                Sí, marcar como pagado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRevertPayment} onOpenChange={(open) => !open && setConfirmRevertPayment(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-amber-400 p-0 sm:max-w-md bg-amber-50 shadow-2xl">
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <RotateCcw className="w-6 h-6 text-amber-600" />
              <h2 className="text-2xl font-black text-amber-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
                REVERTIR PAGO
              </h2>
            </div>
          </div>

          <div className="px-8 pb-8 text-center space-y-6">
            <div className="text-6xl mb-4">↩️</div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">¿Revertir este servicio a pendiente?</h3>
            {confirmRevertPayment && (
              <div className="bg-white rounded-2xl p-4 border-2 border-amber-300">
                <p className="text-lg font-bold text-gray-800">{confirmRevertPayment.clientName}</p>
                <p className="text-sm text-gray-600">{confirmRevertPayment.serviceType}</p>
                <p className="text-2xl font-black text-amber-600 mt-2">{formatCurrency(confirmRevertPayment.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">Para: {confirmRevertPayment.piojologistName}</p>
              </div>
            )}
            <p className="text-gray-600 text-sm">Este servicio volverá al estado pendiente de pago.</p>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmRevertPayment(null)}
                className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all"
              >
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!confirmRevertPayment || typeof handleRevertServicePayment !== 'function') return;
                  await handleRevertServicePayment(
                    confirmRevertPayment.serviceId,
                    confirmRevertPayment.piojologistId,
                    confirmRevertPayment.piojologistName,
                    confirmRevertPayment.amount,
                    confirmRevertPayment.clientName,
                    confirmRevertPayment.serviceType,
                    confirmRevertPayment.date,
                    formatTime12Hour(confirmRevertPayment.time) || 'Sin hora'
                  );
                  setConfirmRevertPayment(null);
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
              >
                Sí, revertir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

EarningsModule.displayName = 'EarningsModule';

export default EarningsModule;
