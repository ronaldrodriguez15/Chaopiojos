import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Copy, ExternalLink, RefreshCw, Users, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { sellerReferralService } from '@/lib/api';

const emptyEarnings = {
  summary: {
    pending_amount: 0,
    completed_amount: 0,
    total_amount: 0,
    bookings_count: 0,
    heads_count: 0,
    completed_bookings: 0,
    pending_bookings: 0,
    this_month_amount: 0,
  }
};

const bookingStatusLabel = (status) => {
  const normalized = String(status || '').toLowerCase();
  const statusMap = {
    completed: 'Completado',
    completado: 'Completado',
    pending: 'Pendiente',
    pendiente: 'Pendiente',
    accepted: 'Aceptado',
    aceptado: 'Aceptado',
    assigned: 'Asignado',
    asignado: 'Asignado',
    confirmed: 'Confirmado',
    confirmado: 'Confirmado',
    cancelled: 'Cancelado',
    cancelado: 'Cancelado',
    rejected: 'Rechazado',
    rechazado: 'Rechazado',
  };

  return statusMap[normalized] || 'Pendiente';
};

const bookingStatusTone = (status, isCompleted) => {
  if (isCompleted) return 'bg-emerald-100 text-emerald-700 border-emerald-200';

  const normalized = String(status || '').toLowerCase();
  if (normalized === 'rejected' || normalized === 'rechazado' || normalized === 'cancelled' || normalized === 'cancelado') {
    return 'bg-red-100 text-red-700 border-red-200';
  }

  return 'bg-amber-100 text-amber-700 border-amber-200';
};

const ReferralPartnerView = ({ currentUser }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [referral, setReferral] = useState(null);
  const [statistics, setStatistics] = useState({
    registered_clients: 0,
    heads_count: 0,
    completed_bookings: 0,
    pending_bookings: 0,
    this_month: 0,
    this_month_amount: 0,
  });
  const [earnings, setEarnings] = useState(emptyEarnings);
  const [recentBookings, setRecentBookings] = useState([]);
  const [monthlyHistory, setMonthlyHistory] = useState([]);

  const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));

  const loadDashboard = async () => {
    setIsLoading(true);
    const result = await sellerReferralService.getPartnerDashboard();
    setIsLoading(false);

    if (!result.success) {
      toast({
        title: 'Error',
        description: result.message || 'No se pudo cargar tu panel de establecimiento',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setReferral(result.referral || null);
    setStatistics((current) => ({
      ...current,
      ...(result.statistics || {}),
    }));
    setEarnings({
      ...emptyEarnings,
      ...(result.earnings || {}),
      summary: {
        ...emptyEarnings.summary,
        ...(result.earnings?.summary || {}),
      }
    });
    setRecentBookings(result.recentBookings || []);
    setMonthlyHistory(result.monthlyHistory || []);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const bookingUrl = useMemo(
    () => (referral?.booking_link ? `${window.location.origin}${referral.booking_link}` : ''),
    [referral]
  );

  const cards = [
    { label: 'Clientes registrados', value: statistics.registered_clients || 0, icon: Users, tone: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
    { label: 'Cabezas registradas', value: statistics.heads_count || 0, icon: Building2, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Servicios completados', value: statistics.completed_bookings || 0, icon: RefreshCw, tone: 'bg-purple-50 border-purple-200 text-purple-700' },
    { label: 'Registros este mes', value: statistics.this_month || 0, icon: CalendarDays, tone: 'bg-amber-50 border-amber-200 text-amber-700' },
  ];
  const earningsCards = [
    { label: 'Total generado', value: formatCurrency(earnings.summary?.total_amount || 0), tone: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
    { label: 'Ganancia confirmada', value: formatCurrency(earnings.summary?.completed_amount || 0), tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Por confirmar', value: formatCurrency(earnings.summary?.pending_amount || 0), tone: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Generado este mes', value: formatCurrency(earnings.summary?.this_month_amount || 0), tone: 'bg-blue-50 border-blue-200 text-blue-700' },
  ];
  const partnerCommissionTiers = Array.isArray(earnings.summary?.commission_tiers)
    ? earnings.summary.commission_tiers
    : [];
  const currentMonthReferrals = Number(statistics.this_month || 0);
  const activeTier = partnerCommissionTiers.find((tier) => {
    const from = Number(tier?.from || 1);
    const to = tier?.to === null || typeof tier?.to === 'undefined' || tier?.to === ''
      ? null
      : Number(tier.to);
    const comparisonValue = Math.max(1, currentMonthReferrals || 1);
    return comparisonValue >= from && (to === null || comparisonValue <= to);
  }) || partnerCommissionTiers[0] || null;
  const averageTicket = (Number(earnings.summary?.bookings_count || 0) > 0)
    ? Number(earnings.summary?.total_amount || 0) / Number(earnings.summary?.bookings_count || 1)
    : 0;
  const completionRate = Number(earnings.summary?.bookings_count || 0) > 0
    ? Math.round((Number(earnings.summary?.completed_bookings || 0) / Number(earnings.summary?.bookings_count || 1)) * 100)
    : 0;

  const copyBookingUrl = async () => {
    if (!bookingUrl) return;

    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({
        title: 'Link copiado',
        description: 'El enlace de tu establecimiento quedo copiado.',
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

  const formatMonthLabel = (periodStart) => {
    if (!periodStart) return 'Mes sin fecha';
    try {
      return new Intl.DateTimeFormat('es-CO', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${periodStart}T00:00:00`));
    } catch (error) {
      return periodStart;
    }
  };

  const formatTierLabel = (tier) => {
    if (!tier) return 'Sin tramo';
    const from = Number(tier.from || 1);
    const to = tier.to === null || typeof tier.to === 'undefined' || tier.to === ''
      ? null
      : Number(tier.to);

    return to === null ? `${from}+ referidos` : `${from} a ${to} referidos`;
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-4 md:p-6 shadow-xl border-4 border-cyan-100 space-y-6">
      <div className="bg-white rounded-[2rem] border-4 border-cyan-100 shadow-lg p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-white flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-800">Panel del Establecimiento</h2>
              <p className="text-sm md:text-base font-bold text-cyan-600">{referral?.business_name || currentUser?.name}</p>
            </div>
          </div>
          <Button type="button" onClick={loadDashboard} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-4 font-bold shadow-md border-b-4 border-cyan-700 active:border-b-0 active:translate-y-1">
            <RefreshCw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-[2rem] p-6 shadow-lg text-white border-4 border-cyan-300">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6 text-white" />
              <p className="text-xs uppercase tracking-[0.25em] font-black opacity-80">Ganancias del establecimiento</p>
            </div>
            <h3 className="text-3xl md:text-4xl font-black mt-4">{formatCurrency(earnings.summary?.total_amount || 0)}</h3>
            <p className="text-sm md:text-base font-bold text-cyan-50 mt-3 leading-relaxed">
              Aquí ves la comisión que ha generado tu negocio con las reservas hechas desde tu link. La comisión sube por tramos según la cantidad de referidos del mes.
            </p>
            {activeTier && (
              <p className="text-sm font-black text-cyan-100 mt-3">
                Tramo activo del mes: {formatTierLabel(activeTier)} • {formatCurrency(activeTier.value || 0)} por referido
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 xl:min-w-[24rem]">
            <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
              <p className="text-xs uppercase tracking-wide font-black opacity-80">Reservas por link</p>
              <p className="text-2xl font-black mt-2">{earnings.summary?.bookings_count || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
              <p className="text-xs uppercase tracking-wide font-black opacity-80">Completadas</p>
              <p className="text-2xl font-black mt-2">{earnings.summary?.completed_bookings || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/15 border border-white/20 p-4">
              <p className="text-xs uppercase tracking-wide font-black opacity-80">Conversión</p>
              <p className="text-2xl font-black mt-2">{completionRate}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {earningsCards.map((card) => (
          <div key={card.label} className={`rounded-[1.75rem] border-4 p-5 shadow-lg ${card.tone}`}>
            <p className="text-xs uppercase tracking-wide font-black opacity-80">{card.label}</p>
            <p className="text-3xl font-black mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`rounded-[1.75rem] border-4 p-5 shadow-lg ${card.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide font-black opacity-80">{card.label}</p>
                      <p className="text-3xl font-black mt-2">{card.value}</p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/80 flex items-center justify-center shadow-sm">
                      <Icon className="w-7 h-7" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-6 h-6 text-cyan-600" />
              <h3 className="text-xl font-black text-gray-800">Resumen de ganancias</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Ticket promedio</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{formatCurrency(averageTicket)}</p>
              </div>
              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Referidos este mes</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{currentMonthReferrals}</p>
              </div>
              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Servicios pendientes</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{earnings.summary?.pending_bookings || 0}</p>
              </div>
              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Servicios completados</p>
                <p className="text-2xl font-black text-gray-800 mt-2">{earnings.summary?.completed_bookings || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-cyan-600" />
              <h3 className="text-xl font-black text-gray-800">Actividad reciente</h3>
            </div>

            {recentBookings.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">
                Aún no hay clientes registrados con tu link.
              </div>
            ) : (
              <div className="space-y-3 max-h-[26rem] overflow-y-auto pr-1">
                {recentBookings.map((item) => (
                  <div key={item.id} className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/60 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-gray-800">{item.clientName || 'Cliente'}</p>
                        <p className="text-sm font-bold text-gray-600">
                          {item.fecha ? new Date(item.fecha).toLocaleDateString('es-CO') : 'Sin fecha'}
                          {item.hora ? ` - ${item.hora}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide bg-white border-cyan-200 text-cyan-700">
                          {item.numPersonas || 1} persona(s)
                        </span>
                        <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${bookingStatusTone(item.estado, item.is_completed)}`}>
                          {bookingStatusLabel(item.estado)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-bold text-cyan-700">
                          {item.is_completed ? 'Ganancia confirmada' : 'Valor pendiente por confirmar'}
                        </p>
                        <p className="text-xs font-bold text-gray-500 mt-1">
                          Referido #{item.monthly_position || 0} del mes • Comisión aplicada {formatCurrency(item.tier_value || 0)}
                        </p>
                      </div>
                      <p className={`text-sm font-black ${item.is_completed ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {formatCurrency(item.total_amount || 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[2rem] border-4 border-cyan-100 p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <CalendarDays className="w-6 h-6 text-cyan-600" />
              <h3 className="text-xl font-black text-gray-800">Cortes mensuales</h3>
            </div>

            {monthlyHistory.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">
                Aún no hay cierres mensuales registrados.
              </div>
            ) : (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {monthlyHistory.map((item) => (
                  <div key={item.id || item.period_start} className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/60 p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-gray-800 capitalize">{formatMonthLabel(item.period_start)}</p>
                        <p className="text-sm font-bold text-gray-600">
                          {item.bookings_count || 0} referidos • {item.completed_bookings || 0} completados • {item.pending_bookings || 0} pendientes
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${item.is_closed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                        {item.is_closed ? 'Corte cerrado' : 'Mes en curso'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      <div className="rounded-xl bg-white border border-cyan-100 p-3">
                        <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Total generado</p>
                        <p className="text-lg font-black text-gray-800 mt-1">{formatCurrency(item.total_amount || 0)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-cyan-100 p-3">
                        <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Confirmado</p>
                        <p className="text-lg font-black text-gray-800 mt-1">{formatCurrency(item.completed_amount || 0)}</p>
                      </div>
                      <div className="rounded-xl bg-white border border-cyan-100 p-3">
                        <p className="text-xs uppercase tracking-wide font-black text-cyan-600">Pendiente</p>
                        <p className="text-lg font-black text-gray-800 mt-1">{formatCurrency(item.pending_amount || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border-4 border-cyan-100 bg-gradient-to-br from-cyan-500 to-blue-600 p-6 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.28em] font-black opacity-80">Tu link de registro</p>
          <h3 className="mt-3 text-3xl font-black">{referral?.business_name || 'Establecimiento'}</h3>
          <p className="mt-3 text-sm md:text-base font-bold text-cyan-50 leading-relaxed">
            Comparte este enlace para que los clientes reserven directamente desde tu establecimiento.
          </p>

          <div className="mt-6 rounded-[1.75rem] bg-white p-5 text-gray-800 shadow-md">
            <div className="flex flex-col gap-4">
              <div className="w-full rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Link activo</p>
                <p className="mt-2 text-sm font-bold text-slate-700 break-all">{bookingUrl || 'Sin enlace disponible'}</p>
              </div>
              <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Cómo usarlo</p>
                <p className="mt-2 text-sm font-bold text-slate-700">
                  Envía este link por WhatsApp, Instagram o cualquier canal del negocio para registrar reservas desde tu establecimiento.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button type="button" onClick={copyBookingUrl} disabled={!bookingUrl} className="flex-1 bg-white text-cyan-700 hover:bg-cyan-50 rounded-2xl py-3 font-bold">
              <Copy className="w-4 h-4 mr-2" />
              Copiar link
            </Button>
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center rounded-2xl border-2 border-white/50 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20">
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir link
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralPartnerView;
