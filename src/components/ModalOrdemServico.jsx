import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { osService } from '../services/osService';
import { produtoService } from '../services/produtoService';
import { toast } from 'react-toastify';
import { 
  IoClose, 
  IoPersonOutline, 
  IoPhonePortraitOutline, 
  IoBuildOutline, 
  IoWalletOutline, 
  IoAdd, 
  IoTrash,
  IoCarOutline 
} from 'react-icons/io5';
import { uploadFile } from '../utils/firebaseStorageService';

export default function ModalOrdemServico({ isOpen, onClose, estabelecimentoId, osId = null, onSaved, theme = 'dark' }) {
  const [activeTab, setActiveTab] = useState('cliente');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Lista de clientes cadastrados para autocomplete
  const [clientesDisponiveis, setClientesDisponiveis] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Lista de produtos do catálogo para autocomplete
  const [produtosCatalogo, setProdutosCatalogo] = useState([]);
  const [showServicoAutocomplete, setShowServicoAutocomplete] = useState(false);
  const [showPecaAutocomplete, setShowPecaAutocomplete] = useState(false);

  const [tipoDesbloqueio, setTipoDesbloqueio] = useState('texto'); // 'texto' | 'desenho'

  // --- FORM STATES ---
  const [cliente, setCliente] = useState({ nome: '', telefone: '', cpf: '', email: '' });
  const [equipamento, setEquipamento] = useState({
    tipo: 'Celular',
    marca: '',
    modelo: '',
    nSerieOrImei: '',
    estadoFisico: '',
    senhaDesbloqueio: '',
    desenhoDesbloqueio: '',
    acessoriosDeixados: [],
    backupRealizado: 'nao_se_aplica',
    imei2: '',
    placa: '',
    chassi: '',
    quilometragem: '',
    nivelCombustivel: '1_2',
    ano: '',
    motor: ''
  });
  
  const [defeitoRelatado, setDefeitoRelatado] = useState('');
  const [defeitoDetectado, setDefeitoDetectado] = useState('');
  const [diagnosticoTecnico, setDiagnosticoTecnico] = useState('');
  
  const [servicos, setServicos] = useState([]);
  const [pecas, setPecas] = useState([]);
  
  const [novoServico, setNovoServico] = useState({ descricao: '', valor: '' });
  const [novaPeca, setNovaPeca] = useState({ nome: '', valor: '' });
  
  const [salvarServicoNoCatalogo, setSalvarServicoNoCatalogo] = useState(false);
  const [salvarPecaNoCatalogo, setSalvarPecaNoCatalogo] = useState(false);
  
  const [desconto, setDesconto] = useState(0);
  const [situacaoFinanceira, setSituacaoFinanceira] = useState('pendente');
  const [formaPagamento, setFormaPagamento] = useState('Pix');
  const [status, setStatus] = useState('em_analise');
  const [tecnicoResponsavel, setTecnicoResponsavel] = useState({ id: 'tecnico_1', nome: 'Técnico Geral' });
  const [garantiaDias, setGarantiaDias] = useState(90);
  const [previsaoEntrega, setPrevisaoEntrega] = useState('');
  const [segmentoOS, setSegmentoOS] = useState('geral');
  const [checklist, setChecklist] = useState({});
  const [fotos, setFotos] = useState([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const isDark = theme === 'dark';

  const isVeiculo = useMemo(() => {
    return ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(equipamento.tipo);
  }, [equipamento.tipo]);

  // styles map based on active theme
  const styles = {
    modalContainer: isDark
      ? 'bg-zinc-900/95 border-white/10 text-slate-200'
      : 'bg-white border-slate-200 text-slate-800 shadow-2xl',
    header: isDark
      ? 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white border-b border-white/10'
      : 'bg-gradient-to-r from-slate-100 via-white to-slate-100 text-slate-800 border-b border-slate-200',
    headerIcon: isDark
      ? 'bg-white/5 border-white/10 text-amber-400'
      : 'bg-amber-50 border-amber-200 text-amber-600',
    headerSubtitle: isDark ? 'text-zinc-400' : 'text-slate-500',
    closeBtn: isDark ? 'text-zinc-400 hover:bg-white/5 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    tabsContainer: isDark ? 'bg-zinc-950/40 border-b border-white/5' : 'bg-slate-50 border-b border-slate-200',
    tabInactive: isDark ? 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200' : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-800',
    formLabel: isDark ? 'text-zinc-400' : 'text-slate-500',
    formInput: isDark
      ? 'bg-zinc-950/70 border border-white/15 focus:border-indigo-500 text-white focus:ring-indigo-500/15 placeholder:text-zinc-500'
      : 'bg-slate-50 border border-slate-300 focus:border-indigo-500 text-slate-800 focus:ring-indigo-500/10 placeholder:text-slate-400',
    autocompleteContainer: isDark ? 'bg-zinc-950 border border-white/10' : 'bg-white border border-slate-200 shadow-2xl',
    autocompleteItem: isDark ? 'border-b border-white/5 hover:bg-white/5 text-white' : 'border-b border-slate-100 hover:bg-slate-50 text-slate-800',
    autocompleteTextMuted: isDark ? 'text-zinc-400' : 'text-slate-500',
    nestedSection: isDark ? 'bg-zinc-950/45 border-white/5' : 'bg-slate-50 border-slate-300/80',
    nestedSectionTitle: isDark ? 'text-white' : 'text-slate-800',
    toggleContainer: isDark ? 'bg-zinc-950/80 border border-white/10' : 'bg-slate-100 border border-slate-200',
    toggleActive: isDark ? 'bg-zinc-800 text-white border-white/5' : 'bg-white text-slate-800 border border-slate-200 shadow-sm',
    toggleInactive: isDark ? 'text-zinc-500 hover:text-zinc-400' : 'text-slate-500 hover:text-slate-700',
    checkboxContainer: isDark ? 'bg-zinc-950/50 border border-white/5 text-zinc-300' : 'bg-slate-100 border border-slate-200 text-slate-700',
    checklistRow: isDark ? 'bg-zinc-900/60 border border-white/5 text-zinc-300' : 'bg-white border border-slate-200 text-slate-700 shadow-sm',
    checklistBtnWrapper: isDark ? 'bg-zinc-950/80 border border-white/10' : 'bg-slate-100 border border-slate-200',
    checklistBtnNT: isDark ? 'bg-zinc-700 text-white shadow-md' : 'bg-slate-300 text-slate-800 shadow-sm',
    checklistBtnInactive: isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-500 hover:text-slate-700',
    photoUploadBox: isDark ? 'border-white/15 bg-zinc-950/50 hover:bg-zinc-950/80' : 'border-slate-300 bg-slate-50 hover:bg-slate-100',
    tableBorder: isDark ? 'border-white/5 bg-zinc-950' : 'border-slate-200 bg-white shadow-sm',
    tableHeaderRow: isDark ? 'bg-zinc-900/60 text-zinc-400 border-b border-white/5' : 'bg-slate-100 text-slate-600 border-b border-slate-300',
    tableRowBorder: isDark ? 'divide-white/5 text-zinc-300' : 'divide-slate-100 text-slate-700',
    tableTextWhite: isDark ? 'text-white' : 'text-slate-800',
    pricingSummary: isDark ? 'bg-zinc-950/80 border border-white/10 text-white' : 'bg-slate-50 border border-slate-200 text-slate-800',
    pricingMuted: isDark ? 'text-zinc-400' : 'text-slate-500',
    footerBorder: isDark ? 'border-white/5' : 'border-slate-200',
    footerCancelBtn: isDark ? 'border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800',
  };

  // 1. Carrega clientes para o Autocomplete e dados da OS se for edição
  useEffect(() => {
    if (!isOpen || !estabelecimentoId) return;
    
    const carregarConfig = async () => {
      try {
        const docRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSegmentoOS(docSnap.data().segmentoOS || 'geral');
        }
      } catch (err) {
        console.warn("Erro ao buscar segmento do estabelecimento:", err);
      }
    };

    const carregarClientes = async () => {
      try {
        const colRef = collection(db, 'estabelecimentos', estabelecimentoId, 'clientes');
        const snap = await getDocs(colRef);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setClientesDisponiveis(list);
      } catch (err) {
        console.warn("Erro ao buscar clientes:", err);
      }
    };

    const carregarProdutos = async () => {
      try {
        const list = await produtoService.buscarProdutosUniversal(estabelecimentoId);
        setProdutosCatalogo(list);
      } catch (err) {
        console.warn("Erro ao buscar catálogo de produtos:", err);
      }
    };

    const carregarOS = async () => {
      if (!osId) return;
      setLoading(true);
      try {
        const osData = await osService.obterOrdemServicoPorId(estabelecimentoId, osId);
        if (osData) {
          setCliente(osData.cliente || { nome: '', telefone: '', cpf: '', email: '' });
          setEquipamento({
            tipo: 'Celular',
            marca: '',
            modelo: '',
            nSerieOrImei: '',
            estadoFisico: '',
            senhaDesbloqueio: '',
            desenhoDesbloqueio: '',
            acessoriosDeixados: [],
            backupRealizado: 'nao_se_aplica',
            imei2: '',
            placa: '',
            chassi: '',
            quilometragem: '',
            nivelCombustivel: '1_2',
            ano: '',
            motor: '',
            ...osData.equipamento
          });
          if (osData.equipamento?.desenhoDesbloqueio) {
            setTipoDesbloqueio('desenho');
          } else {
            setTipoDesbloqueio('texto');
          }
          setDefeitoRelatado(osData.defeitoRelatado || '');
          setDefeitoDetectado(osData.defeitoDetectado || '');
          setDiagnosticoTecnico(osData.diagnosticoTecnico || '');
          setServicos(osData.servicos || []);
          setPecas(osData.pecas || []);
          setDesconto(osData.desconto || 0);
          setSituacaoFinanceira(osData.situacaoFinanceira || 'pendente');
          setFormaPagamento(osData.formaPagamento || 'Pix');
          setStatus(osData.status || 'em_analise');
          setTecnicoResponsavel(osData.tecnicoResponsavel || { id: 'tecnico_1', nome: 'Técnico Geral' });
          setGarantiaDias(osData.garantiaDias || 90);
          setChecklist(osData.checklist || {});
          setFotos(osData.fotos || []);
          
          if (osData.dataPrevisaoEntrega) {
            const dateObj = osData.dataPrevisaoEntrega.toDate ? osData.dataPrevisaoEntrega.toDate() : new Date(osData.dataPrevisaoEntrega);
            setPrevisaoEntrega(dateObj.toISOString().split('T')[0]);
          }
        }
      } catch (err) {
        toast.error("Erro ao carregar dados da ordem de serviço.");
        onClose();
      } finally {
        setLoading(false);
      }
    };

    carregarConfig();
    carregarClientes();
    carregarProdutos();
    carregarOS();
  }, [isOpen, osId, estabelecimentoId]);

  // Limpa o formulário ao abrir para criar nova OS
  useEffect(() => {
    if (isOpen && !osId) {
      const defaultTipo = segmentoOS === 'automotivo' ? 'Carro' : 'Celular';
      setCliente({ nome: '', telefone: '', cpf: '', email: '' });
      setTipoDesbloqueio('texto');
      setEquipamento({
        tipo: defaultTipo,
        marca: '',
        modelo: '',
        nSerieOrImei: '',
        estadoFisico: '',
        senhaDesbloqueio: '',
        desenhoDesbloqueio: '',
        acessoriosDeixados: [],
        backupRealizado: 'nao_se_aplica',
        imei2: '',
        placa: '',
        chassi: '',
        quilometragem: '',
        nivelCombustivel: '1_2',
        ano: '',
        motor: ''
      });
      setDefeitoRelatado('');
      setDefeitoDetectado('');
      setDiagnosticoTecnico('');
      setServicos([]);
      setPecas([]);
      setDesconto(0);
      setSituacaoFinanceira('pendente');
      setFormaPagamento('Pix');
      setStatus('em_analise');
      setGarantiaDias(90);
      setSalvarServicoNoCatalogo(false);
      setSalvarPecaNoCatalogo(false);
      setChecklist({});
      setFotos([]);
      
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      setPrevisaoEntrega(amanha.toISOString().split('T')[0]);
      setActiveTab('cliente');
    }
  }, [isOpen, osId, segmentoOS]);

  // Autocomplete filter com normalização de acentos e telefone
  const clientesFiltrados = useMemo(() => {
    const qNome = (cliente.nome || '')
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    const qTel = (cliente.telefone || '').replace(/\D/g, '').trim();

    if (!qNome && !qTel) return [];

    // Se bater perfeitamente com um cliente existente, não precisa abrir o dropdown
    const exactMatch = clientesDisponiveis.some(c => 
      (c.nome || '').toLowerCase() === (cliente.nome || '').toLowerCase() &&
      (c.telefone || '').replace(/\D/g, '') === (cliente.telefone || '').replace(/\D/g, '')
    );
    if (exactMatch) return [];

    return clientesDisponiveis.filter(c => {
      const cNomeClean = (c.nome || '')
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      
      const cPhoneClean = (c.telefone || '').replace(/\D/g, '');

      const matchesNome = qNome && cNomeClean.includes(qNome);
      const matchesTel = qTel && cPhoneClean.includes(qTel);

      return matchesNome || matchesTel;
    }).slice(0, 50);
  }, [cliente.nome, cliente.telefone, clientesDisponiveis]);

  const handleSelecionarCliente = (c) => {
    setCliente({
      nome: c.nome || '',
      telefone: c.telefone || '',
      cpf: c.cpf || '',
      email: c.email || ''
    });
    setShowAutocomplete(false);
  };

  // Autocomplete do Catálogo para Serviços (Mão de Obra)
  const servicosCatalogoFiltrados = useMemo(() => {
    const term = novoServico.descricao?.toLowerCase() || '';
    
    const servicos = produtosCatalogo.filter(p => 
      p.category === 'servicos' || 
      p.categoriaNome?.toLowerCase().includes('serviço') || 
      p.categoriaNome?.toLowerCase().includes('mão de obra') ||
      p.categoriaNome?.toLowerCase().includes('labor')
    );

    if (!term) {
      return servicos.length > 0 ? servicos.slice(0, 15) : produtosCatalogo.slice(0, 15);
    }

    const matchesServicos = servicos.filter(p => 
      p.name?.toLowerCase().includes(term) ||
      p.codigoBarras?.includes(term)
    );

    if (matchesServicos.length > 0) {
      return matchesServicos;
    }

    return produtosCatalogo.filter(p => 
      p.name?.toLowerCase().includes(term) ||
      p.codigoBarras?.includes(term)
    ).slice(0, 15);
  }, [novoServico.descricao, produtosCatalogo]);

  const handleSelecionarServicoCatalogo = (p) => {
    setNovoServico({
      descricao: p.name || '',
      valor: p.price || ''
    });
    setShowServicoAutocomplete(false);
  };

  // Autocomplete do Catálogo para Peças (Componentes)
  const pecasCatalogoFiltradas = useMemo(() => {
    const term = novaPeca.nome?.toLowerCase() || '';

    const pecas = produtosCatalogo.filter(p => 
      p.category === 'pecas' || 
      p.categoriaNome?.toLowerCase().includes('peça') || 
      p.categoriaNome?.toLowerCase().includes('componente') ||
      p.categoriaNome?.toLowerCase().includes('produto') ||
      p.categoriaNome?.toLowerCase().includes('acessório')
    );

    if (!term) {
      return pecas.length > 0 ? pecas.slice(0, 15) : produtosCatalogo.slice(0, 15);
    }

    const matchesPecas = pecas.filter(p => 
      p.name?.toLowerCase().includes(term) ||
      p.codigoBarras?.includes(term)
    );

    if (matchesPecas.length > 0) {
      return matchesPecas;
    }

    return produtosCatalogo.filter(p => 
      p.name?.toLowerCase().includes(term) ||
      p.codigoBarras?.includes(term)
    ).slice(0, 15);
  }, [novaPeca.nome, produtosCatalogo]);

  const handleSelecionarPecaCatalogo = (p) => {
    setNovaPeca({
      nome: p.name || '',
      valor: p.price || ''
    });
    setShowPecaAutocomplete(false);
  };

  // Cálculo de Totais
  const valorServicos = useMemo(() => servicos.reduce((acc, s) => acc + Number(s.valor || 0), 0), [servicos]);
  const valorPecas = useMemo(() => pecas.reduce((acc, p) => acc + Number(p.valor || 0), 0), [pecas]);
  const total = useMemo(() => Math.max(0, valorServicos + valorPecas - Number(desconto || 0)), [valorServicos, valorPecas, desconto]);

  // Adição Dinâmica de Serviços e Peças
  const handleAddServico = async () => {
    if (!novoServico.descricao || !novoServico.valor) {
      toast.warn("Preencha descrição e valor do serviço.");
      return;
    }
    
    const valorNum = Number(novoServico.valor);
    
    if (salvarServicoNoCatalogo) {
      try {
        await produtoService.salvarProdutoCatalogo(estabelecimentoId, {
          nome: novoServico.descricao,
          preco: valorNum,
          categoriaNome: 'Serviços',
          categoriaId: 'servicos'
        });
        toast.success(`Serviço "${novoServico.descricao}" cadastrado no catálogo!`);
        const list = await produtoService.buscarProdutosUniversal(estabelecimentoId);
        setProdutosCatalogo(list);
      } catch (err) {
        toast.error("Erro ao salvar serviço no catálogo.");
      }
    }

    setServicos(prev => [...prev, { descricao: novoServico.descricao, valor: valorNum }]);
    setNovoServico({ descricao: '', valor: '' });
    setSalvarServicoNoCatalogo(false);
  };

  const handleAddPeca = async () => {
    if (!novaPeca.nome || !novaPeca.valor) {
      toast.warn("Preencha nome e valor da peça.");
      return;
    }

    const valorNum = Number(novaPeca.valor);

    if (salvarPecaNoCatalogo) {
      try {
        await produtoService.salvarProdutoCatalogo(estabelecimentoId, {
          nome: novaPeca.nome,
          preco: valorNum,
          categoriaNome: 'Peças',
          categoriaId: 'pecas'
        });
        toast.success(`Peça "${novaPeca.nome}" cadastrada no catálogo!`);
        const list = await produtoService.buscarProdutosUniversal(estabelecimentoId);
        setProdutosCatalogo(list);
      } catch (err) {
        toast.error("Erro ao salvar peça no catálogo.");
      }
    }

    setPecas(prev => [...prev, { nome: novaPeca.nome, valor: valorNum }]);
    setNovaPeca({ nome: '', valor: '' });
    setSalvarPecaNoCatalogo(false);
  };

  const handleRemoverServico = (index) => {
    setServicos(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoverPeca = (index) => {
    setPecas(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!cliente.nome || !cliente.telefone) {
      toast.error("Nome e Telefone do cliente são obrigatórios!");
      setActiveTab('cliente');
      return;
    }
    if (!equipamento.modelo || !equipamento.marca) {
      toast.error("Marca e Modelo são obrigatórios!");
      setActiveTab('equipamento');
      return;
    }
    if (isVeiculo && !equipamento.placa) {
      toast.error("A placa do veículo é obrigatória!");
      setActiveTab('equipamento');
      return;
    }

    setSaving(true);
    const osPayload = {
      cliente,
      equipamento,
      defeitoRelatado,
      defeitoDetectado,
      diagnosticoTecnico,
      servicos,
      pecas,
      valorServicos,
      valorPecas,
      desconto: Number(desconto) || 0,
      total,
      situacaoFinanceira,
      formaPagamento,
      status,
      tecnicoResponsavel,
      garantiaDias: Number(garantiaDias) || 90,
      dataPrevisaoEntrega: previsaoEntrega ? new Date(previsaoEntrega + 'T18:00:00') : new Date(),
      checklist,
      fotos
    };

    try {
      if (osId) {
        await osService.atualizarOrdemServico(estabelecimentoId, osId, osPayload);
        toast.success("Ordem de serviço atualizada com sucesso!");
      } else {
        const res = await osService.criarOrdemServico(estabelecimentoId, osPayload);
        toast.success(`OS #${res.numeroOS} aberta com sucesso!`);
      }
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      toast.error("Ocorreu um erro ao salvar a ordem de serviço.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999] flex items-center justify-center p-3 sm:p-6 font-sans">
      <div className={`w-full max-w-4xl h-[92vh] sm:h-[88vh] rounded-[2.5rem] flex flex-col overflow-hidden border transition-colors duration-300 ${styles.modalContainer}`}>
        
        {/* HEADER */}
        <div className={`px-6 py-5 flex items-center justify-between shrink-0 transition-colors duration-300 ${styles.header}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-colors duration-300 ${styles.headerIcon}`}>
              <IoBuildOutline size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{osId ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h2>
              <p className={`text-xs font-semibold ${styles.headerSubtitle}`}>{osId ? 'Atualize as informações técnicas e financeiras' : 'Abra uma nova ficha de assistência técnica'}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-xl transition-all ${styles.closeBtn}`}>
            <IoClose size={24} />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className={`flex px-6 py-2 shrink-0 gap-1 overflow-x-auto no-scrollbar transition-colors duration-300 ${styles.tabsContainer}`}>
          {[
            { id: 'cliente', label: 'Cliente', icon: IoPersonOutline },
            { id: 'equipamento', label: isVeiculo ? 'Veículo' : 'Dispositivo', icon: isVeiculo ? IoCarOutline : IoPhonePortraitOutline },
            { id: 'servicos', label: 'Serviços & Peças', icon: IoBuildOutline },
            { id: 'financeiro', label: 'Valores & Fechamento', icon: IoWalletOutline }
          ].map(tab => {
            const ActiveIcon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
                  isTabActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : styles.tabInactive
                }`}
              >
                <ActiveIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-transparent">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin w-10 h-10 border-4 border-white/10 border-t-indigo-500 rounded-full mb-2"></div>
              <p className="text-xs font-bold text-zinc-400">Carregando OS...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* TAB 1: CLIENTE */}
              {activeTab === 'cliente' && (
                <div className="space-y-5">
                  <div className="relative">
                    <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Nome Completo *</label>
                    <input
                      type="text"
                      required
                      value={cliente.nome}
                      onChange={(e) => {
                        setCliente({ ...cliente, nome: e.target.value });
                        setShowAutocomplete(true);
                      }}
                      onFocus={() => setShowAutocomplete(true)}
                      placeholder="Busque cliente cadastrado ou digite novo nome"
                      className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && clientesFiltrados.length > 0 && (
                      <div className={`absolute top-[72px] left-0 right-0 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto ${styles.autocompleteContainer}`}>
                        {clientesFiltrados.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelecionarCliente(c)}
                            className={`w-full px-5 py-3.5 text-left flex flex-col justify-start transition-colors ${styles.autocompleteItem}`}
                          >
                            <span className="font-extrabold text-sm">{c.nome}</span>
                            <span className={`text-xs font-bold ${styles.autocompleteTextMuted}`}>{c.telefone || 'Sem telefone'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Telefone/WhatsApp *</label>
                      <input
                        type="text"
                        required
                        value={cliente.telefone}
                        onChange={(e) => {
                          setCliente({ ...cliente, telefone: e.target.value });
                          setShowAutocomplete(true);
                        }}
                        onFocus={() => setShowAutocomplete(true)}
                        placeholder="Ex: (11) 99999-9999"
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>CPF</label>
                      <input
                        type="text"
                        value={cliente.cpf}
                        onChange={(e) => setCliente({ ...cliente, cpf: e.target.value })}
                        placeholder="Ex: 123.456.789-00"
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>E-mail</label>
                      <input
                        type="email"
                        value={cliente.email}
                        onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                        placeholder="cliente@email.com"
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: DISPOSITIVO */}
              {activeTab === 'equipamento' && (() => {
                return (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Tipo do Aparelho / Veículo</label>
                        <select
                          value={equipamento.tipo}
                          onChange={(e) => setEquipamento({ ...equipamento, tipo: e.target.value })}
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none cursor-pointer shadow-inner ${styles.formInput}`}
                        >
                          {(segmentoOS === 'geral' || segmentoOS === 'eletronicos') && (
                            <>
                              <option value="Celular">📱 Celular</option>
                              <option value="Tablet">📟 Tablet</option>
                              <option value="Notebook">💻 Notebook</option>
                              <option value="Smartwatch">⌚ Smartwatch</option>
                            </>
                          )}
                          {(segmentoOS === 'geral' || segmentoOS === 'automotivo') && (
                            <>
                              <option value="Carro">🚗 Carro</option>
                              <option value="Moto">🏍️ Moto</option>
                              <option value="Caminhão">🚚 Caminhão</option>
                              <option value="Utilitário">🚙 Utilitário / SUV</option>
                            </>
                          )}
                          <option value="Outros">🔌 Outros / Diversos</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Marca *</label>
                        <input
                          type="text"
                          required
                          value={equipamento.marca}
                          onChange={(e) => setEquipamento({ ...equipamento, marca: e.target.value })}
                          placeholder={isVeiculo ? "Ex: Ford, Chevrolet, Honda" : "Ex: Apple, Samsung, Dell"}
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Modelo *</label>
                        <input
                          type="text"
                          required
                          value={equipamento.modelo}
                          onChange={(e) => setEquipamento({ ...equipamento, modelo: e.target.value })}
                          placeholder={isVeiculo ? "Ex: Fiesta 1.6, Civic" : "Ex: iPhone 13 Pro, S23 Ultra"}
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>
                          {isVeiculo ? 'Chassi' : 'Nº de Série / IMEI 1'}
                        </label>
                        <input
                          type="text"
                          value={equipamento.nSerieOrImei}
                          onChange={(e) => setEquipamento({ ...equipamento, nSerieOrImei: e.target.value })}
                          placeholder={isVeiculo ? "Número do chassi" : "Código identificador IMEI/Série"}
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                        />
                      </div>
                    </div>

                    {/* SEÇÃO DINÂMICA: ELETRÔNICOS / CELULARES */}
                    {!isVeiculo && (
                      <div className={`p-5 rounded-3xl border space-y-4 transition-colors duration-300 ${styles.nestedSection}`}>
                        <h4 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${styles.nestedSectionTitle}`}>
                          ⚙️ Detalhes do Dispositivo Eletrônico
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                          <div>
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Desbloqueio do Aparelho</label>
                            
                            {/* Toggle Tabs */}
                            <div className={`flex gap-1 p-1 rounded-xl w-fit mb-3 transition-colors duration-300 ${styles.toggleContainer}`}>
                              <button
                                type="button"
                                onClick={() => setTipoDesbloqueio('texto')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                  tipoDesbloqueio === 'texto'
                                    ? styles.toggleActive
                                    : styles.toggleInactive
                                  }`}
                              >
                                Senha Texto
                              </button>
                              <button
                                type="button"
                                onClick={() => setTipoDesbloqueio('desenho')}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                  tipoDesbloqueio === 'desenho'
                                    ? styles.toggleActive
                                    : styles.toggleInactive
                                  }`}
                              >
                                Padrão Desenho
                              </button>
                            </div>

                            {tipoDesbloqueio === 'texto' ? (
                              <input
                                type="text"
                                value={equipamento.senhaDesbloqueio || ''}
                                onChange={(e) => setEquipamento({ ...equipamento, senhaDesbloqueio: e.target.value })}
                                placeholder="Ex: 123456 ou 'Sem senha'"
                                className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                              />
                            ) : (
                              <PatternLock
                                value={equipamento.desenhoDesbloqueio || ''}
                                onChange={(val) => setEquipamento({ ...equipamento, desenhoDesbloqueio: val })}
                                isDark={isDark}
                              />
                            )}
                          </div>
                          <div>
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>IMEI 2 (Opcional)</label>
                            <input
                              type="text"
                              value={equipamento.imei2 || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, imei2: e.target.value })}
                              placeholder="Segundo IMEI (se houver)"
                              className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none transition-all shadow-inner ${styles.formInput}`}
                            />
                          </div>
                          <div>
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Backup Realizado?</label>
                            <select
                              value={equipamento.backupRealizado || 'nao_se_aplica'}
                              onChange={(e) => setEquipamento({ ...equipamento, backupRealizado: e.target.value })}
                              className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none cursor-pointer ${styles.formInput}`}
                            >
                              <option value="nao_se_aplica">🔌 Não se aplica</option>
                              <option value="sim">✅ Sim, backup feito</option>
                              <option value="nao">❌ Não realizado</option>
                              <option value="risco_cliente">⚠️ Cliente assume risco de perda de dados</option>
                            </select>
                          </div>
                        </div>

                        {/* Acessórios Deixados */}
                        <div>
                          <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-2 ${styles.formLabel}`}>Acessórios Deixados com o Aparelho</label>
                          <div className={`flex flex-wrap gap-4 text-xs font-bold p-4 rounded-2xl border transition-colors duration-300 ${styles.checkboxContainer}`}>
                            {[
                              { id: 'carregador', label: '🔌 Carregador' },
                              { id: 'cabo', label: '🎗️ Cabo USB' },
                              { id: 'capinha', label: '📱 Capinha/Case' },
                              { id: 'chip', label: '📟 Cartão SIM (Chip)' },
                              { id: 'memoria', label: '💾 Cartão de Memória' },
                              { id: 'fone', label: '🎧 Fone de Ouvido' }
                            ].map(acc => {
                              const list = equipamento.acessoriosDeixados || [];
                              const checked = list.includes(acc.id);
                              return (
                                <label key={acc.id} className="flex items-center gap-1.5 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const newList = e.target.checked
                                        ? [...list, acc.id]
                                        : list.filter(item => item !== acc.id);
                                      setEquipamento({ ...equipamento, acessoriosDeixados: newList });
                                    }}
                                    className="rounded border-white/10 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                  />
                                  <span>{acc.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO DINÂMICA: MECÂNICA / VEÍCULOS */}
                    {isVeiculo && (
                      <div className={`p-5 rounded-3xl border space-y-4 transition-colors duration-300 ${styles.nestedSection}`}>
                        <h4 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${styles.nestedSectionTitle}`}>
                          🚗 Detalhes do Veículo Automotivo
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div className="col-span-2 md:col-span-1">
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Placa *</label>
                            <input
                              type="text"
                              required
                              value={equipamento.placa || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, placa: e.target.value.toUpperCase() })}
                              placeholder="AAA-9999"
                              className={`w-full p-3.5 rounded-2xl text-xs font-black uppercase outline-none transition-all ${styles.formInput}`}
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>KM / Odômetro</label>
                            <input
                              type="number"
                              value={equipamento.quilometragem || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, quilometragem: e.target.value })}
                              placeholder="Ex: 85000"
                              className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none transition-all ${styles.formInput}`}
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Ano Modelo</label>
                            <input
                              type="text"
                              value={equipamento.ano || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, ano: e.target.value })}
                              placeholder="Ex: 2019/2020"
                              className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none transition-all ${styles.formInput}`}
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Motorização</label>
                            <input
                              type="text"
                              value={equipamento.motor || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, motor: e.target.value })}
                              placeholder="Ex: 1.6 Flex, 2.0 T"
                              className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none transition-all ${styles.formInput}`}
                            />
                          </div>
                          <div className="col-span-2 md:col-span-2">
                            <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Nível de Combustível</label>
                            <select
                              value={equipamento.nivelCombustivel || '1_2'}
                              onChange={(e) => setEquipamento({ ...equipamento, nivelCombustivel: e.target.value })}
                              className={`w-full p-3.5 rounded-2xl text-xs font-bold outline-none cursor-pointer ${styles.formInput}`}
                            >
                              <option value="reserva">⛽ Reserva (Pouco)</option>
                              <option value="1_4">⛽ 1/4 (Um Quarto)</option>
                              <option value="1_2">⛽ 1/2 (Meio Tanque)</option>
                              <option value="3_4">⛽ 3/4 (Três Quartos)</option>
                              <option value="cheio">⛽ Cheio (Tanque Cheio)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>
                        {isVeiculo ? 'Estado Físico / Avarias' : 'Estado Físico / Detalhes Visuais'}
                      </label>
                      <textarea
                        rows={2}
                        value={equipamento.estadoFisico}
                        onChange={(e) => setEquipamento({ ...equipamento, estadoFisico: e.target.value })}
                        placeholder={isVeiculo ? "Ex: Risco na porta traseira direita, parachoque arranhado..." : "Ex: Trincas, riscos, película quebrada, blindagens faltantes..."}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all resize-none shadow-inner ${styles.formInput}`}
                      />
                    </div>

                    {/* CHECKLIST DE INSPEÇÃO */}
                    <div className={`p-5 rounded-3xl border space-y-4 transition-colors duration-300 ${styles.nestedSection}`}>
                      <h4 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${styles.nestedSectionTitle}`}>
                        📋 Checklist de Inspeção de Entrada
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(isVeiculo
                          ? [
                              { id: 'farois', label: '💡 Faróis / Lanternas' },
                              { id: 'setas', label: '🔊 Setas / Buzina' },
                              { id: 'pneus', label: '🛞 Pneus / Rodas' },
                              { id: 'vidros', label: '🪟 Vidros / Travas' },
                              { id: 'oleo_agua', label: '🛢️ Nível Óleo / Água' },
                              { id: 'freios', label: '🛑 Freios / Suspensão' },
                              { id: 'ar_condicionado', label: '❄️ Ar Condicionado / Painel' }
                            ]
                          : [
                              { id: 'touch', label: '📱 Touch / Tela' },
                              { id: 'cam_frontal', label: '📸 Câmera Frontal' },
                              { id: 'cam_traseira', label: '📸 Câmera Traseira' },
                              { id: 'som', label: '🔊 Microfone / Áudio' },
                              { id: 'conector_carga', label: '🔌 Conector de Carga' },
                              { id: 'biometria', label: '🔐 Biometria / Face ID' },
                              { id: 'botoes', label: '🎛️ Botões Laterais' }
                            ]
                        ).map(item => {
                          const value = checklist[item.id] || 'nao_testado';
                          return (
                            <div key={item.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-colors duration-300 ${styles.checklistRow}`}>
                              <span className="text-xs font-bold truncate mr-2">{item.label}</span>
                              <div className={`flex p-0.5 rounded-xl border transition-colors duration-300 ${styles.checklistBtnWrapper}`}>
                                {[
                                  { id: 'ok', label: 'OK', bg: 'bg-emerald-600/80 text-white shadow-md shadow-emerald-500/10' },
                                  { id: 'defeito', label: 'Defeito', bg: 'bg-rose-600/80 text-white shadow-md shadow-rose-500/10' },
                                  { id: 'nao_testado', label: 'N/T', bg: styles.checklistBtnNT }
                                ].map(opt => {
                                  const active = value === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setChecklist(prev => ({ ...prev, [item.id]: opt.id }))}
                                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${
                                        active ? (opt.id === 'nao_testado' ? styles.checklistBtnNT : opt.bg) : styles.checklistBtnInactive
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* REGISTRO FOTOGRÁFICO */}
                    <div className={`p-5 rounded-3xl border space-y-4 transition-colors duration-300 ${styles.nestedSection}`}>
                      <h4 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${styles.nestedSectionTitle}`}>
                        📸 Registro Visual (Fotos do Aparelho/Veículo)
                      </h4>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {fotos.map((url, idx) => (
                          <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-zinc-950 flex items-center justify-center group">
                            <img src={url} alt={`Foto OS ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFotos(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1.5 right-1.5 p-1 bg-red-600 text-white hover:bg-red-700 rounded-lg shadow transition-all active:scale-95 border border-white/5"
                            >
                              <IoClose size={14} />
                            </button>
                          </div>
                        ))}
                        
                        {fotos.length < 4 && (
                          <label className={`aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${styles.photoUploadBox}`}>
                            {uploadingFoto ? (
                              <div className="animate-spin w-5 h-5 border-2 border-white/15 border-t-indigo-500 rounded-full" />
                            ) : (
                              <>
                                <span className="text-[20px] font-bold">+</span>
                                <span className="text-[9px] font-black uppercase tracking-wider mt-1">Anexar Foto</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingFoto}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingFoto(true);
                                try {
                                  const path = `estabelecimentos/${estabelecimentoId}/ordensServico/${osId || 'temp'}`;
                                  const url = await uploadFile(file, path);
                                  setFotos(prev => [...prev, url]);
                                  toast.success("Foto carregada com sucesso!");
                                } catch (err) {
                                  toast.error("Erro ao fazer upload da imagem.");
                                } finally {
                                  setUploadingFoto(false);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider ${styles.formLabel}`}>* Você pode anexar até 4 fotos do estado físico na entrada.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Defeito Relatado pelo Cliente</label>
                        <textarea
                          rows={3}
                          value={defeitoRelatado}
                          onChange={(e) => setDefeitoRelatado(e.target.value)}
                          placeholder="O que o cliente relatou que acontece?"
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all resize-none placeholder:text-zinc-500 shadow-inner ${styles.formInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Defeito Detectado (Técnico)</label>
                        <textarea
                          rows={3}
                          value={defeitoDetectado}
                          onChange={(e) => setDefeitoDetectado(e.target.value)}
                          placeholder="O que os testes técnicos apontaram?"
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all resize-none placeholder:text-zinc-500 shadow-inner ${styles.formInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Laudo / Diagnóstico Final</label>
                        <textarea
                          rows={3}
                          value={diagnosticoTecnico}
                          onChange={(e) => setDiagnosticoTecnico(e.target.value)}
                          placeholder="Serviço ou reparo sugerido"
                          className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none transition-all resize-none placeholder:text-zinc-500 shadow-inner ${styles.formInput}`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 3: SERVIÇOS & PEÇAS */}
              {activeTab === 'servicos' && (
                <div className="space-y-6">
                  {/* Serviços */}
                  <div className={`p-5 rounded-3xl border space-y-4 transition-colors duration-300 ${styles.nestedSection}`}>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${styles.nestedSectionTitle}`}>🛠️ Adicionar Serviços (Mão de Obra)</h3>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative flex flex-col">
                        <input
                          type="text"
                          value={novoServico.descricao}
                          onChange={(e) => {
                            setNovoServico({ ...novoServico, descricao: e.target.value });
                            setShowServicoAutocomplete(true);
                          }}
                          onFocus={() => setShowServicoAutocomplete(true)}
                          onBlur={() => setTimeout(() => setShowServicoAutocomplete(false), 205)}
                          placeholder="Descrição do serviço ou busque no catálogo..."
                          className={`w-full p-3 rounded-xl text-xs font-bold outline-none placeholder:text-zinc-500 ${styles.formInput}`}
                        />
                        {showServicoAutocomplete && servicosCatalogoFiltrados.length > 0 && (
                          <div className={`absolute top-[46px] left-0 right-0 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto ${styles.autocompleteContainer}`}>
                            {servicosCatalogoFiltrados.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelecionarServicoCatalogo(p);
                                }}
                                className={`w-full px-4 py-2.5 text-left flex justify-between items-center transition-colors ${styles.autocompleteItem}`}
                              >
                                <span className="font-extrabold text-xs">
                                  {p.name}
                                  {p.categoriaNome && (
                                    <span className="text-[9px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded ml-2 font-normal uppercase tracking-wider">
                                      {p.categoriaNome}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-emerald-500 font-black">R$ {p.price.toFixed(2)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        value={novoServico.valor}
                        onChange={(e) => setNovoServico({ ...novoServico, valor: e.target.value })}
                        placeholder="Valor R$"
                        className={`w-full sm:w-32 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-zinc-500 ${styles.formInput}`}
                      />
                      <button
                        type="button"
                        onClick={handleAddServico}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0"
                      >
                        <IoAdd size={16} /> Incluir
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        id="salvarServicoNoCatalogo"
                        checked={salvarServicoNoCatalogo}
                        onChange={(e) => setSalvarServicoNoCatalogo(e.target.checked)}
                        className="rounded border-white/10 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="salvarServicoNoCatalogo" className={`text-[11px] font-extrabold cursor-pointer select-none ${styles.formLabel}`}>
                        💾 Salvar este serviço no catálogo (para uso futuro)
                      </label>
                    </div>

                    {servicos.length > 0 && (
                      <div className={`rounded-2xl border overflow-hidden ${styles.tableBorder}`}>
                        <table className="w-full text-xs">
                           <thead>
                            <tr className={`font-extrabold uppercase text-[9px] ${styles.tableHeaderRow}`}>
                              <th className="p-3 text-left">Serviço/Mão de Obra</th>
                              <th className="p-3 text-right w-28">Preço</th>
                              <th className="p-3 text-center w-16">Ação</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y font-bold ${styles.tableRowBorder}`}>
                            {servicos.map((s, idx) => (
                              <tr key={idx}>
                                <td className="p-3">{s.descricao}</td>
                                <td className={`p-3 text-right font-black ${styles.tableTextWhite}`}>R$ {parseFloat(s.valor).toFixed(2)}</td>
                                <td className="p-3 text-center">
                                  <button type="button" onClick={() => handleRemoverServico(idx)} className="text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg"><IoTrash size={16} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Peças */}
                  <div className={`p-5 rounded-3xl border space-y-4 transition-colors duration-300 ${styles.nestedSection}`}>
                    <h3 className={`text-xs font-black uppercase tracking-wider ${styles.nestedSectionTitle}`}>📦 Adicionar Peças / Componentes</h3>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative flex flex-col">
                        <input
                          type="text"
                          value={novaPeca.nome}
                          onChange={(e) => {
                            setNovaPeca({ ...novaPeca, nome: e.target.value });
                            setShowPecaAutocomplete(true);
                          }}
                          onFocus={() => setShowPecaAutocomplete(true)}
                          onBlur={() => setTimeout(() => setShowPecaAutocomplete(false), 205)}
                          placeholder="Nome da peça ou busque no catálogo..."
                          className={`w-full p-3 rounded-xl text-xs font-bold outline-none placeholder:text-zinc-500 ${styles.formInput}`}
                        />
                        {showPecaAutocomplete && pecasCatalogoFiltradas.length > 0 && (
                          <div className={`absolute top-[46px] left-0 right-0 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto ${styles.autocompleteContainer}`}>
                            {pecasCatalogoFiltradas.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelecionarPecaCatalogo(p);
                                }}
                                className={`w-full px-4 py-2.5 text-left flex justify-between items-center transition-colors ${styles.autocompleteItem}`}
                              >
                                <span className="font-extrabold text-xs">
                                  {p.name}
                                  {p.categoriaNome && (
                                    <span className="text-[9px] bg-white/5 text-zinc-400 px-1.5 py-0.5 rounded ml-2 font-normal uppercase tracking-wider">
                                      {p.categoriaNome}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-emerald-500 font-black">R$ {p.price.toFixed(2)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        value={novaPeca.valor}
                        onChange={(e) => setNovaPeca({ ...novaPeca, valor: e.target.value })}
                        placeholder="Valor R$"
                        className={`w-full sm:w-32 p-3 rounded-xl text-xs font-bold outline-none placeholder:text-zinc-500 ${styles.formInput}`}
                      />
                      <button
                        type="button"
                        onClick={handleAddPeca}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center justify-center gap-1 active:scale-95 transition-all shrink-0"
                      >
                        <IoAdd size={16} /> Incluir
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        id="salvarPecaNoCatalogo"
                        checked={salvarPecaNoCatalogo}
                        onChange={(e) => setSalvarPecaNoCatalogo(e.target.checked)}
                        className="rounded border-white/10 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="salvarPecaNoCatalogo" className={`text-[11px] font-extrabold cursor-pointer select-none ${styles.formLabel}`}>
                        💾 Salvar esta peça no catálogo (para uso futuro)
                      </label>
                    </div>

                    {pecas.length > 0 && (
                      <div className={`rounded-2xl border overflow-hidden ${styles.tableBorder}`}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className={`font-extrabold uppercase text-[9px] ${styles.tableHeaderRow}`}>
                              <th className="p-3 text-left">Peça / Componente</th>
                              <th className="p-3 text-right w-28">Preço</th>
                              <th className="p-3 text-center w-16">Ação</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y font-bold ${styles.tableRowBorder}`}>
                            {pecas.map((p, idx) => (
                              <tr key={idx}>
                                <td className="p-3">{p.nome}</td>
                                <td className={`p-3 text-right font-black ${styles.tableTextWhite}`}>R$ {parseFloat(p.valor).toFixed(2)}</td>
                                <td className="p-3 text-center">
                                  <button type="button" onClick={() => handleRemoverPeca(idx)} className="text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg"><IoTrash size={16} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: FINANCEIRO & STATUS */}
              {activeTab === 'financeiro' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Status Técnico OS</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none cursor-pointer ${styles.formInput}`}
                      >
                        <option value="em_analise">🔍 Em Análise</option>
                        <option value="aguardando_orcamento">⏳ Aguardando Aprovação</option>
                        <option value="orcamento_aprovado">🟢 Orçamento Aprovado</option>
                        <option value="orcamento_rejeitado">🔴 Orçamento Rejeitado</option>
                        <option value="em_manutencao">🔧 Em Manutenção</option>
                        <option value="pronto">✅ Pronto / Concluído</option>
                        <option value="entregue">📦 Entregue</option>
                        <option value="sem_conserto">❌ Sem Conserto</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Técnico Responsável</label>
                      <select
                        value={tecnicoResponsavel.nome}
                        onChange={(e) => setTecnicoResponsavel({ id: 'tecnico_1', nome: e.target.value })}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none cursor-pointer ${styles.formInput}`}
                      >
                        <option value="Técnico Geral">Técnico Geral</option>
                        <option value="Guilherme Técnico">Guilherme Técnico</option>
                        <option value="Matheus Jardim">Matheus Jardim</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Garantia (Dias)</label>
                      <input
                        type="number"
                        value={garantiaDias}
                        onChange={(e) => setGarantiaDias(e.target.value)}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none ${styles.formInput}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Previsão de Entrega</label>
                      <input
                        type="date"
                        value={previsaoEntrega}
                        onChange={(e) => setPrevisaoEntrega(e.target.value)}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none cursor-pointer ${styles.formInput}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Desconto (R$)</label>
                      <input
                        type="number"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none ${styles.formInput}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Situação Financeira</label>
                      <select
                        value={situacaoFinanceira}
                        onChange={(e) => setSituacaoFinanceira(e.target.value)}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none cursor-pointer ${styles.formInput}`}
                      >
                        <option value="pendente">⏳ Pagamento Pendente</option>
                        <option value="pago">💵 Totalmente Pago</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-[10px] font-extrabold uppercase tracking-widest mb-1.5 ${styles.formLabel}`}>Forma de Pagamento</label>
                      <select
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value)}
                        className={`w-full p-3.5 rounded-2xl text-sm font-bold outline-none cursor-pointer ${styles.formInput}`}
                      >
                        <option value="Pix">Pix</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                      </select>
                    </div>
                  </div>

                  {/* Resumo de Valores */}
                  <div className={`rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4 transition-colors duration-300 ${styles.pricingSummary}`}>
                    <div className={`text-center sm:text-left text-xs font-bold space-y-1 ${styles.pricingMuted}`}>
                      <p>Mão de Obra: <span className="font-extrabold text-indigo-500">R$ {valorServicos.toFixed(2)}</span></p>
                      <p>Peças Aplicadas: <span className="font-extrabold text-blue-500">R$ {valorPecas.toFixed(2)}</span></p>
                      <p>Desconto Aplicado: <span className="font-extrabold text-rose-500">R$ {Number(desconto).toFixed(2)}</span></p>
                    </div>
                    
                    <div className="text-center sm:text-right">
                      <p className={`text-[10px] font-black uppercase tracking-wider ${styles.pricingMuted}`}>Valor Total Líquido</p>
                      <p className="text-3xl font-black mt-1">R$ {total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION FOOTER */}
              <div className={`flex justify-end gap-3 pt-5 border-t shrink-0 ${styles.footerBorder}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-6 py-3 border rounded-xl text-xs font-black transition-all active:scale-95 ${styles.footerCancelBtn}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-indigo-600 text-white hover:bg-indigo-550 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl text-xs font-black shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  {saving ? 'Gravando...' : (osId ? 'Salvar Alterações' : 'Criar Ficha OS')}
                </button>
              </div>

            </form>
          )}
        </div>

      </div>
    </div>
  );
}

const PatternLock = ({ value, onChange, isDark = true }) => {
  const points = React.useMemo(() => (value ? value.split('-').map(Number) : []), [value]);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const containerRef = React.useRef(null);

  const coords = [
    { x: 15, y: 15 },  { x: 50, y: 15 },  { x: 85, y: 15 },
    { x: 15, y: 50 },  { x: 50, y: 50 },  { x: 85, y: 50 },
    { x: 15, y: 85 },  { x: 50, y: 85 },  { x: 85, y: 85 }
  ];

  const handleStart = (idx) => {
    setIsDrawing(true);
    onChange(String(idx));
  };

  const handleEnter = (idx) => {
    if (!isDrawing) return;
    if (points.includes(idx)) return;
    const newPoints = [...points, idx];
    onChange(newPoints.join('-'));
  };

  const handleTouchMove = (e) => {
    if (!isDrawing) return;
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    for (const el of elements) {
      const idxAttr = el.getAttribute('data-dot-index');
      if (idxAttr !== null) {
        const idx = Number(idxAttr);
        if (!points.includes(idx)) {
          const newPoints = [...points, idx];
          onChange(newPoints.join('-'));
        }
        break;
      }
    }
  };

  const handleDotClick = (idx) => {
    if (isDrawing) return;
    if (points.includes(idx)) {
      if (points[points.length - 1] === idx) {
        const newPoints = points.slice(0, -1);
        onChange(newPoints.join('-'));
      }
      return;
    }
    const newPoints = [...points, idx];
    onChange(newPoints.join('-'));
  };

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDrawing(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  return (
    <div className={`flex flex-col items-center gap-3 p-4 rounded-3xl border w-full max-w-[240px] mx-auto transition-colors duration-300 ${
      isDark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-50 border-slate-200'
    }`}>
      <div 
        ref={containerRef}
        onTouchMove={handleTouchMove}
        className={`relative w-44 h-44 select-none touch-none rounded-2xl border p-2 shadow-inner transition-colors duration-300 ${
          isDark ? 'bg-zinc-950 border-white/10' : 'bg-white border-slate-200'
        }`}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          {points.map((pt, i) => {
            if (i === 0) return null;
            const prev = coords[points[i - 1]];
            const curr = coords[pt];
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={curr.x}
                y2={curr.y}
                stroke="#6366f1"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        <div className="grid grid-cols-3 gap-2.5 h-full w-full">
          {coords.map((c, idx) => {
            const isSelected = points.includes(idx);
            const order = points.indexOf(idx);
            return (
              <button
                type="button"
                key={idx}
                data-dot-index={idx}
                onMouseDown={() => handleStart(idx)}
                onMouseEnter={() => handleEnter(idx)}
                onTouchStart={() => handleStart(idx)}
                onClick={() => handleDotClick(idx)}
                className="relative flex items-center justify-center focus:outline-none w-full h-full"
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div 
                  data-dot-index={idx}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isSelected ? 'bg-indigo-500/10 border border-indigo-500 scale-105 shadow-md shadow-indigo-500/20' : (isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100')
                  }`}
                >
                  <div 
                    data-dot-index={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                      isSelected ? 'bg-indigo-400' : (isDark ? 'bg-zinc-700' : 'bg-slate-300')
                    }`} 
                  />
                </div>
                {isSelected && (
                  <span className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[7px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {order + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => onChange('')}
        className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border ${
          isDark
            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/5'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
        }`}
      >
        Limpar Padrão
      </button>
    </div>
  );
};
