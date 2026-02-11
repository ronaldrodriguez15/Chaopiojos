import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import Pagination from './Pagination';

const RequestsModule = React.memo(({ 
  productRequests,
  resolveRequestTotals,
  formatCurrency,
  onApproveRequest,
  onRejectRequest
}) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [requestToApprove, setRequestToApprove] = useState(null);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const maxPage = Math.ceil(productRequests.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && productRequests.length === 0) setCurrentPage(1);
  }, [productRequests.length, currentPage]);

  const paginatedRequests = productRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="bg-white rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-xl border-4 border-purple-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <h3 className="text-xl sm:text-2xl font-black text-gray-800 flex items-center gap-3">
          <span className="text-3xl">📦</span> Solicitudes de Productos
        </h3>
        <div className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
          {productRequests.filter(r => r.status === 'pending').length} pendientes
        </div>
      </div>

      {productRequests.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl border-4 border-purple-200">
          <div className="relative inline-block">
            <div className="text-8xl mb-4 animate-pulse">📋</div>
            <div className="absolute -top-2 -right-2 text-4xl">💫</div>
          </div>
          <h4 className="font-black text-2xl text-gray-800 mb-2">
            ¡Todo al día!
          </h4>
          <p className="text-gray-600 font-bold mb-6 max-w-md mx-auto">
            No hay solicitudes pendientes por el momento. Las piojólogas pueden solicitar sus productos cuando lo necesiten 🌟
          </p>
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full font-bold text-sm">
            <span>✅</span>
            <span>Las nuevas solicitudes aparecerán aquí automáticamente</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedRequests.map(request => {
            const pricing = resolveRequestTotals(request);
            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 sm:p-6 rounded-2xl border-4 ${
                  request.status === 'pending' 
                    ? 'bg-yellow-50 border-yellow-200' 
                    : request.status === 'approved'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                  <div className="flex-1">
                    <h4 className="text-base sm:text-lg font-bold text-gray-800">
                      {request.piojologistName}
                    </h4>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                      {new Date(request.requestDate).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-black text-xs sm:text-sm whitespace-nowrap self-start ${
                    request.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                    request.status === 'approved' ? 'bg-green-200 text-green-800' :
                    'bg-red-200 text-red-800'
                  }`}>
                    {request.status === 'pending' ? '⏳ PENDIENTE' :
                     request.status === 'approved' ? '✅ APROBADO' : '❌ RECHAZADO'}
                  </span>
                </div>

                {request.isKitCompleto ? (
                  <div className="bg-white p-3 sm:p-4 rounded-xl border-2 border-purple-200 mb-3 sm:mb-4">
                    <p className="text-xs sm:text-sm font-bold text-purple-700 mb-3">🎁 Kit Completo</p>
                    <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
                      <div className="p-2.5 rounded-lg">
                        <p className="text-xs text-gray-500 mb-1">Valor Kit</p>
                        <p className="font-black text-base sm:text-lg">{formatCurrency(pricing.baseKitPrice)}</p>
                      </div>
                      {request.isFirstKitBenefit && (
                        <>
                          <div className="bg-green-50 p-2.5 rounded-lg">
                            <p className="text-xs text-gray-500 mb-1">Aporte Estudio</p>
                            <p className="font-black text-base sm:text-lg text-green-600">{formatCurrency(pricing.studioShare)}</p>
                          </div>
                          <div className="bg-blue-50 p-2.5 rounded-lg sm:col-span-2">
                            <p className="text-xs text-gray-500 mb-1">Aporte Piojóloga</p>
                            <p className="font-black text-base sm:text-lg text-blue-600">{formatCurrency(pricing.piojologistShare)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 mb-3 sm:mb-4">
                    {(request.items || []).map((item, idx) => (
                      <div key={idx} className="bg-white p-2.5 sm:p-3 rounded-xl border border-gray-200 flex justify-between items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm sm:text-base text-gray-800 truncate">{item.productName || item.name}</p>
                          <p className="text-xs text-gray-500">Cantidad: {item.quantity}</p>
                        </div>
                        <p className="font-black text-sm sm:text-base text-purple-600 whitespace-nowrap">{formatCurrency(item.subtotal || (Number(item.price || 0) * Number(item.quantity || 1)))}</p>
                      </div>
                    ))}
                    <div className="bg-purple-50 p-3 sm:p-4 rounded-xl border-2 border-purple-200 flex justify-between items-center">
                      <p className="font-black text-base sm:text-lg text-gray-700">Total</p>
                      <p className="font-black text-lg sm:text-xl text-purple-600">{formatCurrency(pricing.total)}</p>
                    </div>
                  </div>
                )}

                {request.status === 'pending' ? (
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <Button
                      onClick={() => {
                        setRequestToApprove(request);
                        setApproveNotes('');
                        setApproveDialogOpen(true);
                      }}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl py-3 sm:py-4 font-bold text-base"
                    >
                      ✅ Aprobar
                    </Button>
                    <Button
                      onClick={() => {
                        setRequestToReject(request);
                        setRejectReason('');
                        setRejectDialogOpen(true);
                      }}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 sm:py-4 font-bold text-base"
                    >
                      ❌ Rechazar
                    </Button>
                  </div>
                ) : (
                  <div className="bg-white p-3 sm:p-4 rounded-xl border-2 border-gray-200 mt-3 sm:mt-4">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-base sm:text-lg flex-shrink-0">{request.status === 'approved' ? '✅' : '❌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-gray-700">
                          {request.status === 'approved' ? 'Aprobado' : 'Rechazado'} por {request.resolvedByName}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {new Date(request.resolvedDate).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    {request.adminNotes && (
                      <p className="text-xs sm:text-sm text-gray-700 mt-2 pl-6 sm:pl-0">
                        <span className="font-bold">Comentario:</span> {request.adminNotes}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
      
      <Pagination
        currentPage={currentPage}
        totalItems={productRequests.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        colorScheme="purple"
      />

      {/* Dialog de Aprobación */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 overflow-hidden sm:max-w-md bg-green-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Aprobación</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-black text-green-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                APROBAR SOLICITUD
              </h2>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="px-8 pb-8 text-center space-y-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                ¿Estás seguro de aprobar esta solicitud?
              </h3>
              {requestToApprove && (
                <div className="bg-white rounded-2xl p-4 border-2 border-green-400">
                  <p className="text-lg font-bold text-gray-800">{requestToApprove.piojologistName}</p>
                  <p className="text-sm text-gray-600">Solicitud de productos</p>
                </div>
              )}
              
              <div className="text-left">
                <label className="block text-sm font-medium text-gray-600 mb-2">Comentario (Opcional)</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="w-full bg-white border-2 border-green-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-green-500 transition-all resize-none"
                  placeholder="Ej. Solicitud aprobada, los productos estarán listos mañana..."
                  rows="3"
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setApproveDialogOpen(false);
                    setRequestToApprove(null);
                    setApproveNotes('');
                  }}
                  className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onApproveRequest(requestToApprove.id, approveNotes);
                    toast({
                      title: "✅ Solicitud Aprobada",
                      description: `La solicitud de ${requestToApprove.piojologistName} fue aprobada exitosamente`,
                      className: "rounded-3xl border-4 border-green-200 bg-green-50 text-green-600 font-bold"
                    });
                    setApproveDialogOpen(false);
                    setRequestToApprove(null);
                    setApproveNotes('');
                  }}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
                >
                  Sí, Aprobar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Rechazo */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="rounded-[3rem] border-4 border-red-400 p-0 overflow-hidden sm:max-w-md bg-red-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Rechazo</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <X className="w-6 h-6 text-red-600" />
              <h2 className="text-2xl font-black text-red-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                RECHAZAR SOLICITUD
              </h2>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="px-8 pb-8 text-center space-y-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4">
                ¿Estás seguro de rechazar esta solicitud?
              </h3>
              {requestToReject && (
                <div className="bg-white rounded-2xl p-4 border-2 border-red-400">
                  <p className="text-lg font-bold text-gray-800">{requestToReject.piojologistName}</p>
                  <p className="text-sm text-gray-600">Solicitud de productos</p>
                </div>
              )}
              
              <div className="text-left">
                <label className="block text-sm font-medium text-gray-600 mb-2">Motivo del rechazo</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-white border-2 border-red-400 rounded-2xl p-4 text-gray-700 outline-none focus:border-red-500 transition-all resize-none"
                  placeholder="Ej. Productos no disponibles en este momento..."
                  rows="3"
                />
              </div>
              
              <div className="flex gap-4 pt-4">
                <Button 
                  type="button" 
                  onClick={() => {
                    setRejectDialogOpen(false);
                    setRequestToReject(null);
                    setRejectReason('');
                  }}
                  className="flex-1 rounded-2xl py-3 px-6 font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 border-2 border-gray-300 transition-all"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    if (requestToReject) {
                      onRejectRequest(requestToReject.id, rejectReason);
                      toast({
                        title: "❌ Solicitud Rechazada",
                        description: `La solicitud de ${requestToReject.piojologistName} fue rechazada`,
                        className: "rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold"
                      });
                      setRejectDialogOpen(false);
                      setRequestToReject(null);
                      setRejectReason('');
                    }
                  }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
                >
                  Sí, Rechazar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

RequestsModule.displayName = 'RequestsModule';

export default RequestsModule;
