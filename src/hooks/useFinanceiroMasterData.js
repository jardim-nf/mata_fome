import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { financeiroService } from '../services/financeiroService';
import { toast } from 'react-toastify';
import { format, isToday, differenceInDays } from 'date-fns';

export function useFinanceiroMasterData() {
  const [faturas, setFaturas] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [novaFatura, setNovaFatura] = useState({
    estabelecimentoId: '', valor: '', vencimento: '', descricao: 'Mensalidade Sistema'
  });

  // Modal de Lote
  const [loadingMassa, setLoadingMassa] = useState(false);
  const [modalMassa, setModalMassa] = useState(false);
  const [massaConfig, setMassaConfig] = useState({
    valor: '', vencimento: '', descricao: 'Mensalidade Sistema'
  });

  // ─── Helpers de Data ───
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

  // ─── Carregamento de Inicialização ───
  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const qEstab = query(collection(db, 'estabelecimentos'), orderBy('nome'));
      const snapEstab = await getDocs(qEstab);
      setEstabs(snapEstab.docs.map(d => ({ id: d.id, nome: d.data().nome })));

      const lista = await financeiroService.listarTodasFaturas();
      lista.sort((a, b) => {
        const dateA = a.vencimento?.toDate ? a.vencimento.toDate() : new Date(a.vencimento);
        const dateB = b.vencimento?.toDate ? b.vencimento.toDate() : new Date(b.vencimento);
        return dateB - dateA;
      });
      setFaturas(lista);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { 
    carregarDados(); 
  }, [carregarDados]);

  // ─── Computed Data (Resumos e Totalizadores) ───
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

    const inadimplencia = total > 0 ? ((valorAtrasado / total) * 100) : 0;

    return { 
      pendente, pago, total, 
      atrasados: atrasados.length, valorAtrasado,
      vencendoHoje, inadimplencia,
      totalFaturas: faturas.length,
      pendentesCount: faturas.filter(f => f.status === 'pendente').length,
      pagosCount: faturas.filter(f => f.status === 'pago').length,
    };
  }, [faturas, parseDate]);

  const faturasFiltradas = useMemo(() => {
    let filtered = faturas;
    if (filtroStatus === 'pendente') filtered = filtered.filter(f => f.status === 'pendente');
    else if (filtroStatus === 'pago') filtered = filtered.filter(f => f.status === 'pago');
    else if (filtroStatus === 'atrasado') {
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      filtered = filtered.filter(f => {
        if (f.status === 'pago') return false;
        const venc = parseDate(f.vencimento);
        if (!venc) return false;
        venc.setHours(0,0,0,0);
        return venc < hoje;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        (f.estabelecimentoNome || '').toLowerCase().includes(q) ||
        (f.descricao || '').toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [faturas, filtroStatus, searchQuery, parseDate]);

  // ─── Ações de Transação Financeira ───
  const handleCriarFatura = async (e) => {
    e.preventDefault();
    if (!novaFatura.estabelecimentoId || !novaFatura.valor || !novaFatura.vencimento) {
      return toast.warn("Preencha todos os campos obrigatórios.");
    }
    try {
      const estabSelecionado = estabs.find(e => e.id === novaFatura.estabelecimentoId);
      await financeiroService.criarFatura({
        ...novaFatura,
        estabelecimentoNome: estabSelecionado.nome,
        valor: parseFloat(novaFatura.valor)
      });
      toast.success("Cobrança gerada com sucesso!");
      setModalOpen(false);
      setNovaFatura({ estabelecimentoId: '', valor: '', vencimento: '', descricao: 'Mensalidade Sistema' });
      carregarDados();
    } catch (error) { toast.error("Erro ao gerar cobrança."); }
  };

  const handleBaixa = async (id, statusAtual) => {
    try {
      if (statusAtual === 'pago') {
        if (window.confirm("Deseja estornar este pagamento?")) { 
          await financeiroService.reabrirFatura(id); 
          toast.info("Pagamento estornado."); 
        }
      } else {
        if (window.confirm("Confirmar o recebimento?")) { 
          await financeiroService.marcarComoPago(id); 
          toast.success("Pagamento confirmado!"); 
        }
      }
      carregarDados();
    } catch (error) { toast.error("Erro ao atualizar status."); }
  };

  // ─── Cobranças em Massa ───
  const handleCobrancaEmMassa = async (e) => {
    e.preventDefault();
    if (!massaConfig.valor || !massaConfig.vencimento) {
      return toast.warn('Preencha valor e vencimento.');
    }
    setLoadingMassa(true);
    try {
      const qEstab = query(collection(db, 'estabelecimentos'), where('ativo', '==', true));
      const snapEstab = await getDocs(qEstab);
      let count = 0;
      for (const docSnap of snapEstab.docs) {
        const data = docSnap.data();
        await financeiroService.criarFatura({
          estabelecimentoId: docSnap.id,
          estabelecimentoNome: data.nome,
          valor: parseFloat(massaConfig.valor),
          vencimento: massaConfig.vencimento,
          descricao: massaConfig.descricao || 'Mensalidade Sistema'
        });
        count++;
      }
      toast.success(`${count} cobranças geradas com sucesso!`);
      setModalMassa(false);
      setMassaConfig({ valor: '', vencimento: '', descricao: 'Mensalidade Sistema' });
      carregarDados();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar cobranças em massa.');
    } finally { setLoadingMassa(false); }
  };

  // ─── Lembrete via WhatsApp Externo ───
  const handleLembreteWhatsApp = useCallback((fatura) => {
    const estab = estabs.find(e => e.id === fatura.estabelecimentoId);
    const nome = estab?.nome || fatura.estabelecimentoNome || 'Cliente';
    const valor = Number(fatura.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const venc = formatData(fatura.vencimento);
    const msg = encodeURIComponent(
      `Olá ${nome}! 👋\n\n` +
      `Identificamos uma pendência financeira no sistema *IdeaFood*:\n\n` +
      `📄 *${fatura.descricao || 'Mensalidade'}*\n` +
      `💰 Valor: *${valor}*\n` +
      `📅 Vencimento: *${venc}*\n\n` +
      `Por favor, regularize o pagamento para evitar a suspensão dos serviços.\n\n` +
      `Qualquer dúvida, estamos à disposição! 🙏`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }, [estabs, formatData]);

  // ─── Retorno do Hook ───
  return {
    faturasFiltradas, estabs, loading, 
    
    // Filtros e Pesquisa
    filtroStatus, setFiltroStatus,
    searchQuery, setSearchQuery,
    
    // Nova Fatura Unitária Modal
    modalOpen, setModalOpen,
    novaFatura, setNovaFatura,
    
    // Nova Fatura de Massa Modal
    modalMassa, setModalMassa,
    massaConfig, setMassaConfig,
    loadingMassa,

    // Resumos Financeiros
    resumo,

    // Funções Transacionais Customizadas
    handleCriarFatura, handleBaixa, handleCobrancaEmMassa, handleLembreteWhatsApp,
    
    // Funções de formatação repassadas
    formatData, getVencimentoStatus, parseDate
  };
}
