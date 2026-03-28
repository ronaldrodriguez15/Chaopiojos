import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarDays, Copy, QrCode, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { sellerReferralService } from '@/lib/api';
import { API_URL } from '@/lib/config';

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
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [qrImageFailed, setQrImageFailed] = useState(false);

  const loadDashboard = async () => {
    setIsLoading(true);
    const result = await sellerReferralService.getPartnerDashboard();
    setIsLoading(false);

    if (!result.success) {
      toast({
        title: 'Error',
        description: result.message || 'No se pudo cargar tu panel',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setReferral(result.referral || null);
    setStatistics(result.statistics || {});
    setRecentBookings(result.recentBookings || []);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const bookingUrl = useMemo(
    () => (referral?.booking_link ? `${window.location.origin}${referral.booking_link}` : ''),
    [referral]
  );

  const qrImageUrl = useMemo(
    () => (bookingUrl ? `${API_URL}/qr-proxy?size=320x320&data=${encodeURIComponent(bookingUrl)}` : ''),
    [bookingUrl]
  );

  useEffect(() => {
    setQrImageFailed(false);
  }, [qrImageUrl]);

  const cards = [
    { label: 'Clientes registrados', value: statistics.registered_clients || 0, icon: Users, tone: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
    { label: 'Cabezas registradas', value: statistics.heads_count || 0, icon: Building2, tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Registros este mes', value: statistics.this_month || 0, icon: CalendarDays, tone: 'bg-amber-50 border-amber-200 text-amber-700' },
    { label: 'Pendientes', value: statistics.pending_bookings || 0, icon: RefreshCw, tone: 'bg-purple-50 border-purple-200 text-purple-700' },
  ];

  const copyBookingUrl = async () => {
    if (!bookingUrl) return;

    try {
      await navigator.clipboard.writeText(bookingUrl);
      toast({
        title: 'Link copiado',
        description: 'El enlace de tu QR quedó copiado.',
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

  return (
    <div className="bg-white rounded-[2.5rem] p-4 md:p-6 shadow-xl border-4 border-cyan-100 space-y-6">
      <div className="bg-white rounded-[2rem] border-4 border-cyan-100 shadow-lg p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-cyan-400 to-blue-500 text-white flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-gray-800">Panel del Referido</h2>
              <p className="text-sm md:text-base font-bold text-cyan-600">{referral?.business_name || currentUser?.name}</p>
            </div>
          </div>
          <Button type="button" onClick={loadDashboard} className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl px-5 py-4 font-bold shadow-md border-b-4 border-cyan-700 active:border-b-0 active:translate-y-1">
            <RefreshCw className={`w-5 h-5 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="rounded-[2rem] border-4 border-cyan-100 bg-gradient-to-br from-cyan-500 to-blue-600 p-6 text-white shadow-lg">
          <p className="text-xs uppercase tracking-[0.28em] font-black opacity-80">Tu QR de registro</p>
          <h3 className="mt-3 text-3xl font-black">{referral?.business_name || 'Referido'}</h3>
          <p className="mt-3 text-sm md:text-base font-bold text-cyan-50 leading-relaxed">
            Comparte este QR o enlace para que los clientes se registren directamente con tu referido.
          </p>

          <div className="mt-6 rounded-[1.75rem] bg-white p-5 text-gray-800 shadow-md">
            <div className="flex flex-col items-center text-center gap-4">
              {bookingUrl && !qrImageFailed ? (
                <img
                  src={qrImageUrl}
                  alt="QR del referido"
                  className="w-full max-w-[240px] rounded-2xl bg-white"
                  onError={() => setQrImageFailed(true)}
                />
              ) : (
                <div className="w-full max-w-[240px] aspect-square rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="w-10 h-10 text-cyan-500 mx-auto mb-3" />
                    <p className="text-sm font-black text-cyan-700">QR no disponible</p>
                  </div>
                </div>
              )}

              <div className="w-full rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] font-black text-cyan-600">Link activo</p>
                <p className="mt-2 text-sm font-bold text-slate-700 break-all">{bookingUrl || 'Sin enlace disponible'}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button type="button" onClick={copyBookingUrl} disabled={!bookingUrl} className="flex-1 bg-white text-cyan-700 hover:bg-cyan-50 rounded-2xl py-3 font-bold">
              <Copy className="w-4 h-4 mr-2" />
              Copiar link
            </Button>
            {bookingUrl && (
              <a href={qrImageUrl} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center rounded-2xl border-2 border-white/50 bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20">
                <QrCode className="w-4 h-4 mr-2" />
                Abrir QR
              </a>
            )}
          </div>
        </div>

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
              <Users className="w-6 h-6 text-cyan-600" />
              <h3 className="text-xl font-black text-gray-800">Registros recientes</h3>
            </div>

            {recentBookings.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-8 text-center font-bold text-cyan-700">
                Aún no hay clientes registrados con tu QR.
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
                          {item.hora ? ` • ${item.hora}` : ''}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide bg-white border-cyan-200 text-cyan-700">
                        {item.numPersonas || 1} persona(s)
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-cyan-700">Estado: {item.estado || 'pendiente'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralPartnerView;
