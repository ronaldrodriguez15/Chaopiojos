import React, { useEffect, useMemo, useState } from 'react';
import { Camera, ImageIcon, KeyRound, Mail, MapPin, Phone, Sparkles, Trash2, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { profileService } from '@/lib/api';
import { AVATAR_PRESETS } from '@/lib/profileOptions';
import UserAvatar from '@/components/UserAvatar';

const roleLabels = {
  admin: 'Administrador',
  piojologa: 'Piojologa',
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
  profile_photo: null,
  remove_profile_photo: false,
  password: '',
  password_confirmation: '',
});

const ProfileDialog = ({ open, onOpenChange, currentUser, onProfileUpdated }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(() => buildFormState(currentUser));
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(currentUser || null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');

  const replacePhotoPreview = (nextUrl) => {
    setPhotoPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl || '';
    });
  };

  useEffect(() => {
    setProfileUser(currentUser || null);
  }, [currentUser]);

  useEffect(() => () => {
    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreviewUrl);
    }
  }, [photoPreviewUrl]);

  useEffect(() => {
    if (!open || !currentUser) return;

    let isMounted = true;

    const loadProfile = async () => {
      setIsLoadingProfile(true);
      const result = await profileService.get();
      if (!isMounted) return;

      const nextUser = result.success ? result.user : currentUser;
      setProfileUser(nextUser);
      setFormData(buildFormState(nextUser));
      replacePhotoPreview('');
      setFieldErrors({});
      setIsLoadingProfile(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [open, currentUser]);

  const hasPersistedPhoto = Boolean(profileUser?.profile_photo_url);
  const hasLocalPhoto = Boolean(formData.profile_photo && photoPreviewUrl);
  const hasActivePhoto = hasLocalPhoto || (hasPersistedPhoto && !formData.remove_profile_photo);

  const previewUser = useMemo(() => ({
    ...currentUser,
    ...profileUser,
    name: formData.name,
    avatar_key: hasActivePhoto ? null : (formData.avatar_key || null),
    profile_photo_url: formData.remove_profile_photo
      ? null
      : (photoPreviewUrl || profileUser?.profile_photo_url || currentUser?.profile_photo_url || null),
  }), [
    currentUser,
    formData.avatar_key,
    formData.name,
    formData.remove_profile_photo,
    hasActivePhoto,
    photoPreviewUrl,
    profileUser,
  ]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const handleAvatarSelection = (avatarKey) => {
    replacePhotoPreview('');
    setFormData((prev) => ({
      ...prev,
      avatar_key: avatarKey,
      profile_photo: null,
      remove_profile_photo: hasPersistedPhoto || Boolean(prev.profile_photo),
    }));
    setFieldErrors((prev) => ({ ...prev, avatar_key: undefined, profile_photo: undefined }));
  };

  const handlePhotoSelection = (file) => {
    if (!file) return;

    replacePhotoPreview(URL.createObjectURL(file));
    setFormData((prev) => ({
      ...prev,
      profile_photo: file,
      remove_profile_photo: false,
      avatar_key: '',
    }));
    setFieldErrors((prev) => ({ ...prev, profile_photo: undefined, avatar_key: undefined }));
  };

  const handleRemovePhoto = () => {
    replacePhotoPreview('');
    setFormData((prev) => ({
      ...prev,
      profile_photo: null,
      remove_profile_photo: true,
    }));
    setFieldErrors((prev) => ({ ...prev, profile_photo: undefined }));
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
    };

    if (formData.profile_photo) {
      payload.profile_photo = formData.profile_photo;
    }

    if (formData.remove_profile_photo) {
      payload.remove_profile_photo = '1';
    }

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
    setProfileUser(result.user);
    setFormData(buildFormState(result.user));
    replacePhotoPreview('');
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
                <h3 className="text-lg font-black text-gray-800">Avatar y foto</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
                <div className="rounded-[1.5rem] border-2 border-cyan-100 bg-cyan-50 p-5 flex flex-col items-center text-center gap-4">
                  <UserAvatar user={previewUser} className="w-28 h-28 rounded-[1.75rem] border-4 border-white shadow-lg" textClassName="text-5xl" />
                  <div className="space-y-2">
                    <p className="text-sm font-black text-gray-800">Vista previa</p>
                    <p className="text-xs font-bold text-gray-500">Puedes subir una selfie, tomarla con la camara o usar un avatar predeterminado.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border-2 border-cyan-100 bg-cyan-50 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-black text-gray-800">Foto de perfil</p>
                      <p className="text-xs font-bold text-gray-500">JPG, PNG o WEBP. En celular abre la camara y en computador permite escoger una imagen local.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="flex-1 rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 cursor-pointer hover:border-cyan-400 transition-colors">
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePhotoSelection(e.target.files?.[0] || null)} />
                        <span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700">
                          <ImageIcon className="w-4 h-4" />
                          Subir foto
                        </span>
                      </label>

                      <label className="flex-1 rounded-2xl border-2 border-cyan-200 bg-white px-4 py-3 cursor-pointer hover:border-cyan-400 transition-colors">
                        <input type="file" className="hidden" accept="image/*" capture="user" onChange={(e) => handlePhotoSelection(e.target.files?.[0] || null)} />
                        <span className="inline-flex items-center gap-2 text-sm font-black text-cyan-700">
                          <Camera className="w-4 h-4" />
                          Tomar foto
                        </span>
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-cyan-100 bg-white px-4 py-3">
                      <div>
                        <p className="text-sm font-black text-cyan-700">
                          {formData.profile_photo
                            ? formData.profile_photo.name
                            : hasPersistedPhoto && !formData.remove_profile_photo
                              ? 'Foto actual cargada'
                              : 'Sin foto activa'}
                        </p>
                        <p className="text-xs font-bold text-gray-500">Si eliges avatar o iniciales, se reemplaza la foto actual.</p>
                      </div>

                      {hasActivePhoto ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRemovePhoto}
                          className="rounded-2xl border-2 border-red-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Quitar foto
                        </Button>
                      ) : null}
                    </div>

                    {fieldErrors.profile_photo ? <p className="text-sm font-bold text-red-500">{fieldErrors.profile_photo[0]}</p> : null}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-black text-gray-700">Avatares predeterminados</p>
                    <button
                      type="button"
                      onClick={() => handleAvatarSelection('')}
                      className={`w-full rounded-2xl border-2 px-4 py-3 text-left font-black transition-all ${!formData.avatar_key && !hasActivePhoto ? 'border-cyan-500 ring-2 ring-cyan-200 bg-cyan-50 text-cyan-700' : 'border-cyan-100 bg-white text-gray-700 hover:border-cyan-300'}`}
                    >
                      Usar iniciales automaticas
                    </button>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {AVATAR_PRESETS.map((avatar) => {
                        const isSelected = !hasActivePhoto && formData.avatar_key === avatar.id;
                        return (
                          <button
                            key={avatar.id}
                            type="button"
                            onClick={() => handleAvatarSelection(avatar.id)}
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
            </div>

            <div className="rounded-[1.5rem] border-2 border-cyan-100 bg-white p-5 space-y-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-cyan-600" />
                <h3 className="text-lg font-black text-gray-800">Informacion personal</h3>
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
                  <label className="block text-sm font-bold text-gray-600 mb-2">WhatsApp o telefono</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-cyan-600 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input className={`w-full rounded-2xl border-2 p-4 pl-11 font-bold outline-none ${fieldErrors.phone ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                  </div>
                  {fieldErrors.phone ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.phone[0]}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Direccion</label>
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
                <h3 className="text-lg font-black text-gray-800">Cambiar contrasena</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Nueva contrasena</label>
                  <input type="password" className={`w-full rounded-2xl border-2 p-4 font-bold outline-none ${fieldErrors.password ? 'border-red-300 bg-red-50' : 'border-cyan-200 bg-cyan-50 focus:border-cyan-400'}`} value={formData.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="Dejala vacia si no la quieres cambiar" />
                  {fieldErrors.password ? <p className="text-sm font-bold text-red-500 mt-2">{fieldErrors.password[0]}</p> : null}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">Confirmar contrasena</label>
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
