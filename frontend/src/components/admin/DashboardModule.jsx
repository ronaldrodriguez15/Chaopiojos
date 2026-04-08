import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  RefreshCw,
  Search,
  Scissors,
  Store,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { referralService, sellerReferralService, settingsService } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const DEFAULT_TIERS = [
  { from: 1, to: 20, value: 5000 },
  { from: 21, to: 40, value: 7000 },
  { from: 41, to: null, value: 100000 },
];

const DASHBOARD_TAB_KEY = 'adminDashboardTab';
const DASHBOARD_FILTERS_KEY = 'adminDashboardFilters';
const DEFAULT_DASHBOARD_FILTERS = {
  establecimientos: { query: '', status: 'all', documents: 'all' },
  vendedores: { query: '', state: 'all' },
  piojologas: { query: '', availability: 'all' },
};

const ESTABLISHMENT_STATUS = {
  pending_review: { label: 'Pendiente', badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved: { label: 'Aprobado', badge: 'bg-green-100 text-green-700 border-green-200' },
  rejected: { label: 'Rechazado', badge: 'bg-red-100 text-red-700 border-red-200' },
};

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
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const money = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};
const heads = (item) => Math.max(1, Number(item?.numPersonas || 1));
const short = (value, max = 18) => {
  const label = String(value || '').trim();
  if (!label) return 'Sin dato';
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
};

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
      return { key, amount: money(tier?.value), completed: item.status === 'completed' };
    });
};

const chartOptions = (overrides = {}) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#374151', font: { family: 'Fredoka', size: 12, weight: 700 } } },
    tooltip: {
      backgroundColor: 'rgba(15,23,42,0.92)',
      padding: 12,
      titleFont: { family: 'Fredoka', size: 13, weight: 700 },
      bodyFont: { family: 'Fredoka', size: 12, weight: 600 },
      borderColor: '#E5E7EB',
      borderWidth: 1,
      borderRadius: 10,
    },
  },
  ...overrides,
});

const normalizeStatTone = (tone = '') => {
  const replacements = [
    ['bg-white border-sky-200 text-sky-700', 'from-sky-50 to-sky-100 border-sky-200 text-sky-700'],
    ['bg-white border-cyan-200 text-cyan-700', 'from-cyan-50 to-cyan-100 border-cyan-200 text-cyan-700'],
    ['bg-white border-blue-200 text-blue-700', 'from-blue-50 to-blue-100 border-blue-200 text-blue-700'],
    ['bg-white border-amber-200 text-amber-700', 'from-amber-50 to-yellow-100 border-yellow-200 text-yellow-700'],
    ['bg-white border-violet-200 text-violet-700', 'from-violet-50 to-violet-100 border-violet-200 text-violet-700'],
    ['bg-white border-purple-200 text-purple-700', 'from-purple-50 to-purple-100 border-purple-200 text-purple-700'],
    ['bg-white border-emerald-200 text-emerald-700', 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700'],
    ['bg-white border-green-200 text-green-700', 'from-green-50 to-green-100 border-green-200 text-green-700'],
    ['bg-white border-teal-200 text-teal-700', 'from-teal-50 to-teal-100 border-teal-200 text-teal-700'],
  ];

  return replacements.reduce((current, [search, next]) => current.replace(search, next), tone);
};

const StatCard = ({ label, value, helper, icon: Icon, tone }) => (
  <div className={`rounded-[1.75rem] border-4 p-4 sm:p-6 shadow-xl bg-gradient-to-br flex items-center gap-3 sm:gap-4 ${normalizeStatTone(tone)}`}>
    <div className="p-2 sm:p-3 rounded-2xl bg-white/70 border-2 border-white/60 shadow-sm">
      <Icon className="w-7 h-7 sm:w-8 sm:h-8" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-black opacity-90">{label}</p>
      <p className="text-3xl sm:text-4xl font-black leading-tight break-words mt-1">{value}</p>
      {helper ? <p className="mt-2 text-xs sm:text-sm font-bold opacity-80">{helper}</p> : null}
    </div>
  </div>
);

const ChartCard = ({ title, border, children }) => (
  <div className={`bg-white rounded-2xl p-5 shadow-sm border-2 ${border}`}>
    <h4 className="text-lg font-black text-gray-800 mb-4">{title}</h4>
    <div className="h-80">{children}</div>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center font-bold text-slate-500">
    {text}
  </div>
);

const FilterToolbar = ({
  title,
  description,
  query,
  onQueryChange,
  searchPlaceholder,
  selects = [],
  onClear,
  resultLabel,
  tone,
}) => (
  <div className={`rounded-2xl border-2 p-4 ${tone}`}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-wide opacity-70">{title}</p>
        <p className="text-sm font-bold mt-1 opacity-90">{description}</p>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:flex-wrap">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-55" />
          <input
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border-2 border-white/80 bg-white/95 py-3 pl-10 pr-4 text-sm font-bold text-slate-700 outline-none transition focus:border-white focus:ring-2 focus:ring-white/60"
          />
        </div>
        {selects.map((select) => (
          <select
            key={select.key}
            value={select.value}
            onChange={(event) => select.onChange(event.target.value)}
            className="min-w-[11rem] rounded-xl border-2 border-white/80 bg-white/95 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-white focus:ring-2 focus:ring-white/60"
          >
            {select.options.map((option) => (
              <option key={`${select.key}-${option.value}`} value={option.value}>{option.label}</option>
            ))}
          </select>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={onClear}
          className="rounded-xl border-2 border-white/80 bg-white/80 px-4 py-3 font-black text-slate-700 hover:bg-white"
        >
          <X className="w-4 h-4 mr-2" />
          Limpiar
        </Button>
      </div>
    </div>
    <p className="mt-3 text-xs font-black uppercase tracking-wide opacity-70">{resultLabel}</p>
  </div>
);

const DetailCard = ({ title, subtitle, badge, metrics, footer, children }) => (
  <div className="rounded-2xl border-2 border-slate-100 bg-white p-5 shadow-sm">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div>
        <p className="text-lg font-black text-gray-800">{title}</p>
        {subtitle ? <p className="text-sm font-bold text-gray-500 mt-1">{subtitle}</p> : null}
      </div>
      {badge || null}
    </div>
    <div className="mt-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
      {metrics.map((metric) => (
        <div key={`${title}-${metric.label}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide font-black text-slate-500">{metric.label}</p>
          <p className="text-sm font-black text-slate-800 mt-1">{metric.value}</p>
        </div>
      ))}
    </div>
    {children ? <div className="mt-4">{children}</div> : null}
    {footer ? <div className="mt-4 text-sm font-bold text-slate-500">{footer}</div> : null}
  </div>
);

const HorizontalCarousel = ({ items, getKey, renderItem, emptyText }) => {
  const trackRef = useRef(null);
  const [canGoPrev, setCanGoPrev] = useState(false);
  const [canGoNext, setCanGoNext] = useState(items.length > 1);

  const updateControls = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    setCanGoPrev(track.scrollLeft > 8);
    setCanGoNext(track.scrollLeft < maxScroll - 8);
  }, []);

  useEffect(() => {
    updateControls();
    const track = trackRef.current;
    if (!track) return undefined;

    track.addEventListener('scroll', updateControls, { passive: true });
    window.addEventListener('resize', updateControls);

    return () => {
      track.removeEventListener('scroll', updateControls);
      window.removeEventListener('resize', updateControls);
    };
  }, [items.length, updateControls]);

  const moveByCard = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * track.clientWidth,
      behavior: 'smooth',
    });
  };

  if (items.length === 0) return <EmptyState text={emptyText} />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => moveByCard(-1)}
          disabled={!canGoPrev}
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 border-2 border-slate-200 shadow-md flex items-center justify-center text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-slate-50"
          aria-label="Ver tarjeta anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          ref={trackRef}
          className="flex overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <div
              key={getKey(item)}
              data-carousel-card="true"
              className="flex-none w-full snap-center flex justify-center px-14 md:px-16"
            >
              <div className="w-full max-w-[58rem]">
                {renderItem(item)}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => moveByCard(1)}
          disabled={!canGoNext}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 border-2 border-slate-200 shadow-md flex items-center justify-center text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-slate-50"
          aria-label="Ver siguiente tarjeta"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">
        Usa las flechas laterales para avanzar tarjeta por tarjeta
      </p>
    </div>
  );
};

const readStoredFilters = () => {
  try {
    const raw = localStorage.getItem(DASHBOARD_FILTERS_KEY);
    if (!raw) return DEFAULT_DASHBOARD_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      establecimientos: { ...DEFAULT_DASHBOARD_FILTERS.establecimientos, ...(parsed?.establecimientos || {}) },
      vendedores: { ...DEFAULT_DASHBOARD_FILTERS.vendedores, ...(parsed?.vendedores || {}) },
      piojologas: { ...DEFAULT_DASHBOARD_FILTERS.piojologas, ...(parsed?.piojologas || {}) },
    };
  } catch {
    return DEFAULT_DASHBOARD_FILTERS;
  }
};

const DashboardModule = React.memo(({
  appointments = [],
  piojologists = [],
  formatCurrency,
  getServicePrice,
  focusRequest = null,
}) => {
  const { toast } = useToast();
  const [dashboardTab, setDashboardTab] = useState(() => localStorage.getItem(DASHBOARD_TAB_KEY) || 'establecimientos');
  const [filters, setFilters] = useState(readStoredFilters);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [establishments, setEstablishments] = useState([]);
  const [sellerEarnings, setSellerEarnings] = useState([]);
  const [referralHistory, setReferralHistory] = useState([]);
  const [tiers, setTiers] = useState(DEFAULT_TIERS);

  const updateFilters = useCallback((tab, patch) => {
    setFilters((current) => {
      const nextFilters = {
        ...current,
        [tab]: {
          ...current[tab],
          ...patch,
        },
      };
      localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(nextFilters));
      return nextFilters;
    });
  }, []);

  const resetFilters = useCallback((tab) => {
    setFilters((current) => {
      const nextFilters = {
        ...current,
        [tab]: { ...DEFAULT_DASHBOARD_FILTERS[tab] },
      };
      localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(nextFilters));
      return nextFilters;
    });
  }, []);

  const loadData = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const [establishmentsResult, earningsResult, referralsResult, settingsResult] = await Promise.all([
        sellerReferralService.getAll(),
        sellerReferralService.getEarnings(),
        referralService.getPaymentHistory(),
        settingsService.getBookingSettings(),
      ]);

      const failures = [];
      if (establishmentsResult.success) setEstablishments(establishmentsResult.referrals || []);
      else failures.push(establishmentsResult.message || 'No se pudieron cargar los establecimientos');
      if (earningsResult.success) setSellerEarnings(earningsResult.sellers || []);
      else failures.push(earningsResult.message || 'No se pudieron cargar las estadísticas de vendedores');
      if (referralsResult.success) setReferralHistory(referralsResult.data?.piojologists || []);
      else failures.push(referralsResult.message || 'No se pudieron cargar las comisiones por referidos');
      if (settingsResult.success) setTiers(settingsResult.settings?.partnerCommissionTiers || DEFAULT_TIERS);
      else failures.push(settingsResult.message || 'No se pudo cargar la configuración de tramos');

      setWarning(failures[0] || '');
      setLastUpdated(new Date());
      if (failures.length > 0 && showToast) {
        toast({ title: 'Carga parcial', description: failures[0], variant: 'destructive' });
      }
    } catch {
      const message = 'No se pudieron cargar las estadísticas administrativas';
      setWarning(message);
      if (showToast) toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    if (!focusRequest?.tab) return;

    setDashboardTab(focusRequest.tab);
    localStorage.setItem(DASHBOARD_TAB_KEY, focusRequest.tab);
    setFilters((current) => {
      const nextFilters = {
        ...current,
        [focusRequest.tab]: {
          ...DEFAULT_DASHBOARD_FILTERS[focusRequest.tab],
          query: String(focusRequest.search || '').trim(),
        },
      };
      localStorage.setItem(DASHBOARD_FILTERS_KEY, JSON.stringify(nextFilters));
      return nextFilters;
    });
  }, [focusRequest]);

  const services = useMemo(() => appointments.map((item, index) => ({
    ...item,
    id: item?.id ?? item?.backendId ?? `service-${index}`,
    serviceDate: parseDate(item?.date || item?.fecha || item?.created_at),
    status: normalizeStatus(item?.status || item?.estado),
    revenue: money(typeof getServicePrice === 'function' ? getServicePrice(item) : item?.price_confirmed ?? item?.price ?? item?.estimatedPrice),
    heads: heads(item),
    sellerReferralId: item?.seller_referral_id ?? item?.sellerReferralId ?? item?.seller_referral?.id ?? null,
    sellerReferralName: item?.seller_referral_name || item?.seller_referral?.business_name || '',
    sellerName: item?.seller_referral?.seller?.name || '',
    piojologistId: item?.piojologistId ?? item?.piojologist_id ?? null,
    paymentStatusToPiojologist: item?.payment_status_to_piojologist || item?.paymentStatusToPiojologist || 'pending',
  })), [appointments, getServicePrice]);

  const referralMap = useMemo(() => new Map(referralHistory.map((item) => [Number(item.id), item])), [referralHistory]);

  const establishmentStats = useMemo(() => {
    const groups = new Map();
    services.forEach((item) => {
      const key = item.sellerReferralId ? `id:${Number(item.sellerReferralId)}` : item.sellerReferralName ? `name:${item.sellerReferralName.toLowerCase().trim()}` : null;
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const seen = new Set();
    const items = establishments.map((item) => {
      const key = `id:${Number(item.id)}`;
      seen.add(key);
      const rows = groups.get(key) || [];
      const commissions = partnerRows(rows, tiers);
      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      const completed = rows.filter((row) => row.status === 'completed').length;
      return {
        id: item.id,
        name: item.business_name || 'Establecimiento',
        seller: item.seller?.name || 'Sin vendedor',
        subtitle: `${item.contact_name || item.owner_name || item.email || 'Sin contacto'} • ${item.city || 'Sin ciudad'}`,
        status: item.status || 'pending_review',
        hasDocuments: Boolean(item.chamber_of_commerce_url && item.rut_url),
        hasLink: Boolean(item.booking_link),
        bookings: rows.length,
        heads: rows.reduce((sum, row) => sum + row.heads, 0),
        revenue,
        avg: rows.length ? revenue / rows.length : 0,
        commissionTotal: commissions.reduce((sum, row) => sum + row.amount, 0),
        commissionPending: commissions.filter((row) => !row.completed).reduce((sum, row) => sum + row.amount, 0),
        currentTierValue: money(tierFor(Math.max(1, rows.length || 1), tiers)?.value),
        completion: rows.length ? Math.round((completed / rows.length) * 100) : 0,
      };
    });
    groups.forEach((rows, key) => {
      if (seen.has(key)) return;
      const commissions = partnerRows(rows, tiers);
      const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
      items.push({
        id: key,
        name: rows[0]?.sellerReferralName || 'Establecimiento sin registro',
        seller: rows[0]?.sellerName || 'Sin vendedor',
        subtitle: 'Sin registro administrativo',
        status: 'approved',
        hasDocuments: false,
        hasLink: false,
        bookings: rows.length,
        heads: rows.reduce((sum, row) => sum + row.heads, 0),
        revenue,
        avg: rows.length ? revenue / rows.length : 0,
        commissionTotal: commissions.reduce((sum, row) => sum + row.amount, 0),
        commissionPending: commissions.filter((row) => !row.completed).reduce((sum, row) => sum + row.amount, 0),
        currentTierValue: money(tierFor(1, tiers)?.value),
        completion: rows.length ? Math.round((rows.filter((row) => row.status === 'completed').length / rows.length) * 100) : 0,
      });
    });
    return items.sort((a, b) => b.commissionTotal - a.commissionTotal || b.bookings - a.bookings);
  }, [establishments, services, tiers]);

  const sellerStats = useMemo(() => {
    const referralCounts = establishments.reduce((acc, item) => {
      const id = Number(item?.seller_user_id || item?.seller?.id);
      if (!Number.isFinite(id)) return acc;
      acc[id] = acc[id] || { total: 0, approved: 0, pending: 0, rejected: 0 };
      acc[id].total += 1;
      acc[id][item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'] += 1;
      return acc;
    }, {});
    return sellerEarnings.map((item) => {
      const count = referralCounts[Number(item?.seller?.id)] || { total: 0, approved: 0, pending: 0, rejected: 0 };
      return {
        id: item?.seller?.id,
        name: item?.seller?.name || 'Vendedor',
        email: item?.seller?.email || 'Sin correo',
        code: item?.seller?.referral_code || 'Sin código',
        perHead: money(item?.seller?.effective_referral_value ?? item?.summary?.per_head_value),
        total: money(item?.summary?.total_amount),
        pending: money(item?.summary?.pending_amount),
        paid: money(item?.summary?.paid_amount),
        bookings: Number(item?.summary?.bookings_count || 0),
        heads: Number(item?.summary?.heads_count || 0),
        referrals: count.total,
        approved: Number(item?.summary?.approved_referrals || count.approved),
        pendingReferrals: count.pending,
        rejected: count.rejected,
      };
    }).sort((a, b) => b.total - a.total || b.bookings - a.bookings);
  }, [sellerEarnings, establishments]);

  const piojologistStats = useMemo(() => piojologists.map((piojo) => {
    const mine = services.filter((item) => Number(item.piojologistId) === Number(piojo.id));
    const completed = mine.filter((item) => item.status === 'completed');
    const active = mine.filter((item) => item.status === 'assigned' || item.status === 'accepted');
    const referral = referralMap.get(Number(piojo.id));
    const revenue = completed.reduce((sum, row) => sum + row.revenue, 0);
    const payout = completed.reduce((sum, row) => sum + (money(row?.earnings) || (row.revenue * ((Number(piojo?.commission_rate ?? 50) || 50) / 100))), 0);
    const paidPayout = completed.filter((row) => row.paymentStatusToPiojologist === 'paid').reduce((sum, row) => sum + (money(row?.earnings) || (row.revenue * ((Number(piojo?.commission_rate ?? 50) || 50) / 100))), 0);
    return {
      id: piojo.id,
      name: piojo.name,
      specialty: piojo.specialty || 'Sin especialidad',
      active: Boolean(piojo.is_active),
      available: Boolean(piojo.available),
      rate: Number(piojo?.commission_rate ?? 50),
      completed: completed.length,
      activeServices: active.length,
      heads: mine.reduce((sum, row) => sum + row.heads, 0),
      revenue,
      payout,
      pendingPayout: Math.max(0, payout - paidPayout),
      avg: completed.length ? revenue / completed.length : 0,
      referralPaid: money(referral?.total_earned),
      referralPending: money(referral?.pending_amount),
      referralCount: Number(referral?.total_commissions_count || 0),
      paidReferralCount: Number(referral?.paid_count || 0),
      pendingReferralCount: Number(referral?.pending_count || 0),
    };
  }).sort((a, b) => b.revenue - a.revenue || b.completed - a.completed), [piojologists, services, referralMap]);

  const establishmentFilters = filters.establecimientos;
  const sellerFilters = filters.vendedores;
  const piojologistFilters = filters.piojologas;

  const filteredEstablishmentStats = useMemo(() => {
    const query = establishmentFilters.query.trim().toLowerCase();
    return establishmentStats.filter((item) => {
      const matchesQuery = !query || [item.name, item.subtitle, item.seller, item.status]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus = establishmentFilters.status === 'all' || item.status === establishmentFilters.status;
      const matchesDocuments = establishmentFilters.documents === 'all'
        || (establishmentFilters.documents === 'complete' && item.hasDocuments)
        || (establishmentFilters.documents === 'pending' && !item.hasDocuments);
      return matchesQuery && matchesStatus && matchesDocuments;
    });
  }, [establishmentFilters, establishmentStats]);

  const filteredSellerStats = useMemo(() => {
    const query = sellerFilters.query.trim().toLowerCase();
    return sellerStats.filter((item) => {
      const matchesQuery = !query || [item.name, item.email, item.code]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesState = sellerFilters.state === 'all'
        || (sellerFilters.state === 'active' && (item.total > 0 || item.bookings > 0 || item.referrals > 0))
        || (sellerFilters.state === 'pending' && (item.pending > 0 || item.pendingReferrals > 0))
        || (sellerFilters.state === 'idle' && item.total <= 0 && item.bookings <= 0 && item.referrals <= 0);
      return matchesQuery && matchesState;
    });
  }, [sellerFilters, sellerStats]);

  const filteredPiojologistStats = useMemo(() => {
    const query = piojologistFilters.query.trim().toLowerCase();
    return piojologistStats.filter((item) => {
      const matchesQuery = !query || [item.name, item.specialty]
        .some((value) => String(value || '').toLowerCase().includes(query));
      const matchesAvailability = piojologistFilters.availability === 'all'
        || (piojologistFilters.availability === 'available' && item.active && item.available)
        || (piojologistFilters.availability === 'active' && item.active)
        || (piojologistFilters.availability === 'inactive' && !item.active)
        || (piojologistFilters.availability === 'referrals' && (item.referralPaid > 0 || item.referralPending > 0));
      return matchesQuery && matchesAvailability;
    });
  }, [piojologistFilters, piojologistStats]);

  const filteredPiojologistIds = useMemo(
    () => new Set(filteredPiojologistStats.map((item) => Number(item.id))),
    [filteredPiojologistStats]
  );

  const filteredPiojologistServices = useMemo(
    () => services.filter((item) => filteredPiojologistIds.has(Number(item.piojologistId))),
    [filteredPiojologistIds, services]
  );

  const topEstablishments = filteredEstablishmentStats.slice(0, 8);
  const topSellers = filteredSellerStats.slice(0, 8);
  const topPiojologists = filteredPiojologistStats.slice(0, 8);

  const establishmentStatusChart = {
    labels: ['Pendientes', 'Aprobados', 'Rechazados'],
    datasets: [{ data: [filteredEstablishmentStats.filter((item) => item.status === 'pending_review').length, filteredEstablishmentStats.filter((item) => item.status === 'approved').length, filteredEstablishmentStats.filter((item) => item.status === 'rejected').length], backgroundColor: ['#F59E0B', '#10B981', '#EF4444'], borderColor: '#FFFFFF', borderWidth: 3 }],
  };
  const establishmentTopChart = { labels: topEstablishments.map((item) => short(item.name)), datasets: [{ label: 'Comisión estimada', data: topEstablishments.map((item) => item.commissionTotal), backgroundColor: '#06B6D4', borderRadius: 10 }] };
  const sellersCommissionChart = { labels: topSellers.map((item) => short(item.name)), datasets: [{ label: 'Comisión total', data: topSellers.map((item) => item.total), backgroundColor: '#8B5CF6', borderRadius: 10 }, { label: 'Pendiente', data: topSellers.map((item) => item.pending), backgroundColor: '#F59E0B', borderRadius: 10 }] };
  const sellersApprovalChart = { labels: topSellers.map((item) => short(item.name)), datasets: [{ label: 'Aprobados', data: topSellers.map((item) => item.approved), backgroundColor: '#10B981', borderRadius: 10 }, { label: 'Pendientes', data: topSellers.map((item) => item.pendingReferrals), backgroundColor: '#F59E0B', borderRadius: 10 }] };
  const piojologistsChart = { labels: topPiojologists.map((item) => short(item.name)), datasets: [{ label: 'Facturación servicios', data: topPiojologists.map((item) => item.revenue), backgroundColor: '#10B981', borderRadius: 10 }, { label: 'Referidos', data: topPiojologists.map((item) => item.referralPaid + item.referralPending), backgroundColor: '#3B82F6', borderRadius: 10 }] };
  const filteredStatusChartData = {
    labels: ['Pendientes', 'Asignados', 'Aceptados', 'Completados'],
    datasets: [{
      data: [
        filteredPiojologistServices.filter((item) => item.status === 'pending').length,
        filteredPiojologistServices.filter((item) => item.status === 'assigned').length,
        filteredPiojologistServices.filter((item) => item.status === 'accepted').length,
        filteredPiojologistServices.filter((item) => item.status === 'completed').length,
      ],
      backgroundColor: ['#F59E0B', '#06B6D4', '#10B981', '#3B82F6'],
      borderColor: '#FFFFFF',
      borderWidth: 3,
    }],
  };
  const filteredWeeklyChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = startOfDay(date).getTime();
      const rows = filteredPiojologistServices.filter((item) => item.serviceDate && startOfDay(item.serviceDate).getTime() === key);
      return {
        label: new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(date),
        total: rows.length,
        completed: rows.filter((item) => item.status === 'completed').length,
      };
    });
    return {
      labels: days.map((day) => day.label),
      datasets: [
        { label: 'Servicios', data: days.map((day) => day.total), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.15)', fill: true, tension: 0.35 },
        { label: 'Completados', data: days.map((day) => day.completed), borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.15)', fill: true, tension: 0.35 },
      ],
    };
  }, [filteredPiojologistServices]);
  const filteredPopularServicesChart = useMemo(() => {
    const counts = new Map();
    filteredPiojologistServices.forEach((item) => {
      if (Array.isArray(item?.services_per_person) && item.services_per_person.length) {
        item.services_per_person.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
      } else {
        const name = item?.serviceType || item?.planType || 'Servicio';
        counts.set(name, (counts.get(name) || 0) + item.heads);
      }
    });
    const rows = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
    return {
      rows,
      chart: {
        labels: rows.map((row) => short(row.label)),
        datasets: [{ label: 'Solicitudes', data: rows.map((row) => row.count), backgroundColor: ['#EC4899', '#F472B6', '#FB7185', '#F59E0B', '#34D399', '#60A5FA', '#A78BFA', '#F97316'], borderRadius: 10 }],
      },
    };
  }, [filteredPiojologistServices]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-orange-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-xl">📊</div>
              <div>
                <h3 className="text-2xl font-black text-gray-800">Dashboard</h3>
                <p className="text-sm font-bold text-gray-500">Estadísticas separadas por pestañas, igual que configuración.</p>
              </div>
            </div>
            {lastUpdated ? <p className="text-xs font-black uppercase tracking-wide text-orange-600">Actualizado {lastUpdated.toLocaleString('es-CO')}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {warning ? <span className="px-3 py-2 rounded-full bg-amber-100 text-amber-700 text-xs font-black uppercase tracking-wide">Carga parcial</span> : null}
            <Button type="button" onClick={() => loadData(true)} className="bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl px-5">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Recargar estadísticas
            </Button>
          </div>
        </div>
        {warning ? <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">{warning}</div> : null}

        <Tabs value={dashboardTab} onValueChange={(value) => { setDashboardTab(value); localStorage.setItem(DASHBOARD_TAB_KEY, value); }} className="space-y-6 mt-6">
          <TabsList className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-2 border-slate-200 rounded-2xl p-2 h-auto gap-2">
            <TabsTrigger value="establecimientos" className="rounded-xl py-3 font-black data-[state=active]:bg-sky-500 data-[state=active]:text-white">Establecimientos</TabsTrigger>
            <TabsTrigger value="vendedores" className="rounded-xl py-3 font-black data-[state=active]:bg-violet-500 data-[state=active]:text-white">Vendedores</TabsTrigger>
            <TabsTrigger value="piojologas" className="rounded-xl py-3 font-black data-[state=active]:bg-emerald-500 data-[state=active]:text-white">Piojólogas</TabsTrigger>
          </TabsList>

          <TabsContent value="establecimientos" className="space-y-4">
            <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 md:p-5 space-y-4">
              <div>
                <p className="text-xs font-black text-sky-600 uppercase tracking-wide">Submódulo</p>
                <h4 className="text-xl font-black text-sky-800">Establecimientos</h4>
                <p className="text-sm font-bold text-sky-700">Estado comercial, reservas, cabezas y comisión estimada por tramos.</p>
              </div>
              <FilterToolbar
                title="Filtros de búsqueda"
                description="Busca un establecimiento puntual o reduce la vista por estado y documentos."
                query={establishmentFilters.query}
                onQueryChange={(value) => updateFilters('establecimientos', { query: value })}
                searchPlaceholder="Buscar por establecimiento, vendedor, ciudad o contacto"
                selects={[
                  {
                    key: 'establishment-status',
                    value: establishmentFilters.status,
                    onChange: (value) => updateFilters('establecimientos', { status: value }),
                    options: [
                      { value: 'all', label: 'Todos los estados' },
                      { value: 'approved', label: 'Aprobados' },
                      { value: 'pending_review', label: 'Pendientes' },
                      { value: 'rejected', label: 'Rechazados' },
                    ],
                  },
                  {
                    key: 'establishment-documents',
                    value: establishmentFilters.documents,
                    onChange: (value) => updateFilters('establecimientos', { documents: value }),
                    options: [
                      { value: 'all', label: 'Todos los documentos' },
                      { value: 'complete', label: 'Documentación completa' },
                      { value: 'pending', label: 'Documentación pendiente' },
                    ],
                  },
                ]}
                onClear={() => resetFilters('establecimientos')}
                resultLabel={`Mostrando ${filteredEstablishmentStats.length} de ${establishmentStats.length} establecimientos`}
                tone="bg-white/70 border-sky-100 text-sky-700"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Establecimientos" value={filteredEstablishmentStats.length} helper={`${filteredEstablishmentStats.filter((item) => item.status === 'approved').length} aprobados`} icon={Store} tone="bg-white border-sky-200 text-sky-700" />
                <StatCard label="Reservas" value={filteredEstablishmentStats.reduce((sum, item) => sum + item.bookings, 0)} helper={`${filteredEstablishmentStats.reduce((sum, item) => sum + item.heads, 0)} cabezas`} icon={ClipboardList} tone="bg-white border-cyan-200 text-cyan-700" />
                <StatCard label="Comisión Total" value={formatCurrency(filteredEstablishmentStats.reduce((sum, item) => sum + item.commissionTotal, 0))} helper="estimado por tramos" icon={CircleDollarSign} tone="bg-white border-blue-200 text-blue-700" />
                <StatCard label="Pendiente" value={formatCurrency(filteredEstablishmentStats.reduce((sum, item) => sum + item.commissionPending, 0))} helper={`${filteredEstablishmentStats.filter((item) => item.status === 'pending_review').length} en revisión`} icon={TrendingUp} tone="bg-white border-amber-200 text-amber-700" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Estado de Establecimientos" border="border-sky-100">{filteredEstablishmentStats.length ? <Doughnut data={establishmentStatusChart} options={chartOptions({ cutout: '58%', plugins: { ...chartOptions().plugins, legend: { position: 'bottom' } } })} /> : <EmptyState text="No hay resultados para este filtro." />}</ChartCard>
                <ChartCard title="Top por Comisión Estimada" border="border-cyan-100">{topEstablishments.length ? <Bar data={establishmentTopChart} options={chartOptions({ plugins: { ...chartOptions().plugins, legend: { display: false }, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => formatCurrency(context.parsed.y || 0) } } }, scales: { y: { beginAtZero: true, ticks: { color: '#6B7280', callback: (value) => formatCurrency(value), font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#E5E7EB' } }, x: { ticks: { color: '#374151', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { display: false } } } })} /> : <EmptyState text="No hay establecimientos con actividad todavía." />}</ChartCard>
              </div>
              <HorizontalCarousel
                items={filteredEstablishmentStats}
                getKey={(item) => item.id}
                emptyText="No hay establecimientos que coincidan con el filtro."
                renderItem={(item) => (
                  <DetailCard key={item.id} title={item.name} subtitle={item.subtitle} badge={<span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${ESTABLISHMENT_STATUS[item.status]?.badge || ESTABLISHMENT_STATUS.pending_review.badge}`}>{ESTABLISHMENT_STATUS[item.status]?.label || 'Pendiente'}</span>} metrics={[{ label: 'Reservas', value: item.bookings }, { label: 'Cabezas', value: item.heads }, { label: 'Facturación', value: formatCurrency(item.revenue) }, { label: 'Ticket Prom.', value: formatCurrency(item.avg) }, { label: 'Comisión Total', value: formatCurrency(item.commissionTotal) }, { label: 'Pendiente', value: formatCurrency(item.commissionPending) }, { label: 'Valor Tramo', value: formatCurrency(item.currentTierValue) }, { label: 'Cumplimiento', value: `${item.completion}%` }]} footer={`Vendedor: ${item.seller}`}>
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full border text-xs font-black ${item.hasDocuments ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>{item.hasDocuments ? 'Documentación completa' : 'Documentación pendiente'}</span>
                      {item.hasLink ? <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black">Link activo</span> : null}
                    </div>
                  </DetailCard>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="vendedores" className="space-y-4">
            <div className="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 md:p-5 space-y-4">
              <div>
                <p className="text-xs font-black text-violet-600 uppercase tracking-wide">Submódulo</p>
                <h4 className="text-xl font-black text-violet-800">Vendedores</h4>
                <p className="text-sm font-bold text-violet-700">Comisiones por link, rendimiento comercial y estado de sus establecimientos.</p>
              </div>
              <FilterToolbar
                title="Filtros de búsqueda"
                description="Encuentra vendedores por nombre, correo o código, y reduce la vista por actividad."
                query={sellerFilters.query}
                onQueryChange={(value) => updateFilters('vendedores', { query: value })}
                searchPlaceholder="Buscar por vendedor, correo o código"
                selects={[
                  {
                    key: 'seller-state',
                    value: sellerFilters.state,
                    onChange: (value) => updateFilters('vendedores', { state: value }),
                    options: [
                      { value: 'all', label: 'Todos los vendedores' },
                      { value: 'active', label: 'Con actividad' },
                      { value: 'pending', label: 'Con pendientes' },
                      { value: 'idle', label: 'Sin actividad' },
                    ],
                  },
                ]}
                onClear={() => resetFilters('vendedores')}
                resultLabel={`Mostrando ${filteredSellerStats.length} de ${sellerStats.length} vendedores`}
                tone="bg-white/70 border-violet-100 text-violet-700"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Vendedores" value={filteredSellerStats.length} helper={`${filteredSellerStats.reduce((sum, item) => sum + item.referrals, 0)} establecimientos`} icon={Users} tone="bg-white border-violet-200 text-violet-700" />
                <StatCard label="Comisión Total" value={formatCurrency(filteredSellerStats.reduce((sum, item) => sum + item.total, 0))} helper={`${filteredSellerStats.reduce((sum, item) => sum + item.bookings, 0)} reservas`} icon={Wallet} tone="bg-white border-purple-200 text-purple-700" />
                <StatCard label="Pendiente" value={formatCurrency(filteredSellerStats.reduce((sum, item) => sum + item.pending, 0))} helper={`${filteredSellerStats.reduce((sum, item) => sum + item.heads, 0)} cabezas`} icon={TrendingUp} tone="bg-white border-amber-200 text-amber-700" />
                <StatCard label="Aprobados" value={filteredSellerStats.reduce((sum, item) => sum + item.approved, 0)} helper="establecimientos aprobados" icon={Building2} tone="bg-white border-emerald-200 text-emerald-700" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Comisiones por Vendedor" border="border-violet-100">{topSellers.length ? <Bar data={sellersCommissionChart} options={chartOptions({ scales: { y: { beginAtZero: true, ticks: { color: '#6B7280', callback: (value) => formatCurrency(value), font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#E5E7EB' } }, x: { ticks: { color: '#374151', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { display: false } } }, plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y || 0)}` } } } })} /> : <EmptyState text="No hay vendedores con datos suficientes todavía." />}</ChartCard>
                <ChartCard title="Aprobación de Establecimientos" border="border-purple-100">{topSellers.length ? <Bar data={sellersApprovalChart} options={chartOptions({ scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6B7280', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#E5E7EB' } }, x: { ticks: { color: '#374151', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { display: false } } } })} /> : <EmptyState text="No hay datos de vendedores para graficar." />}</ChartCard>
              </div>
              <HorizontalCarousel
                items={filteredSellerStats}
                getKey={(item) => item.id}
                emptyText="No hay vendedores que coincidan con el filtro."
                renderItem={(item) => (
                  <DetailCard key={item.id} title={item.name} subtitle={item.email} metrics={[{ label: 'Comisión Total', value: formatCurrency(item.total) }, { label: 'Pendiente', value: formatCurrency(item.pending) }, { label: 'Pagado', value: formatCurrency(item.paid) }, { label: 'Valor por cabeza', value: formatCurrency(item.perHead) }, { label: 'Reservas', value: item.bookings }, { label: 'Cabezas', value: item.heads }, { label: 'Establecimientos', value: item.referrals }, { label: 'Aprobados', value: item.approved }]} footer={`Código: ${item.code}`}>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-black">Pendientes de revisión: {item.pendingReferrals}</span>
                      <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-black">Rechazados: {item.rejected}</span>
                    </div>
                  </DetailCard>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="piojologas" className="space-y-4">
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 md:p-5 space-y-4">
              <div>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-wide">Submódulo</p>
                <h4 className="text-xl font-black text-emerald-800">Piojólogas</h4>
                <p className="text-sm font-bold text-emerald-700">Servicios, facturación, payouts y rendimiento del programa de referidos.</p>
              </div>
              <FilterToolbar
                title="Filtros de búsqueda"
                description="Busca una piojóloga específica y cambia la vista por disponibilidad o uso de referidos."
                query={piojologistFilters.query}
                onQueryChange={(value) => updateFilters('piojologas', { query: value })}
                searchPlaceholder="Buscar por piojóloga o especialidad"
                selects={[
                  {
                    key: 'piojologist-availability',
                    value: piojologistFilters.availability,
                    onChange: (value) => updateFilters('piojologas', { availability: value }),
                    options: [
                      { value: 'all', label: 'Todas las piojólogas' },
                      { value: 'available', label: 'Disponibles' },
                      { value: 'active', label: 'Activas' },
                      { value: 'inactive', label: 'Inactivas' },
                      { value: 'referrals', label: 'Con referidos' },
                    ],
                  },
                ]}
                onClear={() => resetFilters('piojologas')}
                resultLabel={`Mostrando ${filteredPiojologistStats.length} de ${piojologistStats.length} piojólogas`}
                tone="bg-white/70 border-emerald-100 text-emerald-700"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Piojólogas" value={filteredPiojologistStats.length} helper={`${filteredPiojologistStats.filter((item) => item.active && item.available).length} disponibles`} icon={UserRound} tone="bg-white border-emerald-200 text-emerald-700" />
                <StatCard label="Servicios" value={filteredPiojologistStats.reduce((sum, item) => sum + item.completed, 0)} helper="completados" icon={Scissors} tone="bg-white border-green-200 text-green-700" />
                <StatCard label="Facturación" value={formatCurrency(filteredPiojologistStats.reduce((sum, item) => sum + item.revenue, 0))} helper={formatCurrency(filteredPiojologistStats.reduce((sum, item) => sum + item.payout, 0))} icon={CircleDollarSign} tone="bg-white border-teal-200 text-teal-700" />
                <StatCard label="Ref. Pendientes" value={formatCurrency(filteredPiojologistStats.reduce((sum, item) => sum + item.referralPending, 0))} helper={formatCurrency(filteredPiojologistStats.reduce((sum, item) => sum + item.pendingPayout, 0))} icon={TrendingUp} tone="bg-white border-amber-200 text-amber-700" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ChartCard title="Estado General de Servicios" border="border-emerald-100">{filteredPiojologistServices.length ? <Doughnut data={filteredStatusChartData} options={chartOptions({ cutout: '58%', plugins: { ...chartOptions().plugins, legend: { position: 'bottom' } } })} /> : <EmptyState text="No hay servicios para esta selección." />}</ChartCard>
                <ChartCard title="Flujo de los Últimos 7 Días" border="border-orange-100">{filteredPiojologistServices.length ? <Line data={filteredWeeklyChartData} options={chartOptions({ scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6B7280', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#E5E7EB' } }, x: { ticks: { color: '#374151', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#F3F4F6' } } } })} /> : <EmptyState text="No hay movimientos en los últimos 7 días para esta vista." />}</ChartCard>
                <ChartCard title="Servicios Más Solicitados" border="border-pink-100">{filteredPopularServicesChart.rows.length ? <Bar data={filteredPopularServicesChart.chart} options={chartOptions({ indexAxis: 'y', plugins: { ...chartOptions().plugins, legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { color: '#6B7280', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#E5E7EB' } }, y: { ticks: { color: '#374151', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { display: false } } } })} /> : <EmptyState text="Todavía no hay consumo suficiente para esta gráfica." />}</ChartCard>
                <ChartCard title="Servicios y Referidos por Piojóloga" border="border-emerald-100">{topPiojologists.length ? <Bar data={piojologistsChart} options={chartOptions({ scales: { y: { beginAtZero: true, ticks: { color: '#6B7280', callback: (value) => formatCurrency(value), font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { color: '#E5E7EB' } }, x: { ticks: { color: '#374151', font: { family: 'Fredoka', size: 11, weight: 700 } }, grid: { display: false } } }, plugins: { ...chartOptions().plugins, tooltip: { ...chartOptions().plugins.tooltip, callbacks: { label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y || 0)}` } } } })} /> : <EmptyState text="No hay piojólogas con actividad todavía." />}</ChartCard>
              </div>
              <HorizontalCarousel
                items={filteredPiojologistStats}
                getKey={(item) => item.id}
                emptyText="No hay piojólogas que coincidan con el filtro."
                renderItem={(item) => (
                  <DetailCard key={item.id} title={item.name} subtitle={`${item.specialty} • Comisión ${item.rate}%`} badge={<span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${item.active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{item.active ? (item.available ? 'Activa y disponible' : 'Activa') : 'Inactiva'}</span>} metrics={[{ label: 'Completados', value: item.completed }, { label: 'En ruta', value: item.activeServices }, { label: 'Cabezas', value: item.heads }, { label: 'Facturación', value: formatCurrency(item.revenue) }, { label: 'Payout', value: formatCurrency(item.payout) }, { label: 'Pend. Pago', value: formatCurrency(item.pendingPayout) }, { label: 'Ref. Pagados', value: formatCurrency(item.referralPaid) }, { label: 'Ref. Pend.', value: formatCurrency(item.referralPending) }]} footer={`Comisiones por referidos: ${item.referralCount} totales`}>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">Ticket promedio {formatCurrency(item.avg)}</span>
                      <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-black">Referidos pagados: {item.paidReferralCount}</span>
                      <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black">Referidos pendientes: {item.pendingReferralCount}</span>
                    </div>
                  </DetailCard>
                )}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

DashboardModule.displayName = 'DashboardModule';

export default DashboardModule;
