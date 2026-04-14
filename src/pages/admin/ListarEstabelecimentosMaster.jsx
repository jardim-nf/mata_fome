import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast, where, getCountFromServer } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FaStore, FaPlus, FaEdit, FaTrash, FaPowerOff, FaCheck, FaChevronLeft, FaChevronRight,
  FaArrowLeft, FaLink, FaUserShield, FaBolt
} from 'react-icons/fa';
import { IoSearchOutline, IoGlobeOutline, IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ITEMS_PER_PAGE = 12; 

// Skeleton Card (Bento Style)
const SkeletonCard = () => (
  <div className="bg-white rounded-[2rem] border border-[#E5E5EA] p-6 animate-pulse shadow-sm">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-14 h-14 rounded-2xl bg-slate-100"></div>
      <div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded-lg w-32"></div><div className="h-3 bg-slate-50 rounded-lg w-16"></div></div>
    </div>
    <div className="space-y-2 mt-6"><div className="h-10 bg-slate-50 rounded-xl"></div><div className="h-10 bg-slate-50 rounded-xl"></div></div>
    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50/50"><div className="h-10 bg-slate-50 rounded-xl flex-1"></div><div className="h-10 w-10 bg-slate-50 rounded-xl"></div><div className="h-10 w-10 bg-slate-50 rounded-xl"></div></div>
  </div>
);

function ListarEstabelecimentos() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth(); 

  const [estabelecimentos, setEstabelecimentos] = useState([]); 
  const [loadingEstabs, setLoadingEstabs] = useState(true); 
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [lastVisible, setLastVisible] = useState(null);
  const [firstVisible, setFirstVisible] = useState(null); 
  const [currentPage, setCurrentPage] = useState(0); 
  const [hasMore, setHasMore] = useState(true); 
  const [hasPrevious, setHasPrevious] = useState(false); 
  const [totalCount, setTotalCount] = useState({ total: 0, ativos: 0, inativos: 0 });

  // Fetch counts
  useEffect(() => {
    if (!isMasterAdmin) return;
    const fetchCounts = async () => {
      try {
        const all = await getDocs(query(collection(db, 'estabelecimentos')));
        const docs = all.docs.map(d => d.data());
        setTotalCount({ total: docs.length, ativos: docs.filter(d => d.ativo).length, inativos: docs.filter(d => !d.ativo).length });
      } catch (e) { console.error(e); }
    };
    fetchCounts();
  }, [isMasterAdmin]);

  const fetchEstabelecimentos = useCallback(async (direction = 'next', startDoc = null, resetPagination = false) => {
    if (!isMasterAdmin || !currentUser) { setLoadingEstabs(false); return; }
    setLoadingEstabs(true); setError('');

    let baseQueryRef = collection(db, 'estabelecimentos');
    let queryConstraints = [];
    if (filterStatus === 'ativos') queryConstraints.push(where('ativo', '==', true));
    else if (filterStatus === 'inativos') queryConstraints.push(where('ativo', '==', false));

    const orderByField = 'nome'; 
    let q;
    if (resetPagination) q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));
    else if (direction === 'next' && startDoc) q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), startAfter(startDoc), limit(ITEMS_PER_PAGE));
    else if (direction === 'prev' && startDoc) q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'desc'), endBefore(startDoc), limitToLast(ITEMS_PER_PAGE));
    else q = query(baseQueryRef, ...queryConstraints, orderBy(orderByField, 'asc'), limit(ITEMS_PER_PAGE));

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
      } else { setFirstVisible(null); setLastVisible(null); setHasMore(false); setHasPrevious(false); }
    } catch (err) { setError("Erro ao carregar lista de lojas."); }
    finally { setLoadingEstabs(false); }
  }, [isMasterAdmin, currentUser, filterStatus]);

  useEffect(() => {
    if (!authLoading && isMasterAdmin && currentUser) {
      setCurrentPage(0); setLastVisible(null); setFirstVisible(null);
      fetchEstabelecimentos('next', null, true); 
    } else if (!authLoading && (!currentUser || !isMasterAdmin)) { navigate('/master-dashboard'); }
  }, [authLoading, isMasterAdmin, currentUser, filterStatus, fetchEstabelecimentos, navigate]); 

  const handleNextPage = () => { if (hasMore) { setCurrentPage(p => p + 1); fetchEstabelecimentos('next', lastVisible); } };
  const handlePreviousPage = () => { if (hasPrevious) { setCurrentPage(p => p - 1); fetchEstabelecimentos('prev', firstVisible); } };

  const filteredEstabs = useMemo(() => {
    if (!searchTerm.trim()) return estabelecimentos;
    const term = searchTerm.toLowerCase();
    return estabelecimentos.filter(e => (e.nome && e.nome.toLowerCase().includes(term)) || (e.slug && e.slug.toLowerCase().includes(term)));
  }, [estabelecimentos, searchTerm]);

  const toggleEstabelecimentoAtivo = async (id, currentStatus, nome) => {
    if (!window.confirm(`Deseja ${currentStatus ? 'DESATIVAR' : 'ATIVAR'} "${nome}"?`)) return;
    try {
      await updateDoc(doc(db, 'estabelecimentos', id), { ativo: !currentStatus });
      auditLogger(currentStatus ? 'ESTABELECIMENTO_DESATIVADO' : 'ESTABELECIMENTO_ATIVADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id, name: nome });
      toast.success(`Status de ${nome} atualizado.`);
      fetchEstabelecimentos('next', null, true);
    } catch (error) { toast.error('Erro ao atualizar status.'); }
  };

  const handleDeleteEstabelecimento = async (id, nome) => {
    if (window.confirm(`ATENÇÃO: Deletar "${nome}" é irreversível. Continuar?`)) {
      try {
        await deleteDoc(doc(db, 'estabelecimentos', id));
        auditLogger('ESTABELECIMENTO_DELETADO', { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, { type: 'estabelecimento', id, name: nome });
        toast.success("Estabelecimento deletado.");
        fetchEstabelecimentos('next', null, true);
      } catch (error) { toast.error("Erro ao deletar."); }
    }
  };

  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Módulo de Concessionárias</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center bg-[#F5F5F7] hover:bg-[#E5E5EA] transition-colors rounded-full px-4 py-2 w-56">
            <IoSearchOutline className="text-[#86868B]" size={16} />
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs ml-2 w-full placeholder-[#86868B] font-medium"
              placeholder="Buscar LOJA, slug..." />
          </div>

          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />

          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4 px-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Estabelecimentos</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Controle de unidades, administradores e status sistêmico.</p>
          </div>
          <Link to="/admin/cadastrar-estabelecimento"
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:scale-105 transition-transform shadow-md font-bold text-sm active:scale-95">
            <FaPlus /> Nova Operação
          </Link>
        </div>

        {/* STATUS BAR MOSAICO (MINI BENTO) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="bg-white border border-[#E5E5EA] rounded-[2rem] p-8 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#86868B] uppercase tracking-widest mb-1">Total Lojas</p>
              <h2 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">{totalCount.total}</h2>
            </div>
            <div className="w-14 h-14 bg-[#F5F5F7] rounded-full flex items-center justify-center text-[#86868B]">
              <IoGlobeOutline size={24} />
            </div>
          </div>
          <div className="bg-[#1D1D1F] border border-[#1D1D1F] rounded-[2rem] p-8 shadow-md flex items-center justify-between relative overflow-hidden group">
            <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl group-hover:bg-emerald-500/40 transition-colors duration-1000"></div>
            <div className="relative z-10">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-1">Liderando</p>
              <h2 className="text-4xl font-bold tracking-tight text-white">{totalCount.ativos} <span className="text-zinc-500 text-lg">Ativas</span></h2>
            </div>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-[2rem] p-8 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[#86868B] uppercase tracking-widest mb-1">Inativas / Pendentes</p>
              <h2 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">{totalCount.inativos}</h2>
            </div>
             <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center text-red-500">
              <FaPowerOff size={20} />
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-6 rounded-2xl text-sm font-bold flex items-center gap-2"><FaPowerOff /> {error}</div>}

        {/* TAB & FILTERS */}
        <div className="mb-6 flex flex-row items-center gap-2 overflow-x-auto hide-scrollbar px-2">
            {[
              { id: 'todos', label: 'Toda a Rede', count: totalCount.total },
              { id: 'ativos', label: 'Opera. Normais', count: totalCount.ativos },
              { id: 'inativos', label: 'Suspensionadas', count: totalCount.inativos },
            ].map(s => (
              <button key={s.id} onClick={() => setFilterStatus(s.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap 
                  ${filterStatus === s.id ? 'bg-black text-white shadow-md' : 'bg-white border border-[#E5E5EA] text-[#86868B] hover:text-black hover:border-gray-300'}`}>
                {s.label}
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${filterStatus === s.id ? 'bg-white text-black' : 'bg-[#F5F5F7] text-[#86868B]'}`}>{s.count}</span>
              </button>
            ))}
        </div>

        {/* BENTO CARDS GRID (AS LIST ITEMS) */}
        {loadingEstabs && estabelecimentos.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filteredEstabs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm">
            <div className="w-16 h-16 bg-[#F5F5F7] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FaStore className="text-2xl text-[#86868B]" />
            </div>
            <h3 className="font-bold text-black text-base">Não localizamos esta loja.</h3>
            <p className="text-[#86868B] text-sm mt-1">Busque novamente ou adicione uma nova operação.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 mb-8">
            {filteredEstabs.map(estab => (
              <div key={estab.id} className="bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm hover:scale-[1.02] transition-transform duration-300 flex flex-col overflow-hidden relative">
                
                {/* Header (Logo + Status Point) */}
                <div className="p-6 pb-4 flex items-start gap-4 relative">
                  <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] border border-[#E5E5EA]/50 flex items-center justify-center text-xl font-black text-[#86868B] overflow-hidden shrink-0">
                    {estab.imageUrl ? <img src={estab.imageUrl} alt={estab.nome} className="w-full h-full object-cover" /> : estab.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 className="font-bold text-lg text-[#1D1D1F] leading-tight line-clamp-1" title={estab.nome}>{estab.nome}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#86868B]">
                      {estab.ativo ? <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> : <span className="w-2 h-2 rounded-full bg-red-400"></span>}
                      {estab.ativo ? 'Em Funcionamento' : 'Painel Suspenso'}
                    </div>
                  </div>
                </div>

                {/* Main Information List Block */}
                <div className="px-6 pb-4 flex-1 space-y-3">
                  {/* Link Routing */}
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#86868B]"><FaLink className="text-[10px]" /></div>
                     <span className="text-sm font-semibold text-[#1D1D1F] truncate">/{estab.slug}</span>
                  </div>
                  
                  {/* Administrador Status */}
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#86868B]"><FaUserShield className="text-[10px]" /></div>
                     <span className={`text-sm font-semibold truncate ${estab.adminUID ? 'text-[#1D1D1F]' : 'text-red-500'}`}>
                      {estab.adminUID ? 'Administrador Vinculado' : 'Sem Identificação (Órfão)'}
                     </span>
                  </div>

                  {/* Faturamento (Billing Date) */}
                  {(() => {
                    const nextBilling = estab.nextBillingDate;
                    if (!nextBilling) return (
                      <div className="bg-[#F5F5F7] px-4 py-3 rounded-2xl text-[11px] font-semibold text-[#86868B]">
                        💳 Cobrança automática inativa
                      </div>
                    );
                    const billingDate = nextBilling?.toDate ? nextBilling.toDate() : new Date(nextBilling);
                    const hoje = new Date(); hoje.setHours(0,0,0,0); billingDate.setHours(0,0,0,0);
                    const diff = Math.ceil((billingDate - hoje) / (1000*60*60*24));
                    const fmtDate = billingDate.toLocaleDateString('pt-BR');
                    
                    if (diff < 0) return (
                      <div className="bg-red-50 px-4 py-3 rounded-2xl text-[11px] font-bold text-red-600 border border-red-100 flex items-center gap-2">
                        <span>🚨</span><span>Atrasada há {Math.abs(diff)}d ({fmtDate})</span>
                      </div>
                    );
                    if (diff <= 5) return (
                      <div className="bg-amber-50 px-4 py-3 rounded-2xl text-[11px] font-bold text-amber-700 border border-amber-100 flex items-center gap-2">
                        <span>⏰</span><span>Vence em {diff}d ({fmtDate})</span>
                      </div>
                    );
                    return (
                      <div className="bg-emerald-50 px-4 py-3 rounded-2xl text-[11px] font-bold text-emerald-700 border border-emerald-100 flex items-center gap-2">
                        <span>✅</span><span>Recebido. Próx: {fmtDate}</span>
                      </div>
                    );
                  })()}

                  {/* Certification Tracking */}
                  {(() => {
                    const certVal = estab.fiscal?.certificadoValidade;
                    if (!certVal) return null;
                    const certDate = certVal?.toDate ? certVal.toDate() : new Date(certVal);
                    const hoje = new Date();
                    const diff = Math.ceil((certDate - hoje) / (1000*60*60*24));
                    if (diff < 0) return (
                      <p className="text-[10px] font-bold text-red-500 bg-red-50/50 rounded-lg px-2 flex justify-center py-1 border border-red-100">Certificado Vencido</p>
                    );
                    if (diff <= 30) return (
                      <p className="text-[10px] font-bold text-orange-500 bg-orange-50/50 rounded-lg px-2 flex justify-center py-1 border border-orange-100">Cert. vence em {diff}d</p>
                    );
                    return null;
                  })()}
                </div>

                {/* Actions Dock */}
                <div className="px-6 py-4 bg-[#F5F5F7] flex gap-2 border-t border-[#E5E5EA]">
                  <Link to={`/master/estabelecimentos/${estab.id}/editar`} 
                    className="flex-1 py-3 rounded-full bg-white border border-[#E5E5EA] hover:border-black hover:text-black text-[#1D1D1F] text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                    <FaEdit /> Modificar
                  </Link>
                  <button onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 border ${estab.ativo ? 'bg-[#F5F5F7] border-[#E5E5EA] text-[#86868B] hover:bg-black hover:text-white' : 'bg-black text-white hover:bg-gray-800'}`}
                    title={estab.ativo ? "Desativar (Bloquear Loja)" : "Ativar Operação"}>
                    {estab.ativo ? <FaPowerOff size={14} /> : <FaCheck size={14} />}
                  </button>
                  <button onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                    className="w-11 h-11 rounded-full bg-white border border-red-100 hover:bg-red-500 hover:border-red-500 text-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95"
                    title="Remover Rede Permanentemente">
                    <FaTrash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {filteredEstabs.length > 0 && (
          <div className="flex justify-between items-center py-6">
            <span className="text-xs text-[#86868B] font-bold px-4 py-2 bg-white rounded-full shadow-sm border border-[#E5E5EA]">Visão Geral: Lote {currentPage + 1}</span>
            <div className="flex gap-2">
              <button onClick={handlePreviousPage} disabled={!hasPrevious || loadingEstabs}
                className="px-5 py-2 border border-[#E5E5EA] bg-white rounded-full text-xs font-bold text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
                Antecessor
              </button>
              <button onClick={handleNextPage} disabled={!hasMore || loadingEstabs}
                className="px-5 py-2 border border-[#E5E5EA] bg-white rounded-full text-xs font-bold text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm">
                Avançar Lote
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ─── ESTILOS GLOBAIS DE SISTEMA ─── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default ListarEstabelecimentos;