import React from 'react';

export const getAlumColor = (colorName) => {
  const name = String(colorName || '').toLowerCase();
  if (name.includes('branco')) return '#f1f5f9';
  if (name.includes('preto')) return '#1e293b';
  if (name.includes('bronze')) return '#451a03';
  if (name.includes('dourado') || name.includes('gold')) return '#b8860b';
  if (name.includes('rose')) return '#c4848a';
  if (name.includes('champagne')) return '#c4ab86';
  if (name.includes('grafite')) return '#374151';
  if (name.includes('inox')) return '#9ca3af';
  if (name.includes('brilhante') || name.includes('cromado')) return '#cbd5e1';
  if (name.includes('corten')) return '#8b4513';
  if (name.includes('amadeirado')) return '#6b3a1f';
  return '#64748b'; // Fosco Natural (default)
};

export const getGlassFill = (colorName) => {
  const name = String(colorName || '').toLowerCase();
  if (name.includes('fumê escuro') || name.includes('fume escuro')) return 'url(#glass-fume)';
  if (name.includes('fumê') || name.includes('fume') || name.includes('cinza')) return 'url(#glass-fume)';
  if (name.includes('bronze')) return 'url(#glass-bronze)';
  if (name.includes('verde')) return 'url(#glass-verde)';
  if (name.includes('extra clear') || name.includes('baixo ferro')) return 'url(#glass-incolor)';
  if (name.includes('acidato') || name.includes('fosco')) return 'url(#glass-acidato)';
  if (name.includes('boreal') || name.includes('canelado')) return 'url(#glass-boreal)';
  if (name.includes('refletivo')) return 'url(#glass-refletivo)';
  if (name.includes('serigrafado branco')) return 'url(#glass-serig-branco)';
  if (name.includes('serigrafado preto')) return 'url(#glass-serig-preto)';
  return 'url(#glass-incolor)'; // Incolor / Default
};

export const renderHandle = (x, y, tipo = 'padrao', strokeColor = '#0f172a') => {
  const p = String(tipo || '').toLowerCase();
  let normalized = 'padrao';
  if (p.includes('h_simples') || p.includes('simples')) normalized = 'h_simples';
  else if (p.includes('barra_45') || p.includes('45')) normalized = 'barra_45';
  else if (p.includes('barra') || p.includes('tubular')) normalized = 'barra';
  else if (p.includes('knob') || p.includes('botao') || p.includes('botão') || p.includes('redondo')) normalized = 'knob';
  else if (p.includes('concha')) normalized = 'concha';
  else if (p.includes('furo') || p.includes('furação') || p.includes('furacao')) normalized = 'furo';
  else if (p.includes('sem')) normalized = 'sem';

  if (normalized === 'sem') return null;

  if (normalized === 'furo') {
    return (
      <g>
        <circle cx={x} cy={y} r="4" fill="none" stroke={strokeColor} strokeWidth="1.2" />
        <circle cx={x} cy={y} r="2" fill="#ffffff" />
      </g>
    );
  }
  if (normalized === 'knob') {
    return (
      <g>
        <circle cx={x} cy={y} r="5" fill="#cbd5e1" stroke={strokeColor} strokeWidth="1.5" />
        <circle cx={x} cy={y} r="2" fill="none" stroke={strokeColor} strokeWidth="0.8" />
      </g>
    );
  }
  if (normalized === 'concha') {
    return (
      <g>
        <rect x={x - 3} y={y - 12} width="6" height="24" rx="1.5" fill="#e2e8f0" stroke={strokeColor} strokeWidth="1.2" />
        <rect x={x - 1.5} y={y - 8} width="3" height="16" rx="0.5" fill="#475569" />
      </g>
    );
  }
  if (normalized === 'h_simples') {
    return (
      <g>
        <rect x={x - 2} y={y - 16} width="4" height="32" fill="#e2e8f0" stroke={strokeColor} strokeWidth="1.5" />
        <line x1={x - 2} y1={y - 10} x2={x + 2} y2={y - 10} stroke={strokeColor} strokeWidth="1.5" />
        <line x1={x - 2} y1={y + 10} x2={x + 2} y2={y + 10} stroke={strokeColor} strokeWidth="1.5" />
      </g>
    );
  }
  if (normalized === 'barra') {
    return (
      <g>
        <line x1={x + 2} y1={y - 24} x2={x + 2} y2={y + 24} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={x} y1={y - 22} x2={x + 2} y2={y - 22} stroke={strokeColor} strokeWidth="1.5" />
        <line x1={x} y1={y + 22} x2={x + 2} y2={y + 22} stroke={strokeColor} strokeWidth="1.5" />
      </g>
    );
  }
  if (normalized === 'barra_45') {
    return (
      <g>
        <line x1={x + 4} y1={y - 30} x2={x + 4} y2={y + 30} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={x} y1={y - 20} x2={x + 4} y2={y - 16} stroke={strokeColor} strokeWidth="1.5" />
        <line x1={x} y1={y + 20} x2={x + 4} y2={y + 16} stroke={strokeColor} strokeWidth="1.5" />
      </g>
    );
  }
  return (
    <g>
      <line x1={x} y1={y - 12} x2={x} y2={y + 12} stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1={x - 2} y1={y - 8} x2={x} y2={y - 8} stroke={strokeColor} strokeWidth="1.5" />
      <line x1={x - 2} y1={y + 8} x2={x} y2={y + 8} stroke={strokeColor} strokeWidth="1.5" />
    </g>
  );
};

const ProjectSvgViewer = ({
  modeloType,
  modeloNome,
  w,
  h,
  wVao,
  hVao,
  lado,
  sentido,
  puxador,
  aluminio,
  corGlass,
  isOpen,
  width = 220,
  height = 175
}) => {
  const maxW = width - 80;
  const maxH = height - 45;
  const ratio = (w && h) ? w / h : 1.2;
  let drawW = maxW;
  let drawH = maxW / ratio;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = maxH * ratio;
  }
  const svgX = (width - drawW) / 2;
  const svgY = (height - 15 - drawH) / 2;
  
  const alumColor = getAlumColor(aluminio);
  const glassFill = getGlassFill(corGlass);
  
  const isPivot = String(modeloNome || '').toLowerCase().includes('pivotante');
  const isSwing = String(modeloNome || '').toLowerCase().includes('abrir') || String(modeloNome || '').toLowerCase().includes('giro');
  const isBasculante = String(modeloNome || '').toLowerCase().includes('basculante') || String(modeloNome || '').toLowerCase().includes('maxim-ar') || String(modeloNome || '').toLowerCase().includes('haste');
  
  return (
    <svg width={width} height={height} className="bg-white rounded-xl border border-slate-200 shadow-sm print:border-none print:shadow-none select-none">
      <defs>
        <pattern id="grid-calc" width="15" height="15" patternUnits="userSpaceOnUse">
          <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(15,23,42,0.03)" strokeWidth="1"/>
        </pattern>
        <marker id="arrow-receipt" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
        </marker>
        <linearGradient id="glass-incolor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="glass-fume" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#334155" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="glass-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d97706" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#78350f" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="glass-verde" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="glass-acidato" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="glass-boreal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="glass-refletivo" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#e2e8f0" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#64748b" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="glass-serig-branco" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e2e8f0" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="glass-serig-preto" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      
      <rect width={width} height={height} fill="url(#grid-calc)" />
      
      <g transform={`translate(${svgX}, ${svgY})`}>
        {modeloType === 'box' && (() => {
          const isElegance = String(modeloNome || '').toLowerCase().includes('elegance');
          const isFlex = String(modeloNome || '').toLowerCase().includes('flex');
          const isCorner = String(modeloNome || '').toLowerCase().includes('canto') || String(modeloNome || '').toLowerCase().includes('l');
          
          if (isSwing) {
            const hingeLeft = lado === 'esquerda';
            const doorW = drawW * 0.6;
            const fixedW = drawW - doorW;
            const fixedX = hingeLeft ? doorW : 0;
            const doorStartX = hingeLeft ? 0 : fixedW;
            
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="2.5" />
                <rect x={fixedX} y="0" width={fixedW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                <line x1={hingeLeft ? 0 : drawW} y1="0" x2={hingeLeft ? 0 : drawW} y2={drawH} stroke={alumColor} strokeWidth="4" />
                
                {isOpen ? (
                  <g>
                    <path 
                      d={hingeLeft 
                        ? `M ${doorW} ${drawH} A ${doorW} ${doorW} 0 0 0 ${doorW * 0.7} ${drawH - doorW * 0.7}`
                        : `M ${fixedW} ${drawH} A ${doorW} ${doorW} 0 0 1 ${fixedW + doorW * 0.3} ${drawH - doorW * 0.7}`
                      } 
                      fill="none" 
                      stroke="#94a3b8" 
                      strokeWidth="1.2" 
                      strokeDasharray="2 2" 
                    />
                    <line 
                      x1={doorStartX} 
                      y1={drawH} 
                      x2={hingeLeft ? doorW * 0.7 : fixedW + doorW * 0.3} 
                      y2={drawH - doorW * 0.7} 
                      stroke={alumColor} 
                      strokeWidth="2.5" 
                    />
                    {renderHandle(
                      hingeLeft ? doorW * 0.7 - 8 : fixedW + doorW * 0.3 + 8,
                      drawH - doorW * 0.35,
                      puxador,
                      alumColor
                    )}
                  </g>
                ) : (
                  <g>
                    <rect x={doorStartX} y="0" width={doorW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    <line x1={doorStartX} y1="0" x2={hingeLeft ? doorW : fixedW} y2={drawH / 2} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1={doorStartX} y1={drawH} x2={hingeLeft ? doorW : fixedW} y2={drawH / 2} stroke="#64748b" strokeWidth="1" strokeDasharray="3 3" />
                    {renderHandle(
                      hingeLeft ? doorW - 10 : fixedW + 10,
                      drawH / 2,
                      puxador,
                      alumColor
                    )}
                  </g>
                )}
              </g>
            );
          }
          
          if (isFlex) {
            const foldLeft = lado === 'esquerda';
            const panelW = drawW / 2;
            
            if (isOpen) {
              return (
                <g>
                  <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="2.5" />
                  {foldLeft ? (
                    <g>
                      <line x1="0" y1="0" x2="25" y2={drawH * 0.4} stroke={alumColor} strokeWidth="2.5" />
                      <line x1="25" y1={drawH * 0.4} x2="5" y2={drawH * 0.8} stroke={alumColor} strokeWidth="2.5" />
                      <circle cx="25" cy={drawH * 0.4} r="2.5" fill={alumColor} />
                      <circle cx="5" cy={drawH * 0.8} r="2.5" fill={alumColor} />
                      {renderHandle(18, drawH * 0.4, puxador, alumColor)}
                    </g>
                  ) : (
                    <g>
                      <line x1={drawW} y1="0" x2={drawW - 25} y2={drawH * 0.4} stroke={alumColor} strokeWidth="2.5" />
                      <line x1={drawW - 25} y1={drawH * 0.4} x2={drawW - 5} y2={drawH * 0.8} stroke={alumColor} strokeWidth="2.5" />
                      <circle cx={drawW - 25} cy={drawH * 0.4} r="2.5" fill={alumColor} />
                      <circle cx={drawW - 5} cy={drawH * 0.8} r="2.5" fill={alumColor} />
                      {renderHandle(drawW - 18, drawH * 0.4, puxador, alumColor)}
                    </g>
                  )}
                </g>
              );
            } else {
              return (
                <g>
                  <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="2.5" />
                  <rect x="0" y="0" width={panelW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                  <rect x={panelW} y="0" width={panelW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                  <circle cx={panelW} cy={drawH / 2} r="3" fill={alumColor} />
                  {renderHandle(foldLeft ? panelW - 10 : panelW + 10, drawH / 2, puxador, alumColor)}
                </g>
              );
            }
          }
          
          if (isCorner) {
            return (
              <g>
                <line x1="0" y1={drawH * 0.3} x2="0" y2={drawH} stroke={alumColor} strokeWidth="4" />
                <line x1={drawW} y1={drawH * 0.3} x2={drawW} y2={drawH} stroke={alumColor} strokeWidth="4" />
                <polygon points={`0,${drawH * 0.3} ${drawW / 2},${drawH * 0.5} ${drawW / 2},${drawH} 0,${drawH}`} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                {isOpen ? (
                  <polygon points={`${drawW / 2 + 15},${drawH * 0.5 - 10} ${drawW - 10},${drawH * 0.3 - 10} ${drawW - 10},${drawH - 10} ${drawW / 2 + 15},${drawH - 10}`} fill={glassFill} stroke={alumColor} strokeWidth="2" opacity="0.8" />
                ) : (
                  <polygon points={`${drawW / 2},${drawH * 0.5} ${drawW},${drawH * 0.3} ${drawW},${drawH} ${drawW / 2},${drawH}`} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                )}
                {renderHandle(drawW * 0.6, drawH * 0.65, puxador, alumColor)}
              </g>
            );
          }
          
          const isLeftOpen = lado === 'esquerda';
          const fixedW = drawW / 2;
          const movingW = drawW / 2 + 12;
          
          return (
            <g>
              <rect y="0" width={drawW} height="6" fill={alumColor} stroke="none" />
              <rect y={drawH - 6} width={drawW} height="6" fill={alumColor} stroke="none" />
              <rect x="0" y="0" width="4" height={drawH} fill={alumColor} stroke="none" />
              <rect x={drawW - 4} y="0" width="4" height={drawH} fill={alumColor} stroke="none" />
              
              {isLeftOpen ? (
                <rect x={fixedW} y="4" width={fixedW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
              ) : (
                <rect x="0" y="4" width={fixedW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
              )}
              
              {isOpen ? (
                isLeftOpen ? (
                  <g>
                    <rect x={fixedW - 6} y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {isElegance && (
                      <g>
                        <circle cx={fixedW + 10} cy="3" r="3" fill="#0f172a" />
                        <circle cx={drawW - 15} cy="3" r="3" fill="#0f172a" />
                      </g>
                    )}
                    {renderHandle(fixedW + 6, drawH / 2, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x="6" y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {isElegance && (
                      <g>
                        <circle cx="15" cy="3" r="3" fill="#0f172a" />
                        <circle cx={fixedW - 10} cy="3" r="3" fill="#0f172a" />
                      </g>
                    )}
                    {renderHandle(fixedW - 6, drawH / 2, puxador, alumColor)}
                  </g>
                )
              ) : (
                isLeftOpen ? (
                  <g>
                    <rect x="0" y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {isElegance && (
                      <g>
                        <circle cx="15" cy="3" r="3" fill="#0f172a" />
                        <circle cx={fixedW - 5} cy="3" r="3" fill="#0f172a" />
                      </g>
                    )}
                    {renderHandle(fixedW - 10, drawH / 2, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x={fixedW - 12} y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {isElegance && (
                      <g>
                        <circle cx={fixedW + 5} cy="3" r="3" fill="#0f172a" />
                        <circle cx={drawW - 15} cy="3" r="3" fill="#0f172a" />
                      </g>
                    )}
                    {renderHandle(fixedW + 10, drawH / 2, puxador, alumColor)}
                  </g>
                )
              )}
            </g>
          );
        })()}
        
        {modeloType === 'janela' && (() => {
          const is2Folhas = String(modeloNome || '').toLowerCase().includes('2 folhas') || isSwing;
          
          if (isSwing) {
            const leafW = drawW / 2;
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="3" />
                {isOpen ? (
                  <g>
                    <path d={`M 0 ${drawH} A ${leafW} ${leafW} 0 0 1 ${leafW * 0.3} ${drawH - leafW * 0.7}`} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="0" y1={drawH} x2={leafW * 0.3} y2={drawH - leafW * 0.7} stroke={alumColor} strokeWidth="2" />
                    <path d={`M ${drawW} ${drawH} A ${leafW} ${leafW} 0 0 0 ${drawW - leafW * 0.3} ${drawH - leafW * 0.7}`} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1={drawW} y1={drawH} x2={drawW - leafW * 0.3} y2={drawH - leafW * 0.7} stroke={alumColor} strokeWidth="2" />
                    {renderHandle(leafW * 0.3 - 5, drawH - leafW * 0.35, puxador, alumColor)}
                    {renderHandle(drawW - leafW * 0.3 + 5, drawH - leafW * 0.35, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x="0" y="0" width={leafW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    <rect x={leafW} y="0" width={leafW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    <line x1="0" y1="0" x2={leafW} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1="0" y1={drawH} x2={leafW} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1={drawW} y1="0" x2={leafW} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1={drawW} y1={drawH} x2={leafW} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    {renderHandle(leafW - 8, drawH / 2, puxador, alumColor)}
                    {renderHandle(leafW + 8, drawH / 2, puxador, alumColor)}
                  </g>
                )}
              </g>
            );
          }
          
          if (isBasculante) {
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="3" />
                {isOpen ? (
                  <g>
                    <polygon points={`4,4 ${drawW - 4},4 ${drawW - 12},${drawH + 15} 12,${drawH + 15}`} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    <line x1="4" y1={drawH / 2} x2="12" y2={drawH + 5} stroke={alumColor} strokeWidth="1.5" />
                    <line x1={drawW - 4} y1={drawH / 2} x2={drawW - 12} y2={drawH + 5} stroke={alumColor} strokeWidth="1.5" />
                    {renderHandle(drawW / 2, drawH + 10, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x="4" y="4" width={drawW - 8} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    <line x1="0" y1={drawH} x2={drawW / 2} y2="0" stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1={drawW} y1={drawH} x2={drawW / 2} y2="0" stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    {renderHandle(drawW / 2, drawH - 12, puxador, alumColor)}
                  </g>
                )}
              </g>
            );
          }
          
          const isLeftOpen = lado === 'esquerda';
          if (is2Folhas) {
            const leafW = drawW / 2;
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="2.5" />
                {isLeftOpen ? (
                  <rect x={leafW} y="4" width={leafW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1" />
                ) : (
                  <rect x="0" y="4" width={leafW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1" />
                )}
                
                {isOpen ? (
                  isLeftOpen ? (
                    <g>
                      <rect x={leafW - 5} y="6" width={leafW + 5} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                      {renderHandle(leafW + 10, drawH / 2, puxador, alumColor)}
                    </g>
                  ) : (
                    <g>
                      <rect x="0" y="6" width={leafW + 5} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                      {renderHandle(leafW - 10, drawH / 2, puxador, alumColor)}
                    </g>
                  )
                ) : (
                  isLeftOpen ? (
                    <g>
                      <rect x="0" y="6" width={leafW + 5} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                      {renderHandle(leafW - 10, drawH / 2, puxador, alumColor)}
                    </g>
                  ) : (
                    <g>
                      <rect x={leafW - 5} y="6" width={leafW + 5} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                      {renderHandle(leafW + 10, drawH / 2, puxador, alumColor)}
                    </g>
                  )
                )}
              </g>
            );
          } else {
            const leafW = drawW / 4;
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="2.5" />
                <rect x="0" y="4" width={leafW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1" />
                <rect x={leafW * 3} y="4" width={leafW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1" />
                
                {isOpen ? (
                  <g>
                    <rect x="4" y="6" width={leafW + 5} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    <rect x={leafW * 3 - 9} y="6" width={leafW + 5} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    {renderHandle(leafW - 5, drawH / 2, puxador, alumColor)}
                    {renderHandle(leafW * 3 + 5, drawH / 2, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x={leafW - 5} y="6" width={leafW + 8} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    <rect x={leafW * 2 - 3} y="6" width={leafW + 8} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                    {renderHandle(leafW * 2 - 12, drawH / 2, puxador, alumColor)}
                    {renderHandle(leafW * 2 + 12, drawH / 2, puxador, alumColor)}
                  </g>
                )}
              </g>
            );
          }
        })()}
        
        {modeloType === 'porta' && (() => {
          const hingeLeft = lado === 'esquerda';
          const hasFixo = String(modeloNome || '').toLowerCase().includes('fixo');
          const doorW = hasFixo ? drawW * 0.75 : drawW;
          const fixedW = drawW - doorW;
          const fixedX = hingeLeft ? doorW : 0;
          const doorStartX = hingeLeft ? 0 : fixedW;
          
          if (isPivot) {
            const pivotDist = 25;
            const pivotX = hingeLeft ? doorStartX + pivotDist : doorStartX + doorW - pivotDist;
            
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="3" />
                
                {hasFixo && (
                  <rect x={fixedX} y="0" width={fixedW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                )}
                
                <circle cx={pivotX} cy="3" r="2.5" fill={alumColor} />
                <circle cx={pivotX} cy={drawH - 3} r="2.5" fill={alumColor} />
                
                {isOpen ? (
                  <g>
                    <path 
                      d={hingeLeft
                        ? `M ${doorStartX + doorW} ${drawH} A ${doorW - pivotDist} ${doorW - pivotDist} 0 0 0 ${pivotX + (doorW - pivotDist)*0.7} ${drawH - (doorW - pivotDist)*0.7}`
                        : `M ${doorStartX} ${drawH} A ${doorW - pivotDist} ${doorW - pivotDist} 0 0 1 ${pivotX - (doorW - pivotDist)*0.7} ${drawH - (doorW - pivotDist)*0.7}`
                      } 
                      fill="none" 
                      stroke="#94a3b8" 
                      strokeWidth="1.2" 
                      strokeDasharray="2 2" 
                    />
                    {hingeLeft ? (
                      <g>
                        <line x1={pivotX - 12} y1={drawH - 12} x2={pivotX + (doorW - pivotDist)*0.7} y2={drawH - (doorW - pivotDist)*0.7} stroke={alumColor} strokeWidth="2.5" />
                        {renderHandle(pivotX + (doorW - pivotDist)*0.7 - 8, drawH - (doorW - pivotDist)*0.35, puxador, alumColor)}
                      </g>
                    ) : (
                      <g>
                        <line x1={pivotX + 12} y1={drawH - 12} x2={pivotX - (doorW - pivotDist)*0.7} y2={drawH - (doorW - pivotDist)*0.7} stroke={alumColor} strokeWidth="2.5" />
                        {renderHandle(pivotX - (doorW - pivotDist)*0.7 + 8, drawH - (doorW - pivotDist)*0.35, puxador, alumColor)}
                      </g>
                    )}
                  </g>
                ) : (
                  <g>
                    <rect x={doorStartX + 2} y="4" width={doorW - 4} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    <line x1={pivotX} y1="0" x2={hingeLeft ? doorStartX + doorW : doorStartX} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1={pivotX} y1={drawH} x2={hingeLeft ? doorStartX + doorW : doorStartX} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    {renderHandle(hingeLeft ? doorStartX + doorW - 15 : doorStartX + 15, drawH / 2, puxador, alumColor)}
                  </g>
                )}
              </g>
            );
          }
          
          if (isSwing) {
            return (
              <g>
                <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="3" />
                
                {hasFixo && (
                  <rect x={fixedX} y="0" width={fixedW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="1.5" />
                )}
                
                {isOpen ? (
                  <g>
                    <path 
                      d={hingeLeft
                        ? `M ${doorStartX + doorW} ${drawH} A ${doorW} ${doorW} 0 0 0 ${doorStartX + doorW * 0.7} ${drawH - doorW * 0.7}`
                        : `M ${doorStartX} ${drawH} A ${doorW} ${doorW} 0 0 1 ${doorStartX + doorW * 0.3} ${drawH - doorW * 0.7}`
                      } 
                      fill="none" 
                      stroke="#94a3b8" 
                      strokeWidth="1.2" 
                      strokeDasharray="2 2" 
                    />
                    <line 
                      x1={hingeLeft ? doorStartX : doorStartX + doorW} 
                      y1={drawH} 
                      x2={hingeLeft ? doorStartX + doorW * 0.7 : doorStartX + doorW * 0.3} 
                      y2={drawH - doorW * 0.7} 
                      stroke={alumColor} 
                      strokeWidth="2.5" 
                    />
                    {renderHandle(
                      hingeLeft ? doorStartX + doorW * 0.7 - 8 : doorStartX + doorW * 0.3 + 8,
                      drawH - doorW * 0.35,
                      puxador,
                      alumColor
                    )}
                  </g>
                ) : (
                  <g>
                    <rect x={doorStartX + 2} y="4" width={doorW - 4} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    <line x1={hingeLeft ? doorStartX : doorStartX + doorW} y1="0" x2={hingeLeft ? doorStartX + doorW : doorStartX} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <line x1={hingeLeft ? doorStartX : doorStartX + doorW} y1={drawH} x2={hingeLeft ? doorStartX + doorW : doorStartX} y2={drawH / 2} stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 3" />
                    <rect x={hingeLeft ? doorStartX : doorStartX + doorW - 5} y="15" width="5" height="10" fill={alumColor} />
                    <rect x={hingeLeft ? doorStartX : doorStartX + doorW - 5} y={drawH - 25} width="5" height="10" fill={alumColor} />
                    {renderHandle(hingeLeft ? doorStartX + doorW - 15 : doorStartX + 15, drawH / 2, puxador, alumColor)}
                  </g>
                )}
              </g>
            );
          }
          
          const leafW = drawW / 2;
          const movingW = drawW / 2 + 10;
          return (
            <g>
              <rect width={drawW} height={drawH} fill="none" stroke={alumColor} strokeWidth="2.5" />
              {hingeLeft ? (
                <rect x={leafW} y="4" width={leafW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1" />
              ) : (
                <rect x="0" y="4" width={leafW} height={drawH - 8} fill={glassFill} stroke={alumColor} strokeWidth="1" />
              )}
              
              {isOpen ? (
                hingeLeft ? (
                  <g>
                    <rect x={leafW - 5} y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {renderHandle(leafW + 8, drawH / 2, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x="5" y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {renderHandle(leafW - 8, drawH / 2, puxador, alumColor)}
                  </g>
                )
              ) : (
                hingeLeft ? (
                  <g>
                    <rect x="0" y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {renderHandle(leafW - 12, drawH / 2, puxador, alumColor)}
                  </g>
                ) : (
                  <g>
                    <rect x={leafW - 10} y="6" width={movingW} height={drawH - 12} fill={glassFill} stroke={alumColor} strokeWidth="2" />
                    {renderHandle(leafW + 12, drawH / 2, puxador, alumColor)}
                  </g>
                )
              )}
            </g>
          );
        })()}
        
        {modeloType === 'espelho' && (
          <g>
            <rect width={drawW} height={drawH} fill={glassFill} stroke={alumColor} strokeWidth="2" />
            <rect x="4" y="4" width={drawW - 8} height={drawH - 8} fill="none" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="0.5" />
          </g>
        )}
        
        {modeloType === 'outros' && (
          <g>
            <polygon points={`0,0 ${drawW},0 ${drawW},${drawH} 0,${drawH}`} fill={glassFill} stroke={alumColor} strokeWidth="2" />
            <line x1="0" y1="0" x2={drawW} y2={drawH} stroke="rgba(15, 23, 42, 0.15)" strokeWidth="1" />
          </g>
        )}
        
        <line x1="0" y1={drawH + 12} x2={drawW} y2={drawH + 12} stroke="#0f172a" strokeWidth="1" markerStart="url(#arrow-receipt)" markerEnd="url(#arrow-receipt)" />
        <line x1={drawW + 12} y1="0" x2={drawW + 12} y2={drawH} stroke="#0f172a" strokeWidth="1" markerStart="url(#arrow-receipt)" markerEnd="url(#arrow-receipt)" />
      </g>
      
      <text x={svgX + drawW / 2} y={svgY + drawH + 23} fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="middle">
        {wVao} mm
      </text>
      <text x={svgX + drawW + 28} y={svgY + drawH / 2 + 3} fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="start">
        {hVao} mm
      </text>
    </svg>
  );
};

export default ProjectSvgViewer;
