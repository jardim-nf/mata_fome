import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, limit } from 'firebase/firestore';
import { FaArrowLeft, FaUsers, FaBoxOpen, FaPhoneAlt, FaStore, FaClock, FaBolt, FaCrown, FaSignOutAlt, FaSearch } from 'react-icons/fa';
import { IoLogOutOutline, IoSearchOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
        const qPed = query(collectionGroup(db, 'pedidos'), limit(3500));
        const snap = await getDocs(qPed);
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));

        const mapByPhone = {};
        data.forEach(p => {
          const cli = p.cliente || {};
          const phone = cli.telefone || p.clienteTelefone || p.telefone || 'Sem número';
          
          if (!mapByPhone[phone]) {
            mapByPhone[phone] = {
              nome: cli.nome || p.nome || 'Não Registrado',
              whatsapp: phone,
              lojas: new Set(),
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

        merged.sort((a, b) => b.pedidosAcumulados - a.pedidosAcumulados);
        setClientes(merged);
      } catch (err) {
        console.error('Erro ao buscar clientes globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, [currentUser, isMasterAdmin]);

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500 bg-[#F5F5F7] min-h-screen">Acesso Negado</div>;

  const filt_clientes = clientes.filter(c => {
    const textMatch = (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
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
                                        <p className="font-bold text-base text-[#1D1D1F]">{cli.nome || 'Não Registrado'}</p>
                                        <p className="text-xs font-semibold text-[#86868B] flex items-center gap-1.5 mt-1">
                                            <FaClock className="text-[10px]"/> Membro desde {dataCad}
                                        </p>
                                    </div>
                                </div>

                                {/* Phone Info */}
                                <div className="flex-1 min-w-[150px]">
                                    <div className="inline-flex items-center gap-2 bg-[#F5F5F7] text-[#1D1D1F] text-[11px] font-bold px-3 py-1.5 rounded-full border border-[#E5E5EA]">
                                        <FaPhoneAlt className="text-[#86868B] text-[10px]" />
                                        {cli.whatsapp || cli.telefone || 'Sem Telefone'}
                                    </div>
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
    </div>
  );
}

export default MasterClientes;
