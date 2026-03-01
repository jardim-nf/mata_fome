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
  FaArrowLeft
} from 'react-icons/fa';

const ITEMS_PER_PAGE = 12; 

// --- Header Minimalista (Reutilizado) ---
function DashboardHeader({ currentUser, logout, navigate }) {
  const userEmailPrefix = currentUser.email ? currentUser.email.split('@')[0] : 'Admin';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between items-center h-full">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
             <div className="flex items-center gap-1">
                <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                    <FaStore />
                </div>
                <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                    Na<span className="text-yellow-500">Mão</span>
                </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Admin</span>
            </div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
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
      setError("Erro ao carregar lista.");
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
    if (window.confirm(`ATENÇÃO: Deletar "${estabelecimentoNome}" é irreversível. Continuar?`)) {
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

  if (authLoading || loadingEstabs) {
    return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans">
      <DashboardHeader currentUser={currentUser} logout={logout} navigate={navigate} />
      
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
               <FaArrowLeft /> Voltar ao Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Estabelecimentos</h1>
            <p className="text-gray-500 text-sm mt-1">Gerencie as lojas parceiras da plataforma.</p>
          </div>
          <Link 
            to="/admin/cadastrar-estabelecimento"
            className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-lg font-semibold text-sm"
          >
            <FaPlus /> Cadastrar Novo
          </Link>
        </div>

        {/* ERROS */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 rounded-xl text-sm flex items-center gap-2">
            <FaPowerOff /> {error}
          </div>
        )}

        {/* BARRA DE FERRAMENTAS (BUSCA E FILTRO) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
                <FaSearch className="absolute left-4 top-3.5 text-gray-300" />
                <input 
                    type="text" 
                    placeholder="Buscar por nome ou slug..." 
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 focus:bg-white transition-all text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="md:w-64 relative">
                <FaFilter className="absolute left-4 top-3.5 text-gray-300" />
                <select 
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-yellow-400 focus:bg-white transition-all text-sm appearance-none cursor-pointer"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="todos">Todos os Status</option>
                    <option value="ativos">Apenas Ativos</option>
                    <option value="inativos">Apenas Inativos</option>
                </select>
            </div>
        </div>

        {/* LISTA DE CARDS */}
        {filteredEstabelecimentosBySearchTerm.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 text-2xl">
                <FaStore />
            </div>
            <h3 className="text-lg font-bold text-gray-700">Nenhum estabelecimento encontrado</h3>
            <p className="text-gray-400 text-sm mt-1">Tente mudar o termo de busca ou filtro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {filteredEstabelecimentosBySearchTerm.map(estab => (
              <div key={estab.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-yellow-200 transition-all duration-300 group flex flex-col">
                
                {/* Cabeçalho do Card */}
                <div className="p-5 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {/* Avatar / Logo Placeholder */}
                        <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-lg font-bold text-gray-400 group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                            {estab.imageUrl ? (
                                <img src={estab.imageUrl} alt={estab.nome} className="w-full h-full object-cover rounded-xl" />
                            ) : (
                                estab.nome?.charAt(0).toUpperCase()
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 leading-tight line-clamp-1" title={estab.nome}>{estab.nome}</h3>
                            <div className="flex items-center gap-1 mt-1">
                                <span className={`w-2 h-2 rounded-full ${estab.ativo ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                <span className="text-xs text-gray-500">{estab.ativo ? 'Ativo' : 'Inativo'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Corpo do Card */}
                <div className="px-5 pb-4 flex-1">
                    <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <p className="flex justify-between">
                            <span className="font-semibold">Slug:</span> 
                            <span className="truncate max-w-[120px]">/{estab.slug}</span>
                        </p>
                        <p className="flex justify-between">
                            <span className="font-semibold">Admin:</span> 
                            <span className="font-mono">{estab.adminUID ? 'Vinculado' : 'Sem Admin'}</span>
                        </p>
                    </div>
                </div>

                {/* Rodapé de Ações */}
                <div className="p-4 border-t border-gray-100 flex gap-2">
                    <Link 
                        to={`/master/estabelecimentos/${estab.id}/editar`} 
                        className="flex-1 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <FaEdit /> Editar
                    </Link>
                    
                    <button
                        onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-white transition-colors ${estab.ativo ? 'bg-gray-200 hover:bg-red-500 text-gray-500 hover:text-white' : 'bg-green-500 hover:bg-green-600'}`}
                        title={estab.ativo ? "Desativar" : "Ativar"}
                    >
                        {estab.ativo ? <FaPowerOff /> : <FaCheck />}
                    </button>

                    <button
                        onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                        className="w-9 h-9 rounded-lg bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-gray-400 transition-colors flex items-center justify-center"
                        title="Deletar"
                    >
                        <FaTrash />
                    </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINAÇÃO */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
            <span className="text-xs text-gray-400 font-medium">Página {currentPage + 1}</span>
            <div className="flex gap-2">
                <button
                    onClick={handlePreviousPage}
                    disabled={!hasPrevious || loadingEstabs}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    <FaChevronLeft className="text-xs" /> Anterior
                </button>
                <button
                    onClick={handleNextPage}
                    disabled={!hasMore || loadingEstabs}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    Próxima <FaChevronRight className="text-xs" />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}

export default ListarEstabelecimentos;