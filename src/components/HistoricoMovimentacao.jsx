import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
import { IoSearch } from 'react-icons/io5';

const formatarData = (timestamp) => {
  if (!timestamp) return '-';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const HistoricoMovimentacao = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const firestore = getFirestore();
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMovimentacoes, setFilteredMovimentacoes] = useState([]);

  useEffect(() => {
    const fetchHistorico = async () => {
      const historicoRef = collection(firestore, 'estabelecimentos', estabelecimentoIdPrincipal, 'historico_estoque');
      const q = query(historicoRef, orderBy('data', 'desc'));

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMovimentacoes(data);
    };

    fetchHistorico();
  }, [estabelecimentoIdPrincipal, firestore]);

  useEffect(() => {
    setFilteredMovimentacoes(
      movimentacoes.filter(mov => mov.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, movimentacoes]);

  return (
    <div className="bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 rounded-[2.5rem] shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Histórico de Movimentação de Estoque</h2>
        <div className="relative">
          <IoSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
          <input
            type="text"
            placeholder="Buscar por nome do insumo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-violet-500 focus:border-violet-500"
          />
        </div>
      </div>
      <table className="min-w-full bg-white rounded-lg shadow overflow-hidden">
        <thead>
          <tr>
            <th className="px-6 py-3 bg-slate-100 text-slate-700 text-left text-xs font-bold uppercase">Insumo</th>
            <th className="px-6 py-3 bg-slate-100 text-slate-700 text-left text-xs font-bold uppercase">Quantidade Anterior</th>
            <th className="px-6 py-3 bg-slate-100 text-slate-700 text-left text-xs font-bold uppercase">Quantidade Nova</th>
            <th className="px-6 py-3 bg-slate-100 text-slate-700 text-left text-xs font-bold uppercase">Tipo</th>
            <th className="px-6 py-3 bg-slate-100 text-slate-700 text-left text-xs font-bold uppercase">Usuário</th>
            <th className="px-6 py-3 bg-slate-100 text-slate-700 text-left text-xs font-bold uppercase">Data</th>
          </tr>
        </thead>
        <tbody>
          {filteredMovimentacoes.map(({ id, nome, quantidadeAnterior, quantidadeNova, tipo, usuario, data }) => (
            <tr key={id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4 text-slate-900">{nome}</td>
              <td className="px-6 py-4 text-slate-600">{quantidadeAnterior}</td>
              <td className="px-6 py-4 text-slate-600">{quantidadeNova}</td>
              <td className="px-6 py-4 text-slate-600">{tipo}</td>
              <td className="px-6 py-4 text-slate-600">{usuario}</td>
              <td className="px-6 py-4 text-slate-600">{formatarData(data)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoricoMovimentacao;