import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEntradaEstoqueXMLData } from '../../hooks/useEntradaEstoqueXMLData';
import {
    IoCloudUploadOutline, IoDocumentTextOutline, IoBusinessOutline,
    IoCartOutline, IoCheckmarkCircleOutline, IoAlertCircleOutline,
    IoTrashOutline, IoSaveOutline, IoCloseOutline, IoSearchOutline,
    IoAddCircleOutline, IoPricetagOutline, IoCubeOutline,
    IoWalletOutline, IoCalendarOutline, IoReceiptOutline, IoRefreshOutline
} from 'react-icons/io5';
import { FiSun, FiMoon } from 'react-icons/fi';
import ModalVinculo from '../../components/estoque/ModalVinculo';
import ModalNovoProduto from '../../components/estoque/ModalNovoProduto';
import BackButton from '../../components/BackButton';

const EntradaEstoqueXML = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const xmlData = useEntradaEstoqueXMLData(estabelecimentoIdPrincipal);

    // Sync theme with localStorage
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('dashboard_theme');
        return saved || 'light';
    });

    useEffect(() => {
        const checkTheme = () => {
            const saved = localStorage.getItem('dashboard_theme');
            if (saved && saved !== theme) {
                setTheme(saved);
            }
        };
        const interval = setInterval(checkTheme, 1000);
        return () => clearInterval(interval);
    }, [theme]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('dashboard_theme', newTheme);
    };

    const themeClasses = {
        dark: {
            bg: 'bg-gradient-to-br from-slate-950 via-[#0d1220] to-slate-950 text-slate-100',
            surface: 'bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 shadow-slate-950/50',
            cardBg: 'bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 shadow-md',
            border: 'border-slate-800/80',
            text: 'text-slate-100',
            textSecondary: 'text-slate-400',
            textMuted: 'text-slate-500',
            inputBg: 'bg-slate-950/60 text-slate-100 border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20',
            accent: 'bg-blue-600',
            tabActive: 'bg-blue-600 text-white shadow shadow-blue-500/25',
            tabInactive: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
            listHover: 'hover:bg-slate-850/40',
            thBg: 'bg-slate-950/40 text-slate-400 border-slate-800/80',
            tableHover: 'hover:bg-blue-900/10',
            textBlack: 'text-white',
            badgeSuccess: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30',
            badgePending: 'bg-amber-950/40 text-amber-400 border border-amber-900/30',
            btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
        },
        light: {
            bg: 'bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#f8fafc] text-slate-850',
            surface: 'bg-white/80 backdrop-blur-md border border-slate-200/60 shadow-sm shadow-slate-100/50',
            cardBg: 'bg-white border border-gray-100 shadow-sm',
            border: 'border-slate-200/60',
            text: 'text-slate-800',
            textSecondary: 'text-slate-500',
            textMuted: 'text-gray-400',
            inputBg: 'bg-gray-50 text-slate-800 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white',
            accent: 'bg-blue-600',
            tabActive: 'bg-blue-600 text-white shadow shadow-blue-500/20',
            tabInactive: 'text-gray-500 hover:bg-gray-55 hover:text-gray-700',
            listHover: 'hover:bg-gray-55/50',
            thBg: 'bg-gray-50 text-gray-500 border-slate-200/60',
            tableHover: 'hover:bg-blue-50/30',
            textBlack: 'text-gray-900',
            badgeSuccess: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
            badgePending: 'bg-blue-50 text-blue-600 border border-blue-100',
            btnSecondary: 'bg-white hover:bg-gray-55 text-gray-600 border-gray-200',
        }
    };

    const t = themeClasses[theme];
    const isDark = theme === 'dark';

    // Drag and drop states and handlers
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const mockEvent = {
                target: {
                    files: [file]
                }
            };
            xmlData.handleFileUpload(mockEvent);
        }
    };

    return (
        <div className={`min-h-screen ${t.bg} transition-colors duration-555 duration-500 relative overflow-hidden p-4 sm:p-8`}>
            {/* Glow effects in dark mode */}
            {isDark && (
                <>
                    <div className="absolute top-[-10%] left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#3b82f6]/10 to-transparent blur-[140px] pointer-events-none" />
                    <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-[#6366f1]/8 to-transparent blur-[120px] pointer-events-none" />
                </>
            )}

            <div className="max-w-6xl mx-auto space-y-6 relative z-10">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <BackButton className="mb-6" />
                        <h1 className={`text-3xl font-black ${t.textBlack} flex items-center gap-3`}>
                            <IoCloudUploadOutline className="text-blue-600 animate-pulse" /> Entrada de Estoque via XML
                        </h1>
                        <p className={`${t.textSecondary} text-sm mt-1`}>Importe notas — atualiza estoque, custo, NCM, preço e gera contas a pagar.</p>
                    </div>
                    <button onClick={toggleTheme}
                        className={`p-3 rounded-2xl ${t.surface} border ${t.border} ${t.textSecondary} hover:${t.text} transition-all shadow-md active:scale-95`}
                        title={theme === 'dark' ? "Modo Claro" : "Modo Escuro"}>
                        {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
                    </button>
                </header>

                {/* ── TELA DE UPLOAD / HISTÓRICO ── */}
                {!xmlData.notaLida && (
                    <>
                        <div className={`${t.surface} p-1 rounded-2xl border ${t.border} shadow-sm w-fit flex gap-1`}>
                            <button onClick={() => xmlData.setAbaAtiva('importar')}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${xmlData.abaAtiva === 'importar' ? t.tabActive : t.tabInactive}`}>
                                📥 Importar Nota
                            </button>
                            <button onClick={() => { xmlData.setAbaAtiva('historico'); xmlData.buscarHistorico(); }}
                                className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${xmlData.abaAtiva === 'historico' ? t.tabActive : t.tabInactive}`}>
                                📋 Histórico ({xmlData.historico.length})
                            </button>
                        </div>

                        {xmlData.abaAtiva === 'importar' && (
                            <div 
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                className={`border-4 border-dashed rounded-[2.5rem] p-12 text-center transition-all group relative ${
                                    dragActive 
                                        ? 'border-blue-500 bg-blue-500/10 scale-[1.01] shadow-lg shadow-blue-500/10' 
                                        : `${isDark ? 'border-slate-800 bg-slate-900/40 hover:border-blue-500/50' : 'border-gray-200 bg-white hover:border-blue-400'}`
                                }`}
                            >
                                <input type="file" id="fileInput" accept=".xml" onChange={xmlData.handleFileUpload} className="hidden" />
                                <label htmlFor="fileInput" className="cursor-pointer flex flex-col items-center">
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${
                                        isDark ? 'bg-blue-950/60 text-blue-400 border border-blue-900/30' : 'bg-blue-50 text-blue-500'
                                    }`}>
                                        <IoDocumentTextOutline size={48} />
                                    </div>
                                    <h2 className={`text-2xl font-bold mb-2 ${t.textBlack}`}>Arraste seu arquivo XML aqui</h2>
                                    <p className={`${t.textMuted} mb-8`}>Ou clique para buscar no seu computador</p>
                                    <span className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all">
                                        Selecionar Arquivo
                                    </span>
                                </label>
                            </div>
                        )}

                        {xmlData.abaAtiva === 'historico' && (
                            <div className={`${t.surface} rounded-[2rem] border ${t.border} shadow-lg overflow-hidden`}>
                                <div className={`p-6 border-b ${t.border} ${isDark ? 'bg-slate-900/40' : 'bg-gray-50/50'} flex justify-between items-center`}>
                                    <h3 className={`font-bold ${t.textBlack} flex items-center gap-2`}>
                                        <IoReceiptOutline className="text-blue-600" /> Notas Importadas
                                    </h3>
                                    <button onClick={xmlData.buscarHistorico}
                                        className="text-blue-500 text-sm font-bold hover:underline flex items-center gap-1">
                                        <IoRefreshOutline /> Atualizar
                                    </button>
                                </div>

                                {xmlData.loadingHistorico ? (
                                    <div className={`p-12 text-center ${t.textMuted}`}>Carregando...</div>
                                ) : xmlData.historico.length === 0 ? (
                                    <div className={`p-12 text-center ${t.textMuted}`}>
                                        <IoReceiptOutline size={48} className="mx-auto mb-3 opacity-30" />
                                        <p>Nenhuma nota importada ainda.</p>
                                    </div>
                                ) : (
                                    <div className={`divide-y ${t.border}`}>
                                        {xmlData.historico.map(nota => (
                                            <div key={nota.id} className={`transition-colors duration-150 ${t.listHover}`}>
                                                <div className="p-5 cursor-pointer" onClick={() => xmlData.buscarParcelasNota(nota.numeroNota)} >
                                                    <div className="flex flex-wrap justify-between items-start gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className={`text-xs ${isDark ? 'bg-blue-950 text-blue-400 border border-blue-900/30' : 'bg-blue-50 text-blue-700'} px-2.5 py-0.5 rounded-full font-bold font-mono`}>
                                                                    NF {nota.numeroNota}
                                                                </span>
                                                                <span className={`text-xs ${t.textMuted}`}>
                                                                    {nota.dataEntrada?.toDate ? nota.dataEntrada.toDate().toLocaleDateString('pt-BR') : '—'}
                                                                </span>
                                                                {nota.pagamento?.parcelas > 1 && (
                                                                    <span className={`text-xs ${isDark ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/30' : 'bg-indigo-50 text-indigo-600'} px-2 py-0.5 rounded-full font-bold`}>
                                                                        {nota.pagamento.parcelas}x {nota.pagamento.metodo}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className={`font-bold ${t.textBlack}`}>{nota.fornecedorNome}</p>
                                                            <p className={`text-xs ${t.textMuted} font-mono`}>CNPJ: {nota.fornecedorCnpj}</p>
                                                        </div>
                                                        <div className="text-right flex items-start gap-3">
                                                            <div>
                                                                <p className={`text-lg font-black ${t.textBlack}`}>
                                                                    {Number(nota.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                </p>
                                                                <p className={`text-xs ${t.textMuted}`}>{nota.itens?.length || 0} itens</p>
                                                            </div>
                                                            <div className={`p-2 rounded-xl transition-transform duration-300 ${xmlData.notaExpandida === nota.numeroNota ? 'rotate-180 bg-blue-500/10 text-blue-500' : `${isDark ? 'bg-slate-800 text-slate-500' : 'bg-gray-100 text-gray-400'}`}`}>
                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                    <path d="M6 9l6 6 6-6" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap gap-1">
                                                        {nota.itens?.slice(0, 5).map((item, i) => (
                                                            <span key={i} className={`text-[10px] ${isDark ? 'bg-slate-800/80 text-slate-350 border border-slate-700/30' : 'bg-gray-100 text-gray-600'} px-2 py-0.5 rounded-full`}>
                                                                {item.vinculoNome || item.nomeXML}
                                                            </span>
                                                        ))}
                                                        {(nota.itens?.length || 0) > 5 && (
                                                            <span className={`text-[10px] ${isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-gray-100 text-gray-500'} px-2 py-0.5 rounded-full`}>
                                                                +{nota.itens.length - 5} mais
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* PARCELAS EXPANDIDAS */}
                                                {xmlData.notaExpandida === nota.numeroNota && (
                                                    <div className={`${isDark ? 'bg-slate-900/40 border-t border-slate-800' : 'bg-indigo-50/50 border-t border-indigo-100'} px-5 pb-5 pt-4`}>
                                                        <p className={`text-xs font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase mb-3 flex items-center gap-2`}>
                                                            <IoWalletOutline /> Parcelas / Contas a Pagar
                                                        </p>

                                                        {xmlData.loadingParcelas ? (
                                                            <div className={`text-center py-4 ${t.textMuted} text-sm`}>Carregando parcelas...</div>
                                                        ) : xmlData.parcelasNota.length === 0 ? (
                                                            <div className={`text-center py-4 ${t.textMuted} text-sm`}>
                                                                Nenhuma parcela encontrada para esta nota.
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {xmlData.parcelasNota.map(parcela => {
                                                                    const venc = new Date(parcela.vencimento + 'T12:00:00');
                                                                    const hoje = new Date();
                                                                    const vencida = parcela.status === 'pendente' && venc < hoje;

                                                                    return (
                                                                        <div key={parcela.id} className={`flex items-center justify-between rounded-2xl px-4 py-3 border shadow-sm transition-all ${
                                                                            parcela.status === 'pago' 
                                                                                ? (isDark ? 'bg-emerald-950/20 border-emerald-900/50' : 'border-emerald-100 bg-white') 
                                                                                : vencida 
                                                                                    ? (isDark ? 'bg-red-950/20 border-red-900/50' : 'border-red-200 bg-white') 
                                                                                    : (isDark ? 'bg-slate-950/60 border-slate-800' : 'border-indigo-100 bg-white')
                                                                        }`}>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className={`text-xs font-black ${isDark ? 'text-indigo-400 bg-indigo-950/60 border border-indigo-900/30' : 'text-indigo-600 bg-indigo-50'} px-2 py-1 rounded-lg min-w-[40px] text-center`}>
                                                                                    {parcela.parcela}/{parcela.totalParcelas}
                                                                                </span>
                                                                                <div>
                                                                                    <p className={`text-sm font-bold ${t.textBlack}`}>
                                                                                        {parcela.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                                    </p>
                                                                                    <p className={`text-xs ${t.textSecondary} flex items-center gap-1`}>
                                                                                        <IoCalendarOutline size={11} />
                                                                                        Vence: {venc.toLocaleDateString('pt-BR')}
                                                                                        {vencida && <span className="text-red-500 font-bold ml-1">⚠️ Vencida</span>}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-3">
                                                                                <span className={`text-xs font-bold capitalize ${t.textSecondary}`}>
                                                                                    {parcela.metodo}
                                                                                </span>
                                                                                <button onClick={(e) => xmlData.alternarStatusParcela(e, parcela)}
                                                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                                                                        parcela.status === 'pago' 
                                                                                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                                                                                            : vencida 
                                                                                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                                                                                : `${isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`
                                                                                    }`}>
                                                                                    {parcela.status === 'pago' ? '✅ Pago' : vencida ? '🔴 Vencida' : '⏳ Pendente'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div className="flex justify-between items-center pt-2 px-1">
                                                                    <span className={`text-xs ${t.textMuted}`}>
                                                                        {xmlData.parcelasNota.filter(p => p.status === 'pago').length} de {xmlData.parcelasNota.length} pagas
                                                                    </span>
                                                                    <span className={`text-xs font-bold ${t.textSecondary}`}>
                                                                        Restante: {xmlData.parcelasNota.filter(p => p.status !== 'pago').reduce((acc, p) => acc + (p.valor || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── TELA DE PROCESSAMENTO DA NOTA ── */}
                {xmlData.notaLida && (
                    <>
                        <div className={`${t.surface} rounded-2xl border ${t.border} shadow-lg p-5 flex flex-wrap items-center gap-4`}>
                            <div className="flex items-center gap-3">
                                <IoPricetagOutline className="text-blue-600 text-xl" />
                                <span className={`font-bold ${t.textSecondary}`}>Margem de lucro padrão:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="number" min="0" max="1000" value={xmlData.margemPadrao} onChange={e => xmlData.setMargemPadrao(Number(e.target.value))}
                                    className={`w-24 p-2 border ${isDark ? 'border-blue-900 bg-blue-950/60 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-700'} rounded-xl text-center font-bold outline-none`} />
                                <span className={`font-bold ${t.textMuted}`}>%</span>
                            </div>
                            <p className={`text-xs ${t.textMuted}`}>Recalcula o preço de venda sugerido de todos os produtos.</p>
                        </div>

                        {/* BENTO STYLE STAT CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className={`${t.surface} p-6 rounded-3xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none" />
                                <div className="flex items-center gap-3 text-blue-600 mb-2">
                                    <IoDocumentTextOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Dados da Nota</span>
                                </div>
                                <p className={`text-xl font-bold ${t.textBlack}`}>Nº {xmlData.notaLida.numero}</p>
                                <p className={`text-sm ${t.textSecondary}`}>Série: {xmlData.notaLida.serie} • Emissão: {new Date(xmlData.notaLida.dataEmissao).toLocaleDateString()}</p>
                            </div>
                            
                            <div className={`${t.surface} p-6 rounded-3xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 text-emerald-600">
                                        <IoBusinessOutline size={20} />
                                        <span className="text-xs font-black uppercase tracking-widest">Fornecedor</span>
                                    </div>
                                    {xmlData.fornecedorSalvo ? (
                                        <span className={`text-xs ${t.badgeSuccess} px-2.5 py-0.5 rounded-full font-bold`}>✅ Cadastrado</span>
                                    ) : (
                                        <button onClick={() => xmlData.setMostrarFormFornecedor(true)}
                                            className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full font-bold hover:bg-blue-500/20 border border-blue-900/30 transition-all">
                                            + Salvar
                                        </button>
                                    )}
                                </div>
                                <p className={`text-lg font-bold ${t.textBlack} truncate`}>{xmlData.notaLida.fornecedor.nome}</p>
                                <p className={`text-sm ${t.textSecondary}`}>CNPJ: {xmlData.notaLida.fornecedor.cnpj}</p>
                                {xmlData.fornecedorSalvo && (
                                    <p className={`text-xs ${t.textMuted} mt-1`}>
                                        {xmlData.fornecedorSalvo.prazo}d • {xmlData.fornecedorSalvo.condicao} • {xmlData.fornecedorSalvo.telefone}
                                    </p>
                                )}
                            </div>

                            <div className={`${t.surface} p-6 rounded-3xl border ${t.border} shadow-lg relative overflow-hidden group`}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />
                                <div className="flex items-center gap-3 text-purple-600 mb-2">
                                    <IoCartOutline size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest">Valor Total</span>
                                </div>
                                <p className={`text-2xl font-black ${t.textBlack}`}>
                                    {xmlData.notaLida.totalNota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                                <p className={`text-sm ${t.textSecondary}`}>{xmlData.notaLida.produtos.length} itens</p>
                            </div>
                        </div>

                        {xmlData.mostrarFormFornecedor && (
                            <div className={`${t.surface} rounded-2xl border border-blue-500/20 shadow-lg p-6 space-y-4`}>
                                <h3 className={`font-bold ${t.textBlack} mb-4 flex items-center gap-2`}>
                                    <IoBusinessOutline className="text-blue-500" /> Cadastrar Fornecedor
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Nome *', key: 'nome', placeholder: 'Razão social' },
                                        { label: 'CNPJ', key: 'cnpj', placeholder: '00.000.000/0000-00' },
                                        { label: 'Telefone', key: 'telefone', placeholder: '(11) 99999-9999' },
                                        { label: 'E-mail', key: 'email', placeholder: 'contato@fornecedor.com' },
                                        { label: 'Contato (nome)', key: 'contato', placeholder: 'Nome do vendedor' },
                                    ].map(f => (
                                        <div key={f.key}>
                                            <label className={`text-xs font-bold ${t.textSecondary} uppercase mb-1 block`}>{f.label}</label>
                                            <input value={xmlData.formFornecedor[f.key]} onChange={e => xmlData.setFormFornecedor(prev => ({ ...prev, [f.key]: e.target.value }))}
                                                placeholder={f.placeholder} className={`w-full p-3 rounded-xl outline-none text-sm border ${t.inputBg}`} />
                                        </div>
                                    ))}
                                    <div>
                                        <label className={`text-xs font-bold ${t.textSecondary} uppercase mb-1 block`}>Prazo (dias)</label>
                                        <input type="number" value={xmlData.formFornecedor.prazo} onChange={e => xmlData.setFormFornecedor(prev => ({ ...prev, prazo: e.target.value }))}
                                            className={`w-full p-3 rounded-xl outline-none text-sm border ${t.inputBg}`} />
                                    </div>
                                    <div>
                                        <label className={`text-xs font-bold ${t.textSecondary} uppercase mb-1 block`}>Condição</label>
                                        <select value={xmlData.formFornecedor.condicao} onChange={e => xmlData.setFormFornecedor(prev => ({ ...prev, condicao: e.target.value }))}
                                            className={`w-full p-3 rounded-xl outline-none text-sm border ${t.inputBg}`}>
                                            {['boleto', 'pix', 'cartao', 'cheque', 'dinheiro'].map(c => ( <option key={c} value={c} className={isDark ? 'bg-slate-950' : ''}>{c.charAt(0).toUpperCase() + c.slice(1)}</option> ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                    <button onClick={() => xmlData.setMostrarFormFornecedor(false)} className={`px-5 py-2.5 rounded-xl border font-bold text-sm transition-all ${t.btnSecondary}`}>Cancelar</button>
                                    <button onClick={xmlData.salvarFornecedor} disabled={xmlData.salvandoFornecedor}
                                        className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50">
                                        {xmlData.salvandoFornecedor ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IoSaveOutline size={16} />}
                                        Salvar Fornecedor
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`${t.surface} rounded-2xl border ${t.border} shadow-lg p-4`}>
                            <div className="flex justify-between items-center mb-2">
                                <span className={`text-sm font-bold ${t.textSecondary}`}>Progresso dos vínculos</span>
                                <span className={`text-sm font-black ${t.textBlack}`}>{xmlData.totalVinculados}/{xmlData.totalItens}</span>
                            </div>
                            <div className={`w-full ${isDark ? 'bg-slate-950/60' : 'bg-gray-100'} rounded-full h-3`}>
                                <div className="bg-green-500 h-3 rounded-full transition-all duration-500 shadow-sm shadow-green-500/20" style={{ width: `${xmlData.totalItens > 0 ? (xmlData.totalVinculados / xmlData.totalItens) * 100 : 0}%` }} />
                            </div>
                            {!xmlData.todosVinculados && <p className="text-xs text-amber-500 font-semibold mt-2 flex items-center gap-1">⚠️ Vincule todos os produtos para liberar a confirmação</p>}
                        </div>

                        <div className={`${t.surface} rounded-[2rem] border ${t.border} shadow-lg overflow-hidden`}>
                            <div className={`p-6 border-b ${t.border} flex justify-between items-center ${isDark ? 'bg-slate-900/40' : 'bg-gray-50/50'}`}>
                                <h3 className={`font-bold ${t.textBlack} flex items-center gap-2`}>
                                    <IoCubeOutline className="text-blue-600" /> Itens da Nota
                                </h3>
                                <button onClick={xmlData.limparNota} className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center gap-1">
                                    <IoTrashOutline /> Limpar
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className={`border-b ${t.border} ${isDark ? 'bg-slate-950/40' : 'bg-gray-50'} text-[10px] uppercase tracking-widest ${t.textMuted} font-black`}>
                                            <th className="px-4 py-4">Produto na Nota</th>
                                            <th className="px-4 py-4">NCM</th>
                                            <th className="px-4 py-4">Qtd</th>
                                            <th className="px-4 py-4">Custo Unit.</th>
                                            <th className="px-4 py-4">Preço Venda</th>
                                            <th className="px-4 py-4">Total</th>
                                            <th className="px-4 py-4">Vínculo</th>
                                        </tr>
                                    </thead>
                                    <tbody className={`divide-y ${t.border}`}>
                                        {xmlData.notaLida.produtos.map((p, idx) => (
                                            <tr key={idx} className={`${t.tableHover} transition-colors`}>
                                                <td className="px-4 py-4">
                                                    <p className={`text-sm font-bold ${t.textBlack}`}>{p.nome}</p>
                                                    <p className={`text-[10px] ${t.textMuted} font-mono`}>EAN: {p.ean || 'SEM EAN'} | COD: {p.codigo}</p>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`text-xs font-mono px-2 py-1 rounded-lg border ${
                                                        isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                    }`}>{p.ncm || '—'}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                                                        isDark ? 'bg-slate-800 text-slate-350' : 'bg-gray-100 text-gray-650'
                                                    }`}>{p.qtd} {p.unidade}</span>
                                                </td>
                                                <td className={`px-4 py-4 text-sm font-mono ${t.textSecondary}`}>
                                                    {p.valorUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-xs ${t.textMuted}`}>R$</span>
                                                        <input type="number" step="0.01" min="0" value={p.precoVendaSugerido} onChange={e => xmlData.atualizarPrecoVenda(idx, e.target.value)}
                                                            className={`w-24 p-2 rounded-xl text-sm font-bold outline-none text-center border ${
                                                                isDark ? 'border-emerald-900 bg-emerald-950/40 text-emerald-400 focus:border-emerald-500' : 'border-emerald-200 bg-emerald-50 text-emerald-800 focus:border-emerald-500 focus:bg-white'
                                                            }`} />
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-4 text-sm font-black ${t.textBlack}`}>
                                                    {p.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-4">
                                                    {p.vinculoId ? (
                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border ${
                                                            isDark ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        }`}>
                                                            <IoCheckmarkCircleOutline size={18} className="shrink-0 text-emerald-500" />
                                                            <span className="truncate max-w-[100px]">{p.vinculoNome}</span>
                                                            <button onClick={() => xmlData.setModalVinculo({ isOpen: true, itemIndex: idx })} className="ml-auto text-xs underline shrink-0 hover:text-emerald-300">Trocar</button>
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => xmlData.setModalVinculo({ isOpen: true, itemIndex: idx })}
                                                            className={`flex items-center gap-2 text-[11px] font-black uppercase px-3 py-2 rounded-xl transition-all border ${
                                                                isDark ? 'bg-blue-950/60 text-blue-400 border-blue-900/40 hover:bg-blue-900/50' : 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100'
                                                            }`}>
                                                            <IoAlertCircleOutline size={16} /> Vincular
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className={`${t.surface} rounded-2xl border ${t.border} shadow-lg p-6 space-y-5`}>
                            <h3 className={`font-bold ${t.textBlack} flex items-center gap-2`}>
                                <IoWalletOutline className="text-indigo-500" /> Condição de Pagamento
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className={`text-xs font-bold ${t.textSecondary} uppercase mb-1 block`}>Método</label>
                                    <select value={xmlData.pagamento.metodo} onChange={e => xmlData.setPagamento(prev => ({ ...prev, metodo: e.target.value }))}
                                        className={`w-full p-3 rounded-xl outline-none text-sm border ${t.inputBg}`}>
                                        {['boleto', 'pix', 'cartao', 'cheque', 'dinheiro', 'transferencia'].map(m => ( <option key={m} value={m} className={isDark ? 'bg-slate-950' : ''}>{c => c.charAt(0).toUpperCase() + c.slice(1)}</option> ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={`text-xs font-bold ${t.textSecondary} uppercase mb-1 block`}>Nº de Parcelas</label>
                                    <input type="number" min="1" max="24" value={xmlData.pagamento.parcelas} onChange={e => xmlData.setPagamento(prev => ({ ...prev, parcelas: Math.max(1, parseInt(e.target.value) || 1) }))}
                                        className={`w-full p-3 rounded-xl outline-none text-sm font-bold border ${t.inputBg}`} />
                                </div>
                                <div>
                                    <label className={`text-xs font-bold ${t.textSecondary} uppercase mb-1 block`}>1º Vencimento</label>
                                    <input type="date" value={xmlData.pagamento.primeiroVencimento} onChange={e => xmlData.setPagamento(prev => ({ ...prev, primeiroVencimento: e.target.value }))}
                                        className={`w-full p-3 rounded-xl outline-none text-sm border ${t.inputBg}`} />
                                </div>
                            </div>
                            {xmlData.parcelas.length > 0 && (
                                <div className={`rounded-2xl border p-4 ${
                                    isDark ? 'bg-indigo-950/20 border-indigo-900/40' : 'bg-indigo-50 border-indigo-100'
                                }`}>
                                    <p className={`text-xs font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-700'} uppercase mb-3 flex items-center gap-2`}> <IoReceiptOutline /> Preview das parcelas </p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                        {xmlData.parcelas.map(parcela => (
                                            <div key={parcela.numero} className={`rounded-xl p-3 border text-center ${
                                                isDark ? 'bg-slate-900/60 border-indigo-900/30' : 'bg-white border-indigo-100'
                                            }`}>
                                                <p className={`text-xs ${isDark ? 'text-indigo-400' : 'text-indigo-650'} font-bold`}>{parcela.numero}/{xmlData.pagamento.parcelas}</p>
                                                <p className={`text-sm font-black ${t.textBlack}`}>{parcela.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                <p className={`text-[10px] ${t.textMuted}`}>{new Date(parcela.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {xmlData.todosVinculados && (
                            <div className={`p-4 rounded-2xl border text-sm ${
                                isDark ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                            }`}>
                                <p className="font-bold mb-1">✅ Ao confirmar, para cada produto vinculado:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-xs">
                                    <li>Estoque somado (+quantidade da nota)</li>
                                    <li>Custo atualizado (preço unitário da nota)</li>
                                    <li>NCM atualizado</li>
                                    <li>Preço de venda atualizado (conforme coluna editável)</li>
                                    <li>{xmlData.pagamento.parcelas} conta(s) a pagar criada(s) em {xmlData.pagamento.metodo}</li>
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-end pb-8">
                            <button onClick={xmlData.confirmarEntradaEstoque} disabled={!xmlData.todosVinculados || xmlData.loading || !xmlData.pagamento.primeiroVencimento}
                                className="bg-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-green-600/20 hover:bg-green-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                                {xmlData.loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <IoSaveOutline size={20} />}
                                Confirmar Entrada no Estoque
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* ── MODAL DUPLICATA ── */}
            {xmlData.modalDuplicata && xmlData.notaDuplicada && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className={`rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
                        <div className={`p-6 border-b ${isDark ? 'border-amber-900/40 bg-amber-950/20 text-amber-400' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
                            <h3 className="font-bold text-lg">⚠️ Nota já importada anteriormente</h3>
                            <p className="text-sm mt-1">Esta nota fiscal já foi processada. Veja os dados abaixo.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className={`rounded-2xl p-4 border text-sm space-y-2 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-gray-50 border-gray-100'}`}>
                                {[
                                    ['Nota Nº', xmlData.notaDuplicada.numeroNota],
                                    ['Fornecedor', xmlData.notaDuplicada.fornecedorNome],
                                    ['Valor Total', Number(xmlData.notaDuplicada.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })],
                                    ['Importada em', xmlData.notaDuplicada.dataEntrada?.toDate ? xmlData.notaDuplicada.dataEntrada.toDate().toLocaleString('pt-BR') : '—'],
                                    ['Itens', `${xmlData.notaDuplicada.itens?.length || 0} produtos`],
                                    ['Pagamento', `${xmlData.notaDuplicada.pagamento?.parcelas}x ${xmlData.notaDuplicada.pagamento?.metodo}`],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex justify-between"> <span className={t.textMuted}>{label}</span> <span className={`font-bold ${t.textBlack} truncate max-w-[220px] text-right`}>{value}</span> </div>
                                ))}
                            </div>
                            <p className={`text-sm font-medium ${t.textSecondary}`}>O que deseja fazer?</p>
                            <div className="space-y-2">
                                <button onClick={() => xmlData.recalcularDuplicataEFechar(true)} className={`w-full py-3 px-4 rounded-xl border text-sm text-left flex items-center gap-3 transition-all ${
                                    isDark ? 'border-slate-800 text-slate-350 hover:bg-slate-800' : 'border-gray-200 text-gray-750 hover:bg-gray-55'
                                }`}>
                                    <span className="text-xl">🚫</span> <div><p className="font-bold">Cancelar — não importar</p><p className={`text-xs ${t.textMuted} font-normal`}>Descarta o arquivo e volta para a tela inicial</p></div>
                                </button>
                                <button onClick={() => { xmlData.recalcularDuplicataEFechar(true); xmlData.setAbaAtiva('historico'); }} className={`w-full py-3 px-4 rounded-xl border text-sm text-left flex items-center gap-3 transition-all ${
                                    isDark ? 'border-blue-900/50 text-blue-400 hover:bg-blue-950/40' : 'border-blue-100 text-blue-700 hover:bg-blue-50'
                                }`}>
                                    <span className="text-xl">📋</span> <div><p className="font-bold">Ver histórico de importações</p><p className={`text-xs ${t.textMuted} font-normal`}>Consulta as notas já processadas</p></div>
                                </button>
                                <button onClick={() => xmlData.recalcularDuplicataEFechar(false)} className={`w-full py-3 px-4 rounded-xl border text-sm text-left flex items-center gap-3 transition-all ${
                                    isDark ? 'border-red-900/50 text-red-400 hover:bg-red-950/40' : 'border-red-100 text-red-700 hover:bg-red-50'
                                }`}>
                                    <span className="text-xl">⚠️</span> <div><p className="font-bold">Reimportar mesmo assim</p><p className={`text-xs ${t.textMuted} font-normal`}>Vai somar estoque novamente e criar novas parcelas</p></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAIS DE PRODUTOS ── */}
            {xmlData.modalVinculo.isOpen && xmlData.notaLida && (
                <ModalVinculo produtoNota={xmlData.notaLida.produtos[xmlData.modalVinculo.itemIndex]} produtosSistema={xmlData.produtosSistema}
                    onVincular={xmlData.selecionarVinculo} onCriarNovo={xmlData.abrirCriarNovo} onFechar={() => xmlData.setModalVinculo({ isOpen: false, itemIndex: null })} isDark={isDark} />
            )}

            {xmlData.modalNovoProduto.isOpen && xmlData.notaLida && (
                <ModalNovoProduto produtoNota={xmlData.notaLida.produtos[xmlData.modalNovoProduto.itemIndex]} margemPadrao={xmlData.margemPadrao} estabelecimentoId={estabelecimentoIdPrincipal}
                    onSalvo={xmlData.onProdutoCriado} onFechar={() => xmlData.setModalNovoProduto({ isOpen: false, itemIndex: null })} isDark={isDark} />
            )}
        </div>
    );
};

export default EntradaEstoqueXML;