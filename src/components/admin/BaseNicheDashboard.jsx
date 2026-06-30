import React from 'react';

import { IoRefreshOutline } from 'react-icons/io5';

// Fix import path for BackButton since BaseNicheDashboard is in src/components/admin
// Actually, BackButton is usually in src/components/BackButton
import BackButtonComponent from '../BackButton'; 

export const BaseNicheDashboard = ({
  title,
  icon,
  description,
  environmentBadge,
  gradientColor = "from-amber-400 to-amber-500", // Default gradient
  tabs,
  activeTab,
  setActiveTab,
  showSeedButton = false,
  onSeed = () => {},
  children
}) => {
  return (
    <div className="min-h-screen bg-slate-100/50 pb-12 text-slate-800">
      
      {/* Top Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl shadow-indigo-900/10 mb-6 print:hidden">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-left">
            <BackButtonComponent />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                <h1 className={`text-xl sm:text-2xl font-black tracking-tight bg-gradient-to-r ${gradientColor} bg-clip-text text-transparent`}>
                  {title}
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {showSeedButton && (
              <button
                onClick={onSeed}
                className={`px-3.5 py-2 bg-slate-800/50 border border-slate-700 hover:bg-slate-700 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5`}
              >
                <IoRefreshOutline className="animate-spin-slow" size={14} /> Importar Insumos Padrão
              </button>
            )}
            <div className="h-6 w-[1px] bg-slate-700 hidden sm:block" />
            <span className="text-xs bg-slate-800/80 border border-slate-700/60 font-black px-3 py-1.5 rounded-xl uppercase tracking-wider text-slate-300">
              {environmentBadge}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Seletor de Abas Principal */}
        <div className="bg-white border border-slate-200 rounded-3xl p-2.5 shadow-sm flex flex-wrap gap-1.5 print:hidden">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] py-3 rounded-2xl font-black text-xs uppercase transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/20 ring-2 ring-indigo-500/30'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 hover:shadow-inner'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {children}

      </div>
    </div>
  );
};
