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

export default function ModalOrdemServico({ isOpen, onClose, estabelecimentoId, osId = null, onSaved }) {
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

  // --- FORM STATES ---
  const [cliente, setCliente] = useState({ nome: '', telefone: '', cpf: '', email: '' });
  const [equipamento, setEquipamento] = useState({
    tipo: 'Celular',
    marca: '',
    modelo: '',
    nSerieOrImei: '',
    estadoFisico: '',
    senhaDesbloqueio: '',
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

  const isVeiculo = useMemo(() => {
    return ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(equipamento.tipo);
  }, [equipamento.tipo]);

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
      setEquipamento({
        tipo: defaultTipo,
        marca: '',
        modelo: '',
        nSerieOrImei: '',
        estadoFisico: '',
        senhaDesbloqueio: '',
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

  // Autocomplete filter
  const clientesFiltrados = useMemo(() => {
    if (!cliente.nome || cliente.nome.length < 2) return [];
    return clientesDisponiveis.filter(c => 
      c.nome?.toLowerCase().includes(cliente.nome.toLowerCase()) ||
      c.telefone?.includes(cliente.nome)
    );
  }, [cliente.nome, clientesDisponiveis]);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-3 sm:p-6 font-sans">
      <div className="bg-white w-full max-w-4xl h-[92vh] sm:h-[88vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <IoBuildOutline size={20} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">{osId ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h2>
              <p className="text-xs text-slate-300 font-semibold">{osId ? 'Atualize as informações técnicas e financeiras' : 'Abra uma nova ficha de assistência técnica'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <IoClose size={24} />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex bg-slate-50 border-b border-slate-200/80 px-6 py-2 shrink-0 gap-1 overflow-x-auto no-scrollbar">
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
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-500 hover:bg-slate-200/60 hover:text-slate-700'
                }`}
              >
                <ActiveIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin w-10 h-10 border-4 border-slate-300 border-t-slate-800 rounded-full mb-2"></div>
              <p className="text-xs font-bold text-slate-500">Carregando OS...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              
              {/* TAB 1: CLIENTE */}
              {activeTab === 'cliente' && (
                <div className="space-y-5">
                  <div className="relative">
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Nome Completo *</label>
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
                      className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && clientesFiltrados.length > 0 && (
                      <div className="absolute top-[72px] left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                        {clientesFiltrados.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelecionarCliente(c)}
                            className="w-full px-5 py-3.5 text-left border-b border-slate-100 hover:bg-slate-50 flex flex-col justify-start transition-colors"
                          >
                            <span className="font-extrabold text-sm text-slate-800">{c.nome}</span>
                            <span className="text-xs text-slate-450 font-bold">{c.telefone || 'Sem telefone'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Telefone/WhatsApp *</label>
                      <input
                        type="text"
                        required
                        value={cliente.telefone}
                        onChange={(e) => setCliente({ ...cliente, telefone: e.target.value })}
                        placeholder="Ex: (11) 99999-9999"
                        className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">CPF</label>
                      <input
                        type="text"
                        value={cliente.cpf}
                        onChange={(e) => setCliente({ ...cliente, cpf: e.target.value })}
                        placeholder="Ex: 123.456.789-00"
                        className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">E-mail</label>
                      <input
                        type="email"
                        value={cliente.email}
                        onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
                        placeholder="cliente@email.com"
                        className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
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
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Tipo do Aparelho / Veículo</label>
                        <select
                          value={equipamento.tipo}
                          onChange={(e) => setEquipamento({ ...equipamento, tipo: e.target.value })}
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 cursor-pointer shadow-sm"
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
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Marca *</label>
                        <input
                          type="text"
                          required
                          value={equipamento.marca}
                          onChange={(e) => setEquipamento({ ...equipamento, marca: e.target.value })}
                          placeholder={isVeiculo ? "Ex: Ford, Chevrolet, Honda" : "Ex: Apple, Samsung, Dell"}
                          className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Modelo *</label>
                        <input
                          type="text"
                          required
                          value={equipamento.modelo}
                          onChange={(e) => setEquipamento({ ...equipamento, modelo: e.target.value })}
                          placeholder={isVeiculo ? "Ex: Fiesta 1.6, Civic" : "Ex: iPhone 13 Pro, S23 Ultra"}
                          className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">
                          {isVeiculo ? 'Chassi' : 'Nº de Série / IMEI 1'}
                        </label>
                        <input
                          type="text"
                          value={equipamento.nSerieOrImei}
                          onChange={(e) => setEquipamento({ ...equipamento, nSerieOrImei: e.target.value })}
                          placeholder={isVeiculo ? "Número do chassi" : "Código identificador IMEI/Série"}
                          className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm"
                        />
                      </div>
                    </div>

                    {/* SEÇÃO DINÂMICA: ELETRÔNICOS / CELULARES */}
                    {!isVeiculo && (
                      <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-200/50 space-y-4">
                        <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          ⚙️ Detalhes do Dispositivo Eletrônico
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Senha / Padrão de Desbloqueio</label>
                            <input
                              type="text"
                              value={equipamento.senhaDesbloqueio || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, senhaDesbloqueio: e.target.value })}
                              placeholder="Ex: 123456 ou 'Padrão em L'"
                              className="w-full p-3.5 bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">IMEI 2 (Opcional)</label>
                            <input
                              type="text"
                              value={equipamento.imei2 || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, imei2: e.target.value })}
                              placeholder="Segundo IMEI (se houver)"
                              className="w-full p-3.5 bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Backup Realizado?</label>
                            <select
                              value={equipamento.backupRealizado || 'nao_se_aplica'}
                              onChange={(e) => setEquipamento({ ...equipamento, backupRealizado: e.target.value })}
                              className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
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
                          <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-2">Acessórios Deixados com o Aparelho</label>
                          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-650 bg-white p-4 rounded-2xl border border-slate-200">
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
                                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-500 w-4 h-4 cursor-pointer"
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
                      <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-200/50 space-y-4">
                        <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                          🚗 Detalhes do Veículo Automotivo
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Placa *</label>
                            <input
                              type="text"
                              required
                              value={equipamento.placa || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, placa: e.target.value.toUpperCase() })}
                              placeholder="AAA-9999"
                              className="w-full p-3.5 bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-black text-slate-750 uppercase outline-none transition-all"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">KM / Odômetro</label>
                            <input
                              type="number"
                              value={equipamento.quilometragem || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, quilometragem: e.target.value })}
                              placeholder="Ex: 85000"
                              className="w-full p-3.5 bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Ano Modelo</label>
                            <input
                              type="text"
                              value={equipamento.ano || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, ano: e.target.value })}
                              placeholder="Ex: 2019/2020"
                              className="w-full p-3.5 bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-1">
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Motorização</label>
                            <input
                              type="text"
                              value={equipamento.motor || ''}
                              onChange={(e) => setEquipamento({ ...equipamento, motor: e.target.value })}
                              placeholder="Ex: 1.6 Flex, 2.0 T"
                              className="w-full p-3.5 bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-xs font-bold text-slate-700 outline-none transition-all"
                            />
                          </div>
                          <div className="col-span-2 md:col-span-2">
                            <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Nível de Combustível</label>
                            <select
                              value={equipamento.nivelCombustivel || '1_2'}
                              onChange={(e) => setEquipamento({ ...equipamento, nivelCombustivel: e.target.value })}
                              className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
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
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">
                        {isVeiculo ? 'Estado Físico / Avarias' : 'Estado Físico / Detalhes Visuais'}
                      </label>
                      <textarea
                        rows={2}
                        value={equipamento.estadoFisico}
                        onChange={(e) => setEquipamento({ ...equipamento, estadoFisico: e.target.value })}
                        placeholder={isVeiculo ? "Ex: Risco na porta traseira direita, parachoque arranhado..." : "Ex: Trincas, riscos, película quebrada, blindagens faltantes..."}
                        className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm resize-none"
                      />
                    </div>

                    {/* CHECKLIST DE INSPEÇÃO */}
                    <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-200/50 space-y-4">
                      <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
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
                            <div key={item.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-150">
                              <span className="text-xs font-bold text-slate-650 truncate mr-2">{item.label}</span>
                              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                                {[
                                  { id: 'ok', label: 'OK', bg: 'bg-emerald-500 text-white shadow-sm' },
                                  { id: 'defeito', label: 'Defeito', bg: 'bg-rose-500 text-white shadow-sm' },
                                  { id: 'nao_testado', label: 'N/T', bg: 'bg-slate-400 text-white shadow-sm' }
                                ].map(opt => {
                                  const active = value === opt.id;
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => setChecklist(prev => ({ ...prev, [item.id]: opt.id }))}
                                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all ${
                                        active ? opt.bg : 'text-slate-500 hover:text-slate-700'
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
                    <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-200/50 space-y-4">
                      <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        📸 Registro Visual (Fotos do Aparelho/Veículo)
                      </h4>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {fotos.map((url, idx) => (
                          <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-slate-250 bg-slate-100 flex items-center justify-center group">
                            <img src={url} alt={`Foto OS ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setFotos(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white hover:bg-red-650 rounded-lg shadow transition-all active:scale-95"
                            >
                              <IoClose size={14} />
                            </button>
                          </div>
                        ))}
                        
                        {fotos.length < 4 && (
                          <label className="aspect-video rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 flex flex-col items-center justify-center cursor-pointer bg-white transition-colors">
                            {uploadingFoto ? (
                              <div className="animate-spin w-5 h-5 border-2 border-slate-300 border-t-slate-800 rounded-full" />
                            ) : (
                              <>
                                <span className="text-[20px] text-slate-400 font-bold">+</span>
                                <span className="text-[9px] font-black text-slate-450 uppercase tracking-wider mt-1">Anexar Foto</span>
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
                      <p className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">* Você pode anexar até 4 fotos do estado físico na entrada.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Defeito Relatado pelo Cliente</label>
                        <textarea
                          rows={3}
                          value={defeitoRelatado}
                          onChange={(e) => setDefeitoRelatado(e.target.value)}
                          placeholder="O que o cliente relatou que acontece?"
                          className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Defeito Detectado (Técnico)</label>
                        <textarea
                          rows={3}
                          value={defeitoDetectado}
                          onChange={(e) => setDefeitoDetectado(e.target.value)}
                          placeholder="O que os testes técnicos apontaram?"
                          className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Laudo / Diagnóstico Final</label>
                        <textarea
                          rows={3}
                          value={diagnosticoTecnico}
                          onChange={(e) => setDiagnosticoTecnico(e.target.value)}
                          placeholder="Serviço ou reparo sugerido"
                          className="w-full p-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:ring-4 focus:ring-slate-500/10 focus:border-slate-500 rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all shadow-sm resize-none"
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
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">🛠️ Adicionar Serviços (Mão de Obra)</h3>
                    
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
                          onBlur={() => setTimeout(() => setShowServicoAutocomplete(false), 200)}
                          placeholder="Descrição do serviço ou busque no catálogo..."
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        />
                        {showServicoAutocomplete && servicosCatalogoFiltrados.length > 0 && (
                          <div className="absolute top-[46px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                            {servicosCatalogoFiltrados.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelecionarServicoCatalogo(p);
                                }}
                                className="w-full px-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 flex justify-between items-center transition-colors"
                              >
                                <span className="font-extrabold text-xs text-slate-800">
                                  {p.name}
                                  {p.categoriaNome && (
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2 font-normal uppercase tracking-wider">
                                      {p.categoriaNome}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-black">R$ {p.price.toFixed(2)}</span>
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
                        className="w-full sm:w-32 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddServico}
                        className="bg-slate-800 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center justify-center gap-1 hover:bg-slate-900 active:scale-95 transition-all shrink-0"
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
                        className="rounded border-slate-300 text-slate-850 focus:ring-slate-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="salvarServicoNoCatalogo" className="text-[11px] font-extrabold text-slate-500 cursor-pointer select-none">
                        💾 Salvar este serviço no catálogo (para uso futuro)
                      </label>
                    </div>

                    {servicos.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-xs">
                           <thead>
                            <tr className="bg-slate-100 text-slate-500 font-extrabold uppercase text-[9px] border-b border-slate-150">
                              <th className="p-3 text-left">Serviço/Mão de Obra</th>
                              <th className="p-3 text-right w-28">Preço</th>
                              <th className="p-3 text-center w-16">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {servicos.map((s, idx) => (
                              <tr key={idx}>
                                <td className="p-3">{s.descricao}</td>
                                <td className="p-3 text-right text-slate-900">R$ {parseFloat(s.valor).toFixed(2)}</td>
                                <td className="p-3 text-center">
                                  <button type="button" onClick={() => handleRemoverServico(idx)} className="text-red-500 p-1 hover:bg-red-50 rounded-lg"><IoTrash size={16} /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Peças */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 space-y-4">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">📦 Adicionar Peças / Componentes</h3>
                    
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
                          onBlur={() => setTimeout(() => setShowPecaAutocomplete(false), 200)}
                          placeholder="Nome da peça ou busque no catálogo..."
                          className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                        />
                        {showPecaAutocomplete && pecasCatalogoFiltradas.length > 0 && (
                          <div className="absolute top-[46px] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                            {pecasCatalogoFiltradas.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelecionarPecaCatalogo(p);
                                }}
                                className="w-full px-4 py-2.5 text-left border-b border-slate-100 hover:bg-slate-50 flex justify-between items-center transition-colors"
                              >
                                <span className="font-extrabold text-xs text-slate-800">
                                  {p.name}
                                  {p.categoriaNome && (
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded ml-2 font-normal uppercase tracking-wider">
                                      {p.categoriaNome}
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-black">R$ {p.price.toFixed(2)}</span>
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
                        className="w-full sm:w-32 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddPeca}
                        className="bg-slate-800 text-white font-black text-xs px-4 py-3 rounded-xl flex items-center justify-center gap-1 hover:bg-slate-900 active:scale-95 transition-all shrink-0"
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
                        className="rounded border-slate-300 text-slate-850 focus:ring-slate-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="salvarPecaNoCatalogo" className="text-[11px] font-extrabold text-slate-500 cursor-pointer select-none">
                        💾 Salvar esta peça no catálogo (para uso futuro)
                      </label>
                    </div>

                    {pecas.length > 0 && (
                      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-100 text-slate-500 font-extrabold uppercase text-[9px] border-b border-slate-150">
                              <th className="p-3 text-left">Peça / Componente</th>
                              <th className="p-3 text-right w-28">Preço</th>
                              <th className="p-3 text-center w-16">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                            {pecas.map((p, idx) => (
                              <tr key={idx}>
                                <td className="p-3">{p.nome}</td>
                                <td className="p-3 text-right text-slate-900">R$ {parseFloat(p.valor).toFixed(2)}</td>
                                <td className="p-3 text-center">
                                  <button type="button" onClick={() => handleRemoverPeca(idx)} className="text-red-500 p-1 hover:bg-red-50 rounded-lg"><IoTrash size={16} /></button>
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
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Status Técnico OS</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer"
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
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Técnico Responsável</label>
                      <select
                        value={tecnicoResponsavel.nome}
                        onChange={(e) => setTecnicoResponsavel({ id: 'tecnico_1', nome: e.target.value })}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="Técnico Geral">Técnico Geral</option>
                        <option value="Guilherme Técnico">Guilherme Técnico</option>
                        <option value="Matheus Jardim">Matheus Jardim</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Garantia (Dias)</label>
                      <input
                        type="number"
                        value={garantiaDias}
                        onChange={(e) => setGarantiaDias(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Previsão de Entrega</label>
                      <input
                        type="date"
                        value={previsaoEntrega}
                        onChange={(e) => setPrevisaoEntrega(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Desconto (R$)</label>
                      <input
                        type="number"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Situação Financeira</label>
                      <select
                        value={situacaoFinanceira}
                        onChange={(e) => setSituacaoFinanceira(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="pendente">⏳ Pagamento Pendente</option>
                        <option value="pago">💵 Totalmente Pago</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">Forma de Pagamento</label>
                      <select
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value)}
                        className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer"
                      >
                        <option value="Pix">Pix</option>
                        <option value="Dinheiro">Dinheiro</option>
                        <option value="Cartão de Crédito">Cartão de Crédito</option>
                        <option value="Cartão de Débito">Cartão de Débito</option>
                      </select>
                    </div>
                  </div>

                  {/* Resumo de Valores */}
                  <div className="bg-slate-50 border-2 border-slate-200/60 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-center sm:text-left text-xs font-bold text-slate-500 space-y-1">
                      <p>Mão de Obra: <span className="font-extrabold text-slate-800">R$ {valorServicos.toFixed(2)}</span></p>
                      <p>Peças Aplicadas: <span className="font-extrabold text-slate-800">R$ {valorPecas.toFixed(2)}</span></p>
                      <p>Desconto Aplicado: <span className="font-extrabold text-red-500">R$ {Number(desconto).toFixed(2)}</span></p>
                    </div>
                    
                    <div className="text-center sm:text-right">
                      <p className="text-[10px] font-black text-slate-450 uppercase tracking-wider">Valor Total Líquido</p>
                      <p className="text-3xl font-black text-slate-800 mt-1">R$ {total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTION FOOTER */}
              <div className="flex justify-end gap-3 pt-5 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-xs font-black transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-3 bg-slate-800 text-white hover:bg-slate-900 disabled:bg-slate-300 rounded-xl text-xs font-black shadow-lg active:scale-95 transition-all"
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
