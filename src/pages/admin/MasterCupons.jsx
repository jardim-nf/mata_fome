import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query } from 'firebase/firestore';
import { FaArrowLeft, FaTags, FaBoxOpen, FaPercentage, FaStore } from 'react-icons/fa';

function MasterCupons() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
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
        
        // Sorting by creation or active state
        data.sort((a, b) => {
          const statusA = a.ativo ? 1 : 0;
          const statusB = b.ativo ? 1 : 0;
          return statusB - statusA;
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

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500">Acesso Negado</div>;

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
    <div className="bg-gradient-to-br from-slate-50 via-white to-amber-50/20 min-h-screen font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-amber-600 flex items-center gap-2 mb-6 text-sm font-bold transition-colors">
          <FaArrowLeft /> Voltar ao Master
        </button>
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
            <FaTags className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rede: Cupons Gerados</h1>
            <p className="text-slate-500 text-sm mt-1">Gestão de ofertas em todas as franquias (<span className="font-bold">{cuponsFiltrados.length}</span>)</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row items-center gap-4 relative z-10 w-fit">
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <FaStore className="text-slate-400" />
             <select 
               className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-amber-400"
               value={filterEstab}
               onChange={e => setFilterEstab(e.target.value)}
             >
                <option value="todos">Todas as Franquias</option>
                {estabList.map(e => (
                    <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
             </select>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">Varrendo promoções da rede...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cuponsFiltrados.length > 0 ? cuponsFiltrados.map(cupom => {
              let estabId = 'desconhecido';
              if (cupom._path) {
                const parts = cupom._path.split('/');
                const idx = parts.indexOf('estabelecimentos');
                if (idx >= 0) estabId = parts[idx+1];
              }
              const realNome = estabMap[estabId] || estabId;
              
              return (
                <div key={cupom.id} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${cupom.ativo !== false ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                  <div className="flex justify-between items-start mb-3 pl-1">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">{cupom.codigo || cupom.id}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${cupom.ativo !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                      {cupom.ativo !== false ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-4 pl-1">
                    <FaPercentage className="text-amber-400" size={12}/>
                    <span className="font-semibold text-slate-700 text-sm">
                      {cupom.tipo === 'porcentagem' || cupom.tipoDesconto === 'percentual' ? `${cupom.valor}% OFF` : `R$ ${cupom.valor || 0} OFF`}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-slate-50 flex items-center gap-2 pl-1">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Loja:</span>
                    <span className="text-[11px] font-bold text-slate-600 truncate bg-slate-50 px-2 py-0.5 rounded" title={realNome}>{realNome}</span>
                  </div>
                </div>
              );
            }) : (
               <div className="col-span-full py-10 text-center border border-dashed rounded-xl border-slate-200">
                 <FaBoxOpen className="mx-auto text-3xl text-slate-300 mb-2" />
                 <p className="text-slate-500 font-medium">Nenhum cupom listado na rede.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterCupons;
