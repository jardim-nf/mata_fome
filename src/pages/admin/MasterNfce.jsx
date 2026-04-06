import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { FaArrowLeft, FaClipboardList, FaFileInvoice, FaExternalLinkAlt, FaBoxOpen, FaStore, FaFilePdf, FaSyncAlt } from 'react-icons/fa';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { vendaService } from '../../services/vendaService';
import { toast } from 'react-toastify';

function MasterNfce() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading } = useAuth();
  const [nfces, setNfces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [loadingAcao, setLoadingAcao] = useState(null);

  const [datePreset, setDatePreset] = useState('30d');
  const [dateRange, setDateRange] = useState(getPresetRange('30d') || { start: null, end: null });

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

        const [pedSnap, venSnap] = await Promise.all([
          getDocs(query(collectionGroup(db, 'pedidos'))),
          getDocs(query(collectionGroup(db, 'vendas')))
        ]);

        const extrairData = (c) => {
          if (!c) return null;
          if (typeof c.toDate === 'function') return c.toDate();
          if (c.seconds) return new Date(c.seconds * 1000);
          const d = new Date(c); return isNaN(d.getTime()) ? null : d;
        };
        const getDate = (item) => extrairData(item.createdAt) || extrairData(item.dataPedido) || extrairData(item.adicionadoEm) || extrairData(item.updatedAt);

        let todosFiltrados = [];

        [...pedSnap.docs, ...venSnap.docs].forEach(d => {
           let data = { id: d.id, ...d.data(), _path: d.ref.path };
           
           if ((data.fiscal && (data.fiscal.status === 'autorizado' || data.fiscal.status === 'CONCLUIDO')) || !!data.url_danfe || !!data?.fiscal?.urlDanfe) {
               const dt = getDate(data) || new Date(0);
               data._dataCalculada = dt; 

               if (dateRange.start && dateRange.end) {
                 const s = new Date(dateRange.start); s.setHours(0,0,0,0);
                 const e = new Date(dateRange.end); e.setHours(23,59,59,999);
                 if (dt >= s && dt <= e) todosFiltrados.push(data);
               } else {
                 const lm = new Date(); lm.setDate(lm.getDate() - 30);
                 if (dt >= lm) todosFiltrados.push(data);
               }
           }
        });

        todosFiltrados.sort((a, b) => b._dataCalculada - a._dataCalculada);
        setNfces(todosFiltrados);
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

  const getEstabId = (nota) => {
    if (nota.estabelecimentoId) return nota.estabelecimentoId;
    if (nota.estabelecimento_id) return nota.estabelecimento_id;
    if (nota._path) {
      const parts = nota._path.split('/');
      const idx = parts.indexOf('estabelecimentos');
      if (idx >= 0 && parts.length > idx + 1) return parts[idx+1];
    }
    return 'desconhecido';
  };

  const getTotal = (item) => Number(item.totalFinal) || Number(item.total) || Number(item.valorFinal) || Number(item.valorTotal) || 0;

  const nfcesFiltradas = nfces.filter(nota => {
    if (filterEstab !== 'todos') {
      const eId = getEstabId(nota);
      if (eId !== filterEstab) return false;
    }
    return true;
  });

  const handleBaixarPdf = async (nota) => {
    const idPlugNotas = nota.fiscal?.idPlugNotas;
    if (!idPlugNotas) {
      toast.error('NFCE sem identificador PlugNotas. Não é possível baixar o PDF em tempo real.');
      return;
    }
    setLoadingAcao(nota.id);
    try {
      const res = await vendaService.baixarPdfNfce(idPlugNotas, nota.fiscal?.pdf);
      if (res && res.success) {
        // Success handled silently as the window opens automatically in the service or here
      } else {
        toast.warning(res.error || 'Falha ao baixar o PDF.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao baixar PDF da NFC-e');
    } finally {
      setLoadingAcao(null);
    }
  };

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
                            const data = nota._dataCalculada ? nota._dataCalculada.toLocaleString('pt-BR') : '';
                            const estabId = getEstabId(nota);
                            const realNome = estabMap[estabId] || estabId.toUpperCase();
                            const valNum = getTotal(nota);
                            const valorStr = `R$ ${valNum.toFixed(2)}`;
                            
                            return (
                                <tr key={nota.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                                <td className="p-4 font-bold text-slate-700 text-sm">#{nota.id.substring(0,6)}</td>
                                <td className="p-4 text-xs font-semibold text-slate-500">{data}</td>
                                <td className="p-4">
                                    <div className="text-sm font-bold text-slate-800">{nota.cliente?.nome || nota.clienteNome || 'Anônimo'}</div>
                                    <div className="text-xs text-slate-400">{valorStr}</div>
                                </td>
                                <td className="p-4"><span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded truncate max-w-[120px] inline-block" title={realNome}>{realNome}</span></td>
                                <td className="p-4 text-center">
                                    <button 
                                        onClick={() => handleBaixarPdf(nota)}
                                        disabled={loadingAcao === nota.id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                    >
                                        {loadingAcao === nota.id ? <FaSyncAlt className="animate-spin" /> : <FaFilePdf />}
                                        {loadingAcao === nota.id ? 'Baixando...' : 'PDF DANFE'}
                                    </button>
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
                 <p className="text-slate-500 font-medium">Nenhuma nota fiscal encontrada no período selecionado e/ou na franquia filtrada.</p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MasterNfce;
