import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Pagination from './Pagination';

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
  setOpenHistoryDialog
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmPayment, setConfirmPayment] = useState(null);
  const [confirmRevertPayment, setConfirmRevertPayment] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const maxPage = Math.ceil(piojologists.length / itemsPerPage);
    if (currentPage > maxPage && maxPage > 0) setCurrentPage(maxPage);
    else if (currentPage > 1 && piojologists.length === 0) setCurrentPage(1);
  }, [piojologists.length, currentPage]);

  const referralByPiojologist = useMemo(() => {
    return (referralPayouts || []).reduce((acc, item) => {
      const id = Number(item.id);
      if (!Number.isFinite(id)) return acc;
      acc[id] = {
        pending: Number(item.pending_amount || 0),
        paid: Number(item.total_earned || 0),
        count: Number(item.total_commissions_count || 0)
      };
      return acc;
    }, {});
  }, [referralPayouts]);

  const paginatedPiojologists = piojologists.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getServiceCommissionBreakdown = (apt = {}, commissionRate = 0.5) => {
    const servicesPerPerson = Array.isArray(apt.services_per_person) ? apt.services_per_person : [];
    if (servicesPerPerson.length > 0) {
      const breakdown = servicesPerPerson.map((serviceName, idx) => {
        const basePrice = Number(serviceCatalog?.[serviceName] || 0);
        return {
          idx,
          serviceName,
          basePrice,
          commission: basePrice * commissionRate
        };
      });

      const sumBase = breakdown.reduce((acc, item) => acc + item.basePrice, 0);
      if (sumBase > 0) return breakdown;

      const fallbackPerPerson = Number(getServicePrice(apt) || 0) / servicesPerPerson.length;
      return breakdown.map((item) => ({
        ...item,
        basePrice: fallbackPerPerson,
        commission: fallbackPerPerson * commissionRate
      }));
    }

    const fallbackPrice = Number(getServicePrice(apt) || 0);
    return [{
      idx: 0,
      serviceName: apt.serviceType || 'Servicio',
      basePrice: fallbackPrice,
      commission: fallbackPrice * commissionRate
    }];
  };

  const getPiojologistShareByService = (apt = {}, commissionRate = 0.5) => {
    return getServiceCommissionBreakdown(apt, commissionRate)
      .reduce((sum, item) => sum + Number(item.commission || 0), 0);
  };

  const stats = useMemo(() => {
    const completed = appointments.filter(a => a.status === 'completed');
    const totalBruto = completed.reduce((acc, curr) => acc + getServicePrice(curr), 0);

    let totalPendientePago = 0;
    let totalYaPagado = 0;
    let serviciosCobrados = 0;

    completed.forEach(apt => {
      const piojologist = users.find(u => u.id === apt.piojologistId);
      const commissionRate = (piojologist?.commission_rate || 50) / 100;
      const piojologistShare = getPiojologistShareByService(apt, commissionRate);

      const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
      if (paymentStatus === 'paid') {
        totalYaPagado += piojologistShare;
      } else {
        totalPendientePago += piojologistShare;
        serviciosCobrados++;
      }
    });

    const referralPending = (referralPayouts || []).reduce((sum, row) => sum + Number(row.pending_amount || 0), 0);
    const referralPaid = (referralPayouts || []).reduce((sum, row) => sum + Number(row.total_earned || 0), 0);

    return {
      serviciosCobrados,
      totalBruto,
      totalPendienteServicios: totalPendientePago,
      totalPendienteReferidos: referralPending,
      totalPagadoServicios: totalYaPagado,
      totalPagadoReferidos: referralPaid,
      totalPendientePago: totalPendientePago + referralPending,
      totalYaPagado: totalYaPagado + referralPaid
    };
  }, [appointments, users, getServicePrice, referralPayouts, serviceCatalog]);

  const cards = [
    { label: 'Servicios cobrados pendientes', value: stats.serviciosCobrados, tone: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'P' },
    { label: 'Total facturado', value: formatCurrency(stats.totalBruto), tone: 'bg-blue-50 text-blue-700 border-blue-200', icon: '$' },
    { label: 'Pendiente de pagar', value: formatCurrency(stats.totalPendientePago), tone: 'bg-red-50 text-red-700 border-red-200', icon: '!' },
    { label: 'Ya pagado', value: formatCurrency(stats.totalYaPagado), tone: 'bg-green-50 text-green-700 border-green-200', icon: 'OK' }
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
            {card.label === 'Pendiente de pagar' && (
              <p className="text-xs font-bold mt-2 opacity-80">
                Servicios: {formatCurrency(stats.totalPendienteServicios)} | Referidos: {formatCurrency(stats.totalPendienteReferidos)}
              </p>
            )}
            {card.label === 'Ya pagado' && (
              <p className="text-xs font-bold mt-2 opacity-80">
                Servicios: {formatCurrency(stats.totalPagadoServicios)} | Referidos: {formatCurrency(stats.totalPagadoReferidos)}
              </p>
            )}
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
              const referralData = referralByPiojologist[Number(pioj.id)] || { pending: 0, paid: 0, count: 0 };
              const hasPendingReferrals = Number(referralData.pending || 0) > 0;
              
              let pendingPaymentServices = 0;
              let alreadyPaidServices = 0;
              let pendingCount = 0;
              
              completedServices.forEach(apt => {
                const piojologistShare = getPiojologistShareByService(apt, commissionRate);
                const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
                
                if (paymentStatus === 'paid') {
                  alreadyPaidServices += piojologistShare;
                } else {
                  pendingPaymentServices += piojologistShare;
                  pendingCount++;
                }
              });

              const pendingPayment = pendingPaymentServices + referralData.pending;
              const alreadyPaid = alreadyPaidServices + referralData.paid;

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
                    <p className="text-[11px] text-gray-600 font-bold mt-1">
                      Servicios: {formatCurrency(pendingPaymentServices)}
                    </p>
                    <p className="text-[11px] text-purple-600 font-bold mt-1">
                      Referidos: {formatCurrency(referralData.pending)}
                    </p>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-black text-green-600">
                      {formatCurrency(alreadyPaid)}
                    </span>
                    <p className="text-[11px] text-gray-600 font-bold mt-1">
                      Servicios: {formatCurrency(alreadyPaidServices)}
                    </p>
                    <p className="text-[11px] text-purple-600 font-bold mt-1">
                      Referidos: {formatCurrency(referralData.paid)}
                    </p>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {(pendingCount > 0 || hasPendingReferrals) && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setOpenPayDialog(pioj.id)}
                          className="h-10 w-10 rounded-xl bg-green-100 text-green-600 hover:bg-green-200"
                          title="Pagar y ver detalle"
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

      {/* DiÃ¡logo: Pagar Servicios */}
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
              const pendingReferralCommissions = (referralCommissionsList || []).filter(c => {
                const referrerId = Number(c.referrer_id ?? c.referrer?.id);
                return referrerId === Number(openPayDialog) && c.status === 'pending';
              });
              
              // Filtrar servicios pendientes y eliminar duplicados por ID
              const pendingServicesRaw = appointments.filter(apt => 
                apt.piojologistId === openPayDialog && 
                apt.status === 'completed' && 
                (apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending') === 'pending'
              );
              
              // Eliminar duplicados basÃ¡ndose en el ID (tomar el Ãºltimo en caso de duplicados)
              const uniqueIds = new Set();
              const pendingServices = pendingServicesRaw.filter(apt => {
                if (uniqueIds.has(apt.id)) {
                  return false; // Ya existe, saltar
                }
                uniqueIds.add(apt.id);
                return true;
              });
              
              if (pendingServices.length === 0 && pendingReferralCommissions.length === 0) {
                return <p className="text-center text-gray-500 py-8 font-bold">No hay cobros pendientes para esta piojologa</p>;
              }
              
              const commissionRate = (piojologist.commission_rate || 50) / 100;
              const pendingServicesTotal = pendingServices.reduce((sum, apt) => {
                return sum + getPiojologistShareByService(apt, commissionRate);
              }, 0);
              const pendingReferralsTotal = pendingReferralCommissions.reduce((sum, c) => sum + Number(c.commission_amount || 0), 0);
              const pendingCombinedTotal = pendingServicesTotal + pendingReferralsTotal;
              
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
                    <p className="text-sm text-gray-600">
                      <span className="font-bold">Referidos pendientes:</span> {pendingReferralCommissions.length}
                    </p>
                    <p className="text-sm text-gray-700 font-bold">
                      Servicios: {formatCurrency(pendingServicesTotal)} | Referidos: {formatCurrency(pendingReferralsTotal)}
                    </p>
                    <p className="text-base text-green-700 font-black">
                      Total por cobrar: {formatCurrency(pendingCombinedTotal)}
                    </p>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pendingServices.length > 0 && (
                      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-3">
                        <p className="text-sm font-black text-emerald-700">Servicios pendientes</p>
                      </div>
                    )}
                    {pendingServices.map(apt => {
                      const servicePrice = getServicePrice(apt);
                      const piojologistShare = getPiojologistShareByService(apt, commissionRate);
                      const commissionBreakdown = getServiceCommissionBreakdown(apt, commissionRate);
                      
                      return (
                        <div key={apt.id} className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-green-300 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-800">{apt.clientName}</p>
                              <p className="text-sm text-gray-500">{apt.serviceType}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-blue-700 text-sm">Servicio: {formatCurrency(servicePrice)}</p>
                              <p className="font-black text-green-600 text-lg">Comision: {formatCurrency(piojologistShare)}</p>
                              <p className="text-xs text-gray-500">Tasa {piojologist.commission_rate || 50}%</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                            <span> {new Date(apt.date).toLocaleDateString('es-ES')}</span>
                            <span> {apt.time}</span>
                          </div>
                          {commissionBreakdown.length > 0 && (
                            <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 space-y-1.5">
                              <p className="text-[11px] font-black text-emerald-700 uppercase">Comision por servicio</p>
                              {commissionBreakdown.map((item) => (
                                <div key={`${apt.id}-commission-${item.idx}`} className="flex items-center justify-between text-xs font-bold text-gray-700">
                                  <span>Persona {item.idx + 1}: {item.serviceName}</span>
                                  <span className="text-emerald-700">{formatCurrency(item.commission)}</span>
                                </div>
                              ))}
                            </div>
                          )}
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
                            Marcar servicio como pagado
                          </Button>
                        </div>
                      );
                    })}
                    {pendingReferralCommissions.length > 0 && (
                      <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 mt-4">
                        <p className="text-sm font-black text-purple-700">Referidos pendientes</p>
                        <p className="text-xs text-purple-600 font-bold">
                          Desglose informativo de cobros por referido.
                        </p>
                      </div>
                    )}
                    {pendingReferralCommissions.map((commission) => (
                      <div key={`ref-${commission.id}`} className="bg-white border-2 border-purple-200 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-gray-800">{commission.booking?.clientName || 'Cliente referido'}</p>
                            <p className="text-sm text-gray-500">Comision por referido</p>
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

      {/* DiÃ¡logo: Ver Historial de Pagos */}
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
                const referralData = referralByPiojologist[Number(piojologist.id)] || { pending: 0, paid: 0, count: 0 };
                
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
                          <span className="text-gray-600 block mb-1">Pagados</span>
                          <span className="font-black text-base text-green-700">{paidServices.length}</span>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-lg">
                          <span className="text-gray-600 block mb-1">Pendientes</span>
                          <span className="font-black text-base text-amber-700">{pendingServices.length}</span>
                        </div>
                        <div className="bg-purple-50 p-2.5 rounded-lg col-span-2">
                          <span className="text-gray-600 block mb-1">Bonos referidos</span>
                          <span className="font-black text-base text-purple-700">
                            Pendiente: {formatCurrency(referralData.pending)} | Pagado: {formatCurrency(referralData.paid)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {allServices.map(apt => {
                        const servicePrice = getServicePrice(apt);
                        const piojologistShare = getPiojologistShareByService(apt, commissionRate);
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
                                    {isPaid ? '✔ Pagado' : 'Pendiente'}
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
                              <span> {new Date(apt.date).toLocaleDateString('es-ES')}</span>
                              <span> {apt.time}</span>
                            </div>
                            {isPaid && (
                              <div className="mt-3 pt-3 border-t border-green-200">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    setConfirmRevertPayment({
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

      {/* Modal de ConfirmaciÃ³n de Pago */}
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
            <div className="text-6xl mb-4">ðŸ’µ</div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">
              Â¿Confirmar pago de este servicio?
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
              Este servicio se marcarÃ¡ como pagado y aparecerÃ¡ en el historial.
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
                SÃ­, Marcar como Pagado
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
              <h2 className="text-2xl font-black text-amber-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
                REVERTIR PAGO
              </h2>
            </div>
          </div>

          <div className="px-8 pb-8 text-center space-y-6">
            <div className="text-6xl mb-4">↩️</div>
            <h3 className="text-lg font-medium text-gray-700 mb-4">
              ¿Revertir este servicio a pendiente?
            </h3>
            {confirmRevertPayment && (
              <div className="bg-white rounded-2xl p-4 border-2 border-amber-300">
                <p className="text-lg font-bold text-gray-800">{confirmRevertPayment.clientName}</p>
                <p className="text-sm text-gray-600">{confirmRevertPayment.serviceType}</p>
                <p className="text-2xl font-black text-amber-600 mt-2">{formatCurrency(confirmRevertPayment.amount)}</p>
                <p className="text-xs text-gray-500 mt-1">Para: {confirmRevertPayment.piojologistName}</p>
              </div>
            )}
            <p className="text-gray-600 text-sm">
              Este servicio volvera al estado pendiente de pago.
            </p>

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
                  if (confirmRevertPayment && typeof handleRevertServicePayment === 'function') {
                    await handleRevertServicePayment(
                      confirmRevertPayment.serviceId,
                      confirmRevertPayment.piojologistId,
                      confirmRevertPayment.piojologistName,
                      confirmRevertPayment.amount,
                      confirmRevertPayment.clientName,
                      confirmRevertPayment.serviceType,
                      confirmRevertPayment.date,
                      confirmRevertPayment.time
                    );
                    setConfirmRevertPayment(null);
                  }
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
              >
                Si, Revertir
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


