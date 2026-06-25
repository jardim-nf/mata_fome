import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { financeiroService } from '../services/financeiroService';
import { toast } from 'react-toastify';
import { format, isToday, differenceInDays } from 'date-fns';

export function useFinanceiroMasterData(showConfirm) {
  const [faturas, setFaturas] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('data_desc'); // 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc' | 'nome_asc'
  
  const [novaFatura, setNovaFatura] = useState({
    estabelecimentoId: '', valor: '', vencimento: '', descricao: 'Mensalidade Sistema'
  });

  // Modal de Lote
  const [loadingMassa, setLoadingMassa] = useState(false);
  const [modalMassa, setModalMassa] = useState(false);
  const [massaConfig, setMassaConfig] = useState({
    valor: '', vencimento: '', descricao: 'Mensalidade Sistema'
  });

  // Modal de Edição
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [faturaEmEdicao, setFaturaEmEdicao] = useState({
    id: '', estabelecimentoId: '', estabelecimentoNome: '', valor: '', vencimento: '', descricao: ''
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
    let filtered = [...faturas];
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

    // Ordenação
    if (sortBy === 'data_desc') {
      filtered.sort((a, b) => {
        const dateA = a.vencimento?.toDate ? a.vencimento.toDate() : new Date(a.vencimento);
        const dateB = b.vencimento?.toDate ? b.vencimento.toDate() : new Date(b.vencimento);
        return dateB - dateA;
      });
    } else if (sortBy === 'data_asc') {
      filtered.sort((a, b) => {
        const dateA = a.vencimento?.toDate ? a.vencimento.toDate() : new Date(a.vencimento);
        const dateB = b.vencimento?.toDate ? b.vencimento.toDate() : new Date(b.vencimento);
        return dateA - dateB;
      });
    } else if (sortBy === 'valor_desc') {
      filtered.sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    } else if (sortBy === 'valor_asc') {
      filtered.sort((a, b) => Number(a.valor || 0) - Number(b.valor || 0));
    } else if (sortBy === 'nome_asc') {
      filtered.sort((a, b) => (a.estabelecimentoNome || '').localeCompare(b.estabelecimentoNome || ''));
    }

    return filtered;
  }, [faturas, filtroStatus, searchQuery, parseDate, sortBy]);

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

  const handleBaixa = async (fatura) => {
    try {
      if (!fatura || typeof fatura !== 'object') return;
      const confirmFn = showConfirm || (async (msg) => window.confirm(msg));

      if (fatura.status === 'pago') {
        if (await confirmFn("Deseja estornar este pagamento?", "Estornar Pagamento", "danger", "Estornar")) { 
          await financeiroService.reabrirFatura(fatura.id); 
          
          // Ao estornar a mensalidade, a licença da loja retroage ao vencimento original desta fatura
          if (fatura.estabelecimentoId) {
            const estabRef = doc(db, 'estabelecimentos', fatura.estabelecimentoId);
            const vencOriginal = parseDate(fatura.vencimento) || new Date();
            const strDataOriginal = format(vencOriginal, 'yyyy-MM-dd');
            
            await updateDoc(estabRef, {
              nextBillingDate: vencOriginal,
              licencaAte: strDataOriginal
            }).catch(e => console.error("Erro ao reverter licença no estorno", e));
          }

          toast.info("Pagamento estornado com sucesso."); 
        }
      } else {
        if (await confirmFn("Confirmar o recebimento?", "Confirmar Pagamento", "default", "Confirmar")) { 
          await financeiroService.marcarComoPago(fatura.id); 
          
          const vencAtual = parseDate(fatura.vencimento) || new Date();
          const novoVenc = new Date(vencAtual);
          novoVenc.setMonth(novoVenc.getMonth() + 1);
          const strData = format(novoVenc, 'yyyy-MM-dd');

          // Atualiza a loja no Firebase de forma 100% automática e transparente
          if (fatura.estabelecimentoId) {
            const estabRef = doc(db, 'estabelecimentos', fatura.estabelecimentoId);
            await updateDoc(estabRef, {
              nextBillingDate: novoVenc,
              licencaAte: strData,
              ativo: true
            }).catch(e => console.error("Erro ao atualizar estabelecimento na baixa", e));
          }

          // Se for mensalidade ou sistema, gera automaticamente a próxima fatura pendente
          const ehMensalidade = fatura.descricao && (
            fatura.descricao.toLowerCase().includes('mensalidade') || 
            fatura.descricao.toLowerCase().includes('sistema') ||
            fatura.descricao.toLowerCase().includes('hospedagem')
          );
          
          if (ehMensalidade) {
            await financeiroService.criarFatura({
              estabelecimentoId: fatura.estabelecimentoId,
              estabelecimentoNome: fatura.estabelecimentoNome || '',
              valor: parseFloat(fatura.valor || 0),
              vencimento: strData,
              descricao: fatura.descricao
            }).catch(e => console.error("Erro ao gerar proxima fatura automatica", e));
            
            toast.success("Pagamento confirmado! Licença renovada e próxima mensalidade gerada automaticamente.");
          } else {
            toast.success("Pagamento confirmado com sucesso!");
          }
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

  const handleExcluirFatura = async (fatura) => {
    try {
      if (!fatura || !fatura.id) return;
      const confirmFn = showConfirm || (async (msg) => window.confirm(msg));
      
      const confirmacao = await confirmFn(
        `Deseja realmente EXCLUIR DEFINITIVAMENTE esta fatura de ${fatura.estabelecimentoNome} no valor de R$ ${fatura.valor}? Esta ação não pode ser desfeita.`,
        "Excluir Fatura",
        "danger",
        "Excluir"
      );

      if (confirmacao) {
        await financeiroService.excluirFatura(fatura.id);
        toast.success("Fatura excluída com sucesso!");
        carregarDados();
      }
    } catch (error) {
      console.error("Erro ao excluir fatura:", error);
      toast.error("Erro ao excluir fatura.");
    }
  };

  const abrirModalEdicao = (fatura) => {
    setFaturaEmEdicao({
      id: fatura.id,
      estabelecimentoId: fatura.estabelecimentoId || '',
      estabelecimentoNome: fatura.estabelecimentoNome || '',
      valor: fatura.valor || '',
      vencimento: fatura.vencimento ? format(parseDate(fatura.vencimento), 'yyyy-MM-dd') : '',
      descricao: fatura.descricao || ''
    });
    setModalEditOpen(true);
  };

  const handleEditarFatura = async (e) => {
    e.preventDefault();
    if (!faturaEmEdicao.valor || !faturaEmEdicao.vencimento) {
      return toast.warn("Preencha todos os campos obrigatórios.");
    }
    try {
      await financeiroService.atualizarFatura(faturaEmEdicao.id, {
        valor: parseFloat(faturaEmEdicao.valor),
        vencimento: faturaEmEdicao.vencimento,
        descricao: faturaEmEdicao.descricao
      });
      toast.success("Cobrança atualizada com sucesso!");
      setModalEditOpen(false);
      carregarDados();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar cobrança.");
    }
  };

  // ─── Retorno do Hook ───
  return {
    faturasFiltradas, estabs, loading, 
    
    // Filtros e Pesquisa
    filtroStatus, setFiltroStatus,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    
    // Nova Fatura Unitária Modal
    modalOpen, setModalOpen,
    novaFatura, setNovaFatura,
    
    // Nova Fatura de Massa Modal
    modalMassa, setModalMassa,
    massaConfig, setMassaConfig,
    loadingMassa,

    // Modal de Edição
    modalEditOpen, setModalEditOpen,
    faturaEmEdicao, setFaturaEmEdicao,
    abrirModalEdicao, handleEditarFatura,

    // Resumos Financeiros
    resumo,

    // Funções Transacionais Customizadas
    handleCriarFatura, handleBaixa, handleCobrancaEmMassa, handleLembreteWhatsApp, handleExcluirFatura,
    
    // Funções de formatação repassadas
    formatData, getVencimentoStatus, parseDate
  };
}
