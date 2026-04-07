import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Mail, MapPin, Phone, Sparkles, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { profileService } from '@/lib/api';
import { AVATAR_PRESETS } from '@/lib/profileOptions';
import UserAvatar from '@/components/UserAvatar';

const roleLabels = {
  admin: 'Administrador',
  piojologa: 'Piojóloga',
  vendedor: 'Vendedor',
  referido: 'Establecimiento',
};

const buildFormState = (user) => ({
  name: user?.name || '',
  email: user?.email || '',
  phone: user?.phone || '',
  address: user?.address || '',
  specialty: user?.specialty || '',
  avatar_key: user?.avatar_key || '',
  password: '',
  password_confirmation: '',
});

const ProfileDialog = ({ open, onOpenChange, currentUser, onProfileUpdated }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(() => buildFormState(currentUser));
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  useEffect(() => {
    if (!open || !currentUser) return;

    let isMounted = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      const result = await profileService.get();
      if (!isMounted) return;

      const nextUser = result.success ? result.user : currentUser;
      setFormData(buildFormState(nextUser));
      setFieldErrors({});
      setIsLoadingProfile(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [open, currentUser]);

  const previewUser = useMemo(() => ({
    ...currentUser,
    name: formData.name,
    avatar_key: formData.avatar_key || null,
    profile_photo_url: null,
  }), [currentUser, formData.name, formData.avatar_key]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      specialty: currentUser?.role === 'piojologa' ? formData.specialty.trim() : '',
      avatar_key: formData.avatar_key || null,
      remove_profile_photo: '1',
    };

    if (formData.password) {
      payload.password = formData.password;
      payload.password_confirmation = formData.password_confirmation;
    }

    const result = await profileService.update(payload);
    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.errors || {});
      toast({
        title: 'Error',
        description: result.message || 'No se pudo actualizar tu perfil',
        variant: 'destructive',
        className: 'rounded-3xl border-4 border-red-200 bg-red-50 text-red-600 font-bold'
      });
      return;
    }

    setFieldErrors({});
    onProfileUpdated?.(result.user);
    toast({
      title: 'Perfil actualizado',
      description: result.message || 'Tus datos fueron actualizados correctamente',
      className: 'rounded-3xl border-4 border-green-200 bg-green-50 text-green-700 font-bold'
    });
    onOpenChange(false);
  };

  if (!currentUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[2rem] border-4 border-cyan-300 bg-cyan-50 p-0 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Mi perfil</DialogTitle>
        </DialogHeader>

        <div className="max-h-[85vh] overflow-y-auto">
          <div className="px-6 md:px-8 pt-8 pb-6 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 text-white">
            <div className="flex flex-col md:flex-row md:items-center gap-5">
              <UserAvatar user={previewUser} className="w-24 h-24 rounded-[1.75rem] border-4 border-white/70 shadow-xl" textClassName="text-4xl" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3em] font-black text-cyan-50/90">Mi perfil</p>
                <h2 className="text-3xl font-black truncate">{formData.name || currentUser.name}</h2>
                <p className="text-sm font-bold text-cyan-50 mt-2">{roleLabels[currentUser.role] || currentUser.role}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 md:px-8 py-6 space-y-6">
            <div className="rounded-[1.5rem] border-2 border-cyan-100 bg-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                <h3 className="text-lg font-black text-gray-800">Avatar</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
                <div className="rounded-[1.5rem] border-2 border-cyan-100 bg-cyan-50 p-5 flex flex-col items-center text-center gap-4">
                  <UserAvatar user={previewUser} className="w-28 h-28 rounded-[1.75rem] border-4 border-white shadow-lg" textClassName="text-5xl" />
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-800">Vista previa</p>
                    <p className="text-xs font-bold text-gray-500">Usa un personaje animado o deja las iniciales automáticas.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-black text-gray-700">Personajes</p>
                  <button
                    type="button"
                    onClick={() => handleChange('avatar_key', '')}
                    className={`w-full rounded-2xl border-2 px-4 py-3 text-left font-black transition-all ${!formData.avatar_key ? 'border-cyan-500 ring-2 ring-cyan-200 bg-cyan-50 text-cyan-700' : 'border-cyan-100 bg-white text-gray-700 hover:border-cyan-300'}`}
                  >
                    Usar iniciales automáticas
                  </button>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {AVATAR_PRESETS.map((avatar) => {
                      const isSelected = formData.avatar_key === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => handleChange('avatar_key', avatar.id)}
                          className={`rounded-2xl border-2 p-3 text-left transition-all ${isSelected ? 'border-cyan-500 ring-2 ring-cyan-200 bg-cyan-50' : 'border-cyan-100 bg-white hover:border-cyan-300'}`}
                        >
                          <UserAvatar user={{ name: avatar.label, avatar_key: avatar.id }} className="w-12 h-12 rounded-2xl border-2 border-white shadow-sm" />
                          <p className="mt-3 text-sm font-black text-gray-800">{avatar.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border-2 border-cyan-100 bg-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-cyan-600" />
                <h3 className="text-lg font-black text-gray-800">Información personal</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Nombre *</label>
                  <input className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.name} onChange={(e) => handleChange('name', e.target.value)} />
                  {fieldErrors.name ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.name[0]}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Correo *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-cyan-600 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input className={`w-full rounded-2xl border-2 p-4 pl-11 font-bold outline-none ${fieldErrors.email ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.email} onChange={(e) => handleChange('email', e.target.value)} />
                  </div>
                  {fieldErrors.email ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.email[0]}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">WhatsApp o teléfono</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-cyan-600 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input className={`w-full rounded-2xl border-2 p-4 pl-11 font-bold outline-none ${fieldErrors.phone ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                  </div>
                  {fieldErrors.phone ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.phone[0]}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Dirección</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-cyan-600 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input className={`w-full rounded-2xl border-2 p-4 pl-11 font-bold outline-none ${fieldErrors.address ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.address} onChange={(e) => handleChange('address', e.target.value)} />
                  </div>
                  {fieldErrors.address ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.address[0]}</p> : null}
                </div>
              </div>

              {currentUser.role === 'piojologa' ? (
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Especialidad</label>
                  <input className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.specialty ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.specialty} onChange={(e) => handleChange('specialty', e.target.value)} />
                  {fieldErrors.specialty ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.specialty[0]}</p> : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-[1.5rem] border-2 border-cyan-100 bg-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-cyan-600" />
                <h3 className="text-lg font-black text-gray-800">Cambiar contraseña</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Nueva contraseña</label>
                  <input type="password" className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="Déjala vacía si no la quieres cambiar" />
                  {fieldErrors.password ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.password[0]}</p> : null}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Confirmar contraseña</label>
                  <input type="password" className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.password_confirmation} onChange={(e) => handleChange('password_confirmation', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pb-2">
              <Button type="button" variant="outline" className="rounded-2xl border-2 border-slate-200 bg-white" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || isLoadingProfile} className="rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-black px-6">
                {isSaving ? 'Guardando...' : isLoadingProfile ? 'Cargando...' : 'Guardar perfil'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileDialog;
