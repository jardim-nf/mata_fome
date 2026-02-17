import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { financeiroService } from '../../services/financeiroService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FaCheck, 
  FaTimes, 
  FaPlus, 
  FaUndo, 
  FaArrowLeft, 
  FaFilter, 
  FaMoneyBillWave, 
  FaExclamationCircle,
  FaCheckCircle,
  FaCalendarAlt
} from 'react-icons/fa';

function FinanceiroMaster() {
  const navigate = useNavigate();
  const [faturas, setFaturas] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, pendente, pago

  // Estado do Formulário
  const [novaFatura, setNovaFatura] = useState({
    estabelecimentoId: '',
    valor: '',
    vencimento: '',
    descricao: 'Mensalidade Sistema'
  });

  // --- CARREGAMENTO DE DADOS ---
  const carregarDados = async () => {
    setLoading(true);
    try {
      const qEstab = query(collection(db, 'estabelecimentos'), orderBy('nome'));
      const snapEstab = await getDocs(qEstab);
      setEstabs(snapEstab.docs.map(d => ({ id: d.id, nome: d.data().nome })));

      const lista = await financeiroService.listarTodasFaturas();
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

  // --- CÁLCULOS E FILTROS ---
  const faturasFiltradas = useMemo(() => {
    if (filtroStatus === 'todos') return faturas;
    return faturas.filter(f => f.status === filtroStatus);
  }, [faturas, filtroStatus]);

  const resumo = useMemo(() => {
    const pendente = faturas.filter(f => f.status === 'pendente').reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
    const pago = faturas.filter(f => f.status === 'pago').reduce((acc, curr) => acc + parseFloat(curr.valor), 0);
    return { pendente, pago, total: pendente + pago };
  }, [faturas]);

  // --- HANDLERS ---
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
      setNovaFatura({ establishmentId: '', valor: '', vencimento: '', descricao: 'Mensalidade Sistema' });
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
           toast.success("Pagamento confirmado!");
        }
      }
      carregarDados();
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  // --- HELPERS VISUAIS ---
  const formatData = (timestamp) => {
    if (!timestamp) return '--/--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd/MM/yyyy');
  };

  const getStatusBadge = (fatura) => {
    const hoje = new Date();
    const vencimento = fatura.vencimento?.toDate ? fatura.vencimento.toDate() : new Date(fatura.vencimento);
    
    if (fatura.status === 'pago') {
      return (
        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full text-xs font-bold border border-green-100">
          <FaCheckCircle className="text-[10px]" /> PAGO
        </span>
      );
    }
    if (vencimento < hoje) {
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded-full text-xs font-bold border border-red-100">
          <FaExclamationCircle className="text-[10px]" /> ATRASADO
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-full text-xs font-bold border border-yellow-100">
        <FaCalendarAlt className="text-[10px]" /> ABERTO
      </span>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
               <FaArrowLeft /> Voltar ao Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Financeiro</h1>
            <p className="text-gray-500 text-sm mt-1">Gestão de mensalidades e recebíveis.</p>
          </div>
          <button 
            onClick={() => setModalOpen(true)} 
            className="flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-200 font-semibold text-sm"
          >
            <FaPlus /> Nova Cobrança
          </button>
        </div>

        {/* CARDS DE RESUMO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">A Receber (Pendente)</span>
                <div className="text-2xl font-bold text-yellow-600 mt-1">R$ {resumo.pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Recebido (Pago)</span>
                <div className="text-2xl font-bold text-green-600 mt-1">R$ {resumo.pago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Gerado</span>
                <div className="text-2xl font-bold text-gray-800 mt-1">R$ {resumo.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
        </div>

        {/* FILTROS E TABELA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            
            {/* Barra de Filtros */}
            <div className="p-4 border-b border-gray-100 flex gap-4 overflow-x-auto">
                {['todos', 'pendente', 'pago'].map((status) => (
                    <button
                        key={status}
                        onClick={() => setFiltroStatus(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                            filtroStatus === status 
                            ? 'bg-gray-100 text-gray-900' 
                            : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Tabela */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50/50 text-gray-400 text-xs uppercase font-bold tracking-wider">
                        <tr>
                            <th className="p-5">Estabelecimento</th>
                            <th className="p-5">Vencimento</th>
                            <th className="p-5">Valor</th>
                            <th className="p-5">Status</th>
                            <th className="p-5 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr><td colSpan="5" className="p-12 text-center text-gray-400 animate-pulse">Carregando dados financeiros...</td></tr>
                        ) : faturasFiltradas.length === 0 ? (
                            <tr><td colSpan="5" className="p-12 text-center text-gray-400">Nenhum registro encontrado neste filtro.</td></tr>
                        ) : (
                            faturasFiltradas.map(fatura => (
                                <tr key={fatura.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-bold text-gray-800">{fatura.estabelecimentoNome}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{fatura.descricao}</div>
                                    </td>
                                    <td className="p-5 text-sm text-gray-600">
                                        {formatData(fatura.vencimento)}
                                    </td>
                                    <td className="p-5 font-mono font-bold text-gray-800 text-sm">
                                        R$ {parseFloat(fatura.valor).toFixed(2).replace('.', ',')}
                                    </td>
                                    <td className="p-5">
                                        {getStatusBadge(fatura)}
                                    </td>
                                    <td className="p-5 text-right">
                                        {fatura.status === 'pago' ? (
                                            <button 
                                                onClick={() => handleBaixa(fatura.id, 'pago')}
                                                className="text-gray-300 hover:text-red-500 text-xs font-semibold flex items-center justify-end gap-1 ml-auto transition-colors"
                                                title="Desfazer pagamento"
                                            >
                                                <FaUndo /> Estornar
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBaixa(fatura.id, 'pendente')}
                                                className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ml-auto shadow-sm"
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

        {/* --- MODAL DE CRIAÇÃO --- */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl transform transition-all scale-100">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-gray-800">Nova Cobrança</h2>
                 <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>
              
              <form onSubmit={handleCriarFatura} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cliente / Loja</label>
                  <select 
                    className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm"
                    value={novaFatura.estabelecimentoId}
                    onChange={e => setNovaFatura({...novaFatura, estabelecimentoId: e.target.value})}
                  >
                    <option value="">Selecione um cliente...</option>
                    {estabs.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                    <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-400 text-sm">R$</span>
                        <input 
                        type="number" 
                        className="w-full border border-gray-200 bg-gray-50 p-3 pl-9 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm font-bold" 
                        placeholder="0.00"
                        value={novaFatura.valor}
                        onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})}
                        />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vencimento</label>
                    <input 
                      type="date" 
                      className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm text-gray-600" 
                      value={novaFatura.vencimento}
                      onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-200 bg-gray-50 p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-all text-sm" 
                      placeholder="Ex: Mensalidade Janeiro"
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})}
                    />
                </div>

                <div className="flex gap-3 mt-6 pt-2">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-sm transition-colors">Cancelar</button>
                  <button type="submit" className="flex-1 py-3 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-colors shadow-lg">Gerar Cobrança</button>
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