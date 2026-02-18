import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader, Users } from "lucide-react";

const EarningsDialog = ({
  isOpen,
  onClose,
  loadingEarnings,
  earningsHistory,
  referralCommissionsList = [],
  formatCurrency,
  handlePayAll,
  handlePayOneReferral
}) => {
  const [payingCommissionId, setPayingCommissionId] = useState(null);
  const [pendingPageByPioj, setPendingPageByPioj] = useState({});
  const [pendingPerPageByPioj, setPendingPerPageByPioj] = useState({});
  const [paidPageByPioj, setPaidPageByPioj] = useState({});
  const [paidPerPageByPioj, setPaidPerPageByPioj] = useState({});

  const handlePayCommissionClick = async (commission, piojName) => {
    if (!handlePayOneReferral || !commission?.id) return;
    setPayingCommissionId(commission.id);
    try {
      await handlePayOneReferral(commission, piojName);
    } finally {
      setPayingCommissionId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 sm:max-w-4xl w-[95vw] bg-yellow-50 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="text-center pt-8 pb-6 shrink-0">
          <div className="flex items-center justify-center gap-3 mb-2">
            <DollarSign className="w-6 h-6 text-yellow-600" />
            <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
              GANANCIAS DE REFERIDOS
            </h2>
          </div>
        </div>

        <div className="px-8 pb-8 space-y-6 overflow-y-auto min-h-0">
          {loadingEarnings ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader className="w-12 h-12 animate-spin text-yellow-500" />
              <p className="text-gray-500 font-bold">Cargando historial...</p>
            </div>
          ) : earningsHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-bold text-lg">No hay historial de comisiones aun</p>
              <p className="text-sm text-gray-400 mt-2">Las comisiones apareceran cuando las piojologas referidas completen servicios</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6">
                  <p className="text-sm text-yellow-600 font-bold mb-2">Total pagado</p>
                  <p className="text-4xl font-bold text-gray-800">
                    {formatCurrency(earningsHistory.reduce((sum, p) => sum + (p.total_earned || 0), 0))}
                  </p>
                </div>
                <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6">
                  <p className="text-sm text-yellow-600 font-bold mb-2">Total pendiente</p>
                  <p className="text-4xl font-bold text-gray-800">
                    {formatCurrency(earningsHistory.reduce((sum, p) => sum + (p.pending_amount || 0), 0))}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-6 h-6 text-yellow-600" />
                  Detalles por piojologa
                </h4>

                {earningsHistory.map((pioj) => {
                  const pendingCommissions = (referralCommissionsList || []).filter((c) => {
                    const referrerId = Number(c.referrer_id ?? c.referrer?.id);
                    return referrerId === Number(pioj.id) && c.status === 'pending';
                  });
                  const paidCommissions = (referralCommissionsList || []).filter((c) => {
                    const referrerId = Number(c.referrer_id ?? c.referrer?.id);
                    return referrerId === Number(pioj.id) && c.status === 'paid';
                  });
                  const pendingPerPage = Number(pendingPerPageByPioj[pioj.id] || 5);
                  const pendingTotalPages = Math.max(1, Math.ceil(pendingCommissions.length / pendingPerPage));
                  const pendingPage = Math.min(Number(pendingPageByPioj[pioj.id] || 1), pendingTotalPages);
                  const paginatedPendingCommissions = pendingCommissions.slice(
                    (pendingPage - 1) * pendingPerPage,
                    pendingPage * pendingPerPage
                  );
                  const paidPerPage = Number(paidPerPageByPioj[pioj.id] || 5);
                  const paidTotalPages = Math.max(1, Math.ceil(paidCommissions.length / paidPerPage));
                  const paidPage = Math.min(Number(paidPageByPioj[pioj.id] || 1), paidTotalPages);
                  const paginatedPaidCommissions = paidCommissions.slice(
                    (paidPage - 1) * paidPerPage,
                    paidPage * paidPerPage
                  );

                  return (
                    <div
                      key={pioj.id}
                      className="bg-white border-2 border-yellow-400 rounded-2xl p-6 hover:shadow-lg transition-shadow"
                    >
                      <div className="space-y-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">
                              P
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-lg">{pioj.name}</p>
                              <p className="text-sm text-gray-600">{pioj.email}</p>
                              {pioj.referral_code && (
                                <p className="text-xs font-bold text-yellow-600 mt-1">
                                  Codigo: {pioj.referral_code}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                              <p className="text-xs text-yellow-600 font-bold">Total comisiones</p>
                              <p className="text-xl font-bold text-gray-800">{pioj.total_commissions_count || 0}</p>
                            </div>
                            <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                              <p className="text-xs text-green-600 font-bold">Pagadas</p>
                              <p className="text-xl font-bold text-gray-800">{pioj.paid_count || 0}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                              <p className="text-xs text-orange-600 font-bold">Pendientes</p>
                              <p className="text-xl font-bold text-gray-800">{pioj.pending_count || 0}</p>
                            </div>
                            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                              <p className="text-xs text-yellow-600 font-bold">Ganado</p>
                              <p className="text-lg font-bold text-gray-800">
                                {formatCurrency(pioj.total_earned || 0)}
                              </p>
                            </div>
                          </div>

                          {pioj.pending_count > 0 && (
                            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                              <p className="text-sm font-bold text-orange-600 mb-2">
                                Monto pendiente de pago: {formatCurrency(pioj.pending_amount || 0)}
                              </p>
                            </div>
                          )}

                          {pendingCommissions.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-black text-purple-700 uppercase tracking-wide">
                                  Comisiones pendientes (pago individual)
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-gray-500">Por pagina</span>
                                  <select
                                    value={pendingPerPage}
                                    onChange={(e) => {
                                      const next = Number(e.target.value);
                                      setPendingPerPageByPioj((prev) => ({ ...prev, [pioj.id]: next }));
                                      setPendingPageByPioj((prev) => ({ ...prev, [pioj.id]: 1 }));
                                    }}
                                    className="bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 text-xs font-bold text-purple-700"
                                  >
                                    {[5, 10, 20, 50].map((option) => (
                                      <option key={`pending-page-size-${pioj.id}-${option}`} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              {paginatedPendingCommissions.map((commission) => (
                                <div
                                  key={`pending-commission-${commission.id}`}
                                  className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                >
                                  <div>
                                    <p className="font-bold text-gray-800">
                                      {commission.booking?.clientName || commission.referred?.name || 'Cliente referido'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      ID #{commission.id} - {commission.created_at ? new Date(commission.created_at).toLocaleDateString('es-ES') : 'Sin fecha'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <p className="font-black text-purple-700">
                                      {formatCurrency(commission.commission_amount || 0)}
                                    </p>
                                    <Button
                                      type="button"
                                      onClick={() => handlePayCommissionClick(commission, pioj.name)}
                                      disabled={payingCommissionId === commission.id}
                                      className="bg-purple-500 hover:bg-purple-600 disabled:opacity-60 text-white rounded-xl px-3 py-2 font-bold"
                                    >
                                      {payingCommissionId === commission.id ? 'Pagando...' : 'Marcar pagado'}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-gray-500 font-bold">
                                  Pagina {pendingPage} de {pendingTotalPages} - {pendingCommissions.length} registros
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => setPendingPageByPioj((prev) => ({ ...prev, [pioj.id]: Math.max(1, pendingPage - 1) }))}
                                    disabled={pendingPage === 1}
                                    className="h-8 px-3 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 rounded-lg font-bold"
                                  >
                                    Anterior
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => setPendingPageByPioj((prev) => ({ ...prev, [pioj.id]: Math.min(pendingTotalPages, pendingPage + 1) }))}
                                    disabled={pendingPage === pendingTotalPages}
                                    className="h-8 px-3 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg font-bold"
                                  >
                                    Siguiente
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {paidCommissions.length > 0 && (
                            <div className="mt-4 space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-black text-green-700 uppercase tracking-wide">
                                  Comisiones pagadas
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-gray-500">Por pagina</span>
                                  <select
                                    value={paidPerPage}
                                    onChange={(e) => {
                                      const next = Number(e.target.value);
                                      setPaidPerPageByPioj((prev) => ({ ...prev, [pioj.id]: next }));
                                      setPaidPageByPioj((prev) => ({ ...prev, [pioj.id]: 1 }));
                                    }}
                                    className="bg-green-50 border border-green-200 rounded-lg px-2 py-1 text-xs font-bold text-green-700"
                                  >
                                    {[5, 10, 20, 50].map((option) => (
                                      <option key={`paid-page-size-${pioj.id}-${option}`} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              {paginatedPaidCommissions.map((commission) => (
                                <div
                                  key={`paid-commission-${commission.id}`}
                                  className="bg-green-50 border border-green-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                                >
                                  <div>
                                    <p className="font-bold text-gray-800">
                                      {commission.booking?.clientName || commission.referred?.name || 'Cliente referido'}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      ID #{commission.id} - {commission.created_at ? new Date(commission.created_at).toLocaleDateString('es-ES') : 'Sin fecha'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <p className="font-black text-green-700">
                                      {formatCurrency(commission.commission_amount || 0)}
                                    </p>
                                    <span className="text-xs font-black text-green-700 bg-green-100 border border-green-200 rounded-lg px-2 py-1">
                                      Pagado
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-gray-500 font-bold">
                                  Pagina {paidPage} de {paidTotalPages} - {paidCommissions.length} registros
                                </p>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => setPaidPageByPioj((prev) => ({ ...prev, [pioj.id]: Math.max(1, paidPage - 1) }))}
                                    disabled={paidPage === 1}
                                    className="h-8 px-3 bg-green-100 hover:bg-green-200 disabled:opacity-50 text-green-700 rounded-lg font-bold"
                                  >
                                    Anterior
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => setPaidPageByPioj((prev) => ({ ...prev, [pioj.id]: Math.min(paidTotalPages, paidPage + 1) }))}
                                    disabled={paidPage === paidTotalPages}
                                    className="h-8 px-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-bold"
                                  >
                                    Siguiente
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {pioj.pending_count > 0 && (
                            <div className="pt-3 border-t border-yellow-200">
                              <Button
                                onClick={() => handlePayAll(pioj)}
                                className="bg-green-500 hover:bg-green-600 text-white rounded-2xl px-6 py-3 font-bold shadow-lg transition-all w-full"
                              >
                                <DollarSign className="w-5 h-5 mr-2" />
                                Pagar todos ({pioj.pending_count})
                              </Button>
                            </div>
                          )}
                          </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EarningsDialog;
