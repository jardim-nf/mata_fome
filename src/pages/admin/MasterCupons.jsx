import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { 
  FiArrowLeft, FiSun, FiMoon, FiLogOut, FiPercent, FiTrash2, 
  FiHome, FiSearch, FiCalendar, FiTrendingUp, FiActivity, FiLayers
} from 'react-icons/fi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';

// ─── Skeleton Loader (Bento Grid) ───
const SkeletonCard = ({ isDark }) => (
  <div className={`p-6 rounded-[2rem] border animate-pulse flex flex-col justify-between h-64 ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white border-slate-100'}`}>
    <div className="flex justify-between items-start">
      <div className={`w-12 h-12 rounded-[1rem] ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`w-20 h-6 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className="space-y-2 mt-4">
      <div className={`h-6 rounded-lg w-3/4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
      <div className={`h-4 rounded-lg w-1/2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
    </div>
    <div className={`h-12 rounded-xl mt-6 w-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}></div>
  </div>
);

function MasterCupons() {
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();
  
  const [cupons, setCupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estabMap, setEstabMap] = useState({});
  const [estabList, setEstabList] = useState([]);
  const [filterEstab, setFilterEstab] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Controle do Tema
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  const themeClasses = {
    dark: {
      bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950',
      surface: 'bg-slate-900/60 backdrop-blur-xl',
      surfaceHover: 'hover:bg-slate-800/80 hover:shadow-[0_8px_32px_rgba(99,102,241,0.06)] hover:scale-[1.01] hover:border-slate-700/50',
      border: 'border-slate-800/80',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      accent: 'bg-blue-600',
      accentHover: 'hover:bg-blue-700',
      gradient: 'from-blue-500 to-indigo-600',
      cardBg: 'bg-slate-900/40 backdrop-blur-xl',
      inputBg: 'bg-slate-950/60',
    },
    light: {
      bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc]',
      surface: 'bg-white/80 backdrop-blur-md',
      surfaceHover: 'hover:bg-white hover:shadow-[0_8px_30px_rgba(99,102,241,0.02)] hover:scale-[1.01] hover:border-slate-300/50',
      border: 'border-slate-200/60',
      text: 'text-slate-900',
      textSecondary: 'text-slate-650',
      textMuted: 'text-slate-400',
      accent: 'bg-blue-500',
      accentHover: 'hover:bg-blue-600',
      gradient: 'from-blue-550 to-purple-650',
      cardBg: 'bg-white/70 backdrop-blur-md',
      inputBg: 'bg-slate-100/50',
    }
  };

  const t = themeClasses[theme];
  const isDark = theme === 'dark';

  // Configura título SEO
  useEffect(() => {
    document.title = "IdeaFood - Hub de Promoções da Rede";
  }, []);

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

        // Busca paralela por subcoleção para evitar collectionGroup lenta ou indexErrors
        const promises = elist.map(est => {
          return getDocs(collection(db, 'estabelecimentos', est.id, 'cupons'));
        });
        const snaps = await Promise.all(promises);
        
        let data = [];
        snaps.forEach((snap, idx) => {
          const est = elist[idx];
          snap.forEach(d => {
            data.push({
              id: d.id,
              ...d.data(),
              _path: d.ref.path,
              estabelecimentoId: est.id,
              estabelecimentoNome: est.nome
            });
          });
        });
        
        // Ordena por ativos primeiro, depois por código
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

  const getEstabId = (cupom) => {
    if (cupom.estabelecimentoId) return cupom.estabelecimentoId;
    if (cupom._path) {
      const parts = cupom._path.split('/');
      const idx = parts.indexOf('estabelecimentos');
      if (idx >= 0) return parts[idx+1];
    }
    return 'desconhecido';
  };

  const cuponsFiltrados = useMemo(() => {
    return cupons.filter(cupom => {
      if (filterEstab !== 'todos') {
        const estabId = getEstabId(cupom);
        if (estabId !== filterEstab) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const code = (cupom.codigo || cupom.id || '').toLowerCase();
        if (!code.includes(q)) return false;
      }
      return true;
    });
  }, [cupons, filterEstab, searchTerm]);

  // Cálculo das métricas gerais (KPIs Bento)
  const kpiStats = useMemo(() => {
    const total = cuponsFiltrados.length;
    const ativos = cuponsFiltrados.filter(c => c.ativo !== false).length;
    const expirados = total - ativos;

    const pctCupons = cuponsFiltrados.filter(c => c.tipo === 'porcentagem' || c.tipoDesconto === 'percentual');
    const avgPct = pctCupons.length > 0 
      ? pctCupons.reduce((acc, c) => acc + Number(c.valor || c.valorDesconto || 0), 0) / pctCupons.length 
      : 0;

    const uniqueStores = new Set(cuponsFiltrados.map(c => getEstabId(c))).size;

    return { total, ativos, expirados, avgPct, uniqueStores };
  }, [cuponsFiltrados]);

  // Label amigável do Desconto
  const getDescontoLabel = (cupom) => {
    const tipo = cupom.tipo || cupom.tipoDesconto;
    const valor = cupom.valor || cupom.valorDesconto || 0;
    
    if (tipo === 'freteGratis') return 'Frete Grátis';
    if (tipo === 'porcentagem' || tipo === 'percentual') return `${valor}% OFF`;
    return `R$ ${Number(valor).toFixed(2).replace('.', ',')} OFF`;
  };

  // Safe formatting para data de validade
  const formatValidade = (validade) => {
    if (!validade) return 'Sem validade';
    let date = null;
    if (typeof validade.toDate === 'function') date = validade.toDate();
    else if (validade.seconds) date = new Date(validade.seconds * 1000);
    else date = new Date(validade);
    
    if (isNaN(date.getTime())) return 'Sem validade';
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8`}>
      
      {/* Luzes neon de fundo */}
      <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-500/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-purple-500/8 to-transparent blur-[120px] pointer-events-none" />

      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className={`max-w-[1400px] mx-auto backdrop-blur-xl border shadow-lg rounded-3xl h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all ${t.surface} ${t.border}`}>
        <div className="flex items-center gap-4">
          <button id="btn-back-master-dashboard" onClick={() => navigate('/master-dashboard')} className={`w-9 h-9 ${t.inputBg} hover:opacity-85 rounded-xl flex items-center justify-center transition-all`}>
            <FiArrowLeft className={`${t.text} text-sm`} />
          </button>
          <div className="hidden sm:block border-l border-slate-700/50 pl-4">
            <span className={`font-bold text-sm tracking-tight ${t.text}`}>Hub de Promoções</span>
            <p className={`text-[10px] ${t.textSecondary} font-semibold`}>{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            id="btn-toggle-theme"
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border ${t.inputBg} ${t.border} ${t.textSecondary} hover:${t.text} transition-all`}
            title="Alternar Tema"
          >
            {isDark ? <FiSun size={15} /> : <FiMoon size={15} />}
          </button>
          
          <div className="w-px h-6 bg-slate-700/50 hidden sm:block" />
          
          <button id="btn-logout" onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center transition-all" title="Sair">
            <FiLogOut className="text-red-400" size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8 relative z-10">
        
        {/* ─── HEADER DA PÁGINA ─── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <h1 id="page-cupons-title" className={`text-4xl font-extrabold tracking-tight ${t.text}`}>Cupons da Rede</h1>
            <p className={`${t.textSecondary} text-sm mt-1 font-semibold`}>Gestão consolidada de todas as ofertas ativas na plataforma.</p>
          </div>
        </div>

        {/* ─── METRICAS DE PROMOÇÃO BENTO GRID ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
          
          {/* Cupons Ativos */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400"><FiPercent size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
               }`}>Ativos</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Cupons Disponíveis</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>{kpiStats.ativos}</p>
            </div>
          </motion.div>

          {/* Cupons Expirados */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-slate-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-slate-500/10 rounded-2xl flex items-center justify-center text-slate-400"><FiActivity size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-slate-700/10 text-slate-400' : 'bg-slate-100 text-slate-650'
               }`}>Esgotados</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Expirados / Inativos</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>{kpiStats.expirados}</p>
            </div>
          </motion.div>

          {/* Media de Desconto */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-teal-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-teal-500/10 rounded-2xl flex items-center justify-center text-teal-400"><FiTrendingUp size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-700'
               }`}>Média</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Média das Ofertas (%)</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>{kpiStats.avgPct.toFixed(0)}% OFF</p>
            </div>
          </motion.div>

          {/* Lojas Participantes */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`${t.cardBg} rounded-[2rem] border ${t.border} p-8 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-all duration-300 relative overflow-hidden`}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
            <div className="flex justify-between items-start mb-6">
               <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400"><FiLayers size={22} /></div>
               <p className={`px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                 isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-700'
               }`}>Lojas</p>
            </div>
            <div>
               <p className={`text-[10px] font-bold ${t.textMuted} uppercase tracking-wider mb-1`}>Unidades Participantes</p>
               <p className={`text-3xl font-black tracking-tight ${t.text}`}>{kpiStats.uniqueStores}</p>
            </div>
          </motion.div>
        </div>

        {/* ─── FILTROS PILL-STYLE ─── */}
        <div className={`p-4 rounded-3xl border mb-8 flex flex-col md:flex-row items-center justify-between gap-4 ${t.surface} ${t.border}`}>
            
            {/* Store Filter */}
            <div className={`relative w-full md:w-80 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiHome className={`${t.textSecondary} shrink-0`} size={15} />
                <select 
                    id="select-franchise-cupons"
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-bold cursor-pointer appearance-none ${t.text}`}
                    value={filterEstab}
                    onChange={e => setFilterEstab(e.target.value)}
                >
                    <option value="todos" className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>Filtrar por todas as Franquias</option>
                    {estabList.map(e => (
                      <option key={e.id} value={e.id} className={isDark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}>
                        {e.nome}
                      </option>
                    ))}
                </select>
                <div className={`pointer-events-none absolute right-4 text-xs ${t.textSecondary}`}>▼</div>
            </div>

            {/* Search Input */}
            <div className={`relative w-full md:w-96 border rounded-2xl px-4 py-2.5 flex items-center shadow-sm ${t.inputBg} ${t.border}`}>
                <FiSearch className={`${t.textSecondary} shrink-0`} size={16} />
                <input 
                    id="input-cupons-search"
                    type="text" 
                    placeholder="Buscar por código de cupom..." 
                    className={`bg-transparent border-none outline-none text-xs ml-3 w-full font-semibold placeholder-gray-400 ${t.text}`}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {/* ─── LISTA DE CUPONS GRID (Voucher Style) ─── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} isDark={isDark} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {cuponsFiltrados.length > 0 ? (
              cuponsFiltrados.map((cupom, idx) => {
                const realNome = cupom.estabelecimentoNome || estabMap[cupom.estabelecimentoId] || 'Geral';
                const isAtivo = cupom.ativo !== false;
                
                return (
                  <motion.div 
                    key={cupom.id || idx} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className={`border p-6 rounded-[2rem] shadow-md transition-all duration-300 relative group flex flex-col justify-between h-68 overflow-hidden ${t.cardBg} ${t.border} ${t.surfaceHover}`}
                  >
                    {/* Linha pontilhada estilizada do voucher */}
                    <div className="absolute right-0 top-0 bottom-0 w-px border-r-2 border-dashed border-slate-700/35 pointer-events-none mr-24 hidden sm:block" />
                    
                    <div>
                      {/* Badge e Ícone */}
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-11 h-11 rounded-[1rem] border flex items-center justify-center ${t.inputBg} ${t.border} text-indigo-400`}>
                            <FiPercent size={18} />
                        </div>
                        
                        {isAtivo ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-[9px] font-extrabold border border-emerald-500/20 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> Ativo
                            </span>
                        ) : (
                            <span className="bg-slate-700/10 text-slate-400 px-3 py-1.5 rounded-full text-[9px] font-extrabold border border-slate-700/20 uppercase tracking-widest flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span> Inativo
                            </span>
                        )}
                      </div>

                      {/* Código do Cupom */}
                      <div className={`inline-block px-3 py-1 rounded-lg border-2 border-dashed font-mono font-black text-sm mb-3 tracking-wider ${
                        isAtivo 
                          ? (isDark ? 'border-indigo-500/40 bg-indigo-500/5 text-indigo-400' : 'border-indigo-300 bg-indigo-50 text-indigo-700') 
                          : (isDark ? 'border-slate-800 bg-slate-900/40 text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-400')
                      }`}>
                        {(cupom.codigo || cupom.id).toUpperCase()}
                      </div>

                      {/* Desconto */}
                      <h3 className={`text-2xl font-black tracking-tight mb-2 ${t.text}`}>
                        {getDescontoLabel(cupom)}
                      </h3>

                      {/* Detalhes de Regra (Validade e Mínimo) */}
                      <div className="space-y-1.5 mb-4 text-[11px] font-semibold">
                        <p className={`flex items-center gap-1.5 ${t.textSecondary}`}>
                          <FiCalendar size={12} className="shrink-0 text-slate-400" />
                          <span>Validade: {formatValidade(cupom.validadeFim)}</span>
                        </p>
                        {cupom.minimoPedido > 0 && (
                          <p className={`flex items-center gap-1.5 ${t.textSecondary}`}>
                            <FiTrendingUp size={12} className="shrink-0 text-slate-400" />
                            <span>Mínimo: R$ {fmt(cupom.minimoPedido)}</span>
                          </p>
                        )}
                        {cupom.usosMaximos > 0 && (
                          <p className={`flex items-center gap-1.5 ${t.textSecondary}`}>
                            <FiActivity size={12} className="shrink-0 text-slate-400" />
                            <span>Usos: {cupom.usosAtuais || 0} / {cupom.usosMaximos}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Unidade */}
                    <div className="pt-4 border-t border-slate-700/20">
                      <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider block mb-1">Unidade Vinculada</span>
                      <p className={`text-xs font-bold truncate flex items-center gap-1.5 ${t.textSecondary}`} title={realNome}>
                          <FiHome size={12} className="text-indigo-400" /> {realNome}
                      </p>
                    </div>

                  </motion.div>
                );
              })
            ) : (
               <div className={`col-span-full py-20 text-center rounded-[2rem] border shadow-sm ${t.surface} ${t.border}`}>
                 <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 ${t.inputBg}`}>
                    <FiLayers className={`text-xl ${t.textSecondary}`} />
                 </div>
                 <h3 className={`text-lg font-bold ${t.text}`}>Nenhuma Oferta Rastreada</h3>
                 <p className={`text-xs font-semibold ${t.textSecondary} mt-1`}>Nenhum cupom promocional coincide com os filtros aplicados.</p>
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
