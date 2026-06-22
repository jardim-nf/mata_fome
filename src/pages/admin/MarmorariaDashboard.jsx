// src/pages/admin/MarmorariaDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import BackButton from '../../components/BackButton';
import { toast } from 'react-toastify';
import { 
  IoCalculatorOutline, 
  IoCheckmarkCircleOutline, 
  IoBuildOutline, 
  IoPersonOutline, 
  IoCalendarOutline, 
  IoTrashOutline,
  IoPrintOutline,
  IoLogoWhatsapp,
  IoSettingsOutline,
  IoAnalyticsOutline,
  IoListOutline,
  IoPersonAddOutline,
  IoCloseOutline,
  IoCreateOutline,
  IoSparklesOutline,
  IoGridOutline
} from 'react-icons/io5';
import './MarmorariaDashboard.css';
import ThreeDProjectViewer from '../../components/ThreeDProjectViewer';
import PlanoCorteOptimizer from '../../components/PlanoCorteOptimizer';
import IdeaCopilot from '../../components/IdeaCopilot';
import { useConfirmDialog } from '../../hooks/useDialogs.jsx';


// Definições padrão para Seeding (Semeadura) de Marmoraria
const DEFAULTS_MODELOS = [
  { nome: 'Bancada de Cozinha', tipoProjeto: 'cozinha', icone: '🍳' },
  { nome: 'Lavatório de Banheiro', tipoProjeto: 'banheiro', icone: '🚰' },
  { nome: 'Soleira de Porta', tipoProjeto: 'soleira', icone: '🚪' },
  { nome: 'Peitoril de Janela', tipoProjeto: 'peitoril', icone: '🪟' },
  { nome: 'Ilha Gourmet', tipoProjeto: 'ilha', icone: '🍽️' }
];

const DEFAULTS_PEDRAS = [
  { nome: 'Granito Preto São Gabriel', custoM2: 380 },
  { nome: 'Granito Verde Ubatuba', custoM2: 280 },
  { nome: 'Granito Cinza Corumbá', custoM2: 240 },
  { nome: 'Mármore Branco Carrara', custoM2: 980 },
  { nome: 'Mármore Travertino Nacional', custoM2: 650 },
  { nome: 'Quartzo Branco Estelar', custoM2: 1200 },
  { nome: 'Quartzo Cinza Absoluto', custoM2: 1100 }
];

const DEFAULTS_ACABAMENTOS = [
  { nome: 'Reto Lapidado', custo: 40 },
  { nome: 'Meia Esquadria (Ingletado)', custo: 120 },
  { nome: 'Boleado Simples', custo: 60 },
  { nome: 'Boleado Duplo', custo: 90 },
  { nome: 'Biselado', custo: 50 }
];

const DEFAULTS_SERVICOS = [
  { nome: 'Recorte Cuba de Embutir', custo: 150 },
  { nome: 'Recorte Cuba de Sobrepor', custo: 120 },
  { nome: 'Recorte Cooktop', custo: 180 },
  { nome: 'Cuba Esculpida na Pedra (Mão de Obra)', custo: 800 },
  { nome: 'Furo de Torneira / Filtro', custo: 50 },
  { nome: 'Polimento Adicional', custo: 100 }
];

const STATUS_FLOW = ['orcamento', 'medicao', 'producao', 'instalacao', 'concluido'];

const STATUS_OS = {
  orcamento: { label: 'Orçamento', color: 'bg-amber-50 text-amber-700 border-amber-200', borderCol: 'border-l-amber-500' },
  medicao: { label: 'Medição', color: 'bg-slate-100 text-slate-800 border-slate-300', borderCol: 'border-l-slate-600' },
  producao: { label: 'Produção', color: 'bg-purple-50 text-purple-700 border-purple-200', borderCol: 'border-l-purple-500' },
  instalacao: { label: 'Instalação', color: 'bg-orange-50 text-orange-700 border-orange-200', borderCol: 'border-l-orange-500' },
  concluido: { label: 'Concluído', color: 'bg-green-50 text-green-700 border-green-200', borderCol: 'border-l-emerald-500' }
};

const MarmorariaDashboard = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;
  const [confirm, ConfirmUI] = useConfirmDialog();

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, calculadora, kanban, catalogo, clientes

  // Dados do Firestore
  const [pedidos, setPedidos] = useState([]);
  const [clientesBase, setClientesBase] = useState([]);
  const [dbPedras, setDbPedras] = useState([]);
  const [dbAcabamentos, setDbAcabamentos] = useState([]);
  const [dbServicos, setDbServicos] = useState([]);
  const [dbModelos, setDbModelos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados da Calculadora
  const [modelo, setModelo] = useState('cozinha'); // cozinha, banheiro, soleira, peitoril, ilha
  const [modeloObjId, setModeloObjId] = useState('Bancada de Cozinha');
  const [modeloNomeCompleto, setModeloNomeCompleto] = useState('Bancada de Cozinha');
  const [largura, setLargura] = useState(1500); // em mm
  const [profundidade, setProfundidade] = useState(600); // em mm
  
  // Saia e Rodopia
  const [saiaAtiva, setSaiaAtiva] = useState(true);
  const [alturaSaia, setAlturaSaia] = useState(40); // em mm
  const [rodopiaAtivo, setRodopiaAtivo] = useState(true);
  const [alturaRodopia, setAlturaRodopia] = useState(100); // em mm

  // Acabamento Bordas (check list)
  const [bordaFrontal, setBordaFrontal] = useState(true);
  const [bordaEsquerda, setBordaEsquerda] = useState(true);
  const [bordaDireita, setBordaDireita] = useState(true);

  // Materiais Selecionados
  const [pedraId, setPedraId] = useState('Granito Preto São Gabriel');
  const [acabamentoId, setAcabamentoId] = useState('Reto Lapidado');
  
  // Cubas e Serviços Selecionados (Array de IDs)
  const [servicosSelecionados, setServicosSelecionados] = useState([]);

  // Financeiro
  const [custoMaoObra, setCustoMaoObra] = useState(200);
  const [markupPercent, setMarkupPercent] = useState(50);
  const [fatorPerda, setFatorPerda] = useState(20); // 20% de perda padrão
  const [areaMinima, setAreaMinima] = useState(0.5); // 0.5m² de cobrança mínima
  const [comprimentoL, setComprimentoL] = useState(800); // em mm (extensão para canto L ou U)
  const [tipoPrecificacao, setTipoPrecificacao] = useState('markup'); // 'markup' ou 'margem'
  const [posicaoCuba, setPosicaoCuba] = useState('centro'); // esquerda, centro, direita
  const [posicaoCooktop, setPosicaoCooktop] = useState('direita'); // esquerda, centro, direita
  const [corCooktop, setCorCooktop] = useState('preto'); // preto, inox, branco

  // Form de OS/Cliente
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [clienteCep, setClienteCep] = useState('');
  const [dataInstalacao, setDataInstalacao] = useState('');
  const [marmorista, setMarmorista] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [viewMode3D, setViewMode3D] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [cenarioFundo, setCenarioFundo] = useState('banheiro_premium');
  const [formatoBancada, setFormatoBancada] = useState('reto');
  const [tipoCuba, setTipoCuba] = useState('inox');
  const [gabineteArmario, setGabineteArmario] = useState('charcoal');
  const [tipoTorneira, setTipoTorneira] = useState('gourmet');
  const [temCooktop, setTemCooktop] = useState(false);


  // Form de Catálogo (CRUD)
  const [newPedraNome, setNewPedraNome] = useState('');
  const [newPedraCusto, setNewPedraCusto] = useState('');
  const [newAcabNome, setNewAcabNome] = useState('');
  const [newAcabCusto, setNewAcabCusto] = useState('');
  const [newServNome, setNewServNome] = useState('');
  const [newServCusto, setNewServCusto] = useState('');
  const [newModeloNome, setNewModeloNome] = useState('');
  const [newModeloTipo, setNewModeloTipo] = useState('cozinha');
  const [newModeloIcone, setNewModeloIcone] = useState('🍳');

  // Modal de Detalhes da OS
  const [selectedOS, setSelectedOS] = useState(null);

  // Estado para Edição de Materiais
  const [editingMaterial, setEditingMaterial] = useState(null); // { id, tipo: 'pedra'|'acabamento'|'servico'|'modelo', nome, custo, tipoProjeto, icone }

  // Buscas Individuais
  const [searchClienteQuery, setSearchClienteQuery] = useState('');
  const [searchPedrasQuery, setSearchPedrasQuery] = useState('');
  const [searchAcabamentosQuery, setSearchAcabamentosQuery] = useState('');
  const [searchServicosQuery, setSearchServicosQuery] = useState('');
  const [searchModelosQuery, setSearchModelosQuery] = useState('');

  const seedingRef = useRef({ pedras: false, acabamentos: false, servicos: false, modelos: false });

  // --- ESCUTAS FIRESTORE E SEEDING ---
  useEffect(() => {
    if (!estabId) return;

    // 1. Escuta Marmoraria Pedras (marmorariaVidros)
    const unsubPedras = onSnapshot(collection(db, 'estabelecimentos', estabId, 'marmorariaVidros'), async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbPedras(list);

      if (!seedingRef.current.pedras) {
        seedingRef.current.pedras = true;
        try {
          for (const item of DEFAULTS_PEDRAS) {
            const exists = list.some(p => String(p.nome).toLowerCase() === String(item.nome).toLowerCase());
            if (!exists) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaVidros'), {
                ...item,
                ativo: true,
                criadoEm: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    // 2. Escuta Marmoraria Acabamentos (marmorariaCores)
    const unsubAcabamentos = onSnapshot(collection(db, 'estabelecimentos', estabId, 'marmorariaCores'), async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbAcabamentos(list);

      if (!seedingRef.current.acabamentos) {
        seedingRef.current.acabamentos = true;
        try {
          for (const item of DEFAULTS_ACABAMENTOS) {
            const exists = list.some(a => String(a.nome).toLowerCase() === String(item.nome).toLowerCase());
            if (!exists) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaCores'), {
                ...item,
                ativo: true,
                criadoEm: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    // 3. Escuta Marmoraria Serviços (marmorariaKits)
    const unsubServicos = onSnapshot(collection(db, 'estabelecimentos', estabId, 'marmorariaKits'), async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbServicos(list);

      if (!seedingRef.current.servicos) {
        seedingRef.current.servicos = true;
        try {
          for (const item of DEFAULTS_SERVICOS) {
            const exists = list.some(s => String(s.nome).toLowerCase() === String(item.nome).toLowerCase());
            if (!exists) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaKits'), {
                ...item,
                ativo: true,
                criadoEm: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    // 4. Escuta Marmoraria Modelos (marmorariaModelos)
    const unsubModelos = onSnapshot(collection(db, 'estabelecimentos', estabId, 'marmorariaModelos'), async (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDbModelos(list);

      if (!seedingRef.current.modelos) {
        seedingRef.current.modelos = true;
        try {
          for (const item of DEFAULTS_MODELOS) {
            const exists = list.some(m => String(m.nome).toLowerCase() === String(item.nome).toLowerCase());
            if (!exists) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaModelos'), {
                ...item,
                ativo: true,
                criadoEm: new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.error(err);
        }
      }
    });

    // 5. Escuta Marmoraria OS (marmorariaOrdensServico)
    const unsubOS = onSnapshot(collection(db, 'estabelecimentos', estabId, 'marmorariaOrdensServico'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const dateA = a.criadoEm ? new Date(a.criadoEm) : new Date(0);
        const dateB = b.criadoEm ? new Date(b.criadoEm) : new Date(0);
        return dateB - dateA;
      });
      setPedidos(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    // 6. Escuta Clientes
    const unsubClientes = onSnapshot(collection(db, 'estabelecimentos', estabId, 'clientes'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClientesBase(list);
    }, (err) => {
      console.error("Erro ao escutar clientes:", err);
    });

    return () => {
      unsubPedras();
      unsubAcabamentos();
      unsubServicos();
      unsubModelos();
      unsubOS();
      unsubClientes();
    };
  }, [estabId]);

  // Set selections iniciais
  useEffect(() => {
    if (dbPedras.length > 0 && (pedraId === '' || pedraId === 'Granito Preto São Gabriel')) {
      const exists = dbPedras.some(p => p.nome === pedraId);
      if (!exists) {
        setPedraId(dbPedras[0].nome);
      }
    }
    if (dbAcabamentos.length > 0 && (acabamentoId === '' || acabamentoId === 'Reto Lapidado')) {
      const exists = dbAcabamentos.some(a => a.nome === acabamentoId);
      if (!exists) {
        setAcabamentoId(dbAcabamentos[0].nome);
      }
    }
    if (dbModelos.length > 0 && (modeloObjId === '' || modeloObjId === 'Bancada de Cozinha')) {
      const exists = dbModelos.some(m => m.nome === modeloObjId);
      if (!exists) {
        const first = dbModelos[0];
        setModeloObjId(first.nome);
        setModelo(first.tipoProjeto || 'cozinha');
        setModeloNomeCompleto(first.nome);
      }
    }
  }, [dbPedras, dbAcabamentos, dbModelos]);

  // --- MEMÓRIA DE CÁLCULO TÉCNICO ---
  const selectedPedra = dbPedras.find(p => p.nome === pedraId || p.id === pedraId) || DEFAULTS_PEDRAS.find(p => p.nome === pedraId) || dbPedras[0] || DEFAULTS_PEDRAS[0];
  const selectedAcabamento = dbAcabamentos.find(a => a.nome === acabamentoId || a.id === acabamentoId) || DEFAULTS_ACABAMENTOS.find(a => a.nome === acabamentoId) || dbAcabamentos[0] || DEFAULTS_ACABAMENTOS[0];

  const wMm = Number(largura) || 0;
  const dMm = Number(profundidade) || 0;
  const sMm = saiaAtiva ? (Number(alturaSaia) || 0) : 0;
  const rMm = rodopiaAtivo ? (Number(alturaRodopia) || 0) : 0;

  // Áreas em m²
  const isL_Esq = formatoBancada === 'L-esq' || formatoBancada === 'L';
  const isL_Dir = formatoBancada === 'L-dir';
  const isU = formatoBancada === 'U';
  const extDmm = Number(comprimentoL) || 800;

  const areaTampo = ((wMm * dMm) + ((isL_Esq || isL_Dir) ? (extDmm * dMm) : isU ? (2 * extDmm * dMm) : 0)) / 1000000;
  const areaSaia = ((wMm * sMm) + ((isL_Esq || isL_Dir) ? (extDmm * sMm) : isU ? (2 * extDmm * sMm) : 0)) / 1000000;
  const areaRodopia = ((wMm * rMm) + ((isL_Esq || isL_Dir) ? ((dMm + extDmm) * rMm) : isU ? (2 * (dMm + extDmm) * rMm) : 0)) / 1000000;
  
  const areaTotalPedraSemPerda = areaTampo + areaSaia + areaRodopia;
  const areaTotalPedraComPerda = areaTotalPedraSemPerda * (1 + Number(fatorPerda) / 100);
  const areaTotalPedra = Math.max(Number(areaMinima) || 0, areaTotalPedraComPerda);

  // Coordenadas 2D para blueprint de cuba e cooktop no SVG
  const startX2D = isL_Esq || isU ? dMm : 0;
  const endX2D = isL_Dir || isU ? wMm - dMm : wMm;
  const usableW2D = endX2D - startX2D;

  let sinkX2D = startX2D + usableW2D * 0.5;
  if (posicaoCuba === 'esquerda') {
    sinkX2D = startX2D + Math.max(250, usableW2D * 0.25);
  } else if (posicaoCuba === 'direita') {
    sinkX2D = startX2D + Math.min(usableW2D - 250, usableW2D * 0.75);
  }

  // Se ambos estiverem no centro, divide o espaço simetricamente em 2D
  if (tipoCuba !== 'nenhuma' && temCooktop && posicaoCuba === 'centro' && posicaoCooktop === 'centro') {
    sinkX2D = startX2D + usableW2D * 0.5 - 300;
  }

  let cookX2D = startX2D + usableW2D * 0.75;
  if (posicaoCooktop === 'esquerda') {
    cookX2D = startX2D + Math.max(280, usableW2D * 0.25);
  } else if (posicaoCooktop === 'centro') {
    cookX2D = startX2D + usableW2D * 0.5;
  } else if (posicaoCooktop === 'direita') {
    cookX2D = startX2D + Math.min(usableW2D - 280, usableW2D * 0.75);
  }

  // Se ambos estiverem no centro, divide o espaço simetricamente em 2D
  if (tipoCuba !== 'nenhuma' && posicaoCuba === 'centro' && posicaoCooktop === 'centro') {
    cookX2D = startX2D + usableW2D * 0.5 + 300;
  } else {
    // Auto-adjust se eles sobrepuserem em 2D (distância mínima de 580mm)
    if (tipoCuba !== 'nenhuma' && Math.abs(cookX2D - sinkX2D) < 580) {
      if (cookX2D >= sinkX2D) {
        cookX2D = Math.min(endX2D - 280, sinkX2D + 580);
      } else {
        cookX2D = Math.max(startX2D + 280, sinkX2D - 580);
      }
    }
  }

  // Acabamento linear (ML)
  let acabamentoTotalML = 0;
  if (!isL_Esq && !isL_Dir && !isU) {
    if (bordaFrontal) acabamentoTotalML += wMm;
    if (bordaEsquerda) acabamentoTotalML += dMm;
    if (bordaDireita) acabamentoTotalML += dMm;
  } else if (isL_Esq) {
    acabamentoTotalML += wMm + extDmm;
    if (bordaDireita) acabamentoTotalML += dMm;
  } else if (isL_Dir) {
    acabamentoTotalML += wMm + extDmm;
    if (bordaEsquerda) acabamentoTotalML += dMm;
  } else if (isU) {
    acabamentoTotalML += wMm + 2 * extDmm;
  }
  acabamentoTotalML = acabamentoTotalML / 1000; // converter de mm para metros

  // Serviços e Cubas
  const cubasServicosItens = dbServicos.filter(s => servicosSelecionados.includes(s.id));
  const totalServicosCusto = cubasServicosItens.reduce((sum, item) => sum + (Number(item.custo) || 0), 0);

  // Precificação
  const valorPedraTotal = areaTotalPedra * (Number(selectedPedra?.custoM2) || 0);
  const valorAcabamentoTotal = acabamentoTotalML * (Number(selectedAcabamento?.custo) || 0);

  const custoTotal = valorPedraTotal + valorAcabamentoTotal + totalServicosCusto + Number(custoMaoObra);
  const precoVenda = tipoPrecificacao === 'margem'
    ? custoTotal / (1 - Math.min(99, Number(markupPercent) || 0) / 100)
    : custoTotal * (1 + Number(markupPercent) / 100);

  // Aproveitamento de Chapa 2D
  // Chapa Comercial: 2800x1600mm
  const chapaW = 2800;
  const chapaH = 1600;
  const areaChapa = (chapaW * chapaH) / 1000000; // 4.48 m²
  const aproveitamentoPct = Math.min(100, (areaTotalPedra / areaChapa) * 100);

  // Verificar se cabe na chapa
  // Altura total das peças empilhadas: Profundidade + Saia + Rodopia
  const totalAlturaPecas = dMm + sMm + rMm + ((isL_Esq || isL_Dir) ? extDmm : isU ? (2 * extDmm) : 0);
  const limiteExcedido = wMm > chapaW || totalAlturaPecas > chapaH;

  const extraOffset = (isL_Esq || isL_Dir) ? extDmm : isU ? (2 * extDmm) : 0;
  const saiaY2D = 50 + dMm + extraOffset;
  const rodopiaY2D = 50 + dMm + extraOffset + sMm;

  // Sugestões de Autocomplete Cliente
  const querySug = clienteNome.trim().toLowerCase();
  const suggestions = querySug.length >= 2 && showSuggestions
    ? Array.from(new Set(pedidos.map(p => p.cliente.nome)))
        .map(nome => {
          const osList = pedidos.filter(p => p.cliente.nome === nome);
          return {
            nome,
            telefone: osList[0]?.cliente.telefone || '',
            endereco: osList[0]?.cliente.endereco || ''
          };
        })
        .filter(c => c.nome.toLowerCase().includes(querySug))
        .slice(0, 5)
    : [];

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
          toast.success('📍 CEP localizado com sucesso!');
        } else {
          toast.error('CEP não localizado.');
        }
      } catch (err) {
        console.error('Erro ao consultar CEP:', err);
      }
    }
  };

  // Toggle Serviços
  const handleToggleServico = (id) => {
    if (servicosSelecionados.includes(id)) {
      setServicosSelecionados(servicosSelecionados.filter(item => item !== id));
    } else {
      setServicosSelecionados([...servicosSelecionados, id]);
    }
  };

  // Criar Ordem de Serviço
  const handleCreateOS = async (e) => {
    e.preventDefault();
    if (!clienteNome) return toast.warn('Nome do cliente é obrigatório!');
    if (!estabId) return;

    try {
      const payload = {
        cliente: {
          nome: clienteNome,
          telefone: clienteTelefone,
          endereco: clienteEndereco,
          cep: clienteCep
        },
        projeto: {
          modelo: modeloNomeCompleto,
          tipoProjeto: modelo,
          largura: Number(largura),
          profundidade: Number(profundidade),
          saiaAtiva,
          alturaSaia: Number(alturaSaia),
          rodopiaAtivo,
          alturaRodopia: Number(alturaRodopia),
          bordaFrontal,
          bordaEsquerda,
          bordaDireita,
          pedra: selectedPedra?.nome || 'Não selecionada',
          custoPedraM2: Number(selectedPedra?.custoM2) || 0,
          acabamento: selectedAcabamento?.nome || 'Não selecionado',
          custoAcabamentoML: Number(selectedAcabamento?.custo) || 0,
          acabamentoTotalML,
          areaTampo,
          areaSaia,
          areaRodopia,
          areaTotalPedraSemPerda,
          fatorPerda: Number(fatorPerda),
          areaMinima: Number(areaMinima),
          comprimentoL: Number(comprimentoL),
          tipoPrecificacao,
          areaTotalPedra,
          cubasServicos: cubasServicosItens.map(s => ({ nome: s.nome, custo: s.custo })),
          custoMaoObra: Number(custoMaoObra),
          markup: Number(markupPercent),
          custoTotal,
          precoVenda,
          cenarioFundo,
           formatoBancada,
          tipoCuba,
          posicaoCuba,
          gabineteArmario,
          tipoTorneira,
          temCooktop,
          posicaoCooktop,
          corCooktop
        },
        instalacao: {
          data: dataInstalacao || null,
          marmorista: marmorista || 'Não designado'
        },
        status: 'orcamento',
        observacoes,
        modulo: 'marmoraria',
        criadoEm: new Date().toISOString()
      };

      await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaOrdensServico'), payload);
      toast.success('✅ Orçamento / OS de marmoraria gravada com sucesso!');

      // Limpar campos
      setClienteNome('');
      setClienteTelefone('');
      setClienteEndereco('');
      setClienteCep('');
      setDataInstalacao('');
      setMarmorista('');
      setObservacoes('');
      setServicosSelecionados([]);
      setActiveTab('kanban');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar no Firestore.');
    }
  };

  // Mudar Status da OS
  const handleUpdateStatus = async (id, nextStatus) => {
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId, 'marmorariaOrdensServico', id), {
        status: nextStatus
      });
      toast.success('Status atualizado!');
    } catch (err) {
      console.error(err);
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
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'marmorariaOrdensServico', id));
      toast.success('OS excluída com sucesso!');
      if (selectedOS?.id === id) setSelectedOS(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir OS.');
    }
  };

  // CRUD Material Actions
  const handleAddPedra = async (e) => {
    e.preventDefault();
    if (!newPedraNome || !newPedraCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaVidros'), {
        nome: newPedraNome,
        custoM2: Number(newPedraCusto),
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      setNewPedraNome('');
      setNewPedraCusto('');
      toast.success('Pedra cadastrada!');
    } catch (err) { console.error(err); }
  };

  const handleAddAcabamento = async (e) => {
    e.preventDefault();
    if (!newAcabNome || !newAcabCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaCores'), {
        nome: newAcabNome,
        custo: Number(newAcabCusto),
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      setNewAcabNome('');
      setNewAcabCusto('');
      toast.success('Acabamento cadastrado!');
    } catch (err) { console.error(err); }
  };

  const handleAddServico = async (e) => {
    e.preventDefault();
    if (!newServNome || !newServCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaKits'), {
        nome: newServNome,
        custo: Number(newServCusto),
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      setNewServNome('');
      setNewServCusto('');
      toast.success('Serviço/Recorte cadastrado!');
    } catch (err) { console.error(err); }
  };

  const handleAddModelo = async (e) => {
    e.preventDefault();
    if (!newModeloNome) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'marmorariaModelos'), {
        nome: newModeloNome,
        tipoProjeto: newModeloTipo,
        icone: newModeloIcone,
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      setNewModeloNome('');
      toast.success('Modelo de projeto cadastrado!');
    } catch (err) { console.error(err); }
  };

  const handleDeleteItem = async (colName, id) => {
    const ok = await confirm("Excluir item do catálogo?", {
      title: 'Excluir Item',
      variant: 'warning',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, colName, id));
      toast.success('Item excluído!');
    } catch (err) { console.error(err); }
  };

  const handleUpdateMaterial = async (e) => {
    e.preventDefault();
    if (!editingMaterial) return;

    try {
      let colName = '';
      const updates = { nome: editingMaterial.nome };

      if (editingMaterial.tipo === 'pedra') {
        colName = 'marmorariaVidros';
        updates.custoM2 = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'acabamento') {
        colName = 'marmorariaCores';
        updates.custo = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'servico') {
        colName = 'marmorariaKits';
        updates.custo = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'modelo') {
        colName = 'marmorariaModelos';
        updates.tipoProjeto = editingMaterial.tipoProjeto;
        updates.icone = editingMaterial.icone;
      }

      await updateDoc(doc(db, 'estabelecimentos', estabId, colName, editingMaterial.id), updates);
      toast.success('Item atualizado com sucesso!');
      setEditingMaterial(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar material.');
    }
  };

  // Compartilhamento Whatsapp
  const shareWhatsApp = (os) => {
    const w = (os.projeto.largura / 1000).toFixed(2);
    const d = (os.projeto.profundidade / 1000).toFixed(2);
    const msg = `Olá *${os.cliente.nome}*,\n\nSegue o orçamento do seu projeto de marmoraria:\n\n` +
      `📐 *Modelo:* ${os.projeto.modelo.toUpperCase()}\n` +
      `📏 *Medidas:* ${w}m x ${d}m (${os.projeto.areaTotalPedra.toFixed(2)} m² de chapa)\n` +
      `🪨 *Pedra/Rocha:* ${os.projeto.pedra}\n` +
      `✨ *Acabamento Borda:* ${os.projeto.acabamento} (${os.projeto.acabamentoTotalML.toFixed(2)} m.l.)\n` +
      (os.projeto.saiaAtiva ? `📏 *Saia Frontal:* ${os.projeto.alturaSaia} mm\n` : '') +
      (os.projeto.rodopiaAtivo ? `🧱 *Rodopia/Wall:* ${os.projeto.alturaRodopia} mm\n` : '') +
      (os.projeto.cubasServicos.length > 0 ? `🛠️ *Adicionais:* ${os.projeto.cubasServicos.map(s => s.nome).join(', ')}\n` : '') +
      `💵 *Valor Estimado:* R$ ${os.projeto.precoVenda.toFixed(2)}\n\n` +
      `Ficamos à disposição para agendar a medição final!`;

    const url = `https://api.whatsapp.com/send?phone=55${os.cliente.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // KPIs Dashboard
  const orcamentosAtivos = pedidos.filter(p => p.status === 'orcamento').length;
  const totalFaturadoVal = pedidos.filter(p => p.status === 'concluido').reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
  const totalM2Instalado = pedidos.filter(p => p.status === 'concluido').reduce((s, p) => s + (p.projeto?.areaTotalPedra || 0), 0);
  const totalOSAtivas = pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').length;

  return (
    <div className="marmoraria-body min-h-screen p-4 sm:p-6 pb-20 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto w-full">
        
        {/* Header Superior */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div>
              <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <span className="stone-logo-icon">🪨</span> IdeaMarmore
              </h1>
              <p className="text-xs text-slate-500 font-semibold tracking-wide">Plataforma Avançada de Gestão de Pedras, Chapas e Projetos 2D</p>
            </div>
          </div>

          {/* Abas */}
          <div className="flex flex-nowrap overflow-x-auto gap-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-md max-w-full scrollbar-none shrink-0">
            {[
              { id: 'dashboard', label: 'Painel', icon: <IoAnalyticsOutline size={14} /> },
              { id: 'calculadora', label: 'Calculadora 3D', icon: <IoCalculatorOutline size={14} /> },
              { id: 'otimizador', label: 'Plano de Corte', icon: <IoGridOutline size={14} /> },
              { id: 'kanban', label: 'Projetos (OS)', icon: <IoBuildOutline size={14} /> },
              { id: 'catalogo', label: 'Insumos', icon: <IoListOutline size={14} /> },
              { id: 'clientes', label: 'Clientes', icon: <IoPersonOutline size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-slate-900 to-black text-white shadow-md shadow-slate-950/20 scale-[1.02]' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/40'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* --- ABA DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-amber-500">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Orçamentos Ativos</p>
                  <h3 className="text-3xl font-black mt-1 text-amber-600">{orcamentosAtivos}</h3>
                </div>
                <IoCalculatorOutline size={32} className="text-amber-600/70" />
              </div>

              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-slate-700">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">OS em Execução</p>
                  <h3 className="text-3xl font-black mt-1 text-slate-900">{totalOSAtivas}</h3>
                </div>
                <IoBuildOutline size={32} className="text-slate-800/70" />
              </div>

              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pedra Instalada</p>
                  <h3 className="text-3xl font-black mt-1 text-emerald-600">{totalM2Instalado.toFixed(2)} m²</h3>
                </div>
                <span className="text-3xl">📐</span>
              </div>

              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-purple-500">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Faturamento Finalizado</p>
                  <h3 className="text-3xl font-black mt-1 text-purple-600">R$ {totalFaturadoVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <IoAnalyticsOutline size={32} className="text-purple-600/70" />
              </div>
            </div>

            {/* Agendas & Demandas */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="glass-card lg:col-span-8 p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-2.5 flex items-center gap-2">
                  <IoCalendarOutline /> Medições & Instalações Agendadas
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">
                        <th className="py-2.5">Cliente</th>
                        <th className="py-2.5">Projeto</th>
                        <th className="py-2.5">Rocha / Pedra</th>
                        <th className="py-2.5">Marmorista</th>
                        <th className="py-2.5">Data Agendada</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').map(os => (
                        <tr key={os.id}>
                          <td className="py-3 font-bold text-slate-800">{os.cliente.nome}</td>
                          <td className="py-3">
                            <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-black uppercase text-slate-800">
                              {os.projeto.modelo}
                            </span>
                          </td>
                          <td className="py-3 text-slate-600 font-semibold">{os.projeto.pedra}</td>
                          <td className="py-3 text-slate-600">{os.instalacao.marmorista}</td>
                          <td className="py-3 font-mono text-slate-900 font-bold">
                            {os.instalacao.data ? new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR') : 'A agendar'}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${STATUS_OS[os.status]?.color || 'bg-slate-100'}`}>
                              {STATUS_OS[os.status]?.label}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-6 text-center text-slate-500 font-medium">Nenhum serviço agendado ativamente.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Demandas */}
              <div className="glass-card lg:col-span-4 p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-2.5 flex items-center gap-2">
                  <IoAnalyticsOutline /> Métricas de Demanda
                </h3>
                <div className="space-y-4">
                  {['cozinha', 'banheiro', 'soleira', 'peitoril', 'ilha'].map(m => {
                    const count = pedidos.filter(p => p.projeto?.tipoProjeto === m).length;
                    const pct = pedidos.length ? (count / pedidos.length) * 100 : 0;
                    return (
                      <div key={m} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span className="capitalize">{m === 'cozinha' ? 'Bancadas de Cozinha' : m === 'banheiro' ? 'Lavatórios' : m === 'soleira' ? 'Soleiras' : m === 'peitoril' ? 'Peitoris' : 'Ilha Gourmet'}</span>
                          <span className="font-mono text-slate-800">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-800 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- ABA CALCULADORA --- */}
        {activeTab === 'calculadora' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Form de Configurações Técnicas */}
            <div className="glass-card p-6 lg:col-span-4 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
                    <IoCalculatorOutline className="text-slate-800" /> Parâmetros Técnicos
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Configure as dimensões brutas da pedra</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCopilotOpen(true)}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1 transition-all"
                >
                  <IoSparklesOutline className="text-amber-300 animate-pulse" />
                  Copilot 🤖
                </button>
              </div>

              {/* Modelos Rápidos */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Modelo de Bancada</label>
                <div className="grid grid-cols-5 gap-1">
                  {(dbModelos.length > 0 ? dbModelos : DEFAULTS_MODELOS).map(item => (
                    <button
                      key={item.id || item.nome}
                      type="button"
                      onClick={() => {
                        setModeloObjId(item.nome);
                        setModelo(item.tipoProjeto || 'cozinha');
                        setModeloNomeCompleto(item.nome);
                      }}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center ${
                        modeloObjId === item.nome 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg mb-1">{item.icone || '🪨'}</span>
                      <span className="text-[8px] font-black uppercase tracking-tight truncate w-full">{item.nome}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Formato da Bancada */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Formato da Bancada</label>
                <select
                  value={formatoBancada}
                  onChange={e => setFormatoBancada(e.target.value)}
                  className="glass-input w-full font-bold text-xs"
                >
                  <option value="reto">Reto (Linear)</option>
                  <option value="L-esq">Em L (Canto Esquerdo)</option>
                  <option value="L-dir">Em L (Canto Direito)</option>
                  <option value="U">Em U</option>
                </select>
              </div>

              {/* Cuba / Pia */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Tipo de Cuba/Pia</label>
                  <select
                    value={tipoCuba}
                    onChange={e => setTipoCuba(e.target.value)}
                    className="glass-input w-full font-bold text-xs"
                  >
                    <option value="nenhuma">Sem Cuba/Pia</option>
                    <option value="inox">Cuba de Inox (Aço Inox)</option>
                    <option value="louca">Cuba de Louça Branca</option>
                    <option value="esculpida">Cuba Esculpida na Pedra</option>
                  </select>
                </div>
                {tipoCuba !== 'nenhuma' && (
                  <div className="space-y-1 pl-3 border-l-2 border-slate-200">
                    <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">Posição da Cuba</label>
                    <select
                      value={posicaoCuba}
                      onChange={e => setPosicaoCuba(e.target.value)}
                      className="glass-input w-full font-bold text-xs"
                    >
                      <option value="esquerda">Lado Esquerdo</option>
                      <option value="centro">No Centro (Meio)</option>
                      <option value="direita">Lado Direito</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Gabinete / Armário */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Gabinete / Armário</label>
                <select
                  value={gabineteArmario}
                  onChange={e => setGabineteArmario(e.target.value)}
                  className="glass-input w-full font-bold text-xs"
                >
                  <option value="nenhum">Sem Armário (Suspenso)</option>
                  <option value="charcoal">MDF Grafite Escuro</option>
                  <option value="branco">MDF Branco Liso</option>
                  <option value="madeira">MDF Amadeirado Rústico</option>
                </select>
              </div>

              {/* Torneira */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Tipo de Torneira</label>
                <select
                  value={tipoTorneira}
                  onChange={e => setTipoTorneira(e.target.value)}
                  className="glass-input w-full font-bold text-xs"
                >
                  <option value="nenhuma">Sem Torneira</option>
                  <option value="gourmet">Torneira Gourmet Cromada</option>
                  <option value="dourada">Torneira Dourada Luxo</option>
                  <option value="preta">Torneira Preta Fosca</option>
                </select>
              </div>

              {/* Cooktop */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={temCooktop}
                    onChange={e => setTemCooktop(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-950 border-slate-300 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs font-black uppercase text-slate-800">Incluir Cooktop (4 bocas)</span>
                </label>
                {temCooktop && (
                  <div className="grid grid-cols-2 gap-2 pl-3 border-l-2 border-slate-200 pt-1">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">Posição Cooktop</label>
                      <select
                        value={posicaoCooktop}
                        onChange={e => setPosicaoCooktop(e.target.value)}
                        className="glass-input w-full font-bold text-xs"
                      >
                        <option value="esquerda">Esquerda</option>
                        <option value="centro">Centro (Meio)</option>
                        <option value="direita">Direita</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wide">Cor Cooktop</label>
                      <select
                        value={corCooktop}
                        onChange={e => setCorCooktop(e.target.value)}
                        className="glass-input w-full font-bold text-xs"
                      >
                        <option value="preto">Preto</option>
                        <option value="inox">Inox</option>
                        <option value="branco">Branco</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Medidas Principais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Largura (mm)</label>
                  <input
                    type="number"
                    min="1"
                    value={largura}
                    onChange={e => setLargura(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Profundidade (mm)</label>
                  <input
                    type="number"
                    min="1"
                    value={profundidade}
                    onChange={e => setProfundidade(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                  />
                </div>
              </div>

              {/* Comprimento do L / Extensão (mm) - Condicional */}
              {(isL_Esq || isL_Dir || isU) && (
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Comprimento do L / Extensão (mm)</label>
                  <input
                    type="number"
                    min="1"
                    value={comprimentoL}
                    onChange={e => setComprimentoL(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                  />
                </div>
              )}

              {/* Aproveitamento e Perdas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Fator de Perda (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={fatorPerda}
                    onChange={e => setFatorPerda(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Área Mínima (m²)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={areaMinima}
                    onChange={e => setAreaMinima(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                  />
                </div>
              </div>

              {/* Saia Opcional */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saiaAtiva}
                    onChange={e => setSaiaAtiva(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-950 border-slate-300 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs font-black uppercase text-slate-800">Saia / Acabamento Frontal (mm)</span>
                </label>
                {saiaAtiva && (
                  <input
                    type="number"
                    min="0"
                    value={alturaSaia}
                    onChange={e => setAlturaSaia(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                    placeholder="Altura da Saia em mm"
                  />
                )}
              </div>

              {/* Rodopia Opcional */}
              <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rodopiaAtivo}
                    onChange={e => setRodopiaAtivo(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-950 border-slate-300 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs font-black uppercase text-slate-800">Rodopia / Espelho Parede (mm)</span>
                </label>
                {rodopiaAtivo && (
                  <input
                    type="number"
                    min="0"
                    value={alturaRodopia}
                    onChange={e => setAlturaRodopia(Math.max(0, parseInt(e.target.value) || 0))}
                    className="glass-input w-full font-mono-val"
                    placeholder="Altura do Rodopia em mm"
                  />
                )}
              </div>

              {/* Bordas Acabamento */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Bordas com Acabamento</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={bordaFrontal}
                      onChange={e => setBordaFrontal(e.target.checked)}
                      className="rounded text-slate-900 border-slate-300"
                    />
                    Frente
                  </label>
                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={bordaEsquerda}
                      onChange={e => setBordaEsquerda(e.target.checked)}
                      className="rounded text-slate-900 border-slate-300"
                    />
                    Esq. (Lateral)
                  </label>
                  <label className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={bordaDireita}
                      onChange={e => setBordaDireita(e.target.checked)}
                      className="rounded text-slate-900 border-slate-300"
                    />
                    Dir. (Lateral)
                  </label>
                </div>
              </div>

              {/* Pedras e Acabamentos */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Selecione a Rocha / Pedra</label>
                  <select
                    value={pedraId}
                    onChange={e => setPedraId(e.target.value)}
                    className="glass-input w-full"
                  >
                    {(dbPedras.length > 0 ? dbPedras : DEFAULTS_PEDRAS).map(p => (
                      <option key={p.id || p.nome} value={p.nome}>{p.nome} - R$ {p.custoM2}/m²</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Acabamento de Borda</label>
                  <select
                    value={acabamentoId}
                    onChange={e => setAcabamentoId(e.target.value)}
                    className="glass-input w-full"
                  >
                    {(dbAcabamentos.length > 0 ? dbAcabamentos : DEFAULTS_ACABAMENTOS).map(a => (
                      <option key={a.id || a.nome} value={a.nome}>{a.nome} - R$ {a.custo}/m.l.</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Cenário de Fundo (3D)</label>
                  <select
                    value={cenarioFundo}
                    onChange={e => setCenarioFundo(e.target.value)}
                    className="glass-input w-full font-bold text-xs"
                  >
                    <option value="banheiro_premium">Cozinha Premium / Clean</option>
                    <option value="sala_tijolo">Área Gourmet (Tijolos)</option>
                    <option value="banheiro_rustico">Banheiro Rústico (Pastilhas)</option>
                    <option value="escritorio_concreto">Moderno (Concreto)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Visualizador 2D SVG e Plano de Corte */}
            <div className="lg:col-span-5 space-y-6">
              <div className="glass-card p-6 space-y-4 relative min-h-[340px]">
                <div className="flex justify-between items-start pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Visualização de Corte</h3>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Chapa de 2800 x 1600 mm</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${limiteExcedido ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-emerald-100 text-emerald-700 border border-emerald-300'}`}>
                      {limiteExcedido ? '⚠️ Excede Chapa' : '✓ Encaixa'}
                    </span>
                    {/* 2D / 3D Toggle */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 print:hidden mt-1">
                      <button
                        type="button"
                        onClick={() => setViewMode3D(false)}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${!viewMode3D ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Vista 2D
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode3D(true)}
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider transition-all ${viewMode3D ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Vista 3D
                      </button>
                    </div>
                  </div>
                </div>

                {/* Main Visualizer Area */}
                <div className="w-full flex items-center justify-center p-1">
                  {viewMode3D ? (
                    <div className="w-full h-[250px]">
                      <ThreeDProjectViewer
                        tipo="marmoraria"
                        modeloType={modelo}
                        modeloNome={modeloNomeCompleto}
                        w={wMm}
                        h={alturaRodopia || 100}
                        profundidade={dMm}
                        pedraTexture={selectedPedra?.nome || ''}
                        saiaAtiva={saiaAtiva}
                        alturaSaia={alturaSaia}
                        rodopiaAtivo={rodopiaAtivo}
                        alturaRodopia={alturaRodopia}
                        acabamento={selectedAcabamento?.nome || ''}
                        cenarioFundo={cenarioFundo}
                        formatoBancada={formatoBancada}
                        servicosSelecionados={cubasServicosItens.map(s => s.nome)}
                        tipoCuba={tipoCuba}
                        gabineteArmario={gabineteArmario}
                        tipoTorneira={tipoTorneira}
                        temCooktop={temCooktop}
                        comprimentoL={comprimentoL}
                        posicaoCuba={posicaoCuba}
                        posicaoCooktop={posicaoCooktop}
                        corCooktop={corCooktop}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[28/16]">
                      <svg 
                        viewBox="0 0 2900 1700" 
                        className="w-full h-full glass-svg-canvas"
                      >
                        {/* Linhas de Grade Técnicas */}
                        <defs>
                          <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="rgba(15, 23, 42, 0.03)" strokeWidth="1"/>
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />

                        {/* Chapa Comercial Base */}
                        <rect 
                          x="50" 
                          y="50" 
                          width="2800" 
                          height="1600" 
                          fill="rgba(15, 23, 42, 0.02)" 
                          stroke={limiteExcedido ? '#f43f5e' : '#64748b'} 
                          strokeWidth="8" 
                          strokeDasharray="15 10" 
                          rx="15"
                        />
                        
                        {/* Texto Dimensões Chapa */}
                        <text x="60" y="100" fill="#64748b" fontSize="48" fontWeight="bold" fontFamily="monospace">CHAPA COMERCIAL: 2800x1600mm</text>

                        {/* Peças Nestadas se largura e altura existirem */}
                        {wMm > 0 && dMm > 0 && (
                          <>
                            {/* 1. Tampo */}
                            <rect 
                              x="50" 
                              y="50" 
                              width={wMm} 
                              height={dMm} 
                              fill="rgba(15, 23, 42, 0.75)" 
                              stroke={limiteExcedido ? '#f43f5e' : '#10b981'} 
                              strokeWidth="6"
                              rx="5"
                            />
                            <text 
                              x={50 + wMm / 2} 
                              y={50 + dMm / 2} 
                              fill="#ffffff" 
                              fontSize="42" 
                              fontWeight="black" 
                              textAnchor="middle"
                              alignmentBaseline="middle"
                            >
                              Tampo: {wMm}x{dMm}mm
                            </text>

                            {/* Recorte de Cooktop em 2D */}
                            {temCooktop && (
                              <>
                                <rect
                                  x={50 + cookX2D - 280}
                                  y={50 + (dMm - 480) / 2}
                                  width="560"
                                  height="480"
                                  fill="rgba(239, 68, 68, 0.05)"
                                  stroke="#ef4444"
                                  strokeWidth="4"
                                  strokeDasharray="12 8"
                                  rx="6"
                                />
                                <text
                                  x={50 + cookX2D}
                                  y={50 + (dMm - 480) / 2 + 240}
                                  fill="#ef4444"
                                  fontSize="26"
                                  fontWeight="black"
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                >
                                  CORTE COOKTOP (560x480mm)
                                </text>
                              </>
                            )}

                            {/* Recorte de Cuba em 2D */}
                            {tipoCuba !== 'nenhuma' && (
                              <>
                                <rect
                                  x={50 + sinkX2D - 250}
                                  y={50 + (dMm - 400) / 2}
                                  width="500"
                                  height="400"
                                  fill="rgba(59, 130, 246, 0.05)"
                                  stroke="#3b82f6"
                                  strokeWidth="4"
                                  strokeDasharray="12 8"
                                  rx="6"
                                />
                                <text
                                  x={50 + sinkX2D}
                                  y={50 + (dMm - 400) / 2 + 200}
                                  fill="#3b82f6"
                                  fontSize="26"
                                  fontWeight="black"
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                >
                                  CORTE CUBA ({tipoCuba.toUpperCase()})
                                </text>
                              </>
                            )}
                            
                            {(isL_Esq || isU) && (
                              <>
                                <rect 
                                  x="50" 
                                  y={50 + dMm} 
                                  width={dMm} 
                                  height={extDmm} 
                                  fill="rgba(15, 23, 42, 0.65)" 
                                  stroke={limiteExcedido ? '#f43f5e' : '#10b981'} 
                                  strokeWidth="5"
                                  rx="5"
                                />
                                <text 
                                  x={50 + dMm / 2} 
                                  y={50 + dMm + extDmm / 2} 
                                  fill="#ffffff" 
                                  fontSize="38" 
                                  fontWeight="black" 
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                >
                                  Ext. Esq: {dMm}x{extDmm}mm
                                </text>
                              </>
                            )}

                            {(isL_Dir || isU) && (
                              <>
                                <rect 
                                  x={50 + wMm - dMm} 
                                  y={50 + dMm} 
                                  width={dMm} 
                                  height={extDmm} 
                                  fill="rgba(15, 23, 42, 0.65)" 
                                  stroke={limiteExcedido ? '#f43f5e' : '#10b981'} 
                                  strokeWidth="5"
                                  rx="5"
                                />
                                <text 
                                  x={50 + wMm - dMm / 2} 
                                  y={50 + dMm + extDmm / 2} 
                                  fill="#ffffff" 
                                  fontSize="38" 
                                  fontWeight="black" 
                                  textAnchor="middle"
                                  alignmentBaseline="middle"
                                >
                                  Ext. Dir: {dMm}x{extDmm}mm
                                </text>
                              </>
                            )}

                             {/* 2. Saia Frontal */}
                             {saiaAtiva && sMm > 0 && (
                               <>
                                 <rect 
                                   x="50" 
                                   y={saiaY2D} 
                                   width={wMm} 
                                   height={sMm} 
                                   fill="rgba(15, 23, 42, 0.45)" 
                                   stroke={limiteExcedido ? '#f43f5e' : '#10b981'} 
                                   strokeWidth="4"
                                   rx="3"
                                 />
                                 <text 
                                   x={50 + wMm / 2} 
                                   y={saiaY2D + sMm / 2} 
                                   fill="#ffffff" 
                                   fontSize="32" 
                                   fontWeight="bold" 
                                   textAnchor="middle"
                                   alignmentBaseline="middle"
                                 >
                                   Saia: {wMm}x{sMm}mm
                                 </text>
                               </>
                             )}
 
                             {/* 3. Rodopia */}
                             {rodopiaAtivo && rMm > 0 && (
                               <>
                                 <rect 
                                   x="50" 
                                   y={rodopiaY2D} 
                                   width={wMm} 
                                   height={rMm} 
                                   fill="rgba(15, 23, 42, 0.25)" 
                                   stroke={limiteExcedido ? '#f43f5e' : '#10b981'} 
                                   strokeWidth="4"
                                   rx="3"
                                 />
                                 <text 
                                   x={50 + wMm / 2} 
                                   y={rodopiaY2D + rMm / 2} 
                                   fill="#0f172a" 
                                   fontSize="32" 
                                   fontWeight="bold" 
                                   textAnchor="middle"
                                   alignmentBaseline="middle"
                                 >
                                   Rodopia: {wMm}x{rMm}mm
                                 </text>
                               </>
                             )}
                          </>
                        )}
                      </svg>
                    </div>
                  )}
                </div>

                {/* Status Bar Aproveitamento */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Aproveitamento da Pedra</span>
                    <span className="font-mono">{aproveitamentoPct.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${limiteExcedido ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                      style={{ width: `${aproveitamentoPct}%` }} 
                    />
                  </div>
                  {limiteExcedido && (
                    <p className="text-[10px] text-rose-600 font-extrabold mt-1">
                      ⚠️ ATENÇÃO: As dimensões totais empilhadas ({wMm}x{totalAlturaPecas}mm) ultrapassam a chapa comercial de granito/mármore ({chapaW}x{chapaH}mm). Será necessário fracionar ou usar emendas.
                    </p>
                  )}
                </div>
              </div>

              {/* Serviços e Recortes */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900">Cubas & Serviços Adicionais</h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {dbServicos.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleToggleServico(s.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        servicosSelecionados.includes(s.id)
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs font-bold">{s.nome}</span>
                      <span className="font-mono text-xs font-black">R$ {s.custo}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resumo da Memória de Cálculo e Form do Cliente */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Memória de Cálculo */}
              <div className="glass-card p-5 space-y-3.5 glass-details">
                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Memória de Cálculo</h4>
                
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>
                      Área Tampo:
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {isL_Esq || isL_Dir
                          ? `Principal: ${largura}x${profundidade}mm + L: ${extDmm}x${profundidade}mm`
                          : isU
                          ? `Principal: ${largura}x${profundidade}mm + 2x L: ${extDmm}x${profundidade}mm`
                          : `${largura}x${profundidade}mm`
                        }
                      </span>
                    </span>
                    <span className="font-mono text-slate-900 font-bold">{areaTampo.toFixed(4)} m²</span>
                  </div>
                  {saiaAtiva && (
                    <div className="flex justify-between font-medium text-slate-600">
                      <span>
                        Área Saia:
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {isL_Esq || isL_Dir
                            ? `Principal: ${largura}x${alturaSaia}mm + L: ${extDmm}x${alturaSaia}mm`
                            : isU
                            ? `Principal: ${largura}x${alturaSaia}mm + 2x L: ${extDmm}x${alturaSaia}mm`
                            : `${largura}x${alturaSaia}mm`
                          }
                        </span>
                      </span>
                      <span className="font-mono text-slate-900 font-bold">{areaSaia.toFixed(4)} m²</span>
                    </div>
                  )}
                  {rodopiaAtivo && (
                    <div className="flex justify-between font-medium text-slate-600">
                      <span>
                        Área Rodopia:
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {isL_Esq || isL_Dir
                            ? `Principal: ${largura}x${alturaRodopia}mm + L: ${profundidade + extDmm}x${alturaRodopia}mm`
                            : isU
                            ? `Principal: ${largura}x${alturaRodopia}mm + 2x L: ${profundidade + extDmm}x${alturaRodopia}mm`
                            : `${largura}x${alturaRodopia}mm`
                          }
                        </span>
                      </span>
                      <span className="font-mono text-slate-900 font-bold">{areaRodopia.toFixed(4)} m²</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-slate-600 border-t border-slate-100 pt-1.5">
                    <span>Área Líquida:</span>
                    <span className="font-mono text-slate-900 font-bold">{areaTotalPedraSemPerda.toFixed(4)} m²</span>
                  </div>
                  <div className="flex justify-between font-medium text-slate-600">
                    <span>Perda de Chapa (+{fatorPerda}%):</span>
                    <span className="font-mono text-slate-900 font-bold">{(areaTotalPedraSemPerda * fatorPerda / 100).toFixed(4)} m²</span>
                  </div>
                  {areaTotalPedraComPerda < areaMinima && (
                    <div className="flex justify-between text-amber-600 font-bold">
                      <span>Mínimo Cobrado Aplicado:</span>
                      <span className="font-mono">{areaMinima.toFixed(2)} m²</span>
                    </div>
                  )}
                  <div className="border-t border-slate-250 pt-2 flex justify-between font-black text-slate-900">
                    <span>Área Faturada Total:</span>
                    <span className="font-mono text-indigo-650 font-black">{areaTotalPedra.toFixed(4)} m²</span>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Custo da Rocha ({selectedPedra?.nome}):</span>
                      <span className="font-mono text-slate-800 font-bold">R$ {valorPedraTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Acabamento ({selectedAcabamento?.nome} - {acabamentoTotalML.toFixed(2)}m.l.):</span>
                      <span className="font-mono text-slate-800 font-bold">R$ {valorAcabamentoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cubas & Adicionais:</span>
                      <span className="font-mono text-slate-800 font-bold">R$ {totalServicosCusto.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-200/60 pt-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5 col-span-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Mão de Obra (R$)</label>
                        <input
                          type="number"
                          value={custoMaoObra}
                          onChange={e => setCustoMaoObra(Math.max(0, parseFloat(e.target.value) || 0))}
                          className="glass-input w-full p-1.5 text-[11px] text-center font-mono-val"
                        />
                      </div>
                      <div className="space-y-0.5 col-span-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Tipo Cálculo</label>
                        <select
                          value={tipoPrecificacao}
                          onChange={e => setTipoPrecificacao(e.target.value)}
                          className="glass-input w-full p-1.5 text-[11px] font-bold text-center"
                        >
                          <option value="markup">Markup</option>
                          <option value="margem">Margem</option>
                        </select>
                      </div>
                      <div className="space-y-0.5 col-span-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">{tipoPrecificacao === 'markup' ? 'Markup (%)' : 'Margem (%)'}</label>
                        <input
                          type="number"
                          value={markupPercent}
                          onChange={e => setMarkupPercent(Math.max(0, parseInt(e.target.value) || 0))}
                          className="glass-input w-full p-1.5 text-[11px] text-center font-mono-val"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-1">
                    <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase">
                      <span>Custo de Fabricação</span>
                      <span className="font-mono">R$ {custoTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-900">
                      <span className="text-sm font-black uppercase">Preço Final</span>
                      <span className="text-xl font-mono-val font-black text-slate-950">R$ {precoVenda.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações de OS/Cliente */}
              <div className="glass-card p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900">Gerar Orçamento / OS</h3>
                <form onSubmit={handleCreateOS} className="space-y-3.5">
                  
                  {/* Nome Cliente */}
                  <div className="space-y-1 relative">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Nome do Cliente</label>
                    <input
                      type="text"
                      required
                      value={clienteNome}
                      onChange={e => {
                        setClienteNome(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      className="glass-input w-full"
                      placeholder="Ex: Carlos Eduardo"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                        {suggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setClienteNome(sug.nome);
                              setClienteTelefone(sug.telefone);
                              setClienteEndereco(sug.endereco);
                              setShowSuggestions(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                          >
                            {sug.nome} <span className="text-slate-400 font-medium font-mono">({sug.telefone})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Telefone */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={clienteTelefone}
                      onChange={e => setClienteTelefone(e.target.value)}
                      className="glass-input w-full font-mono-val"
                      placeholder="DDD + Número"
                    />
                  </div>

                  {/* CEP */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">CEP (Autopreencher)</label>
                    <input
                      type="text"
                      value={clienteCep}
                      onChange={e => handleCepLookup(e.target.value)}
                      className="glass-input w-full font-mono-val"
                      placeholder="Apenas números"
                    />
                  </div>

                  {/* Endereço */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Endereço Completo</label>
                    <input
                      type="text"
                      value={clienteEndereco}
                      onChange={e => setClienteEndereco(e.target.value)}
                      className="glass-input w-full"
                      placeholder="Rua, Número, Bairro, Cidade"
                    />
                  </div>

                  {/* Agendamento */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Previsão da Medição/Instalação</label>
                    <input
                      type="date"
                      value={dataInstalacao}
                      onChange={e => setDataInstalacao(e.target.value)}
                      className="glass-input w-full font-mono-val text-xs"
                    />
                  </div>

                  {/* Marmorista */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Marmorista Responsável</label>
                    <input
                      type="text"
                      value={marmorista}
                      onChange={e => setMarmorista(e.target.value)}
                      className="glass-input w-full"
                      placeholder="Ex: Roberto Marmorista"
                    />
                  </div>

                  {/* Observações */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Observações do Projeto</label>
                    <textarea
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      rows="2"
                      className="glass-input w-full font-sans font-medium text-xs resize-none"
                      placeholder="Detalhes adicionais do serviço..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 btn-premium text-xs uppercase tracking-wider font-extrabold shadow-lg rounded-2xl flex items-center justify-center gap-2"
                  >
                    <IoCheckmarkCircleOutline size={16} /> Salvar OS no Firestore
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* --- ABA KANBAN OS --- */}
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            
            {/* Grid Kanban */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4 scrollbar-none">
              {STATUS_FLOW.map(colId => {
                const colPedigos = pedidos.filter(p => p.status === colId);
                const colHeader = STATUS_OS[colId];
                return (
                  <div key={colId} className="flex flex-col bg-slate-50 border border-slate-200/80 rounded-2xl p-3 min-w-[260px] h-[750px] shadow-sm">
                    {/* Header Coluna */}
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
                      <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${colHeader.color.split(' ')[0]}`} />
                        {colHeader.label}
                      </span>
                      <span className="font-mono text-[10px] font-black bg-slate-200/80 px-2 py-0.5 rounded-full text-slate-700">
                        {colPedigos.length}
                      </span>
                    </div>

                    {/* Scrollable Container Cards */}
                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 kanban-column-scroll scrollbar-none">
                      {colPedigos.map(os => (
                        <div
                          key={os.id}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-slate-400/80 transition-all cursor-pointer space-y-3.5"
                          onClick={() => setSelectedOS(os)}
                        >
                          <div className="space-y-1">
                            <span className="bg-slate-100 border border-slate-200 text-slate-700 font-extrabold uppercase px-2 py-0.5 rounded text-[8px]">
                              {os.projeto.modelo}
                            </span>
                            <h4 className="text-xs font-black text-slate-900 truncate mt-1">{os.cliente.nome}</h4>
                          </div>

                          <div className="space-y-1.5 text-[10px] text-slate-500 font-medium">
                            <div className="flex justify-between">
                              <span>Medidas:</span>
                              <span className="font-mono font-bold text-slate-700">{(os.projeto.largura/1000).toFixed(2)}x{(os.projeto.profundidade/1000).toFixed(2)}m</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Rocha/Pedra:</span>
                              <span className="font-bold text-slate-700 truncate max-w-[120px]">{os.projeto.pedra}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Instalação:</span>
                              <span className="font-mono font-bold text-slate-700">
                                {os.instalacao.data ? new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                            <span className="text-xs font-black font-mono-val text-slate-900">R$ {os.projeto.precoVenda.toFixed(2)}</span>
                            
                            {/* Ações Rápidas */}
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => shareWhatsApp(os)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                title="Enviar no WhatsApp"
                              >
                                <IoLogoWhatsapp size={14} />
                              </button>
                              
                              <button
                                onClick={() => handleDeleteOS(os.id)}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                title="Excluir OS"
                              >
                                <IoTrashOutline size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Avançar status */}
                          <div className="flex gap-1 pt-1" onClick={e => e.stopPropagation()}>
                            {STATUS_FLOW.indexOf(os.status) > 0 && (
                              <button
                                onClick={() => handleUpdateStatus(os.id, STATUS_FLOW[STATUS_FLOW.indexOf(os.status) - 1])}
                                className="flex-1 py-1 text-[9px] bg-slate-100 hover:bg-slate-200 border border-slate-300/40 rounded font-black text-slate-600 uppercase"
                              >
                                Voltar
                              </button>
                            )}
                            {STATUS_FLOW.indexOf(os.status) < STATUS_FLOW.length - 1 && (
                              <button
                                onClick={() => handleUpdateStatus(os.id, STATUS_FLOW[STATUS_FLOW.indexOf(os.status) + 1])}
                                className="flex-1 py-1 text-[9px] btn-premium rounded font-black uppercase text-white"
                              >
                                Avançar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {colPedigos.length === 0 && (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl py-8 text-center text-[10px] font-bold text-slate-400">
                          Vazio
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- ABA INSUMOS / CATÁLOGO --- */}
        {activeTab === 'catalogo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* CRUD Pedras e Rochas */}
            <div className="glass-card p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="text-lg">🪨</span> Catálogo de Pedras / Rochas (m²)
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Configure o valor do metro quadrado base</p>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddPedra} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nome do Granito, Mármore ou Quartzo"
                  value={newPedraNome}
                  onChange={e => setNewPedraNome(e.target.value)}
                  className="glass-input flex-1"
                />
                <input
                  type="number"
                  required
                  placeholder="Custo do m²"
                  value={newPedraCusto}
                  onChange={e => setNewPedraCusto(e.target.value)}
                  className="glass-input w-28 font-mono-val"
                />
                <button type="submit" className="px-4 btn-premium text-xs font-black uppercase tracking-wider rounded-xl">Add</button>
              </form>

              {/* Search Bar */}
              <input
                type="text"
                placeholder="🔍 Filtrar pedras..."
                value={searchPedrasQuery}
                onChange={e => setSearchPedrasQuery(e.target.value)}
                className="glass-input w-full text-xs font-medium"
              />

              {/* List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {dbPedras
                  .filter(p => p.nome.toLowerCase().includes(searchPedrasQuery.toLowerCase()))
                  .map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-xs font-black text-slate-800">{p.nome}</p>
                        <p className="text-[10px] text-slate-500 font-mono">R$ {p.custoM2?.toFixed(2)} / m²</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingMaterial({ id: p.id, tipo: 'pedra', nome: p.nome, custo: p.custoM2 })}
                          className="p-1.5 text-slate-600 hover:bg-slate-200/60 rounded-lg"
                        >
                          <IoCreateOutline size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem('marmorariaVidros', p.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <IoTrashOutline size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CRUD Acabamento de Borda */}
            <div className="glass-card p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="text-lg">✨</span> Acabamentos de Borda (m.l.)
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Configure o valor cobrado por metro linear</p>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddAcabamento} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: Meia-esquadria, Boleado simples"
                  value={newAcabNome}
                  onChange={e => setNewAcabNome(e.target.value)}
                  className="glass-input flex-1"
                />
                <input
                  type="number"
                  required
                  placeholder="Custo do m.l."
                  value={newAcabCusto}
                  onChange={e => setNewAcabCusto(e.target.value)}
                  className="glass-input w-28 font-mono-val"
                />
                <button type="submit" className="px-4 btn-premium text-xs font-black uppercase tracking-wider rounded-xl">Add</button>
              </form>

              {/* Search */}
              <input
                type="text"
                placeholder="🔍 Filtrar acabamentos..."
                value={searchAcabamentosQuery}
                onChange={e => setSearchAcabamentosQuery(e.target.value)}
                className="glass-input w-full text-xs font-medium"
              />

              {/* List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {dbAcabamentos
                  .filter(a => a.nome.toLowerCase().includes(searchAcabamentosQuery.toLowerCase()))
                  .map(a => (
                    <div key={a.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-xs font-black text-slate-800">{a.nome}</p>
                        <p className="text-[10px] text-slate-500 font-mono">R$ {a.custo?.toFixed(2)} / metro linear</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingMaterial({ id: a.id, tipo: 'acabamento', nome: a.nome, custo: a.custo })}
                          className="p-1.5 text-slate-600 hover:bg-slate-200/60 rounded-lg"
                        >
                          <IoCreateOutline size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem('marmorariaCores', a.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <IoTrashOutline size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CRUD Serviços e Recortes */}
            <div className="glass-card p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="text-lg">🛠️</span> Serviços de Cubas, Furos e Recortes
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Configure o valor unitário cobrado por estes recortes</p>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddServico} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: Recorte Cooktop, Furo de Torneira"
                  value={newServNome}
                  onChange={e => setNewServNome(e.target.value)}
                  className="glass-input flex-1"
                />
                <input
                  type="number"
                  required
                  placeholder="Custo"
                  value={newServCusto}
                  onChange={e => setNewServCusto(e.target.value)}
                  className="glass-input w-28 font-mono-val"
                />
                <button type="submit" className="px-4 btn-premium text-xs font-black uppercase tracking-wider rounded-xl">Add</button>
              </form>

              {/* Search */}
              <input
                type="text"
                placeholder="🔍 Filtrar recortes..."
                value={searchServicosQuery}
                onChange={e => setSearchServicosQuery(e.target.value)}
                className="glass-input w-full text-xs font-medium"
              />

              {/* List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {dbServicos
                  .filter(s => s.nome.toLowerCase().includes(searchServicosQuery.toLowerCase()))
                  .map(s => (
                    <div key={s.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <p className="text-xs font-black text-slate-800">{s.nome}</p>
                        <p className="text-[10px] text-slate-500 font-mono">R$ {s.custo?.toFixed(2)} / unid.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingMaterial({ id: s.id, tipo: 'servico', nome: s.nome, custo: s.custo })}
                          className="p-1.5 text-slate-600 hover:bg-slate-200/60 rounded-lg"
                        >
                          <IoCreateOutline size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem('marmorariaKits', s.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <IoTrashOutline size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CRUD Modelos Rápidos */}
            <div className="glass-card p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span className="text-lg">📐</span> Modelos de Bancadas Pré-definidos
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Configure os modelos e seus respectivos ícones/tipos</p>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddModelo} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do modelo (Ex: Soleira Dupla)"
                    value={newModeloNome}
                    onChange={e => setNewModeloNome(e.target.value)}
                    className="glass-input flex-1"
                  />
                  <select
                    value={newModeloTipo}
                    onChange={e => setNewModeloTipo(e.target.value)}
                    className="glass-input w-28"
                  >
                    <option value="cozinha">Cozinha</option>
                    <option value="banheiro">Banheiro</option>
                    <option value="soleira">Soleira</option>
                    <option value="peitoril">Peitoril</option>
                    <option value="ilha">Ilha</option>
                  </select>
                  <select
                    value={newModeloIcone}
                    onChange={e => setNewModeloIcone(e.target.value)}
                    className="glass-input w-16 text-lg p-1.5"
                  >
                    <option value="🍳">🍳</option>
                    <option value="🚰">🚰</option>
                    <option value="🚪">🚪</option>
                    <option value="🪟">🪟</option>
                    <option value="🍽️">🍽️</option>
                    <option value="📐">📐</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2.5 btn-premium text-xs font-black uppercase tracking-wider rounded-xl">Cadastrar Novo Modelo</button>
              </form>

              {/* Search */}
              <input
                type="text"
                placeholder="🔍 Filtrar modelos..."
                value={searchModelosQuery}
                onChange={e => setSearchModelosQuery(e.target.value)}
                className="glass-input w-full text-xs font-medium"
              />

              {/* List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {dbModelos
                  .filter(m => m.nome.toLowerCase().includes(searchModelosQuery.toLowerCase()))
                  .map(m => (
                    <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{m.icone || '🪨'}</span>
                        <div>
                          <p className="text-xs font-black text-slate-800">{m.nome}</p>
                          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Tipo: {m.tipoProjeto}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingMaterial({ id: m.id, tipo: 'modelo', nome: m.nome, tipoProjeto: m.tipoProjeto, icone: m.icone })}
                          className="p-1.5 text-slate-600 hover:bg-slate-200/60 rounded-lg"
                        >
                          <IoCreateOutline size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteItem('marmorariaModelos', m.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <IoTrashOutline size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* --- ABA CLIENTES --- */}
        {activeTab === 'clientes' && (
          <div className="glass-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Histórico de Clientes</h3>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pedidos acumulados por cliente de marmoraria</p>
              </div>
              <input
                type="text"
                placeholder="🔍 Buscar por nome do cliente..."
                value={searchClienteQuery}
                onChange={e => setSearchClienteQuery(e.target.value)}
                className="glass-input w-full sm:w-80 text-xs font-medium"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">
                    <th className="py-3">Nome</th>
                    <th className="py-3">Telefone</th>
                    <th className="py-3">Qtd. Pedidos</th>
                    <th className="py-3">Total Investido</th>
                    <th className="py-3">Ver Projetos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {(() => {
                    const clientMap = {};
                    
                    // 1. Inicializa com clientes da base do estabelecimento
                    clientesBase.forEach(c => {
                      clientMap[c.nome || 'N/A'] = {
                        nome: c.nome || 'N/A',
                        telefone: c.telefone || 'N/A',
                        pedidosCount: 0,
                        totalValor: 0,
                        osList: []
                      };
                    });

                    // 2. Adiciona/atualiza métricas com base nas ordens de serviço
                    pedidos.forEach(p => {
                      const name = p.cliente?.nome || 'N/A';
                      if (!clientMap[name]) {
                        clientMap[name] = {
                          nome: name,
                          telefone: p.cliente?.telefone || 'N/A',
                          pedidosCount: 0,
                          totalValor: 0,
                          osList: []
                        };
                      }
                      clientMap[name].pedidosCount += 1;
                      clientMap[name].totalValor += (p.projeto?.precoVenda || 0);
                      clientMap[name].osList.push(p);
                    });

                    const filteredClients = Object.values(clientMap).filter(c =>
                      c.nome.toLowerCase().includes(searchClienteQuery.toLowerCase())
                    );

                    // Ordena por total valor gasto ou alfabético
                    filteredClients.sort((a, b) => b.totalValor - a.totalValor || a.nome.localeCompare(b.nome));

                    return filteredClients.map((client, idx) => (
                      <tr key={idx}>
                        <td className="py-4 font-black text-slate-900">{client.nome}</td>
                        <td className="py-4 font-mono font-bold text-slate-600">{client.telefone}</td>
                        <td className="py-4 text-slate-600">{client.pedidosCount}</td>
                        <td className="py-4 font-mono text-slate-900 font-bold">R$ {client.totalValor.toFixed(2)}</td>
                        <td className="py-4">
                          {client.osList.length > 0 ? (
                            <button
                              onClick={() => {
                                // Seleciona a primeira OS desse cliente para visualizar detalhadamente
                                setSelectedOS(client.osList[0]);
                              }}
                              className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-[1.02] transition-all"
                            >
                              Exibir OS
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Sem Projetos</span>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- ABA 3: PLANO DE CORTE / OTIMIZADOR --- */}
        {activeTab === 'otimizador' && (
          <div className="space-y-6">
            <div className="bg-slate-900 text-white p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black tracking-tight">Otimizador de Plano de Corte 2D</h2>
                <p className="text-xs text-slate-300 font-semibold mt-1">
                  Minimize o desperdício de chapas de mármore/granito organizando os cortes das peças de forma inteligente.
                </p>
              </div>
            </div>
            
            <PlanoCorteOptimizer
              defaultChapaW={2800}
              defaultChapaH={1600}
              tipoInsumo="marmore"
              initialPecas={(() => {
                const list = [];
                // 1. Tampos
                list.push({ id: 1, largura: wMm || 1500, altura: dMm || 600, qtd: 1, label: 'Tampo Principal' });
                if (isL_Esq || isU) {
                  list.push({ id: 2, largura: extDmm, altura: dMm || 600, qtd: 1, label: 'Extensão Tampo Esq' });
                }
                if (isL_Dir || isU) {
                  list.push({ id: 3, largura: extDmm, altura: dMm || 600, qtd: 1, label: 'Extensão Tampo Dir' });
                }
                // 2. Saias
                if (saiaAtiva && sMm > 0) {
                  list.push({ id: 4, largura: wMm || 1500, altura: sMm, qtd: 1, label: 'Saia Principal' });
                  if (isL_Esq || isU) {
                    list.push({ id: 5, largura: extDmm, altura: sMm, qtd: 1, label: 'Saia Ext. Esq Frente' });
                    list.push({ id: 6, largura: dMm || 600, altura: sMm, qtd: 1, label: 'Saia Ext. Esq Lateral' });
                  }
                  if (isL_Dir || isU) {
                    list.push({ id: 7, largura: extDmm, altura: sMm, qtd: 1, label: 'Saia Ext. Dir Frente' });
                    list.push({ id: 8, largura: dMm || 600, altura: sMm, qtd: 1, label: 'Saia Ext. Dir Lateral' });
                  }
                }
                // 3. Rodopias
                if (rodopiaAtivo && rMm > 0) {
                  list.push({ id: 9, largura: wMm || 1500, altura: rMm, qtd: 1, label: 'Rodopia Principal' });
                  if (isL_Esq || isU) {
                    list.push({ id: 10, largura: dMm + extDmm, altura: rMm, qtd: 1, label: 'Rodopia Ext. Esq' });
                  }
                  if (isL_Dir || isU) {
                    list.push({ id: 11, largura: dMm + extDmm, altura: rMm, qtd: 1, label: 'Rodopia Ext. Dir' });
                  }
                }
                return list;
              })()}
            />
          </div>
        )}

        {/* --- DRAWER IDEACOPILOT --- */}
        <IdeaCopilot
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          isMarmoraria={true}
          onApplyParameters={(params) => {
            if (params.modelo) {
              const modelsList = dbModelos.length > 0 ? dbModelos : DEFAULTS_MODELOS;
              const matchModelo = modelsList.find(m => m.tipoProjeto === params.modelo || m.nome.toLowerCase().includes(params.modelo?.toLowerCase()));
              if (matchModelo) {
                setModeloObjId(matchModelo.nome);
                setModelo(matchModelo.tipoProjeto);
                setModeloNomeCompleto(matchModelo.nome);
              }
            }
            if (params.largura) setLargura(params.largura);
            if (params.profundidade) setProfundidade(params.profundidade);
            
            if (params.pedra) {
              const pedrasList = dbPedras.length > 0 ? dbPedras : DEFAULTS_PEDRAS;
              const matchPedra = pedrasList.find(p => p.nome.toLowerCase().includes(params.pedra.toLowerCase()));
              if (matchPedra) setPedraId(matchPedra.nome);
            }
            
            if (params.saiaAtiva !== undefined) setSaiaAtiva(params.saiaAtiva);
            if (params.alturaSaia) setAlturaSaia(params.alturaSaia);
            
            if (params.rodopiaAtivo !== undefined) setRodopiaAtivo(params.rodopiaAtivo);
            if (params.alturaRodopia) setAlturaRodopia(params.alturaRodopia);

            if (params.comprimentoL) setComprimentoL(params.comprimentoL);
            if (params.tipoPrecificacao) setTipoPrecificacao(params.tipoPrecificacao);
            
            if (params.acabamento) {
              const acabamentosList = dbAcabamentos.length > 0 ? dbAcabamentos : DEFAULTS_ACABAMENTOS;
              const matchAcab = acabamentosList.find(a => a.nome.toLowerCase().includes(params.acabamento.toLowerCase()));
              if (matchAcab) setAcabamentoId(matchAcab.nome);
            }
            
            if (params.clienteNome) setClienteNome(params.clienteNome);
            if (params.clienteTelefone) setClienteTelefone(params.clienteTelefone);
            if (params.clienteEndereco) setClienteEndereco(params.clienteEndereco);
            if (params.observacoes) setObservacoes(params.observacoes);
          }}
        />


        {/* --- MODAL DETALHE DA OS / RECIBO IMPRESSÃO --- */}
        {selectedOS && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto p-6 space-y-6 modal-animate print:p-0 relative shadow-2xl">
              
              {/* Botão Fechar */}
              <button
                onClick={() => setSelectedOS(null)}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all print:hidden"
              >
                <IoCloseOutline size={20} />
              </button>

              {/* Cabeçalho Recibo */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-1.5">
                    🪨 ORÇAMENTO TÉCNICO DE MARMORARIA
                  </h2>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">IdeaMarmore - Ordem de Serviço</p>
                  <p className="text-[10px] font-mono text-slate-400 font-medium">Cadastrado em: {new Date(selectedOS.criadoEm).toLocaleString('pt-BR')}</p>
                </div>
                
                {/* Badge Status */}
                <span className={`px-3 py-1 border rounded-full text-[10px] font-black uppercase print:text-black print:bg-white print:border-black ${STATUS_OS[selectedOS.status]?.color || 'bg-slate-100'}`}>
                  {STATUS_OS[selectedOS.status]?.label}
                </span>
              </div>

              {/* Dados do Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div className="space-y-1.5">
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase">Dados do Cliente</p>
                  <p className="font-black text-slate-800 text-sm">{selectedOS.cliente.nome}</p>
                  <p className="font-mono text-slate-600 font-bold">{selectedOS.cliente.telefone}</p>
                  {selectedOS.cliente.cep && <p className="font-mono text-slate-500">CEP: {selectedOS.cliente.cep}</p>}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[9px] text-slate-500 font-extrabold uppercase">Endereço de Entrega</p>
                  <p className="text-slate-700 font-medium">{selectedOS.cliente.endereco || 'Não informado'}</p>
                  <p className="text-slate-500 font-medium">Marmorista: <strong className="text-slate-800 font-black">{selectedOS.instalacao?.marmorista || 'Não designado'}</strong></p>
                </div>
              </div>

              {/* Detalhes do Projeto */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">Estrutura do Projeto & Cálculo</h4>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-[8px] uppercase tracking-wider text-slate-400 font-extrabold">
                        <th className="py-2">Componente</th>
                        <th className="py-2">Dimensões / Rocha</th>
                        <th className="py-2 text-right">Área / Metros</th>
                        <th className="py-2 text-right">Valor Parcial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      <tr>
                        <td className="py-2.5 font-bold text-slate-800">Tampo Principal ({selectedOS.projeto.modelo})</td>
                        <td className="py-2.5 text-slate-500">
                          {selectedOS.projeto.pedra} ({selectedOS.projeto.largura}x{selectedOS.projeto.profundidade}mm)
                          {(selectedOS.projeto.formatoBancada === 'L-esq' || selectedOS.projeto.formatoBancada === 'L-dir' || selectedOS.projeto.formatoBancada === 'L') && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              + Extensão L: {selectedOS.projeto.comprimentoL !== undefined ? selectedOS.projeto.comprimentoL : 800}x{selectedOS.projeto.profundidade}mm
                            </span>
                          )}
                          {selectedOS.projeto.formatoBancada === 'U' && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              + 2x Extensão U: {selectedOS.projeto.comprimentoL !== undefined ? selectedOS.projeto.comprimentoL : 800}x{selectedOS.projeto.profundidade}mm
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-mono font-medium">{selectedOS.projeto.areaTampo.toFixed(4)} m²</td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-800">R$ {(selectedOS.projeto.areaTampo * selectedOS.projeto.custoPedraM2).toFixed(2)}</td>
                      </tr>
                      {selectedOS.projeto.saiaAtiva && selectedOS.projeto.areaSaia > 0 && (
                        <tr>
                          <td className="py-2.5 font-bold text-slate-800">Saia / Acabamento Frontal</td>
                          <td className="py-2.5 text-slate-500">
                            Altura: {selectedOS.projeto.alturaSaia} mm ({selectedOS.projeto.largura}mm)
                            {(selectedOS.projeto.formatoBancada === 'L-esq' || selectedOS.projeto.formatoBancada === 'L-dir' || selectedOS.projeto.formatoBancada === 'L') && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                + Extensão L: {selectedOS.projeto.comprimentoL !== undefined ? selectedOS.projeto.comprimentoL : 800}x{selectedOS.projeto.alturaSaia}mm
                              </span>
                            )}
                            {selectedOS.projeto.formatoBancada === 'U' && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                + 2x Extensão U: {selectedOS.projeto.comprimentoL !== undefined ? selectedOS.projeto.comprimentoL : 800}x{selectedOS.projeto.alturaSaia}mm
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono font-medium">{selectedOS.projeto.areaSaia.toFixed(4)} m²</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-800">R$ {(selectedOS.projeto.areaSaia * selectedOS.projeto.custoPedraM2).toFixed(2)}</td>
                        </tr>
                      )}
                      {selectedOS.projeto.rodopiaAtivo && selectedOS.projeto.areaRodopia > 0 && (
                        <tr>
                          <td className="py-2.5 font-bold text-slate-800">Rodopia / Espelho</td>
                          <td className="py-2.5 text-slate-500">
                            Altura: {selectedOS.projeto.alturaRodopia} mm ({selectedOS.projeto.largura}mm)
                            {(selectedOS.projeto.formatoBancada === 'L-esq' || selectedOS.projeto.formatoBancada === 'L-dir' || selectedOS.projeto.formatoBancada === 'L') && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                + Extensão L: {selectedOS.projeto.profundidade + (selectedOS.projeto.comprimentoL !== undefined ? selectedOS.projeto.comprimentoL : 800)}x{selectedOS.projeto.alturaRodopia}mm
                              </span>
                            )}
                            {selectedOS.projeto.formatoBancada === 'U' && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                + 2x Extensão U: {selectedOS.projeto.profundidade + (selectedOS.projeto.comprimentoL !== undefined ? selectedOS.projeto.comprimentoL : 800)}x{selectedOS.projeto.alturaRodopia}mm
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono font-medium">{selectedOS.projeto.areaRodopia.toFixed(4)} m²</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-800">R$ {(selectedOS.projeto.areaRodopia * selectedOS.projeto.custoPedraM2).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="py-2.5 font-bold text-slate-800">Acabamento de Borda</td>
                        <td className="py-2.5 text-slate-500">{selectedOS.projeto.acabamento}</td>
                        <td className="py-2.5 text-right font-mono font-medium">{selectedOS.projeto.acabamentoTotalML.toFixed(2)} m.l.</td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-800">R$ {(selectedOS.projeto.acabamentoTotalML * selectedOS.projeto.custoAcabamentoML).toFixed(2)}</td>
                      </tr>
                      
                      {/* Serviços Adicionais */}
                      {selectedOS.projeto.cubasServicos && selectedOS.projeto.cubasServicos.map((s, idx) => (
                        <tr key={idx}>
                          <td className="py-2.5 font-bold text-slate-800" colSpan="2">{s.nome}</td>
                          <td className="py-2.5 text-right font-mono text-slate-500">1 unid.</td>
                          <td className="py-2.5 text-right font-mono font-bold text-slate-800">R$ {s.custo.toFixed(2)}</td>
                        </tr>
                      ))}

                      {/* Mão de Obra */}
                      <tr>
                        <td className="py-2.5 font-bold text-slate-800" colSpan="3">Serviço de Mão de Obra (Polimento/Instalação)</td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-800">R$ {selectedOS.projeto.custoMaoObra.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totalizador Financeiro */}
              <div className="flex flex-col md:flex-row md:justify-between md:items-center border-t border-slate-200 pt-5 gap-4">
                <div className="text-xs text-slate-500 font-semibold space-y-0.5">
                  <p>Área Líquida: <strong className="text-slate-800 font-bold">{(selectedOS.projeto.areaTotalPedraSemPerda || (selectedOS.projeto.areaTotalPedra / 1.2)).toFixed(4)} m²</strong></p>
                  <p>Fator de Perda: <strong className="text-slate-800 font-bold">+{selectedOS.projeto.fatorPerda !== undefined ? selectedOS.projeto.fatorPerda : 20}%</strong></p>
                  <p>Área Faturada Total: <strong className="text-slate-800 font-black">{selectedOS.projeto.areaTotalPedra.toFixed(4)} m²</strong></p>
                  <p>Custo Total de Fabricação: <strong className="text-slate-850 font-bold">R$ {selectedOS.projeto.custoTotal.toFixed(2)}</strong></p>
                  <p>
                    {selectedOS.projeto.tipoPrecificacao === 'margem' ? 'Margem de Lucro Desejada' : 'Markup Aplicado'}:{' '}
                    <strong className="text-slate-850 font-bold">
                      {selectedOS.projeto.markup}% {selectedOS.projeto.tipoPrecificacao === 'margem' ? '(Margem)' : '(Markup)'}
                    </strong>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase">Valor Cobrado ao Cliente</p>
                  <h3 className="text-2xl font-mono-val font-black text-slate-900">R$ {selectedOS.projeto.precoVenda.toFixed(2)}</h3>
                </div>
              </div>

              {/* Observações */}
              {selectedOS.observacoes && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Notas e Observações</p>
                  <p className="text-slate-700 italic font-medium">{selectedOS.observacoes}</p>
                </div>
              )}

              {/* Rodapé do Recibo */}
              <div className="border-t border-slate-100 pt-4 hidden print:block text-[9px] text-center text-slate-400 font-semibold">
                Obrigado pela preferência! Assinatura Marmoraria: ____________________________
              </div>

              {/* Ações de Impressão / WhatsApp */}
              <div className="flex gap-3 pt-3 border-t border-slate-200/80 print:hidden">
                <button
                  type="button"
                  onClick={() => shareWhatsApp(selectedOS)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  <IoLogoWhatsapp size={14} /> Compartilhar no WhatsApp
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-3 px-5 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                >
                  <IoPrintOutline size={14} /> Imprimir Recibo
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedOS(null)}
                  className="py-3 px-5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        )}

        {/* --- MODAL EDITAR CATALOGO INSUMOS --- */}
        {editingMaterial && (
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-[420px] p-6 space-y-6 modal-animate shadow-2xl relative">
              <button
                onClick={() => setEditingMaterial(null)}
                className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all"
              >
                <IoCloseOutline size={20} />
              </button>

              <div>
                <h3 className="text-lg font-black text-slate-900">Editar Insumo</h3>
                <p className="text-xs text-slate-500 font-medium">Modifique as informações do item selecionado</p>
              </div>

              <form onSubmit={handleUpdateMaterial} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Nome do Insumo</label>
                  <input
                    type="text"
                    required
                    value={editingMaterial.nome}
                    onChange={e => setEditingMaterial({ ...editingMaterial, nome: e.target.value })}
                    className="glass-input w-full"
                  />
                </div>

                {editingMaterial.tipo !== 'modelo' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                      {editingMaterial.tipo === 'pedra' ? 'Preço do m² (R$)' : editingMaterial.tipo === 'acabamento' ? 'Preço do m.l. (R$)' : 'Preço Unitário (R$)'}
                    </label>
                    <input
                      type="number"
                      required
                      value={editingMaterial.custo}
                      onChange={e => setEditingMaterial({ ...editingMaterial, custo: e.target.value })}
                      className="glass-input w-full font-mono-val"
                    />
                  </div>
                )}

                {editingMaterial.tipo === 'modelo' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Tipo de Bancada</label>
                      <select
                        value={editingMaterial.tipoProjeto}
                        onChange={e => setEditingMaterial({ ...editingMaterial, tipoProjeto: e.target.value })}
                        className="glass-input w-full"
                      >
                        <option value="cozinha">Cozinha</option>
                        <option value="banheiro">Banheiro</option>
                        <option value="soleira">Soleira</option>
                        <option value="peitoril">Peitoril</option>
                        <option value="ilha">Ilha</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Ícone Emoji</label>
                      <select
                        value={editingMaterial.icone}
                        onChange={e => setEditingMaterial({ ...editingMaterial, icone: e.target.value })}
                        className="glass-input w-full text-sm p-1.5"
                      >
                        <option value="🍳">🍳 Cozinha</option>
                        <option value="🚰">🚰 Banheiro</option>
                        <option value="🚪">🚪 Soleira</option>
                        <option value="🪟">🪟 Peitoril</option>
                        <option value="🍽️">🍽️ Ilha</option>
                        <option value="📐">📐 Outro</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMaterial(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 btn-premium rounded-xl font-bold text-xs transition-all"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmUI />
      </div>
    </div>
  );
};

export default withEstablishmentAuth(MarmorariaDashboard);
