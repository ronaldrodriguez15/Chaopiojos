import React from 'react';
import { getAvatarPreset, getUserInitials } from '@/lib/profileOptions';

const UserAvatar = ({ user, className = '', textClassName = '' }) => {
  const preset = getAvatarPreset(user?.avatar_key);
  const initials = getUserInitials(user?.name);

  if (user?.profile_photo_url) {
    return (
      <div className={`overflow-hidden bg-white ${className}`}>
        <img src={user.profile_photo_url} alt={user?.name || 'Perfil'} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (preset) {
    return (
      <div className={`flex items-center justify-center ${preset.className} ${className}`}>
        <span className={textClassName || 'text-xl'}>{preset.emoji}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-500 text-white font-black ${className}`}>
      <span className={textClassName || 'text-base'}>{initials}</span>
    </div>
  );
};

export default UserAvatar;
