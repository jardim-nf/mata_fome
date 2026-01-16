import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { financeiroService } from '../../services/financeiroService';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FaCheck, FaTimes, FaPlus, FaMoneyBillWave, FaUndo } from 'react-icons/fa';

function FinanceiroMaster() {
  const navigate = useNavigate();
  const [faturas, setFaturas] = useState([]);
  const [estabs, setEstabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Estado do Formulário de Nova Fatura
  const [novaFatura, setNovaFatura] = useState({
    estabelecimentoId: '',
    valor: '',
    vencimento: '',
    descricao: 'Mensalidade Sistema'
  });

  // Carregar Dados
  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Carregar Estabelecimentos (para o select)
      const qEstab = query(collection(db, 'estabelecimentos'), orderBy('nome'));
      const snapEstab = await getDocs(qEstab);
      setEstabs(snapEstab.docs.map(d => ({ id: d.id, nome: d.data().nome })));

      // 2. Carregar Faturas
      const lista = await financeiroService.listarTodasFaturas();
      setFaturas(lista);
    } catch (error) {
      toast.error("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Handlers
  const handleCriarFatura = async (e) => {
    e.preventDefault();
    if (!novaFatura.estabelecimentoId || !novaFatura.valor || !novaFatura.vencimento) {
      return toast.warn("Preencha todos os campos!");
    }

    try {
      // Pega o nome do estabelecimento selecionado
      const estabSelecionado = estabs.find(e => e.id === novaFatura.estabelecimentoId);
      
      await financeiroService.criarFatura({
        ...novaFatura,
        estabelecimentoNome: estabSelecionado.nome,
        valor: parseFloat(novaFatura.valor)
      });
      
      toast.success("Fatura gerada com sucesso!");
      setModalOpen(false);
      setNovaFatura({ estabelecimentoId: '', valor: '', vencimento: '', descricao: 'Mensalidade' });
      carregarDados();
    } catch (error) {
      toast.error("Erro ao gerar fatura.");
    }
  };

  const handleBaixa = async (id, statusAtual) => {
    try {
      if (statusAtual === 'pago') {
        if(window.confirm("Deseja reabrir esta fatura (marcar como pendente)?")) {
           await financeiroService.reabrirFatura(id);
           toast.info("Fatura reaberta.");
        }
      } else {
        if(window.confirm("Confirmar recebimento deste pagamento?")) {
           await financeiroService.marcarComoPago(id);
           toast.success("Pagamento confirmado!");
        }
      }
      carregarDados();
    } catch (error) {
      toast.error("Erro ao atualizar status.");
    }
  };

  // Helper de Data
  const formatData = (timestamp) => {
    if (!timestamp) return '--/--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'dd/MM/yyyy');
  };

  // Helper de Status Visual
  const getStatusBadge = (fatura) => {
    const hoje = new Date();
    const vencimento = fatura.vencimento?.toDate ? fatura.vencimento.toDate() : new Date(fatura.vencimento);
    
    if (fatura.status === 'pago') {
      return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">PAGO</span>;
    }
    if (vencimento < hoje) {
      return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">VENCIDO</span>;
    }
    return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">PENDENTE</span>;
  };

  return (
    <div className="bg-gray-100 min-h-screen pt-24 pb-8 px-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Financeiro</h1>
            <p className="text-gray-500 text-sm">Controle de boletos e mensalidades</p>
          </div>
          <div className="flex gap-2">
             <button onClick={() => navigate('/master-dashboard')} className="px-4 py-2 border rounded bg-white text-gray-600 hover:bg-gray-50">Voltar</button>
             <button onClick={() => setModalOpen(true)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2">
               <FaPlus /> Nova Cobrança
             </button>
          </div>
        </div>

        {/* Modal de Criação (Simplificado) */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
              <h2 className="text-xl font-bold mb-4">Gerar Nova Cobrança</h2>
              <form onSubmit={handleCriarFatura} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700">Cliente</label>
                  <select 
                    className="w-full border p-2 rounded"
                    value={novaFatura.estabelecimentoId}
                    onChange={e => setNovaFatura({...novaFatura, estabelecimentoId: e.target.value})}
                  >
                    <option value="">Selecione...</option>
                    {estabs.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700">Valor (R$)</label>
                    <input 
                      type="number" 
                      className="w-full border p-2 rounded" 
                      placeholder="0.00"
                      value={novaFatura.valor}
                      onChange={e => setNovaFatura({...novaFatura, valor: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700">Vencimento</label>
                    <input 
                      type="date" 
                      className="w-full border p-2 rounded" 
                      value={novaFatura.vencimento}
                      onChange={e => setNovaFatura({...novaFatura, vencimento: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                   <label className="block text-sm font-bold text-gray-700">Descrição / Link Boleto</label>
                   <input 
                      type="text" 
                      className="w-full border p-2 rounded" 
                      placeholder="Ex: Mensalidade Janeiro"
                      value={novaFatura.descricao}
                      onChange={e => setNovaFatura({...novaFatura, descricao: e.target.value})}
                    />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Gerar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tabela de Faturas */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-semibold text-gray-600">Cliente</th>
                <th className="p-4 font-semibold text-gray-600">Vencimento</th>
                <th className="p-4 font-semibold text-gray-600">Valor</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Carregando...</td></tr>
              ) : faturas.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">Nenhuma fatura lançada.</td></tr>
              ) : (
                faturas.map(fatura => (
                  <tr key={fatura.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-bold text-gray-800">{fatura.estabelecimentoNome}</p>
                      <p className="text-xs text-gray-500">{fatura.descricao}</p>
                    </td>
                    <td className="p-4 text-gray-700">
                      {formatData(fatura.vencimento)}
                    </td>
                    <td className="p-4 font-mono font-bold text-gray-800">
                      R$ {parseFloat(fatura.valor).toFixed(2).replace('.', ',')}
                    </td>
                    <td className="p-4">
                      {getStatusBadge(fatura)}
                    </td>
                    <td className="p-4 text-right">
                      {fatura.status === 'pago' ? (
                        <button 
                          onClick={() => handleBaixa(fatura.id, 'pago')}
                          className="text-gray-400 hover:text-orange-500 text-sm flex items-center justify-end gap-1 ml-auto"
                          title="Desfazer pagamento"
                        >
                          <FaUndo /> Desfazer
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleBaixa(fatura.id, 'pendente')}
                          className="bg-green-100 text-green-700 px-3 py-1 rounded border border-green-200 hover:bg-green-200 text-sm font-bold flex items-center gap-2 ml-auto"
                        >
                          <FaCheck /> Confirmar Pagamento
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
    </div>
  );
}

export default FinanceiroMaster;