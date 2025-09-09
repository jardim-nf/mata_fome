// src/pages/admin/AuditLogs.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, orderBy, where, getDocs, limit, startAfter } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ITEMS_PER_PAGE = 15;

function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Usuário';
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Você foi desconectado com sucesso!');
      navigate('/');
    } catch (error) {
      toast.error('Ocorreu um erro ao tentar desconectar.');
    }
  };
  return (
    <header className="fixed top-0 left-0 right-0 z-20 p-6 flex justify-between items-center bg-black shadow-md border-b border-gray-800">
      <div className="font-extrabold text-2xl text-white cursor-pointer" onClick={() => navigate('/')}>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-white text-md font-medium">Olá, {userEmailPrefix}!</span>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full text-black bg-yellow-500 font-semibold text-sm">Dashboard</Link>
        <button onClick={handleLogout} className="px-4 py-2 rounded-full text-white border border-gray-600 font-semibold text-sm">Sair</button>
      </div>
    </header>
  );
}

function AuditLogs() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');

  // ===== CORREÇÃO AQUI: Voltando a usar useState para os filtros =====
  const [filterActionType, setFilterActionType] = useState('todos');
  const [filterActorEmail, setFilterActorEmail] = useState('');
  const [filterTargetType, setFilterTargetType] = useState('todos');
  const [filterTargetId, setFilterTargetId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  const [allActionTypes, setAllActionTypes] = useState([]);
  const [allActorEmails, setAllActorEmails] = useState([]);

  const [lastVisibleDoc, setLastVisibleDoc] = useState(null);
  const [pageHistory, setPageHistory] = useState([null]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);

  // Controle de acesso
  useEffect(() => {
    if (!authLoading && !isMasterAdmin) {
      toast.error('Acesso negado.');
      navigate('/master-dashboard');
    }
  }, [isMasterAdmin, authLoading, navigate]);

  const fetchLogs = useCallback(async (pageIndex = 0, direction = 'next') => {
    if (!isMasterAdmin) return;
    setLoadingLogs(true);
    setError('');
    
    try {
        let q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'));
        
        // Aplicando filtros
        if (filterActionType !== 'todos') q = query(q, where('actionType', '==', filterActionType));
        if (filterActorEmail) q = query(q, where('actor.email', '==', filterActorEmail));
        if (filterTargetType !== 'todos') q = query(q, where('target.type', '==', filterTargetType));
        if (filterTargetId) q = query(q, where('target.id', '==', filterTargetId));
        if (filterStartDate) q = query(q, where('timestamp', '>=', startOfDay(parseISO(filterStartDate))));
        if (filterEndDate) q = query(q, where('timestamp', '<=', endOfDay(parseISO(filterEndDate))));

        // Paginação
        const startAfterDoc = pageHistory[pageIndex];
        if (startAfterDoc) {
            q = query(q, startAfter(startAfterDoc));
        }
        q = query(q, limit(ITEMS_PER_PAGE));

        const documentSnapshots = await getDocs(q);
        const fetchedLogs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLogs(fetchedLogs);

        const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        setLastVisibleDoc(lastVisible);
        
        if (direction === 'next' && lastVisible) {
            const newPageHistory = pageHistory.slice(0, pageIndex + 1);
            if (!newPageHistory.includes(lastVisible)) {
                setPageHistory([...newPageHistory, lastVisible]);
            }
        }
        setCurrentPageIndex(pageIndex);
        setHasMorePages(documentSnapshots.docs.length === ITEMS_PER_PAGE);

    } catch (err) {
        setError('Erro ao carregar logs. Verifique os índices do Firestore.');
        toast.error('Erro ao carregar logs.');
    } finally {
        setLoadingLogs(false);
    }
  }, [isMasterAdmin, filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate, pageHistory]);

  useEffect(() => {
    if (isMasterAdmin) {
        fetchLogs(0, 'next');
    }
  }, [isMasterAdmin, filterActionType, filterActorEmail, filterTargetType, filterTargetId, filterStartDate, filterEndDate]);


  const handleNextPage = () => {
    if (hasMorePages) fetchLogs(currentPageIndex + 1, 'next');
  };

  const handlePreviousPage = () => {
    if (currentPageIndex > 0) fetchLogs(currentPageIndex - 1, 'prev');
  };

  if (authLoading || loadingLogs) {
    return <div className="text-center p-8">Carregando...</div>;
  }
  
  return (
    <div className="bg-gray-50 min-h-screen pt-24 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-extrabold text-black">Registros de Auditoria</h1>
            <Link to="/master-dashboard" className="bg-gray-200 text-gray-700 font-semibold px-5 py-2 rounded-lg">Voltar</Link>
        </div>
        {error && <div className="bg-red-100 text-red-700 p-4 mb-6 rounded-md">{error}</div>}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-bold mb-4 text-black">Filtrar Logs</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="p-2 border rounded"/>
                <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="p-2 border rounded"/>
                <select value={filterActionType} onChange={e => setFilterActionType(e.target.value)} className="p-2 border rounded">
                    <option value="todos">Todos os Tipos</option>
                    {allActionTypes.map(type => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                </select>
                <input value={filterTargetId} onChange={e => setFilterTargetId(e.target.value)} placeholder="ID do Alvo" className="p-2 border rounded"/>
            </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase">Data/Hora</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase">Ação</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase">Ator</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase">Alvo</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-black uppercase">Detalhes</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">{log.timestamp && format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}</td>
                            <td className="px-6 py-4 text-sm"><span className="font-semibold text-blue-700">{log.actionType?.replace(/_/g, ' ')}</span></td>
                            <td className="px-6 py-4 text-sm text-gray-700">{log.actor?.email} ({log.actor?.role})</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{log.target?.type} - ID: {log.target?.id?.substring(0, 8)}...</td>
                            <td className="px-6 py-4 text-sm text-gray-600"><pre className="whitespace-pre-wrap max-w-xs">{JSON.stringify(log.details, null, 2)}</pre></td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        <div className="flex justify-center items-center mt-8 space-x-4">
          <button onClick={handlePreviousPage} disabled={currentPageIndex === 0} className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50">Anterior</button>
          <span>Página {currentPageIndex + 1}</span>
          <button onClick={handleNextPage} disabled={!hasMorePages} className="px-4 py-2 bg-yellow-500 text-black rounded disabled:opacity-50">Próxima</button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;