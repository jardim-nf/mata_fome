import React from 'react';

export const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass, isDark, t, onClick, active, pulseRed }) => {
  const colorKey = colorClass.includes('emerald') ? 'emerald' :
                   colorClass.includes('amber') ? 'amber' :
                   colorClass.includes('red') ? 'red' : 'primary';

  const activeBg = colorKey === 'emerald' ? 'bg-emerald-500/10 dark:bg-emerald-500/20' :
                   colorKey === 'amber' ? 'bg-amber-500/10 dark:bg-amber-500/20' :
                   colorKey === 'red' ? 'bg-red-500/10 dark:bg-red-500/20' :
                   'bg-[var(--color-primary)]/10 dark:bg-[var(--color-primary)]/20';

  const activeBorder = colorKey === 'emerald' ? 'border-emerald-500/60' :
                       colorKey === 'amber' ? 'border-amber-500/60' :
                       colorKey === 'red' ? 'border-red-500/60' :
                       'border-[var(--color-primary)]/60';

  const activeShadow = colorKey === 'emerald' ? 'shadow-[0_4px_20px_rgba(16,185,129,0.15)]' :
                       colorKey === 'amber' ? 'shadow-[0_4px_20px_rgba(245,158,11,0.15)]' :
                       colorKey === 'red' ? 'shadow-[0_4px_20px_rgba(239,68,68,0.15)]' :
                       'shadow-[0_4px_20px_rgba(16,185,129,0.15)]';

  return (
    <div 
      onClick={onClick}
      className={`group rounded-[2rem] p-5 border flex items-center justify-between transition-all duration-300 relative overflow-hidden select-none ${
        onClick ? 'cursor-pointer active:scale-95' : ''
      } ${
        pulseRed
          ? 'animate-pulse-red scale-[1.02] -translate-y-1'
          : active 
            ? `${activeBg} ${activeBorder} ${activeShadow} scale-[1.02] -translate-y-1` 
            : `${t.cardBg} ${t.border} hover:border-[var(--color-primary)]/20 hover:-translate-y-1`
      }`}
    >
      <style>{`
        @keyframes pulseRed {
          0%, 100% {
            border-color: rgba(239, 68, 68, 0.4);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.2);
            background-color: ${isDark ? 'rgba(30, 20, 20, 0.6)' : 'rgba(254, 242, 242, 0.8)'};
          }
          50% {
            border-color: rgba(239, 68, 68, 1);
            box-shadow: 0 0 15px 5px rgba(239, 68, 68, 0.35);
            background-color: ${isDark ? 'rgba(60, 20, 20, 0.8)' : 'rgba(254, 226, 226, 1)'};
          }
        }
        .animate-pulse-red {
          animation: pulseRed 1.8s infinite ease-in-out;
        }
      `}</style>
      <div className={`absolute -right-4 -bottom-4 w-28 h-28 rounded-full blur-2xl opacity-10 group-hover:scale-150 transition-transform duration-700 bg-[var(--color-primary)]/10`}></div>
      
      {/* Dynamic left accent border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-r-full ${
        colorKey === 'red' ? 'bg-red-500' :
        colorKey === 'amber' ? 'bg-amber-500' :
        colorKey === 'emerald' ? 'bg-emerald-500' :
        'bg-[var(--color-primary)]'
      }`} />

      <div className="relative z-10 pl-2">
        <p className={`text-xs font-extrabold uppercase tracking-widest mb-1.5 ${t.textMuted}`}>{title}</p>
        <p className={`text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</p>
      </div>
      <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-300 ${
        active
          ? colorKey === 'emerald' ? 'bg-emerald-500 text-white' :
            colorKey === 'amber' ? 'bg-amber-500 text-white' :
            colorKey === 'red' ? 'bg-red-500 text-white' :
            'bg-[var(--color-primary)] text-white'
          : isDark 
            ? 'bg-slate-900 text-[var(--color-primary)] border border-slate-800' 
            : 'bg-[var(--color-primary)]/[0.08] text-[var(--color-primary)] border border-[var(--color-primary)]/10'
      }`}>
        <Icon className="text-xl" />
      </div>
    </div>
  );
};
