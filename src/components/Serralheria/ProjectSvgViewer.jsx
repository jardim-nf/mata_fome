import React from 'react';

export const getMetalColor = (aluminio) => {
  const name = String(aluminio || '').toLowerCase();
  if (name.includes('preto')) return '#1e293b';
  if (name.includes('branco')) return '#f8fafc';
  if (name.includes('bronze')) return '#451a03';
  if (name.includes('cinza') || name.includes('grafite')) return '#475569';
  if (name.includes('galvanizado') || name.includes('zincado')) return '#94a3b8';
  return '#64748b'; // Cinza escuro padrão
};

export const getCoverFill = (corCover) => {
  const name = String(corCover || '').toLowerCase();
  if (name.includes('fumê') || name.includes('fume')) return 'rgba(30, 41, 59, 0.7)';
  if (name.includes('azul')) return 'rgba(14, 165, 233, 0.6)';
  if (name.includes('verde')) return 'rgba(16, 185, 129, 0.6)';
  if (name.includes('bronze')) return 'rgba(120, 53, 4, 0.6)';
  if (name.includes('leitoso') || name.includes('branco')) return 'rgba(241, 245, 249, 0.85)';
  return 'rgba(224, 242, 254, 0.4)'; // Incolor / Cristal
};

const ProjectSvgViewer = ({
  modeloType = 'portao', // portao, telhado, grade, movel
  modeloNome = '',
  w = 3000,
  h = 2000,
  wVao = 3000,
  hVao = 2000,
  lado = 'esquerda',
  sentido = 'dentro',
  puxador = 'padrao',
  aluminio = 'grafite', // cor da estrutura
  corGlass = 'Incolor', // cor da telha/chapa
  qtdeFolhas = 1, // quantidade de abas/folhas
  isOpen = false,
  width = 230,
  height = 180
}) => {
  const metalColor = getMetalColor(aluminio);
  const coverColor = getCoverFill(corGlass);

  const viewBox = "0 0 200 160";

  // Desenhar com base no tipo de modelo
  const renderContent = () => {
    switch (modeloType) {
      case 'telhado': {
        const numAguas = Number(qtdeFolhas || 1);
        const wallX = 30;
        const columnX = 170;
        const groundY = 130;
        const wallTopY = 40;
        const beamEndY = 90;
        
        // Solo
        const renderSolo = () => (
          <line x1="10" y1={groundY} x2="190" y2={groundY} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
        );

        if (numAguas === 1) {
          // 1 Água (Caimento Único)
          return (
            <g>
              {/* Parede de apoio (esquerda) */}
              <rect x="15" y="20" width="15" height="110" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
              <line x1="15" y1="20" x2="30" y2="20" stroke="#64748b" strokeWidth="1" />
              <line x1="30" y1="20" x2="30" y2="130" stroke="#64748b" strokeWidth="1" />
              
              {renderSolo()}

              {/* Coluna metálica de sustentação na direita */}
              <rect x={columnX - 4} y={beamEndY} width="8" height={groundY - beamEndY} fill={metalColor} stroke="#0f172a" strokeWidth="0.8" />
              <rect x={columnX - 8} y={groundY - 3} width="16" height="3" fill="#475569" />

              {/* Placas/Cobertura inclinada */}
              <polygon 
                points={`${wallX},${wallTopY - 4} ${columnX + 10},${beamEndY - 4} ${columnX + 10},${beamEndY} ${wallX},${wallTopY}`} 
                fill={coverColor} 
                stroke="#0284c7" 
                strokeWidth="0.5" 
              />

              {/* Viga estrutural inclinada principal */}
              <line x1={wallX} y1={wallTopY + 2} x2={columnX + 8} y2={beamEndY + 2} stroke={metalColor} strokeWidth="4" strokeLinecap="round" />

              {/* Perfis U de fixação */}
              <rect x={wallX - 3} y={wallTopY - 2} width="3" height="8" fill="#334155" />
              
              {/* Terças transversais */}
              <rect x="65" y="52" width="6" height="6" rx="1" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />
              <rect x="110" y="67" width="6" height="6" rx="1" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />
              <rect x="150" y="81" width="6" height="6" rx="1" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />

              {/* Indicação de Caimento (Seta) */}
              <path d="M90,30 L120,40 M120,40 L112,35 M120,40 L115,45" fill="none" stroke="#ea580c" strokeWidth="1" strokeLinecap="round" />
              <text x="100" y="25" fontSize="6" fill="#ea580c" fontWeight="bold" textAnchor="middle">1 ÁGUA</text>
            </g>
          );
        } 
        else if (numAguas === 2) {
          // 2 Águas (Gable Roof / Caimento Duplo)
          const centerX = (wallX + columnX) / 2; // cumeira no centro
          return (
            <g>
              {renderSolo()}

              {/* Colunas de sustentação nas duas extremidades */}
              <rect x={wallX - 4} y={beamEndY} width="8" height={groundY - beamEndY} fill={metalColor} stroke="#0f172a" strokeWidth="0.8" />
              <rect x={wallX - 8} y={groundY - 3} width="16" height="3" fill="#475569" />

              <rect x={columnX - 4} y={beamEndY} width="8" height={groundY - beamEndY} fill={metalColor} stroke="#0f172a" strokeWidth="0.8" />
              <rect x={columnX - 8} y={groundY - 3} width="16" height="3" fill="#475569" />

              {/* Coluna central opcional ou suporte de cumeira */}
              <line x1={centerX} y1={wallTopY} x2={centerX} y2={beamEndY + 20} stroke={metalColor} strokeWidth="1.5" strokeDasharray="2,2" />

              {/* Placas/Cobertura inclinada (Esquerda e Direita) */}
              <polygon 
                points={`${wallX - 10},${beamEndY - 4} ${centerX},${wallTopY - 4} ${centerX},${wallTopY} ${wallX - 10},${beamEndY}`} 
                fill={coverColor} 
                stroke="#0284c7" 
                strokeWidth="0.5" 
              />
              <polygon 
                points={`${centerX},${wallTopY - 4} ${columnX + 10},${beamEndY - 4} ${columnX + 10},${beamEndY} ${centerX},${wallTopY}`} 
                fill={coverColor} 
                stroke="#0284c7" 
                strokeWidth="0.5" 
              />

              {/* Vigas principais (caibros) de ambos os lados */}
              <line x1={wallX - 8} y1={beamEndY + 2} x2={centerX} y2={wallTopY + 2} stroke={metalColor} strokeWidth="3.5" strokeLinecap="round" />
              <line x1={centerX} y1={wallTopY + 2} x2={columnX + 8} y2={beamEndY + 2} stroke={metalColor} strokeWidth="3.5" strokeLinecap="round" />

              {/* Junção / Perfil Cumeira Central */}
              <circle cx={centerX} cy={wallTopY + 2} r="3.5" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />

              {/* Terças transversais nas duas vertentes */}
              <rect x="60" y="67" width="5" height="5" rx="1" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />
              <rect x="135" y="67" width="5" height="5" rx="1" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />

              <text x={centerX} y={wallTopY - 10} fontSize="6" fill="#ea580c" fontWeight="bold" textAnchor="middle">2 ÁGUAS</text>
              <path d="M75,32 L60,40 M60,40 L68,39 M60,40 L63,33" fill="none" stroke="#ea580c" strokeWidth="0.8" strokeLinecap="round" />
              <path d="M125,32 L140,40 M140,40 L132,39 M140,40 L137,33" fill="none" stroke="#ea580c" strokeWidth="0.8" strokeLinecap="round" />
            </g>
          );
        } 
        else {
          // 3 ou 4 Águas (Hip Roof / Espigão)
          // Vista em perspectiva/plana projetada de cobertura de 4 quedas
          const centerX = (wallX + columnX) / 2;
          const leftPeakX = wallX + 35;
          const rightPeakX = columnX - 35;
          
          return (
            <g>
              {renderSolo()}

              {/* 4 Pilares nas quinas do telhado */}
              <rect x={wallX - 2} y={beamEndY} width="4" height={groundY - beamEndY} fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />
              <rect x={columnX - 2} y={beamEndY} width="4" height={groundY - beamEndY} fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />
              
              {/* Vigas de base (Perímetro horizontal) */}
              <line x1={wallX} y1={beamEndY} x2={columnX} y2={beamEndY} stroke={metalColor} strokeWidth="3" />

              {/* Cumeira Central Horizontal */}
              <line x1={leftPeakX} y1={wallTopY} x2={rightPeakX} y2={wallTopY} stroke={metalColor} strokeWidth="3.5" />

              {/* Espigões inclinados das 4 águas (ligando os cantos à cumeira) */}
              <line x1={wallX} y1={beamEndY} x2={leftPeakX} y2={wallTopY} stroke={metalColor} strokeWidth="3" />
              <line x1={columnX} y1={beamEndY} x2={rightPeakX} y2={wallTopY} stroke={metalColor} strokeWidth="3" />
              
              {/* Outros espigões em projeção traseira (tracejados) */}
              <line x1={wallX + 15} y1={beamEndY - 10} x2={leftPeakX} y2={wallTopY} stroke={metalColor} strokeWidth="1.5" strokeDasharray="2,2" opacity="0.7" />
              <line x1={columnX - 15} y1={beamEndY - 10} x2={rightPeakX} y2={wallTopY} stroke={metalColor} strokeWidth="1.5" strokeDasharray="2,2" opacity="0.7" />

              {/* Chapas translúcidas de cobertura (Polígonos preenchendo as águas frontal e laterais) */}
              {/* Água Frontal (Trapezoidal) */}
              <polygon 
                points={`${wallX},${beamEndY} ${leftPeakX},${wallTopY} ${rightPeakX},${wallTopY} ${columnX},${beamEndY}`} 
                fill={coverColor} 
                stroke="#0284c7" 
                strokeWidth="0.5" 
                opacity="0.8"
              />
              
              {/* Água Lateral Esquerda (Triangular) */}
              <polygon 
                points={`${wallX - 5},${beamEndY} ${wallX},${beamEndY} ${leftPeakX},${wallTopY}`} 
                fill={coverColor} 
                stroke="#0284c7" 
                strokeWidth="0.5" 
                opacity="0.6"
              />

              {/* Água Lateral Direita (Triangular) */}
              <polygon 
                points={`${columnX},${beamEndY} ${columnX + 5},${beamEndY} ${rightPeakX},${wallTopY}`} 
                fill={coverColor} 
                stroke="#0284c7" 
                strokeWidth="0.5" 
                opacity="0.6"
              />

              <text x={centerX} y={wallTopY - 10} fontSize="6" fill="#ea580c" fontWeight="bold" textAnchor="middle">
                {numAguas} ÁGUAS
              </text>
            </g>
          );
        }
      }

      case 'grade': {
        // Grade com barras verticais e pontas de lança estruturais
        const frameX = 30;
        const frameY = 30;
        const frameW = 140;
        const frameH = 95;
        const barSpacing = 12; 
        const barCount = Math.floor(frameW / barSpacing);

        const bars = [];
        for (let i = 1; i < barCount; i++) {
          const x = frameX + (i * barSpacing);
          bars.push(x);
        }

        return (
          <g>
            {/* Fundo de visualização da grade */}
            <rect x={frameX} y={frameY} width={frameW} height={frameH} fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />

            {/* Barras Verticais */}
            {bars.map((x, idx) => (
              <g key={idx}>
                {/* A barra em si */}
                <line x1={x} y1={frameY - 2} x2={x} y2={frameY + frameH + 2} stroke={metalColor} strokeWidth="1.8" />
                {/* Ponta decorativa (lança) no topo */}
                <polygon points={`${x-3},${frameY-2} ${x},${frameY-9} ${x+3},${frameY-2}`} fill={metalColor} />
              </g>
            ))}

            {/* Travessas Horizontais (Barras de fixação do Marco) */}
            <rect x={frameX} y={frameY + 12} width={frameW} height="6" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />
            <rect x={frameX} y={frameY + frameH - 18} width={frameW} height="6" fill={metalColor} stroke="#0f172a" strokeWidth="0.5" />

            {/* Colunas principais de apoio nas laterais */}
            <rect x={frameX - 6} y={frameY - 8} width="6" height={frameH + 16} fill="#475569" stroke="#1e293b" strokeWidth="0.8" />
            <rect x={frameX + frameW} y={frameY - 8} width="6" height={frameH + 16} fill="#475569" stroke="#1e293b" strokeWidth="0.8" />
          </g>
        );
      }

      case 'movel': {
        // Base estrutural de metal de uma mesa com tampo transparente/madeira
        return (
          <g>
            {/* Tampo da Mesa */}
            <polygon points="40,50 160,50 140,70 20,70" fill="rgba(120, 53, 4, 0.15)" stroke="#78350f" strokeWidth="1.5" />
            
            {/* Quadro de aço superior sob o tampo */}
            <polygon points="41,51 159,51 139,69 21,69" fill="none" stroke={metalColor} strokeWidth="2.5" />

            {/* Pernas da mesa (Metal Metalon) */}
            {/* Perna Traseira Esquerda */}
            <line x1="41" y1="51" x2="41" y2="120" stroke={metalColor} strokeWidth="3" strokeLinecap="square" />
            {/* Perna Traseira Direita */}
            <line x1="159" y1="51" x2="159" y2="120" stroke={metalColor} strokeWidth="3" strokeLinecap="square" />
            {/* Perna Dianteira Esquerda */}
            <line x1="21" y1="69" x2="21" y2="135" stroke={metalColor} strokeWidth="3.5" strokeLinecap="square" />
            {/* Perna Dianteira Direita */}
            <line x1="139" y1="69" x2="139" y2="135" stroke={metalColor} strokeWidth="3.5" strokeLinecap="square" />

            {/* Travessas de reforço inferior (formato H) */}
            <line x1="21" y1="120" x2="139" y2="120" stroke={metalColor} strokeWidth="2.5" />
            <line x1="41" y1="108" x2="159" y2="108" stroke={metalColor} strokeWidth="2" strokeDasharray="1,1" opacity="0.6" />
            <line x1="21" y1="120" x2="41" y2="108" stroke={metalColor} strokeWidth="2" />
            <line x1="139" y1="120" x2="159" y2="108" stroke={metalColor} strokeWidth="2" />
          </g>
        );
      }

      case 'portao':
      default: {
        // Portão com marco metálico reforçado
        const frameX = 35;
        const frameY = 30;
        const frameW = 130;
        const frameH = 95;

        // Se for aberto ou fechado (chapa/lambril vs grades)
        const isClosed = String(modeloNome || '').toLowerCase().includes('lambril') || String(modeloNome || '').toLowerCase().includes('fechado') || String(modeloNome || '').toLowerCase().includes('chapa');

        const numLeaves = Number(qtdeFolhas || 1);
        const leafW = frameW / numLeaves;

        const leaves = [];
        for (let i = 0; i < numLeaves; i++) {
          leaves.push(frameX + i * leafW);
        }

        return (
          <g>
            {/* Fundo do portão */}
            <rect x={frameX} y={frameY} width={frameW} height={frameH} fill={isClosed ? '#f1f5f9' : '#f8fafc'} stroke="#cbd5e1" strokeWidth="1" />

            {/* Desenhar cada folha individualmente */}
            {leaves.map((lX, idx) => (
              <g key={idx}>
                {/* Quadro da folha (Bordas) */}
                <rect x={lX} y={frameY} width={leafW} height={frameH} fill="none" stroke={metalColor} strokeWidth="2.5" />
                
                {isClosed ? (
                  // Lambril horizontal dentro de cada folha
                  <g>
                    <line x1={lX} y1={frameY + 15} x2={lX + leafW} y2={frameY + 15} stroke="#cbd5e1" strokeWidth="0.8" />
                    <line x1={lX} y1={frameY + 30} x2={lX + leafW} y2={frameY + 30} stroke="#cbd5e1" strokeWidth="0.8" />
                    <line x1={lX} y1={frameY + 45} x2={lX + leafW} y2={frameY + 45} stroke="#cbd5e1" strokeWidth="0.8" />
                    <line x1={lX} y1={frameY + 60} x2={lX + leafW} y2={frameY + 60} stroke="#cbd5e1" strokeWidth="0.8" />
                    <line x1={lX} y1={frameY + 75} x2={lX + leafW} y2={frameY + 75} stroke="#cbd5e1" strokeWidth="0.8" />
                    <line x1={lX} y1={frameY + 90} x2={lX + leafW} y2={frameY + 90} stroke="#cbd5e1" strokeWidth="0.8" />
                  </g>
                ) : (
                  // Barras verticais internas de cada folha
                  <g>
                    <line x1={lX + (leafW * 0.25)} y1={frameY} x2={lX + (leafW * 0.25)} y2={frameY + frameH} stroke={metalColor} strokeWidth="1" />
                    <line x1={lX + (leafW * 0.5)} y1={frameY} x2={lX + (leafW * 0.5)} y2={frameY + frameH} stroke={metalColor} strokeWidth="1" />
                    <line x1={lX + (leafW * 0.75)} y1={frameY} x2={lX + (leafW * 0.75)} y2={frameY + frameH} stroke={metalColor} strokeWidth="1" />
                  </g>
                )}

                {/* Travessa horizontal central de cada folha */}
                <line x1={lX} y1={frameY + (frameH / 2)} x2={lX + leafW} y2={frameY + (frameH / 2)} stroke={metalColor} strokeWidth="1.5" />
              </g>
            ))}

            {/* Marco Fixo Externo de Aço */}
            <rect x={frameX} y={frameY} width={frameW} height={frameH} fill="none" stroke={metalColor} strokeWidth="4.5" />

            {/* Detalhe do Trilho (se deslizante/deslizar) */}
            <line x1="20" y1={frameY + frameH + 3.5} x2="180" y2={frameY + frameH + 3.5} stroke="#475569" strokeWidth="1.8" />
            <circle cx={frameX + 20} cy={frameY + frameH + 1} r="3" fill="#64748b" stroke="#334155" strokeWidth="0.5" />
            <circle cx={frameX + frameW - 20} cy={frameY + frameH + 1} r="3" fill="#64748b" stroke="#334155" strokeWidth="0.5" />

            {/* Puxador */}
            {puxador !== 'sem' && (
              <rect x={lado === 'esquerda' ? frameX + 8 : frameX + frameW - 12} y={frameY + (frameH / 2) - 10} width="4" height="20" rx="1" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1" />
            )}
          </g>
        );
      }
    }
  };

  return (
    <svg 
      viewBox={viewBox} 
      width={width} 
      height={height} 
      className="bg-white rounded-lg border border-slate-200/60 print:border-none shadow-inner"
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {/* Grid Blueprint Background */}
      <defs>
        <pattern id="grid-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(226, 232, 240, 0.6)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />

      {/* Desenhos do Projeto */}
      {renderContent()}

      {/* Cotações Dimensionais */}
      {/* Cota Horizontal */}
      <g>
        <line x1="30" y1="145" x2="170" y2="145" stroke="#64748b" strokeWidth="0.8" />
        <path d="M30,145 L34,142 M30,145 L34,148 M170,145 L166,142 M170,145 L166,148" stroke="#64748b" strokeWidth="0.8" />
        <rect x="85" y="140" width="30" height="9" fill="#ffffff" rx="1.5" />
        <text x="100" y="147" fontSize="6.5" fill="#475569" fontWeight="bold" textAnchor="middle">{wVao} mm</text>
      </g>

      {/* Cota Vertical */}
      <g>
        <line x1="12" y1="30" x2="12" y2="125" stroke="#64748b" strokeWidth="0.8" />
        <path d="M12,30 L9,34 M12,30 L15,34 M12,125 L9,121 M12,125 L15,121" stroke="#64748b" strokeWidth="0.8" />
        <rect x="3" y="70" width="18" height="12" fill="#ffffff" rx="1.5" />
        <text x="12" y="78" fontSize="6.5" fill="#475569" fontWeight="bold" textAnchor="middle" transform="rotate(-90 12 78)">{hVao} mm</text>
      </g>
    </svg>
  );
};

export default ProjectSvgViewer;
