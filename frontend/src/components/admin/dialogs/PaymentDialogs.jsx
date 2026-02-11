import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DollarSign, Loader } from "lucide-react";

export const PayAllDialog = ({
  isOpen,
  onClose,
  selectedPiojologist,
  confirmPayAll,
  formatCurrency
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] border-4 border-green-200 p-0 overflow-hidden sm:max-w-md bg-gradient-to-b from-green-50 to-white">
        <div className="p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
            <span className="text-4xl">💰</span>
          </div>

          <h3 className="text-2xl font-black text-gray-800 mb-3">
            ¿Pagar Todas las Comisiones?
          </h3>

          {selectedPiojologist && (
            <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-6">
              <p className="text-gray-700 font-bold mb-2">{selectedPiojologist.name}</p>
              <p className="text-sm text-gray-600 mb-3">
                Se marcarán como pagadas {selectedPiojologist.pending_count} comisiones pendientes
              </p>
              <p className="text-2xl font-black text-green-600">
                Total: {formatCurrency(selectedPiojologist.pending_amount || 0)}
              </p>
            </div>
          )}

          <p className="text-gray-600 mb-6 leading-relaxed">
            Esta acción marcará todas las comisiones pendientes como pagadas. 
            <span className="font-bold text-yellow-600"> Esta acción no se puede deshacer.</span>
          </p>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl py-4 font-bold border-2 border-gray-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmPayAll}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl py-4 font-bold shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
            >
              <DollarSign className="w-5 h-5 mr-2" />
              Confirmar Pago
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const PaymentConfirmDialog = ({
  isOpen,
  onClose,
  paymentData,
  isProcessingPayment,
  confirmMarkServiceAsPaid,
  formatCurrency
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[2.5rem] border-4 border-green-200 p-0 overflow-hidden sm:max-w-md bg-gradient-to-b from-green-50 to-white">
        <DialogHeader className="sr-only">
          <DialogTitle>Confirmar pago a piojóloga</DialogTitle>
        </DialogHeader>
        <div className="p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
            <span className="text-4xl">💰</span>
          </div>

          <h3 className="text-2xl font-black text-gray-800 mb-3">
            ¿Confirmar Pago?
          </h3>

          {paymentData && (
            <div className="space-y-4 mb-6">
              {/* Información del Servicio */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 text-left">
                <p className="text-xs text-blue-600 font-bold mb-2">📋 SERVICIO</p>
                <p className="font-bold text-gray-800">{paymentData.clientName}</p>
                <p className="text-sm text-gray-600">{paymentData.serviceType}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(paymentData.date).toLocaleDateString()} • {paymentData.time}
                </p>
              </div>

              {/* Información del Pago */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 text-left">
                <p className="text-xs text-purple-600 font-bold mb-2">👩‍⚕️ PIOJÓLOGA</p>
                <p className="font-bold text-gray-800">{paymentData.piojologistName}</p>
              </div>

              {/* Monto */}
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6">
                <p className="text-xs text-green-600 font-bold mb-2">💵 MONTO A PAGAR</p>
                <p className="text-4xl font-black text-green-600">
                  {formatCurrency(paymentData.amount)}
                </p>
              </div>
            </div>
          )}

          <p className="text-gray-600 mb-6 leading-relaxed text-sm">
            Se marcará este servicio como pagado.
            <br />
            <span className="font-bold text-yellow-600">Esta acción no se puede deshacer.</span>
          </p>

          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              disabled={isProcessingPayment}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl py-4 font-bold border-2 border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={confirmMarkServiceAsPaid}
              disabled={isProcessingPayment}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl py-4 font-bold shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessingPayment ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <DollarSign className="w-5 h-5 mr-2" />
                  Confirmar Pago
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
