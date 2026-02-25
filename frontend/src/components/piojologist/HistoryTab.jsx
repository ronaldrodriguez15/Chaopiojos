import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HistoryTab = ({ completedHistory, commissionRate, getServicePrice, formatCurrency, serviceCatalog = {} }) => {
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPerPage, setPendingPerPage] = useState(5);
  const [paidPage, setPaidPage] = useState(1);
  const [paidPerPage, setPaidPerPage] = useState(5);

  const pendingServices = useMemo(() => {
    return completedHistory.filter((apt) => {
      const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
      return paymentStatus === 'pending';
    });
  }, [completedHistory]);

  const paidServices = useMemo(() => {
    return completedHistory.filter((apt) => {
      const paymentStatus = apt.payment_status_to_piojologist || apt.paymentStatusToPiojologist || 'pending';
      return paymentStatus === 'paid';
    });
  }, [completedHistory]);

  const getPerPersonBreakdown = (apt = {}) => {
    const fromArray = Array.isArray(apt.services_per_person) ? apt.services_per_person : [];
    if (fromArray.length > 0) {
      return fromArray.map((serviceName, idx) => ({
        idx,
        serviceName,
        amount: Number(serviceCatalog?.[serviceName] || 0)
      }));
    }

    const people = Math.max(1, Number(apt.numPersonas) || 1);
    if (!apt.serviceType) return [];
    const fallbackAmount = Number(serviceCatalog?.[apt.serviceType] || 0);
    return Array.from({ length: people }, (_, idx) => ({
      idx,
      serviceName: apt.serviceType,
      amount: fallbackAmount
    }));
  };

  const getCommissionByServiceTotal = (apt = {}) => {
    const perPerson = getPerPersonBreakdown(apt);
    if (perPerson.length > 0) {
      const sum = perPerson.reduce((acc, item) => acc + (Number(item.amount || 0) * commissionRate), 0);
      if (sum > 0) return sum;
    }

    const fallbackPrice = Number(getServicePrice(apt) || 0);
    return fallbackPrice * commissionRate;
  };

  const pendingTotal = useMemo(() => {
    return pendingServices.reduce((acc, apt) => {
      const gross = getCommissionByServiceTotal(apt);
      const deductions = Number(apt.deductions) || 0;
      return acc + (gross - deductions);
    }, 0);
  }, [pendingServices, commissionRate, getServicePrice, serviceCatalog]);

  const paidTotal = useMemo(() => {
    return paidServices.reduce((acc, apt) => {
      const gross = getCommissionByServiceTotal(apt);
      const deductions = Number(apt.deductions) || 0;
      return acc + (gross - deductions);
    }, 0);
  }, [paidServices, commissionRate, getServicePrice, serviceCatalog]);

  const pendingTotalPages = Math.max(1, Math.ceil(pendingServices.length / pendingPerPage));
  const paidTotalPages = Math.max(1, Math.ceil(paidServices.length / paidPerPage));

  const paginatedPending = pendingServices.slice((pendingPage - 1) * pendingPerPage, pendingPage * pendingPerPage);
  const paginatedPaid = paidServices.slice((paidPage - 1) * paidPerPage, paidPage * paidPerPage);

  useEffect(() => {
    setPendingPage(1);
  }, [pendingPerPage, pendingServices.length]);

  useEffect(() => {
    setPaidPage(1);
  }, [paidPerPage, paidServices.length]);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  useEffect(() => {
    if (paidPage > paidTotalPages) setPaidPage(paidTotalPages);
  }, [paidPage, paidTotalPages]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-amber-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-amber-700 flex items-center gap-2">
            <Clock className="w-6 h-6" /> Cobrados - Pendientes de Pago
          </h3>
          <div className="text-right">
            <p className="text-xs text-amber-600 font-bold">Total pendiente</p>
            <p className="text-2xl font-black text-amber-700">{formatCurrency(pendingTotal)}</p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Por pagina</span>
              <select
                value={pendingPerPage}
                onChange={(e) => setPendingPerPage(Number(e.target.value))}
                className="bg-amber-50 border-2 border-amber-200 rounded-xl px-2.5 py-1 text-xs font-bold text-amber-700 outline-none"
              >
                {[5, 10, 20, 50].map((option) => (
                  <option key={`pending-history-size-${option}`} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {pendingServices.length === 0 ? (
          <div className="text-center py-12 text-amber-400 font-bold">No hay servicios pendientes de pago</div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedPending.map((apt) => (
                <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-amber-50 rounded-2xl border-2 border-amber-200 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-black">PENDIENTE</span>
                    </div>
                    <p className="font-black text-gray-800">{apt.clientName}</p>
                    <p className="text-xs text-gray-500">{new Date(apt.date).toLocaleDateString()} - {apt.serviceType}</p>
                    {getPerPersonBreakdown(apt).length > 0 && (
                      <div className="mt-2 bg-white/70 border border-amber-200 rounded-xl p-2 space-y-1">
                        <p className="text-[11px] font-black text-amber-700 uppercase">Detalle por persona</p>
                        {getPerPersonBreakdown(apt).map((item) => (
                          <div key={`${apt.id}-pending-person-${item.idx}`} className="flex items-center justify-between text-xs font-bold text-gray-700">
                            <span>Persona {item.idx + 1}: {item.serviceName}</span>
                            <span className="text-amber-700">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(apt.yourLoss || apt.ourPayment || apt.age) && (
                      <p className="text-xs text-yellow-600 font-bold mt-1">
                        {apt.age ? `${apt.age}a ` : ''}| Pierdes: {formatCurrency(parseFloat(apt.yourLoss) || 0)} | Te pagamos: {formatCurrency(parseFloat(apt.ourPayment) || 0)}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    {(() => {
                      const gross = getCommissionByServiceTotal(apt);
                      const deductions = Number(apt.deductions) || 0;
                      const net = gross - deductions;
                      return (
                        <>
                          <p className="text-xs text-gray-500 mb-1">A recibir</p>
                          <p className="text-amber-600 font-black text-xl">+{formatCurrency(net)}</p>
                          {deductions > 0 && (
                            <p className="text-xs text-red-400 font-bold">-{formatCurrency(deductions)} en productos</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t-2 border-amber-100">
              <p className="text-xs font-bold text-gray-500">Pagina {pendingPage} de {pendingTotalPages} - {pendingServices.length} registros</p>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => setPendingPage((p) => Math.max(1, p - 1))} disabled={pendingPage === 1} className="bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-700 rounded-xl px-3 py-2 font-bold">Anterior</Button>
                <Button type="button" onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))} disabled={pendingPage === pendingTotalPages} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl px-3 py-2 font-bold">Siguiente</Button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl border-4 border-green-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-green-700 flex items-center gap-2">
            <Check className="w-6 h-6" /> Ya Pagados
          </h3>
          <div className="text-right">
            <p className="text-xs text-green-600 font-bold">Total recibido</p>
            <p className="text-2xl font-black text-green-700">{formatCurrency(paidTotal)}</p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <span className="text-[11px] font-bold text-gray-500 uppercase">Por pagina</span>
              <select
                value={paidPerPage}
                onChange={(e) => setPaidPerPage(Number(e.target.value))}
                className="bg-green-50 border-2 border-green-200 rounded-xl px-2.5 py-1 text-xs font-bold text-green-700 outline-none"
              >
                {[5, 10, 20, 50].map((option) => (
                  <option key={`paid-history-size-${option}`} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {paidServices.length === 0 ? (
          <div className="text-center py-12 text-gray-400 font-bold">Aun no hay pagos recibidos.</div>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedPaid.map((apt) => (
                <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-green-50 rounded-2xl border-2 border-green-200 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-black">PAGADO</span>
                    </div>
                    <p className="font-black text-gray-800">{apt.clientName}</p>
                    <p className="text-xs text-gray-500">{new Date(apt.date).toLocaleDateString()} - {apt.serviceType}</p>
                    {(apt.yourLoss || apt.ourPayment || apt.age) && (
                      <p className="text-xs text-yellow-600 font-bold mt-1">
                        {apt.age ? `${apt.age}a ` : ''}| Pierdes: {formatCurrency(parseFloat(apt.yourLoss) || 0)} | Te pagamos: {formatCurrency(parseFloat(apt.ourPayment) || 0)}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    {(() => {
                      const gross = getCommissionByServiceTotal(apt);
                      const deductions = Number(apt.deductions) || 0;
                      const net = gross - deductions;
                      return (
                        <>
                          <p className="text-xs text-gray-500 mb-1">Recibiste</p>
                          <p className="text-green-600 font-black text-xl">+{formatCurrency(net)}</p>
                          {deductions > 0 && (
                            <p className="text-xs text-red-400 font-bold">-{formatCurrency(deductions)} en productos</p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t-2 border-green-100">
              <p className="text-xs font-bold text-gray-500">Pagina {paidPage} de {paidTotalPages} - {paidServices.length} registros</p>
              <div className="flex items-center gap-2">
                <Button type="button" onClick={() => setPaidPage((p) => Math.max(1, p - 1))} disabled={paidPage === 1} className="bg-green-100 hover:bg-green-200 disabled:opacity-50 text-green-700 rounded-xl px-3 py-2 font-bold">Anterior</Button>
                <Button type="button" onClick={() => setPaidPage((p) => Math.min(paidTotalPages, p + 1))} disabled={paidPage === paidTotalPages} className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl px-3 py-2 font-bold">Siguiente</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(HistoryTab);
