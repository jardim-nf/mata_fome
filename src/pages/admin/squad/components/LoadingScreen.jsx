import React from 'react';
import './LoadingScreen.css';

/**
 * LoadingScreen — NASA/Habbo Hotel styled loading screen
 */
export default function LoadingScreen({ loadingProgress, loadingLogs }) {
  return (
    <div className="squad-nasa-loading">
      <div className="squad-loading-box">
        <div className="flex items-center gap-3 mb-4 justify-center">
          <span className="text-2xl">🏨</span>
          <h1 style={{ fontFamily: "'Press Start 2P', monospace" }} className="text-[11px] tracking-wide text-[#f5a623]">
            SQUAD HOTEL
          </h1>
        </div>

        <div className="squad-loading-bar-container">
          <div
            className="squad-loading-bar-fill"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] text-[#3ec98c] font-mono mt-1.5 px-1 font-bold">
          <span>CARREGANDO HOTEL...</span>
          <span>{loadingProgress}%</span>
        </div>

        <div className="squad-loading-terminal mt-6 text-left font-mono">
          {loadingLogs.map((log, i) => (
            <div key={i} className="text-[#3ec98c] leading-relaxed text-[11px] font-bold">
              {log}
            </div>
          ))}
          <div className="text-[#4e5579] animate-pulse text-[11px] mt-1 font-bold">
            &gt; PREPARANDO QUARTOS DOS AGENTES_
          </div>
        </div>
      </div>
    </div>
  );
}
