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

// Componente Header Atualizado
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
    <header className="fixed top-0 left-0 right-0 z-50 p-6 flex justify-between items-center bg-white shadow-lg border-b border-gray-200 backdrop-blur-sm bg-white/95">
      <div className="font-extrabold text-2xl text-gray-900 cursor-pointer hover:text-yellow-500 transition-colors duration-300 flex items-center gap-2" onClick={() => navigate('/')}>
        <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">DF</span>
        </div>
        DEU FOME <span className="text-yellow-500">.</span>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden sm:flex items-center space-x-3 bg-gray-100 rounded-full px-4 py-2">
          <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">{userEmailPrefix.charAt(0).toUpperCase()}</span>
          </div>
          <span className="text-gray-700 text-sm font-medium">Olá, {userEmailPrefix}!</span>
        </div>
        <Link to="/master-dashboard" className="px-4 py-2 rounded-full bg-yellow-500 text-white font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-yellow-600 hover:shadow-lg transform hover:-translate-y-0.5 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-full text-gray-700 border border-gray-300 font-semibold text-sm transition-all duration-300 ease-in-out hover:bg-gray-50 hover:border-gray-400 transform hover:-translate-y-0.5 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
          </svg>
          Sair
        </button>
      </div>
    </header>
  );
}

// Componente de Card de Log Individual
function LogCard({ log }) {
  const [showDetails, setShowDetails] = useState(false);

  const getActionTypeColor = (actionType) => {
    if (actionType.includes('CRIADO') || actionType.includes('ATIVADO')) return 'text-green-600 bg-green-50 border-green-200';
    if (actionType.includes('ATUALIZADO') || actionType.includes('EDITADO')) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (actionType.includes('DELETADO') || actionType.includes('DESATIVADO') || actionType.includes('CANCELADO')) return 'text-red-600 bg-red-50 border-red-200';
    if (actionType.includes('LOGIN')) return 'text-purple-600 bg-purple-50 border-purple-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-all duration-300">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getActionTypeColor(log.actionType)}`}>
              {log.actionType?.replace(/_/g, ' ')}
            </span>
            <span className="text-sm text-gray-500 font-medium">
              {log.timestamp && format(log.timestamp.toDate(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Ator</p>
            <div className="flex flex-col sm:flex-row gap-4">

                <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {log.actor?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">{log.actor?.email}</p>
                  <p className="text-xs text-gray-500">{log.actor?.role}</p>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Alvo</p>
              <p className="text-sm text-gray-900">
                <span className="font-medium">{log.target?.type}</span>
                <span className="text-gray-500 ml-2 font-mono text-xs">
                  ID: {log.target?.id?.substring(0, 8)}...
                </span>
              </p>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300 flex items-center gap-2 self-start"
        >
          <svg className={`w-4 h-4 transition-transform duration-300 ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
          </svg>
          {showDetails ? 'Ocultar' : 'Detalhes'}
        </button>
      </div>

      {showDetails && (
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">Detalhes da Ação:</p>
          <pre className="text-xs text-gray-600 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto">
            {JSON.stringify(log.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AuditLogs() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');

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

  const clearFilters = () => {
    setFilterActionType('todos');
    setFilterActorEmail('');
    setFilterTargetType('todos');
    setFilterTargetId('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  if (authLoading || loadingLogs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mb-4"></div>
        <p className="text-xl text-gray-600 font-medium">Carregando logs...</p>
        <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns instantes</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen pt-24 pb-8 px-4">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-gray-900 text-center lg:text-left">
              📊 Logs de Auditoria
            </h1>
            <p className="text-lg text-gray-600 mt-2 text-center lg:text-left">
              Monitoramento completo de todas as ações do sistema
            </p>
            <div className="w-32 h-1 bg-gradient-to-r from-yellow-500 to-orange-500 mx-auto lg:mx-0 mt-4 rounded-full"></div>
          </div>
          <Link
            to="/master-dashboard"
            className="bg-white text-gray-700 font-semibold px-6 py-3 rounded-xl border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300 flex items-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Voltar ao Dashboard
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 mb-8 rounded-xl shadow-sm" role="alert">
            <div className="flex items-center">
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p className="font-bold">Erro ao carregar dados</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Logs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{logs.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tipos de Ação</p>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {new Set(logs.map(log => log.actionType)).size}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuários Ativos</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {new Set(logs.map(log => log.actor?.email)).size}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Seção de Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 gap-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
              </svg>
              Filtrar Logs
            </h2>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
              </svg>
              Limpar Filtros
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Período</label>
                <div className="grid grid-cols-1 gap-3">
                  <input 
                    type="date" 
                    value={filterStartDate} 
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="flex-col sm:flex-row rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                  />
                  <input 
                    type="date" 
                    value={filterEndDate} 
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="flex-col sm:flex-row rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Ação</label>
                <select 
                  value={filterActionType} 
                  onChange={e => setFilterActionType(e.target.value)}
                  className="flex-col sm:flex-row rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                >
                  <option value="todos">Todos os Tipos</option>
                  {allActionTypes.map(type => (
                    <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email do Ator</label>
                <input 
                  value={filterActorEmail} 
                  onChange={e => setFilterActorEmail(e.target.value)}
                  placeholder="Filtrar por email..."
                  className="flex-col sm:flex-row rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-500 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Alvo</label>
                <select 
                  value={filterTargetType} 
                  onChange={e => setFilterTargetType(e.target.value)}
                  className="flex-col sm:flex-row rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                >
                  <option value="todos">Todos os Tipos</option>
                  <option value="estabelecimento">Estabelecimento</option>
                  <option value="usuario">Usuário</option>
                  <option value="pedido">Pedido</option>
                  <option value="produto">Produto</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ID do Alvo</label>
                <input 
                  value={filterTargetId} 
                  onChange={e => setFilterTargetId(e.target.value)}
                  placeholder="ID específico do alvo..."
                  className="flex-col sm:flex-row rounded-xl border-gray-300 bg-gray-50 px-4 py-3 text-gray-800 placeholder-gray-500 transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 focus:shadow-lg border-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Logs */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-3">
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Registros de Auditoria ({logs.length})
          </h2>
          
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum log encontrado</h3>
              <p className="text-gray-600 mb-6">Tente ajustar os filtros de busca para ver mais resultados.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <LogCard key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>

        {/* CONTROLES DE PAGINAÇÃO */}
        <div className="flex justify-center items-center mt-12 space-x-4">
          <button
            onClick={handlePreviousPage}
            disabled={currentPageIndex === 0}
            className="px-6 py-3 bg-white text-gray-700 rounded-xl border border-gray-300 font-semibold hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
            </svg>
            Anterior
          </button>
          
          <div className="bg-white px-6 py-3 rounded-xl border border-gray-300 shadow-sm">
            <span className="text-gray-700 font-semibold">Página {currentPageIndex + 1}</span>
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={!hasMorePages}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none"
          >
            Próxima
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;