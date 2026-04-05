import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FaArrowLeft, FaClipboardList, FaFileInvoice, FaExternalLinkAlt, FaBoxOpen, FaStore } from 'react-icons/fa';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';

function MasterNfce() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [nfces, setNfces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');

  const [datePreset, setDatePreset] = useState('7D');
  const [dateRange, setDateRange] = useState(getPresetRange('7D') || { start: null, end: null });

  useEffect(() => {
    if (!currentUser || !isMasterAdmin) return;
    
    const fetchNfces = async () => {
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

        let q;
        if (dateRange.start && dateRange.end) {
            const startDate = new Date(dateRange.start);
            startDate.setHours(0,0,0,0);
            const endDate = new Date(dateRange.end);
            endDate.setHours(23,59,59,999);
            q = query(
                collectionGroup(db, 'pedidos'),
                where('createdAt', '>=', startDate),
                where('createdAt', '<=', endDate)
            );
        } else {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            q = query(collectionGroup(db, 'pedidos'), where('createdAt', '>=', lastWeek));
        }

        const snap = await getDocs(q);
        
        let data = snap.docs.map(d => ({ id: d.id, ...d.data(), _path: d.ref.path }));
        
        // Filter only those with NFCe
        let filtrados = data.filter(d => (d.fiscal && d.fiscal.status === 'autorizado') || !!d.url_danfe);

        // Sorting by date desc
        filtrados.sort((a, b) => {
          const dA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
          const dB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
          return dB - dA;
        });

        setNfces(filtrados);
      } catch (err) {
        console.error('Erro ao buscar NFC-es globais', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNfces();
  }, [currentUser, isMasterAdmin, dateRange.start, dateRange.end]);

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const range = getPresetRange(preset);
      if (range) setDateRange(range);
    }
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
  };

  const handleDateClear = () => {
    setDatePreset(null);
    setDateRange({ start: null, end: null });
  };

  const nfcesFiltradas = nfces.filter(nota => {
    if (filterEstab !== 'todos') {
      let estabId = 'desconhecido';
      if (nota._path) {
        const parts = nota._path.split('/');
        const idx = parts.indexOf('estabelecimentos');
        if (idx >= 0) estabId = parts[idx+1];
      }
      if (estabId !== filterEstab) return false;
    }
    return true;
  });

  if (authLoading) return <div className="p-10 text-center">Carregando...</div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-red-500">Acesso Negado</div>;

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-emerald-50/20 min-h-screen font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/master-dashboard')} className="text-slate-400 hover:text-emerald-600 flex items-center gap-2 mb-6 text-sm font-bold transition-colors">
          <FaArrowLeft /> Voltar ao Master
        </button>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                    <FaClipboardList className="text-white text-xl" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Rede: NFC-e Emitidas</h1>
                    <p className="text-slate-500 text-sm mt-1">Gestão de notas fiscais autorizadas (<span className="font-bold">{nfcesFiltradas.length}</span>)</p>
                </div>
            </div>
            <DateRangeFilter
                activePreset={datePreset}
                dateRange={dateRange}
                onPresetChange={handleDatePresetChange}
                onRangeChange={handleDateRangeChange}
                onClear={handleDateClear}
            />
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-6 flex flex-col sm:flex-row items-center gap-4 relative z-10">
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <FaStore className="text-slate-400" />
             <select 
               className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400"
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
          <div className="py-20 text-center text-slate-400">Verificando dados fiscais...</div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
             {nfcesFiltradas.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 uppercase text-[10px] tracking-widest text-slate-400 font-black">
                        <th className="p-4">Pedido ID</th>
                        <th className="p-4">Data</th>
                        <th className="p-4">Cliente / Valor</th>
                        <th className="p-4">Loja Orix.</th>
                        <th className="p-4 text-center">Ações Fiscais</th>
                        </tr>
                    </thead>
                    <tbody>
                        {nfcesFiltradas.map((nota, i) => {
                            const data = nota.createdAt?.toDate ? nota.createdAt.toDate().toLocaleString('pt-BR') : '';
                            let estabId = 'desconhecido';
                            if (nota._path) {
                                const parts = nota._path.split('/');
                                const idx = parts.indexOf('estabelecimentos');
                                if (idx >= 0) estabId = parts[idx+1];
                            }
                            const realNome = estabMap[estabId] || estabId;
                            const valor = typeof nota.valorTotal === 'number' ? `R$ ${nota.valorTotal.toFixed(2)}` : 'R$ 0,00';
                            
                            return (
                                <tr key={nota.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                <td className="p-4 font-bold text-slate-700 text-sm">#{nota.id.substring(0,6)}</td>
                                <td className="p-4 text-xs font-semibold text-slate-500">{data}</td>
                                <td className="p-4">
                                    <div className="text-sm font-bold text-slate-800">{nota.cliente?.nome || 'Anônimo'}</div>
                                    <div className="text-xs text-slate-400">{valor}</div>
                                </td>
                                <td className="p-4"><span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded truncate max-w-[120px] inline-block" title={realNome}>{realNome}</span></td>
                                <td className="p-4 text-center">
                                    {(nota.fiscal?.urlDanfe || nota.url_danfe) ? (
                                        <a href={nota.fiscal?.urlDanfe || nota.url_danfe} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-bold transition-colors">
                                            <FaFileInvoice /> Ver DANFE <FaExternalLinkAlt className="ml-1 opacity-50" size={9} />
                                        </a>
                                    ) : (
                                        <span className="text-slate-400 text-xs italic">Sem Link</span>
                                    )}
                                </td>
                                </tr>
                            )
                        })}
                    </tbody>
                    </table>
                </div>
             ) : (
               <div className="py-20 text-center">
                 <FaBoxOpen className="mx-auto text-4xl text-slate-200 mb-3" />
                 <p className="text-slate-500 font-medium">Nenhuma nota fiscal emitida nos últimos 7 dias na plataforma.</p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterNfce;
