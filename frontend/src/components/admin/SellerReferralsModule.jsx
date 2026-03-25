import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, FileText, X, Building2, QrCode, Wallet, Copy, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Pagination from './Pagination';
import { sellerReferralService, userService } from '@/lib/api';
import { API_URL } from '@/lib/config';

const statusConfig = {
  pending_review: {
    label: 'Pendiente',
    card: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  approved: {
    label: 'Aprobado',
    card: 'bg-green-50 border-green-200',
    badge: 'bg-green-100 text-green-700 border-green-200',
  },
  rejected: {
    label: 'Rechazado',
    card: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700 border-red-200',
  },
};

const SellerReferralsModule = React.memo(() => {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [earningsSummary, setEarningsSummary] = useState({ pending_amount: 0, paid_amount: 0, total_amount: 0, bookings_count: 0, heads_count: 0 });
  const [sellerEarnings, setSellerEarnings] = useState([]);
  const [qrSeller, setQrSeller] = useState(null);
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const itemsPerPage = 8;

  const loadReferrals = async () => {
    setLoading(true);
    const [result, earningsResult] = await Promise.all([
      sellerReferralService.getAll(),
      sellerReferralService.getEarnings(),
    ]);
    setLoading(false);

    if (result.success) {
      setItems(result.referrals || []);
    }

    if (earningsResult.success) {
      setSellerEarnings(earningsResult.sellers || []);
      setEarningsSummary(earningsResult.summary || {});
    }

    if (result.success && earningsResult.success) return;

    toast({
      title: '❌ Error',
      description: result.message || earningsResult.message || 'No se pudieron cargar los referidos de vendedores',
      variant: 'destructive',
      className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
    });
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  useEffect(() => {
    const maxPage = Math.ceil(items.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && items.length === 0) setCurrentPage(1);
  }, [items.length, currentPage]);

  const summary = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => item.status === 'pending_review').length,
    approved: items.filter((item) => item.status === 'approved').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
  }), [items]);

  const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number(amount || 0));

  const qrBookingUrl = qrSeller?.seller?.referral_code
    ? `${window.location.origin}/agenda?ref=${encodeURIComponent(qrSeller.seller.referral_code)}`
    : '';

  const qrImageUrl = qrBookingUrl
    ? `${API_URL}/qr-proxy?size=320x320&data=${encodeURIComponent(qrBookingUrl)}`
    : '';
  const qrPreviewUrl = qrBookingUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrBookingUrl)}`
    : '';
  const companyLogoUrl = `${window.location.origin}/logo.png`;

  useEffect(() => {
    setQrImageFailed(false);
  }, [qrImageUrl, qrPreviewUrl, qrSeller]);

  const copyQrLink = async () => {
    if (!qrBookingUrl) return;

    try {
      await navigator.clipboard.writeText(qrBookingUrl);
      toast({
        title: 'Link copiado',
        description: 'El enlace del QR quedo copiado.',
        className: 'bg-green-100 text-green-800 rounded-2xl border-2 border-green-200'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo copiar el enlace del QR.',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
    }
  };

  const handleGenerateQr = async (sellerItem) => {
    let nextSellerItem = sellerItem;

    if (!sellerItem?.seller?.referral_code) {
      const result = await userService.regenerateReferralCode(sellerItem.seller.id);
      if (!result.success) {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo generar el codigo del vendedor',
          variant: 'destructive',
          className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
        });
        return;
      }

      nextSellerItem = {
        ...sellerItem,
        seller: {
          ...sellerItem.seller,
          referral_code: result.data?.referral_code || result.data?.user?.referral_code || '',
        },
      };
      await loadReferrals();
    }

    setQrSeller(nextSellerItem);
  };

  const handleDownloadQrPdf = () => {
    if (!qrSeller || !qrImageUrl || !qrBookingUrl) return;

    const printWindow = window.open('', '_blank', 'width=980,height=1300');
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'El navegador bloqueo la nueva ventana.',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    const sellerName = qrSeller.seller?.name || 'Vendedor';
    const referralCode = qrSeller.seller?.referral_code || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>QR ${sellerName}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #f8fdff;
              font-family: Arial, sans-serif;
              color: #1f2937;
              padding: 24px;
            }
            .sheet {
              max-width: 980px;
              margin: 0 auto;
              border: 4px solid #22c7ee;
              border-radius: 36px;
              background: linear-gradient(135deg, #f0fbff 0%, #ffffff 55%, #f6fcff 100%);
              padding: 36px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 24px;
              margin-bottom: 28px;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 18px;
            }
            .brand img {
              width: 88px;
              height: 88px;
              object-fit: contain;
              border: 2px solid #d1f5ff;
              border-radius: 24px;
              background: #fff;
              padding: 10px;
            }
            .tag {
              border: 2px solid #d1f5ff;
              border-radius: 24px;
              background: #fff;
              padding: 18px 24px;
              min-width: 260px;
            }
            .eyebrow {
              color: #1199c6;
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 0.22em;
              text-transform: uppercase;
              margin: 0 0 8px;
            }
            h1 {
              margin: 0;
              font-size: 58px;
              line-height: 1.02;
            }
            .sub {
              margin: 10px 0 0;
              color: #475569;
              font-size: 26px;
              font-weight: 700;
            }
            .panel {
              border: 3px solid #c9f3ff;
              border-radius: 30px;
              background: #fafdff;
              padding: 28px;
            }
            .hero {
              display: grid;
              grid-template-columns: 1fr 330px;
              gap: 28px;
              align-items: center;
            }
            .copy h2 {
              margin: 8px 0 18px;
              font-size: 68px;
              line-height: 0.98;
            }
            .copy-box {
              border: 2px solid #d1f5ff;
              border-radius: 24px;
              background: #fff;
              padding: 22px 24px;
              max-width: 430px;
              color: #475569;
              font-size: 22px;
              font-weight: 700;
              line-height: 1.55;
            }
            .qr-card {
              border: 2px solid #c9f3ff;
              border-radius: 30px;
              background: #fff;
              padding: 24px;
              text-align: center;
            }
            .qr-card img {
              width: 100%;
              max-width: 240px;
              height: auto;
              display: block;
              margin: 0 auto;
            }
            .qr-title {
              margin: 18px 0 8px;
              color: #1199c6;
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 0.28em;
              text-transform: uppercase;
            }
            .qr-text {
              margin: 0;
              color: #475569;
              font-size: 19px;
              font-weight: 700;
              line-height: 1.5;
            }
            .code-box {
              margin-top: 24px;
              border: 2px solid #d1f5ff;
              border-radius: 24px;
              background: #fff;
              padding: 22px 24px;
              display: grid;
              grid-template-columns: 320px minmax(0, 1fr);
              gap: 26px;
              align-items: start;
            }
            .label {
              color: #1199c6;
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 0.22em;
              text-transform: uppercase;
              margin-bottom: 10px;
            }
            .code {
              margin: 0;
              font-size: 44px;
              font-weight: 900;
              line-height: 1.05;
              word-break: break-word;
            }
            .link {
              margin: 0;
              color: #475569;
              font-size: 19px;
              font-weight: 700;
              line-height: 1.45;
              word-break: break-all;
              max-width: 100%;
            }
            @media print {
              body { padding: 0; background: white; }
              .sheet { max-width: none; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div class="brand">
                <img src="${companyLogoUrl}" alt="Chaopiojos" />
                <div>
                  <p class="eyebrow">Chaopiojos</p>
                  <h1>Agenda tu cita</h1>
                  <p class="sub">Escanea el QR y reserva en minutos</p>
                </div>
              </div>
              <div class="tag">
                <p class="eyebrow">Vendedor</p>
                <div style="font-size: 28px; font-weight: 900;">${sellerName}</div>
              </div>
            </div>

            <div class="panel">
              <div class="hero">
                <div class="copy">
                  <p class="eyebrow">Hoja imprimible</p>
                  <h2>Escanea este QR y agenda tu servicio</h2>
                  <div class="copy-box">
                    Atencion a domicilio.<br />
                    Selecciona fecha y confirma tu cita desde el celular.
                  </div>
                </div>

                <div class="qr-card">
                  <img src="${qrPreviewUrl}" alt="QR del vendedor" />
                  <p class="qr-title">Escaneame</p>
                  <p class="qr-text">Reserva con el referido de <strong>${sellerName}</strong></p>
                </div>
              </div>

              <div class="code-box">
                <div>
                  <div class="label">Codigo</div>
                  <p class="code">${referralCode}</p>
                </div>
                <div>
                  <div class="label">Link directo</div>
                  <p class="link">${qrBookingUrl}</p>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
  };

  const paginatedItems = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const submitReview = async (status) => {
    if (!reviewTarget) return;
    const result = await sellerReferralService.review(reviewTarget.id, {
      status,
      review_notes: reviewNotes.trim()
    });

    if (!result.success) {
      toast({
        title: '❌ Error',
        description: result.message || 'No se pudo guardar la revisión',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    toast({
      title: status === 'approved' ? '✅ Referido aprobado' : '❌ Referido rechazado',
      description: result.message,
      className: `${status === 'approved' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'} rounded-2xl border-2`
    });

    setApproveDialogOpen(false);
    setRejectDialogOpen(false);
    setReviewTarget(null);
    setReviewNotes('');
    await loadReferrals();
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-cyan-100 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
          <span className="text-3xl">🤝</span> Referidos de Vendedores
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-sm font-black">Total {summary.total}</span>
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-sm font-black">Pendientes {summary.pending}</span>
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-black">Aprobados {summary.approved}</span>
          <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-black">Rechazados {summary.rejected}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6 items-start">
        <div className="rounded-[2rem] border-4 border-cyan-100 bg-cyan-50/60 p-6 xl:min-h-[22rem]">
          <div className="flex items-center gap-3 mb-4">
            <Wallet className="w-6 h-6 text-cyan-600" />
            <h4 className="text-xl font-black text-gray-800">Ganancias por QR</h4>
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

        <div className="rounded-[2rem] border-4 border-cyan-100 bg-white p-6 xl:h-[22rem] flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <QrCode className="w-6 h-6 text-cyan-600" />
            <h4 className="text-xl font-black text-gray-800">QR por vendedor</h4>
          </div>
          {sellerEarnings.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 p-6 text-center font-bold text-cyan-700 flex-1 flex items-center justify-center">
              Aun no hay vendedores con ganancias o codigos generados.
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto pr-1 min-h-0">
              {sellerEarnings.map((sellerItem) => (
                <div key={sellerItem.seller.id} className="rounded-2xl border-2 border-cyan-100 bg-cyan-50/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-gray-800">{sellerItem.seller.name}</p>
                    <p className="text-sm font-bold text-gray-600">{sellerItem.seller.email}</p>
                    <p className="text-sm font-bold text-cyan-700 mt-1">
                      Codigo: {sellerItem.seller.referral_code || 'Sin generar'} • Pendiente: {formatCurrency(sellerItem.summary?.pending_amount || 0)}
                    </p>
                    <p className="text-xs font-bold text-gray-500 mt-1">
                      Peluquerias aprobadas: {sellerItem.summary?.approved_referrals || 0}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleGenerateQr(sellerItem)}
                    disabled={!sellerItem.summary?.approved_referrals}
                    className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 disabled:text-slate-600 text-white rounded-2xl px-5 py-3 font-bold"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    {sellerItem.summary?.approved_referrals ? 'Generar QR' : 'Sin aprobados'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-[2rem] border-4 border-cyan-100 bg-cyan-50 p-10 text-center font-bold text-cyan-700">
          Cargando referidos...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[2rem] border-4 border-dashed border-cyan-200 bg-cyan-50 p-10 text-center font-bold text-cyan-700">
          No hay registros enviados por vendedores.
        </div>
      ) : (
        <div className="space-y-4">
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
                    <p className="text-xs font-bold text-gray-500">
                      Vendedor: {item.seller?.name || 'Sin dato'} • {new Date(item.created_at).toLocaleString('es-CO')}
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      WhatsApp: {item.whatsapp || 'No registrado'} • Ciudad: {item.city || 'No registrada'}
                    </p>
                  </div>

                  <div className="flex flex-col items-start lg:items-end gap-3">
                    <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wide ${status.badge}`}>
                      {status.label}
                    </span>
                    <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
                      <Button
                        type="button"
                        onClick={() => setSelectedReferral(item)}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl px-4 py-2 font-bold"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Ver detalle
                      </Button>
                      {item.status === 'pending_review' && (
                        <>
                          <Button
                            type="button"
                            onClick={() => {
                              setReviewTarget(item);
                              setReviewNotes('');
                              setApproveDialogOpen(true);
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-xl px-4 py-2 font-bold"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Aceptar
                          </Button>
                          <Button
                            type="button"
                            onClick={() => {
                              setReviewTarget(item);
                              setReviewNotes('');
                              setRejectDialogOpen(true);
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-4 py-2 font-bold"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Rechazar
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalItems={items.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        colorScheme="cyan"
      />

      <Dialog open={Boolean(selectedReferral)} onOpenChange={(open) => !open && setSelectedReferral(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-cyan-400 p-0 overflow-hidden sm:max-w-2xl bg-cyan-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Detalle del referido</DialogTitle>
          </DialogHeader>
          {selectedReferral && (
            <div className="max-h-[80vh] overflow-y-auto">
              <div className="text-center pt-8 pb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Building2 className="w-6 h-6 text-cyan-600" />
                  <h2 className="text-2xl font-black text-cyan-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                    DETALLE DEL REFERIDO
                  </h2>
                </div>
              </div>

              <div className="px-6 md:px-8 pb-8 space-y-4">
                <div className="bg-white rounded-2xl border-2 border-cyan-200 p-4">
                  <p className="text-xl font-black text-gray-800">{selectedReferral.business_name}</p>
                  <p className="text-sm font-bold text-gray-600 mt-1">Contacto: {selectedReferral.contact_name}</p>
                  <p className="text-xs font-bold text-gray-500 mt-2">Vendedor: {selectedReferral.seller?.name || 'Sin dato'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-semibold text-gray-700">
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Propietario: <span className="font-bold text-gray-900">{selectedReferral.owner_name || 'No registrado'}</span></div>
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">WhatsApp: <span className="font-bold text-gray-900">{selectedReferral.whatsapp || 'No registrado'}</span></div>
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Teléfono: <span className="font-bold text-gray-900">{selectedReferral.phone || 'No registrado'}</span></div>
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Email: <span className="font-bold text-gray-900">{selectedReferral.email || 'No registrado'}</span></div>
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">NIT: <span className="font-bold text-gray-900">{selectedReferral.nit || 'No registrado'}</span></div>
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3">Ciudad: <span className="font-bold text-gray-900">{selectedReferral.city || 'No registrada'}</span></div>
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-3 md:col-span-2">Dirección: <span className="font-bold text-gray-900">{selectedReferral.address || 'No registrada'}</span></div>
                </div>

                {selectedReferral.notes && (
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-4 text-sm font-semibold text-gray-700">
                    <p className="text-xs font-black text-cyan-600 uppercase mb-2">Observaciones del vendedor</p>
                    {selectedReferral.notes}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {selectedReferral.chamber_of_commerce_url && (
                    <a href={selectedReferral.chamber_of_commerce_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700 hover:bg-cyan-100">
                      <FileText className="w-4 h-4" />
                      Ver Cámara de Comercio
                    </a>
                  )}
                  {selectedReferral.rut_url && (
                    <a href={selectedReferral.rut_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white border-2 border-cyan-200 px-4 py-3 text-sm font-black text-cyan-700 hover:bg-cyan-100">
                      <FileText className="w-4 h-4" />
                      Ver RUT
                    </a>
                  )}
                </div>

                {(selectedReferral.review_notes || selectedReferral.reviewer) && (
                  <div className="bg-white rounded-xl border-2 border-cyan-100 p-4 text-sm font-semibold text-gray-700">
                    <p className="text-xs font-black text-cyan-600 uppercase mb-2">Resultado de revisión</p>
                    <p>Estado: <span className="font-bold text-gray-900">{(statusConfig[selectedReferral.status] || statusConfig.pending_review).label}</span></p>
                    <p>Revisado por: <span className="font-bold text-gray-900">{selectedReferral.reviewer?.name || 'Sin revisor'}</span></p>
                    <p>Fecha: <span className="font-bold text-gray-900">{selectedReferral.reviewed_at ? new Date(selectedReferral.reviewed_at).toLocaleString('es-CO') : 'Sin fecha'}</span></p>
                    {selectedReferral.review_notes && (
                      <p className="mt-2">Comentario: <span className="font-bold text-gray-900">{selectedReferral.review_notes}</span></p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(qrSeller)} onOpenChange={(open) => !open && setQrSeller(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-cyan-400 p-0 overflow-hidden sm:max-w-2xl bg-cyan-50 shadow-2xl max-h-[90vh]">
          <DialogHeader className="sr-only"><DialogTitle>QR del vendedor</DialogTitle></DialogHeader>
          {qrSeller && (
            <div className="p-6 md:p-8 space-y-4 overflow-y-auto max-h-[90vh]">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <QrCode className="w-6 h-6 text-cyan-600" />
                  <h2 className="text-2xl font-black text-cyan-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
                    QR DEL VENDEDOR
                  </h2>
                </div>
                <p className="text-sm font-bold text-gray-600">{qrSeller.seller?.name}</p>
              </div>

              <div className="rounded-[2rem] border-2 border-cyan-200 bg-white p-4 md:p-5 space-y-4">
                <div className="rounded-[1.75rem] border-2 border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-4 md:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b-2 border-cyan-100">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-[1.25rem] bg-white border-2 border-cyan-100 p-2 shadow-sm shrink-0">
                        <img src={companyLogoUrl} alt="Chaopiojos" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-600">Chaopiojos</p>
                        <h3 className="text-xl md:text-2xl font-black text-gray-800 leading-tight">Hoja QR para impresion</h3>
                        <p className="mt-1 text-xs md:text-sm font-bold text-gray-500">Lista para entregar y pegar.</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white border-2 border-cyan-100 px-4 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-600">Vendedor</p>
                      <p className="mt-1 text-base md:text-lg font-black text-gray-800">{qrSeller.seller?.name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-5 items-center">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-black uppercase tracking-[0.25em] text-cyan-600">Hoja imprimible</p>
                        <h3 className="mt-2 text-2xl md:text-3xl font-black text-gray-800 leading-[1.05] max-w-[11ch]">
                          Agenda tu cita con este QR
                        </h3>
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border-2 m-3 border-cyan-100 bg-white p-4 flex flex-col items-center text-center shadow-sm">
                      {qrImageFailed ? (
                        <div className="w-full max-w-[210px] aspect-square rounded-2xl border-2 border-dashed border-cyan-200 bg-cyan-50 flex items-center justify-center p-4 text-center">
                          <div>
                            <QrCode className="w-10 h-10 text-cyan-500 mx-auto mb-3" />
                            <p className="text-sm font-black text-cyan-700">No se pudo mostrar el QR</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={qrPreviewUrl}
                          alt="QR del vendedor"
                          className="w-full max-w-[210px] rounded-2xl bg-white"
                          onError={() => setQrImageFailed(true)}
                        />
                      )}
                      <p className="mt-4 text-xs uppercase font-black tracking-[0.25em] text-cyan-600">Escaneame</p>
                      <p className="mt-2 text-xs md:text-sm font-bold text-gray-600">
                        Abre el calendario con el referido de <span className="text-gray-800">{qrSeller.seller?.name}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white border-2 border-cyan-100 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-[170px_1fr] gap-4 items-start">
                      <div>
                        <p className="text-xs uppercase font-black tracking-wide text-cyan-600">Codigo</p>
                        <p className="mt-2 text-xl md:text-2xl font-black text-gray-800 break-words">{qrSeller.seller?.referral_code}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase font-black tracking-wide text-cyan-600">Link directo</p>
                        <p className="mt-2 text-xs md:text-sm font-bold text-gray-600 break-all leading-relaxed">{qrBookingUrl}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" onClick={handleDownloadQrPdf} className="flex-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-2xl py-3 font-bold">
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>
                <Button type="button" onClick={copyQrLink} className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl py-3 font-bold">
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar link
                </Button>
                <a href={qrImageUrl} target="_blank" rel="noreferrer" className="flex-1 inline-flex items-center justify-center rounded-2xl border-2 border-cyan-200 bg-white px-5 py-3 font-bold text-cyan-700 hover:bg-cyan-50">
                  <QrCode className="w-4 h-4 mr-2" />
                  Abrir QR
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 overflow-hidden sm:max-w-md bg-green-50 shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Aprobar referido</DialogTitle></DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-black text-green-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>ACEPTAR REFERIDO</h2>
            </div>
          </div>
          <div className="px-8 pb-8 space-y-5">
            <p className="text-center text-gray-700 font-medium">¿Confirmas que la documentación está correcta?</p>
            {reviewTarget && <div className="bg-white rounded-2xl p-4 border-2 border-green-200 text-center"><p className="font-black text-gray-800">{reviewTarget.business_name}</p><p className="text-sm text-gray-600">{reviewTarget.contact_name}</p></div>}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Comentario (Opcional)</label>
              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="w-full bg-white border-2 border-green-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-green-500 resize-none" rows="3" placeholder="Observación para el vendedor" />
            </div>
            <div className="flex gap-4">
              <Button type="button" onClick={() => { setApproveDialogOpen(false); setReviewTarget(null); setReviewNotes(''); }} className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all">Cancelar</Button>
              <Button type="button" onClick={() => submitReview('approved')} className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all">Sí, aceptar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden sm:max-w-md bg-red-50 shadow-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Rechazar referido</DialogTitle></DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <X className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-black text-red-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>RECHAZAR REFERIDO</h2>
            </div>
          </div>
          <div className="px-8 pb-8 space-y-5">
            <p className="text-center text-gray-700 font-medium">¿Confirmas que la documentación debe ser rechazada?</p>
            {reviewTarget && <div className="bg-white rounded-2xl p-4 border-2 border-red-200 text-center"><p className="font-black text-gray-800">{reviewTarget.business_name}</p><p className="text-sm text-gray-600">{reviewTarget.contact_name}</p></div>}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Motivo / comentario</label>
              <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} className="w-full bg-white border-2 border-red-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-red-500 resize-none" rows="3" placeholder="Explica al vendedor el motivo del rechazo" />
            </div>
            <div className="flex gap-4">
              <Button type="button" onClick={() => { setRejectDialogOpen(false); setReviewTarget(null); setReviewNotes(''); }} className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all">Cancelar</Button>
              <Button type="button" onClick={() => submitReview('rejected')} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all">Sí, rechazar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

SellerReferralsModule.displayName = 'SellerReferralsModule';

export default SellerReferralsModule;
