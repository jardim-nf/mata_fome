import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast, where } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FaStore, 
  FaSearch, 
  FaFilter, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaPowerOff, 
  FaCheck, 
  FaChevronLeft, 
  FaChevronRight, 
  FaSignOutAlt,
  FaArrowLeft,
  FaLink,
  FaUserShield,
  FaShopify
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 12; 

// --- Header Premium (Reutilizado do MasterDashboard) ---
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Admin';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          {/* LOGO AREA */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="flex items-center gap-2">
                <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-bold p-1.5 rounded-lg shadow-md transform -skew-x-6 group-hover:rotate-3 transition-transform">
                    <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                </div>
                <span className="text-gray-900 font-black text-xl tracking-tighter">
                    Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">Food</span>
                </span>
            </div>
          </div>

          {/* USER AREA */}
          <div className="flex items-center gap-5">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800 tracking-tight">{userEmailPrefix}</span>
              <span className="text-[9px] uppercase tracking-widest text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 mt-0.5">Master Access</span>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-all duration-300 p-2 rounded-xl hover:bg-red-50/80 active:scale-95"
                title="Encerrar Sessão"
            >
              <FaSignOutAlt size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ListarEstabelecimentos() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); 

  const [estabelecimentos, setEstabelecimentos] = useState([]); 
  const [loadingEstabs, setLoadingEstabs] = useState(true); 
  const [error, setError] = useState('');

  // Estados para busca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // PAGINAÇÃO
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null); 
  const [currentPage, setCurrentPage] = useState(0); 
  const [hasMore, setHasMore] = useState(true); 
  const [hasPrevious, setHasPrevious] = useState(false); 

  // --- CARREGAMENTO DE DADOS ---
  const fetchEstabelecimentos = useCallback(async (direction = 'next', startDoc = null, resetPagination = false) => {
    if (!isMasterAdmin || !currentUser) { 
      setLoadingEstabs(false);
      return;
    }

    setLoadingEstabs(true);
    setError('');

    let baseQueryRef = collection(db, 'estabelecimentos');
    let queryConstraints = [];

    if (filterStatus === 'ativos') queryConstraints.push(where('ativo', '==', true));
    else if (filterStatus === 'inativos') queryConstraints.push(where('ativo', '==', false));

    const orderByField = 'nome'; 

    let q;
    if (resetPagination) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    } else if (direction === 'next' && startDoc) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(startDoc), limit(ITEMS_PER_PAGE));
    } else if (direction === 'prev' && startDoc) { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), endBefore(startDoc), limitToLast(ITEMS_PER_PAGE));
    } else { 
      q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    }

    try {
      const documentSnapshots = await getDocs(q);
      let fetchedEstabs = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (direction === 'prev') fetchedEstabs.reverse(); 

      setEstabelecimentos(fetchedEstabs);
      
      if (documentSnapshots.docs.length > 0) {
        setFirstVisible(documentSnapshots.docs[0]);
        setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);
        
        const nextCheck = await getDocs(query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(documentSnapshots.docs[documentSnapshots.docs.length - 1]), limit(1)));
        setHasMore(!nextCheck.empty);

        const prevCheck = await getDocs(query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), startAfter(documentSnapshots.docs[0]), limit(1))); 
        setHasPrevious(!prevCheck.empty);
      } else { 
        setFirstVisible(null);
        setLastVisible(null);
        setHasMore(false);
        setHasPrevious(false);
      }
      
    } catch (err) {
      console.error("Erro ao carregar:", err);
      setError("Erro ao carregar lista de lojas.");
    } finally {
      setLoadingEstabs(false);
    }
  }, [isMasterAdmin, currentUser, filterStatus]);

  useEffect(() => {
    if (!authLoading && isMasterAdmin && currentUser) {
      setCurrentPage(0); 
      setLastVisible(null);
      setFirstVisible(null);
      fetchEstabelecimentos('next', null, true); 
    } else if (!authLoading && (!currentUser || !isMasterAdmin)) {
      navigate('/master-dashboard');
    }
  }, [authLoading, isMasterAdmin, currentUser, filterStatus, fetchEstabelecimentos, navigate]); 

  // --- HANDLERS ---
  const handleNextPage = () => { if (hasMore) { setCurrentPage(prev => prev + 1); fetchEstabelecimentos('next', lastVisible); } };
  const handlePreviousPage = () => { if (hasPrevious) { setCurrentPage(prev => prev - 1); fetchEstabelecimentos('prev', firstVisible); } };

  const filteredEstabelecimentosBySearchTerm = estabelecimentos.filter(estab => {
    const term = searchTerm.toLowerCase();
    const matchesName = (estab.nome && estab.nome.toLowerCase().includes(term));
    const matchesSlug = (estab.slug && estab.slug.toLowerCase().includes(term));
    return matchesName || matchesSlug;
  });

  const toggleEstabelecimentoAtivo = async (estabelecimentoId, currentStatus, estabelecimentoNome) => {
    if (!window.confirm(`Deseja ${currentStatus ? 'DESATIVAR' : 'ATIVAR'} "${estabelecimentoNome}"?`)) return;
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId), { ativo: !currentStatus });
      auditLogger(currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome });
      toast.success(`Status de ${estabelecimentoNome} atualizado.`);
      fetchEstabelecimentos('next', null, true);
    } catch (error) {
      toast.error('Erro ao atualizar status.');
    }
  };

  const handleDeleteEstabelecimento = async (estabelecimentoId, estabelecimentoNome) => {
    if (window.confirm(`ATENÇÃO: Deletar "${estabelecimentoNome}" é irreversível. Todas as vendas desta loja serão mantidas no histórico, mas a loja sumirá. Continuar?`)) {
      try {
        await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId));
        auditLogger('ESTABELECIMENTO_DELETADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id: estabelecimentoId, name: estabelecimentoNome });
        toast.success("Estabelecimento deletado.");
        fetchEstabelecimentos('next', null, true);
      } catch (error) {
        toast.error("Erro ao deletar.");
      }
    }
  };

  if (authLoading || loadingEstabs && estabelecimentos.length === 0) {
    return <div className="flex h-screen items-center justify-center bg-[#f8fafc]"><div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin shadow-lg"></div></div>;
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen pt-24 pb-12 px-4 sm:px-6 font-sans selection:bg-yellow-200 selection:text-black">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
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
                <span className="bg-gray-900 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm">Gestão de Lojas</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Estabelecimentos</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">Controle as lojas parceiras e franqueados da plataforma.</p>
          </div>
          <Link 
            to="/admin/cadastrar-estabelecimento"
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-6 py-3 rounded-2xl hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg shadow-yellow-500/30 font-bold text-sm active:scale-95"
          >
            <FaPlus /> Cadastrar Loja
          </Link>
        </div>

        {/* ERROS */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 mb-6 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-sm animate-in fade-in">
            <FaPowerOff className="text-rose-500 text-lg" /> {error}
          </div>
        )}

        {/* BARRA DE FERRAMENTAS (BUSCA E FILTRO) */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/30 border border-gray-100 p-4 mb-8 flex flex-col md:flex-row gap-4 relative z-10">
            <div className="flex-1 relative">
                <FaSearch className="absolute left-5 top-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou slug..." 
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border-2 border-transparent hover:border-gray-100 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="md:w-72 relative group">
                <FaFilter className="absolute left-5 top-4 text-gray-400 z-10" />
                <select 
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border-2 border-transparent hover:border-gray-100 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm appearance-none cursor-pointer relative z-0"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="todos">Exibir Todos os Status</option>
                    <option value="ativos">Apenas Lojas Ativas</option>
                    <option value="inativos">Apenas Lojas Inativas</option>
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400 group-hover:text-yellow-500 transition-colors">
                    <FaChevronDown className="text-xs" />
                </div>
            </div>
        </div>

        {/* LISTA DE CARDS PREMIUM */}
        {filteredEstabelecimentosBySearchTerm.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 shadow-inner">
                <FaShopify className="text-4xl text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-800 tracking-tight">Nenhum resultado</h3>
            <p className="text-gray-400 text-sm mt-2 font-medium">Não encontramos lojas para esta pesquisa ou filtro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
            {filteredEstabelecimentosBySearchTerm.map(estab => (
              <div key={estab.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-500 group flex flex-col overflow-hidden relative">
                
                {/* Banner de Topo (Sútil) */}
                <div className={`h-2 w-full ${estab.ativo ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>

                {/* Cabeçalho do Card */}
                <div className="p-6 pb-4 flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        {/* Avatar / Logo */}
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 flex items-center justify-center text-xl font-black text-gray-300 group-hover:border-yellow-300 group-hover:shadow-md transition-all shadow-sm shrink-0 overflow-hidden">
                            {estab.imageUrl ? (
                                <img src={estab.imageUrl} alt={estab.nome} className="w-full h-full object-cover" />
                            ) : (
                                estab.nome?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 leading-tight line-clamp-1 tracking-tight text-lg" title={estab.nome}>{estab.nome}</h3>
                            <div className="flex items-center gap-1.5 mt-1.5">
                                {estab.ativo ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-100">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-rose-100">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inativo
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Corpo do Card (Detalhes) */}
                <div className="px-6 pb-6 flex-1">
                    <div className="space-y-2 mt-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100/50">
                            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-sm text-gray-400"><FaLink /></div>
                            <span className="truncate max-w-[150px] text-gray-700">/{estab.slug}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100/50">
                            <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-sm text-gray-400"><FaUserShield /></div>
                            <span className={`${estab.adminUID ? 'text-gray-700' : 'text-rose-500'}`}>
                                {estab.adminUID ? 'Admin Vinculado' : 'Sem Admin Vinculado'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Rodapé de Ações */}
                <div className="px-5 py-4 border-t border-gray-50 flex gap-2 bg-gray-50/30">
                    <Link 
                        to={`/master/estabelecimentos/${estab.id}/editar`} 
                        className="flex-1 py-2.5 rounded-xl bg-white border border-gray-200 hover:border-yellow-400 hover:text-yellow-600 text-gray-700 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                    >
                        <FaEdit /> Editar
                    </Link>
                    
                    <button
                        onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all shadow-sm hover:shadow-md active:scale-95 ${
                            estab.ativo 
                            ? 'bg-gray-300 hover:bg-rose-500 text-gray-600 hover:text-white' 
                            : 'bg-emerald-500 hover:bg-emerald-600'
                        }`}
                        title={estab.ativo ? "Desativar Loja" : "Ativar Loja"}
                    >
                        {estab.ativo ? <FaPowerOff size={14} /> : <FaCheck size={14} />}
                    </button>

                    <button
                        onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                        className="w-10 h-10 rounded-xl bg-white border border-gray-200 hover:bg-rose-500 hover:border-rose-500 text-gray-400 hover:text-white transition-all flex items-center justify-center shadow-sm hover:shadow-md active:scale-95"
                        title="Deletar Permanentemente"
                    >
                        <FaTrash size={14} />
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINAÇÃO PREMIUM */}
        {filteredEstabelecimentosBySearchTerm.length > 0 && (
            <div className="flex justify-between items-center py-6 border-t border-gray-200/60">
                <span className="text-xs text-gray-500 font-bold uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">Página {currentPage + 1}</span>
                <div className="flex gap-3">
                    <button
                        onClick={handlePreviousPage}
                        disabled={!hasPrevious || loadingEstabs}
                        className="px-5 py-2.5 bg-white border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 disabled:hover:border-gray-100 disabled:hover:text-gray-700 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
                    >
                        <FaChevronLeft className="text-xs" /> Voltar
                    </button>
                    <button
                        onClick={handleNextPage}
                        disabled={!hasMore || loadingEstabs}
                        className="px-5 py-2.5 bg-white border-2 border-gray-100 rounded-xl text-sm font-bold text-gray-700 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-40 disabled:hover:border-gray-100 disabled:hover:text-gray-700 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
                    >
                        Avançar <FaChevronRight className="text-xs" />
                    </button>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

// Helper local só para o dropdown do filtro (como não tínhamos importado em cima)
function FaChevronDown(props) {
    return <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" {...props}><path d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"></path></svg>;
}

export default ListarEstabelecimentos;