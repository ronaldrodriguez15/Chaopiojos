import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Crown, UserCheck, Building2, Copy, Link2, FileText, Download, Image as ImageIcon } from 'lucide-react';
import BackendImage from '@/components/BackendImage';
import { buildDownloadUrl, resolveMediaUrl } from '@/lib/media';

const getRoleLabel = (role) => {
  if (role === 'admin') return 'Administrador';
  if (role === 'piojologa') return 'Piojóloga';
  if (role === 'vendedor') return 'Vendedor';
  if (role === 'referido') return 'Establecimiento';
  return role;
};

const getRoleAvatar = (role) => {
  if (role === 'admin') return '👑';
  if (role === 'piojologa') return '👩‍⚕️';
  if (role === 'vendedor') return '👤';
  return '🏪';
};

const getRoleIcon = (role) => {
  if (role === 'admin') return <Crown className="w-6 h-6 text-yellow-600" />;
  if (role === 'piojologa') return <UserCheck className="w-6 h-6 text-yellow-600" />;
  if (role === 'referido') return <Building2 className="w-6 h-6 text-yellow-600" />;
  return <User className="w-6 h-6 text-yellow-600" />;
};

const buildReferralBookingLink = (referralCode) => (
  referralCode ? `${window.location.origin}/agenda?ref=${encodeURIComponent(referralCode)}` : ''
);

const ESTABLISHMENT_DOCUMENTS = [
  { key: 'chamber_of_commerce_url', label: 'Camara de Comercio', icon: FileText },
  { key: 'rut_url', label: 'RUT', icon: FileText },
  { key: 'logo_url', label: 'Logo del establecimiento', icon: ImageIcon },
  { key: 'citizenship_card_url', label: 'Cedula de ciudadania', icon: ImageIcon },
];

const UserDetailDialog = ({
  isOpen,
  onClose,
  user,
  formatCurrency,
  formatDate12H
}) => {
  if (!user) return null;

  const establishment = user.managedSellerReferral || null;
  const sellerReferralLink = buildReferralBookingLink(user.referral_code);

  const handleCopyReferralLink = async () => {
    if (!sellerReferralLink) return;
    try {
      await navigator.clipboard.writeText(sellerReferralLink);
    } catch (error) {
      // ignore clipboard failures inside detail dialog
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[3rem] border-4 border-yellow-400 p-0 overflow-hidden sm:max-w-2xl bg-yellow-50 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalles del Usuario</DialogTitle>
        </DialogHeader>
        <div className="text-center pt-8 pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            {getRoleIcon(user.role)}
            <h2 className="text-2xl font-black text-yellow-600 uppercase tracking-wide" style={{ WebkitTextStroke: '0.5px currentColor' }}>
              DETALLES DEL USUARIO
            </h2>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          <div className="px-6 sm:px-8 pb-8 space-y-4">
            <div className="bg-white rounded-3xl p-6 border-2 border-yellow-400 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-yellow-100 flex items-center justify-center text-4xl shadow-lg mb-3">
                {getRoleAvatar(user.role)}
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">{user.name}</h3>
              <span className="inline-block px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider bg-yellow-200 text-yellow-700">
                {getRoleLabel(user.role)}
              </span>
            </div>

            <div className="space-y-3">
              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">Email</p>
                <p className="text-base font-bold text-gray-800">{user.email}</p>
              </div>

              <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                <p className="text-xs font-bold text-yellow-600 mb-1">Fecha de Registro</p>
                <p className="text-base font-bold text-gray-800">{formatDate12H(user.created_at)}</p>
              </div>

              {user.role === 'piojologa' && user.specialty && (
                <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                  <p className="text-xs font-bold text-yellow-600 mb-1">Especialidad</p>
                  <p className="text-base font-bold text-gray-800">{user.specialty}</p>
                </div>
              )}

              {(user.role === 'piojologa' || user.role === 'vendedor') && typeof user.referral_value !== 'undefined' && user.referral_value !== null && (
                <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                  <p className="text-xs font-bold text-yellow-600 mb-1">{user.role === 'vendedor' ? 'Valor por cabeza referida' : 'Valor referido'}</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(Number(user.referral_value ?? (user.role === 'vendedor' ? 5000 : 15000)))}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{user.role === 'vendedor' ? 'Comisión por cada cabeza agendada desde sus links' : 'Comisión por cada servicio referido completado'}</p>
                </div>
              )}

              {user.role === 'vendedor' && (
                <>
                  <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                    <p className="text-xs font-bold text-yellow-600 mb-1">Código de Referido</p>
                    <p className="text-2xl font-bold text-gray-800">{user.referral_code || 'Sin código asignado'}</p>
                  </div>

                  <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                    <p className="text-xs font-bold text-yellow-600 mb-1">Link General del Vendedor</p>
                    <p className="text-sm font-bold text-gray-800 break-all">{sellerReferralLink || 'Genera primero el código del vendedor'}</p>
                    {sellerReferralLink ? (
                      <div className="mt-3 flex flex-col sm:flex-row gap-3">
                        <Button
                          type="button"
                          onClick={handleCopyReferralLink}
                          className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-2xl py-3 px-5 font-bold"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copiar link
                        </Button>
                        <a
                          href={sellerReferralLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-2xl border-2 border-cyan-200 bg-cyan-50 px-5 py-3 font-bold text-cyan-700 hover:bg-cyan-100"
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Abrir link
                        </a>
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {user.address && (
                <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                  <p className="text-xs font-bold text-yellow-600 mb-1">Dirección</p>
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
                  <p className="text-xs font-bold text-yellow-600 mb-1">Estado</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                    user.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {user.available ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
              )}

              {user.role === 'piojologa' && typeof user.earnings !== 'undefined' && (
                <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                  <p className="text-xs font-bold text-yellow-600 mb-1">Ganancias Totales</p>
                  <p className="text-2xl font-bold text-gray-800">{formatCurrency(user.earnings)}</p>
                </div>
              )}

              {establishment && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resolveMediaUrl(establishment.logo_url) ? (
                      <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Logo</p>
                          <a href={buildDownloadUrl(establishment.logo_url)} className="inline-flex items-center gap-2 text-xs font-bold text-yellow-700 hover:text-yellow-900">
                            <Download className="w-4 h-4" />
                            Descargar
                          </a>
                        </div>
                        <BackendImage
                          src={establishment.logo_url}
                          alt={`Logo de ${establishment.business_name || user.name}`}
                          className="w-full h-40 rounded-2xl border border-yellow-200 bg-yellow-50"
                          imgClassName="object-contain"
                          fallbackClassName="border-yellow-200"
                          iconClassName="w-12 h-12 text-yellow-300"
                        />
                      </div>
                    ) : null}

                    {resolveMediaUrl(establishment.citizenship_card_url) ? (
                      <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide">Cedula</p>
                          <a href={buildDownloadUrl(establishment.citizenship_card_url)} className="inline-flex items-center gap-2 text-xs font-bold text-yellow-700 hover:text-yellow-900">
                            <Download className="w-4 h-4" />
                            Descargar
                          </a>
                        </div>
                        <BackendImage
                          src={establishment.citizenship_card_url}
                          alt={`Cedula de ${establishment.business_name || user.name}`}
                          className="w-full h-40 rounded-2xl border border-yellow-200 bg-yellow-50"
                          imgClassName="object-contain"
                          fallbackClassName="border-yellow-200"
                          iconClassName="w-12 h-12 text-yellow-300"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                    <p className="text-xs font-bold text-yellow-600 mb-1">Nombre del Establecimiento</p>
                    <p className="text-base font-bold text-gray-800">{establishment.business_name || user.name}</p>
                  </div>

                  {establishment.owner_name && (
                    <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                      <p className="text-xs font-bold text-yellow-600 mb-1">Propietario</p>
                      <p className="text-base font-bold text-gray-800">{establishment.owner_name}</p>
                    </div>
                  )}

                  {establishment.whatsapp && (
                    <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                      <p className="text-xs font-bold text-yellow-600 mb-1">WhatsApp</p>
                      <p className="text-base font-bold text-gray-800">{establishment.whatsapp}</p>
                    </div>
                  )}

                  {(establishment.city || establishment.nit) && (
                    <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                      <p className="text-xs font-bold text-yellow-600 mb-1">Datos Comerciales</p>
                      <p className="text-sm font-bold text-gray-800">
                        {[establishment.city, establishment.nit ? `NIT ${establishment.nit}` : null].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                    <p className="text-xs font-bold text-yellow-600 mb-1">Estado del Registro</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                      establishment.status === 'approved'
                        ? 'bg-green-100 text-green-700'
                        : establishment.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {establishment.status === 'approved'
                        ? 'Aprobado'
                        : establishment.status === 'rejected'
                        ? 'Rechazado'
                        : 'Pendiente de revisión'}
                    </span>
                  </div>

                  {establishment.seller?.name && (
                    <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                      <p className="text-xs font-bold text-yellow-600 mb-1">Vendedor Asociado</p>
                      <p className="text-base font-bold text-gray-800">{establishment.seller.name}</p>
                    </div>
                  )}

                  {establishment.booking_link && (
                    <div className="bg-white rounded-2xl p-4 border-2 border-yellow-400">
                      <p className="text-xs font-bold text-yellow-600 mb-1">Link de Reserva</p>
                      <p className="text-sm font-bold text-gray-800 break-all">{`${window.location.origin}${establishment.booking_link}`}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ESTABLISHMENT_DOCUMENTS.map(({ key, label, icon: Icon }) => {
                      const url = resolveMediaUrl(establishment[key]);
                      if (!url) return null;

                      return (
                        <div key={key} className="bg-white rounded-2xl p-4 border-2 border-yellow-400 space-y-3">
                          <p className="text-xs font-bold text-yellow-600 uppercase tracking-wide">{label}</p>
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-2xl border-2 border-yellow-300 bg-yellow-50 px-4 py-3 font-bold text-yellow-700 hover:bg-yellow-100"
                            >
                              <Icon className="w-4 h-4" />
                              Ver archivo
                            </a>
                            <a
                              href={buildDownloadUrl(url)}
                              className="inline-flex items-center gap-2 rounded-2xl border-2 border-yellow-300 bg-white px-4 py-3 font-bold text-yellow-700 hover:bg-yellow-50"
                            >
                              <Download className="w-4 h-4" />
                              Descargar
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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
