import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collectionGroup, collection, getDocs, query } from 'firebase/firestore';
import { FaArrowLeft, FaFileInvoice, FaBoxOpen, FaStore, FaFilePdf, FaSyncAlt, FaBolt, FaCrown, FaCheckCircle } from 'react-icons/fa';
import { IoLogOutOutline, IoSearchOutline } from 'react-icons/io5';
import DateRangeFilter, { getPresetRange } from '../../components/DateRangeFilter';
import { vendaService } from '../../services/vendaService';
import { toast } from 'react-toastify';
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

function MasterNfce() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [nfces, setNfces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
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
    const txtMatch = (nota.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                     (nota.cliente?.nome || nota.clienteNome || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!txtMatch) return false;
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
         // Silently handled as window opens
      } else {
        toast.warning(res.error || 'Falha ao baixar o PDF.');
      }
    } catch (err) {
      toast.error('Erro ao baixar PDF da NFC-e');
    } finally {
      setLoadingAcao(null);
    }
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;
  if (!isMasterAdmin) return <div className="p-10 text-center text-[#D0021B] bg-[#F5F5F7] min-h-screen">Acesso Negado</div>;

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Monitoramento Fiscal</h1>
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
        
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-8 gap-6 px-2">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Declarações Fiscais Embutidas</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Extração de notas fiscais confirmadas (<span className="text-black font-black">{nfcesFiltradas.length}</span> faturas processadas).</p>
          </div>
          <div className="bg-white border border-[#E5E5EA] rounded-full px-4 py-2 shadow-sm flex items-center">
            <DateRangeFilter
              datePreset={datePreset}
              dateRange={dateRange}
              onPresetChange={handleDatePresetChange}
              onRangeChange={handleDateRangeChange}
              onClear={handleDateClear}
            />
          </div>
        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 px-2">
            
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
            <div className="relative w-full sm:w-96 bg-white border border-[#E5E5EA] rounded-full px-5 py-3 flex items-center shadow-sm">
                <IoSearchOutline className="text-[#86868B] shrink-0" size={16} />
                <input 
                    type="text" 
                    placeholder="Buscar Código da Venda ou Cliente..." 
                    className="bg-transparent border-none outline-none text-xs ml-3 w-full font-medium placeholder-[#86868B] text-[#1D1D1F]"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* ─── LISTA FISCAL BENTO STYLE ─── */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-[#E5E5EA] overflow-hidden">
            {loading ? (
                <div className="divide-y divide-[#E5E5EA]">
                    {[1,2,3,4,5,6].map(i => <SkeletonRow key={i} />)}
                </div>
            ) : nfcesFiltradas.length === 0 ? (
                <div className="p-20 text-center">
                    <div className="w-16 h-16 bg-[#F5F5F7] rounded-3xl mx-auto flex items-center justify-center mb-6">
                        <FaFileInvoice className="text-2xl text-[#86868B]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#1D1D1F] mb-2">Nenhum Registro Fiscal</h3>
                    <p className="text-sm font-medium text-[#86868B]">Não constam faturas para a pesquisa ou período informados.</p>
                </div>
            ) : (
                <div className="divide-y divide-[#E5E5EA]">
                    {nfcesFiltradas.map((nota, i) => {
                        const dataCad = nota._dataCalculada ? nota._dataCalculada.toLocaleString('pt-BR') : '';
                        const estabId = getEstabId(nota);
                        const realNome = estabMap[estabId] || estabId.toUpperCase();
                        const valNum = getTotal(nota);
                        const valorStr = `R$ ${valNum.toFixed(2)}`;
                        
                        return (
                            <div key={nota.id} className="p-6 flex flex-col lg:flex-row lg:items-center gap-6 hover:bg-[#F5F5F7]/30 transition-colors">
                                {/* Identifier */}
                                <div className="flex items-center gap-4 flex-[1.5] min-w-[200px]">
                                    <div className="w-14 h-14 rounded-[1.25rem] bg-[#F2FCDA] border border-[#D0F2A8] flex flex-col items-center justify-center shrink-0">
                                        <FaCheckCircle className="text-[#1D7446] text-sm mb-1" />
                                        <span className="text-[9px] font-black text-[#1D7446]">AUT</span>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-[#1D1D1F] tracking-tight">#{nota.id.substring(0,8).toUpperCase()}</p>
                                        <p className="text-[11px] font-semibold text-[#86868B] mt-1">{dataCad}</p>
                                    </div>
                                </div>

                                {/* Cliente & Valor */}
                                <div className="flex-1 min-w-[150px]">
                                    <p className="text-sm font-bold text-[#1D1D1F]">{nota.cliente?.nome || nota.clienteNome || 'Consumidor Não Identificado'}</p>
                                    <p className="text-[11px] font-bold text-[#86868B] mt-1 uppercase tracking-widest">{valorStr}</p>
                                </div>

                                {/* Franquia Emissora */}
                                <div className="flex-1 min-w-[150px]">
                                    <span className="text-[10px] uppercase font-bold bg-[#F5F5F7] border border-[#E5E5EA] text-[#86868B] px-2.5 py-1.5 rounded-full inline-block truncate max-w-[150px]" title={realNome}>
                                        {realNome}
                                    </span>
                                </div>

                                {/* Ações */}
                                <div className="flex-[0.5] min-w-[150px] lg:text-right mt-2 lg:mt-0">
                                    <button 
                                        onClick={() => handleBaixarPdf(nota)}
                                        disabled={loadingAcao === nota.id}
                                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1D1D1F] text-white hover:bg-black rounded-full text-[11px] font-bold transition-all disabled:opacity-50 w-full md:w-auto active:scale-95 shadow-sm"
                                    >
                                        {loadingAcao === nota.id ? <FaSyncAlt className="animate-spin text-sm" /> : <FaFilePdf className="text-sm" />}
                                        {loadingAcao === nota.id ? 'Baixando...' : 'Obter DANFE'}
                                    </button>
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

export default MasterNfce;
