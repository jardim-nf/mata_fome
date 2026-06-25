import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { 
  IoCalculatorOutline, 
  IoSparklesOutline, 
  IoCheckmarkCircleOutline 
} from 'react-icons/io5';
import ProjectSvgViewer from '../../../../components/Serralheria/ProjectSvgViewer';
import ThreeDProjectViewer from '../../../../components/ThreeDProjectViewer';

const STANDARDS_PINTURA = [
  "Sem Pintura / Natural",
  "Pintura Cinza Zarcão (Antiferrugem)",
  "Pintura Eletrostática Preta",
  "Pintura Eletrostática Branca",
  "Pintura Eletrostática Cinza/Grafite",
  "Pintura Eletrostática Bronze",
  "Galvanizado a Fogo"
];

const STANDARDS_PUXADOR = [
  { id: 'padrao', label: 'Puxador Padrão' },
  { id: 'barra_inox', label: 'Barra de Inox' },
  { id: 'embutido', label: 'Concha Embutida' },
  { id: 'sem', label: 'Sem Puxador' }
];

const STANDARDS_LADO = [
  { id: 'esquerda', label: 'Abertura p/ Esquerda' },
  { id: 'direita', label: 'Abertura p/ Direita' },
  { id: 'pivotante_centro', label: 'Pivotante Central' }
];

const CalculadoraTab = ({
  dbVidros, // perfis
  dbCores, // coberturas
  dbKits, // acessorios
  dbModelos, // modelos de projetos
  dbClientes,
  pedidos,
  estabId,
  handleCreateOS,
  handleCepLookup,
  clienteNome, setClienteNome,
  clienteTelefone, setClienteTelefone,
  clienteEndereco, setClienteEndereco,
  clienteCep, setClienteCep,
  dataInstalacao, setDataInstalacao,
  vidraceiro, setVidraceiro,
  observacoes, setObservacoes,
  onSendToOtimizer
}) => {
  // Estados da Calculadora
  const [tipoProjeto, setTipoProjeto] = useState('portao'); // portao, telhado, grade, movel
  const [modeloNome, setModeloNome] = useState('Portão de Correr Padrão');
  const [largura, setLargura] = useState(3000); // em mm
  const [altura, setAltura] = useState(2000); // em mm (ou projeção para telhado)
  const [espacamento, setEspacamento] = useState(120); // em mm (espaço entre barras)
  const [slope, setSlope] = useState(10); // caimento em % (apenas telhado)
  const [qtdeFolhas, setQtdeFolhas] = useState(1); // quantidade de abas/folhas
  const [viewMode3D, setViewMode3D] = useState(false); // toggle entre desenho 2D e 3D realista
  
  // Seleção de Materiais
  const [perfilId, setPerfilId] = useState('');
  const [coberturaId, setCoberturaId] = useState('');
  const [acessorioId, setAcessorioId] = useState('');
  const [acessorioQty, setAcessorioQty] = useState(1);
  const [pintura, setPintura] = useState("Pintura Cinza Zarcão (Antiferrugem)");

  // Acabamento e Acessórios de Instalação
  const [ladoAbertura, setLadoAbertura] = useState('esquerda');
  const [tipoPuxador, setTipoPuxador] = useState('padrao');
  
  // Financeiro
  const [custoMaoObra, setCustoMaoObra] = useState(300);
  const [custoFrete, setCustoFrete] = useState(0);
  const [markupPercent, setMarkupPercent] = useState(60);

  // Sugestões para preenchimento automático do cliente
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filtros de materiais
  const selectedPerfil = dbVidros.find(v => v.id === perfilId) || dbVidros[0];
  const selectedCobertura = dbCores.find(c => c.id === coberturaId) || dbCores[0];
  const selectedAcessorio = dbKits.find(a => a.id === acessorioId) || dbKits[0];

  // Preencher seleções iniciais quando as listas de materiais carregam
  useEffect(() => {
    if (dbVidros.length > 0 && !perfilId) setPerfilId(dbVidros[0].id);
    if (dbCores.length > 0 && !coberturaId) setCoberturaId(dbCores[0].id);
    if (dbKits.length > 0 && !acessorioId) setAcessorioId(dbKits[0].id);
  }, [dbVidros, dbCores, dbKits]);

  // Seletor de Modelo Pronto
  const [selectedModeloId, setSelectedModeloId] = useState('');
  useEffect(() => {
    if (selectedModeloId) {
      const mod = dbModelos.find(m => m.id === selectedModeloId);
      if (mod) {
        setModeloNome(mod.nome);
        setTipoProjeto(mod.tipoProjeto || 'portao');
        if (mod.larguraPadrao) setLargura(mod.larguraPadrao);
        if (mod.alturaPadrao) setAltura(mod.alturaPadrao);
        if (mod.espacamentoPadrao) setEspacamento(mod.espacamentoPadrao);
        if (mod.caimentoPadrao) setSlope(mod.caimentoPadrao);
        if (mod.qtdeFolhas) setQtdeFolhas(mod.qtdeFolhas);
        if (mod.custoMaoObra) setCustoMaoObra(mod.custoMaoObra);
        if (mod.markupPercent) setMarkupPercent(mod.markupPercent);
      }
    }
  }, [selectedModeloId, dbModelos]);

  // 2. Cálculos físicos e orçamentários baseados nas especificações
  const calculos = useMemo(() => {
    const W = Number(largura) || 0;
    const H = Number(altura) || 0; // projeção para telhado, altura para portão/grade
    const S = Number(espacamento) || 120;
    const sl = Number(slope) || 10;
    const weightPerMeter = Number(selectedPerfil?.pesoMetro) || 0;
    const pricePerMeter = (Number(selectedPerfil?.custo) || 0) / 6;

    let frameLinearMeters = 0;
    let innerLinearMeters = 0;
    let countBars = 0;
    let totalWeight = 0;
    let weldPoints = 0;
    let paintingArea = 0;
    let coverArea = 0;
    let slopedLength = H;

    if (tipoProjeto === 'portao') {
      // Perímetro do marco fixo (chumbador)
      const marcoFixoMeters = (2 * (W + H)) / 1000;
      
      // Cada folha tem seu próprio contorno (quadro da folha)
      const widthLeaf = W / qtdeFolhas;
      const perimeterOneLeaf = 2 * (widthLeaf + H);
      const quadrosFolhasMeters = (qtdeFolhas * perimeterOneLeaf) / 1000;
      
      frameLinearMeters = marcoFixoMeters + quadrosFolhasMeters;

      // Travessas internas verticais dentro de cada folha (usamos 50mm de largura do perfil metalon como padrão)
      const barWidth = 50;
      const countBarsPerLeaf = Math.max(0, Math.floor((widthLeaf - 100) / (barWidth + S)));
      countBars = countBarsPerLeaf * qtdeFolhas;
      const innerHeight = Math.max(0, H - 100); // desconto de 50mm superior e inferior
      innerLinearMeters = (countBars * innerHeight) / 1000;

      const totalLinear = frameLinearMeters + innerLinearMeters;
      totalWeight = totalLinear * weightPerMeter;
      // Pontos de solda: 16 soldas para marco fixo + (16 * qtdeFolhas) para as folhas + (countBars * 8)
      weldPoints = 16 + (16 * qtdeFolhas) + (countBars * 8);
      paintingArea = totalLinear * 0.2; // metalon 50x50mm (perímetro = 200mm = 0.2m)
    } 
    else if (tipoProjeto === 'grade') {
      // Perímetro da grade
      frameLinearMeters = (2 * (W + H)) / 1000;
      
      // Travessas internas (tubos menores de 20mm de largura padrão)
      const barWidth = 20;
      countBars = Math.floor(W / (barWidth + S)) || 0;
      const innerHeight = Math.max(0, H - 40); // desconto de 20mm superior e inferior
      innerLinearMeters = (countBars * innerHeight) / 1000;

      const totalLinear = frameLinearMeters + innerLinearMeters;
      totalWeight = totalLinear * weightPerMeter;
      weldPoints = (countBars * 8) + 16;
      paintingArea = totalLinear * 0.15; // tubo menor (perímetro aproximado = 150mm = 0.15m)
    } 
    else if (tipoProjeto === 'telhado') {
      // Caimento inclinado
      const projectionM = H / 1000;
      const numAguas = Number(qtdeFolhas || 1);
      const sl = Number(slope) || 10;
      const slopeFactor = Math.sqrt(1 + Math.pow(sl / 100, 2));
      
      // Comprimento inclinado (sloped length) para caimento total
      slopedLength = projectionM * slopeFactor * 1000;

      // Área total de cobertura universal (Área plana * Fator de inclinação)
      coverArea = (W / 1000) * (H / 1000) * slopeFactor;

      if (numAguas === 1) {
        // 1 Água (Monopitch / Meia-Água)
        const raftersCount = Math.ceil(W / 1500) + 1;
        frameLinearMeters = (raftersCount * slopedLength) / 1000; // Caibros principais
        
        const purlinsCount = Math.ceil(slopedLength / S) + 1;
        innerLinearMeters = (purlinsCount * W) / 1000; // Terças transversais
        
        weldPoints = raftersCount * purlinsCount * 4;
      } 
      else if (numAguas === 2) {
        // 2 Águas (Gable Roof)
        // Divide o caimento ao meio (cumeira no centro)
        const slopedLengthHalf = (projectionM / 2) * slopeFactor * 1000;
        const raftersCount = Math.ceil(W / 1500) + 1;
        
        // Vigas principais (caibros em ambos os lados) + Cumeira central
        frameLinearMeters = (2 * raftersCount * slopedLengthHalf + W) / 1000;
        
        const purlinsCountHalf = Math.ceil(slopedLengthHalf / S) + 1;
        innerLinearMeters = (2 * purlinsCountHalf * W) / 1000; // Terças transversais de ambos os lados
        
        weldPoints = (2 * raftersCount * purlinsCountHalf * 4) + (raftersCount * 4);
      } 
      else {
        // 3 ou 4 Águas (Hip Roof / Piramidal)
        // Cumeira no centro e caimentos nas laterais
        const slopedLengthHalf = (projectionM / 2) * slopeFactor * 1000;
        
        // Cumeira central (comprimento W - H)
        const ridgeLength = Math.max(0, W - H);
        
        // Espigões (Hips): 4 espigões de canto (ou 2 se 3 águas)
        const numHips = numAguas === 3 ? 2 : 4;
        const hipProjection = Math.sqrt(Math.pow(H/2, 2) + Math.pow(H/2, 2));
        const hipSlopedLength = Math.sqrt(Math.pow(hipProjection, 2) + Math.pow((H/2) * (sl/100), 2));
        
        // Caibros regulares (rafters): divididos ao redor das águas
        const raftersCount = (Math.ceil(W / 1500) + Math.ceil(H / 1500)) * 2;
        
        frameLinearMeters = (ridgeLength + (numHips * hipSlopedLength) + (raftersCount * slopedLengthHalf)) / 1000;
        
        // Terças (Purlins) girando ao redor da estrutura
        const purlinsCountHalf = Math.ceil(slopedLengthHalf / S) + 1;
        innerLinearMeters = (purlinsCountHalf * 2 * (W + H)) / 1000;
        
        weldPoints = (raftersCount * purlinsCountHalf * 4) + (numHips * 8);
      }
      
      const totalLinear = frameLinearMeters + innerLinearMeters;
      totalWeight = totalLinear * weightPerMeter;
      paintingArea = totalLinear * 0.2;
    } 
    else if (tipoProjeto === 'movel') {
      // Móvel / Mesa aramada (profundidade padrão de 600mm)
      const depth = 600;
      const totalLinear = (4 * W + 4 * H + 4 * depth) / 1000;
      frameLinearMeters = totalLinear;
      innerLinearMeters = 0;
      totalWeight = totalLinear * weightPerMeter;
      weldPoints = 12 * 4; // 12 junções estruturais x 4 pontos de solda
      paintingArea = totalLinear * 0.2;
    }

    const totalLinearMeters = frameLinearMeters + innerLinearMeters;
    const barrasNecessarias = Math.ceil(totalLinearMeters / 6) || 0;

    // Cálculo Financeiro
    const steelCost = totalLinearMeters * pricePerMeter;
    const coverCost = tipoProjeto === 'telhado' ? coverArea * (Number(selectedCobertura?.custo) || 0) : 0;
    const accessoryCost = (Number(selectedAcessorio?.custo) || 0) * Number(acessorioQty);
    
    const costPrice = steelCost + coverCost + accessoryCost + Number(custoMaoObra) + Number(custoFrete);
    const salePrice = costPrice * (1 + Number(markupPercent) / 100);

    // Detalhamento de peças individuais para o Otimizador 1D
    let pecasParaOtimizar = [];
    if (tipoProjeto === 'portao') {
      const widthLeaf = Math.round(W / qtdeFolhas);
      const innerHeight = Math.max(0, H - 100);
      pecasParaOtimizar = [
        { id: 1, length: W, qtd: 2, label: 'Marco Fixo Horizontal' },
        { id: 2, length: H, qtd: 2, label: 'Marco Fixo Vertical' },
        { id: 3, length: widthLeaf, qtd: 2 * qtdeFolhas, label: 'Quadro Folha Horizontal' },
        { id: 4, length: H, qtd: 2 * qtdeFolhas, label: 'Quadro Folha Vertical' }
      ];
      if (countBars > 0) {
        pecasParaOtimizar.push({ id: 5, length: innerHeight, qtd: countBars, label: 'Travessas Internas' });
      }
    } else if (tipoProjeto === 'grade') {
      const innerHeight = Math.max(0, H - 40);
      pecasParaOtimizar = [
        { id: 1, length: W, qtd: 2, label: 'Marco Horizontal' },
        { id: 2, length: H, qtd: 2, label: 'Marco Vertical' }
      ];
      if (countBars > 0) {
        pecasParaOtimizar.push({ id: 3, length: innerHeight, qtd: countBars, label: 'Travessas Internas' });
      }
    } else if (tipoProjeto === 'telhado') {
      const projectionM = H / 1000;
      const numAguas = Number(qtdeFolhas || 1);
      const sl = Number(slope) || 10;
      const slopeFactor = Math.sqrt(1 + Math.pow(sl / 100, 2));
      const slopedLen = Math.round(projectionM * slopeFactor * 1000);
      const raftersCount = Math.ceil(W / 1500) + 1;

      if (numAguas === 1) {
        const purlinsCount = Math.ceil(slopedLen / S) + 1;
        pecasParaOtimizar = [
          { id: 1, length: slopedLen, qtd: raftersCount, label: 'Caibros Principais (Inclinados)' },
          { id: 2, length: W, qtd: purlinsCount, label: 'Terças Transversais' }
        ];
      } else if (numAguas === 2) {
        const slopedLenHalf = Math.round((projectionM / 2) * slopeFactor * 1000);
        const purlinsCountHalf = Math.ceil(slopedLenHalf / S) + 1;
        pecasParaOtimizar = [
          { id: 1, length: slopedLenHalf, qtd: 2 * raftersCount, label: 'Caibros Principais' },
          { id: 2, length: W, qtd: 2 * purlinsCountHalf, label: 'Terças Transversais' }
        ];
      } else {
        const slopedLenHalf = Math.round((projectionM / 2) * slopeFactor * 1000);
        const ridgeLength = Math.max(0, W - H);
        const numHips = numAguas === 3 ? 2 : 4;
        const hipProjection = Math.sqrt(Math.pow(H/2, 2) + Math.pow(H/2, 2));
        const hipSlopedLen = Math.round(Math.sqrt(Math.pow(hipProjection, 2) + Math.pow((H/2) * (sl/100), 2)));
        const raftersCountAll = (Math.ceil(W / 1500) + Math.ceil(H / 1500)) * 2;
        const purlinsCountHalf = Math.ceil(slopedLenHalf / S) + 1;

        pecasParaOtimizar = [
          { id: 1, length: slopedLenHalf, qtd: raftersCountAll, label: 'Caibros Regulares' },
          { id: 2, length: hipSlopedLen, qtd: numHips, label: 'Espigões de Canto (Hips)' },
          { id: 3, length: W, qtd: purlinsCountHalf * 2, label: 'Terças Horizontais (Larg.)' },
          { id: 4, length: H, qtd: purlinsCountHalf * 2, label: 'Terças Horizontais (Prof.)' }
        ];
        if (ridgeLength > 0) {
          pecasParaOtimizar.push({ id: 5, length: Math.round(ridgeLength), qtd: 1, label: 'Cumeira Central' });
        }
      }
    } else if (tipoProjeto === 'movel') {
      pecasParaOtimizar = [
        { id: 1, length: W, qtd: 4, label: 'Mesa - Perfis Largura (W)' },
        { id: 2, length: H, qtd: 4, label: 'Mesa - Perfis Altura (H)' },
        { id: 3, length: 600, qtd: 4, label: 'Mesa - Perfis Profundidade' }
      ];
    }

    return {
      frameLinearMeters,
      innerLinearMeters,
      totalLinearMeters,
      barrasNecessarias,
      totalWeight,
      weldPoints,
      paintingArea,
      coverArea,
      slopedLength,
      steelCost,
      coverCost,
      accessoryCost,
      costPrice,
      salePrice,
      pecasParaOtimizar
    };
  }, [tipoProjeto, largura, altura, espacamento, slope, qtdeFolhas, selectedPerfil, selectedCobertura, selectedAcessorio, acessorioQty, custoMaoObra, custoFrete, markupPercent]);

  // Autocomplete de Clientes
  const querySug = clienteNome.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (querySug.length < 2) return [];

    const list = (dbClientes || []).map(c => {
      const formatAddress = (endereco) => {
        if (!endereco) return '';
        if (typeof endereco === 'string') return endereco;
        const parts = [
          endereco.rua,
          endereco.numero && `nº ${endereco.numero}`,
          endereco.bairro,
          endereco.cidade
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : '';
      };
      return {
        nome: c.nome || '',
        telefone: c.telefone || '',
        endereco: formatAddress(c.endereco),
        cep: c.cep || c.endereco?.cep || ''
      };
    });

    const existingNames = new Set(list.map(c => c.nome.toLowerCase().trim()));
    pedidos.forEach(p => {
      const name = p.cliente?.nome || '';
      if (name && !existingNames.has(name.toLowerCase().trim())) {
        existingNames.add(name.toLowerCase().trim());
        list.push({
          nome: name,
          telefone: p.cliente?.telefone || '',
          endereco: typeof p.cliente?.endereco === 'string' ? p.cliente.endereco : '',
          cep: p.cliente?.cep || ''
        });
      }
    });

    return list
      .filter(c => c.nome.toLowerCase().includes(querySug))
      .slice(0, 5);
  }, [dbClientes, pedidos, querySug]);

  // Função para submeter a criação da OS/Orçamento
  const onSubmitOS = async (e) => {
    e.preventDefault();
    if (!clienteNome) return toast.warn('Nome do cliente é obrigatório!');
    if (!perfilId) return toast.warn('Selecione um perfil de metalon para o cálculo!');

    const payload = {
      cliente: {
        nome: clienteNome,
        telefone: clienteTelefone,
        endereco: clienteEndereco,
        cep: clienteCep
      },
      projeto: {
        modelo: modeloNome,
        tipoProjeto: tipoProjeto,
        largura: Number(largura),
        altura: Number(altura),
        qtdeFolhas: Number(qtdeFolhas),
        espacamento: Number(espacamento),
        caimento: tipoProjeto === 'telhado' ? Number(slope) : 0,
        tipoVidro: selectedPerfil?.nome || 'Perfil de Aço', // Estrutura (Perfil)
        corVidro: pintura, // Pintura / Acabamento
        kitAluminio: tipoProjeto === 'telhado' ? (selectedCobertura?.nome || 'Nenhum') : 'Nenhum', // Cobertura / Placa
        acessorio: selectedAcessorio?.nome || 'Nenhum',
        acessorioQty: Number(acessorioQty),
        acessorioCusto: Number(selectedAcessorio?.custo) || 0,
        custoTotal: calculos.costPrice,
        precoVenda: calculos.salePrice,
        markup: Number(markupPercent),
        custoFrete: Number(custoFrete),
        pesoTotal: calculos.totalWeight,
        barrasNecessarias: calculos.barrasNecessarias,
        pontosSolda: calculos.weldPoints,
        areaPintura: calculos.paintingArea,
        tipoPuxador: tipoPuxador,
        ladoAbertura: ladoAbertura
      },
      instalacao: {
        data: dataInstalacao || null,
        vidraceiro: vidraceiro || 'Não designado' // serralheiro responsável
      },
      status: 'orcamento',
      observacoes,
      modulo: 'serralheria',
      criadoEm: new Date().toISOString()
    };

    try {
      await handleCreateOS(payload);
      
      // Limpar campos da calculadora
      setClienteNome('');
      setClienteTelefone('');
      setClienteEndereco('');
      setClienteCep('');
      setDataInstalacao('');
      setVidraceiro('');
      setObservacoes('');
      setSelectedModeloId('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao registrar ordem de serviço.');
    }
  };

  return (
    <form onSubmit={onSubmitOS} className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
      {/* Coluna Esquerda: Cadastro de Parâmetros e Cliente (7 cols) */}
      <div className="glass-card lg:col-span-7 p-4 sm:p-6 space-y-5">
        
        {/* Bloco 1: Identificação do Cliente */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200 pb-2">
            <span className="text-base">👤</span>
            <h3 className="text-sm font-black uppercase tracking-tight">Dados do Cliente</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-3.5">
            {/* Nome do Cliente com Autocomplete */}
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Nome do Cliente"
                value={clienteNome}
                onChange={e => {
                  setClienteNome(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="glass-input w-full py-2.5"
              />
              
              {/* Dropdown de sugestão flutuante */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden max-h-48 overflow-y-auto">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setClienteNome(sug.nome);
                        setClienteTelefone(sug.telefone);
                        setClienteEndereco(sug.endereco);
                        setClienteCep(sug.cep || '');
                        setShowSuggestions(false);
                        toast.success(`👥 Cliente ${sug.nome} carregado!`);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 text-xs font-semibold text-slate-700 flex flex-col gap-0.5"
                    >
                      <span className="font-extrabold text-slate-900">{sug.nome}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        📞 {sug.telefone || 'Sem telefone'} | 📍 {sug.endereco || 'Sem endereço'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="WhatsApp / Telefone"
                value={clienteTelefone}
                onChange={e => setClienteTelefone(e.target.value)}
                className="glass-input w-full py-2.5"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="CEP"
                  value={clienteCep}
                  onChange={e => handleCepLookup(e.target.value)}
                  className="glass-input flex-1 py-2.5"
                  maxLength={9}
                />
              </div>
            </div>

            <input
              type="text"
              placeholder="Endereço de Entrega / Instalação"
              value={clienteEndereco}
              onChange={e => setClienteEndereco(e.target.value)}
              className="glass-input w-full py-2.5"
            />
          </div>
        </div>

        {/* Bloco 2: Especificações Físicas do Projeto */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200 pb-2">
            <span className="text-base">📐</span>
            <h3 className="text-sm font-black uppercase tracking-tight">Dimensões & Modelagem</h3>
          </div>

          {/* Modelos Prontos do Catálogo */}
          {dbModelos.length > 0 && (
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Usar Modelo de Catálogo (Opcional)</label>
              <select
                value={selectedModeloId}
                onChange={e => setSelectedModeloId(e.target.value)}
                className="glass-input w-full text-xs font-semibold py-2.5"
              >
                <option value="">-- Personalizado / Selecionar Modelo do Catálogo --</option>
                {dbModelos.map(m => (
                  <option key={m.id} value={m.id}>{m.nome} ({m.tipoProjeto})</option>
                ))}
              </select>
            </div>
          )}

          {/* Seleção do Tipo de Projeto Geral */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'portao', label: 'Portões', emoji: '🚪' },
              { id: 'telhado', label: 'Coberturas', emoji: '🏠' },
              { id: 'grade', label: 'Grades', emoji: '⛓️' },
              { id: 'movel', label: 'Móveis', emoji: '🪑' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTipoProjeto(item.id);
                  if (item.id === 'portao') setModeloNome('Portão de Correr Padrão');
                  else if (item.id === 'telhado') setModeloNome('Cobertura de Policarbonato');
                  else if (item.id === 'grade') setModeloNome('Grade de Proteção');
                  else if (item.id === 'movel') setModeloNome('Mesa Estrutura Metálica');
                }}
                className={`py-3.5 rounded-xl border font-black text-xs transition-all flex flex-col items-center gap-1 ${
                  tipoProjeto === item.id 
                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20 scale-[1.02]' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="text-lg">{item.emoji}</span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Nome do Modelo/Projeto</label>
              <input
                type="text"
                required
                value={modeloNome}
                onChange={e => setModeloNome(e.target.value)}
                className="glass-input w-full"
                placeholder="Ex: Portão Basculante c/ Detalhe"
              />
            </div>
            
            {tipoProjeto !== 'movel' && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                  Espaçamento Interno (mm)
                </label>
                <input
                  type="number"
                  required
                  min={10}
                  value={espacamento}
                  onChange={e => setEspacamento(Number(e.target.value))}
                  className="glass-input w-full font-mono font-semibold"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                Largura do Vão (mm)
              </label>
              <input
                type="number"
                required
                min={100}
                value={largura}
                onChange={e => setLargura(Number(e.target.value))}
                className="glass-input w-full font-mono font-semibold"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                {tipoProjeto === 'telhado' ? 'Projeção/Profundidade (mm)' : 'Altura do Vão (mm)'}
              </label>
              <input
                type="number"
                required
                min={100}
                value={altura}
                onChange={e => setAltura(Number(e.target.value))}
                className="glass-input w-full font-mono font-semibold"
              />
            </div>

            {tipoProjeto === 'telhado' && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Caimento / Slope (%)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  value={slope}
                  onChange={e => setSlope(Number(e.target.value))}
                  className="glass-input w-full font-mono font-semibold"
                />
              </div>
            )}

            {tipoProjeto === 'portao' && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Abertura</label>
                <select
                  value={ladoAbertura}
                  onChange={e => setLadoAbertura(e.target.value)}
                  className="glass-input w-full text-xs font-semibold"
                >
                  {STANDARDS_LADO.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {(tipoProjeto === 'portao' || tipoProjeto === 'telhado') && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">
                  {tipoProjeto === 'telhado' ? "Quedas d'Água (Águas)" : 'Quantidade de Folhas'}
                </label>
                <select
                  value={qtdeFolhas}
                  onChange={e => setQtdeFolhas(Number(e.target.value))}
                  className="glass-input w-full text-xs font-semibold"
                >
                  {tipoProjeto === 'telhado' ? (
                    <>
                      <option value={1}>1 Água (Meia-Água)</option>
                      <option value={2}>2 Águas (Duplo Caimento)</option>
                      <option value={3}>3 Águas (Três Caimentos)</option>
                      <option value={4}>4 Águas (Quatro Caimentos)</option>
                    </>
                  ) : (
                    <>
                      <option value={1}>1 Folha</option>
                      <option value={2}>2 Folhas</option>
                      <option value={3}>3 Folhas</option>
                      <option value={4}>4 Folhas</option>
                    </>
                  )}
                </select>
              </div>
            )}
            
            {(tipoProjeto === 'portao' || tipoProjeto === 'movel') && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Puxador</label>
                <select
                  value={tipoPuxador}
                  onChange={e => setTipoPuxador(e.target.value)}
                  className="glass-input w-full text-xs font-semibold"
                >
                  {STANDARDS_PUXADOR.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Bloco 3: Materiais Utilizados */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200 pb-2">
            <span className="text-base">🛠️</span>
            <h3 className="text-sm font-black uppercase tracking-tight">Materiais & Acabamento</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Perfil de Aço (Metalon / Tubo)</label>
              <select
                required
                value={perfilId}
                onChange={e => setPerfilId(e.target.value)}
                className="glass-input w-full text-xs font-semibold"
              >
                <option value="">-- Selecione o Perfil no Catálogo --</option>
                {dbVidros.map(v => (
                  <option key={v.id} value={v.id}>{v.nome} - R$ {v.custo.toFixed(2)}/barra (⚖️ {v.pesoMetro} kg/m)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Pintura / Acabamento</label>
              <select
                value={pintura}
                onChange={e => setPintura(e.target.value)}
                className="glass-input w-full text-xs font-semibold"
              >
                {STANDARDS_PINTURA.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {tipoProjeto === 'telhado' && (
              <div>
                <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Chapas / Cobertura</label>
                <select
                  required
                  value={coberturaId}
                  onChange={e => setCoberturaId(e.target.value)}
                  className="glass-input w-full text-xs font-semibold"
                >
                  <option value="">-- Selecione a Cobertura no Catálogo --</option>
                  {dbCores.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} - R$ {c.custo.toFixed(2)}/m²</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Acessório (Roldanas, Fechaduras, etc)</label>
              <div className="flex gap-2">
                <select
                  value={acessorioId}
                  onChange={e => setAcessorioId(e.target.value)}
                  className="glass-input flex-1 text-xs font-semibold"
                >
                  <option value="">Nenhum Acessório</option>
                  {dbKits.map(k => (
                    <option key={k.id} value={k.id}>{k.nome} - R$ {k.custo.toFixed(2)}/un</option>
                  ))}
                </select>
                {acessorioId && (
                  <input
                    type="number"
                    min={1}
                    value={acessorioQty}
                    onChange={e => setAcessorioQty(Number(e.target.value))}
                    className="glass-input w-16 text-center font-mono font-semibold"
                    title="Quantidade"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bloco 4: Custos, Frete, Mão de Obra e Markup */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200 pb-2">
            <span className="text-base">💰</span>
            <h3 className="text-sm font-black uppercase tracking-tight">Custos & Margens</h3>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Mão de Obra (R$)</label>
              <input
                type="number"
                min={0}
                value={custoMaoObra}
                onChange={e => setCustoMaoObra(Number(e.target.value))}
                className="glass-input w-full font-mono font-bold"
              />
            </div>
            
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Frete / Desloc. (R$)</label>
              <input
                type="number"
                min={0}
                value={custoFrete}
                onChange={e => setCustoFrete(Number(e.target.value))}
                className="glass-input w-full font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Markup (%)</label>
              <input
                type="number"
                min={0}
                value={markupPercent}
                onChange={e => setMarkupPercent(Number(e.target.value))}
                className="glass-input w-full font-mono font-bold text-amber-600"
              />
            </div>
          </div>
        </div>

        {/* Bloco 5: Logística e Observações */}
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center gap-2 text-slate-800 border-b border-slate-200 pb-2">
            <span className="text-base">📅</span>
            <h3 className="text-sm font-black uppercase tracking-tight">Entrega & Responsável</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Data Estimada de Instalação</label>
              <input
                type="date"
                value={dataInstalacao}
                onChange={e => setDataInstalacao(e.target.value)}
                className="glass-input w-full"
              />
            </div>

            <div>
              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Serralheiro Responsável</label>
              <input
                type="text"
                placeholder="Ex: Carlos Silva"
                value={vidraceiro}
                onChange={e => setVidraceiro(e.target.value)}
                className="glass-input w-full"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Observações do Orçamento</label>
            <textarea
              placeholder="Digite detalhes técnicos adicionais ou observações especiais do cliente..."
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              className="glass-input w-full h-20 resize-none"
            />
          </div>
        </div>

        {/* Ação Principal */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!clienteNome || !perfilId}
            className="w-full py-3.5 text-center text-xs font-black uppercase rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35 flex items-center justify-center gap-2"
          >
            <IoCheckmarkCircleOutline size={18} />
            Gerar Orçamento / Salvar OS
          </button>
        </div>

      </div>

      {/* Coluna Direita: Desenho do Projeto, Memória de Cálculo e Orçamento (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Bloco Desenho Técnico */}
        <div className="glass-card p-5 space-y-3.5 flex flex-col items-center">
          <div className="flex justify-between items-center w-full border-b border-slate-200 pb-2">
            <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
              🎨 Visualização do Projeto
            </h3>
            
            {/* Toggle 2D / 3D */}
            <div className="flex gap-1.5 p-0.5 bg-slate-100 border border-slate-200/60 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode3D(false)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all ${
                  !viewMode3D
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2D (Desenho)
              </button>
              <button
                type="button"
                onClick={() => setViewMode3D(true)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md transition-all flex items-center gap-1 ${
                  viewMode3D
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <IoSparklesOutline size={10} className={viewMode3D ? 'animate-pulse' : ''} /> 3D Realista
              </button>
            </div>
          </div>
          
          <div className="w-full flex items-center justify-center bg-slate-900 border border-slate-950 rounded-2xl p-4 shadow-inner min-h-[240px]">
            {viewMode3D ? (
              <div className="w-full h-[210px] relative rounded-lg overflow-hidden">
                <ThreeDProjectViewer
                  tipo="serralheria"
                  modeloType={tipoProjeto}
                  modeloNome={modeloNome}
                  w={Number(largura)}
                  h={Number(altura)}
                  lado={ladoAbertura}
                  puxador={tipoPuxador}
                  aluminio={pintura}
                  corGlass={tipoProjeto === 'telhado' ? selectedCobertura?.nome : ''}
                  qtdeFolhas={Number(qtdeFolhas)}
                  slope={Number(slope)}
                  isOpen={false}
                  width={260}
                  height={200}
                />
              </div>
            ) : (
              <ProjectSvgViewer
                modeloType={tipoProjeto}
                modeloNome={modeloNome}
                wVao={Number(largura)}
                hVao={Number(altura)}
                lado={ladoAbertura}
                puxador={tipoPuxador}
                aluminio={pintura}
                corGlass={tipoProjeto === 'telhado' ? selectedCobertura?.nome : ''}
                qtdeFolhas={qtdeFolhas}
                isOpen={false}
                width={260}
                height={200}
              />
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-extrabold uppercase bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl w-full text-center">
            📏 Dimensão: {largura} x {altura} mm {tipoProjeto === 'telhado' && `(Inclin: ${calculos.slopedLength.toFixed(0)} mm)`}
          </div>
        </div>

        {/* Bloco Memória de Cálculo */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-1.5">
            📊 Memória de Cálculo
          </h3>

          <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Total Perfis (m)</span>
              <span className="font-mono text-sm font-bold text-slate-900">{calculos.totalLinearMeters.toFixed(2)} m</span>
              <span className="text-[9px] text-slate-400 block mt-1">Marco: {calculos.frameLinearMeters.toFixed(1)}m | Trav: {calculos.innerLinearMeters.toFixed(1)}m</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Barras de 6m</span>
              <span className="font-mono text-sm font-bold text-slate-900">{calculos.barrasNecessarias} un</span>
              <span className="text-[9px] text-amber-600 block font-bold mt-1">Desperdício: {((calculos.barrasNecessarias * 6) - calculos.totalLinearMeters).toFixed(2)} m</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Peso Estrutura</span>
              <span className="font-mono text-sm font-bold text-slate-900">{calculos.totalWeight.toFixed(1)} kg</span>
              <span className="text-[9px] text-slate-400 block mt-1">Estimado por perfil</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Pontos de Solda</span>
              <span className="font-mono text-sm font-bold text-slate-900">{calculos.weldPoints} junções</span>
              <span className="text-[9px] text-slate-400 block mt-1">Intersecções x 4</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2">
              <span className="text-[9px] text-slate-400 block uppercase font-bold">Áreas Técnicas</span>
              <div className="flex justify-between mt-1 text-slate-900">
                <span>🎨 Pintura: <strong>{calculos.paintingArea.toFixed(2)} m²</strong></span>
                {tipoProjeto === 'telhado' && (
                  <span>🏠 Cobertura: <strong>{calculos.coverArea.toFixed(2)} m²</strong></span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bloco Faturamento & Preço */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 border-b border-slate-200 pb-2">
            💲 Detalhamento do Orçamento
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between font-semibold text-slate-600">
              <span>Custo dos Perfis (Metalon):</span>
              <span className="font-mono text-slate-900">R$ {calculos.steelCost.toFixed(2)}</span>
            </div>

            {tipoProjeto === 'telhado' && (
              <div className="flex justify-between font-semibold text-slate-600">
                <span>Custo das Telhas/Coberturas:</span>
                <span className="font-mono text-slate-900">R$ {calculos.coverCost.toFixed(2)}</span>
              </div>
            )}

            {acessorioId && (
              <div className="flex justify-between font-semibold text-slate-600">
                <span>Custo Acessórios ({acessorioQty}x):</span>
                <span className="font-mono text-slate-900">R$ {calculos.accessoryCost.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between font-semibold text-slate-600">
              <span>Custo Mão de Obra:</span>
              <span className="font-mono text-slate-900">R$ {Number(custoMaoObra).toFixed(2)}</span>
            </div>

            {custoFrete > 0 && (
              <div className="flex justify-between font-semibold text-slate-600">
                <span>Frete / Logística:</span>
                <span className="font-mono text-slate-900">R$ {Number(custoFrete).toFixed(2)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-slate-700">
              <span>Custo Total do Projeto:</span>
              <span className="font-mono text-slate-900">R$ {calculos.costPrice.toFixed(2)}</span>
            </div>

            <div className="flex justify-between font-semibold text-slate-600">
              <span>Margem / Markup ({markupPercent}%):</span>
              <span className="font-mono text-slate-900">R$ {(calculos.salePrice - calculos.costPrice).toFixed(2)}</span>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex justify-between items-center text-amber-900 animate-pulse-subtle">
              <div className="text-left">
                <span className="text-[10px] uppercase font-black block tracking-wider text-amber-700">Preço de Venda</span>
                <span className="text-xl font-black font-mono">R$ {calculos.salePrice.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-[8px] uppercase font-black block tracking-wider text-slate-500">Lucro Líquido Est.</span>
                <span className="text-xs font-black font-mono text-emerald-600">+ R$ {(calculos.salePrice - calculos.costPrice).toFixed(2)}</span>
              </div>
            </div>

            {onSendToOtimizer && calculos.pecasParaOtimizar && calculos.pecasParaOtimizar.length > 0 && (
              <button
                type="button"
                onClick={() => onSendToOtimizer(calculos.pecasParaOtimizar)}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 mt-3.5"
              >
                <span>🚀</span> Enviar Peças para o Plano de Corte
              </button>
            )}
          </div>
        </div>

      </div>
    </form>
  );
};

export default CalculadoraTab;
