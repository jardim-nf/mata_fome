import React from 'react';

/**
 * SVGPreviews — Dynamic SVG renderers for Glass, Marble, and Food domains
 */

export function GlassSVG({ data }) {
  const w = data.largura || 1400;
  const h = data.altura || 1900;
  const cor = data.corVidro || 'Incolor';
  const metal = data.corAluminio || 'fosco';
  const pux = data.puxador || 'padrao';

  let glassFill = 'rgba(186, 230, 253, 0.25)';
  let glassStroke = '#38bdf8';
  if (cor === 'Fumê') {
    glassFill = 'rgba(55, 65, 81, 0.6)';
    glassStroke = '#4b5563';
  } else if (cor === 'Bronze') {
    glassFill = 'rgba(180, 83, 9, 0.4)';
    glassStroke = '#b45309';
  } else if (cor === 'Verde') {
    glassFill = 'rgba(16, 185, 129, 0.3)';
    glassStroke = '#10b981';
  }

  let metalFill = '#94a3b8'; // fosco
  if (metal === 'preto') metalFill = '#1e293b';
  else if (metal === 'branco') metalFill = '#f8fafc';
  else if (metal === 'bronze') metalFill = '#78350f';
  else if (metal === 'brilhante') metalFill = '#cbd5e1';

  return (
    <svg className="w-full h-72 squad-prototype-blueprint-bg border border-slate-800 rounded-xl" viewBox="0 0 400 300">
      <defs>
        <linearGradient id="metalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={metalFill} />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="100%" stopColor={metalFill} />
        </linearGradient>
      </defs>

      <line x1="20" y1="20" x2="380" y2="20" stroke="rgba(255,255,255,0.05)" />
      <line x1="20" y1="90" x2="380" y2="90" stroke="rgba(255,255,255,0.05)" />
      <line x1="20" y1="160" x2="380" y2="160" stroke="rgba(255,255,255,0.05)" />
      <line x1="20" y1="230" x2="380" y2="230" stroke="rgba(255,255,255,0.05)" />

      <path d="M 60 20 L 60 260 L 340 260" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="4 4" />

      {/* FIXED PANEL (Left) */}
      <rect x="80" y="45" width="115" height="205" fill={glassFill} stroke={glassStroke} strokeWidth="1.5" rx="3">
        <animate attributeName="opacity" values="0.7;0.9;0.7" dur="4s" repeatCount="indefinite" />
      </rect>
      <text x="137" y="150" fill={glassStroke} fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.6">FIXO</text>

      {/* SLIDING PANEL (Right) */}
      <rect x="185" y="45" width="125" height="205" fill={glassFill} stroke={glassStroke} strokeWidth="1.5" rx="3">
        <animate attributeName="x" values="185;170;185" dur="8s" repeatCount="indefinite" />
      </rect>
      <text x="245" y="150" fill={glassStroke} fontSize="9" fontWeight="bold" textAnchor="middle" opacity="0.6">CORRER</text>

      {/* Hardware: Top Rail */}
      <rect x="75" y="38" width="245" height="10" fill="url(#metalGrad)" stroke="rgba(255,255,255,0.1)" rx="2" />
      <circle cx="200" cy="43" r="4" fill="#64748b" />
      <circle cx="290" cy="43" r="4" fill="#64748b" />

      {/* Handle */}
      {pux === 'padrao' && (
        <rect x="200" y="120" width="4" height="40" fill="url(#metalGrad)" rx="1" stroke="#475569" strokeWidth="0.5" />
      )}
      {pux === 'knob' && (
        <circle cx="200" cy="140" r="5" fill="url(#metalGrad)" stroke="#475569" strokeWidth="0.5" />
      )}
      {pux === 'furo' && (
        <circle cx="200" cy="140" r="6" fill="none" stroke={glassStroke} strokeWidth="2" />
      )}

      {/* Dimension Line Width */}
      <line x1="80" y1="265" x2="310" y2="265" stroke="#818cf8" strokeWidth="1" />
      <path d="M 80 262 L 80 268 M 310 262 L 310 268" stroke="#818cf8" strokeWidth="1" />
      <text x="195" y="278" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle">{w} mm</text>

      {/* Dimension Line Height */}
      <line x1="70" y1="45" x2="70" y2="250" stroke="#818cf8" strokeWidth="1" />
      <path d="M 67 45 L 73 45 M 67 250 L 73 250" stroke="#818cf8" strokeWidth="1" />
      <text x="50" y="150" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform="rotate(-90 50 150)">{h} mm</text>

      {/* NBR Stamp */}
      <rect x="230" y="220" width="70" height="24" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="0.5" rx="4" />
      <text x="265" y="231" fill="#10b981" fontSize="6" fontWeight="black" textAnchor="middle">CONFORME</text>
      <text x="265" y="239" fill="#10b981" fontSize="6" fontWeight="black" textAnchor="middle">NBR 7199 (8mm)</text>
    </svg>
  );
}

export function MarbleSVG({ data }) {
  const w = data.largura || 1800;
  const d = data.profundidade || 600;
  const pedra = data.pedra || 'Granito Verde Ubatuba';
  const saia = data.saiaAtiva ?? true;
  const altSaia = data.alturaSaia || 40;
  const rodo = data.rodopiaAtivo ?? true;
  const altRodo = data.alturaRodopia || 100;
  const acab = data.acabamento || 'Meia Esquadria';

  let stoneColor = '#065f46';
  if (pedra.toLowerCase().includes('preto')) stoneColor = '#1e293b';
  else if (pedra.toLowerCase().includes('cinza')) stoneColor = '#475569';
  else if (pedra.toLowerCase().includes('carrara') || pedra.toLowerCase().includes('branco')) stoneColor = '#f1f5f9';
  else if (pedra.toLowerCase().includes('travertino') || pedra.toLowerCase().includes('amarelo')) stoneColor = '#fef08a';

  return (
    <svg className="w-full h-72 squad-prototype-blueprint-bg border border-slate-800 rounded-xl" viewBox="0 0 400 300">
      <defs>
        <pattern id="veins" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M 10 0 C 30 20, 20 60, 40 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          <path d="M 60 0 C 80 40, 70 80, 90 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect x="70" y="70" width="260" height="130" fill={stoneColor} stroke="#ffffff" strokeOpacity="0.2" rx="4" />
      <rect x="70" y="70" width="260" height="130" fill="url(#veins)" rx="4" />

      {rodo && (
        <>
          <rect x="70" y="55" width="260" height="15" fill={stoneColor} stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" opacity="0.8" />
          <text x="200" y="65" fill="#f8fafc" fontSize="7" textAnchor="middle" fontWeight="bold">RODOPIA (+{altRodo}mm)</text>
        </>
      )}

      {saia && (
        <>
          <line x1="70" y1="200" x2="330" y2="200" stroke="#f43f5e" strokeWidth="2.5" />
          <text x="200" y="213" fill="#f43f5e" fontSize="7" textAnchor="middle" fontWeight="bold">SAIA (+{altSaia}mm) - {acab}</text>
        </>
      )}

      {/* Dimension Line Width */}
      <line x1="70" y1="235" x2="330" y2="235" stroke="#818cf8" strokeWidth="1" />
      <path d="M 70 232 L 70 238 M 330 232 L 330 238" stroke="#818cf8" strokeWidth="1" />
      <text x="200" y="248" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle">{w} mm</text>

      {/* Dimension Line Depth */}
      <line x1="50" y1="70" x2="50" y2="200" stroke="#818cf8" strokeWidth="1" />
      <path d="M 47 70 L 53 70 M 47 200 L 53 200" stroke="#818cf8" strokeWidth="1" />
      <text x="30" y="135" fill="#818cf8" fontSize="10" fontWeight="bold" textAnchor="middle" transform="rotate(-90 30 135)">{d} mm</text>

      <rect x="75" y="110" width="250" height="40" fill="rgba(0,0,0,0.6)" rx="6" />
      <text x="200" y="125" fill="#f1f5f9" fontSize="8" fontWeight="black" textAnchor="middle">{pedra}</text>
      <text x="200" y="137" fill="#94a3b8" fontSize="7" textAnchor="middle">Otimização: Plano 2D com folga de corte de 5mm</text>
    </svg>
  );
}

export function FoodSVG() {
  return (
    <div className="w-full p-4 squad-prototype-blueprint-bg border border-slate-800 rounded-xl space-y-3 bg-slate-950 text-left font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <div>
          <h4 className="text-white text-xs font-black">IdeaFood Faturamento SaaS</h4>
          <p className="text-[9px] text-slate-500">Fluxo de pedidos sincronizado com a cozinha</p>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[8px] font-black border border-emerald-500/20">LIVE</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[8px] text-slate-500 block uppercase font-black">Pedidos</span>
          <span className="text-sm font-black text-white">42</span>
        </div>
        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[8px] text-slate-500 block uppercase font-black">Ticket Médio</span>
          <span className="text-sm font-black text-white">R$ 54,80</span>
        </div>
        <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800 text-center">
          <span className="text-[8px] text-slate-500 block uppercase font-black">Faturamento</span>
          <span className="text-sm font-black text-emerald-400">R$ 2.301</span>
        </div>
      </div>

      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-800 space-y-1.5 text-[10px]">
        <div className="flex justify-between text-slate-400">
          <span>Servidor API Firebase:</span>
          <span className="text-white font-bold">Online</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Notificação Cozinha (Zustand):</span>
          <span className="text-indigo-400 font-bold">Conectado (WebSockets)</span>
        </div>
      </div>
    </div>
  );
}
