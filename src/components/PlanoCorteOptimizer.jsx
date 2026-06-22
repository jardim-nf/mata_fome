// src/components/PlanoCorteOptimizer.jsx
import React, { useState, useEffect } from 'react';
import { IoAddOutline, IoTrashOutline, IoRefreshOutline, IoPlayOutline, IoDownloadOutline } from 'react-icons/io5';
import { toast } from 'react-toastify';

export default function PlanoCorteOptimizer({
  defaultChapaW = 3210, // vidro padrao (mm)
  defaultChapaH = 2200, // vidro padrao (mm)
  initialPecas = [],
  tipoInsumo = 'vidro' // vidro ou marmore
}) {
  const [chapaW, setChapaW] = useState(defaultChapaW);
  const [chapaH, setChapaH] = useState(defaultChapaH);
  const [espessuraCorte, setEspessuraCorte] = useState(3); // folga da serra/cortador em mm
  const [permitirRotacao, setPermitirRotacao] = useState(true);

  const [pecas, setPecas] = useState(initialPecas.length > 0 ? initialPecas : [
    { id: 1, largura: 1200, altura: 800, qtd: 2, label: 'Box Fixo' },
    { id: 2, largura: 1200, altura: 750, qtd: 2, label: 'Box Porta' }
  ]);

  // Form para nova peca
  const [novaLargura, setNovaLargura] = useState('');
  const [novaAltura, setNovaAltura] = useState('');
  const [novaQtd, setNovaQtd] = useState(1);
  const [novoLabel, setNovoLabel] = useState('');

  // Resultados da Otimização
  const [chapasOtimizadas, setChapasOtimizadas] = useState([]);
  const [stats, setStats] = useState({
    aproveitamento: 0,
    areaTotalPecas: 0,
    areaTotalChapas: 0,
    totalChapas: 0,
    sobrasM2: 0
  });

  const [draggedPeca, setDraggedPeca] = useState(null); // { chapaId, pecaIdx, offsetX, offsetY, originalX, originalY }

  const getSVGCoords = (e, svgEl, chW, chH) => {
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0]?.clientY) || 0;
    
    const x = (clientX - rect.left) * (chW / rect.width);
    const y = (clientY - rect.top) * (chH / rect.height);
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handlePecaMouseDown = (e, chapaId, pecaIdx, svgEl) => {
    e.stopPropagation();
    e.preventDefault();
    const chapa = chapasOtimizadas.find(c => c.id === chapaId);
    if (!chapa) return;
    const peca = chapa.pecasEncaixadas[pecaIdx];
    const mouseCoords = getSVGCoords(e, svgEl, chapa.w, chapa.h);
    
    setDraggedPeca({
      chapaId,
      pecaIdx,
      offsetX: mouseCoords.x - peca.x,
      offsetY: mouseCoords.y - peca.y,
      originalX: peca.x,
      originalY: peca.y
    });
  };

  const handleSVGMouseMove = (e, chapaId, svgEl) => {
    if (!draggedPeca || draggedPeca.chapaId !== chapaId) return;
    const chapa = chapasOtimizadas.find(c => c.id === chapaId);
    if (!chapa) return;

    const mouseCoords = getSVGCoords(e, svgEl, chapa.w, chapa.h);
    let newX = mouseCoords.x - draggedPeca.offsetX;
    let newY = mouseCoords.y - draggedPeca.offsetY;

    const peca = chapa.pecasEncaixadas[draggedPeca.pecaIdx];
    newX = Math.max(0, Math.min(chapa.w - peca.w, newX));
    newY = Math.max(0, Math.min(chapa.h - peca.h, newY));

    const updatedChapas = chapasOtimizadas.map(ch => {
      if (ch.id === chapaId) {
        const updatedPecas = ch.pecasEncaixadas.map((p, idx) => {
          if (idx === draggedPeca.pecaIdx) {
            return { ...p, x: newX, y: newY };
          }
          return p;
        });
        return { ...ch, pecasEncaixadas: updatedPecas };
      }
      return ch;
    });

    setChapasOtimizadas(updatedChapas);
  };

  const handleSVGMouseUp = () => {
    if (!draggedPeca) return;
    setDraggedPeca(null);
  };

  const handleRotatePeca = (e, chapaId, pecaIdx) => {
    e.stopPropagation();
    e.preventDefault();
    const updatedChapas = chapasOtimizadas.map(ch => {
      if (ch.id === chapaId) {
        const updatedPecas = ch.pecasEncaixadas.map((p, idx) => {
          if (idx === pecaIdx) {
            const nextW = p.h;
            const nextH = p.w;
            
            const nextX = Math.max(0, Math.min(ch.w - nextW, p.x));
            const nextY = Math.max(0, Math.min(ch.h - nextH, p.y));

            return { 
              ...p, 
              w: nextW, 
              h: nextH,
              x: nextX,
              y: nextY,
              rotacionada: !p.rotacionada 
            };
          }
          return p;
        });
        return { ...ch, pecasEncaixadas: updatedPecas };
      }
      return ch;
    });

    setChapasOtimizadas(updatedChapas);
    toast.info("Peça rotacionada 90°!");
  };

  const checkOverlap = (p1, p2) => {
    const margin = 2; // small tolerance margin
    return (
      p1.x + margin < p2.x + p2.w &&
      p1.x + p1.w > p2.x + margin &&
      p1.y + margin < p2.y + p2.h &&
      p1.y + p1.h > p2.y + margin
    );
  };

  // Pre-definicoes de Chapas
  const templatesChapas = {
    vidro: [
      { nome: 'Chapa Padrão (3.21m x 2.20m)', w: 3210, h: 2200 },
      { nome: 'Chapa Média (2.40m x 1.80m)', w: 2400, h: 1800 },
      { nome: 'Chapa Jumbo (6.00m x 3.21m)', w: 6000, h: 3210 }
    ],
    marmore: [
      { nome: 'Chapa Padrão (2.80m x 1.60m)', w: 2800, h: 1600 },
      { nome: 'Chapa Extra (3.00m x 1.80m)', w: 3000, h: 1800 },
      { nome: 'Retalho Médio (1.50m x 1.00m)', w: 1500, h: 1000 }
    ]
  };

  // Pre-carregar pecas iniciais
  useEffect(() => {
    if (initialPecas && initialPecas.length > 0) {
      setPecas(initialPecas);
    }
  }, [initialPecas]);

  // Adicionar Peca
  const handleAddPeca = () => {
    const wVal = Number(novaLargura);
    const hVal = Number(novaAltura);
    const qVal = Number(novaQtd);

    if (!wVal || !hVal || !qVal) {
      return toast.warn('Preencha as dimensões e quantidade da peça!');
    }

    if (wVal > chapaW || hVal > chapaH) {
      if (!permitirRotacao || (hVal > chapaW || wVal > chapaH)) {
        return toast.error('A peça é maior do que a chapa padrão escolhida!');
      }
    }

    const nova = {
      id: Date.now(),
      largura: wVal,
      altura: hVal,
      qtd: qVal,
      label: novoLabel || `Peça ${pecas.length + 1}`
    };

    setPecas([...pecas, nova]);
    setNovaLargura('');
    setNovaAltura('');
    setNovaQtd(1);
    setNovoLabel('');
    toast.success('Peça adicionada à lista!');
  };

  // Remover Peca
  const handleRemovePeca = (id) => {
    setPecas(pecas.filter(p => p.id !== id));
  };

  // Algoritmo de Otimização (Guillotine Cut 2D Bin Packing Heuristic)
  const executarOtimizacao = (isManual = false) => {
    if (pecas.length === 0) {
      return toast.warn('Adicione peças na lista para otimizar!');
    }

    // Expandir lista de pecas individuais baseada na quantidade
    let pecasExpandidas = [];
    pecas.forEach(p => {
      for (let i = 0; i < p.qtd; i++) {
        pecasExpandidas.push({
          id: `${p.id}_${i}`,
          w: p.largura,
          h: p.altura,
          label: p.label
        });
      }
    });

    // Ordenar pecas por área decrescente (Heurística clássica de melhor aproveitamento)
    pecasExpandidas.sort((a, b) => (b.w * b.h) - (a.w * a.h));

    const kerf = Number(espessuraCorte) || 0; // Folga da lâmina
    let chapas = [];

    // Tenta encaixar cada peça
    pecasExpandidas.forEach(peca => {
      let encaixou = false;

      // 1. Procurar em chapas já existentes
      for (let c = 0; c < chapas.length; c++) {
        const chapa = chapas[c];
        for (let f = 0; f < chapa.freeRects.length; f++) {
          const fr = chapa.freeRects[f];
          
          let fitsNormal = peca.w <= fr.w && peca.h <= fr.h;
          let fitsRotated = permitirRotacao && peca.h <= fr.w && peca.w <= fr.h;

          if (fitsNormal || fitsRotated) {
            // Decidir se rotaciona
            const useRotated = !fitsNormal || (fitsRotated && (fr.w - peca.h) < (fr.w - peca.w));
            const pW = useRotated ? peca.h : peca.w;
            const pH = useRotated ? peca.w : peca.h;

            // Alocar peça
            chapa.pecasEncaixadas.push({
              x: fr.x,
              y: fr.y,
              w: pW,
              h: pH,
              label: peca.label,
              rotacionada: useRotated
            });

            // Remover o retângulo livre usado
            chapa.freeRects.splice(f, 1);

            // Criar dois novos retângulos livres (Corte Guilhotina)
            // Se corte horizontal:
            const sobW1 = fr.w - pW - kerf;
            const sobH1 = pH;
            const sobW2 = fr.w;
            const sobH2 = fr.h - pH - kerf;

            if (sobW1 > 0 && sobH1 > 0) {
              chapa.freeRects.push({ x: fr.x + pW + kerf, y: fr.y, w: sobW1, h: sobH1 });
            }
            if (sobW2 > 0 && sobH2 > 0) {
              chapa.freeRects.push({ x: fr.x, y: fr.y + pH + kerf, w: sobW2, h: sobH2 });
            }

            encaixou = true;
            break;
          }
        }
        if (encaixou) break;
      }

      // 2. Se não couber em nenhuma chapa, abre uma chapa nova
      if (!encaixou) {
        let fitsNormal = peca.w <= chapaW && peca.h <= chapaH;
        let fitsRotated = permitirRotacao && peca.h <= chapaW && peca.w <= chapaH;

        if (!fitsNormal && !fitsRotated) {
          toast.error(`A peça "${peca.label}" (${peca.w}x${peca.h}mm) excede os limites da chapa!`);
          return;
        }

        const useRotated = !fitsNormal || (fitsRotated && (chapaW - peca.h) < (chapaW - peca.w));
        const pW = useRotated ? peca.h : peca.w;
        const pH = useRotated ? peca.w : peca.h;

        let novaChapa = {
          id: chapas.length + 1,
          w: chapaW,
          h: chapaH,
          pecasEncaixadas: [{
            x: 0,
            y: 0,
            w: pW,
            h: pH,
            label: peca.label,
            rotacionada: useRotated
          }],
          freeRects: []
        };

        // Criar retângulos livres restantes
        const sobW1 = chapaW - pW - kerf;
        const sobH1 = pH;
        const sobW2 = chapaW;
        const sobH2 = chapaH - pH - kerf;

        if (sobW1 > 0 && sobH1 > 0) {
          novaChapa.freeRects.push({ x: pW + kerf, y: 0, w: sobW1, h: sobH1 });
        }
        if (sobW2 > 0 && sobH2 > 0) {
          novaChapa.freeRects.push({ x: 0, y: pH + kerf, w: sobW2, h: sobH2 });
        }

        chapas.push(novaChapa);
      }
    });

    // Calcular Estatísticas
    let areaPecasTotal = 0;
    chapas.forEach(ch => {
      ch.pecasEncaixadas.forEach(p => {
        areaPecasTotal += (p.w * p.h);
      });
    });

    const areaTotalChapas = chapas.length * (chapaW * chapaH);
    const areaPecasM2 = areaPecasTotal / 1000000;
    const areaChapasM2 = areaTotalChapas / 1000000;
    const aproveitamento = areaChapasM2 > 0 ? (areaPecasM2 / areaChapasM2) * 100 : 0;
    const sobrasM2 = areaChapasM2 - areaPecasM2;

    setChapasOtimizadas(chapas);
    setStats({
      aproveitamento,
      areaTotalPecas: areaPecasM2,
      areaTotalChapas: areaChapasM2,
      totalChapas: chapas.length,
      sobrasM2
    });

    if (isManual) {
      toast.success(`Otimização finalizada! ${chapas.length} chapa(s) utilizada(s).`);
    }
  };

  // Rodar otimização ao carregar ou mudar pecas/chapas
  useEffect(() => {
    if (pecas.length > 0) {
      executarOtimizacao(false);
    }
  }, [pecas, chapaW, chapaH, permitirRotacao, espessuraCorte]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
      
      {/* Coluna Esquerda: Cadastro de Pecas & Chapas */}
      <div className="lg:col-span-5 xl:col-span-4 space-y-4 sm:space-y-6">
        
        {/* Configurações da Chapa */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 sm:space-y-4">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            ⚙️ Chapa & Parâmetros
          </h4>

          {/* Modelos de Chapas Rápidos */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase">Templates de Chapas</span>
            <div className="grid grid-cols-1 gap-1">
              {(templatesChapas[tipoInsumo] || templatesChapas.vidro).map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setChapaW(t.w);
                    setChapaH(t.h);
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-left text-xs font-bold transition-all ${
                    chapaW === t.w && chapaH === t.h
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {t.nome} <span className="text-[10px] block opacity-75">{t.w}x{t.h} mm</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase">Largura Chapa (mm)</span>
              <input
                type="number"
                value={chapaW}
                onChange={e => setChapaW(Number(e.target.value))}
                className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase">Altura Chapa (mm)</span>
              <input
                type="number"
                value={chapaH}
                onChange={e => setChapaH(Number(e.target.value))}
                className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 items-center pt-2">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase">Espessura Corte (mm)</span>
              <input
                type="number"
                value={espessuraCorte}
                onChange={e => setEspessuraCorte(Number(e.target.value))}
                className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg"
                title="Espessura da lâmina de corte"
              />
            </div>
            <label className="flex items-center gap-2 mt-2 sm:mt-4 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={permitirRotacao}
                onChange={e => setPermitirRotacao(e.target.checked)}
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4"
              />
              <span className="text-[10px] text-slate-700 font-extrabold uppercase whitespace-nowrap">Permitir Rotação</span>
            </label>
          </div>
        </div>

        {/* Cadastro de Pecas */}
        <div className="bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 sm:space-y-4">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex justify-between items-center">
            <span>📐 Lista de Peças</span>
            <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full">
              {pecas.length} Modelos
            </span>
          </h4>

          {/* Form */}
          <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-200/60 space-y-2 sm:space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Largura (mm)</span>
                <input
                  type="number"
                  placeholder="1200"
                  value={novaLargura}
                  onChange={e => setNovaLargura(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Altura (mm)</span>
                <input
                  type="number"
                  placeholder="800"
                  value={novaAltura}
                  onChange={e => setNovaAltura(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Etiqueta/Identificação</span>
                <input
                  type="text"
                  placeholder="Ex: Porta Box"
                  value={novoLabel}
                  onChange={e => setNovoLabel(e.target.value)}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Qtd</span>
                <input
                  type="number"
                  min="1"
                  value={novaQtd}
                  onChange={e => setNovaQtd(Number(e.target.value))}
                  className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleAddPeca}
              className="w-full bg-slate-900 hover:bg-black text-white py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1 transition-all"
            >
              <IoAddOutline size={16} /> Adicionar Peça
            </button>
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto scrollbar-none pr-1">
            {pecas.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 transition-all">
                <div>
                  <p className="text-xs font-bold text-slate-800">{p.label}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {p.largura} x {p.altura} mm <span className="font-sans font-bold text-slate-800">x{p.qtd}</span>
                  </p>
                </div>
                <button
                  onClick={() => handleRemovePeca(p.id)}
                  className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-100 transition-all"
                  title="Excluir peça"
                >
                  <IoTrashOutline size={14} />
                </button>
              </div>
            ))}
            {pecas.length === 0 && (
              <p className="text-center py-6 text-xs font-medium text-slate-400">Nenhuma peça na lista de corte.</p>
            )}
          </div>
        </div>
      </div>

      {/* Coluna Direita: Resultados & Layout Map */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-4 sm:space-y-6">
        
        {/* KPI stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 bg-white p-3 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Aproveitamento</span>
            <h5 className="text-2xl font-black text-slate-900">{stats.aproveitamento.toFixed(1)}%</h5>
            <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${stats.aproveitamento > 80 ? 'bg-emerald-500' : stats.aproveitamento > 60 ? 'bg-amber-500' : 'bg-red-500'}`} 
                style={{ width: `${stats.aproveitamento}%` }} 
              />
            </div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Chapas Utilizadas</span>
            <h5 className="text-2xl font-black text-slate-900">{stats.totalChapas}</h5>
            <span className="text-[9px] text-slate-500 font-bold">Total: {(stats.areaTotalChapas).toFixed(2)}m²</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Área das Peças</span>
            <h5 className="text-2xl font-black text-slate-800">{(stats.areaTotalPecas).toFixed(2)} m²</h5>
            <span className="text-[9px] text-slate-500 font-bold">Líquido de corte</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Desperdício / Sobras</span>
            <h5 className="text-2xl font-black text-slate-600">{(stats.sobrasM2).toFixed(2)} m²</h5>
            <span className="text-[9px] text-slate-500 font-bold">{(100 - stats.aproveitamento).toFixed(1)}% de perda</span>
          </div>
        </div>

        {/* Visual Map Layouts */}
        <div className="bg-white p-3 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              🗺️ Diagramas de Corte de Fábrica
            </h4>
            <button
              onClick={() => executarOtimizacao(true)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1 transition-all"
            >
              <IoRefreshOutline size={14} /> Re-Calcular
            </button>
          </div>

          <div className="space-y-6 sm:space-y-8">
            {chapasOtimizadas.map(ch => {
              // Scale to fit viewport responsively
              const maxDisplayWidth = 700;
              const ratio = ch.w / ch.h;
              const displayW = maxDisplayWidth;
              const displayH = maxDisplayWidth / ratio;

              return (
                <div key={ch.id} className="space-y-2 sm:space-y-3 bg-slate-50 p-2 sm:p-4 rounded-xl border border-slate-200/80">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[10px] sm:text-xs text-slate-600 font-extrabold uppercase">
                    <span>Chapa #{ch.id} ({ch.w} x {ch.h} mm)</span>
                    <span className="text-slate-800">
                      Encaixado: {ch.pecasEncaixadas.length} peças
                    </span>
                  </div>

                  {/* SVG Drawing of Plate */}
                  <div className="w-full flex justify-center bg-white p-1.5 sm:p-2.5 rounded-lg border border-slate-200 shadow-sm overflow-x-auto select-none">
                    <svg 
                      width={displayW} 
                      height={displayH} 
                      viewBox={`0 0 ${ch.w} ${ch.h}`} 
                      className={`max-w-full h-auto bg-slate-100 rounded-lg border border-slate-150 transition-colors ${
                        draggedPeca && draggedPeca.chapaId === ch.id ? 'cursor-grabbing bg-slate-200/50' : 'cursor-default'
                      }`}
                      onMouseMove={(e) => handleSVGMouseMove(e, ch.id, e.currentTarget)}
                      onMouseUp={handleSVGMouseUp}
                      onMouseLeave={handleSVGMouseUp}
                      onTouchMove={(e) => handleSVGMouseMove(e, ch.id, e.currentTarget)}
                      onTouchEnd={handleSVGMouseUp}
                      style={{ touchAction: 'none' }}
                    >
                      <defs>
                        {/* Shaded waste pattern */}
                        <pattern id="scrap-pattern" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                          <line x1="0" y1="0" x2="0" y2="10" stroke="#fecaca" strokeWidth="2.5" />
                        </pattern>
                        {/* Shaded reusable pattern */}
                        <pattern id="reusable-pattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(135)">
                          <line x1="0" y1="0" x2="0" y2="12" stroke="#cffafe" strokeWidth="1.5" />
                        </pattern>
                      </defs>

                      {/* Raw Plate Background (represented as waste initially) */}
                      <rect width={ch.w} height={ch.h} fill="url(#scrap-pattern)" stroke="#ef4444" strokeWidth="3" />

                      {/* Usable / Reusable Scraps (drawn first so pieces sit on top) */}
                      {ch.freeRects.map((fr, idx) => {
                        const isReusable = fr.w >= 300 && fr.h >= 300;
                        return (
                          <g key={`fr_group_${idx}`}>
                            <rect
                              x={fr.x}
                              y={fr.y}
                              width={fr.w}
                              height={fr.h}
                              fill={isReusable ? "url(#reusable-pattern)" : "none"}
                              stroke={isReusable ? "#06b6d4" : "#cbd5e1"}
                              strokeWidth={isReusable ? "2" : "1"}
                              strokeDasharray={isReusable ? "3,3" : "5,5"}
                            />
                            {isReusable && fr.w > 400 && (
                              <text
                                x={fr.x + fr.w / 2}
                                y={fr.y + fr.h / 2}
                                fill="#0891b2"
                                fontSize={ch.w > 2000 ? 45 : 25}
                                fontWeight="900"
                                textAnchor="middle"
                              >
                                Sobra Reaproveitável ({fr.w}x{fr.h} mm)
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Packed Pieces */}
                      {ch.pecasEncaixadas.map((p, idx) => {
                        // Check if this piece overlaps with any other piece on the same chapa
                        const hasOverlap = ch.pecasEncaixadas.some((other, oIdx) => {
                          if (oIdx === idx) return false;
                          return checkOverlap(p, other);
                        });

                        return (
                          <g key={idx}>
                            {/* Part Rectangle */}
                            <rect
                              x={p.x}
                              y={p.y}
                              width={p.w}
                              height={p.h}
                              fill={hasOverlap ? "#fef2f2" : "#f0fdf4"}
                              stroke={hasOverlap ? "#ef4444" : "#10b981"}
                              strokeWidth={hasOverlap ? "3.5" : "2.5"}
                              rx="6"
                              className="cursor-grab active:cursor-grabbing hover:opacity-95"
                              onMouseDown={(e) => handlePecaMouseDown(e, ch.id, idx, e.currentTarget.ownerSVGElement || e.currentTarget.parentNode)}
                              onTouchStart={(e) => handlePecaMouseDown(e, ch.id, idx, e.currentTarget.ownerSVGElement || e.currentTarget.parentNode)}
                              style={{ transition: 'stroke-width 0.15s, fill 0.15s', touchAction: 'none' }}
                            />
                            {/* Label and Dim */}
                            <text
                              x={p.x + p.w / 2}
                              y={p.y + p.h / 2 - 2}
                              fill={hasOverlap ? "#991b1b" : "#065f46"}
                              fontSize={ch.w > 2000 ? 55 : 35}
                              fontWeight="900"
                              textAnchor="middle"
                              pointerEvents="none"
                            >
                              {p.label} {p.rotacionada && '🔄'}
                            </text>
                            <text
                              x={p.x + p.w / 2}
                              y={p.y + p.h / 2 + (ch.w > 2000 ? 40 : 25)}
                              fill={hasOverlap ? "#b91c1c" : "#047857"}
                              fontSize={ch.w > 2000 ? 45 : 28}
                              fontWeight="bold"
                              textAnchor="middle"
                              pointerEvents="none"
                            >
                              {p.w}x{p.h} mm
                            </text>
                            
                            {/* Click to Rotate icon overlay at top right of the piece */}
                            {p.w > 80 && p.h > 80 && (
                              <g 
                                onClick={(e) => handleRotatePeca(e, ch.id, idx)} 
                                className="cursor-pointer group"
                              >
                                <circle 
                                  cx={p.x + p.w - 22} 
                                  cy={p.y + 22} 
                                  r="14" 
                                  fill="#ffffff" 
                                  stroke={hasOverlap ? "#ef4444" : "#10b981"} 
                                  strokeWidth="1.5"
                                  className="hover:fill-slate-100 transition-colors"
                                />
                                <text 
                                  x={p.x + p.w - 22} 
                                  y={p.y + 27} 
                                  fontSize="16" 
                                  textAnchor="middle" 
                                  fontWeight="black" 
                                  fill={hasOverlap ? "#ef4444" : "#10b981"}
                                  pointerEvents="none"
                                >
                                  ↻
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Cut Sequence / Guide */}
                  <div className="bg-white p-2.5 sm:p-3.5 rounded-xl border border-slate-200 overflow-x-auto">
                    <span className="text-[9px] font-black uppercase text-slate-400 block mb-1">Roteiro de Corte Recomendado</span>
                    <ol className="list-decimal pl-4 text-[10px] sm:text-xs font-semibold text-slate-600 space-y-1.5">
                      {ch.pecasEncaixadas.map((p, idx) => (
                        <li key={idx}>
                          Alinhar e cortar peça <span className="text-slate-900 font-extrabold">{p.label}</span> de tamanho <span className="font-mono text-slate-800 font-black">{p.w}x{p.h} mm</span> na posição inicial <span className="font-mono text-slate-500 font-bold">X:{p.x}, Y:{p.y}</span>
                          {p.rotacionada && <span className="text-amber-600 text-[10px] ml-1 font-bold">⚠️ Rotacionada para melhor aproveitamento</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              );
            })}
            {chapasOtimizadas.length === 0 && (
              <p className="text-center py-10 text-slate-400 text-xs font-medium">Nenhum plano calculado. Adicione peças à esquerda.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
