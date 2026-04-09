import React from 'react';

const StatCard = ({ icon: Icon, label, value, colorClass, bgClass, children }) => (
    <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between min-w-[120px] sm:min-w-[140px] flex-1 lg:flex-none gap-2">
        <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
            {children || <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight truncate">{value}</h3>}
        </div>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg sm:text-xl shrink-0 ${bgClass} ${colorClass}`}>
            <Icon />
        </div>
    </div>
);

export default StatCard;
