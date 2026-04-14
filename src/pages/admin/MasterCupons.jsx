import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query } from 'firebase/firestore';
import { FaArrowLeft, FaTags, FaBoxOpen, FaPercentage, FaStore, FaBolt } from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function MasterCupons() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  const [cupons, setCupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchCupons = async () => {
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

        const snap = await getDocs(query(collectionGroup(db, 'cupons')));
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));
        
        // Sorting by active state then alphanumeric
        data.sort((a, b) => {
          const statusA = a.ativo !== false ? 1 : 0;
          const statusB = b.ativo !== false ? 1 : 0;
          if (statusB !== statusA) return statusB - statusA;
          return (a.codigo || a.id).localeCompare(b.codigo || b.id);
        });

        setCupons(data);
      } catch (err) {
        console.error('Erro ao buscar cupons globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCupons();
  }, [currentUser, isMasterAdmin]);

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-[#FF3B30] min-h-screen bg-[#F5F5F7]">Acesso Negado</div>;

  const cuponsFiltrados = cupons.filter(cupom => {
    if (filterEstab !== 'todos') {
      let estabId = 'desconhecido';
      if (cupom._path) {
        const parts = cupom._path.split('/');
        const idx = parts.indexOf('estabelecimentos');
        if (idx >= 0) estabId = parts[idx+1];
      }
      if (estabId !== filterEstab) return false;
    }
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
            <h1 className="font-semibold text-sm tracking-tight text-black">Hub de Promoções</h1>
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
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-[#F5F5F7] border border-[#E5E5EA] text-[#86868B] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">Inteligência de Vendas</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Cupons da Rede</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Gestão consolidada de todas as ofertas ativas na plataforma (<span className="text-black font-black">{cuponsFiltrados.length}</span> rastreados).</p>
          </div>
        </div>

        {/* --- FILTROS PILL-STYLE --- */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8 px-2">
            <div className="relative w-full sm:w-auto bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm hover:border-[#86868B] transition-colors">
                <FaStore className="text-[#86868B] shrink-0" size={14} />
                <select 
                    className="bg-transparent border-none outline-none text-xs ml-3 w-full sm:min-w-[240px] font-bold text-[#1D1D1F] cursor-pointer appearance-none"
                    value={filterEstab}
                    onChange={e => setFilterEstab(e.target.value)}
                >
                    <option value="todos">Varrer Todas as Franquias</option>
                    {estabList.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
                <div className="pointer-events-none absolute right-5 text-[#86868B] text-[10px]">▼</div>
            </div>
        </div>

        {/* CONTENT GRID */}
        {loading ? (
          <div className="flex justify-center p-20">
            <div className="flex items-center gap-3 text-[#86868B] font-bold text-sm">
                <div className="w-8 h-8 border-4 border-[#E5E5EA] border-t-black rounded-full animate-spin"></div>
                Varrendo data centers...
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cuponsFiltrados.length > 0 ? cuponsFiltrados.map(cupom => {
              let estabId = 'desconhecido';
              if (cupom._path) {
                const parts = cupom._path.split('/');
                const idx = parts.indexOf('estabelecimentos');
                if (idx >= 0) estabId = parts[idx+1];
              }
              const realNome = estabMap[estabId] || estabId;
              const isAtivo = cupom.ativo !== false;
              
              return (
                <div key={cupom.id} className="bg-white border border-[#E5E5EA] p-6 rounded-[2rem] shadow-sm hover:shadow-md hover:border-black/20 transition-all duration-300 relative group">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[1rem] bg-[#F5F5F7] border border-[#E5E5EA] flex items-center justify-center text-[#1D1D1F] shadow-sm">
                            <FaPercentage size={16} />
                        </div>
                    </div>
                    {isAtivo ? (
                        <span className="bg-[#E5F1FF] text-[#007AFF] px-3 py-1.5 rounded-full text-[10px] font-bold border border-[#CCE3FF] uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-[#007AFF] rounded-full animate-pulse"></span> Válido
                        </span>
                    ) : (
                        <span className="bg-[#F5F5F7] text-[#86868B] px-3 py-1.5 rounded-full text-[10px] font-bold border border-[#E5E5EA] uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-[#86868B] rounded-full"></span> Espirado
                        </span>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-[#1D1D1F] mb-1 truncate" title={cupom.codigo || cupom.id}>
                    {(cupom.codigo || cupom.id).toUpperCase()}
                  </h3>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-sm font-semibold text-[#86868B]">Desconto de</span>
                    <span className="text-xl font-black text-[#1D1D1F]">
                        {cupom.tipo === 'porcentagem' || cupom.tipoDesconto === 'percentual' ? `${cupom.valor}%` : `R$ ${cupom.valor || 0}`}
                    </span>
                  </div>

                  <div className="pt-5 border-t border-[#F5F5F7]">
                    <p className="text-[10px] uppercase font-bold text-[#86868B] tracking-widest mb-2">Loja Vinculada</p>
                    <p className="text-xs font-bold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E5E5EA] rounded-xl px-3 py-2 truncate transition-colors group-hover:bg-[#E5E5EA]" title={realNome}>
                        {realNome}
                    </p>
                  </div>
                </div>
              );
            }) : (
               <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm">
                 <div className="w-16 h-16 bg-[#F5F5F7] border border-[#E5E5EA] rounded-full mx-auto flex items-center justify-center mb-4">
                    <FaBoxOpen className="text-2xl text-[#86868B]" />
                 </div>
                 <h3 className="text-lg font-bold text-[#1D1D1F] tracking-tight">Acervo de Códigos Vazio</h3>
                 <p className="text-[#86868B] font-medium text-sm mt-1">Nenhuma oferta foi rastreada pela central.</p>
               </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
      `}</style>
    </div>
  );
}

export default MasterCupons;
