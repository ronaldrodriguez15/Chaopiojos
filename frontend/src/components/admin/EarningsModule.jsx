import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Eye, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import Pagination from './Pagination';

const EarningsModule = React.memo(({ 
  piojologists,
  appointments,
  users,
  getServicePrice,
  formatCurrency,
  handleMarkServiceAsPaid,
  openPayDialog,
  setOpenPayDialog,
  openHistoryDialog,
  setOpenHistoryDialog
}) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmPayment, setConfirmPayment] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const maxPage = Math.ceil(piojologists.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && piojologists.length === 0) setCurrentPage(1);
  }, [piojologists.length, currentPage]);

  const stats = useMemo(() => {
    const completed = appointments.filter(a => a.status === 'completed');
    const totalBruto = completed.reduce((acc, curr) => acc + getServicePrice(curr), 0);
    
    let totalComisionEmpresa = 0;
    let totalPendientePago = 0;
    let totalYaPagado = 0;
    let serviciosCobrados = 0;
    
    completed.forEach(apt => {
      const piojologist = users.find(u => u.id === apt.piojologistId);
      const commissionRate = (piojologist?.commission_rate || 50) / 100;
      const servicePrice = getServicePrice(apt);
      const piojologistShare = servicePrice * commissionRate;
      const empresaShare = servicePrice * (1 - commissionRate);
      
      totalComisionEmpresa += empresaShare;
      
      const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
      if (paymentStatus === 'paid') {
        totalYaPagado += piojologistShare;
      } else {
        totalPendientePago += piojologistShare;
        serviciosCobrados++;
      }
    });

    return {
      serviciosCobrados,
      totalBruto,
      totalPendientePago,
      totalYaPagado
    };
  }, [appointments, users, getServicePrice]);

  const paginatedPiojologists = piojologists.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const cards = [
    { label: 'Servicios cobrados pendientes', value: stats.serviciosCobrados, tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: '⏳' },
    { label: 'Total facturado', value: formatCurrency(stats.totalBruto), tone: 'bg-blue-50 text-blue-700 border-blue-200', icon: '💰' },
    { label: 'Pendiente de pagar', value: formatCurrency(stats.totalPendientePago), tone: 'bg-red-50 text-red-700 border-red-200', icon: '🔴' },
    { label: 'Ya pagado', value: formatCurrency(stats.totalYaPagado), tone: 'bg-green-50 text-green-700 border-green-200', icon: '✅' }
  ];

  return (
    <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-green-100 space-y-8">
      <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
        <span className="text-3xl">💰</span> Control de Pagos a Piojólogas
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className={`rounded-2xl border-2 ${card.tone} p-4 font-black text-lg`}> 
            <p className="text-xs uppercase tracking-wide font-black opacity-70 flex items-center gap-2">
              <span>{card.icon}</span>
              {card.label}
            </p>
            <p className="text-2xl mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="p-4 font-black text-gray-400">Piojóloga</th>
              <th className="p-4 font-black text-gray-400 text-center">Comisión</th>
              <th className="p-4 font-black text-gray-400 text-center">Cobrados</th>
              <th className="p-4 font-black text-gray-400 text-right">Pendiente Pago</th>
              <th className="p-4 font-black text-gray-400 text-right">Ya Pagado</th>
              <th className="p-4 font-black text-gray-400 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPiojologists.map(pioj => {
              const completedServices = appointments.filter(a => a.piojologistId === pioj.id && a.status === 'completed');
              const commissionRate = (pioj.commission_rate || 50) / 100;
              
              let pendingPayment = 0;
              let alreadyPaid = 0;
              let pendingCount = 0;
              
              completedServices.forEach(apt => {
                const servicePrice = getServicePrice(apt);
                const piojologistShare = servicePrice * commissionRate;
                const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
                
                if (paymentStatus === 'paid') {
                  alreadyPaid += piojologistShare;
                } else {
                  pendingPayment += piojologistShare;
                  pendingCount++;
                }
              });

              return (
                <tr key={pioj.id} className="border-b border-gray-50 last:border-0 hover:bg-green-50/50 transition-colors">
                  <td className="p-4 font-bold text-gray-700 flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-green-700 text-xs">
                      {pioj.name.charAt(0)}
                    </div>
                    {pioj.name}
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-bold text-sm">
                      {pioj.commission_rate || 50}%
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-xl font-black">
                      {pendingCount}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-black text-red-600">
                      {formatCurrency(pendingPayment)}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-black text-green-600">
                      {formatCurrency(alreadyPaid)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {pendingCount > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setOpenPayDialog(pioj.id)}
                          className="h-10 w-10 rounded-xl bg-green-100 text-green-600 hover:bg-green-200"
                          title="Pagar Servicios"
                        >
                          <DollarSign className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {completedServices.length > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setOpenHistoryDialog(pioj.id)}
                          className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200"
                          title="Ver Historial"
                        >
                          <Eye className="w-5 h-5" />
                        </Button>
                      )}
                      
                      {completedServices.length === 0 && (
                        <span className="text-xs text-gray-400 font-bold">Sin servicios</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <Pagination
        currentPage={currentPage}
        totalItems={piojologists.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        colorScheme="green"
      />

      {/* Diálogo: Pagar Servicios */}
      <Dialog open={!!openPayDialog} onOpenChange={(open) => !open && setOpenPayDialog(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 overflow-hidden sm:max-w-2xl bg-green-50 shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="sr-only">
            <DialogTitle>Pagar Servicios Cobrados</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-black text-green-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                PAGAR SERVICIOS COBRADOS
              </h2>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-4 overflow-y-auto">
            {openPayDialog && (() => {
              const piojologist = piojologists.find(p => p.id === openPayDialog);
              if (!piojologist) return <p className="text-gray-500">Piojóloga no encontrada</p>;
              
              // Filtrar servicios pendientes y eliminar duplicados por ID
              const pendingServicesRaw = appointments.filter(apt => 
                apt.piojologistId === openPayDialog && 
                apt.status === 'completed' && 
                (apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending') === 'pending'
              );
              
              // Eliminar duplicados basándose en el ID (tomar el último en caso de duplicados)
              const uniqueIds = new Set();
              const pendingServices = pendingServicesRaw.filter(apt => {
                if (uniqueIds.has(apt.id)) {
                  return false; // Ya existe, saltar
                }
                uniqueIds.add(apt.id);
                return true;
              });
              
              if (pendingServices.length === 0) {
                return <p className="text-center text-gray-500 py-8 font-bold">No hay servicios pendientes de pago</p>;
              }
              
              const commissionRate = (piojologist.commission_rate || 50) / 100;
              
              return (
                <>
                  <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200 mb-4">
                    <h4 className="font-black text-gray-700 text-lg mb-2">{piojologist.name}</h4>
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Comisión:</span> {piojologist.commission_rate || 50}%
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Servicios pendientes:</span> {pendingServices.length}
                    </p>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pendingServices.map(apt => {
                      const servicePrice = getServicePrice(apt);
                      const piojologistShare = servicePrice * commissionRate;
                      
                      return (
                        <div key={apt.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-800">{apt.clientName}</p>
                              <p className="text-sm text-gray-500">{apt.serviceType}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-green-600 text-lg">{formatCurrency(piojologistShare)}</p>
                              <p className="text-xs text-gray-500">Comisión {piojologist.commission_rate || 50}%</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                            <span>📅 {new Date(apt.date).toLocaleDateString('es-ES')}</span>
                            <span>⏰ {apt.time}</span>
                          </div>
                          <Button
                            onClick={() => {
                              setConfirmPayment({
                                serviceId: apt.id,
                                piojologistId: piojologist.id,
                                piojologistName: piojologist.name,
                                amount: piojologistShare,
                                clientName: apt.clientName,
                                serviceType: apt.serviceType,
                                date: apt.date,
                                time: apt.time
                              });
                            }}
                            className="w-full bg-green-500 hover:bg-green-600 text-white rounded-xl py-2 font-bold"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Marcar como Pagado
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo: Ver Historial de Pagos */}
      <Dialog open={!!openHistoryDialog} onOpenChange={(open) => !open && setOpenHistoryDialog(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-blue-400 p-0 overflow-hidden sm:max-w-2xl bg-blue-50 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Historial de Servicios</DialogTitle>
          </DialogHeader>
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Eye className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-black text-blue-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                HISTORIAL DE SERVICIOS
              </h2>
            </div>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto">
            <div className="px-6 sm:px-8 pb-8 space-y-4">
              {openHistoryDialog && (() => {
                const piojologist = piojologists.find(p => p.id === openHistoryDialog);
                if (!piojologist) return <p className="text-gray-500">Piojóloga no encontrada</p>;
                
                const allServices = appointments.filter(apt => 
                  apt.piojologistId === openHistoryDialog && 
                  apt.status === 'completed'
                );
                
                if (allServices.length === 0) {
                  return <p className="text-center text-gray-500 py-8 font-bold">No hay servicios completados</p>;
                }
                
                const commissionRate = (piojologist.commission_rate || 50) / 100;
                const paidServices = allServices.filter(apt => 
                  (apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending') === 'paid'
                );
                const pendingServices = allServices.filter(apt => 
                  (apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending') === 'pending'
                );
                
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
                          <span className="text-gray-600 block mb-1">✅ Pagados</span>
                          <span className="font-black text-base text-green-700">{paidServices.length}</span>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-lg">
                          <span className="text-gray-600 block mb-1">⏳ Pendientes</span>
                          <span className="font-black text-base text-amber-700">{pendingServices.length}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {allServices.map(apt => {
                        const servicePrice = getServicePrice(apt);
                        const piojologistShare = servicePrice * commissionRate;
                        const isPaid = (apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending') === 'paid';
                        
                        return (
                          <div 
                            key={apt.id} 
                            className={`border-2 rounded-xl p-3 sm:p-4 ${
                              isPaid 
                                ? 'bg-green-50 border-green-300' 
                                : 'bg-amber-50 border-amber-300'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{apt.clientName}</p>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-black whitespace-nowrap ${
                                    isPaid 
                                      ? 'bg-green-200 text-green-800' 
                                      : 'bg-amber-200 text-amber-800'
                                  }`}>
                                    {isPaid ? '✅ Pagado' : '⏳ Pendiente'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600 truncate">{apt.serviceType}</p>
                              </div>
                              <div className="text-right ml-2 flex-shrink-0">
                                <p className={`font-black text-base sm:text-lg ${
                                  isPaid ? 'text-green-600' : 'text-amber-600'
                                }`}>
                                  {formatCurrency(piojologistShare)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Total: {formatCurrency(servicePrice)}
                                </p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-500 gap-2">
                              <span>📅 {new Date(apt.date).toLocaleDateString('es-ES')}</span>
                              <span>⏰ {apt.time}</span>
                            </div>
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

      {/* Modal de Confirmación de Pago */}
      <Dialog open={!!confirmPayment} onOpenChange={(open) => !open && setConfirmPayment(null)}>
        <DialogContent className="rounded-[3rem] border-4 border-green-400 p-0 sm:max-w-md bg-green-50 shadow-2xl">
          <div className="text-center pt-8 pb-6">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-black text-green-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                CONFIRMAR PAGO
              </h2>
            </div>
          </div>
          
          <div className="px-8 pb-8 text-center space-y-6">
            <div className="text-6xl mb-4">💵</div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">
              ¿Confirmar pago de este servicio?
            </h3>
            {confirmPayment && (
              <div className="bg-white rounded-2xl p-4 border-2 border-green-400">
                <p className="text-lg font-bold text-gray-800">{confirmPayment.clientName}</p>
                <p className="text-sm text-gray-600">{confirmPayment.serviceType}</p>
                <p className="text-2xl font-black text-green-600 mt-2">{formatCurrency(confirmPayment.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">Para: {confirmPayment.piojologistName}</p>
              </div>
            )}
            <p className="text-gray-600 text-sm">
              Este servicio se marcará como pagado y aparecerá en el historial.
            </p>
            
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
                  if (confirmPayment) {
                    await handleMarkServiceAsPaid(
                      confirmPayment.serviceId,
                      confirmPayment.piojologistId,
                      confirmPayment.piojologistName,
                      confirmPayment.amount,
                      confirmPayment.clientName,
                      confirmPayment.serviceType,
                      confirmPayment.date,
                      confirmPayment.time
                    );
                    setConfirmPayment(null);
                    // No cerrar el modal principal para que el usuario vea la lista actualizada
                  }
                }}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
              >
                Sí, Marcar como Pagado
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
