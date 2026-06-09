// src/pages/admin/CartaoFidelidadeConfig.jsx — REDESENHADO COM VISUAL PREMIUM CLARO
import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../../components/BackButton';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { toast } from 'react-toastify';
import { 
  IoGiftOutline, IoCheckmarkCircle, IoAlertCircle, IoTrophyOutline, 
  IoStarOutline, IoStar, IoPeopleOutline, IoSearchOutline,
  IoRibbonOutline, IoTimeOutline, IoChevronDownOutline, IoChevronUpOutline,
  IoListOutline, IoSparkles
} from 'react-icons/io5';

// BentoStatsCard Component for loyalty stats summary
const BentoStatsCard = ({ title, value, sub, icon: Icon, colorClass, bgClass, borderLeftClass }) => (
    <div className={`group bg-white/70 border border-slate-200/40 border-l-4 ${borderLeftClass} rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden flex flex-col justify-between`}>
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-700 bg-amber-200 opacity-20"></div>
        <div className="flex justify-between items-start mb-2 relative z-10">
            <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">{value}</h3>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${bgClass}`}>
                <Icon className={`text-lg ${colorClass}`} />
            </div>
        </div>
        {sub && (
            <div className="mt-2 text-[10px] text-slate-400 font-extrabold uppercase tracking-wide relative z-10">
                {sub}
            </div>
        )}
    </div>
);

function CartaoFidelidadeConfig() {
  const { estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

  const [config, setConfig] = useState({
    ativo: false,
    metaCompras: 10,
    premio: '',
    descricaoExtra: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dashboard state
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [searchCliente, setSearchCliente] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos'); // todos, ativos, prontos, completaram
  const [showConfig, setShowConfig] = useState(true);
  const [showDashboard, setShowDashboard] = useState(true);

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
        const data = snap.data()?.cartelaFidelidade || {};
        setConfig({
          ativo: data.ativo || false,
          metaCompras: data.metaCompras || 10,
          premio: data.premio || '',
          descricaoExtra: data.descricaoExtra || ''
        });
      } catch (e) {
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [estabId]);

  // Carregar clientes com dados de fidelidade
  useEffect(() => {
    if (!estabId) return;
    const fetchClientes = async () => {
      setLoadingClientes(true);
      try {
        const snap = await getDocs(collection(db, 'estabelecimentos', estabId, 'clientes'));
        const clientesList = [];
        snap.forEach(docSnap => {
          const data = docSnap.data();
          clientesList.push({
            id: docSnap.id,
            nome: data.nome || data.name || '',
            telefone: data.telefone || data.phone || docSnap.id,
            email: data.email || '',
            carimbos: data.fidelidade?.carimbos || 0,
            premioDisponivel: data.fidelidade?.premioDisponivel || false,
            cartelasCompletadas: data.fidelidade?.cartelasCompletadas || 0,
            ultimoCarimbo: data.fidelidade?.ultimoCarimbo || null,
            totalPedidos: data.totalPedidos || data.pedidos || 0,
          });
        });
        setClientes(clientesList);
      } catch (e) {
        console.warn('[Fidelidade] Erro ao buscar clientes:', e);
      } finally {
        setLoadingClientes(false);
      }
    };
    fetchClientes();
  }, [estabId]);

  const handleSave = async () => {
    if (!config.premio.trim()) {
      toast.warning('Digite o prêmio que o cliente vai ganhar!');
      return;
    }
    if (config.metaCompras < 2 || config.metaCompras > 50) {
      toast.error('A meta deve ser entre 2 e 50 compras');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), { cartelaFidelidade: config });
      toast.success('✅ Cartão Fidelidade configurado com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar configuração');
    }
    setSaving(false);
  };

  // Métricas calculadas
  const stats = useMemo(() => {
    const comCarimbos = clientes.filter(c => c.carimbos > 0);
    const prontos = clientes.filter(c => c.premioDisponivel);
    const completaram = clientes.filter(c => c.cartelasCompletadas > 0);
    const totalCarimbos = clientes.reduce((sum, c) => sum + c.carimbos, 0);
    const totalCartelas = clientes.reduce((sum, c) => sum + c.cartelasCompletadas, 0);
    const mediaProgresso = comCarimbos.length > 0 
      ? Math.round((comCarimbos.reduce((s, c) => s + c.carimbos, 0) / comCarimbos.length / config.metaCompras) * 100) 
      : 0;

    return {
      totalClientes: clientes.length,
      comCarimbos: comCarimbos.length,
      prontos: prontos.length,
      completaram: completaram.length,
      totalCarimbos,
      totalCartelas,
      mediaProgresso,
    };
  }, [clientes, config.metaCompras]);

  // Filtro e busca
  const clientesFiltrados = useMemo(() => {
    let lista = clientes;

    if (filtroStatus === 'ativos') lista = lista.filter(c => c.carimbos > 0 && !c.premioDisponivel);
    else if (filtroStatus === 'prontos') lista = lista.filter(c => c.premioDisponivel);
    else if (filtroStatus === 'completaram') lista = lista.filter(c => c.cartelasCompletadas > 0);
    else if (filtroStatus === 'novos') lista = lista.filter(c => c.carimbos === 0);

    if (searchCliente.trim()) {
      const term = searchCliente.toLowerCase();
      lista = lista.filter(c => 
        (c.nome || '').toLowerCase().includes(term) || 
        (c.telefone || '').includes(term)
      );
    }

    return lista.sort((a, b) => {
      if (a.premioDisponivel && !b.premioDisponivel) return -1;
      if (!a.premioDisponivel && b.premioDisponivel) return 1;
      return b.carimbos - a.carimbos;
    });
  }, [clientes, filtroStatus, searchCliente]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="text-center relative z-10">
            <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 font-bold">Carregando cartão fidelidade...</p>
        </div>
    </div>
  );

  const previewCarimbos = Math.min(Math.floor(config.metaCompras * 0.7), config.metaCompras);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
      {/* ─── NEBULA GLOWS ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-pink-400/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[40%] right-[-5%] w-[450px] h-[450px] bg-amber-400/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10 space-y-6 animate-fadeIn">
        <BackButton to="/admin" className="mb-4" />

        {/* Header */}
        <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
                    <IoGiftOutline size={24} />
                </div>
                Cartão Fidelidade
            </h1>
            <p className="text-slate-500 mt-2 ml-[60px] font-medium">Cartela de carimbos digital — fidelize os seus clientes pela recorrência.</p>
        </div>

        {/* Status Alert */}
        <div className={`rounded-[2.2rem] p-6 mb-6 border transition-all duration-300 ${config.ativo ? 'bg-gradient-to-r from-pink-500/10 via-pink-50/40 to-white/70 border-pink-200/60 shadow-sm' : 'bg-slate-100/80 border-slate-200/60 shadow-sm'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {config.ativo ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center text-pink-500 shadow-sm shrink-0 border border-pink-200/50">
                    <IoCheckmarkCircle className="text-xl" />
                  </div>
                  <div>
                    <p className="font-black text-pink-700 text-sm">Cartão Fidelidade Ativo</p>
                    <p className="text-xs text-pink-600/80 font-semibold mt-0.5">Os clientes ganharão carimbos automaticamente a cada compra finalizada!</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0 border border-slate-200/50">
                    <IoAlertCircle className="text-xl" />
                  </div>
                  <div>
                    <p className="font-black text-slate-700 text-sm">Cartão Fidelidade Desativado</p>
                    <p className="text-xs text-slate-550/80 font-semibold mt-0.5">Configure as opções da cartela abaixo para começar a usar.</p>
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))}
              className={`w-14 h-7 rounded-full p-1 transition-all shrink-0 focus:outline-none ${config.ativo ? 'bg-pink-500' : 'bg-slate-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${config.ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
            </button>
          </div>
        </div>

        {/* Bento Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 animate-fadeIn">
          <BentoStatsCard title="Participantes" value={stats.comCarimbos} sub={`de ${stats.totalClientes} clientes`} icon={IoPeopleOutline} colorClass="text-blue-600" bgClass="bg-blue-50" borderLeftClass="border-l-blue-500" />
          <BentoStatsCard title="Carimbos Dados" value={stats.totalCarimbos} sub={`${stats.mediaProgresso}% progresso médio`} icon={IoStarOutline} colorClass="text-pink-600" bgClass="bg-pink-50" borderLeftClass="border-l-pink-500" />
          <BentoStatsCard title="Prêmios Prontos" value={stats.prontos} sub="Aguardando resgate" icon={IoGiftOutline} colorClass="text-orange-600" bgClass="bg-orange-50" borderLeftClass="border-l-orange-500" />
          <BentoStatsCard title="Cartelas Completas" value={stats.totalCartelas} sub={`${stats.completaram} cliente(s)`} icon={IoTrophyOutline} colorClass="text-emerald-700" bgClass="bg-emerald-50" borderLeftClass="border-l-emerald-500" />
        </div>

        {/* CONFIG (Bento Collapsible Card) */}
        <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] shadow-sm mb-6 overflow-hidden backdrop-blur-md">
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors focus:outline-none"
          >
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-50 text-pink-500 rounded-xl flex items-center justify-center shadow-inner">
                <IoGiftOutline size={20} />
              </div>
              Configuração da Cartela
            </h3>
            {showConfig ? <IoChevronUpOutline className="text-slate-400 text-lg" /> : <IoChevronDownOutline className="text-slate-400 text-lg" />}
          </button>
          
          <div className={`transition-all duration-300 overflow-hidden ${showConfig ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 pb-6 space-y-6 border-t border-slate-100 pt-6">

              {/* Como funciona (Alert) */}
              <div className="bg-gradient-to-br from-pink-500/5 via-pink-50/30 to-white/50 rounded-2xl p-5 border border-pink-200/40 shadow-inner">
                <h4 className="text-xs font-black text-pink-700 mb-2 flex items-center gap-1.5 uppercase tracking-wider">🎯 Como Funciona</h4>
                <div className="space-y-1.5 text-xs text-pink-600/85 font-semibold leading-relaxed">
                  <p>1. Pedido <strong>Finalizado</strong> no painel → adiciona 1 carimbo automático na cartela do cliente.</p>
                  <p>2. Ao completar {config.metaCompras} compras → o prêmio é desbloqueado e fica visível no painel!</p>
                  <p>3. Após o resgate do prêmio pelo garçom/caixa → inicia-se uma nova cartela do zero para o cliente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-2">Quantas compras para ganhar? *</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={config.metaCompras} 
                      onChange={e => setConfig(p => ({...p, metaCompras: Number(e.target.value)}))}
                      className="w-full p-4 pl-6 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 rounded-2xl text-sm outline-none font-bold text-slate-800 shadow-sm transition-all" 
                      min={2} max={50} 
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-extrabold text-xs uppercase tracking-wider">compras</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase mt-1.5 tracking-wider">Recomendado: entre 5 e 15 compras</p>
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-2">🎁 Qual é o prêmio? *</label>
                  <input 
                    type="text" 
                    value={config.premio} 
                    onChange={e => setConfig(p => ({...p, premio: e.target.value}))}
                    className="w-full p-4 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 rounded-2xl text-sm outline-none font-bold text-slate-800 placeholder-slate-400 shadow-sm transition-all" 
                    placeholder="Ex: 1 X-Burger Grátis, Sobremesa na Casa, 30% de desconto..."
                    maxLength={100}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-widest block mb-2">📝 Regras / Descrição Extra (opcional)</label>
                <textarea 
                  value={config.descricaoExtra} 
                  onChange={e => setConfig(p => ({...p, descricaoExtra: e.target.value}))}
                  className="w-full p-4 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 rounded-2xl text-sm outline-none font-semibold text-slate-800 placeholder-slate-400 shadow-sm h-24 resize-none transition-all" 
                  placeholder="Ex: Válido somente para pedidos acima de R$20. Não acumula com cupom."
                  maxLength={200}
                />
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-955 rounded-2xl font-bold text-sm transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 border border-amber-400/30">
                <IoGiftOutline size={18}/> {saving ? 'Salvando...' : 'Salvar Cartão Fidelidade'}
              </button>

              {/* Preview Visual */}
              <div className="mt-8 border-t border-slate-100 pt-6 animate-fadeIn">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4">👁️ Preview — Como o cliente vai ver</h4>
                <div className="bg-gradient-to-br from-pink-50/50 via-white to-amber-50/50 rounded-3xl border-2 border-dashed border-pink-200/60 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-pink-100 flex items-center justify-center shadow-sm">
                        <IoGiftOutline className="text-pink-500 text-lg" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 leading-tight">Cartão Fidelidade</p>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">{previewCarimbos} de {config.metaCompras} compras</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-pink-700 bg-pink-100 border border-pink-200/55 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                      Faltam {config.metaCompras - previewCarimbos}!
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2.5 justify-center mb-6">
                    {Array.from({ length: config.metaCompras }).map((_, i) => {
                      const isLast = i === config.metaCompras - 1;
                      const isFilled = i < previewCarimbos;
                      return (
                        <div key={i} className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border
                          ${isLast 
                            ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white shadow-lg shadow-orange-300/40 border-yellow-300 ring-2 ring-yellow-400' 
                            : isFilled 
                              ? 'bg-gradient-to-br from-pink-400 to-pink-500 text-white shadow-md shadow-pink-300/30 border-pink-300' 
                              : 'bg-slate-50 text-slate-300 border-dashed border-slate-200'}`}>
                          {isLast ? <IoTrophyOutline className="text-lg" /> : isFilled ? <IoStar className="text-sm animate-pulse-subtle" /> : <IoStarOutline className="text-sm" />}
                        </div>
                      );
                    })}
                  </div>
                  
                  {config.premio && (
                    <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-pink-100 shadow-sm">
                      <p className="text-[10px] text-pink-500 font-extrabold uppercase tracking-widest">Prêmio</p>
                      <p className="text-base font-black text-slate-800 mt-1">🎁 {config.premio}</p>
                      {config.descricaoExtra && <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5 tracking-wider">{config.descricaoExtra}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== DASHBOARD CLIENTES (Bento Collapsible Card) ==================== */}
        <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] shadow-sm overflow-hidden backdrop-blur-md">
          <button 
            onClick={() => setShowDashboard(!showDashboard)}
            className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors focus:outline-none"
          >
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shadow-inner">
                <IoPeopleOutline size={20} />
              </div>
              Clientes Participantes
              <span className="text-xs font-extrabold text-blue-800 bg-blue-100 border border-blue-200 px-3 py-0.5 rounded-full ml-1 shadow-sm">
                {stats.comCarimbos}
              </span>
            </h3>
            {showDashboard ? <IoChevronUpOutline className="text-slate-400 text-lg" /> : <IoChevronDownOutline className="text-slate-400 text-lg" />}
          </button>

          <div className={`transition-all duration-300 overflow-hidden ${showDashboard ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="px-6 pb-6 border-t border-slate-100">

              {/* Search + Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mt-6 mb-6">
                <div className="relative flex-1">
                  <IoSearchOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none" />
                  <input 
                    type="text"
                    value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                    placeholder="Buscar por nome ou telefone..."
                    className="w-full pl-12 pr-6 py-4 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-pink-500/10 focus:border-pink-500 rounded-2xl text-sm outline-none font-bold text-slate-800 placeholder-slate-400 shadow-sm transition-all"
                  />
                </div>
                <div className="relative min-w-[200px]">
                  <select 
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="w-full px-6 py-4 bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-pink-500/10 rounded-2xl text-sm font-extrabold text-slate-700 outline-none cursor-pointer transition-all shadow-sm appearance-none pr-10"
                  >
                    <option value="todos">Status: Todos</option>
                    <option value="ativos">🔥 Acumulando</option>
                    <option value="prontos">🎁 Prêmio Pronto</option>
                    <option value="completaram">🏆 Já Completaram</option>
                    <option value="novos">🆕 Sem Carimbos</option>
                  </select>
                  <IoChevronDownOutline className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
                </div>
              </div>

              {/* Lista de Clientes */}
              {loadingClientes ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-pink-500 border-t-transparent" />
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200/60 relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col items-center text-center p-6">
                    <IoPeopleOutline className="text-4xl text-slate-400 mb-3 animate-pulse-subtle" />
                    <h3 className="text-xl font-black text-slate-700 mb-1">Nenhum cliente encontrado</h3>
                    <p className="text-slate-400 font-semibold text-xs max-w-sm">
                      {searchCliente ? 'Tente ajustar sua busca por telefone ou nome.' : 'Os clientes aparecerão aqui conforme acumularem carimbos.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar animate-fadeIn pb-4">
                  {clientesFiltrados.map(cliente => (
                    <ClienteCard 
                      key={cliente.id} 
                      cliente={cliente} 
                      metaCompras={config.metaCompras} 
                    />
                  ))}
                </div>
              )}

              {/* Rodapé */}
              {clientesFiltrados.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                    Mostrando {clientesFiltrados.length} de {clientes.length} clientes
                  </p>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <IoSparkles className="text-amber-500" /> Atualizado em tempo real
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ==================== Componente: Cliente Card (Frosted Glass Card) ====================
function ClienteCard({ cliente, metaCompras }) {
  const progresso = Math.min((cliente.carimbos / metaCompras) * 100, 100);
  const faltam = Math.max(0, metaCompras - cliente.carimbos);

  const formatarData = (timestamp) => {
    if (!timestamp) return 'Nunca';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const agora = new Date();
      const diff = agora - date;
      const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (dias === 0) return 'Hoje';
      if (dias === 1) return 'Ontem';
      if (dias < 7) return `${dias} dias atrás`;
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch {
      return 'Nunca';
    }
  };

  return (
    <div className={`rounded-3xl border p-5 transition-all duration-300 hover:shadow-md flex flex-col justify-between gap-4 relative overflow-hidden ${
      cliente.premioDisponivel 
        ? 'bg-gradient-to-br from-amber-50/80 via-orange-50/45 to-white/90 border-amber-200/80 shadow-amber-200/10 hover:border-amber-400' 
        : 'bg-white/80 hover:bg-white border-slate-200/60 hover:border-amber-400/50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 shadow-sm border ${
            cliente.premioDisponivel 
              ? 'bg-gradient-to-br from-orange-400 to-yellow-400 text-white border-orange-300' 
              : cliente.carimbos > 0 
                ? 'bg-gradient-to-br from-pink-400 to-pink-500 text-white border-pink-300' 
                : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {cliente.nome ? cliente.nome.charAt(0).toUpperCase() : '#'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
              {cliente.nome || 'Sem nome'}
              {cliente.premioDisponivel && (
                <span className="text-[9px] font-black text-orange-700 bg-orange-100 border border-orange-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center shadow-sm">
                  🎁 PRÊMIO!
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide mt-0.5">{cliente.telefone}</p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-black text-slate-800">{cliente.carimbos}<span className="text-xs text-slate-400 font-bold">/{metaCompras}</span></p>
          {cliente.cartelasCompletadas > 0 && (
            <p className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center justify-center gap-0.5 shadow-sm mt-1">
              <IoTrophyOutline size={10} /> {cliente.cartelasCompletadas}x completas
            </p>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="flex items-center gap-3 bg-slate-50/40 p-2.5 rounded-2xl border border-slate-100/40">
        <div className="flex-1 h-2.5 bg-slate-200/60 rounded-full overflow-hidden shadow-inner border border-slate-200/20">
          <div 
            className={`h-full rounded-full transition-all duration-500 shadow-sm ${
              cliente.premioDisponivel 
                ? 'bg-gradient-to-r from-orange-400 to-yellow-400' 
                : 'bg-gradient-to-r from-pink-400 to-pink-500'
            }`}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <span className="text-[10px] font-extrabold text-slate-500 shrink-0 w-10 text-right">
          {cliente.premioDisponivel ? '✅' : `${Math.round(progresso)}%`}
        </span>
      </div>

      {/* Stamps mini grid */}
      <div className="flex flex-wrap gap-1.5 justify-start pl-1">
        {Array.from({ length: metaCompras }).map((_, i) => {
          const isLast = i === metaCompras - 1;
          const isFilled = i < cliente.carimbos;
          return (
            <div 
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm border transition-all ${
                isLast 
                  ? cliente.premioDisponivel
                    ? 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white ring-2 ring-yellow-300 border-yellow-300'
                    : 'bg-gradient-to-br from-yellow-400 to-orange-400 text-white opacity-40 border-yellow-200/30'
                  : isFilled 
                    ? 'bg-gradient-to-br from-pink-400 to-pink-500 text-white border-pink-300 shadow-sm' 
                    : 'bg-slate-50 text-slate-300 border-dashed border-slate-200'
              }`}
            >
              {isLast ? '🏆' : isFilled ? '★' : '·'}
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2 border-t border-slate-100/50">
        <span className="flex items-center gap-1.5">
          <IoTimeOutline size={12} className="text-slate-400" />
          Carimbado: {formatarData(cliente.ultimoCarimbo)}
        </span>
        <span>
          {faltam > 0 ? `Faltam ${faltam} compras` : 'Prêmio disponível!'}
        </span>
      </div>
    </div>
  );
}

export default withEstablishmentAuth(CartaoFidelidadeConfig);
