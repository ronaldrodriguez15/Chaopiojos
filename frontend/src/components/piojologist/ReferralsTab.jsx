import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Copy, DollarSign, Gift, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ReferralsTab = ({
  loadingReferrals,
  currentUser,
  copiedCode,
  copyReferralCode,
  formatCurrency,
  referralCommissions,
  myReferrals
}) => {
  const [commissionsPage, setCommissionsPage] = useState(1);
  const [commissionsPerPage, setCommissionsPerPage] = useState(5);

  const commissionsTotalPages = Math.max(1, Math.ceil(referralCommissions.length / commissionsPerPage));
  const paginatedCommissions = useMemo(() => {
    return referralCommissions.slice(
      (commissionsPage - 1) * commissionsPerPage,
      commissionsPage * commissionsPerPage
    );
  }, [referralCommissions, commissionsPage, commissionsPerPage]);

  useEffect(() => {
    setCommissionsPage(1);
  }, [commissionsPerPage, referralCommissions.length]);

  useEffect(() => {
    if (commissionsPage > commissionsTotalPages) setCommissionsPage(commissionsTotalPages);
  }, [commissionsPage, commissionsTotalPages]);

  const paidTotal = referralCommissions
    .filter((c) => c.status === 'paid')
    .reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0);

  const pendingTotal = referralCommissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + parseFloat(c.commission_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] p-6 bg-gradient-to-br from-pink-50 to-purple-50 border-4 border-pink-200 shadow-xl">
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-pink-200 to-purple-200 px-4 py-2 rounded-full">
            <Gift className="w-5 h-5 text-pink-600" />
            <span className="text-sm font-black text-pink-600 uppercase">Tu Codigo de Referido</span>
          </div>
        </div>

        <div className="text-center space-y-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-pink-300 shadow-lg">
            {currentUser.referral_code ? (
              <>
                <p className="text-4xl font-black text-pink-500 mb-2 tracking-wider">{currentUser.referral_code}</p>
                <p className="text-sm text-gray-600 font-bold">Comparte este codigo con tus clientes</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-gray-400 mb-2">Sin codigo asignado</p>
                <p className="text-sm text-gray-500 font-bold">Contacta con administracion para obtener tu codigo</p>
              </>
            )}
          </div>

          <Button
            onClick={copyReferralCode}
            disabled={!currentUser.referral_code}
            className="w-full bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white rounded-2xl py-6 font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copiedCode ? (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 mr-2" />
                Copiar mensaje para compartir
              </>
            )}
          </Button>

          <div className="bg-yellow-50 rounded-2xl p-4 border-2 border-yellow-200">
            <p className="text-sm text-yellow-800 font-bold">
              Cuando un cliente agende usando tu codigo, ganaras tu comision al completar su servicio.
            </p>
          </div>
        </div>
      </div>

      {loadingReferrals ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-pink-200 border-t-pink-500"></div>
          <p className="mt-4 text-gray-600 font-bold">Cargando informacion...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-4 border-purple-200 shadow-lg">
              <div className="flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-sm font-bold text-purple-600">Referidos Totales</p>
                  <p className="text-3xl font-black text-purple-700">{myReferrals.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6 bg-gradient-to-br from-green-50 to-green-100 border-4 border-green-200 shadow-lg">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-sm font-bold text-green-600">Ganado</p>
                  <p className="text-3xl font-black text-green-700">{formatCurrency(paidTotal)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-4 border-yellow-200 shadow-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-sm font-bold text-yellow-600">Pendiente</p>
                  <p className="text-3xl font-black text-yellow-700">{formatCurrency(pendingTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] p-6 bg-white border-4 border-pink-200 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-2xl font-black text-pink-600 flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                Historial de Comisiones
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase">Por pagina</span>
                <select
                  value={commissionsPerPage}
                  onChange={(e) => setCommissionsPerPage(Number(e.target.value))}
                  className="bg-pink-50 border-2 border-pink-200 rounded-xl px-3 py-1.5 text-sm font-bold text-pink-700 outline-none"
                >
                  {[5, 10, 20, 50].map((option) => (
                    <option key={`com-page-size-${option}`} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            </div>

            {referralCommissions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 font-bold">No hay comisiones aun</p>
                <p className="text-sm text-gray-400 mt-2">Las comisiones se generan cuando un cliente usa tu codigo y completa su servicio</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedCommissions.map((commission) => (
                    <div
                      key={commission.id}
                      className={`rounded-2xl p-4 border-2 ${commission.status === 'paid' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-bold text-gray-800">{commission.referred?.name || 'Cliente'}</p>
                          <p className="text-sm text-gray-600">Cliente: {commission.booking?.clientName || 'N/A'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(commission.created_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-pink-600">{formatCurrency(commission.commission_amount)}</p>
                          <p className={`text-xs font-bold mt-1 ${commission.status === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {commission.status === 'paid' ? 'Pagado' : 'Pendiente'}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                        Servicio: {formatCurrency(commission.service_amount)} x 10% = {formatCurrency(commission.commission_amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 pt-4 border-t-2 border-pink-100">
                  <p className="text-xs font-bold text-gray-500">Pagina {commissionsPage} de {commissionsTotalPages} - {referralCommissions.length} registros</p>
                  <div className="flex items-center gap-2">
                    <Button type="button" onClick={() => setCommissionsPage((p) => Math.max(1, p - 1))} disabled={commissionsPage === 1} className="bg-pink-100 hover:bg-pink-200 disabled:opacity-50 text-pink-700 rounded-xl px-3 py-2 font-bold">Anterior</Button>
                    <Button type="button" onClick={() => setCommissionsPage((p) => Math.min(commissionsTotalPages, p + 1))} disabled={commissionsPage === commissionsTotalPages} className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white rounded-xl px-3 py-2 font-bold">Siguiente</Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(ReferralsTab);
