import { useState, useEffect, useMemo, useCallback } from 'react';
import { chatbotFinanceiroService } from '../services/chatbotFinanceiroService';
import { toast } from 'react-toastify';
import { format, isToday, differenceInDays } from 'date-fns';

export function useContasReceberChatbot() {
  const [clientes, setClientes] = useState([]);
  const [faturas, setFaturas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('receber'); // 'receber' | 'clientes'

  // Filter & Search
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('data_desc');

  // Client Modal State
  const [modalClienteOpen, setModalClienteOpen] = useState(false);
  const [editingClienteId, setEditingClienteId] = useState(null);
  const [novoCliente, setNovoCliente] = useState({
    nome: '', telefone: '', mensalidade: '', descricao: '', diaVencimento: 10, ativo: true
  });

  // Invoice Modal State
  const [modalFaturaOpen, setModalFaturaOpen] = useState(false);
  const [novaFatura, setNovaFatura] = useState({
    clienteId: '', valor: '', vencimento: '', descricao: 'Mensalidade'
  });

  // Batch Generation State
  const [modalMassaOpen, setModalMassaOpen] = useState(false);
  const [loadingMassa, setLoadingMassa] = useState(false);
  const [massaConfig, setMassaConfig] = useState({
    mesReferencia: '', descricao: ''
  });

  // === HELPERS ===
  const parseDate = useCallback((timestamp) => {
    if (!timestamp) return null;
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  }, []);

  const formatData = useCallback((timestamp) => {
    const date = parseDate(timestamp);
    if (!date) return '--/--';
    return format(date, 'dd/MM/yyyy');
  }, [parseDate]);

  const getVencimentoStatus = useCallback((fatura) => {
    if (fatura.status === 'pago') return 'pago';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = parseDate(fatura.vencimento);
    if (!venc) return 'pendente';
    venc.setHours(0,0,0,0);
    if (venc < hoje) return 'atrasado';
    if (differenceInDays(venc, hoje) <= 3) return 'vencendo';
    return 'pendente';
  }, [parseDate]);

  // === DATA LOADING ===
  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const listClientes = await chatbotFinanceiroService.listarClientes();
      const listFaturas = await chatbotFinanceiroService.listarTodasFaturas();
      
      setClientes(listClientes);
      setFaturas(listFaturas);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // === COMPUTED DATA ===
  const resumo = useMemo(() => {
    const pendente = faturas.filter(f => f.status === 'pendente').reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);
    const pago = faturas.filter(f => f.status === 'pago').reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);
    const total = pendente + pago;

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const atrasados = faturas.filter(f => {
      if (f.status === 'pago') return false;
      const venc = parseDate(f.vencimento);
      if (!venc) return false;
      venc.setHours(0,0,0,0);
      return venc < hoje;
    });
    const valorAtrasado = atrasados.reduce((acc, c) => acc + parseFloat(c.valor || 0), 0);

    const vencendoHoje = faturas.filter(f => {
      if (f.status === 'pago') return false;
      const venc = parseDate(f.vencimento);
      return venc && isToday(venc);
    }).length;

    return {
      pendente,
      pago,
      total,
      atrasados: atrasados.length,
      valorAtrasado,
      vencendoHoje,
      totalFaturas: faturas.length,
      pendentesCount: faturas.filter(f => f.status === 'pendente').length,
      pagosCount: faturas.filter(f => f.status === 'pago').length,
    };
  }, [faturas, parseDate]);

  const faturasFiltradas = useMemo(() => {
    let filtered = [...faturas];
    
    // Status Filter
    if (filtroStatus === 'pendente') {
      filtered = filtered.filter(f => f.status === 'pendente');
    } else if (filtroStatus === 'pago') {
      filtered = filtered.filter(f => f.status === 'pago');
    } else if (filtroStatus === 'atrasado') {
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      filtered = filtered.filter(f => {
        if (f.status === 'pago') return false;
        const venc = parseDate(f.vencimento);
        if (!venc) return false;
        venc.setHours(0,0,0,0);
        return venc < hoje;
      });
    }

    // Text Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        (f.clienteNome || '').toLowerCase().includes(q) ||
        (f.descricao || '').toLowerCase().includes(q)
      );
    }

    // Sort order
    if (sortBy === 'data_desc') {
      filtered.sort((a, b) => {
        const dateA = parseDate(a.vencimento);
        const dateB = parseDate(b.vencimento);
        return dateB - dateA;
      });
    } else if (sortBy === 'data_asc') {
      filtered.sort((a, b) => {
        const dateA = parseDate(a.vencimento);
        const dateB = parseDate(b.vencimento);
        return dateA - dateB;
      });
    } else if (sortBy === 'valor_desc') {
      filtered.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    } else if (sortBy === 'valor_asc') {
      filtered.sort((a, b) => Number(a.valor || 0) - Number(b.valor || 0));
    } else if (sortBy === 'nome_asc') {
      filtered.sort((a, b) => (a.clienteNome || '').localeCompare(b.clienteNome || ''));
    }

    return filtered;
  }, [faturas, filtroStatus, searchQuery, parseDate, sortBy]);

  const clientesFiltrados = useMemo(() => {
    let filtered = [...clientes];
    if (searchQuery.trim() && activeTab === 'clientes') {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        (c.nome || '').toLowerCase().includes(q) ||
        (c.descricao || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [clientes, searchQuery, activeTab]);

  // === CLIENT OPERATIONS ===
  
  const abrirNovoCliente = () => {
    setNovoCliente({ nome: '', telefone: '', mensalidade: '', descricao: '', diaVencimento: 10, ativo: true });
    setEditingClienteId(null);
    setModalClienteOpen(true);
  };

  const abrirEditarCliente = (cliente) => {
    setNovoCliente({
      nome: cliente.nome || '',
      telefone: cliente.telefone || '',
      mensalidade: cliente.mensalidade || '',
      descricao: cliente.descricao || '',
      diaVencimento: cliente.diaVencimento || 10,
      ativo: cliente.ativo !== false
    });
    setEditingClienteId(cliente.id);
    setModalClienteOpen(true);
  };

  const handleSalvarCliente = async (e) => {
    e.preventDefault();
    if (!novoCliente.nome || !novoCliente.mensalidade) {
      return toast.warn("Nome e Mensalidade são obrigatórios.");
    }
    try {
      if (editingClienteId) {
        await chatbotFinanceiroService.atualizarCliente(editingClienteId, novoCliente);
        toast.success("Cliente atualizado com sucesso!");
      } else {
        await chatbotFinanceiroService.criarCliente(novoCliente);
        toast.success("Cliente cadastrado com sucesso!");
      }
      setModalClienteOpen(false);
      carregarDados();
    } catch (error) {
      toast.error("Erro ao salvar cliente.");
    }
  };

  const handleExcluirCliente = async (clienteId) => {
    try {
      await chatbotFinanceiroService.excluirCliente(clienteId);
      toast.success("Cliente removido com sucesso.");
      carregarDados();
    } catch (error) {
      toast.error("Erro ao excluir cliente.");
    }
  };

  const handleToggleAtivoCliente = async (cliente) => {
    try {
      await chatbotFinanceiroService.atualizarCliente(cliente.id, {
        ativo: !cliente.ativo
      });
      toast.info(`Status do cliente alterado para ${!cliente.ativo ? 'Ativo' : 'Inativo'}`);
      carregarDados();
    } catch (error) {
      toast.error("Erro ao alterar status do cliente.");
    }
  };

  // === INVOICE OPERATIONS ===

  const handleCriarFatura = async (e) => {
    e.preventDefault();
    if (!novaFatura.clienteId || !novaFatura.valor || !novaFatura.vencimento) {
      return toast.warn("Preencha todos os campos obrigatórios.");
    }
    try {
      const clienteSelecionado = clientes.find(c => c.id === novaFatura.clienteId);
      await chatbotFinanceiroService.criarFatura({
        ...novaFatura,
        clienteNome: clienteSelecionado.nome,
        clienteTelefone: clienteSelecionado.telefone || '',
        valor: parseFloat(novaFatura.valor)
      });
      toast.success("Cobrança lançada com sucesso!");
      setModalFaturaOpen(false);
      setNovaFatura({ clienteId: '', valor: '', vencimento: '', descricao: 'Mensalidade' });
      carregarDados();
    } catch (error) {
      toast.error("Erro ao criar fatura.");
    }
  };

  const handleBaixa = async (fatura) => {
    try {
      if (fatura.status === 'pago') {
        await chatbotFinanceiroService.reabrirFatura(fatura.id);
        toast.info("Pagamento estornado.");
        carregarDados();
      } else {
        await chatbotFinanceiroService.marcarComoPago(fatura.id);
        toast.success("Recebimento confirmado!");
        carregarDados();
      }
    } catch (error) {
      toast.error("Erro ao processar baixa.");
    }
  };

  const handleExcluirFatura = async (faturaId) => {
    try {
      await chatbotFinanceiroService.excluirFatura(faturaId);
      toast.success("Fatura excluída.");
      carregarDados();
    } catch (error) {
      toast.error("Erro ao excluir fatura.");
    }
  };

  // === BATCH OPERATIONS ===

  const handleCobrancasEmMassa = async (e) => {
    e.preventDefault();
    if (!massaConfig.mesReferencia) {
      return toast.warn("Selecione o mês de referência.");
    }
    setLoadingMassa(true);
    try {
      const result = await chatbotFinanceiroService.gerarMensalidadesEmLote(
        massaConfig.mesReferencia,
        massaConfig.descricao
      );
      toast.success(`${result.count} mensalidades geradas com sucesso!`);
      setModalMassaOpen(false);
      setMassaConfig({ mesReferencia: '', descricao: '' });
      carregarDados();
    } catch (error) {
      toast.error("Erro ao gerar mensalidades em massa.");
    } finally {
      setLoadingMassa(false);
    }
  };

  // === WHATSAPP REMINDER ===

  const enviarWhatsAppCobranca = (fatura) => {
    const nome = fatura.clienteNome || 'Cliente';
    const valor = Number(fatura.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const venc = formatData(fatura.vencimento);
    const telefone = fatura.clienteTelefone ? fatura.clienteTelefone.replace(/\D/g, '') : '';
    
    const msg = encodeURIComponent(
      `Olá ${nome}! 👋\n\n` +
      `Passando para lembrar do faturamento da sua mensalidade:\n\n` +
      `💼 *${fatura.descricao || 'Mensalidade'}*\n` +
      `💰 Valor: *${valor}*\n` +
      `📅 Vencimento: *${venc}*\n\n` +
      `Caso já tenha efetuado o pagamento, favor desconsiderar. Muito obrigado pela parceria! 🙏`
    );

    const link = telefone 
      ? `https://api.whatsapp.com/send?phone=55${telefone}&text=${msg}`
      : `https://api.whatsapp.com/send?text=${msg}`;
    
    window.open(link, '_blank');
  };

  return {
    clientes,
    faturas,
    loading,
    activeTab,
    setActiveTab,
    filtroStatus,
    setFiltroStatus,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    
    // Metrics
    resumo,
    faturasFiltradas,
    clientesFiltrados,

    // Client functions
    modalClienteOpen,
    setModalClienteOpen,
    novoCliente,
    setNovoCliente,
    editingClienteId,
    abrirNovoCliente,
    abrirEditarCliente,
    handleSalvarCliente,
    handleExcluirCliente,
    handleToggleAtivoCliente,

    // Single Invoice functions
    modalFaturaOpen,
    setModalFaturaOpen,
    novaFatura,
    setNovaFatura,
    handleCriarFatura,
    handleBaixa,
    handleExcluirFatura,

    // Batch Invoice functions
    modalMassaOpen,
    setModalMassaOpen,
    loadingMassa,
    massaConfig,
    setMassaConfig,
    handleCobrancasEmMassa,

    // Helper formatting
    formatData,
    getVencimentoStatus,
    parseDate,
    enviarWhatsAppCobranca
  };
}
