// src/pages/admin/VidracariaDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
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
  IoCreateOutline
} from 'react-icons/io5';
import './VidracariaDashboard.css';

// Definições padrão para Seeding (Semeadura)
const DEFAULTS_MODELOS = [
  { nome: 'Box de Banheiro', tipoProjeto: 'box', icone: '🛀' },
  { nome: 'Janela de Correr', tipoProjeto: 'janela', icone: '🪟' },
  { nome: 'Porta de Correr', tipoProjeto: 'porta', icone: '🚪' },
  { nome: 'Espelho sob Medida', tipoProjeto: 'espelho', icone: '🪞' },
  { nome: 'Outros Projetos', tipoProjeto: 'outros', icone: '🏗️' }
];

const DEFAULTS_VIDROS = [
  { nome: 'Temperado 8mm', custoM2: 120 },
  { nome: 'Temperado 10mm', custoM2: 155 },
  { nome: 'Laminado 8mm', custoM2: 220 },
  { nome: 'Laminado 10mm', custoM2: 270 },
  { nome: 'Espelho 4mm (Lapidado)', custoM2: 180 },
  { nome: 'Espelho 6mm (Lapidado)', custoM2: 250 }
];

const DEFAULTS_CORES = [
  { nome: 'Incolor', adicionalM2: 0 },
  { nome: 'Fumê', adicionalM2: 35 },
  { nome: 'Bronze', adicionalM2: 40 },
  { nome: 'Verde', adicionalM2: 25 }
];

const DEFAULTS_KITS = [
  // Ideia Glass
  { nome: 'Box Elegance (Roldanas Aparentes)', custo: 480, fornecedor: 'Ideia Glass' },
  { nome: 'Box Flex (Porta Sanfonada)', custo: 420, fornecedor: 'Ideia Glass' },
  { nome: 'Kit Certo (Abertura 180º)', custo: 390, fornecedor: 'Ideia Glass' },
  { nome: 'Kit Vision (Porta de Correr)', custo: 350, fornecedor: 'Ideia Glass' },
  // Tec-Vidro
  { nome: 'Linha Versatik Truck (Sacadas)', custo: 650, fornecedor: 'Tec-Vidro' },
  { nome: 'Transfer Box (Simultâneo)', custo: 320, fornecedor: 'Tec-Vidro' },
  { nome: 'Royal Box (Minimalista)', custo: 290, fornecedor: 'Tec-Vidro' },
  { nome: 'Duo Safe (Sem Furo no Vidro)', custo: 340, fornecedor: 'Tec-Vidro' },
  // AL Indústria
  { nome: 'Kit Engenharia Padrão (Box 8mm)', custo: 155, fornecedor: 'AL Indústria' },
  { nome: 'Kit Janela Slim (2 Folhas)', custo: 110, fornecedor: 'AL Indústria' },
  { nome: 'Kit Janela Slim (4 Folhas)', custo: 175, fornecedor: 'AL Indústria' },
  { nome: 'Max System (Porta Pivotante)', custo: 220, fornecedor: 'AL Indústria' }
];

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

  // Controle de Abas
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, calculadora, kanban, catalogo, clientes

  // Dados do Firestore
  const [pedidos, setPedidos] = useState([]);
  const [dbVidros, setDbVidros] = useState([]);
  const [dbCores, setDbCores] = useState([]);
  const [dbKits, setDbKits] = useState([]);
  const [dbModelos, setDbModelos] = useState([]);
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
  const [tipoVidroId, setTipoVidroId] = useState('');
  const [corVidroId, setCorVidroId] = useState('');
  const [kitAluminioId, setKitAluminioId] = useState('');
  const [custoMaoObra, setCustoMaoObra] = useState(150);
  const [markupPercent, setMarkupPercent] = useState(50);

  // Form de OS
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEndereco, setClienteEndereco] = useState('');
  const [dataInstalacao, setDataInstalacao] = useState('');
  const [vidraceiro, setVidraceiro] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Form de Catálogo (CRUD)
  const [newVidroNome, setNewVidroNome] = useState('');
  const [newVidroCusto, setNewVidroCusto] = useState('');
  const [newCorNome, setNewCorNome] = useState('');
  const [newCorCusto, setNewCorCusto] = useState('');
  const [newKitNome, setNewKitNome] = useState('');
  const [newKitCusto, setNewKitCusto] = useState('');
  const [newModeloNome, setNewModeloNome] = useState('');
  const [newModeloTipo, setNewModeloTipo] = useState('box');
  const [newModeloIcone, setNewModeloIcone] = useState('🛀');

  // Modal de Detalhes da OS
  const [selectedOS, setSelectedOS] = useState(null);

  // Estado para Edição de Materiais
  const [editingMaterial, setEditingMaterial] = useState(null); // { id, tipo: 'vidro'|'cor'|'kit'|'modelo', nome, custo, fornecedor, tipoProjeto, icone }

  // Busca de Clientes e Sugestões
  const [searchClienteQuery, setSearchClienteQuery] = useState('');
  const [clienteCep, setClienteCep] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Buscas Individuais do Catálogo
  const [searchVidrosQuery, setSearchVidrosQuery] = useState('');
  const [searchCoresQuery, setSearchCoresQuery] = useState('');
  const [searchKitsQuery, setSearchKitsQuery] = useState('');
  const [searchModelosQuery, setSearchModelosQuery] = useState('');

  const seedingRef = useRef({ vidros: false, cores: false, kits: false, modelos: false });

  // --- ESCUTAS FIRESTORE E SEEDING ---
  useEffect(() => {
    if (!estabId) return;

    // 1. Escuta única na coleção 'insumos' (para Vidros, Cores, Kits e Modelos)
    const unsubInsumos = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'insumos'),
      async (snap) => {
        const allInsumos = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const vidros = allInsumos.filter(i => i.tipoVidracaria === 'vidro');
        const cores = allInsumos.filter(i => i.tipoVidracaria === 'cor');
        const kits = allInsumos.filter(i => i.tipoVidracaria === 'kit');
        const modelos = allInsumos.filter(i => i.tipoVidracaria === 'modelo');

        // Seeding Vidros
        if (vidros.length === 0 && !seedingRef.current.vidros) {
          seedingRef.current.vidros = true;
          try {
            for (const v of DEFAULTS_VIDROS) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
                ...v,
                tipoVidracaria: 'vidro',
                ativo: true,
                categoria: 'Vidraçaria - Vidro'
              });
            }
          } catch (err) {
            console.error('Erro ao semear vidros:', err);
            seedingRef.current.vidros = false;
          }
        } else {
          setDbVidros(vidros);
        }

        // Seeding Cores
        if (cores.length === 0 && !seedingRef.current.cores) {
          seedingRef.current.cores = true;
          try {
            for (const c of DEFAULTS_CORES) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
                ...c,
                tipoVidracaria: 'cor',
                ativo: true,
                categoria: 'Vidraçaria - Cor'
              });
            }
          } catch (err) {
            console.error('Erro ao semear cores:', err);
            seedingRef.current.cores = false;
          }
        } else {
          setDbCores(cores);
        }

        // Seeding Kits
        if (kits.length === 0 && !seedingRef.current.kits) {
          seedingRef.current.kits = true;
          try {
            for (const k of DEFAULTS_KITS) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
                ...k,
                tipoVidracaria: 'kit',
                ativo: true,
                categoria: 'Vidraçaria - Kit'
              });
            }
          } catch (err) {
            console.error('Erro ao semear kits:', err);
            seedingRef.current.kits = false;
          }
        } else {
          setDbKits(kits);
        }

        // Seeding Modelos
        if (modelos.length === 0 && !seedingRef.current.modelos) {
          seedingRef.current.modelos = true;
          try {
            for (const m of DEFAULTS_MODELOS) {
              await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
                ...m,
                tipoVidracaria: 'modelo',
                ativo: true,
                categoria: 'Vidraçaria - Modelo'
              });
            }
          } catch (err) {
            console.error('Erro ao semear modelos:', err);
            seedingRef.current.modelos = false;
          }
        } else {
          setDbModelos(modelos);
        }
      },
      (err) => {
        console.error('Erro ao escutar insumos:', err);
      }
    );

    // 2. Escuta na coleção 'ordensServico' filtrando e ordenando localmente
    const unsubPedidos = onSnapshot(
      collection(db, 'estabelecimentos', estabId, 'ordensServico'),
      (snap) => {
        const osList = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(d => d.modulo === 'vidracaria' || d.tipoVidracaria === 'projeto');

        // Ordenação local decrescente por criadoEm
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

    return () => {
      unsubInsumos();
      unsubPedidos();
    };
  }, [estabId]);

  const aplicarFolgasPadrao = (tipoProj) => {
    switch (tipoProj) {
      case 'box':
        setFolgaLargura(50);
        setDescontoAltura(50);
        break;
      case 'janela':
        setFolgaLargura(40);
        setDescontoAltura(30);
        break;
      case 'porta':
        setFolgaLargura(50);
        setDescontoAltura(40);
        break;
      case 'espelho':
      case 'outros':
      default:
        setFolgaLargura(0);
        setDescontoAltura(0);
        break;
    }
  };

  // Define seleções iniciais quando as listas de materiais carregam
  useEffect(() => {
    if (dbVidros.length > 0 && !tipoVidroId) setTipoVidroId(dbVidros[0].id);
    if (dbCores.length > 0 && !corVidroId) setCorVidroId(dbCores[0].id);
    if (dbKits.length > 0 && !kitAluminioId) setKitAluminioId(dbKits[0].id);
    if (dbModelos.length > 0 && !modeloObjId) {
      const first = dbModelos[0];
      setModeloObjId(first.id);
      const tProj = first.tipoProjeto || 'outros';
      setModelo(tProj);
      setModeloNomeCompleto(first.nome);
      aplicarFolgasPadrao(tProj);
    }
  }, [dbVidros, dbCores, dbKits, dbModelos]);

  // --- CÁLCULO DE VALORES COM REGRAS DE TÊMPERA ---
  const selectedVidro = dbVidros.find(v => v.id === tipoVidroId) || dbVidros[0];
  const selectedCor = dbCores.find(c => c.id === corVidroId) || dbCores[0];
  const selectedKit = dbKits.find(k => k.id === kitAluminioId) || dbKits[0];

  const obterMedidaArredondada = (medidaMm, arredMm) => {
    const val = Number(medidaMm) || 0;
    if (!arredMm || arredMm <= 0) return val / 1000;
    return Math.ceil(val / arredMm) * arredMm / 1000;
  };

  const larguraVidro = Number(largura) + Number(folgaLargura);
  const alturaVidro = Math.max(1, Number(altura) - Number(descontoAltura));
  const larguraFaturada = obterMedidaArredondada(larguraVidro, arredondamentoMm);
  const alturaFaturada = obterMedidaArredondada(alturaVidro, arredondamentoMm);
  const areaRealSqm = (larguraVidro * alturaVidro) / 1000000;
  const areaTeoricaSqm = larguraFaturada * alturaFaturada;
  const areaSqm = parseFloat(Math.max(areaMinimaM2, areaTeoricaSqm).toFixed(4)) || 0;
  
  // Sugestões para preenchimento automático do cliente
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
  
  const glassCostPerSqm = (Number(selectedVidro?.custoM2) || 0) + (Number(selectedCor?.adicionalM2) || 0);
  const totalGlassCost = areaSqm * glassCostPerSqm;
  const totalKitCost = Number(selectedKit?.custo) || 0;
  
  const totalCostPrice = totalGlassCost + totalKitCost + Number(custoMaoObra);
  const salePrice = totalCostPrice * (1 + Number(markupPercent) / 100);

  // --- CRUD OPERAÇÕES ---

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

    try {
      const payload = {
        cliente: {
          nome: clienteNome,
          telefone: clienteTelefone,
          endereco: clienteEndereco
        },
        projeto: {
          modelo: modeloNomeCompleto,
          tipoProjeto: modelo,
          largura: Number(largura),
          altura: Number(altura),
          folgaLargura: Number(folgaLargura),
          descontoAltura: Number(descontoAltura),
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
          area: areaSqm,
          custoTotal: totalCostPrice,
          precoVenda: salePrice,
          markup: Number(markupPercent)
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
      setActiveTab('kanban'); // Manda o usuário ver o pipeline
    } catch (e) {
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
    } catch (e) {
      toast.error('Erro ao atualizar status.');
    }
  };

  // Excluir OS
  const handleDeleteOS = async (id) => {
    if (!window.confirm("Excluir esta Ordem de Serviço permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'ordensServico', id));
      toast.success('OS removida!');
      if (selectedOS?.id === id) setSelectedOS(null);
    } catch (e) {
      toast.error('Erro ao remover.');
    }
  };

  // Adicionar e Excluir Vidros
  const handleAddVidro = async (e) => {
    e.preventDefault();
    if (!newVidroNome || !newVidroCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newVidroNome,
        custoM2: Number(newVidroCusto),
        tipoVidracaria: 'vidro',
        ativo: true,
        categoria: 'Vidraçaria - Vidro'
      });
      setNewVidroNome('');
      setNewVidroCusto('');
      toast.success('Vidro cadastrado!');
    } catch (e) { toast.error('Erro.'); }
  };
  const handleDeleteVidro = async (id) => {
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Removido!');
    } catch (e) { toast.error('Erro.'); }
  };

  // Adicionar e Excluir Cores
  const handleAddCor = async (e) => {
    e.preventDefault();
    if (!newCorNome || !newCorCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newCorNome,
        adicionalM2: Number(newCorCusto),
        tipoVidracaria: 'cor',
        ativo: true,
        categoria: 'Vidraçaria - Cor'
      });
      setNewCorNome('');
      setNewCorCusto('');
      toast.success('Cor cadastrada!');
    } catch (e) { toast.error('Erro.'); }
  };
  const handleDeleteCor = async (id) => {
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Removida!');
    } catch (e) { toast.error('Erro.'); }
  };

  // Adicionar e Excluir Kits
  const handleAddKit = async (e) => {
    e.preventDefault();
    if (!newKitNome || !newKitCusto) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newKitNome,
        custo: Number(newKitCusto),
        tipoVidracaria: 'kit',
        ativo: true,
        categoria: 'Vidraçaria - Kit'
      });
      setNewKitNome('');
      setNewKitCusto('');
      toast.success('Kit cadastrado com sucesso!');
    } catch (e) { toast.error('Erro.'); }
  };
  const handleDeleteKit = async (id) => {
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Removido!');
    } catch (e) { toast.error('Erro.'); }
  };

  // Adicionar e Excluir Modelos
  const handleAddModelo = async (e) => {
    e.preventDefault();
    if (!newModeloNome) return;
    try {
      await addDoc(collection(db, 'estabelecimentos', estabId, 'insumos'), {
        nome: newModeloNome,
        tipoProjeto: newModeloTipo,
        icone: newModeloIcone,
        tipoVidracaria: 'modelo',
        ativo: true,
        categoria: 'Vidraçaria - Modelo'
      });
      setNewModeloNome('');
      setNewModeloTipo('box');
      setNewModeloIcone('🛀');
      toast.success('Modelo de projeto cadastrado com sucesso!');
    } catch (e) { toast.error('Erro.'); }
  };
  const handleDeleteModelo = async (id) => {
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabId, 'insumos', id));
      toast.success('Modelo removido!');
    } catch (e) { toast.error('Erro.'); }
  };

  // Atualizar Material no Catálogo
  const handleUpdateMaterial = async (e) => {
    e.preventDefault();
    if (!editingMaterial) return;

    try {
      const docRef = doc(db, 'estabelecimentos', estabId, 'insumos', editingMaterial.id);
      const updates = {
        nome: editingMaterial.nome
      };

      if (editingMaterial.tipo === 'vidro') {
        updates.custoM2 = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'cor') {
        updates.adicionalM2 = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'kit') {
        updates.custo = Number(editingMaterial.custo);
      } else if (editingMaterial.tipo === 'modelo') {
        updates.tipoProjeto = editingMaterial.tipoProjeto;
        updates.icone = editingMaterial.icone;
      }

      await updateDoc(docRef, updates);
      toast.success('✅ Material atualizado com sucesso!');
      setEditingMaterial(null);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar o material.');
    }
  };

  // WhatsApp e Impressão
  const shareWhatsApp = (os) => {
    const wMetros = os.projeto.largura > 10 ? (os.projeto.largura / 1000).toFixed(2) : os.projeto.largura.toFixed(2);
    const hMetros = os.projeto.altura > 10 ? (os.projeto.altura / 1000).toFixed(2) : os.projeto.altura.toFixed(2);
    const msg = `Olá *${os.cliente.nome}*,\n\nSegue o orçamento do seu projeto na *IdeaGlass*:\n\n` +
      `📌 *Projeto:* ${os.projeto.modelo.toUpperCase()}\n` +
      `📏 *Medidas:* ${wMetros}m x ${hMetros}m (${os.projeto.area.toFixed(2)} m²)\n` +
      `💎 *Vidro:* ${os.projeto.tipoVidro} (${os.projeto.corVidro})\n` +
      `⚙️ *Alumínios/Acessórios:* ${os.projeto.kitAluminio}\n\n` +
      `💵 *Valor Total:* R$ ${os.projeto.precoVenda.toFixed(2)}\n\n` +
      `Qualquer dúvida estamos à disposição!`;

    const url = `https://api.whatsapp.com/send?phone=55${os.cliente.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const printOS = () => {
    window.print();
  };

  // Dimensões proporcionais do SVG
  const getProportionalDimensions = (wInput, hInput) => {
    const maxW = 160;
    const maxH = 120;
    let w = Number(wInput) || 1200;
    let h = Number(hInput) || 1900;
    if (w < 10) w = w * 1000;
    if (h < 10) h = h * 1000;
    const ratio = w / h;
    let drawW = maxW;
    let drawH = maxW / ratio;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = maxH * ratio;
    }
    return { drawW, drawH };
  };

  const { drawW, drawH } = getProportionalDimensions(larguraVidro, alturaVidro);
  const svgX = (220 - drawW) / 2;
  const svgY = (160 - drawH) / 2;

  // Métricas do Dashboard
  const orcamentosAtivos = pedidos.filter(p => p.status === 'orcamento').length;
  const totalFaturadoVal = pedidos.filter(p => p.status === 'concluido').reduce((s, p) => s + (p.projeto?.precoVenda || 0), 0);
  const totalM2Instalado = pedidos.filter(p => p.status === 'concluido').reduce((s, p) => s + (p.projeto?.area || 0), 0);
  const totalOSAtivas = pedidos.filter(p => p.status !== 'orcamento' && p.status !== 'concluido').length;

  return (
    <div className="vidracaria-body min-h-screen p-4 sm:p-6 pb-20 font-sans text-slate-800">
      <div className="max-w-[1600px] mx-auto w-full">
        
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <BackButton to="/dashboard" />
            <div>
              <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                <span className="glass-logo-icon">💎</span> IdeaGlass
              </h1>
              <p className="text-xs text-slate-500 font-semibold tracking-wide">Plataforma Avançada de Gestão de Vidros e Instalações</p>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div className="flex flex-nowrap overflow-x-auto gap-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-sm backdrop-blur-md max-w-full scrollbar-none shrink-0">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: <IoAnalyticsOutline size={14} /> },
              { id: 'calculadora', label: 'Calculadora', icon: <IoCalculatorOutline size={14} /> },
              { id: 'kanban', label: 'Projetos (OS)', icon: <IoBuildOutline size={14} /> },
              { id: 'catalogo', label: 'Materiais', icon: <IoListOutline size={14} /> },
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

        {/* --- ABA 1: DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Cards de KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-amber-500">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Orçamentos Gerados</p>
                  <h3 className="text-3xl font-black mt-1 text-amber-600">{orcamentosAtivos}</h3>
                </div>
                <IoCalculatorOutline size={32} className="text-amber-600/70" />
              </div>

              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-slate-700">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">OS em Andamento</p>
                  <h3 className="text-3xl font-black mt-1 text-slate-900">{totalOSAtivas}</h3>
                </div>
                <IoBuildOutline size={32} className="text-slate-800/70" />
              </div>

              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-emerald-500">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vidro Instalado (Total)</p>
                  <h3 className="text-3xl font-black mt-1 text-emerald-600">{totalM2Instalado.toFixed(1)} m²</h3>
                </div>
                <span className="text-3xl">📐</span>
              </div>

              <div className="glass-card p-5 flex items-center justify-between border-l-4 border-l-purple-500">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Faturamento Concluído</p>
                  <h3 className="text-3xl font-black mt-1 text-purple-600">R$ {totalFaturadoVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <IoAnalyticsOutline size={32} className="text-purple-600/70" />
              </div>
            </div>

            {/* Layout de Duas Colunas do Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Instalações Agendadas */}
              <div className="glass-card lg:col-span-8 p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-2.5 flex items-center gap-2">
                  <IoCalendarOutline /> Instalações Agendadas & Vidraceiros
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200 text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">
                        <th className="py-2.5">Cliente</th>
                        <th className="py-2.5">Projeto</th>
                        <th className="py-2.5">Instalador</th>
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
                          <td className="py-3 text-slate-600 font-semibold">{os.instalacao.vidraceiro}</td>
                          <td className="py-3 font-mono text-slate-900 font-bold">
                            {os.instalacao.data ? new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
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
                          <td colSpan="5" className="py-6 text-center text-slate-500 font-medium">Nenhuma instalação ativa para os próximos dias.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Estatísticas Rápidas */}
              <div className="glass-card lg:col-span-4 p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 border-b border-slate-200 pb-2.5 flex items-center gap-2">
                  <IoAnalyticsOutline /> Estatísticas de Demanda
                </h3>

                <div className="space-y-4">
                  {/* Modelos mais pedidos */}
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Modelos Mais Solicitados</p>
                    <div className="space-y-2">
                      {['box', 'janela', 'porta', 'espelho'].map(m => {
                        const count = pedidos.filter(p => p.projeto?.tipoProjeto === m).length;
                        const pct = pedidos.length ? (count / pedidos.length) * 100 : 0;
                        return (
                          <div key={m} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                              <span className="capitalize">{m === 'box' ? 'Box de Banheiro' : m === 'janela' ? 'Janelas' : m === 'porta' ? 'Portas' : 'Espelhos'}</span>
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
          </div>
          </div>
        )}

        {/* --- ABA 2: CALCULADORA --- */}
        {activeTab === 'calculadora' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Calculadora (Esquerda - 7 cols) */}
            <div className="glass-card lg:col-span-7 p-6 space-y-5">
              <h2 className="text-lg font-black flex items-center gap-2 border-b border-slate-200 pb-3 text-slate-900">
                <IoCalculatorOutline /> Calculadora Inteligente de Projetos
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Modelo */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Modelo do Projeto</label>
                  <select 
                    value={modeloObjId} 
                    onChange={e => {
                      const selId = e.target.value;
                      setModeloObjId(selId);
                      const sel = dbModelos.find(m => m.id === selId);
                      if (sel) {
                        const tProj = sel.tipoProjeto || 'outros';
                        setModelo(tProj);
                        setModeloNomeCompleto(sel.nome);
                        aplicarFolgasPadrao(tProj);
                      }
                    }} 
                    className="glass-input w-full"
                  >
                    {dbModelos.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.icone || '🏗️'} {m.nome}
                      </option>
                    ))}
                    {dbModelos.length === 0 && <option>Carregando modelos...</option>}
                  </select>
                </div>

                {/* Vidro */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Tipo de Vidro</label>
                  <select value={tipoVidroId} onChange={e => setTipoVidroId(e.target.value)} className="glass-input w-full">
                    {dbVidros.map(item => (
                      <option key={item.id} value={item.id}>{item.nome} - R$ {item.custoM2}/m²</option>
                    ))}
                    {dbVidros.length === 0 && <option>Carregando vidros...</option>}
                  </select>
                </div>

                {/* Largura */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Largura (mm)</label>
                  <input type="number" placeholder="Ex: 1200" value={largura} onChange={e => setLargura(Math.max(1, parseInt(e.target.value) || 0))} className="glass-input w-full font-bold" />
                </div>

                {/* Altura */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Altura (mm)</label>
                  <input type="number" placeholder="Ex: 1900" value={altura} onChange={e => setAltura(Math.max(1, parseInt(e.target.value) || 0))} className="glass-input w-full font-bold" />
                </div>

                {/* Folga de Largura */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-800 block mb-1 flex items-center gap-1">
                    <span>📏</span> Folga Largura (mm)
                  </label>
                  <input 
                    type="number" 
                    placeholder="Ex: 50" 
                    value={folgaLargura} 
                    onChange={e => setFolgaLargura(parseInt(e.target.value) || 0)} 
                    className="glass-input w-full font-bold" 
                  />
                </div>

                {/* Desconto de Altura */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-800 block mb-1 flex items-center gap-1">
                    <span>📏</span> Desconto Altura (mm)
                  </label>
                  <input 
                    type="number" 
                    placeholder="Ex: 50" 
                    value={descontoAltura} 
                    onChange={e => setDescontoAltura(parseInt(e.target.value) || 0)} 
                    className="glass-input w-full font-bold" 
                  />
                </div>

                {/* Arredondamento da Têmpera */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Arredondamento Têmpera</label>
                  <select 
                    value={arredondamentoMm} 
                    onChange={e => setArredondamentoMm(parseInt(e.target.value))} 
                    className="glass-input w-full"
                  >
                    <option value={50}>50 mm (Padrão)</option>
                    <option value={100}>100 mm</option>
                    <option value={0}>Exato (Sem arredondamento)</option>
                  </select>
                </div>

                {/* Área Mínima de Faturamento */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Área Mínima Faturamento</label>
                  <select 
                    value={areaMinimaM2} 
                    onChange={e => setAreaMinimaM2(parseFloat(e.target.value))} 
                    className="glass-input w-full"
                  >
                    <option value={0.50}>0,50 m² (Padrão)</option>
                    <option value={1.00}>1,00 m²</option>
                    <option value={0.00}>Sem área mínima</option>
                  </select>
                </div>

                {/* Cor do Vidro */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Cor do Vidro</label>
                  <select value={corVidroId} onChange={e => setCorVidroId(e.target.value)} className="glass-input w-full">
                    {dbCores.map(item => (
                      <option key={item.id} value={item.id}>{item.nome} (+ R$ {item.adicionalM2}/m²)</option>
                    ))}
                  </select>
                </div>

                {/* Kit Alumínio */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Kit Ferragens/Alumínio</label>
                  <select value={kitAluminioId} onChange={e => setKitAluminioId(e.target.value)} className="glass-input w-full">
                    {dbKits.map(item => (
                      <option key={item.id} value={item.id}>
                        [{item.fornecedor || 'Geral'}] {item.nome} - R$ {item.custo}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mão de Obra */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Instalação & Frete (R$)</label>
                  <input type="number" value={custoMaoObra} onChange={e => setCustoMaoObra(Math.max(0, parseFloat(e.target.value) || 0))} className="glass-input w-full" />
                </div>

                {/* Markup / Lucro */}
                <div>
                  <label className="text-[10px] font-extrabold uppercase text-slate-500 block mb-1">Markup de Lucro ({markupPercent}%)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min="10" max="250" step="5" value={markupPercent} onChange={e => setMarkupPercent(parseInt(e.target.value))} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900" />
                    <span className="text-xs font-bold font-mono text-slate-800">{markupPercent}%</span>
                  </div>
                </div>
              </div>

              {/* Sumário */}
              <div className="glass-details bg-slate-100/50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Área Faturada</span>
                  <span className="text-sm font-black font-mono">{areaSqm.toFixed(3)} m²</span>
                  <span className="text-[9px] text-slate-400 block font-mono">Real: {areaRealSqm.toFixed(3)} m²</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Custo Total Matéria</span>
                  <span className="text-sm font-black font-mono">R$ {totalCostPrice.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Margem Adicionada</span>
                  <span className="text-sm font-black font-mono text-slate-700">R$ {(salePrice - totalCostPrice).toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-900 block">Preço Final Orçado</span>
                  <span className="text-base font-black font-mono text-emerald-600">R$ {salePrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Memória de Cálculo Dinâmica */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3 shadow-sm">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200/60 pb-2">
                  <span>🧾</span> Memória de Cálculo & Regras de Têmpera
                </h4>
                <div className="space-y-2.5 text-xs text-slate-600">
                  {/* Comparativo de Medidas */}
                  <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200/50 space-y-1.5 font-sans">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-500">Medidas do Vão Obra:</span>
                      <span className="font-bold font-mono text-slate-800">{largura} x {altura} mm</span>
                    </div>
                    <div className="flex justify-between text-[11px] bg-slate-50 px-1.5 py-0.5 rounded border border-dashed border-slate-200/60">
                      <span className="font-semibold text-slate-500">Engenharia (Folga/Desconto):</span>
                      <span className="font-bold font-mono text-slate-700">
                        {folgaLargura >= 0 ? `+${folgaLargura}` : folgaLargura}mm largura | -{descontoAltura}mm altura
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">Medida de Corte Vidro:</span>
                      <span className="font-bold font-mono text-emerald-600">{larguraVidro} x {alturaVidro} mm (Real: {areaRealSqm.toFixed(3)} m²)</span>
                    </div>
                    <div className="flex justify-between text-[11px] border-t border-slate-100 pt-1">
                      <span className="font-semibold text-slate-700">Faturado Têmpera (Arred.):</span>
                      <span className="font-black font-mono text-slate-900">
                        {(larguraFaturada * 1000).toFixed(0)} x {(alturaFaturada * 1000).toFixed(0)} mm 
                        ({larguraFaturada.toFixed(2)}m x {alturaFaturada.toFixed(2)}m)
                      </span>
                    </div>
                    {areaMinimaM2 > 0 && areaTeoricaSqm < areaMinimaM2 && (
                      <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1 pt-1 border-t border-dashed border-slate-200 mt-1">
                        <span>⚠️</span> Aplicada Área Mínima de {areaMinimaM2.toFixed(2)} m² (Área calculada era {areaTeoricaSqm.toFixed(3)} m²)
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
                    <span className="font-semibold text-slate-700">Vidro Base ({selectedVidro?.nome || 'Carregando...'})</span>
                    <span className="font-mono text-slate-600">R$ {selectedVidro?.custoM2 || 0} x {areaSqm.toFixed(3)}m² = <strong className="text-slate-900 font-extrabold">R$ {(areaSqm * (selectedVidro?.custoM2 || 0)).toFixed(2)}</strong></span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
                    <span className="font-semibold text-slate-700">Adicional Cor ({selectedCor?.nome || 'Carregando...'})</span>
                    <span className="font-mono text-slate-600">+ R$ {selectedCor?.adicionalM2 || 0} x {areaSqm.toFixed(3)}m² = <strong className="text-slate-900 font-extrabold">R$ {(areaSqm * (selectedCor?.adicionalM2 || 0)).toFixed(2)}</strong></span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
                    <span className="font-semibold text-slate-700">Acessórios / Kit Ferragem ({selectedKit?.nome || 'Carregando...'})</span>
                    <span className="font-mono text-slate-600">Custo Kit = <strong className="text-slate-900 font-extrabold">R$ {Number(selectedKit?.custo || 0).toFixed(2)}</strong></span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-dashed border-slate-200/60">
                    <span className="font-semibold text-slate-700">Mão de Obra, Frete & Instalação</span>
                    <span className="font-mono text-slate-600">Valor fixo = <strong className="text-slate-900 font-extrabold">R$ {Number(custoMaoObra).toFixed(2)}</strong></span>
                  </div>
                  <div className="flex justify-between items-center py-2 mt-2 bg-slate-100 border border-slate-200 px-3 rounded-lg text-slate-900 font-black">
                    <span>Margem Markup ({markupPercent}%)</span>
                    <span className="font-mono">R$ {totalCostPrice.toFixed(2)} x {markupPercent}% = <strong>R$ {(salePrice - totalCostPrice).toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Visualizer & Cadastro OS (Direita - 5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Visualizador Esquemático com Linhas de Cota */}
              <div className="glass-card p-5 flex flex-col items-center justify-center min-h-[260px] relative overflow-hidden group">
                <span className="absolute top-3 left-3 text-[10px] uppercase font-black tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                  Visualização Técnica
                </span>

                <div className="w-full flex items-center justify-center p-4">
                  <svg width="220" height="175" className="glass-svg-canvas border border-slate-200 rounded-xl bg-slate-50">
                    <defs>
                      <pattern id="grid-calc" width="15" height="15" patternUnits="userSpaceOnUse">
                        <path d="M 15 0 L 0 0 0 15" fill="none" stroke="rgba(15,23,42,0.03)" strokeWidth="1"/>
                      </pattern>
                      <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
                      </marker>
                    </defs>
                    <rect width="220" height="175" fill="url(#grid-calc)" />

                    <g transform={`translate(${svgX}, ${svgY})`}>
                      {/* 1. MODELO BOX DE BANHEIRO */}
                      {modelo === 'box' && (
                        <>
                          <rect width={drawW} height={drawH} fill="rgba(15, 23, 42, 0.03)" stroke="#0f172a" strokeWidth="2" />
                          <line x1={drawW / 2} y1="0" x2={drawW / 2} y2={drawH} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="3 3" />
                          <rect x={drawW / 2} width={drawW / 2} height={drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#334155" strokeWidth="1" />
                          <circle cx={drawW / 2 + 10} cy={drawH / 2} r="3" fill="#475569" />
                        </>
                      )}

                      {/* 2. JANELA DE CORRER */}
                      {modelo === 'janela' && (
                        <>
                          <rect width={drawW} height={drawH} fill="rgba(15, 23, 42, 0.02)" stroke="#64748b" strokeWidth="2.5" />
                          <rect width={drawW / 2} height={drawH} fill="none" stroke="#94a3b8" strokeWidth="1" />
                          <rect x={drawW / 2} width={drawW / 2} height={drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#64748b" strokeWidth="1" />
                          <circle cx={drawW / 2 - 6} cy={drawH / 2} r="2" fill="#64748b" />
                          <circle cx={drawW / 2 + 6} cy={drawH / 2} r="2" fill="#475569" />
                        </>
                      )}

                      {/* 3. PORTA DE CORRER */}
                      {modelo === 'porta' && (
                        <>
                          <rect width={drawW} height={drawH} fill="none" stroke="#475569" strokeWidth="2" />
                          <rect width={drawW / 2} height={drawH} fill="rgba(15, 23, 42, 0.02)" stroke="#64748b" strokeWidth="1" />
                          <rect x={drawW / 2} width={drawW / 2} height={drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#475569" strokeWidth="1.2" />
                          <rect x={drawW / 2 + 8} y={drawH / 2 - 20} width="4" height="40" rx="2" fill="#64748b" stroke="#334155" strokeWidth="0.5" />
                        </>
                      )}

                      {/* 4. ESPELHO */}
                      {modelo === 'espelho' && (
                        <>
                          <rect width={drawW} height={drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#334155" strokeWidth="1.5" />
                          <rect x="4" y="4" width={drawW - 8} height={drawH - 8} fill="none" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="0.5" />
                        </>
                      )}

                      {/* 5. OUTROS */}
                      {modelo === 'outros' && (
                        <>
                          <polygon points={`0,0 ${drawW},0 ${drawW},${drawH} 0,${drawH}`} fill="rgba(15, 23, 42, 0.02)" stroke="#0f172a" strokeWidth="1.5" />
                          <line x1="0" y1="0" x2={drawW} y2={drawH} stroke="rgba(15, 23, 42, 0.15)" strokeWidth="1" />
                        </>
                      )}

                      {/* LINHAS DE COTA (Arrow Dimensions) */}
                      {/* Cota Horizontal (Largura) */}
                      <line x1="0" y1={drawH + 12} x2={drawW} y2={drawH + 12} stroke="#0f172a" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                      
                      {/* Cota Vertical (Altura) */}
                      <line x1={drawW + 12} y1="0" x2={drawW + 12} y2={drawH} stroke="#0f172a" strokeWidth="1" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    </g>

                    {/* Texto das Medidas no SVG */}
                    <text x={svgX + drawW / 2} y={svgY + drawH + 23} fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="middle">
                      {larguraVidro > 10 ? (larguraVidro / 1000).toFixed(2) : larguraVidro.toFixed(2)}m
                    </text>
                    <text x={svgX + drawW + 28} y={svgY + drawH / 2 + 3} fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="start">
                      {alturaVidro > 10 ? (alturaVidro / 1000).toFixed(2) : alturaVidro.toFixed(2)}m
                    </text>
                  </svg>
                </div>
                <div className="text-[10px] text-slate-500 font-extrabold mt-1 text-center bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                  📏 Vão Obra: {largura}x{altura} mm | 🔍 Corte Vidro: {larguraVidro}x{alturaVidro} mm
                </div>
              </div>

              {/* Plano de Corte & Engenharia */}
              <div className="glass-card p-5 space-y-4">
                <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-1.5">
                  <span>📐</span> Engenharia & Plano de Corte (Chapa Padrão)
                </h3>
                
                {/* Descontos e Folgas */}
                <div className="text-xs text-slate-600 space-y-1.5">
                  <span className="font-extrabold text-slate-800 text-[10px] uppercase tracking-wider block">Folgas Aplicadas</span>
                  {modelo === 'box' && (
                    <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                      🔧 <strong>Box de Correr:</strong> Subtração padrão de <strong>50 mm</strong> na altura do vidro para folga dos trilhos e transpasso de <strong>50 mm</strong> na largura para transpasse das folhas de vedação.
                    </p>
                  )}
                  {modelo === 'janela' && (
                    <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                      🔧 <strong>Janela de Correr:</strong> Subtração padrão de <strong>30 mm</strong> na altura e transpasso de <strong>40 mm</strong> na largura das folhas.
                    </p>
                  )}
                  {modelo === 'porta' && (
                    <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                      🔧 <strong>Porta de Correr:</strong> Subtração de <strong>40 mm</strong> na altura e transpasso de <strong>50 mm</strong> na largura das folhas.
                    </p>
                  )}
                  {modelo === 'espelho' && (
                    <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                      🔧 <strong>Espelho sob Medida:</strong> Medida nominal exata para colagem direta. Sem folgas.
                    </p>
                  )}
                  {modelo === 'outros' && (
                    <p className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                      🔧 <strong>Projeto Personalizado:</strong> Folgas e descontos devem ser calculados manualmente.
                    </p>
                  )}
                </div>

                {/* Plano de Corte */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                  {/* SVG Otimizador */}
                  {largura <= 3210 && altura <= 2200 ? (
                    <svg width="150" height="103" className="border border-slate-300 bg-slate-100 rounded-lg shrink-0">
                      {/* Chapa Padrão */}
                      <rect width="150" height="103" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" />
                      {/* Peça Cortada */}
                      <rect 
                        width={(largura * 0.0467).toFixed(1)} 
                        height={(altura * 0.0467).toFixed(1)} 
                        fill="rgba(16, 185, 129, 0.15)" 
                        stroke="#10b981" 
                        strokeWidth="1.5" 
                      />
                      <text x="75" y="55" fill="#64748b" fontSize="8" textAnchor="middle" fontWeight="bold">Chapa 3.21x2.20m</text>
                    </svg>
                  ) : (
                    <div className="w-[150px] h-[103px] bg-red-50 border border-red-200 rounded-lg flex items-center justify-center p-2 text-center text-[9px] font-black text-red-600 shrink-0">
                      ⚠️ MEDIDA EXCEDIDA! Excede limite da chapa.
                    </div>
                  )}

                  <div className="text-xs space-y-1">
                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-slate-800 block">Otimização de Matéria-Prima</span>
                    <p className="text-slate-600">Aproveitamento: <strong>{((areaRealSqm / 7.062) * 100).toFixed(1)}%</strong> da chapa padrão.</p>
                    <p className="text-slate-400 text-[10px]">Área da chapa: 7.06 m² (3.21 x 2.20m)</p>
                    {largura > 3210 || altura > 2200 ? (
                      <p className="text-red-600 font-bold text-[9px] mt-1">⚠️ Peça não cabe em chapa comum. Necessário vidro Jumbo.</p>
                    ) : (
                      <p className="text-emerald-600 font-semibold text-[9px] mt-1">✓ Peça cabe na chapa padrão de têmperas.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Criar OS */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 mb-4">
                  📝 Salvar Orçamento / Abrir OS
                </h3>
                
                <form onSubmit={handleCreateOS} className="space-y-3.5">
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
                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] overflow-hidden max-h-48 overflow-y-auto">
                        {suggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setClienteNome(sug.nome);
                              setClienteTelefone(sug.telefone);
                              setClienteEndereco(sug.endereco);
                              setShowSuggestions(false);
                              toast.success(`👥 Cliente ${sug.nome} carregado!`);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 text-xs font-semibold text-slate-700 flex flex-col gap-0.5"
                          >
                            <span className="font-extrabold text-slate-900">{sug.nome}</span>
                            <span className="text-[10px] text-slate-500 font-normal">📞 {sug.telefone || 'Sem telefone'} | 📍 {sug.endereco || 'Sem endereço'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="WhatsApp/Telefone"
                      value={clienteTelefone}
                      onChange={e => setClienteTelefone(e.target.value)}
                      onFocus={() => setShowSuggestions(false)}
                      className="glass-input w-full py-2.5"
                    />
                    <input
                      type="date"
                      value={dataInstalacao}
                      onChange={e => setDataInstalacao(e.target.value)}
                      onFocus={() => setShowSuggestions(false)}
                      className="glass-input w-full py-2.5"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="CEP (Auto-completar)"
                      value={clienteCep}
                      onChange={e => handleCepLookup(e.target.value)}
                      onFocus={() => setShowSuggestions(false)}
                      maxLength={9}
                      className="glass-input w-full py-2.5 font-bold text-slate-800 placeholder:text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Instalador Responsável"
                      value={vidraceiro}
                      onChange={e => setVidraceiro(e.target.value)}
                      onFocus={() => setShowSuggestions(false)}
                      className="glass-input w-full py-2.5"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Endereço de Entrega Completo"
                    value={clienteEndereco}
                    onChange={e => setClienteEndereco(e.target.value)}
                    onFocus={() => setShowSuggestions(false)}
                    className="glass-input w-full py-2.5"
                  />

                  <textarea
                    placeholder="Observações adicionais do projeto..."
                    rows="2"
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    className="glass-input w-full text-xs"
                  />

                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-slate-900 to-emerald-700 hover:from-black hover:to-emerald-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <IoCheckmarkCircleOutline size={16} /> Confirmar & Criar Ordem de Serviço
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* --- ABA 3: KANBAN GESTÃO DE OS --- */}
        {activeTab === 'kanban' && (
          <div className="space-y-6">
            <div className="glass-card p-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <IoBuildOutline /> Pipeline de Controle de Ordens de Serviço (OS)
              </h2>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Arraste de Status / Fluxo de Medição à Entrega</span>
            </div>

            {/* Colunas do Kanban - Rolagem horizontal suave no mobile/tablet, grid de 5 colunas no desktop */}
            <div className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto pb-4 snap-x lg:overflow-x-visible lg:pb-0 scrollbar-thin">
              {STATUS_FLOW.map(colId => {
                const colOS = pedidos.filter(p => p.status === colId);
                return (
                  <div key={colId} className="flex flex-col bg-slate-100/40 border border-slate-200/60 rounded-2xl p-3 min-h-[400px] min-w-[280px] sm:min-w-[320px] lg:min-w-0 snap-align-start">
                    {/* Header Coluna */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <span className="text-xs font-black uppercase text-slate-700">
                        {STATUS_OS[colId].label}
                      </span>
                      <span className="bg-slate-200/80 border border-slate-300 text-slate-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {colOS.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[500px]">
                      {colOS.map(os => (
                        <div
                          key={os.id}
                          onClick={() => setSelectedOS(os)}
                          className={`glass-card p-3 border-l-4 ${STATUS_OS[os.status]?.borderCol || 'border-l-slate-600'} cursor-pointer hover:scale-[1.02] transition-all relative group shadow-sm`}
                        >
                          <h4 className="font-extrabold text-slate-800 text-xs truncate pr-4">{os.cliente.nome}</h4>
                          <p className="text-[9px] text-slate-500 uppercase font-black mt-1 tracking-wider">{os.projeto.modelo}</p>
                           <p className="text-[10px] font-mono font-bold text-slate-800 mt-0.5">
                            {os.projeto.largura > 10 ? (os.projeto.largura / 1000).toFixed(2) : os.projeto.largura.toFixed(2)}x
                            {os.projeto.altura > 10 ? (os.projeto.altura / 1000).toFixed(2) : os.projeto.altura.toFixed(2)}m
                          </p>
                          
                          <div className="space-y-1.5 mt-2.5 pt-2 border-t border-slate-100 text-[9px]">
                            <div className="flex justify-between items-center text-slate-500 font-semibold">
                              <span className="truncate max-w-[90px]">👷 {os.instalacao.vidraceiro || 'Sem instalador'}</span>
                              <span className="text-emerald-600 font-black font-mono text-[10px]">R$ {Number(os.projeto.precoVenda).toFixed(0)}</span>
                            </div>
                            {os.instalacao.data && (
                              <div className="flex items-center gap-1 text-[8px] text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                📅 {new Date(os.instalacao.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </div>
                            )}
                          </div>

                          {/* Seletor Rápido de Status */}
                          <div className="mt-2.5 flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 print:hidden">
                            {STATUS_FLOW.indexOf(os.status) > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(os.id, STATUS_FLOW[STATUS_FLOW.indexOf(os.status) - 1]);
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-200 hover:border-slate-400 hover:text-black text-slate-500 transition-all text-[9px] font-bold"
                                title="Voltar Status"
                              >
                                ◀
                              </button>
                            )}
                            {STATUS_FLOW.indexOf(os.status) < STATUS_FLOW.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateStatus(os.id, STATUS_FLOW[STATUS_FLOW.indexOf(os.status) + 1]);
                                }}
                                className="w-5 h-5 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-200 hover:border-slate-400 hover:text-black text-slate-500 transition-all text-[9px] font-bold"
                                title="Avançar Status"
                              >
                                ▶
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {colOS.length === 0 && (
                        <div className="py-8 text-center text-[10px] text-slate-400 font-semibold italic border-2 border-dashed border-slate-200 rounded-xl">
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

        {/* --- ABA 4: CATÁLOGO DE MATERIAIS --- */}
        {activeTab === 'catalogo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CRUD 1: Vidros */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                💎 Tipos de Vidros (Preço m²)
              </h3>
              
              <input
                type="text"
                placeholder="🔍 Pesquisar vidro..."
                value={searchVidrosQuery}
                onChange={e => setSearchVidrosQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
              />

              <form onSubmit={handleAddVidro} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do Vidro"
                    value={newVidroNome}
                    onChange={e => setNewVidroNome(e.target.value)}
                    className="glass-input flex-1 text-xs"
                  />
                  <input
                    type="number"
                    required
                    placeholder="Preço R$/m²"
                    value={newVidroCusto}
                    onChange={e => setNewVidroCusto(e.target.value)}
                    className="glass-input w-28 text-xs font-semibold"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
                  Adicionar Vidro
                </button>
              </form>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {dbVidros
                  .filter(item => item.nome.toLowerCase().includes(searchVidrosQuery.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-slate-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold shrink-0">
                          💎
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                          <span className="font-mono text-slate-800 font-bold">R$ {Number(item.custoM2).toFixed(2)} / m²</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditingMaterial({ id: item.id, tipo: 'vidro', nome: item.nome, custo: item.custoM2 })}
                          className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                        >
                          <IoCreateOutline size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteVidro(item.id)}
                          className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                        >
                          <IoTrashOutline size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CRUD 2: Cores */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                🎨 Cores & Acréscimos (m²)
              </h3>
              
              <input
                type="text"
                placeholder="🔍 Pesquisar cor..."
                value={searchCoresQuery}
                onChange={e => setSearchCoresQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
              />

              <form onSubmit={handleAddCor} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Cor / Acabamento"
                    value={newCorNome}
                    onChange={e => setNewCorNome(e.target.value)}
                    className="glass-input flex-1 text-xs"
                  />
                  <input
                    type="number"
                    required
                    placeholder="R$ Adicional"
                    value={newCorCusto}
                    onChange={e => setNewCorCusto(e.target.value)}
                    className="glass-input w-28 text-xs font-semibold"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
                  Adicionar Cor
                </button>
              </form>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {dbCores
                  .filter(item => item.nome.toLowerCase().includes(searchCoresQuery.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-emerald-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                          🎨
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                          <span className="font-mono text-emerald-600 font-bold">+ R$ {Number(item.adicionalM2).toFixed(2)} / m²</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditingMaterial({ id: item.id, tipo: 'cor', nome: item.nome, custo: item.adicionalM2 })}
                          className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                        >
                          <IoCreateOutline size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteCor(item.id)}
                          className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                        >
                          <IoTrashOutline size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CRUD 3: Kits */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                ⚙️ Kits Alumínio / Ferragens
              </h3>
              
              <input
                type="text"
                placeholder="🔍 Pesquisar kit..."
                value={searchKitsQuery}
                onChange={e => setSearchKitsQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
              />

              <form onSubmit={handleAddKit} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do Kit / Ferragem"
                    value={newKitNome}
                    onChange={e => setNewKitNome(e.target.value)}
                    className="glass-input flex-1 text-xs"
                  />
                  <input
                    type="number"
                    required
                    placeholder="Preço Kit"
                    value={newKitCusto}
                    onChange={e => setNewKitCusto(e.target.value)}
                    className="glass-input w-28 text-xs font-semibold"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
                  Adicionar Kit
                </button>
              </form>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {dbKits
                  .filter(item => item.nome.toLowerCase().includes(searchKitsQuery.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-purple-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0">
                          ⚙️
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-purple-600 font-bold">R$ {Number(item.custo).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditingMaterial({ id: item.id, tipo: 'kit', nome: item.nome, custo: item.custo })}
                          className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                        >
                          <IoCreateOutline size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteKit(item.id)}
                          className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                        >
                          <IoTrashOutline size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* CRUD 4: Modelos de Projetos */}
            <div className="glass-card p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-900 border-b border-slate-200 pb-2 flex items-center gap-2">
                📂 Modelos de Projetos
              </h3>
              
              <input
                type="text"
                placeholder="🔍 Pesquisar modelo..."
                value={searchModelosQuery}
                onChange={e => setSearchModelosQuery(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 focus:bg-white focus:border-slate-400 focus:outline-none placeholder:text-slate-400 font-semibold"
              />

              <form onSubmit={handleAddModelo} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Guarda-corpo"
                    value={newModeloNome}
                    onChange={e => setNewModeloNome(e.target.value)}
                    className="glass-input flex-1 text-xs"
                  />
                  <select
                    value={newModeloIcone}
                    onChange={e => setNewModeloIcone(e.target.value)}
                    className="glass-input w-16 text-xs p-1"
                  >
                    <option value="🛀">🛀</option>
                    <option value="🪟">🪟</option>
                    <option value="🚪">🚪</option>
                    <option value="🪞">🪞</option>
                    <option value="🏗️">🏗️</option>
                    <option value="📐">📐</option>
                    <option value="🛡️">🛡️</option>
                    <option value="🧼">🧼</option>
                  </select>
                </div>
                <select
                  value={newModeloTipo}
                  onChange={e => setNewModeloTipo(e.target.value)}
                  className="glass-input w-full text-xs"
                >
                  <option value="box">Desenho Box</option>
                  <option value="janela">Desenho Janela</option>
                  <option value="porta">Desenho Porta</option>
                  <option value="espelho">Desenho Espelho</option>
                  <option value="outros">Desenho Genérico</option>
                </select>
                <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold text-xs">
                  Adicionar Modelo
                </button>
              </form>

              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {dbModelos
                  .filter(item => item.nome.toLowerCase().includes(searchModelosQuery.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-200/80 hover:border-slate-400 shadow-sm hover:shadow rounded-2xl text-xs transition-all duration-200">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 font-bold shrink-0">
                          {item.icone || '🏗️'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-800 block truncate">{item.nome}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Desenho: {item.tipoProjeto || 'outros'}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditingMaterial({ id: item.id, tipo: 'modelo', nome: item.nome, tipoProjeto: item.tipoProjeto || 'outros', icone: item.icone || '🏗️' })}
                          className="p-2 bg-slate-900/10 hover:bg-slate-900 text-slate-800 hover:text-white rounded-xl border border-slate-800/10 transition-all"
                        >
                          <IoCreateOutline size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteModelo(item.id)}
                          className="p-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-500/10 transition-all"
                        >
                          <IoTrashOutline size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* --- ABA 5: CLIENTES --- */}
        {activeTab === 'clientes' && (
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <IoPersonOutline /> Lista de Clientes da Vidraçaria
              </h2>
              <div className="relative w-full sm:w-72">
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou WhatsApp..."
                  value={searchClienteQuery}
                  onChange={e => setSearchClienteQuery(e.target.value)}
                  className="glass-input w-full text-xs py-2 pl-3 pr-8"
                />
                <span className="absolute right-3 top-2 text-slate-400 text-xs">🔍</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[9px] uppercase tracking-wider text-slate-500 font-extrabold">
                    <th className="py-2.5">Nome do Cliente</th>
                    <th className="py-2.5">WhatsApp / Telefone</th>
                    <th className="py-2.5">Endereço</th>
                    <th className="py-2.5 text-right">Projetos Executados (Ver Detalhes)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {Array.from(new Set(pedidos.map(p => p.cliente.nome)))
                    .map(nome => {
                      const osCliente = pedidos.filter(p => p.cliente.nome === nome);
                      const tel = osCliente[0]?.cliente.telefone || 'Não informado';
                      const end = osCliente[0]?.cliente.endereco || 'Não informado';
                      return { nome, tel, end, osList: osCliente };
                    })
                    .filter(c => {
                      const query = searchClienteQuery.toLowerCase().trim();
                      return c.nome.toLowerCase().includes(query) || c.tel.toLowerCase().includes(query);
                    })
                    .map(cliente => (
                      <tr key={cliente.nome} className="hover:bg-slate-50/50">
                        <td className="py-3.5 font-extrabold text-slate-800">{cliente.nome}</td>
                        <td className="py-3.5 text-slate-800 font-bold">{cliente.tel}</td>
                        <td className="py-3.5 text-slate-600 max-w-xs truncate" title={cliente.end}>{cliente.end}</td>
                        <td className="py-3.5 text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {cliente.osList.map(os => (
                              <button
                                key={os.id}
                                onClick={() => setSelectedOS(os)}
                                className={`px-2 py-1 rounded-xl border text-[9px] font-black uppercase transition-all hover:scale-105 active:scale-95 flex items-center gap-1 shadow-sm ${
                                  STATUS_OS[os.status]?.color || 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                                title={`Clique para ver OS #${os.id.substring(0, 5).toUpperCase()}`}
                              >
                                <span>{os.projeto.tipoProjeto === 'box' ? '🛀' : os.projeto.tipoProjeto === 'janela' ? '🪟' : os.projeto.tipoProjeto === 'porta' ? '🚪' : os.projeto.tipoProjeto === 'espelho' ? '🪞' : '🏗️'}</span>
                                {os.projeto.modelo} ({os.projeto.area.toFixed(1)}m²)
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {pedidos.length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-500 font-medium">Nenhum cliente cadastrado no momento.</td>
                    </tr>
                  )}
                  {pedidos.length > 0 && Array.from(new Set(pedidos.map(p => p.cliente.nome))).filter(nome => {
                    const os = pedidos.filter(p => p.cliente.nome === nome);
                    const tel = os[0]?.cliente.telefone || '';
                    const query = searchClienteQuery.toLowerCase().trim();
                    return nome.toLowerCase().includes(query) || tel.toLowerCase().includes(query);
                  }).length === 0 && (
                    <tr>
                      <td colSpan="4" className="py-8 text-center text-slate-400 font-semibold italic">Nenhum cliente encontrado para a busca.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- MODAL DETALHE OS / RECIBO --- */}
        {selectedOS && (() => {
          const wVidro = selectedOS.projeto.larguraVidro || selectedOS.projeto.largura;
          const hVidro = selectedOS.projeto.alturaVidro || selectedOS.projeto.altura;
          const localDimensions = getProportionalDimensions(wVidro, hVidro);
          const localSvgX = (220 - localDimensions.drawW) / 2;
          const localSvgY = (160 - localDimensions.drawH) / 2;
          const localModelo = selectedOS.projeto.tipoProjeto || 'outros';
          
          return (
            <div className="fixed inset-0 bg-slate-950/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm print:relative print:inset-auto print:bg-white print:p-0">
              <div id="printable-receipt" className="modal-animate bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-left print:border-none print:shadow-none print:bg-white print:text-black">
                {/* Fechar */}
                <button
                  onClick={() => setSelectedOS(null)}
                  className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 border border-slate-200 p-1 rounded-lg hover:bg-slate-100 transition-all print:hidden"
                >
                  <IoCloseOutline size={20} />
                </button>

                <div className="border-b border-slate-200 pb-3.5 flex justify-between items-start print:border-black print:text-black">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-slate-100 border border-slate-300 text-slate-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wider print:hidden">
                        OS #{selectedOS.id.substring(0, 5).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border print:hidden ${STATUS_OS[selectedOS.status]?.color || 'bg-slate-100'}`}>
                        {STATUS_OS[selectedOS.status]?.label}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mt-2 print:text-black flex items-center gap-1.5">
                      <span className="text-slate-800">💎</span> IdeaGlass OS
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold print:text-black">Criada em: {new Date(selectedOS.criadoEm).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="hidden print:block text-right">
                    <h4 className="text-[9px] font-black uppercase text-black tracking-wider">Status da OS</h4>
                    <p className="text-xs font-bold text-black border border-black px-2 py-0.5 rounded mt-1 inline-block">{STATUS_OS[selectedOS.status]?.label.toUpperCase()}</p>
                  </div>
                </div>

                {/* Timeline Progresso OS */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 print:hidden">
                  <div className="flex justify-between items-center relative">
                    {/* Line backdrop */}
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
                    
                    {/* Active line progress */}
                    <div 
                      className="absolute top-1/2 left-0 h-0.5 bg-emerald-600 -translate-y-1/2 z-0 transition-all duration-300"
                      style={{ 
                        width: `${(STATUS_FLOW.indexOf(selectedOS.status) / (STATUS_FLOW.length - 1)) * 100}%` 
                      }}
                    />

                    {STATUS_FLOW.map((step, idx) => {
                      const stepIndex = STATUS_FLOW.indexOf(selectedOS.status);
                      const isCompleted = idx < stepIndex;
                      const isActive = idx === stepIndex;
                      const label = STATUS_OS[step]?.label || step;

                      return (
                        <div key={step} className="flex flex-col items-center relative z-10 flex-1">
                          <div 
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-200 ${
                              isCompleted 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20' 
                                : isActive 
                                  ? 'bg-slate-900 border-slate-900 text-white animate-pulse' 
                                  : 'bg-white border-slate-300 text-slate-400'
                            }`}
                          >
                            {isCompleted ? '✓' : idx + 1}
                          </div>
                          <span 
                            className={`text-[8px] font-black uppercase mt-1.5 text-center px-1 leading-none ${
                              isActive ? 'text-slate-900 font-extrabold' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhes do Cliente */}
                <div className="space-y-1.5 text-xs text-slate-600 print:text-black">
                  <p className="font-extrabold text-slate-800 text-sm print:text-black">👤 Cliente: {selectedOS.cliente.nome}</p>
                  {selectedOS.cliente.telefone && <p>📞 WhatsApp: {selectedOS.cliente.telefone}</p>}
                  {selectedOS.cliente.endereco && <p>📍 Endereço: {selectedOS.cliente.endereco}</p>}
                </div>

                {/* Detalhes do Vidro/Projeto */}
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5 text-xs print:bg-white print:border-black print:text-black">
                  <p className="font-extrabold text-slate-900 print:text-black uppercase tracking-wider text-[10px]">Especificações do Projeto</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Modelo</span>
                      <span className="font-extrabold text-slate-800 capitalize print:text-black">{selectedOS.projeto.modelo}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Área & Dimensões</span>
                      <span className="font-mono font-bold text-slate-800 print:text-black block">
                        {selectedOS.projeto.largura > 10 ? (selectedOS.projeto.largura / 1000).toFixed(2) : selectedOS.projeto.largura.toFixed(2)}x
                        {selectedOS.projeto.altura > 10 ? (selectedOS.projeto.altura / 1000).toFixed(2) : selectedOS.projeto.altura.toFixed(2)}m
                        {selectedOS.projeto.largura > 10 && ` (${selectedOS.projeto.largura}x${selectedOS.projeto.altura} mm)`}
                      </span>
                      {selectedOS.projeto.larguraFaturada && (
                        <span className="text-[9px] text-slate-400 block font-mono">
                          Faturado Têmpera: {selectedOS.projeto.larguraFaturada.toFixed(2)}x{selectedOS.projeto.alturaFaturada.toFixed(2)}m 
                          ({selectedOS.projeto.area.toFixed(3)}m² faturados)
                        </span>
                      )}
                      {selectedOS.projeto.larguraVidro && (
                        <span className="text-[9px] text-slate-500 block font-mono">
                          Corte Vidro: {selectedOS.projeto.larguraVidro}x{selectedOS.projeto.alturaVidro} mm 
                          (Folga L: {selectedOS.projeto.folgaLargura >= 0 ? `+${selectedOS.projeto.folgaLargura}` : selectedOS.projeto.folgaLargura}mm | Desc A: -{selectedOS.projeto.descontoAltura}mm)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Tipo do Vidro</span>
                      <span className="font-bold text-slate-800 print:text-black">{selectedOS.projeto.tipoVidro}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Cor & Ferragem</span>
                      <span className="font-bold text-slate-800 print:text-black">
                        {selectedOS.projeto.corVidro} / {selectedOS.projeto.kitAluminio}
                      </span>
                    </div>
                  </div>

                  {selectedOS.observacoes && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[9px] text-slate-500 block">Observações</span>
                      <p className="text-slate-600 text-[11px] print:text-black italic">{selectedOS.observacoes}</p>
                    </div>
                  )}
                </div>

                {/* Desenho Técnico (Blueprint) */}
                <div className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-slate-50/50 print:bg-white print:border-black">
                  <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 mb-2 print:text-black">Desenho Técnico do Projeto</span>
                  <div className="w-full flex justify-center p-1 bg-white rounded-lg border border-slate-200/60 print:border-none">
                    <svg width="220" height="175" className="bg-white">
                      <defs>
                        <marker id="arrow-receipt" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
                        </marker>
                      </defs>

                      <g transform={`translate(${localSvgX}, ${localSvgY})`}>
                        {/* 1. MODELO BOX DE BANHEIRO */}
                        {localModelo === 'box' && (
                          <>
                            <rect width={localDimensions.drawW} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.03)" stroke="#0f172a" strokeWidth="2" />
                            <line x1={localDimensions.drawW / 2} y1="0" x2={localDimensions.drawW / 2} y2={localDimensions.drawH} stroke="#0f172a" strokeWidth="1.5" strokeDasharray="3 3" />
                            <rect x={localDimensions.drawW / 2} width={localDimensions.drawW / 2} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#0f172a" strokeWidth="1" />
                            <circle cx={localDimensions.drawW / 2 + 10} cy={localDimensions.drawH / 2} r="3" fill="#0f172a" />
                          </>
                        )}

                        {/* 2. JANELA DE CORRER */}
                        {localModelo === 'janela' && (
                          <>
                            <rect width={localDimensions.drawW} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.02)" stroke="#0f172a" strokeWidth="2.5" />
                            <rect width={localDimensions.drawW / 2} height={localDimensions.drawH} fill="none" stroke="#0f172a" strokeWidth="1" />
                            <rect x={localDimensions.drawW / 2} width={localDimensions.drawW / 2} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#0f172a" strokeWidth="1" />
                            <circle cx={localDimensions.drawW / 2 - 6} cy={localDimensions.drawH / 2} r="2" fill="#0f172a" />
                            <circle cx={localDimensions.drawW / 2 + 6} cy={localDimensions.drawH / 2} r="2" fill="#0f172a" />
                          </>
                        )}

                        {/* 3. PORTA DE CORRER */}
                        {localModelo === 'porta' && (
                          <>
                            <rect width={localDimensions.drawW} height={localDimensions.drawH} fill="none" stroke="#0f172a" strokeWidth="2" />
                            <rect width={localDimensions.drawW / 2} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.02)" stroke="#0f172a" strokeWidth="1" />
                            <rect x={localDimensions.drawW / 2} width={localDimensions.drawW / 2} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#0f172a" strokeWidth="1.2" />
                            <rect x={localDimensions.drawW / 2 + 8} y={localDimensions.drawH / 2 - 20} width="4" height="40" rx="2" fill="#0f172a" stroke="#0f172a" strokeWidth="0.5" />
                          </>
                        )}

                        {/* 4. ESPELHO */}
                        {localModelo === 'espelho' && (
                          <>
                            <rect width={localDimensions.drawW} height={localDimensions.drawH} fill="rgba(15, 23, 42, 0.01)" stroke="#0f172a" strokeWidth="1.5" />
                            <rect x="4" y="4" width={localDimensions.drawW - 8} height={localDimensions.drawH - 8} fill="none" stroke="rgba(15, 23, 42, 0.08)" strokeWidth="0.5" />
                          </>
                        )}

                        {/* 5. OUTROS */}
                        {localModelo === 'outros' && (
                          <>
                            <polygon points={`0,0 ${localDimensions.drawW},0 ${localDimensions.drawW},${localDimensions.drawH} 0,${localDimensions.drawH}`} fill="rgba(15, 23, 42, 0.02)" stroke="#0f172a" strokeWidth="1.5" />
                            <line x1="0" y1="0" x2={localDimensions.drawW} y2={localDimensions.drawH} stroke="rgba(15, 23, 42, 0.15)" strokeWidth="1" />
                          </>
                        )}

                        {/* LINHAS DE COTA */}
                        <line x1="0" y1={localDimensions.drawH + 12} x2={localDimensions.drawW} y2={localDimensions.drawH + 12} stroke="#0f172a" strokeWidth="1" markerStart="url(#arrow-receipt)" markerEnd="url(#arrow-receipt)" />
                        <line x1={localDimensions.drawW + 12} y1="0" x2={localDimensions.drawW + 12} y2={localDimensions.drawH} stroke="#0f172a" strokeWidth="1" markerStart="url(#arrow-receipt)" markerEnd="url(#arrow-receipt)" />
                      </g>

                      {/* Texto das Medidas no SVG */}
                      <text x={localSvgX + localDimensions.drawW / 2} y={localSvgY + localDimensions.drawH + 23} fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="middle">
                        {wVidro > 10 ? (wVidro / 1000).toFixed(2) : wVidro.toFixed(2)}m
                      </text>
                      <text x={localSvgX + localDimensions.drawW + 28} y={localSvgY + localDimensions.drawH / 2 + 3} fill="#0f172a" fontSize="9" fontWeight="bold" textAnchor="start">
                        {hVidro > 10 ? (hVidro / 1000).toFixed(2) : hVidro.toFixed(2)}m
                      </text>
                    </svg>
                  </div>
                  <div className="text-[10px] text-slate-500 font-extrabold mt-1.5 text-center bg-white border border-slate-200 px-3 py-1.5 rounded-lg w-full">
                    📏 Vão Obra: {selectedOS.projeto.largura}x{selectedOS.projeto.altura} mm 
                    {selectedOS.projeto.larguraVidro && ` | 🔍 Corte Vidro: ${selectedOS.projeto.larguraVidro}x${selectedOS.projeto.alturaVidro} mm`}
                  </div>
                </div>

                {/* Financeiro */}
                <div className="flex justify-between items-center bg-slate-100 border border-slate-200 p-4 rounded-xl print:border-black print:text-black">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-slate-500">Total do Projeto</span>
                    <p className="text-xl font-black font-mono text-emerald-600 print:text-black">R$ {selectedOS.projeto.precoVenda.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Responsável</span>
                    <span className="text-xs font-bold text-slate-800 print:text-black">👷 {selectedOS.instalacao.vidraceiro}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2.5 pt-2 print:hidden">
                  <button
                    onClick={printOS}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/60 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <IoPrintOutline size={15} /> Imprimir Recibo
                  </button>
                  <button
                    onClick={() => shareWhatsApp(selectedOS)}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <IoLogoWhatsapp size={15} /> Enviar Orçamento
                  </button>
                  <button
                    onClick={() => handleDeleteOS(selectedOS.id)}
                    className="py-3 px-4 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl border border-red-200 transition-all"
                  >
                    <IoTrashOutline size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- MODAL EDIÇÃO MATERIAL --- */}
        {editingMaterial && (
          <div className="fixed inset-0 bg-slate-950/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="modal-animate bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-left">
              {/* Fechar */}
              <button
                onClick={() => setEditingMaterial(null)}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 border border-slate-200 p-1 rounded-lg hover:bg-slate-100 transition-all"
              >
                <IoCloseOutline size={20} />
              </button>

              <div className="border-b border-slate-200 pb-3">
                <span className="text-[10px] bg-slate-100 border border-slate-300 text-slate-800 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Editar {editingMaterial.tipo === 'vidro' ? 'Vidro' : editingMaterial.tipo === 'cor' ? 'Cor' : editingMaterial.tipo === 'kit' ? 'Kit' : 'Modelo'}
                </span>
                <h3 className="text-xl font-black text-slate-800 mt-2">Alterar Item Cadastrado</h3>
              </div>

              <form onSubmit={handleUpdateMaterial} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Nome / Descrição</label>
                  <input
                    type="text"
                    required
                    value={editingMaterial.nome}
                    onChange={e => setEditingMaterial({ ...editingMaterial, nome: e.target.value })}
                    className="glass-input w-full"
                    placeholder="Nome do material"
                  />
                </div>

                {editingMaterial.tipo !== 'modelo' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">
                      {editingMaterial.tipo === 'vidro' ? 'Custo do m² (R$)' : editingMaterial.tipo === 'cor' ? 'Adicional do m² (R$)' : 'Custo do Kit (R$)'}
                    </label>
                    <input
                      type="number"
                      required
                      value={editingMaterial.custo}
                      onChange={e => setEditingMaterial({ ...editingMaterial, custo: e.target.value })}
                      className="glass-input w-full font-mono-val"
                      placeholder="Valor em R$"
                    />
                  </div>
                )}



                {editingMaterial.tipo === 'modelo' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Desenho Técnico (SVG)</label>
                      <select
                        value={editingMaterial.tipoProjeto}
                        onChange={e => setEditingMaterial({ ...editingMaterial, tipoProjeto: e.target.value })}
                        className="glass-input w-full"
                      >
                        <option value="box">Desenho Box</option>
                        <option value="janela">Desenho Janela</option>
                        <option value="porta">Desenho Porta</option>
                        <option value="espelho">Desenho Espelho</option>
                        <option value="outros">Desenho Genérico</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wide">Ícone Emoji</label>
                      <select
                        value={editingMaterial.icone}
                        onChange={e => setEditingMaterial({ ...editingMaterial, icone: e.target.value })}
                        className="glass-input w-full text-sm p-1.5"
                      >
                        <option value="🛀">🛀 Box</option>
                        <option value="🪟">🪟 Janela</option>
                        <option value="🚪">🚪 Porta</option>
                        <option value="🪞">🪞 Espelho</option>
                        <option value="🏗️">🏗️ Obra/Outros</option>
                        <option value="📐">📐 Régua</option>
                        <option value="🛡️">🛡️ Escudo/Segurança</option>
                        <option value="🧼">🧼 Limpeza</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingMaterial(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/60 rounded-xl font-bold text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 btn-premium rounded-xl font-bold text-xs transition-all"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default withEstablishmentAuth(VidracariaDashboard);
