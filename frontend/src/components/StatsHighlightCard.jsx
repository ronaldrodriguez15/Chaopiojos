import React from 'react';

const StatsHighlightCard = ({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'from-slate-50 to-slate-100 border-slate-200 text-slate-700',
  className = '',
}) => {
  return (
    <div className={`rounded-[1.75rem] p-4 sm:p-6 bg-gradient-to-br border-4 shadow-xl flex items-center gap-3 sm:gap-4 ${tone} ${className}`.trim()}>
      <div className="p-2 sm:p-3 rounded-2xl bg-white/70 border-2 border-white/60 shadow-sm">
        {Icon ? <Icon className="w-7 h-7 sm:w-8 sm:h-8" /> : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-black opacity-90">{label}</p>
        <p className="text-3xl sm:text-4xl font-black leading-tight break-words">{value}</p>
        {helper ? <p className="mt-2 text-xs sm:text-sm font-bold opacity-80">{helper}</p> : null}
      </div>
    </div>
  );
};

export default StatsHighlightCard;
