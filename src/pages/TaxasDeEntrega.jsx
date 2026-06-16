import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { useTaxasDeEntregaData } from '../hooks/useTaxasDeEntregaData';

// Ícones para a interface
import { 
    IoAddCircleOutline, IoPencil, IoTrash, IoCloseCircleOutline,
    IoLocationOutline, IoCashOutline, IoListOutline, IoSaveOutline,
    IoStatsChart, IoSparkles, IoAlertCircle, IoSearch, IoClose,
    IoTrendingDownOutline, IoTrendingUpOutline
} from 'react-icons/io5';
import BackButton from '../components/BackButton';

// StatsCard Component matching the premium Light Theme Bento dashboard style
const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transform translate-x-12 -translate-y-10 group-hover:scale-150 transition-transform duration-700 bg-amber-200 opacity-40"></div>
        <div className="relative z-10">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
            <p className={`text-2xl font-black tracking-tight ${colorClass} drop-shadow-sm`}>{value}</p>
        </div>
        <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${bgClass}`}>
            <Icon className={`text-xl ${colorClass}`} />
        </div>
    </div>
);

// BairroCard Component representing a location fee
const BairroCard = ({ bairro, onEdit, onDelete, onEditPriceQuick }) => {
  return (
    <div className="group bg-white/80 rounded-[2.2rem] shadow-sm border border-slate-150/40 hover:shadow-xl hover:border-amber-200/80 transition-all duration-300 flex flex-col overflow-hidden relative">
      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-amber-955 transition-all duration-300 shadow-md shadow-amber-500/10 group-hover:scale-110">
                <IoLocationOutline className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-800 text-lg leading-tight truncate group-hover:text-amber-700 transition-colors" title={bairro.nomeBairro}>
                  {bairro.nomeBairro}
                </h3>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-1 block">Bairro Cadastrado</span>
              </div>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="space-y-3 mb-6 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 mt-2">
          <div className="flex items-center justify-between text-slate-655 text-sm">
            <div className="flex items-center font-semibold">
              <IoCashOutline className="mr-2 text-slate-450 text-lg" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Taxa de Entrega</span>
            </div>
            <span 
              onClick={() => onEditPriceQuick(bairro)}
              className="text-emerald-700 font-black text-sm cursor-pointer hover:text-emerald-800 transition-all duration-300 px-3 py-1.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 border border-emerald-100 shadow-sm flex items-center gap-1 active:scale-95 animate-pulse-subtle"
              title="Clique para editar rapidamente"
            >
              {bairro.valorTaxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              <span className="text-[9px] font-extrabold text-emerald-500 opacity-60">✏️</span>
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button 
            onClick={() => onEdit(bairro)}
            className="py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-955 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-400/20 border border-amber-400/30 flex items-center justify-center gap-1"
            title="Editar"
          >
            <IoPencil size={12} /> Editar
          </button>
          <button 
            onClick={() => onDelete(bairro.id, bairro.nomeBairro)}
            className="py-2.5 bg-white hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold transition-all border border-slate-200 hover:border-red-200 shadow-sm active:scale-95 flex items-center justify-center gap-1"
            title="Excluir"
          >
            <IoTrash size={12} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default function TaxasDeEntrega() {
    const { estabelecimentoIdPrincipal, currentUser, isAdmin, isMaster, loading: authLoading } = useAuth();
    const { setTitle, setSubtitle, setActions } = useHeader();
    const navigate = useNavigate();

    // Hook Pessoal
    const {
        bairros, nomeBairro, setNomeBairro, valorTaxa, setValorTaxa,
        editingId, loading, formLoading, accessGranted,
        promptConfig, setPromptConfig, handlePromptSubmit, closePrompt,
        estatisticas,
        handleSubmit, clearForm, handleEdit, handleDelete
    } = useTaxasDeEntregaData({ 
        currentUser, isAdmin, isMaster, 
        estabelecimentoId: estabelecimentoIdPrincipal, navigate 
    });

    // Custom deletion modal states
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [taxaToDelete, setTaxaToDelete] = useState(null);

    // Filter/Search states
    const [searchTerm, setSearchTerm] = useState('');

    // Filter neighborhoods by name
    const filteredBairros = React.useMemo(() => {
        return bairros.filter(b => 
            b.nomeBairro?.toLowerCase().includes(searchTerm.toLowerCase().trim())
        );
    }, [bairros, searchTerm]);

    // CONFIGURAÇÃO DO HEADER DINÂMICO
    useEffect(() => {
        setTitle('🛵 Taxas de Entrega');
        setSubtitle('Gerencie os valores de entrega por bairro');
        setActions(null);

        return () => {
            setTitle(null); setSubtitle(null); setActions(null);
        };
    }, [setTitle, setSubtitle, setActions, navigate]);

    // --- MANEJO DE DELEÇÃO EXCLUSIVA DE UI ---
    const handleExcluirClick = (id, nome) => {
        setTaxaToDelete({ id, nome });
        setDeleteConfirmOpen(true);
    };

    const confirmarExcluir = () => {
        if (!taxaToDelete) return;
        handleDelete(taxaToDelete.id, taxaToDelete.nome);
        setDeleteConfirmOpen(false);
        setTaxaToDelete(null);
    };

    // RENDERIZANDO AUTH LOADING & NEGATIONS
    if (authLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
                <div className="text-center relative z-10">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-bold">Verificando autenticação...</p>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
                <div className="text-center relative z-10 bg-white/70 border border-slate-150/40 rounded-[2.5rem] p-10 max-w-md shadow-xl backdrop-blur-md">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <IoCloseCircleOutline className="text-4xl text-red-650" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-3">Acesso Negado</h2>
                    <p className="text-slate-500 mb-8 font-medium">Faça login para acessar a área de gerenciamento.</p>
                    <Link to="/login-admin" className="inline-flex items-center space-x-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-955 font-bold py-3.5 px-8 rounded-2xl shadow-lg shadow-amber-500/25 hover:from-amber-500 hover:to-amber-600 transition-all active:scale-95">
                        <span>Fazer Login</span>
                    </Link>
                </div>
            </div>
        );
    }

    if (!accessGranted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
                <div className="text-center relative z-10 bg-white/70 border border-slate-150/40 rounded-[2.5rem] p-10 max-w-md shadow-xl backdrop-blur-md">
                    <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <IoCloseCircleOutline className="text-4xl text-yellow-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-3">Configuração Incompleta</h2>
                    <p className="text-slate-500 mb-6 font-medium leading-relaxed">
                        {!estabelecimentoIdPrincipal ? "Configure seu estabelecimento primeiro para acessar as taxas de entrega." : "Você não tem permissão para acessar esta página."}
                    </p>
                    <div className="flex w-full gap-3 justify-center mt-6">
                        <BackButton />
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
                <div className="text-center relative z-10">
                    <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-650 font-bold">Carregando taxas de entrega...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
            {/* ─── NEBULA GLOWS ─── */}
            <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
            <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-indigo-400/5 rounded-full blur-[130px] pointer-events-none"></div>

            <div className="max-w-7xl mx-auto relative z-10 space-y-6">
                <BackButton className="mb-6" />
                
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                            <IoCashOutline size={24} />
                        </div>
                        Taxas de Entrega
                    </h1>
                    <p className="text-slate-500 mt-2 ml-[60px] font-medium">Gerencie os valores de entrega cobrados por bairro.</p>
                </div>

                {/* Stats Bento Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    <StatsCard title="Total de Bairros" value={estatisticas.total} icon={IoLocationOutline} colorClass="text-amber-800" bgClass="bg-amber-50" />
                    <StatsCard title="Taxa Média" value={Number(estatisticas.valorMedio).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={IoStatsChart} colorClass="text-emerald-700" bgClass="bg-emerald-50" />
                    <StatsCard title="Taxa Mínima" value={Number(estatisticas.valorMinimo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={IoTrendingDownOutline} colorClass="text-blue-650" bgClass="bg-blue-50" />
                    <StatsCard title="Taxa Máxima" value={Number(estatisticas.valorMaximo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={IoTrendingUpOutline} colorClass="text-orange-600" bgClass="bg-orange-50" />
                </div>

                {/* Formulário (Bento Glassmorphic Card) */}
                <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm backdrop-blur-md p-6 sm:p-8 mb-10">
                    <div className="flex items-center space-x-4 mb-8">
                         <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                            {editingId ? <IoPencil size={20} /> : <IoAddCircleOutline size={20} />}
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">{editingId ? '✏️ Editar Taxa' : '➕ Adicionar Nova Taxa'}</h2>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">{editingId ? 'Atualize os dados da taxa de entrega' : 'Cadastre uma nova taxa para um bairro'}</p>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Nome do Bairro *</label>
                                <div className="relative">
                                    <IoLocationOutline className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg" />
                                    <input 
                                        type="text" 
                                        value={nomeBairro} 
                                        onChange={(e) => setNomeBairro(e.target.value)} 
                                        className="pl-12 w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 placeholder-slate-400 shadow-sm" 
                                        placeholder="Ex: Centro, Jardim das Flores..." 
                                        required 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Valor da Taxa (R$) *</label>
                                <div className="relative">
                                    <IoCashOutline className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 text-lg" />
                                    <input 
                                        type="text" 
                                        value={valorTaxa} 
                                        onChange={(e) => setValorTaxa(e.target.value.replace(/[^0-9,]/g, ''))} 
                                        className="pl-12 w-full p-4 bg-slate-50/50 hover:bg-[#f8fafc]/90 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-semibold text-slate-700 placeholder-slate-400 shadow-sm" 
                                        placeholder="Ex: 5,00" 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex w-full gap-4 pt-4">
                            <button 
                                type="submit" 
                                disabled={formLoading} 
                                className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-955 font-bold py-4 px-6 rounded-2xl flex items-center justify-center space-x-3 shadow-lg shadow-amber-500/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                            >
                                {formLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-amber-955 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <IoSaveOutline className="text-xl" />
                                        <span>{editingId ? 'Salvar Alterações' : 'Adicionar Taxa'}</span>
                                    </>
                                )}
                            </button>
                            {editingId && (
                                <button 
                                    type="button" 
                                    onClick={clearForm} 
                                    className="px-8 py-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center space-x-2 shadow-sm"
                                >
                                    <IoCloseCircleOutline className="text-lg" />
                                    <span>Cancelar</span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Cabeçalho da Lista e Busca */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-12 mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            <IoListOutline className="text-amber-500" />
                            Bairros e Taxas Cadastrados
                            <span className="text-sm font-extrabold bg-amber-100 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                                {bairros.length}
                            </span>
                        </h2>
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mt-1 flex items-center gap-1">
                            <IoSparkles className="text-amber-500" /> Clique na taxa verde para edição instantânea
                        </p>
                    </div>
                </div>

                {/* Barra de Busca */}
                <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-3 mb-8">
                    <div className="relative">
                        <IoSearch className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
                        <input 
                          type="text" 
                          placeholder="Buscar por bairro..." 
                          value={searchTerm} 
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full pl-14 pr-6 py-4 bg-[#f8fafc]/50 hover:bg-[#f8fafc]/90 border border-slate-150/40 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-3xl transition-all outline-none font-medium text-slate-700 placeholder-slate-400 shadow-sm" 
                        />
                    </div>
                </div>

                {/* Grid de Taxas */}
                <div className="min-h-[250px]">
                  {filteredBairros.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/70 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-slate-200/60 shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
                      <div className="relative z-10 flex flex-col items-center">
                          <div className="w-16 h-16 bg-amber-50 text-amber-300 rounded-full flex items-center justify-center mb-4 shadow-inner">
                              <IoLocationOutline className="text-3xl" />
                          </div>
                          <h3 className="text-xl font-black text-slate-700 mb-1">Nenhuma taxa encontrada</h3>
                          <p className="text-slate-400 font-semibold text-sm text-center max-w-sm">Tente ajustar sua busca ou cadastre uma nova taxa no formulário acima.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fadeIn">
                      {filteredBairros.map(bairro => (
                        <BairroCard 
                          key={bairro.id} 
                          bairro={bairro} 
                          onEdit={handleEdit}
                          onDelete={handleExcluirClick}
                          onEditPriceQuick={(b) => {
                              setPromptConfig({
                                  open: true, 
                                  type: 'EDIT_BAIRRO', 
                                  bairro: b,
                                  title: 'Alterar Taxa', 
                                  message: `Nova taxa para ${b.nomeBairro}:`,
                                  defaultValue: b.valorTaxa.toFixed(2).replace('.', ','), 
                                  placeholder: 'Ex: 5,50'
                              });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Ações em Lote */}
                {bairros.length > 0 && (
                    <div className="bg-white/70 border border-slate-150/40 rounded-[2.2rem] shadow-sm p-6 sm:p-8 mt-10">
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                                <IoSparkles size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800">⚡ Ações em Lote</h3>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">Altere várias taxas de uma só vez</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <button
                                onClick={() => setPromptConfig({ open: true, type: 'AUMENTAR_VALOR', title: 'Aumentar Taxas (Valor Certo)', message: 'Aumentar todas as taxas em quanto? (em Reais)', placeholder: 'Ex: 2,00' })}
                                className="group p-6 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-md relative overflow-hidden flex flex-col justify-between"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-emerald-100 opacity-30 group-hover:scale-150 transition-transform duration-500"></div>
                                <div className="relative z-10">
                                    <div className="font-black text-slate-800 text-lg mb-2 flex items-center gap-2">
                                        <span className="text-2xl">📈</span> Aumentar Todas (Fixo)
                                    </div>
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Adicionar valor fixo em R$ a todas as taxas</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setPromptConfig({ open: true, type: 'AUMENTAR_PERCENT', title: 'Aumentar Taxas (%)', message: 'Aumentar todas as taxas em qual percentual?', placeholder: 'Ex: 10 para 10%' })}
                                className="group p-6 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-md relative overflow-hidden flex flex-col justify-between"
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl bg-blue-100 opacity-30 group-hover:scale-150 transition-transform duration-500"></div>
                                <div className="relative z-10">
                                    <div className="font-black text-slate-800 text-lg mb-2 flex items-center gap-2">
                                        <span className="text-2xl">📊</span> Aumentar Percentual (%)
                                    </div>
                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Aumentar todas as taxas em uma porcentagem</div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom deletion dialog modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999999] px-4 animate-fadeIn" onClick={() => { setDeleteConfirmOpen(false); setTaxaToDelete(null); }}>
                    <div className="bg-white border border-slate-150/40 rounded-[2.2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <IoAlertCircle size={32} />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                                Excluir Taxa?
                            </h2>
                            <p className="text-sm text-slate-500 mb-8 px-4 leading-relaxed">
                                Tem certeza que deseja excluir a taxa para o bairro <strong>"{taxaToDelete?.nome}"</strong>? Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-4 w-full">
                                <button type="button" onClick={() => { setDeleteConfirmOpen(false); setTaxaToDelete(null); }} 
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full font-bold text-sm transition-all active:scale-95 shadow-sm">
                                    Cancelar
                                </button>
                                <button type="button" onClick={confirmarExcluir} 
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm shadow-lg shadow-red-600/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    Sim, Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Injetando Prompt Modal do Hook para ações em lote */}
            {promptConfig.open && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999999] px-4 animate-fadeIn" onClick={closePrompt}>
                    <div className="bg-white border border-slate-150/40 rounded-[2.2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center">
                            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
                                <IoSparkles size={24} />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2 text-center">
                                {promptConfig.title}
                            </h2>
                            <p className="text-sm text-slate-500 mb-6 text-center leading-relaxed">
                                {promptConfig.message}
                            </p>
                            <input 
                                type="text"
                                defaultValue={promptConfig.defaultValue}
                                placeholder={promptConfig.placeholder}
                                id="prompt-input-field"
                                className="w-full p-4 bg-slate-50/50 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-2xl transition-all outline-none font-bold text-slate-750 text-center mb-8 shadow-sm"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handlePromptSubmit(document.getElementById('prompt-input-field').value);
                                    }
                                }}
                            />
                            <div className="flex gap-4 w-full">
                                <button type="button" onClick={closePrompt} 
                                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-full font-bold text-sm transition-all active:scale-95 shadow-sm">
                                    Cancelar
                                </button>
                                <button type="button" onClick={() => handlePromptSubmit(document.getElementById('prompt-input-field').value)} 
                                    className="flex-1 py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-955 rounded-full font-bold text-sm shadow-lg shadow-amber-500/20 transition-all active:scale-95">
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }

                @keyframes pulse-subtle {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.03); }
                }
                .animate-pulse-subtle {
                    animation: pulse-subtle 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
}