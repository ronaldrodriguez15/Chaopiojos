import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader, Users } from "lucide-react";

const EarningsDialog = ({
  isOpen,
  onClose,
  loadingEarnings,
  earningsHistory,
  formatCurrency,
  handlePayAll
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 sm:max-w-4xl w-[95vw] bg-yellow-50 shadow-2xl">
        {/* Title */}
        <div className="text-center pt-8 pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <DollarSign className="w-6 h-6 text-yellow-600" />
            <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
              GANANCIAS DE REFERIDOS
            </h2>
          </div>
        </div>

        <div className="px-8 pb-8 space-y-6">
          {loadingEarnings ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader className="w-12 h-12 animate-spin text-yellow-500" />
              <p className="text-gray-500 font-bold">Cargando historial...</p>
            </div>
          ) : earningsHistory.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 font-bold text-lg">No hay historial de comisiones aún</p>
              <p className="text-sm text-gray-400 mt-2">Las comisiones aparecerán cuando las piojólogas referidas completen servicios</p>
            </div>
          ) : (
            <>
              {/* Resumen Global */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6">
                  <p className="text-sm text-yellow-600 font-bold mb-2">💸 Total Pagado</p>
                  <p className="text-4xl font-bold text-gray-800">
                    {formatCurrency(earningsHistory.reduce((sum, p) => sum + (p.total_earned || 0), 0))}
                  </p>
                </div>
                <div className="bg-white border-2 border-yellow-400 rounded-2xl p-6">
                  <p className="text-sm text-yellow-600 font-bold mb-2">⏳ Total Pendiente</p>
                  <p className="text-4xl font-bold text-gray-800">
                    {formatCurrency(earningsHistory.reduce((sum, p) => sum + (p.pending_amount || 0), 0))}
                  </p>
                </div>
              </div>

              {/* Lista de Piojólogas con Comisiones */}
              <div className="space-y-4">
                <h4 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-6 h-6 text-yellow-600" />
                  Detalles por Piojóloga
                </h4>

                {earningsHistory.map(pioj => (
                  <div
                    key={pioj.id}
                    className="bg-white border-2 border-yellow-400 rounded-2xl p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center text-2xl">
                            👩‍⚕️
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 text-lg">{pioj.name}</p>
                            <p className="text-sm text-gray-600">{pioj.email}</p>
                            {pioj.referral_code && (
                              <p className="text-xs font-bold text-yellow-600 mt-1">
                                Código: {pioj.referral_code}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                            <p className="text-xs text-yellow-600 font-bold">Total Comisiones</p>
                            <p className="text-xl font-bold text-gray-800">{pioj.total_commissions_count || 0}</p>
                          </div>
                          <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                            <p className="text-xs text-green-600 font-bold">✓ Pagadas</p>
                            <p className="text-xl font-bold text-gray-800">{pioj.paid_count || 0}</p>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                            <p className="text-xs text-orange-600 font-bold">⏳ Pendientes</p>
                            <p className="text-xl font-bold text-gray-800">{pioj.pending_count || 0}</p>
                          </div>
                          <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200">
                            <p className="text-xs text-yellow-600 font-bold">💰 Ganado</p>
                            <p className="text-lg font-bold text-gray-800">
                              {formatCurrency(pioj.total_earned || 0)}
                            </p>
                          </div>
                        </div>

                        {pioj.pending_count > 0 && (
                          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <p className="text-sm font-bold text-orange-600 mb-2">
                              💵 Monto pendiente de pago: {formatCurrency(pioj.pending_amount || 0)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Botón Pagar Todos */}
                      {pioj.pending_count > 0 && (
                        <div className="flex-shrink-0">
                          <Button
                            onClick={() => handlePayAll(pioj)}
                            className="bg-green-500 hover:bg-green-600 text-white rounded-2xl px-6 py-3 font-bold shadow-lg transition-all w-full"
                          >
                            <DollarSign className="w-5 h-5 mr-2" />
                            Pagar Todos ({pioj.pending_count})
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EarningsDialog;
