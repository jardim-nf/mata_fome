import React from 'react';
import { AGENTS } from '../constants/agents';

/**
 * PipelineStepper — Visual stepper for the 5-phase squad pipeline
 */
export default function PipelineStepper({ currentPhase, isLight }) {
  const stepIndex = ['architecture', 'ui', 'backend', 'qa', 'marketing'];

  const progressWidth = currentPhase === 'architecture' ? '10%'
    : currentPhase === 'ui' ? '30%'
      : currentPhase === 'backend' ? '55%'
        : currentPhase === 'qa' ? '80%'
          : currentPhase === 'marketing' || currentPhase === 'done' ? '100%'
            : '0%';

  return (
    <div className="squad-pipeline py-1">
      <div className="squad-step-line" />
      <div
        className="squad-step-line-active"
        style={{ width: progressWidth }}
      />

      {Object.values(AGENTS).map((ag, idx) => {
        const isCurrent = currentPhase === ag.phase;
        const isPast = currentPhase === 'done' || stepIndex.indexOf(currentPhase) > idx;

        return (
          <div key={ag.id} className="squad-step-dot flex flex-col items-center">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-all duration-350 ${isPast ? 'bg-indigo-650 border-indigo-400 text-white'
              : isCurrent ? 'bg-pink-600 border-pink-400 text-white shadow-[0_0_10px_rgba(219,39,119,0.5)] animate-pulse'
                : (isLight ? 'bg-slate-200 border-slate-300 text-slate-400' : 'bg-slate-950 border-slate-850 text-slate-500')
              }`}>
              {isPast ? '✓' : ag.emoji}
            </div>
            <span className={`text-[8.5px] font-black uppercase mt-1 ${isCurrent ? 'text-indigo-400' : 'text-slate-500'}`}>{ag.nome.split(' ')[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
