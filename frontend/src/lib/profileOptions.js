export const AVATAR_PRESETS = [
  { id: 'sunburst', label: 'Sol', emoji: '🌞', className: 'bg-gradient-to-br from-yellow-300 via-orange-300 to-pink-400 text-orange-900' },
  { id: 'minty', label: 'Menta', emoji: '🍃', className: 'bg-gradient-to-br from-emerald-200 via-lime-200 to-green-400 text-emerald-900' },
  { id: 'ocean', label: 'Océano', emoji: '🌊', className: 'bg-gradient-to-br from-cyan-200 via-sky-300 to-blue-500 text-blue-950' },
  { id: 'grape', label: 'Uva', emoji: '🍇', className: 'bg-gradient-to-br from-fuchsia-200 via-violet-300 to-purple-500 text-purple-950' },
  { id: 'flame', label: 'Fuego', emoji: '🔥', className: 'bg-gradient-to-br from-amber-200 via-orange-400 to-red-500 text-red-950' },
  { id: 'night', label: 'Noche', emoji: '🌙', className: 'bg-gradient-to-br from-slate-300 via-slate-500 to-slate-800 text-white' },
];

export const getAvatarPreset = (avatarKey) => AVATAR_PRESETS.find((item) => item.id === avatarKey) || null;

export const getUserInitials = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return 'CP';

  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};
