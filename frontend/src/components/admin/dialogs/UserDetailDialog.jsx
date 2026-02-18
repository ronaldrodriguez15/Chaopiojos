import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Crown, UserCheck } from 'lucide-react';

const UserDetailDialog = ({ 
  isOpen, 
  onClose, 
  user,
  formatCurrency,
  formatDate12H
}) => {
  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 overflow-hidden sm:max-w-2xl bg-yellow-50 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalles del Usuario</DialogTitle>
        </DialogHeader>
        {/* Title */}
        <div className="text-center pt-8 pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            {user.role === 'admin' ? <Crown className="w-6 h-6 text-yellow-600" /> : user.role === 'piojologa' ? <UserCheck className="w-6 h-6 text-yellow-600" /> : <User className="w-6 h-6 text-yellow-600" />}
            <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{WebkitTextStroke: '0.5px currentColor'}}>
              DETALLES DEL USUARIO
            </h2>
          </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="px-6 sm:px-8 pb-8 space-y-4">
          <div className="bg-white rounded-3xl p-6 border-2 border-yellow-400 text-center">
            <div className="w-20 h-20 mx-auto rounded-full bg-yellow-100 flex items-center justify-center text-4xl shadow-lg mb-3">
              {user.role === 'admin' ? '👑' : user.role === 'piojologa' ? '👩‍⚕️' : '👤'}
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">{user.name}</h3>
            <span className="inline-block px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider bg-yellow-200 text-yellow-700">
              {user.role === 'admin' ? 'admin' : user.role === 'piojologa' ? 'piojóloga' : user.role}
            </span>
          </div>

          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
              <p className="text-xs font-bold text-yellow-600 mb-1">📧 Email</p>
              <p className="text-base font-bold text-gray-800">{user.email}</p>
            </div>

            <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
              <p className="text-xs font-bold text-yellow-600 mb-1">📅 Fecha de Registro</p>
              <p className="text-base font-bold text-gray-800">{formatDate12H(user.created_at)}</p>
            </div>

            {user.role === 'piojologa' && user.specialty && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">⚡ Especialidad</p>
                <p className="text-base font-bold text-gray-800">{user.specialty}</p>
              </div>
            )}

            {user.role === 'piojologa' && user.commission_rate && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">💰 Tasa de Comisión</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="bg-yellow-200 text-yellow-700 px-3 py-1 rounded-full text-sm font-bold">
                    👩‍⚕️ {user.commission_rate}%
                  </span>
                  <span className="bg-yellow-100 text-yellow-600 px-3 py-1 rounded-full text-sm font-bold">
                    🏢 {100 - user.commission_rate}%
                  </span>
                </div>
              </div>
            )}

            {user.role === 'piojologa' && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-2">🎁 Código de Referido Personal</p>
                {user.referral_code ? (
                  <p className="text-3xl font-bold text-yellow-600 tracking-wider text-center">
                    {user.referral_code}
                  </p>
                ) : (
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-400 mb-1">
                      Sin código asignado
                    </p>
                    <p className="text-xs text-gray-400">Este código se genera automáticamente</p>
                  </div>
                )}
              </div>
            )}

            {user.role === 'piojologa' && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">Valor referido</p>
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency(Number(user.referral_value ?? 15000))}
                </p>
                <p className="text-xs text-gray-500 mt-1">Comision por cada servicio referido completado</p>
              </div>
            )}

            {user.role === 'piojologa' && user.referred_by_id && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">👥 Referido Por</p>
                <p className="text-sm font-bold text-gray-800">Este usuario fue referido por otro miembro</p>
              </div>
            )}

            {user.address && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">📍 Dirección</p>
                <p className="text-sm font-bold text-gray-800">{user.address}</p>
                {user.lat && user.lng && (
                  <p className="text-xs text-gray-500 mt-2">
                    Coordenadas: {parseFloat(user.lat).toFixed(4)}, {parseFloat(user.lng).toFixed(4)}
                  </p>
                )}
              </div>
            )}

            {user.role === 'piojologa' && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">📊 Estado</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                  user.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {user.available ? '✓ Disponible' : '✗ No Disponible'}
                </span>
              </div>
            )}

            {user.role === 'piojologa' && typeof user.earnings !== 'undefined' && (
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">💵 Ganancias Totales</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(user.earnings)}</p>
              </div>
            )}
          </div>

          <div className="pt-4">
            <Button 
              onClick={onClose}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl py-3 px-6 font-bold shadow-lg transition-all"
            >
              Cerrar
            </Button>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailDialog;
