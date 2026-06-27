import React, { memo } from 'react';

const AGENTS = {
  oscar: { emoji: '🔍' },
  leo: { emoji: '🎨' },
  afrodite: { emoji: '🌸' },
  thor: { emoji: '⚡' },
  sabotagem: { emoji: '🎤' }
};

const STEPS = [
  { id: 'oscar', phase: 'architecture', label: 'Oscar' },
  { id: 'leo', phase: 'ui', label: 'Sheldon' },
  { id: 'afrodite', phase: 'backend', label: 'Nairobi' },
  { id: 'thor', phase: 'qa', label: 'Ragnar' },
  { id: 'sabotagem', phase: 'marketing', label: 'Sabotagem' }
];

const PHASES = ['architecture', 'ui', 'backend', 'qa', 'marketing', 'done'];

const PHASE_WIDTH = {
  architecture: '10%',
  ui: '30%',
  backend: '50%',
  qa: '70%',
  marketing: '90%',
  done: '100%'
};

/**
 * SquadBottomBar — Pipeline progress indicator with agent avatars.
 * Extracted from SquadMeeting3D.jsx for modularity.
 */
function SquadBottomBar({ currentPhase }) {
  const currentIdx = PHASES.indexOf(currentPhase);

  return (
    <div className="squad-bottombar">
      <div className="squad-pipeline">
        <div className="squad-step-line" />
        <div 
          className="squad-step-line-active" 
          style={{ width: PHASE_WIDTH[currentPhase] || '0%' }} 
        />
        {STEPS.map((step) => {
          const stepIdx = PHASES.indexOf(step.phase);
          const isDone = currentIdx > stepIdx;
          const isActive = currentPhase === step.phase;
          const agent = AGENTS[step.id];

          return (
            <div key={step.id} className="squad-step-dot">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all duration-500 ${
                isActive
                  ? 'bg-[var(--sq-accent)] shadow-[0_0_20px_var(--sq-accent-glow)] scale-115 ring-2 ring-[var(--sq-accent)]/30'
                  : isDone
                    ? 'bg-[var(--sq-accent2)] opacity-90 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                    : 'bg-slate-800/60 opacity-40'
              }`}>
                {agent?.emoji}
              </div>
              <span className={`text-[9px] font-black mt-1.5 uppercase tracking-wide ${
                isActive ? 'text-[var(--sq-accent)]' : isDone ? 'text-[var(--sq-accent2)]' : 'text-[var(--sq-text-muted)]'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(SquadBottomBar);
