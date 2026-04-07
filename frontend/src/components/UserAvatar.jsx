import React from 'react';
import { getAvatarPreset, getUserInitials } from '@/lib/profileOptions';

const hairStyleMap = {
  idol: {
    top: 'absolute left-1/2 top-[11%] h-[28%] w-[58%] -translate-x-1/2 rounded-[48%_48%_35%_35%] shadow-[inset_0_-8px_0_rgba(255,255,255,0.12)]',
    left: 'absolute left-[24%] top-[25%] h-[18%] w-[16%] rounded-[60%_40%_55%_40%]',
    right: 'absolute right-[24%] top-[25%] h-[18%] w-[16%] rounded-[40%_60%_40%_55%]',
    fringe: 'absolute left-1/2 top-[26%] h-[10%] w-[40%] -translate-x-1/2 rounded-b-[90%]',
  },
  messy: {
    top: 'absolute left-1/2 top-[8%] h-[28%] w-[64%] -translate-x-1/2 [clip-path:polygon(0_100%,8%_28%,22%_62%,30%_16%,43%_54%,55%_10%,69%_52%,80%_18%,92%_62%,100%_100%)]',
    left: 'absolute left-[20%] top-[24%] h-[16%] w-[18%] rounded-[60%_30%_60%_40%]',
    right: 'absolute right-[18%] top-[22%] h-[18%] w-[20%] rounded-[35%_60%_40%_65%]',
    fringe: 'absolute left-[34%] top-[22%] h-[12%] w-[28%] -rotate-6 rounded-b-[90%]',
  },
  hero: {
    top: 'absolute left-1/2 top-[10%] h-[30%] w-[62%] -translate-x-1/2 rounded-[48%_48%_30%_30%]',
    left: 'absolute left-[19%] top-[21%] h-[24%] w-[20%] rounded-[70%_30%_65%_35%]',
    right: 'absolute right-[19%] top-[24%] h-[20%] w-[18%] rounded-[35%_60%_35%_65%]',
    fringe: 'absolute left-[28%] top-[16%] h-[14%] w-[38%] -rotate-[14deg] rounded-b-[100%]',
  },
  bob: {
    top: 'absolute left-1/2 top-[10%] h-[32%] w-[68%] -translate-x-1/2 rounded-[42%_42%_28%_28%]',
    left: 'absolute left-[16%] top-[24%] h-[28%] w-[18%] rounded-[55%_35%_60%_30%]',
    right: 'absolute right-[16%] top-[24%] h-[28%] w-[18%] rounded-[35%_55%_30%_60%]',
    fringe: 'absolute left-1/2 top-[22%] h-[12%] w-[48%] -translate-x-1/2 rounded-b-[90%]',
  },
  spikes: {
    top: 'absolute left-1/2 top-[8%] h-[28%] w-[66%] -translate-x-1/2 [clip-path:polygon(0_100%,6%_38%,16%_72%,26%_18%,38%_60%,48%_8%,60%_56%,74%_16%,86%_68%,94%_34%,100%_100%)]',
    left: 'absolute left-[20%] top-[24%] h-[16%] w-[16%] rounded-[60%_25%_55%_30%]',
    right: 'absolute right-[22%] top-[26%] h-[14%] w-[14%] rounded-[30%_60%_30%_55%]',
    fringe: 'absolute left-[42%] top-[20%] h-[12%] w-[18%] rotate-[8deg] rounded-b-[90%]',
  },
  curtain: {
    top: 'absolute left-1/2 top-[9%] h-[30%] w-[66%] -translate-x-1/2 rounded-[46%_46%_32%_32%]',
    left: 'absolute left-[18%] top-[22%] h-[24%] w-[18%] rounded-[65%_35%_55%_25%]',
    right: 'absolute right-[18%] top-[22%] h-[24%] w-[18%] rounded-[35%_65%_25%_55%]',
    fringe: 'absolute left-1/2 top-[18%] h-[18%] w-[18%] -translate-x-1/2 rounded-b-[90%]',
  },
};

const eyeStyleMap = {
  spark: {
    left: 'absolute left-[30%] top-[46%] h-[7%] w-[7%] rounded-full',
    right: 'absolute right-[30%] top-[46%] h-[7%] w-[7%] rounded-full',
    shineLeft: 'absolute left-[31.8%] top-[46.8%] h-[2.1%] w-[2.1%] rounded-full bg-white',
    shineRight: 'absolute right-[31.8%] top-[46.8%] h-[2.1%] w-[2.1%] rounded-full bg-white',
  },
  smile: {
    left: 'absolute left-[28%] top-[48%] h-[3.5%] w-[12%] rounded-full border-b-[3px] border-slate-900',
    right: 'absolute right-[28%] top-[48%] h-[3.5%] w-[12%] rounded-full border-b-[3px] border-slate-900',
  },
  wide: {
    left: 'absolute left-[28%] top-[45%] h-[8%] w-[9%] rounded-full',
    right: 'absolute right-[28%] top-[45%] h-[8%] w-[9%] rounded-full',
    shineLeft: 'absolute left-[30%] top-[46.5%] h-[2%] w-[2%] rounded-full bg-white',
    shineRight: 'absolute right-[30%] top-[46.5%] h-[2%] w-[2%] rounded-full bg-white',
  },
  wink: {
    left: 'absolute left-[28%] top-[48%] h-[3.5%] w-[12%] rounded-full border-b-[3px] border-slate-900',
    right: 'absolute right-[29%] top-[45%] h-[8%] w-[9%] rounded-full',
    shineRight: 'absolute right-[31%] top-[46.5%] h-[2%] w-[2%] rounded-full bg-white',
  },
  cool: {
    left: 'absolute left-[27%] top-[46%] h-[6%] w-[10%] rounded-full',
    right: 'absolute right-[27%] top-[46%] h-[6%] w-[10%] rounded-full',
  },
  sleepy: {
    left: 'absolute left-[28%] top-[49%] h-[2.5%] w-[11%] rounded-full bg-slate-900',
    right: 'absolute right-[28%] top-[49%] h-[2.5%] w-[11%] rounded-full bg-slate-900',
  },
};

const mouthStyleMap = {
  smile: 'absolute left-1/2 top-[65%] h-[4%] w-[18%] -translate-x-1/2 rounded-full border-b-[3px] border-rose-500',
  grin: 'absolute left-1/2 top-[64%] h-[8%] w-[20%] -translate-x-1/2 rounded-b-[60%] bg-white border-2 border-slate-900',
  openSmile: 'absolute left-1/2 top-[63%] h-[9%] w-[18%] -translate-x-1/2 rounded-[40%_40%_60%_60%] bg-rose-500',
  smirk: 'absolute left-[47%] top-[65%] h-[4%] w-[15%] rounded-full border-b-[3px] border-rose-500 rotate-[8deg]',
  halfSmile: 'absolute left-[46%] top-[65%] h-[4%] w-[18%] rounded-full border-b-[3px] border-rose-500 -rotate-[8deg]',
  soft: 'absolute left-1/2 top-[66%] h-[3.5%] w-[12%] -translate-x-1/2 rounded-full bg-rose-400/80',
};

const renderAccessory = (preset) => {
  switch (preset.accessory) {
    case 'starClip':
      return (
        <>
          <div className={`absolute left-[22%] top-[18%] h-[12%] w-[12%] rotate-12 [clip-path:polygon(50%_0,61%_36%,100%_36%,68%_57%,79%_92%,50%_70%,21%_92%,32%_57%,0_36%,39%_36%)] ${preset.accessoryClass}`} />
          <div className={`absolute left-[25.6%] top-[21.5%] h-[4.2%] w-[4.2%] rounded-full ${preset.accessoryDetailClass}`} />
        </>
      );
    case 'headphones':
      return (
        <>
          <div className={`absolute left-[18%] top-[24%] h-[26%] w-[8%] rounded-full ${preset.accessoryClass}`} />
          <div className={`absolute right-[18%] top-[24%] h-[26%] w-[8%] rounded-full ${preset.accessoryClass}`} />
          <div className={`absolute left-1/2 top-[14%] h-[12%] w-[48%] -translate-x-1/2 rounded-t-full border-[5px] border-b-0 ${preset.accessoryDetailClass}`} />
        </>
      );
    case 'scarf':
      return (
        <>
          <div className={`absolute inset-x-[19%] bottom-[18%] h-[13%] rounded-full ${preset.accessoryClass}`} />
          <div className={`absolute left-[28%] bottom-[8%] h-[16%] w-[12%] rounded-b-[40%] ${preset.accessoryDetailClass}`} />
        </>
      );
    case 'bow':
      return (
        <>
          <div className={`absolute left-[18%] top-[18%] h-[12%] w-[12%] rounded-[60%_40%_55%_45%] ${preset.accessoryClass}`} />
          <div className={`absolute left-[25%] top-[18%] h-[12%] w-[12%] rounded-[40%_60%_45%_55%] ${preset.accessoryClass}`} />
          <div className={`absolute left-[24.5%] top-[21.5%] h-[5%] w-[5%] rounded-full ${preset.accessoryDetailClass}`} />
        </>
      );
    case 'bandage':
      return (
        <div className={`absolute right-[23%] top-[39%] h-[6%] w-[12%] rotate-[18deg] rounded-full border border-white/80 ${preset.accessoryClass}`}>
          <div className={`absolute left-[38%] top-[20%] h-[60%] w-[10%] ${preset.accessoryDetailClass}`} />
        </div>
      );
    case 'glasses':
      return (
        <>
          <div className={`absolute left-[22%] top-[42%] h-[14%] w-[22%] rounded-[40%] border-[3px] ${preset.accessoryDetailClass}`} />
          <div className={`absolute right-[22%] top-[42%] h-[14%] w-[22%] rounded-[40%] border-[3px] ${preset.accessoryDetailClass}`} />
          <div className={`absolute left-1/2 top-[47%] h-[2.5%] w-[12%] -translate-x-1/2 ${preset.accessoryDetailClass}`} />
        </>
      );
    default:
      return null;
  }
};

const CharacterAvatar = ({ preset, className = '' }) => {
  const hair = hairStyleMap[preset.hairStyle] || hairStyleMap.idol;
  const eyes = eyeStyleMap[preset.eyeStyle] || eyeStyleMap.spark;
  const mouth = mouthStyleMap[preset.mouthStyle] || mouthStyleMap.smile;

  return (
    <div className={`relative overflow-hidden isolate ${preset.backgroundClass} ${className}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.55),transparent_24%),radial-gradient(circle_at_82%_78%,rgba(255,255,255,0.24),transparent_18%)]" />
      <div className="absolute inset-x-[16%] bottom-[4%] h-[34%] rounded-t-[48%] bg-slate-900/10" />
      <div className={`absolute inset-x-[18%] bottom-[6%] h-[32%] rounded-t-[48%] ${preset.shirtClass}`}>
        <div className={`absolute left-1/2 top-[18%] h-[18%] w-[38%] -translate-x-1/2 rounded-full ${preset.shirtAccentClass}`} />
      </div>
      <div className={`absolute left-1/2 top-[28%] h-[10%] w-[14%] -translate-x-1/2 rounded-b-[40%] ${preset.skinClass}`} />
      <div className={`absolute left-1/2 top-[20%] h-[48%] w-[46%] -translate-x-1/2 rounded-[42%_42%_38%_38%] shadow-[inset_0_-8px_0_rgba(255,255,255,0.12)] ${preset.skinClass}`}>
        <div className={`absolute left-[18%] top-[58%] h-[8%] w-[10%] rounded-full blur-[1px] ${preset.cheekClass}`} />
        <div className={`absolute right-[18%] top-[58%] h-[8%] w-[10%] rounded-full blur-[1px] ${preset.cheekClass}`} />
        <div className={`${eyes.left} ${preset.eyeClass}`} />
        <div className={`${eyes.right} ${preset.eyeClass}`} />
        {eyes.shineLeft ? <div className={eyes.shineLeft} /> : null}
        {eyes.shineRight ? <div className={eyes.shineRight} /> : null}
        <div className={mouth} />
      </div>
      <div className={`${hair.top} ${preset.hairClass}`} />
      <div className={`${hair.left} ${preset.hairClass}`} />
      <div className={`${hair.right} ${preset.hairClass}`} />
      <div className={`${hair.fringe} ${preset.hairClass}`} />
      {renderAccessory(preset)}
      <span className="sr-only">{preset.label}</span>
    </div>
  );
};

const UserAvatar = ({ user, className = '', textClassName = '' }) => {
  const preset = getAvatarPreset(user?.avatar_key);
  const initials = getUserInitials(user?.name);

  if (preset) {
    return <CharacterAvatar preset={preset} className={className} />;
  }

  return (
    <div className={`flex items-center justify-center bg-transparent ${className}`}>
      <span className={textClassName || 'text-base font-system-ui font-semibold tracking-tight'}>{initials}</span>
    </div>
  );
};

export default UserAvatar;
