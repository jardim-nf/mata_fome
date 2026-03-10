import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { financeiroService } from '../../services/financeiroService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { 
  FaCheck, 
  FaTimes, 
  FaPlus, 
  FaUndo, 
  FaArrowLeft, 
  FaMoneyBillWave, 
  FaExclamationCircle,
  FaCheckCircle,
  FaCalendarAlt,
  FaWallet,
  FaHandHoldingUsd,
  FaFileInvoiceDollar,
  FaSearch
} from 'react-icons/fa';

// --- Mini Componente de Card Premium ---
const FinanceCard = ({ title, value, subtitle, icon, type = 'default' }) => {
  const styles = {
    warning: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-700',
    success: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700',
    dark: 'bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 text-white shadow-xl shadow-gray-900/20'
  };

  const iconStyles = {
    warning: 'bg-white text-amber-500 shadow-sm',
    success: 'bg-white text-emerald-500 shadow-sm',
    dark: 'bg-gray-800 text-yellow-400 border border-gray-700 shadow-inner'
  };

  const currentStyle = styles[type] || styles.dark;
  const currentIconStyle = iconStyles[type] || iconStyles.dark;

  return (
    <div className={`relative overflow-hidden p-6 rounded-3xl border transition-all duration-500 group hover:-translate-y-1 hover:shadow-lg ${currentStyle}`}>
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-3.5 rounded-2xl transition-transform duration-500 group-hover:scale-110 ${currentIconStyle}`}>
            {icon}
          </div>
        </div>
        <h3 className={`text-xs font-bold uppercase tracking-widest mb-1 ${type === 'dark' ? 'text-gray-400' : 'opacity-70'}`}>
          {title}
        </h3>
        <p className={`text-3xl font-black tracking-tight ${type === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          {value}
        </p>
        {subtitle && (
          <p className={`text-xs font-medium mt-2 ${type === 'dark' ? 'text-gray-500' : 'opacity-60'}`}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};

function FinanceiroMaster() {
  const navigate = useNavigate();
  const [faturas, setFaturas] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos'); 

  const [novaFatura, setNovaFatura] = useState({
    estabelecimentoId: '',
    valor: '',
    vencimento: '',
    descricao: 'Mensalidade Sistema'
  });

  const carregarDados = async () => {
    setLoading(true);
    try {
      const qEstab = query(collection(db, 'estabelecimentos'), orderBy('nome'));
      const snapEstab = await getDocs(qEstab);
      setEstabs(snapEstab.docs.map(d => ({ id: d.id, nome: d.data().nome })));

      const lista = await financeiroService.listarTodasFaturas();
      // Ordena para os mais recentes/próximos do vencimento primeiro
      lista.sort((a, b) => {
        const dateA = a.vencimento?.toDate ? a.vencimento.toDate() : new Date(a.vencimento);
        const dateB = b.vencimento?.toDate ? b.vencimento.toDate() : new Date(b.vencimento);
        return dateB - dateA;
      });
      setFaturas(lista);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const faturasFiltradas = useMemo(() => {
    if (filtroStatus === 'todos') return faturas;
    return faturas.filter(f => f.status === filtroStatus);
  }, [faturas, filtroStatus]);

  const resumo = useMemo(() => {
    const pendente = faturas.filter(f => f.status === 'pendente').reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
    const pago = faturas.filter(f => f.status === 'pago').reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
    return { pendente, pago, total: pendente + pago };
  }, [faturas]);

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
    } catch (error) {
      toast.error("Erro ao gerar cobrança.");
    }
  };

  const handleBaixa = async (id, statusAtual) => {
    try {
      if (statusAtual === 'pago') {
        if(window.confirm("ATENÇÃO: Deseja estornar este pagamento e marcar como PENDENTE novamente?")) {
           await financeiroService.reabrirFatura(id);
           toast.info("Pagamento estornado.");
        }
      } else {
        if(window.confirm("Confirmar o recebimento deste valor?")) {
           await financeiroService.marcarComoPago(id);
           toast.success("Pagamento confirmado com sucesso!");
        }
      }
      carregarDados();
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  const formatData = (timestamp) => {
    if (!timestamp) return '--/--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd/MM/yyyy');
  };

  const getStatusBadge = (fatura) => {
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const vencimento = fatura.vencimento?.toDate ? fatura.vencimento.toDate() : new Date(fatura.vencimento);
    vencimento.setHours(0,0,0,0);
    
    if (fatura.status === 'pago') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-200 shadow-sm">
          <FaCheckCircle /> PAGO
        </span>
      );
    }
    if (vencimento < hoje) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-800 px-3 py-1 rounded-lg text-xs font-bold border border-rose-200 shadow-sm animate-pulse">
          <FaExclamationCircle /> ATRASADO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold border border-amber-200 shadow-sm">
        <FaCalendarAlt /> PENDENTE
      </span>
    );
  };

  return (
    <div className="bg-[#f8fafc] min-h-screen pt-24 pb-12 px-4 sm:px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* CABEÇALHO DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <button 
              onClick={() => navigate('/master-dashboard')} 
              className="text-gray-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group"
            >
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 group-hover:border-yellow-200 transition-colors">
                <FaArrowLeft />
              </span> 
              Voltar ao Painel Master
            </button>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-gray-900 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm">Módulo Financeiro</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Recebíveis</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">Gestão de mensalidades e faturamento da rede.</p>
          </div>
          <button 
            onClick={() => setModalOpen(true)} 
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-6 py-3 rounded-2xl hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg shadow-yellow-500/30 font-bold text-sm active:scale-95"
          >
            <FaPlus /> Nova Cobrança
          </button>
        </div>

        {/* CARDS DE RESUMO PREMIUM */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <FinanceCard 
              type="warning"
              title="A Receber (Pendente)"
              value={`R$ ${resumo.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={<FaFileInvoiceDollar size={24} />}
              subtitle="Boletos em aberto ou atrasados"
            />
            <FinanceCard 
              type="success"
              title="Caixa (Recebido)"
              value={`R$ ${resumo.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={<FaHandHoldingUsd size={24} />}
              subtitle="Valor já liquidado"
            />
            <FinanceCard 
              type="dark"
              title="Total Faturado"
              value={`R$ ${resumo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              icon={<FaWallet size={24} />}
              subtitle="Soma de todos os lançamentos"
            />
        </div>

        {/* FILTROS E TABELA DE DADOS */}
        <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/40 border border-gray-100 overflow-hidden">
            
            {/* Barra de Filtros */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                   <FaMoneyBillWave className="text-gray-400" /> Histórico de Lançamentos
                </h3>
                <div className="flex bg-gray-200/50 p-1.5 rounded-xl gap-1">
                    {[
                      { id: 'todos', label: 'Todos' }, 
                      { id: 'pendente', label: 'Pendentes' }, 
                      { id: 'pago', label: 'Pagos' }
                    ].map((status) => (
                        <button
                            key={status.id}
                            onClick={() => setFiltroStatus(status.id)}
                            className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                                filtroStatus === status.id 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                            }`}
                        >
                            {status.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabela de Faturas */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-white border-b border-gray-100">
                        <tr>
                            <th className="p-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Cliente / Loja</th>
                            <th className="p-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Vencimento</th>
                            <th className="p-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Valor</th>
                            <th className="p-5 text-[10px] uppercase tracking-widest text-gray-400 font-black">Status</th>
                            <th className="p-5 text-[10px] uppercase tracking-widest text-gray-400 font-black text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="5" className="p-12 text-center text-gray-400 font-medium animate-pulse">Buscando registros financeiros...</td></tr>
                        ) : faturasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="p-16 text-center">
                                <div className="flex flex-col items-center justify-center text-gray-400">
                                  <FaSearch size={40} className="mb-4 text-gray-200" />
                                  <p className="font-bold text-gray-500">Nenhum lançamento encontrado.</p>
                                  <p className="text-sm mt-1">Altere o filtro ou crie uma nova cobrança.</p>
                                </div>
                              </td>
                            </tr>
                        ) : (
                            faturasFiltradas.map(fatura => (
                                <tr key={fatura.id} className="hover:bg-yellow-50/30 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-black text-gray-800 tracking-tight">{fatura.estabelecimentoNome}</div>
                                        <div className="text-xs font-medium text-gray-500 mt-1 flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span> {fatura.descricao}
                                        </div>
                                    </td>
                                    <td className="p-5 text-sm font-semibold text-gray-600">
                                        {formatData(fatura.vencimento)}
                                    </td>
                                    <td className="p-5 font-mono font-black text-gray-900 text-base tracking-tighter">
                                        R$ {parseFloat(fatura.valor).toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="p-5">
                                        {getStatusBadge(fatura)}
                                    </td>
                                    <td className="p-5 text-right">
                                        {fatura.status === 'pago' ? (
                                            <button 
                                                onClick={() => handleBaixa(fatura.id, 'pago')}
                                                className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-end gap-1.5 ml-auto transition-all"
                                                title="Desfazer pagamento"
                                            >
                                                <FaUndo /> Estornar
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBaixa(fatura.id, 'pendente')}
                                                className="bg-emerald-100 text-emerald-800 hover:bg-emerald-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-end gap-2 ml-auto shadow-sm active:scale-95"
                                            >
                                                <FaCheck /> Confirmar
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- MODAL DE CRIAÇÃO PREMIUM --- */}
        {modalOpen && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl transform transition-all scale-100">
              
              <div className="flex justify-between items-center mb-6">
                 <div>
                   <h2 className="text-2xl font-black text-gray-900 tracking-tight">Nova Cobrança</h2>
                   <p className="text-xs font-medium text-gray-500 mt-1">Gerar lançamento para faturamento.</p>
                 </div>
                 <button onClick={() => setModalOpen(false)} className="bg-gray-100 text-gray-400 hover:text-gray-800 hover:bg-gray-200 p-2.5 rounded-full transition-colors"><FaTimes /></button>
              </div>
              
              <form onSubmit={handleCriarFatura} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Cliente / Loja</label>
                  <select 
                    className="w-full border-2 border-gray-100 bg-gray-50/50 p-3.5 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all text-sm font-semibold text-gray-700"
                    value={novaFatura.estabelecimentoId}
                    onChange={e => setNovaFatura({...novaFatura, estabelecimentoId: e.target.value})}
                  >
                    <option value="">Selecione o estabelecimento...</option>
                    {estabs.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Valor</label>
                    <div className="relative">
                        <span className="absolute left-4 top-3.5 text-gray-400 text-sm font-bold">R$</span>
                        <input 
                        type="number" 
                        step="0.01"
                        className="w-full border-2 border-gray-100 bg-gray-50/50 p-3.5 pl-10 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-black text-gray-900 text-lg tracking-tighter" 
                        placeholder="0.00"
                        value={novaFatura.valor}
                        onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})}
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Vencimento</label>
                    <input 
                      type="date" 
                      className="w-full border-2 border-gray-100 bg-gray-50/50 p-3.5 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all text-sm font-bold text-gray-700" 
                      value={novaFatura.vencimento}
                      onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Referência / Descrição</label>
                    <input 
                      type="text" 
                      className="w-full border-2 border-gray-100 bg-gray-50/50 p-3.5 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all text-sm font-semibold text-gray-700" 
                      placeholder="Ex: Mensalidade Janeiro 2026"
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})}
                    />
                </div>

                <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3.5 text-gray-500 bg-gray-100 hover:bg-gray-200 hover:text-gray-800 rounded-2xl font-bold text-sm transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-gray-900 to-black text-white rounded-2xl font-bold text-sm hover:shadow-lg hover:shadow-gray-900/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                    <FaCheckCircle className="text-yellow-400" />
                    Gerar Boleto
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default FinanceiroMaster;