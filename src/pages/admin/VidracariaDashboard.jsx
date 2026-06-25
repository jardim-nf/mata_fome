// src/pages/admin/VidracariaDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import BackButton from '../../components/BackButton';
import { toast } from 'react-toastify';
import { 
  IoCalculatorOutline, 
  IoBuildOutline, 
  IoPersonOutline, 
  IoAnalyticsOutline, 
  IoListOutline, 
  IoGridOutline 
} from 'react-icons/io5';
import './VidracariaDashboard.css';

// Sub-componentes Refatorados
import DashboardTab from './Vidracaria/components/DashboardTab';
import CalculadoraTab from './Vidracaria/components/CalculadoraTab';
import KanbanTab from './Vidracaria/components/KanbanTab';
import CatalogoTab from './Vidracaria/components/CatalogoTab';
import ClientesTab from './Vidracaria/components/ClientesTab';
import OsDetailModal from './Vidracaria/components/OsDetailModal';
import EditMaterialModal from './Vidracaria/components/EditMaterialModal';

import PlanoCorteOptimizer from '../../components/PlanoCorteOptimizer';
import IdeaCopilot from '../../components/IdeaCopilot';
import { useConfirmDialog } from '../../hooks/useDialogs.jsx';

// Definições padrão desativadas (O cliente cadastrará tudo)
const DEFAULTS_MODELOS = [];
const DEFAULTS_LINHAS = [];
const DEFAULTS_VIDROS = [];
const DEFAULTS_CORES = [];
const DEFAULTS_KITS = [];

const obterQtdFolhasFixoMovel = (tipoProjeto, modeloNome, totalFolhas) => {
  const nomeLower = String(modeloNome || '').toLowerCase();
  
  if (tipoProjeto === 'espelho') {
    return { fixas: totalFolhas, moveis: 0 };
  }
  
  if (tipoProjeto === 'outros') {
    return { fixas: totalFolhas, moveis: 0 };
  }
  
  const isPivotOrSwing = nomeLower.includes('pivotante') || nomeLower.includes('abrir') || nomeLower.includes('giro');
  
  if (isPivotOrSwing) {
    if (totalFolhas === 1) return { fixas: 0, moveis: 1 };
    if (totalFolhas === 2) return { fixas: 1, moveis: 1 };
    if (totalFolhas === 3) return { fixas: 2, moveis: 1 };
    if (totalFolhas === 4) return { fixas: 2, moveis: 2 };
    return { fixas: 0, moveis: totalFolhas };
  }
  
  // Standard sliding (correr) Box, Janela, Porta
  if (totalFolhas === 2) return { fixas: 1, moveis: 1 };
  if (totalFolhas === 4) return { fixas: 2, moveis: 2 };
  if (totalFolhas === 3) return { fixas: 2, moveis: 1 }; // standard 3-panel (2 fixed, 1 mobile)
  if (totalFolhas === 1) {
    if (nomeLower.includes('fixo') || nomeLower.includes('painel') || nomeLower.includes('resguardo')) {
      return { fixas: 1, moveis: 0 };
    }
    return { fixas: 0, moveis: 1 };
  }
  
  // Fallback
  const moveis = Math.floor(totalFolhas / 2);
  const fixas = totalFolhas - moveis;
  return { fixas, moveis };
};

const STATUS_FLOW = ['orcamento', 'medicao', 'producao', 'instalacao', 'concluido'];

const STATUS_OS = {
  orcamento: { label: 'Orçamento', color: 'bg-amber-50 text-amber-700 border-amber-200', borderCol: 'border-l-amber-500' },
  medicao: { label: 'Medição', color: 'bg-slate-100 text-slate-800 border-slate-300', borderCol: 'border-l-slate-600' },
  producao: { label: 'Produção', color: 'bg-purple-50 text-purple-700 border-purple-200', borderCol: 'border-l-purple-500' },
  instalacao: { label: 'Instalação', color: 'bg-orange-50 text-orange-700 border-orange-200', borderCol: 'border-l-orange-500' },
  concluido: { label: 'Concluído', color: 'bg-green-50 text-green-700 border-green-200', borderCol: 'border-l-emerald-500' }
};

const VidracariaDashboard = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

  const [confirm, ConfirmUI] = useConfirmDialog();

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, calculadora, otimizador, kanban, catalogo, clientes

  // Estados do Otimizador 2D
  const [otimizerPecas, setOtimizerPecas] = useState([]);

  const handleSendToOtimizer = (pecas) => {
    setOtimizerPecas(pecas);
    setActiveTab('otimizador');
    toast.success('🚀 Peças do projeto enviadas para o Plano de Corte!');
  };

  // Dados do Firestore
  const [pedidos, setPedidos] = useState([]);
  const [dbVidros, setDbVidros] = useState([]);
  const [dbCores, setDbCores] = useState([]);
  const [dbKits, setDbKits] = useState([]);
  const [dbAcessorios, setDbAcessorios] = useState([]);
  const [dbModelos, setDbModelos] = useState([]);
  const [dbLinhas, setDbLinhas] = useState([]);
  const [dbClientes, setDbClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados da Calculadora
  const [modelo, setModelo] = useState('box'); // box, janela, porta, espelho, outros
  const [modeloObjId, setModeloObjId] = useState('');
  const [modeloNomeCompleto, setModeloNomeCompleto] = useState('Box de Banheiro');
  const [largura, setLargura] = useState(1200); // em mm
  const [altura, setAltura] = useState(1900); // em mm
  const [arredondamentoMm, setArredondamentoMm] = useState(50); // 50, 100, 0
  const [areaMinimaM2, setAreaMinimaM2] = useState(0.50); // 0.50, 1.00, 0
  const [folgaLargura, setFolgaLargura] = useState(50); // em mm
  const [descontoAltura, setDescontoAltura] = useState(50); // em mm
  const [descontoAlturaMovel, setDescontoAlturaMovel] = useState(20); // em mm
  const [tipoVidroId, setTipoVidroId] = useState('');
  const [corVidroId, setCorVidroId] = useState('');
  const [kitAluminioId, setKitAluminioId] = useState('');
  const [linhaAluminioId, setLinhaAluminioId] = useState('');
  const [acessorioId, setAcessorioId] = useState('');
  const [custoMaoObra, setCustoMaoObra] = useState(150);
  const [markupPercent, setMarkupPercent] = useState(50);
  const [ladoAbertura, setLadoAbertura] = useState('esquerda'); // esquerda, direita
  const [sentidoAbertura, setSentidoAbertura] = useState('dentro'); // dentro, fora
  const [tipoPuxador, setTipoPuxador] = useState('padrao'); // padrao, furo, knob, sem
  const [corAluminio, setCorAluminio] = useState('fosco'); // fosco, branco, preto, bronze, brilhante
  const [alertaSeguranca, setAlertaSeguranca] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [viewMode3D, setViewMode3D] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [custoFrete, setCustoFrete] = useState(0);
  const [perfisSelecionados, setPerfisSelecionados] = useState(['SU-001']);
  const [cenarioFundo, setCenarioFundo] = useState('banheiro_premium');
  const [anguloCorte, setAnguloCorte] = useState('90');

  // Visualizador de perfil (Calculadora)
  const [showPerfilSelector, setShowPerfilSelector] = useState(false);
  const [searchPerfilQuery, setSearchPerfilQuery] = useState('');

  // Form de OS
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [clienteCep, setClienteCep] = useState('');
  const [dataInstalacao, setDataInstalacao] = useState('');
  const [vidraceiro, setVidraceiro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Modais
  const [selectedOS, setSelectedOS] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const seedingRef = useRef({ vidros: false, cores: false, kits: false, modelos: false, linhas: false });

  // Bloquear scroll do body quando o modal da OS estiver aberto
  useEffect(() => {
    if (selectedOS) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedOS]);

  // --- ESCUTAS FIRESTORE E SEEDING ---
  useEffect(() => {
    if (!estabId) return;

    const unsubInsumos = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'insumos'),
      (snap) => {
        const allInsumos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filteredInsumos = allInsumos.filter(i => i.modulo !== 'serralheria');

        const vidros = filteredInsumos.filter(i => i.tipoVidracaria === 'vidro');
        const cores = filteredInsumos.filter(i => i.tipoVidracaria === 'cor');
        const kits = filteredInsumos.filter(i => i.tipoVidracaria === 'kit');
        const acessorios = filteredInsumos.filter(i => i.tipoVidracaria === 'acessorio');
        const modelos = filteredInsumos.filter(i => i.tipoVidracaria === 'modelo');
        const linhas = filteredInsumos.filter(i => i.tipoVidracaria === 'linha');

        setDbVidros(vidros);
        setDbCores(cores);
        setDbKits(kits);
        setDbAcessorios(acessorios);
        setDbModelos(modelos);
        setDbLinhas(linhas);
      },
      (err) => {
        console.error('Erro ao escutar insumos:', err);
      }
    );

    const unsubPedidos = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'ordensServico'),
      (snap) => {
        const osList = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.modulo === 'vidracaria' || d.tipoVidracaria === 'projeto');

        osList.sort((a, b) => {
          const dateA = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
          const dateB = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
          return dateB - dateA;
        });

        setPedidos(osList);
        setLoading(false);
      },
      (err) => {
        console.error('Erro ao escutar ordens de serviço:', err);
        setLoading(false);
      }
    );

    const unsubClientes = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'clientes'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDbClientes(list);
      },
      (err) => {
        console.error('Erro ao escutar clientes:', err);
      }
    );

    return () => {
      unsubInsumos();
      unsubPedidos();
      unsubClientes();
    };
  }, [estabId]);

  const aplicarFolgasPadrao = (tipoProj) => {
    switch (tipoProj) {
      case 'box':
        setFolgaLargura(50);
        setDescontoAltura(55);
        setDescontoAlturaMovel(20);
        break;
      case 'janela':
        setFolgaLargura(40);
        setDescontoAltura(55);
        setDescontoAlturaMovel(20);
        break;
      case 'porta':
        setFolgaLargura(50);
        setDescontoAltura(55);
        setDescontoAlturaMovel(20);
        break;
      case 'espelho':
      case 'outros':
      default:
        setFolgaLargura(0);
        setDescontoAltura(0);
        setDescontoAlturaMovel(0);
        break;
    }
  };

  // Define seleções iniciais quando as listas de materiais carregam
  useEffect(() => {
    if (dbModelos.length > 0 && !modeloObjId) {
      const first = dbModelos[0];
      setModeloObjId(first.id);
      const tProj = first.tipoProjeto || 'outros';
      setModelo(tProj);
      setModeloNomeCompleto(first.nome);
      
      if (first.larguraPadrao !== undefined && first.larguraPadrao > 0) {
        setLargura(first.larguraPadrao);
      }
      if (first.alturaPadrao !== undefined && first.alturaPadrao > 0) {
        setAltura(first.alturaPadrao);
      }
      const defaultFolga = tProj === 'box' ? 50 : tProj === 'janela' ? 40 : tProj === 'porta' ? 50 : 0;
      const defaultDesconto = (tProj === 'box' || tProj === 'janela' || tProj === 'porta') ? 55 : 0;
      const defaultDescontoMovel = (tProj === 'box' || tProj === 'janela' || tProj === 'porta') ? 20 : 0;

      const folga = (first.folgaLarguraPadrao === undefined || first.folgaLarguraPadrao === null || (first.folgaLarguraPadrao === 0 && tProj !== 'outros' && tProj !== 'espelho'))
        ? defaultFolga
        : first.folgaLarguraPadrao;

      const desconto = (first.descontoAlturaPadrao === undefined || first.descontoAlturaPadrao === null || (first.descontoAlturaPadrao === 0 && tProj !== 'outros' && tProj !== 'espelho'))
        ? defaultDesconto
        : first.descontoAlturaPadrao;

      const descontoMovel = (first.descontoAlturaMovelPadrao === undefined || first.descontoAlturaMovelPadrao === null || (first.descontoAlturaMovelPadrao === 0 && tProj !== 'outros' && tProj !== 'espelho'))
        ? defaultDescontoMovel
        : first.descontoAlturaMovelPadrao;

      setFolgaLargura(folga);
      setDescontoAltura(desconto);
      setDescontoAlturaMovel(descontoMovel);
      
      if (first.linhaAluminio) {
        setLinhaAluminioId(first.linhaAluminio);
      }

      if (first.corAluminio) {
        setCorAluminio(first.corAluminio);
      }
      if (first.tipoPuxador) {
        setTipoPuxador(first.tipoPuxador);
      }
      if (first.cenarioFundo) {
        setCenarioFundo(first.cenarioFundo);
      }
      if (first.anguloCorte !== undefined) {
        setAnguloCorte(String(first.anguloCorte));
      }
      if (first.arredondamentoMm !== undefined) {
        setArredondamentoMm(first.arredondamentoMm);
      }
      if (first.areaMinimaM2 !== undefined) {
        setAreaMinimaM2(first.areaMinimaM2);
      }
      if (first.custoFrete !== undefined) {
        setCustoFrete(first.custoFrete);
      }
    }
  }, [dbModelos]);

  // Validação automática de espessura de vidro conforme ABNT NBR 7199
  useEffect(() => {
    const selectedModel = dbModelos.find(m => m.id === modeloObjId);
    const modelVidros = selectedModel?.vidros || [];
    if (!tipoVidroId || modelVidros.length === 0) return;
    const selected = modelVidros.find(v => v.id === tipoVidroId);
    if (!selected) return;

    const nameLower = selected.nome.toLowerCase();
    const isSafety = nameLower.includes('temperado') || nameLower.includes('laminado') || nameLower.includes('aramado') || nameLower.includes('espelho');
    const is8mm = nameLower.includes('8mm');
    const areaReal = (Number(largura) * Number(altura)) / 1000000;

    let needsUpgrade = false;
    let upgradeReason = '';

    if (modelo === 'porta' && (Number(altura) >= 1900 || Number(largura) >= 800)) {
      needsUpgrade = true;
      upgradeReason = 'Portas com altura ≥ 1.90m ou largura ≥ 0.80m exigem espessura mínima de 10mm para estabilidade e segurança.';
    } else if (modeloNomeCompleto.toLowerCase().includes('pivotante')) {
      needsUpgrade = true;
      upgradeReason = 'Portas pivotantes exigem vidro de 10mm devido ao peso e torque nos eixos de rotação.';
    } else if (Number(altura) > 2200 || Number(largura) > 1200 || areaReal > 2.2) {
      needsUpgrade = true;
      upgradeReason = 'Dimensões do vão (altura > 2.20m, largura > 1.20m ou área > 2.20m²) excedem o limite seguro do vidro de 8mm.';
    }

    if (needsUpgrade && is8mm) {
      const typeKeyword = nameLower.includes('laminado') ? 'laminado' : 'temperado';
      const equiv10mm = modelVidros.find(
        v => v.nome.toLowerCase().includes('10mm') && v.nome.toLowerCase().includes(typeKeyword) && v.ativo !== false
      );

      if (equiv10mm) {
        setTipoVidroId(equiv10mm.id);
        toast.info(`🛡️ Upgrade de Segurança: Vidro alterado automaticamente para 10mm (${equiv10mm.nome}). Motivo: ${upgradeReason}`);
        return;
      }
    }

    const checklistItems = [
      {
        text: "Vidro de Segurança (Temperado/Laminado)",
        status: isSafety ? 'success' : 'danger',
        desc: isSafety ? "Em conformidade." : "Exigido para portas, divisórias e boxes."
      },
      {
        text: "Espessura de Vidro Adequada",
        status: (needsUpgrade && is8mm) ? 'danger' : 'success',
        desc: (needsUpgrade && is8mm) ? "Exige espessura mínima de 10mm." : "Espessura compatível com as cargas mecânicas."
      },
      {
        text: "Estabilidade Estrutural",
        status: (modelo === 'porta' && is8mm && (Number(altura) >= 1900 || Number(largura) >= 800)) ? 'danger' : 'success',
        desc: "Verificação de torção e flecha do painel."
      },
      {
        text: "Dimensões Limites do Vão",
        status: (Number(altura) > 2600 || Number(largura) > 2000 || areaReal > 4.5) ? 'danger' : 'success',
        desc: (Number(altura) > 2600 || Number(largura) > 2000 || areaReal > 4.5) 
          ? "Área crítica. Sugere-se dividir o vão." 
          : "Dimensões seguras para fabricação."
      }
    ];

    let score = 100;
    if (!isSafety) score -= 40;
    if (needsUpgrade && is8mm) score -= 30;
    if (Number(altura) > 2600 || Number(largura) > 2000 || areaReal > 4.5) score -= 30;
    else if (areaReal > 2.2 && is8mm) score -= 15;
    score = Math.max(10, score);

    let generalType = 'success';
    let generalMsg = '✅ Sistema em total conformidade técnica com a ABNT NBR 7199.';
    let suggestions = [];

    if (score < 60) {
      generalType = 'critical';
      generalMsg = `⚠️ ALERTA CRÍTICO: Projeto apresenta riscos elevados de ruptura ou flexão excessiva.`;
      suggestions = [
        { w: 1200, h: 1800, label: 'Ajustar para Vão Seguro de 8mm (1200x1800 mm)' },
        { w: 800, h: 1800, label: 'Ajustar para 800x1800 mm' }
      ];
    } else if (score < 90) {
      generalType = 'warning';
      generalMsg = `⚠️ ALERTA: Dimensões elevadas para a espessura selecionada. Reduza o vão ou mude para 10mm.`;
      if (is8mm) {
        generalMsg = `⚠️ ALERTA: ${upgradeReason} (Vidro de 10mm não configurado no catálogo).`;
      }
    }

    setAlertaSeguranca({
      tipo: generalType,
      mensagem: generalMsg,
      score,
      checklist: checklistItems,
      sugestoes: suggestions
    });

  }, [largura, altura, modelo, dbModelos, modeloObjId, tipoVidroId, modeloNomeCompleto]);

  // CEP Lookup
  const handleCepLookup = async (cepValue) => {
    const cleanCep = cepValue.replace(/\D/g, '');
    setClienteCep(cleanCep);
    
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data && !data.erro) {
          const autoEnd = `${data.logradouro}${data.bairro ? ` - ${data.bairro}` : ''}, ${data.localidade} - ${data.uf}`;
          setClienteEndereco(autoEnd);
          toast.success('📍 CEP localizado e preenchido!');
        } else {
          toast.error('CEP não encontrado.');
        }
      } catch (err) {
        console.error('Erro ao consultar CEP:', err);
      }
    }
  };

  // Criar OS / Orçamento
  const handleCreateOS = async (e) => {
    e.preventDefault();
    if (!clienteNome) return toast.warn('Nome do cliente é obrigatório!');
    if (!estabId) return;

    // Métricas calculadas para envio
    const selectedModel = dbModelos.find(m => m.id === modeloObjId);
    const selectedVidro = dbVidros.find(v => v.id === tipoVidroId) || selectedModel?.vidros?.find(v => v.id === tipoVidroId) || dbVidros[0];
    const selectedCor = dbCores.find(c => c.id === corVidroId) || selectedModel?.cores?.find(c => c.id === corVidroId) || dbCores[0];
    const selectedKit = dbKits.find(k => k.id === kitAluminioId) || selectedModel?.kits?.find(k => k.id === kitAluminioId) || dbKits[0];
    const selectedAcessorio = dbAcessorios.find(a => a.id === acessorioId) || selectedModel?.acessorios?.find(a => a.id === acessorioId) || dbAcessorios[0];

    const obterMedidaArredondada = (medidaMm, arredMm) => {
      const val = Number(medidaMm) || 0;
      if (!arredMm || arredMm <= 0) return val / 1000;
      return Math.ceil(val / arredMm) * arredMm / 1000;
    };

    const qtdeFolhas = selectedModel?.qtdeFolhas || 2;
    const overlaps = qtdeFolhas === 4 || qtdeFolhas === 3 ? 2 : (qtdeFolhas === 2 ? 1 : 0);

    const { fixas: qtdFixas, moveis: qtdMoveis } = obterQtdFolhasFixoMovel(modelo, modeloNomeCompleto, qtdeFolhas);

    const larguraVidroFolha = Math.round((Number(largura || 0) + (overlaps * Number(folgaLargura || 0))) / qtdeFolhas) || 0;
    const alturaVidroFixoFolha = Math.max(1, Number(altura || 0) - Number(descontoAltura || 0)) || 0;
    const alturaVidroMovelFolha = Math.max(1, Number(altura || 0) - Number(descontoAlturaMovel || 0)) || 0;

    const larguraFaturadaFolha = obterMedidaArredondada(larguraVidroFolha, arredondamentoMm);
    const alturaFaturadaFixoFolha = obterMedidaArredondada(alturaVidroFixoFolha, arredondamentoMm);
    const alturaFaturadaMovelFolha = obterMedidaArredondada(alturaVidroMovelFolha, arredondamentoMm);

    const areaTeoricaFixoFolha = larguraFaturadaFolha * alturaFaturadaFixoFolha;
    const areaTeoricaMovelFolha = larguraFaturadaFolha * alturaFaturadaMovelFolha;
    
    const areaSqmFixoFolha = parseFloat(Math.max(areaMinimaM2, areaTeoricaFixoFolha).toFixed(4)) || 0;
    const areaSqmMovelFolha = parseFloat(Math.max(areaMinimaM2, areaTeoricaMovelFolha).toFixed(4)) || 0;

    const areaSqm = (areaSqmFixoFolha * qtdFixas) + (areaSqmMovelFolha * qtdMoveis);
    const areaRealSqm = ((larguraVidroFolha * alturaVidroFixoFolha / 1000000) * qtdFixas) + 
                         ((larguraVidroFolha * alturaVidroMovelFolha / 1000000) * qtdMoveis);

    const larguraVidro = larguraVidroFolha * qtdeFolhas; 
    const alturaVidro = qtdMoveis > 0 ? alturaVidroMovelFolha : alturaVidroFixoFolha;
    const larguraFaturada = larguraFaturadaFolha * qtdeFolhas;
    const alturaFaturada = qtdMoveis > 0 ? alturaFaturadaMovelFolha : alturaFaturadaFixoFolha;
    
    const glassCostPerSqm = (Number(selectedVidro?.custoM2) || 0) + (Number(selectedCor?.adicionalM2) || 0);
    const totalGlassCost = areaSqm * glassCostPerSqm;
    const totalKitCost = Number(selectedKit?.custo) || 0;
    const totalAcessorioCost = Number(selectedAcessorio?.custo) || 0;
    const totalCostPrice = totalGlassCost + totalKitCost + totalAcessorioCost + Number(custoMaoObra) + Number(custoFrete);
    const salePrice = totalCostPrice * (1 + Number(markupPercent) / 100);

    try {
      const cleanPhone = clienteTelefone.replace(/\D/g, '');
      const clientExists = dbClientes.some(c => {
        const cPhone = (c.telefone || '').replace(/\D/g, '');
        const matchPhone = cleanPhone && cPhone && cPhone === cleanPhone;
        const matchNome = c.nome && c.nome.toLowerCase() === clienteNome.toLowerCase();
        return matchPhone || matchNome;
      });

      let finalClienteId = null;

      if (!clientExists) {
        let clientId = cleanPhone;
        const hasValidPhone = cleanPhone && cleanPhone.length >= 8;
        if (!hasValidPhone) {
          clientId = doc(collection(db, 'estabelecimentos', estabId, 'clientes')).id;
        }

        const clientData = {
          id: clientId,
          nome: clienteNome.toUpperCase().trim(),
          telefone: cleanPhone || '',
          cpf: null,
          email: null,
          limiteCrediario: 0,
          saldoDevedor: 0,
          nascimento: null,
          endereco: clienteEndereco ? clienteEndereco.toUpperCase().trim() : '',
          cep: clienteCep || '',
          saldoCashback: 0,
          fidelidade: { carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 },
          criadoEm: new Date()
        };

        await setDoc(doc(db, 'estabelecimentos', estabId, 'clientes', clientId), clientData);

        if (hasValidPhone) {
          await setDoc(doc(db, 'clientes', cleanPhone), {
            nome: clientData.nome,
            telefone: clientData.telefone,
            cpf: clientData.cpf,
            email: clientData.email,
            limiteCrediario: clientData.limiteCrediario,
            endereco: clientData.endereco,
            nascimento: clientData.nascimento,
            criadoEm: clientData.criadoEm
          });
        }
        finalClienteId = clientId;
        toast.success(`👥 Novo cliente ${clientData.nome} cadastrado automaticamente!`);
      } else {
        const existing = dbClientes.find(c => {
          const cPhone = (c.telefone || '').replace(/\D/g, '');
          const matchPhone = cleanPhone && cPhone && cPhone === cleanPhone;
          const matchNome = c.nome && c.nome.toLowerCase() === clienteNome.toLowerCase();
          return matchPhone || matchNome;
        });
        if (existing) {
          finalClienteId = existing.id;
        }
      }

      const payload = {
        cliente: {
          nome: clienteNome,
          telefone: clienteTelefone,
          endereco: clienteEndereco,
          cep: clienteCep
        },
        clienteId: finalClienteId,
        projeto: {
          modelo: modeloNomeCompleto,
          tipoProjeto: modelo,
          largura: Number(largura),
          altura: Number(altura),
          folgaLargura: Number(folgaLargura),
          descontoAltura: Number(descontoAltura),
          descontoAlturaMovel: Number(descontoAlturaMovel),
          qtdeFolhas: Number(qtdeFolhas),
          qtdFixas: Number(qtdFixas),
          qtdMoveis: Number(qtdMoveis),
          larguraVidroFolha: Number(larguraVidroFolha),
          alturaVidroFolha: Number(alturaVidroFolha),
          alturaVidroFixoFolha: Number(alturaVidroFixoFolha),
          alturaVidroMovelFolha: Number(alturaVidroMovelFolha),
          larguraVidro: Number(larguraVidro),
          alturaVidro: Number(alturaVidro),
          larguraFaturada: Number(larguraFaturada),
          alturaFaturada: Number(alturaFaturada),
          arredondamentoMm: Number(arredondamentoMm),
          areaMinimaM2: Number(areaMinimaM2),
          areaRealSqm: Number(areaRealSqm),
          tipoVidro: selectedVidro?.nome || 'Não selecionado',
          corVidro: selectedCor?.nome || 'Não selecionado',
          kitAluminio: selectedKit?.nome || 'Não selecionado',
          acessorio: selectedAcessorio?.nome || 'Nenhum',
          acessorioMaterial: selectedAcessorio?.material || '',
          acessorioCusto: Number(selectedAcessorio?.custo) || 0,
          area: areaSqm,
          custoTotal: totalCostPrice,
          precoVenda: salePrice,
          markup: Number(markupPercent),
          ladoAbertura: ladoAbertura,
          sentidoAbertura: sentidoAbertura,
          tipoPuxador: tipoPuxador,
          corAluminio: corAluminio,
          perfilAluminio: perfisSelecionados,
          custoFrete: Number(custoFrete),
          cenarioFundo: cenarioFundo,
          anguloCorte: Number(anguloCorte)
        },
        instalacao: {
          data: dataInstalacao || null,
          vidraceiro: vidraceiro || 'Não designado'
        },
        status: 'orcamento',
        observacoes,
        modulo: 'vidracaria',
        tipoVidracaria: 'projeto',
        criadoEm: new Date().toISOString()
      };

      await addDoc(collection(db, 'estabelecimentos', estabId, 'ordensServico'), payload);
      toast.success('✅ Orçamento/OS cadastrada com sucesso!');
      
      // Limpar campos
      setClienteNome('');
      setClienteTelefone('');
      setClienteEndereco('');
      setClienteCep('');
      setDataInstalacao('');
      setVidraceiro('');
      setObservacoes('');
      setLadoAbertura('esquerda');
      setSentidoAbertura('dentro');
      setTipoPuxador('padrao');
      setCorAluminio('fosco');
      setActiveTab('kanban'); // Ver pipeline
    } catch (e) {
      console.error(e);
      toast.error('Erro ao salvar no Firestore.');
    }
  };

  // Mudar Status da OS
  const handleUpdateStatus = async (id, nextStatus) => {
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId, 'ordensServico', id), {
        status: nextStatus
      });
      toast.success('Status da OS atualizado!');
      // Atualizar o selectedOS em tempo real se estiver aberto
      if (selectedOS && selectedOS.id === id) {
        setSelectedOS(prev => ({ ...prev, status: nextStatus }));
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro ao atualizar status.');
    }
  };

  // Excluir OS
  const handleDeleteOS = async (id) => {
    const ok = await confirm("Excluir esta Ordem de Serviço permanentemente?", {
      title: 'Excluir Ordem de Serviço',
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'ordensServico', id));
      toast.success('OS removida!');
      if (selectedOS?.id === id) setSelectedOS(null);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao remover.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-t-emerald-500 border-r-transparent border-slate-700 rounded-full animate-spin" />
          <p className="text-sm font-bold tracking-wider">Carregando painel de vidraçaria...</p>
        </div>
      </div>
    );
  }

  const larguraVidro = Number(largura) + Number(folgaLargura);
  const alturaVidro = Math.max(1, Number(altura) - Number(descontoAltura));

  return (
    <div className="vidracaria-body min-h-screen p-3 sm:p-4 md:p-6 pb-20 font-sans text-slate-800">
      <div className="max-w-none mx-auto w-full overflow-x-hidden">
        
        {/* Header Superior */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-8">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div className="text-left">
              <h1 className="text-xl sm:text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <span className="glass-logo-icon">💎</span> IdeaGlass
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-semibold tracking-wide">Plataforma Avançada de Gestão de Vidros e Instalações</p>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex flex-nowrap overflow-x-auto gap-0.5 sm:gap-1 bg-slate-100/80 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm backdrop-blur-md w-full scrollbar-none">
            {[
              { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dash', icon: <IoAnalyticsOutline size={16} /> },
              { id: 'calculadora', label: 'Calculadora', shortLabel: 'Calc', icon: <IoCalculatorOutline size={16} /> },
              { id: 'otimizador', label: 'Plano de Corte', shortLabel: 'Corte', icon: <IoGridOutline size={16} /> },
              { id: 'kanban', label: 'Projetos (OS)', shortLabel: 'OS', icon: <IoBuildOutline size={16} /> },
              { id: 'catalogo', label: 'Materiais', shortLabel: 'Mat', icon: <IoListOutline size={16} /> },
              { id: 'clientes', label: 'Clientes', shortLabel: 'Cli', icon: <IoPersonOutline size={16} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 md:px-4 py-2 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 flex-1 sm:flex-none min-w-0 ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-slate-900 to-black text-white shadow-md shadow-slate-950/20' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
                }`}
              >
                {tab.icon}
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden truncate">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- ABA 1: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            pedidos={pedidos}
            setSelectedOS={setSelectedOS}
            STATUS_OS={STATUS_OS}
          />
        )}

        {/* --- ABA 2: CALCULADORA --- */}
        {activeTab === 'calculadora' && (
          <CalculadoraTab
            setEditingMaterial={setEditingMaterial}
            modelo={modelo} setModelo={setModelo}
            modeloObjId={modeloObjId} setModeloObjId={setModeloObjId}
            modeloNomeCompleto={modeloNomeCompleto} setModeloNomeCompleto={setModeloNomeCompleto}
            largura={largura} setLargura={setLargura}
            altura={altura} setAltura={setAltura}
            arredondamentoMm={arredondamentoMm} setArredondamentoMm={setArredondamentoMm}
            areaMinimaM2={areaMinimaM2} setAreaMinimaM2={setAreaMinimaM2}
            folgaLargura={folgaLargura} setFolgaLargura={setFolgaLargura}
            descontoAltura={descontoAltura} setDescontoAltura={setDescontoAltura}
            descontoAlturaMovel={descontoAlturaMovel} setDescontoAlturaMovel={setDescontoAlturaMovel}
            tipoVidroId={tipoVidroId} setTipoVidroId={setTipoVidroId}
            corVidroId={corVidroId} setCorVidroId={setCorVidroId}
            kitAluminioId={kitAluminioId} setKitAluminioId={setKitAluminioId}
            linhaAluminioId={linhaAluminioId} setLinhaAluminioId={setLinhaAluminioId}
            acessorioId={acessorioId} setAcessorioId={setAcessorioId}
            custoMaoObra={custoMaoObra} setCustoMaoObra={setCustoMaoObra}
            markupPercent={markupPercent} setMarkupPercent={setMarkupPercent}
            ladoAbertura={ladoAbertura} setLadoAbertura={setLadoAbertura}
            sentidoAbertura={sentidoAbertura} setSentidoAbertura={setSentidoAbertura}
            tipoPuxador={tipoPuxador} setTipoPuxador={setTipoPuxador}
            corAluminio={corAluminio} setCorAluminio={setCorAluminio}
            custoFrete={custoFrete} setCustoFrete={setCustoFrete}
            perfisSelecionados={perfisSelecionados} setPerfisSelecionados={setPerfisSelecionados}
            previewOpen={previewOpen} setPreviewOpen={setPreviewOpen}
            viewMode3D={viewMode3D} setViewMode3D={setViewMode3D}
            copilotOpen={copilotOpen} setCopilotOpen={setCopilotOpen}
            cenarioFundo={cenarioFundo} setCenarioFundo={setCenarioFundo}
            anguloCorte={anguloCorte} setAnguloCorte={setAnguloCorte}
            showPerfilSelector={showPerfilSelector} setShowPerfilSelector={setShowPerfilSelector}
            searchPerfilQuery={searchPerfilQuery} setSearchPerfilQuery={setSearchPerfilQuery}
            clienteNome={clienteNome} setClienteNome={setClienteNome}
            clienteTelefone={clienteTelefone} setClienteTelefone={setClienteTelefone}
            clienteEndereco={clienteEndereco} setClienteEndereco={setClienteEndereco}
            clienteCep={clienteCep} setClienteCep={setClienteCep}
            dataInstalacao={dataInstalacao} setDataInstalacao={setDataInstalacao}
            vidraceiro={vidraceiro} setVidraceiro={setVidraceiro}
            observacoes={observacoes} setObservacoes={setObservacoes}
            
            dbVidros={dbVidros}
            dbCores={dbCores}
            dbKits={dbKits}
            dbAcessorios={dbAcessorios}
            dbModelos={dbModelos}
            dbLinhas={dbLinhas}
            dbClientes={dbClientes}
            pedidos={pedidos}
            alertaSeguranca={alertaSeguranca}
            handleCreateOS={handleCreateOS}
            handleCepLookup={handleCepLookup}
            aplicarFolgasPadrao={aplicarFolgasPadrao}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            onSendToOtimizer={handleSendToOtimizer}
          />
        )}

        {/* --- ABA 3: PLANO DE CORTE / OTIMIZADOR --- */}
        {activeTab === 'otimizador' && (
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-4 sm:p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 text-left">
              <div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight">Otimizador de Plano de Corte 2D</h2>
                <p className="text-xs text-slate-300 font-semibold mt-1">
                  Minimize o desperdício de chapas de vidro organizando os cortes das peças de forma inteligente.
                </p>
              </div>
            </div>
            
            <PlanoCorteOptimizer
              defaultChapaW={3210}
              defaultChapaH={2200}
              tipoInsumo="vidro"
              initialPecas={otimizerPecas.length > 0 ? otimizerPecas : [
                { id: 1, largura: larguraVidro || 1200, altura: alturaVidro || 1900, qtd: 1, label: modeloNomeCompleto || 'Box Fixo' }
              ]}
              pedidosPendentes={pedidos.filter(p => p.status === 'orcamento' || p.status === 'medicao')}
            />
          </div>
        )}

        {/* --- ABA 4: KANBAN GESTÃO DE OS --- */}
        {activeTab === 'kanban' && (
          <KanbanTab
            pedidos={pedidos}
            setSelectedOS={setSelectedOS}
            handleUpdateStatus={handleUpdateStatus}
            STATUS_FLOW={STATUS_FLOW}
            STATUS_OS={STATUS_OS}
          />
        )}

        {/* --- ABA 5: CATÁLOGO DE MATERIAIS --- */}
        {activeTab === 'catalogo' && (
          <CatalogoTab
            dbVidros={dbVidros}
            dbCores={dbCores}
            dbKits={dbKits}
            dbAcessorios={dbAcessorios}
            dbModelos={dbModelos}
            dbLinhas={dbLinhas}
            setEditingMaterial={setEditingMaterial}
            estabId={estabId}
          />
        )}

        {/* --- ABA 6: CLIENTES --- */}
        {activeTab === 'clientes' && (
          <ClientesTab
            pedidos={pedidos}
            setSelectedOS={setSelectedOS}
            STATUS_OS={STATUS_OS}
            estabId={estabId}
            dbClientes={dbClientes}
          />
        )}

        {/* --- DRAWER IDEACOPILOT --- */}
        <IdeaCopilot
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          isMarmoraria={false}
          onApplyParameters={(params) => {
            if (params.modelo) {
              const matchModelo = dbModelos.find(m => m.tipoProjeto === params.modelo || m.nome.toLowerCase().includes(params.modeloNome?.toLowerCase()));
              if (matchModelo) {
                setModeloObjId(matchModelo.id);
                setModelo(matchModelo.tipoProjeto);
                setModeloNomeCompleto(matchModelo.nome);
                aplicarFolgasPadrao(matchModelo.tipoProjeto);
              }
            }
            if (params.largura) setLargura(params.largura);
            if (params.altura) setAltura(params.altura);
            
            if (params.corVidro) {
              const matchCor = dbCores.find(c => c.nome.toLowerCase().includes(params.corVidro.toLowerCase()));
              if (matchCor) setCorVidroId(matchCor.id);
            }
            if (params.corAluminio) {
              const inputAlum = params.corAluminio.toLowerCase();
              if (inputAlum.includes('branco')) setCorAluminio('branco');
              else if (inputAlum.includes('preto') && inputAlum.includes('anod')) setCorAluminio('preto_anod');
              else if (inputAlum.includes('preto')) setCorAluminio('preto');
              else if (inputAlum.includes('bronze')) setCorAluminio('bronze');
              else if (inputAlum.includes('dourado') || inputAlum.includes('gold')) setCorAluminio('dourado');
              else if (inputAlum.includes('rose') || inputAlum.includes('rosé')) setCorAluminio('rose');
              else if (inputAlum.includes('champagne')) setCorAluminio('champagne');
              else if (inputAlum.includes('grafite')) setCorAluminio('grafite');
              else if (inputAlum.includes('inox')) setCorAluminio('inox');
              else if (inputAlum.includes('corten')) setCorAluminio('corten');
              else if (inputAlum.includes('amadeirado') || inputAlum.includes('madeira')) setCorAluminio('amadeirado');
              else if (inputAlum.includes('brilhante') || inputAlum.includes('cromado')) setCorAluminio('brilhante');
              else setCorAluminio('fosco');
            }
            if (params.puxador) {
              const inputPux = params.puxador.toLowerCase();
              if (inputPux.includes('h simples') || inputPux.includes('simples')) setTipoPuxador('h_simples');
              else if (inputPux.includes('barra') && inputPux.includes('45')) setTipoPuxador('barra_45');
              else if (inputPux.includes('barra')) setTipoPuxador('barra');
              else if (inputPux.includes('knob') || inputPux.includes('botão') || inputPux.includes('botao')) setTipoPuxador('knob');
              else if (inputPux.includes('concha') || inputPux.includes('embutido')) setTipoPuxador('concha');
              else if (inputPux.includes('furo') || inputPux.includes('furação')) setTipoPuxador('furo');
              else if (inputPux.includes('sem')) setTipoPuxador('sem');
              else setTipoPuxador('padrao');
            }
            
            if (params.clienteNome) setClienteNome(params.clienteNome);
            if (params.clienteTelefone) setClienteTelefone(params.clienteTelefone);
            if (params.clienteEndereco) setClienteEndereco(params.clienteEndereco);
            if (params.observacoes) setObservacoes(params.observacoes);
          }}
        />

        {/* --- MODAL DETALHE OS / RECIBO --- */}
        {selectedOS && (
          <OsDetailModal
            selectedOS={selectedOS}
            setSelectedOS={setSelectedOS}
            handleDeleteOS={handleDeleteOS}
            handleUpdateStatus={handleUpdateStatus}
            STATUS_FLOW={STATUS_FLOW}
            STATUS_OS={STATUS_OS}
          />
        )}

        {/* --- MODAL EDIÇÃO MATERIAL --- */}
        {editingMaterial && (
          <EditMaterialModal
            editingMaterial={editingMaterial}
            setEditingMaterial={setEditingMaterial}
            estabId={estabId}
            dbVidros={dbVidros}
            dbCores={dbCores}
            dbKits={dbKits}
            dbAcessorios={dbAcessorios}
            dbLinhas={dbLinhas}
          />
        )}

        <ConfirmUI />

      </div>
    </div>
  );
};

export default withEstablishmentAuth(VidracariaDashboard);
