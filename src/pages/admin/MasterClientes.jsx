import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, limit, doc, updateDoc } from 'firebase/firestore';
import { FaArrowLeft, FaUsers, FaBoxOpen, FaPhoneAlt, FaStore, FaClock, FaBolt, FaCrown, FaSignOutAlt, FaSearch, FaEnvelope } from 'react-icons/fa';
import { IoLogOutOutline, IoSearchOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';

// ─── Skeleton Loader (Bento Style) ───
const SkeletonRow = () => (
  <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4 animate-pulse border-b border-[#E5E5EA]">
    <div className="w-12 h-12 bg-slate-100 rounded-2xl shrink-0"></div>
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-100 rounded-lg w-40"></div>
      <div className="h-3 bg-slate-50 rounded-lg w-24"></div>
    </div>
    <div className="h-6 bg-slate-100 rounded-lg w-20"></div>
    <div className="h-8 bg-slate-100 rounded-full w-24"></div>
  </div>
);

function MasterClientes() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');

  // Controle do Modal de Permissões
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminTargetUser, setAdminTargetUser] = useState(null);
  const [adminSelectedStores, setAdminSelectedStores] = useState([]);

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchClientes = async () => {
      setLoading(true);
      try {
        const estabSnap = await getDocs(collection(db, 'estabelecimentos'));
        const emap = {};
        const elist = [];
        estabSnap.forEach(d => {
            emap[d.id] = d.data().nome || d.id;
            elist.push({ id: d.id, nome: d.data().nome || d.id });
        });
        setEstabMap(emap);
        setEstabList(elist.sort((a,b) => a.nome.localeCompare(b.nome)));

        // Query pedidos directly
        // Limite reduzido de 3500 para 500 para evitar sobrecarga excessiva de dados no frontend.
        const qPed = query(collectionGroup(db, 'pedidos'), limit(1000));
        const [usersSnap, snap] = await Promise.all([
           getDocs(collection(db, 'usuarios')),
           getDocs(qPed)
        ]);

        const mapByPhone = {};

        // 1. Popular com usuários registrados (inclui administradores/donos)
        usersSnap.docs.forEach(d => {
           const u = d.data();
           const rawPhone = u.telefone || '';
           const phone = rawPhone.replace(/\D/g, '') || d.id; // fallback para UID se não tiver telefone

           mapByPhone[phone] = {
             userId: d.id,
             nome: u.nome || u.displayName || 'Não Registrado',
             whatsapp: rawPhone || 'Sem número',
             email: u.email || '',
             lojas: new Set(['App Geral (Web)']),
             pedidosAcumulados: 0,
             dataCadastro: u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : new Date()),
             isAdmin: !!(u.isAdmin || u.isMasterAdmin),
             estabelecimentosAdmin: u.estabelecimentosGerenciados || [],
             isRegistered: true
           };
        });

        // 2. Popular/Atualizar com base nos pedidos
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));

        data.forEach(p => {
          const cli = p.cliente || {};
          const rawPhone = cli.telefone || p.clienteTelefone || p.telefone || '';
          const phone = rawPhone.replace(/\D/g, '') || 'Sem número';
          
          if (!mapByPhone[phone]) {
            mapByPhone[phone] = {
              nome: cli.nome || p.nome || 'Não Registrado',
              whatsapp: rawPhone || 'Sem número',
              email: cli.email || p.email || '',
              lojas: new Set(),
              estabelecimentosAdmin: [],
              pedidosAcumulados: 0,
              dataCadastro: null
            };
          }
          
          let estabId = 'desconhecido';
          if (p._path) {
            const parts = p._path.split('/');
            const idx = parts.indexOf('estabelecimentos');
            if (idx >= 0 && parts.length > idx + 1) estabId = parts[idx+1];
          }
          if (estabId && estabId !== 'desconhecido') {
             mapByPhone[phone].lojas.add(estabId);
          }
          
          mapByPhone[phone].pedidosAcumulados += 1;
          
          if (!mapByPhone[phone].nome || mapByPhone[phone].nome === 'Não Registrado') {
             if (cli.nome || p.nome) mapByPhone[phone].nome = cli.nome || p.nome;
          }

          if (!mapByPhone[phone].email) {
             if (cli.email || p.email) mapByPhone[phone].email = cli.email || p.email;
          }

          const rawDate = p.createdAt || p.dataPedido || null;
          let currentData = null;
          if (rawDate) {
              if (typeof rawDate.toDate === 'function') currentData = rawDate.toDate();
              else if (rawDate instanceof Date) currentData = rawDate;
              else currentData = new Date(rawDate);
          }

          if (currentData && !isNaN(currentData.getTime())) {
              const currentTimestamp = currentData.getTime();
              const existingTimestamp = mapByPhone[phone].dataCadastro ? new Date(mapByPhone[phone].dataCadastro).getTime() : Infinity;
              if (currentTimestamp < existingTimestamp) {
                  mapByPhone[phone].dataCadastro = currentData;
              }
          }
        });

        let merged = Object.values(mapByPhone).map(c => {
          let lojasArr = Array.from(c.lojas);
          if (lojasArr.length === 0) lojasArr = ['desconhecido'];
          return { ...c, lojasArray: lojasArr };
        });

        merged.sort((a, b) => {
           // Promove admins primeiro, depois ordena por engajamento
           if (a.isAdmin && !b.isAdmin) return -1;
           if (!a.isAdmin && b.isAdmin) return 1;
           return b.pedidosAcumulados - a.pedidosAcumulados;
        });
        setClientes(merged);
      } catch (err) {
        console.error('Erro ao buscar clientes globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [currentUser, isMasterAdmin]);

  const openAdminModal = (cli) => {
    setAdminTargetUser(cli);
    setAdminSelectedStores(cli.estabelecimentosAdmin || []);
    setAdminModalOpen(true);
  };

  const handleSaveAdminAccess = async () => {
    if (!adminTargetUser) return;
    try {
      const hasAccess = adminSelectedStores.length > 0;
      await updateDoc(doc(db, 'usuarios', adminTargetUser.userId), {
          isAdmin: hasAccess,
          estabelecimentosGerenciados: adminSelectedStores
      });
      
      setClientes(prev => prev.map(c => {
         if (c.userId === adminTargetUser.userId) {
            return { ...c, isAdmin: hasAccess, estabelecimentosAdmin: adminSelectedStores };
         }
         return c;
      }));
      
      toast.success('Permissões atualizadas com sucesso!');
      setAdminModalOpen(false);
    } catch(err) {
      console.error(err);
      toast.error('Erro ao salvar permissões.');
    }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500 bg-[#F5F5F7] min-h-screen">Acesso Negado</div>;

  const filt_clientes = clientes.filter(c => {
    const textMatch = (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (c.whatsapp || c.telefone || '').includes(searchTerm);
    if (!textMatch) return false;
    if (filterEstab !== 'todos' && !c.lojas.has(filterEstab)) return false;
    return true;
  });

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Hub de CRM Geral</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* ─── HEADER ESTATÍSTICO ─── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 px-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Consumidores Rede</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Bases de dados em tempo real. Identificamos <span className="text-black font-black">{filt_clientes.length}</span> perfis.</p>
          </div>
        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 px-2">
            
            {/* Store Filter */}
            <div className="relative w-full sm:w-auto bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm hover:border-[#86868B] transition-colors">
                <FaStore className="text-[#86868B] shrink-0" size={14} />
                <select 
                    className="bg-transparent border-none outline-none text-xs ml-3 w-full sm:min-w-[200px] font-bold text-[#1D1D1F] cursor-pointer appearance-none"
                    value={filterEstab}
                    onChange={e => setFilterEstab(e.target.value)}
                >
                    <option value="todos">Varrer Todas as Franquias</option>
                    {estabList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <div className="pointer-events-none absolute right-4 text-[#86868B] text-[10px]">▼</div>
            </div>

            {/* General Search */}
            <div className="relative w-full sm:w-72 bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm">
                <IoSearchOutline className="text-[#86868B] shrink-0" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar nome ou telefone..." 
                    className="bg-transparent border-none outline-none text-xs ml-3 w-full font-medium placeholder-[#86868B] text-[#1D1D1F]"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            
        </div>

        {/* ─── TABELA BENTO STYLE ─── */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden">
            {loading ? (
                <div className="divide-y divide-[#E5E5EA]">
                    {[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}
                </div>
            ) : filt_clientes.length === 0 ? (
                <div className="p-20 text-center">
                    <div className="w-16 h-16 bg-[#F5F5F7] rounded-3xl mx-auto flex items-center justify-center mb-6">
                        <FaSearch className="text-2xl text-[#86868B]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1D1D1F] mb-2">CRM Vazio no Filtro</h3>
                    <p className="text-sm font-medium text-[#86868B]">Não constam usuários para esta requisição.</p>
                </div>
            ) : (
                <div className="divide-y divide-[#E5E5EA]">
                    {filt_clientes.slice(0, 100).map((cli, i) => {
                        let dataCad = 'Sem Data';
                        if (cli.dataCadastro) {
                            const d = new Date(cli.dataCadastro);
                            if (!isNaN(d.getTime())) dataCad = d.toLocaleDateString('pt-BR');
                        }
                        
                        return (
                            <div key={cli.id || i} className="p-6 flex flex-col lg:flex-row lg:items-center gap-6 hover:bg-[#F5F5F7]/30 transition-colors">
                                {/* Identifier */}
                                <div className="flex items-center gap-4 flex-[2] min-w-[200px]">
                                    <div className="w-14 h-14 rounded-[1.25rem] bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#86868B] shrink-0 font-black text-xl">
                                        {cli.nome ? cli.nome.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div>
                                        <div className="font-bold text-base text-[#1D1D1F] flex items-center gap-2">
                                            {cli.nome || 'Não Registrado'}
                                            {cli.isAdmin && <FaCrown className="text-amber-500 text-xs" title="Administrador" />}
                                            {cli.isRegistered && cli.userId && (
                                                <button 
                                                    onClick={() => openAdminModal(cli)}
                                                    className={`ml-2 text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded-full border transition-all ${cli.isAdmin ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-[#E5E5EA] text-[#86868B] hover:bg-[#F5F5F7] hover:text-black hover:border-black'}`}
                                                    title="Governar Acessos de Franquia"
                                                >
                                                    {cli.isAdmin ? 'Configurar Acessos' : '+ Tornar Admin'}
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs font-semibold text-[#86868B] flex items-center gap-1.5 mt-1">
                                            <FaClock className="text-[10px]"/> Membro desde {dataCad}
                                        </p>
                                    </div>
                                </div>

                                {/* Phone & Email Info */}
                                <div className="flex-1 min-w-[200px] flex flex-col gap-2 items-start">
                                    <div className="inline-flex items-center gap-2 bg-[#F5F5F7] text-[#1D1D1F] text-[11px] font-bold px-3 py-1.5 rounded-full border border-[#E5E5EA]">
                                        <FaPhoneAlt className="text-[#86868B] text-[10px]" />
                                        {cli.whatsapp || cli.telefone || 'Sem Telefone'}
                                    </div>
                                    {cli.email && (
                                        <div className="inline-flex items-center gap-2 bg-[#F5F5F7] text-[#1D1D1F] text-[11px] font-medium px-3 py-1.5 rounded-full border border-[#E5E5EA] overflow-hidden truncate max-w-full">
                                            <FaEnvelope className="text-[#86868B] text-[10px] shrink-0" />
                                            <span className="truncate">{cli.email}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Order Stats */}
                                <div className="flex-[0.5] min-w-[100px] text-center lg:text-left">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-1">Engajamento</p>
                                    <p className="font-black text-2xl tracking-tight text-[#1D1D1F]">{cli.pedidosAcumulados}</p>
                                </div>

                                {/* Stores Used */}
                                <div className="flex-[2] min-w-[200px] lg:text-right mt-2 lg:mt-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#86868B] mb-2 lg:mb-1">Praças Interagidas</p>
                                    <div className="flex flex-wrap lg:justify-end gap-1.5">
                                        {cli.lojasArray.map(l => {
                                            const realName = estabMap[l] || l;
                                            return (
                                                <span key={l} className="text-[10px] font-bold bg-[#F5F5F7] text-[#86868B] border border-[#E5E5EA] px-2.5 py-1 rounded-full truncate max-w-[100px]" title={realName}>
                                                    {realName}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>

      {/* ─── MODAL DE CONFIGURAÇÃO DE ADMIN ─── */}
      {adminModalOpen && adminTargetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-black text-[#1D1D1F] mb-2 leading-tight">Painel de Controle</h2>
              <p className="text-sm text-[#86868B] mb-6 font-medium">
                  Selecione quais franquias <strong>{adminTargetUser.nome}</strong> tem autorização para gerenciar.
              </p>
              
              <div className="max-h-60 overflow-y-auto space-y-2 mb-6 custom-scrollbar pr-2">
                 {estabList.map(e => (
                    <label key={e.id} className={`flex items-center gap-3 p-4 rounded-xl border ${adminSelectedStores.includes(e.id) ? 'border-red-500 bg-red-50' : 'border-[#E5E5EA] bg-white'} hover:border-red-300 cursor-pointer transition-colors shadow-sm`}>
                       <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded text-red-500 focus:ring-red-500 border-gray-300"
                          checked={adminSelectedStores.includes(e.id)}
                          onChange={(ev) => {
                             if(ev.target.checked) setAdminSelectedStores(prev => [...prev, e.id]);
                             else setAdminSelectedStores(prev => prev.filter(id => id !== e.id));
                          }}
                       />
                       <span className={`font-semibold text-sm ${adminSelectedStores.includes(e.id) ? 'text-red-700' : 'text-[#1D1D1F]'}`}>{e.nome}</span>
                    </label>
                 ))}
                 {estabList.length === 0 && <p className="text-sm text-gray-500 text-center font-bold">Nenhuma franquia no sistema.</p>}
              </div>

              <div className="flex gap-3 pt-2">
                 <button onClick={() => setAdminModalOpen(false)} className="flex-1 py-3.5 rounded-xl font-bold text-[#86868B] bg-[#F5F5F7] hover:bg-[#E5E5EA] transition-colors focus:outline-none">Cancelar</button>
                 <button onClick={handleSaveAdminAccess} className="flex-1 py-3.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-md focus:outline-none">Salvar Acessos</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default MasterClientes;
