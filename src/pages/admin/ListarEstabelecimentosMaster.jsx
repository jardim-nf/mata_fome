// src/pages/admin/ListarEstabelecimentosMaster.jsx — Premium Light v2
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, doc, updateDoc, deleteDoc, getDocs, limit, startAfter, orderBy, endBefore, limitToLast, where, getCountFromServer } from 'firebase/firestore'; 
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { auditLogger } from '../../utils/auditLogger'; 
import { 
  FaStore, FaPlus, FaEdit, FaTrash, FaPowerOff, FaCheck, FaChevronLeft, FaChevronRight,
  FaSignOutAlt, FaArrowLeft, FaLink, FaUserShield, FaBolt, FaCrown, FaSearch
} from 'react-icons/fa';
import { IoSearchOutline, IoGlobeOutline } from 'react-icons/io5';

const ITEMS_PER_PAGE = 12; 

// Skeleton Card
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-slate-100 p-6 animate-pulse">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-14 h-14 rounded-xl bg-slate-100"></div>
      <div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded-lg w-32"></div><div className="h-3 bg-slate-50 rounded-lg w-16"></div></div>
    </div>
    <div className="space-y-2"><div className="h-10 bg-slate-50 rounded-xl"></div><div className="h-10 bg-slate-50 rounded-xl"></div></div>
    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-50"><div className="h-10 bg-slate-50 rounded-xl flex-1"></div><div className="h-10 w-10 bg-slate-50 rounded-xl"></div><div className="h-10 w-10 bg-slate-50 rounded-xl"></div></div>
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

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-slate-200 border-t-yellow-400 rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 h-16 border-b border-slate-100 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-105 transition-transform">
              <FaBolt className="text-white text-xs" />
            </div>
            <span className="text-slate-900 font-black text-lg tracking-tight">Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-500">Food</span></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center"><FaCrown className="text-yellow-600 text-[10px]" /></div>
              <span className="text-sm font-bold text-slate-700">{userName}</span>
            </div>
            <button onClick={async () => { await logout(); navigate('/'); }} className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all"><FaSignOutAlt size={14} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group">
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100 group-hover:border-yellow-200 transition-colors"><FaArrowLeft /></span> Voltar ao Dashboard
            </button>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-yellow-50 text-yellow-700 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-yellow-200">Gestão de Lojas</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Estabelecimentos</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">Controle as lojas parceiras e franqueados da plataforma.</p>
          </div>
          <Link to="/admin/cadastrar-estabelecimento"
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-6 py-3 rounded-xl hover:shadow-xl hover:shadow-yellow-400/30 transition-all shadow-lg shadow-yellow-400/20 font-black text-sm active:scale-95">
            <FaPlus /> Cadastrar Loja
          </Link>
        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 hover:shadow-lg transition-all duration-300">
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-yellow-50 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Lojas</p>
                <p className="text-3xl font-black text-slate-900">{totalCount.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/25 group-hover:scale-110 transition-transform">
                <IoGlobeOutline className="text-white" size={18} />
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-6 hover:shadow-lg transition-all duration-300">
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1">Lojas Ativas</p>
                <p className="text-3xl font-black text-slate-900">{totalCount.ativos}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <FaCheck className="text-emerald-500" />
              </div>
            </div>
          </div>
          <div className="group relative overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50/50 p-6 hover:shadow-lg transition-all duration-300">
            <div className="relative flex items-center justify-between">
              <div>
                <p className="text-[10px] text-red-600 font-black uppercase tracking-widest mb-1">Lojas Inativas</p>
                <p className="text-3xl font-black text-slate-900">{totalCount.inativos}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <FaPowerOff className="text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-4 mb-6 rounded-xl text-sm font-bold flex items-center gap-2"><FaPowerOff /> {error}</div>}

        {/* SEARCH + FILTER BAR */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <IoSearchOutline className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por nome ou slug..." 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 focus:bg-white transition-all font-semibold text-slate-700 text-sm"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 self-start sm:self-auto">
            {[
              { id: 'todos', label: 'Todos', count: totalCount.total },
              { id: 'ativos', label: 'Ativos', count: totalCount.ativos },
              { id: 'inativos', label: 'Inativos', count: totalCount.inativos },
            ].map(s => (
              <button key={s.id} onClick={() => setFilterStatus(s.id)}
                className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${filterStatus === s.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {s.label}
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${filterStatus === s.id ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200/50 text-slate-400'}`}>{s.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CARD GRID */}
        {loadingEstabs && estabelecimentos.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filteredEstabs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FaStore className="text-2xl text-slate-200" />
            </div>
            <h3 className="font-black text-slate-500 text-sm">Nenhum resultado</h3>
            <p className="text-slate-400 text-[11px] mt-1">Não encontramos lojas para esta pesquisa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
            {filteredEstabs.map(estab => (
              <div key={estab.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-100 hover:-translate-y-0.5 transition-all duration-300 group flex flex-col overflow-hidden">
                {/* Status bar */}
                <div className={`h-1.5 w-full ${estab.ativo ? 'bg-gradient-to-r from-emerald-400 to-teal-400' : 'bg-gradient-to-r from-red-300 to-rose-300'}`}></div>
                
                {/* Header */}
                <div className="p-5 pb-3 flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-slate-300 group-hover:border-yellow-200 transition-colors shrink-0 overflow-hidden">
                    {estab.imageUrl ? <img src={estab.imageUrl} alt={estab.nome} className="w-full h-full object-cover" /> : estab.nome?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 leading-tight line-clamp-1 text-sm" title={estab.nome}>{estab.nome}</h3>
                    <div className="mt-1.5">
                      {estab.ativo ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[10px] font-bold border border-red-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> Inativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="px-5 pb-3 flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-sm text-slate-400"><FaLink className="text-[9px]" /></div>
                    <span className="truncate text-slate-600">/{estab.slug}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center shadow-sm text-slate-400"><FaUserShield className="text-[9px]" /></div>
                    <span className={estab.adminUID ? 'text-slate-600' : 'text-red-400'}>
                      {estab.adminUID ? 'Admin Vinculado' : 'Sem Admin'}
                    </span>
                  </div>

                  {/* STATUS MENSALIDADE */}
                  {(() => {
                    const nextBilling = estab.nextBillingDate;
                    if (!nextBilling) return (
                      <div className="flex items-center gap-2 text-[11px] font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400">💳 Cobrança não configurada</span>
                      </div>
                    );
                    const billingDate = nextBilling?.toDate ? nextBilling.toDate() : new Date(nextBilling);
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    billingDate.setHours(0,0,0,0);
                    const diff = Math.ceil((billingDate - hoje) / (1000*60*60*24));
                    const fmtDate = billingDate.toLocaleDateString('pt-BR');
                    
                    if (diff < 0) return (
                      <div className="flex items-center gap-2 text-[11px] font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 text-red-700">
                        <span>🚨</span><span>Atrasada há {Math.abs(diff)}d — {fmtDate}</span>
                      </div>
                    );
                    if (diff <= 5) return (
                      <div className="flex items-center gap-2 text-[11px] font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-amber-700">
                        <span>⏰</span><span>Vence em {diff}d — {fmtDate}</span>
                      </div>
                    );
                    return (
                      <div className="flex items-center gap-2 text-[11px] font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-emerald-700">
                        <span>✅</span><span>Em dia — Próx: {fmtDate}</span>
                      </div>
                    );
                  })()}

                  {/* STATUS CERTIFICADO DIGITAL */}
                  {(() => {
                    const certVal = estab.fiscal?.certificadoValidade;
                    if (!certVal && !estab.fiscal?.certificadoUrl) return null;
                    if (!certVal) return (
                      <div className="flex items-center gap-2 text-[11px] font-semibold bg-orange-50 p-2.5 rounded-xl border border-orange-200 text-orange-600">
                        <span>🔐</span><span>Cert. sem validade informada</span>
                      </div>
                    );
                    const certDate = certVal?.toDate ? certVal.toDate() : new Date(certVal);
                    const hoje = new Date();
                    const diff = Math.ceil((certDate - hoje) / (1000*60*60*24));
                    const fmtDate = certDate.toLocaleDateString('pt-BR');

                    if (diff < 0) return (
                      <div className="flex items-center gap-2 text-[11px] font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 text-red-700">
                        <span>🔐</span><span>Cert. VENCIDO — {fmtDate}</span>
                      </div>
                    );
                    if (diff <= 30) return (
                      <div className="flex items-center gap-2 text-[11px] font-bold bg-orange-50 p-2.5 rounded-xl border border-orange-200 text-orange-600">
                        <span>🔐</span><span>Cert. vence em {diff}d — {fmtDate}</span>
                      </div>
                    );
                    return null; // OK, no need to show
                  })()}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t border-slate-50 flex gap-2 bg-slate-50/30">
                  <Link to={`/master/estabelecimentos/${estab.id}/editar`} 
                    className="flex-1 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-yellow-400 hover:text-yellow-600 text-slate-600 text-[11px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm">
                    <FaEdit /> Editar
                  </Link>
                  <button onClick={() => toggleEstabelecimentoAtivo(estab.id, estab.ativo, estab.nome)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${estab.ativo ? 'bg-slate-200 hover:bg-red-500 text-slate-500 hover:text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}
                    title={estab.ativo ? "Desativar" : "Ativar"}>
                    {estab.ativo ? <FaPowerOff size={12} /> : <FaCheck size={12} />}
                  </button>
                  <button onClick={() => handleDeleteEstabelecimento(estab.id, estab.nome)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-red-500 hover:border-red-500 text-slate-400 hover:text-white transition-all flex items-center justify-center shadow-sm active:scale-95"
                    title="Deletar">
                    <FaTrash size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {filteredEstabs.length > 0 && (
          <div className="flex justify-between items-center py-4 border-t border-slate-100">
            <span className="text-[11px] text-slate-400 font-bold bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Página {currentPage + 1}</span>
            <div className="flex gap-2">
              <button onClick={handlePreviousPage} disabled={!hasPrevious || loadingEstabs}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm">
                <FaChevronLeft className="text-[8px]" /> Voltar
              </button>
              <button onClick={handleNextPage} disabled={!hasMore || loadingEstabs}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 hover:border-yellow-400 hover:text-yellow-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm">
                Avançar <FaChevronRight className="text-[8px]" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ListarEstabelecimentos;