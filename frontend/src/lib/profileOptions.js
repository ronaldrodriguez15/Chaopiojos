export const AVATAR_PRESETS = [
  {
    id: 'sunburst',
    label: 'Luna',
    backgroundClass: 'bg-[radial-gradient(circle_at_top,_#fff1b8_0%,_#f9a8d4_38%,_#7c3aed_100%)]',
    skinClass: 'bg-[#f6d2ba]',
    hairClass: 'bg-[#43215f]',
    shirtClass: 'bg-[#8b5cf6]',
    shirtAccentClass: 'bg-[#f9a8d4]',
    eyeClass: 'bg-slate-900',
    cheekClass: 'bg-rose-300/70',
    accessoryClass: 'bg-amber-200',
    accessoryDetailClass: 'bg-amber-400',
    hairStyle: 'idol',
    eyeStyle: 'spark',
    mouthStyle: 'smile',
    accessory: 'starClip',
  },
  {
    id: 'minty',
    label: 'Rocco',
    backgroundClass: 'bg-[radial-gradient(circle_at_top,_#dcfce7_0%,_#6ee7b7_42%,_#065f46_100%)]',
    skinClass: 'bg-[#eebf96]',
    hairClass: 'bg-[#14532d]',
    shirtClass: 'bg-[#0f766e]',
    shirtAccentClass: 'bg-[#34d399]',
    eyeClass: 'bg-slate-900',
    cheekClass: 'bg-orange-200/50',
    accessoryClass: 'bg-slate-200',
    accessoryDetailClass: 'bg-slate-500',
    hairStyle: 'messy',
    eyeStyle: 'smile',
    mouthStyle: 'grin',
    accessory: 'headphones',
  },
  {
    id: 'ocean',
    label: 'Sora',
    backgroundClass: 'bg-[radial-gradient(circle_at_top,_#e0f2fe_0%,_#38bdf8_42%,_#1d4ed8_100%)]',
    skinClass: 'bg-[#f3cfb1]',
    hairClass: 'bg-[#183a8a]',
    shirtClass: 'bg-[#0f766e]',
    shirtAccentClass: 'bg-[#67e8f9]',
    eyeClass: 'bg-slate-950',
    cheekClass: 'bg-cyan-100/70',
    accessoryClass: 'bg-white',
    accessoryDetailClass: 'bg-cyan-300',
    hairStyle: 'hero',
    eyeStyle: 'wide',
    mouthStyle: 'openSmile',
    accessory: 'scarf',
  },
  {
    id: 'grape',
    label: 'Nina',
    backgroundClass: 'bg-[radial-gradient(circle_at_top,_#f5d0fe_0%,_#c084fc_40%,_#7e22ce_100%)]',
    skinClass: 'bg-[#ffd8c0]',
    hairClass: 'bg-[#7c3aed]',
    shirtClass: 'bg-[#ec4899]',
    shirtAccentClass: 'bg-[#f9a8d4]',
    eyeClass: 'bg-slate-900',
    cheekClass: 'bg-rose-300/70',
    accessoryClass: 'bg-pink-200',
    accessoryDetailClass: 'bg-pink-500',
    hairStyle: 'bob',
    eyeStyle: 'wink',
    mouthStyle: 'smirk',
    accessory: 'bow',
  },
  {
    id: 'flame',
    label: 'Kai',
    backgroundClass: 'bg-[radial-gradient(circle_at_top,_#fde68a_0%,_#fb923c_42%,_#991b1b_100%)]',
    skinClass: 'bg-[#e8b68f]',
    hairClass: 'bg-[#6b210d]',
    shirtClass: 'bg-[#ea580c]',
    shirtAccentClass: 'bg-[#fdba74]',
    eyeClass: 'bg-slate-950',
    cheekClass: 'bg-orange-200/50',
    accessoryClass: 'bg-zinc-200',
    accessoryDetailClass: 'bg-zinc-700',
    hairStyle: 'spikes',
    eyeStyle: 'cool',
    mouthStyle: 'halfSmile',
    accessory: 'bandage',
  },
  {
    id: 'night',
    label: 'Vega',
    backgroundClass: 'bg-[radial-gradient(circle_at_top,_#cbd5e1_0%,_#64748b_42%,_#0f172a_100%)]',
    skinClass: 'bg-[#f1c4a0]',
    hairClass: 'bg-[#111827]',
    shirtClass: 'bg-[#1f2937]',
    shirtAccentClass: 'bg-[#60a5fa]',
    eyeClass: 'bg-slate-950',
    cheekClass: 'bg-slate-200/30',
    accessoryClass: 'bg-sky-200/80',
    accessoryDetailClass: 'bg-sky-500',
    hairStyle: 'curtain',
    eyeStyle: 'sleepy',
    mouthStyle: 'soft',
    accessory: 'glasses',
  },
];

export const getAvatarPreset = (avatarKey) => AVATAR_PRESETS.find((item) => item.id === avatarKey) || null;

export const getUserAvatarMode = (user) => {
  if (user?.profile_photo_url || user?.profile_photo_path) return 'photo';
  if (getAvatarPreset(user?.avatar_key)) return 'preset';
  return 'initials';
};

export const getUserInitials = (name) => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'CP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
};
