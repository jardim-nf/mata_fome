import BackButton from '../components/BackButton';
import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHeader } from '../context/HeaderContext';
import { useControleSalaoData } from "../hooks/useControleSalaoData";
import { getTerminology } from "../utils/terminologyUtils";
import MesaCard from "../components/MesaCard";
import PromptDialog from "../components/ui/PromptDialog";
import { ModalRecibo, ModalHistorico, ModalAberturaCaixa, ModalFechamentoCaixa, ModalResumoTurno, ModalMovimentacao, ModalListaTurnos } from "../components/pdv-modals";
import { usePdvCaixa } from "../hooks/usePdvCaixa";
import { usePdvStore } from "../store/usePdvStore";
import StatCard from "../components/StatCard";
import LegendaCores from "../components/LegendaCores";

import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";
const GeradorTickets = lazy(() => import("../components/GeradorTickets"));
const RelatorioTicketsModal = lazy(() => import("../components/RelatorioTicketsModal"));
const ModalVendaRapida = lazy(() => import("../components/ModalVendaRapida"));
const HistoricoMesasModal = lazy(() => import("../components/HistoricoMesasModal"));
const RelatorioGarcomModal = lazy(() => import("../components/RelatorioGarcomModal"));
import {
    IoArrowBack, IoAdd, IoGrid, IoPeople, IoWalletOutline,
    IoRestaurant, IoSearch, IoClose, IoAlertCircle,
    IoTimeOutline, IoReceiptOutline, IoChevronDown, IoChevronUp, IoTrash, IoExpand, IoContract, IoCloudOffline, IoEye, IoEyeOff, IoCash
} from "react-icons/io5";

const formatarReal = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor || 0);
};

export default function ControleSalao() {
    const { userData, user, currentUser, estabelecimentoIdPrincipal } = useAuth();
    const rawRole = String(userData?.role || userData?.cargo || 'admin').toLowerCase().trim();
    const isGarcom = rawRole.includes('garcom') || rawRole.includes('garçom') || rawRole.includes('atendente');
    const { setActions, clearActions } = useHeader();
    const navigate = useNavigate();

    // Injeção do Custom Hook
    const salaoData = useControleSalaoData(userData, user, currentUser, estabelecimentoIdPrincipal);

    const {
        mostrarAberturaCaixa, setMostrarAberturaCaixa,
        mostrarHistorico, setMostrarHistorico,
        vendasHistoricoExibicao, tituloHistorico
    } = usePdvStore();

    const inputBuscaRef = useRef(null);

    const pdvCaixa = usePdvCaixa(
        currentUser || user,
        salaoData.estabelecimentoId,
        inputBuscaRef,
        true
    );

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalTicketsOpen, setIsModalTicketsOpen] = useState(false);
    const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);
    const [isVendaRapidaOpen, setIsVendaRapidaOpen] = useState(false);
    const [isHistoricoMesasOpen, setIsHistoricoMesasOpen] = useState(false);
    const [isModalComissaoOpen, setIsModalComissaoOpen] = useState(false);
    const [isMenuCaixaAberto, setIsMenuCaixaAberto] = useState(false);
    const [mostrarListaTurnos, setMostrarListaTurnos] = useState(false);

    // Online/Offline e Tela Cheia Status
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Estado de Data, Hora e Duração do Turno
    const [currentDateTime, setCurrentDateTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentDateTime(new Date());
        }, 10000); // Atualiza a cada 10 segundos
        return () => clearInterval(interval);
    }, []);

    const formatarDataHora = (data) => {
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const hora = String(data.getHours()).padStart(2, '0');
        const min = String(data.getMinutes()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${min}`;
    };

    const getDuracaoTurno = () => {
        if (!pdvCaixa.caixaAberto || !pdvCaixa.caixaAberto.dataAbertura) return null;
        try {
            const dataAbertura = pdvCaixa.caixaAberto.dataAbertura.toDate 
                ? pdvCaixa.caixaAberto.dataAbertura.toDate() 
                : new Date(pdvCaixa.caixaAberto.dataAbertura);
            const diffMs = Math.max(0, currentDateTime - dataAbertura);
            const diffHrs = Math.floor(diffMs / 3600000);
            const diffMins = Math.floor((diffMs % 3600000) / 60000);
            
            if (diffHrs === 0) {
                return `há ${diffMins} min`;
            }
            return `há ${diffHrs}h ${diffMins}m`;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    const isTurnoExcedido24h = () => {
        if (!pdvCaixa.caixaAberto || !pdvCaixa.caixaAberto.dataAbertura) return false;
        try {
            const dataAbertura = pdvCaixa.caixaAberto.dataAbertura.toDate 
                ? pdvCaixa.caixaAberto.dataAbertura.toDate() 
                : new Date(pdvCaixa.caixaAberto.dataAbertura);
            const diffMs = Math.max(0, currentDateTime - dataAbertura);
            return diffMs >= 86400000; // 24 horas em milissegundos
        } catch (e) {
            return false;
        }
    };

    // Ocultar valores (privacidade)
    const [isValorOculto, setIsValorOculto] = useState(() => {
        return localStorage.getItem('ocultarValoresSalao') === 'true';
    });

    const toggleValorOculto = () => {
        const val = !isValorOculto;
        setIsValorOculto(val);
        localStorage.setItem('ocultarValoresSalao', String(val));
    };

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => { 
        const handler = (e) => { 
            pdvCaixa.setTurnoSelecionadoResumo(e.detail); 
            setMostrarListaTurnos(false); 
            pdvCaixa.setMostrarResumoTurno(true); 
        }; 
        document.addEventListener('abrirRelatorioTurno', handler); 
        return () => document.removeEventListener('abrirRelatorioTurno', handler); 
    }, [pdvCaixa]);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    };

    useEffect(() => {
        setActions(null);
        return () => clearActions();
    }, [setActions, clearActions, isGarcom]);

    if (!salaoData.estabelecimentoId && !salaoData.loading) return <div className="p-10 text-center"><IoAlertCircle className="mx-auto text-4xl text-red-500 mb-2" />Sem acesso.</div>;

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-2 sm:p-4 lg:p-6 w-full pb-24 font-sans">
            <PromptDialog
                open={salaoData.promptCancelNfce.open}
                title="Cancelar NFC-e"
                message="Digite o motivo do cancelamento (mínimo 15 caracteres):"
                placeholder="Ex: Pedido cancelado a pedido do cliente"
                confirmText="Cancelar Nota"
                cancelText="Voltar"
                onConfirm={salaoData.executarCancelamentoNfce}
                onCancel={() => salaoData.setPromptCancelNfce({ open: false, venda: null })}
            />
            <PromptDialog
                open={salaoData.promptWhatsApp.open}
                title="Enviar NFC-e por WhatsApp"
                message="📱 Número de WhatsApp do cliente:"
                defaultValue={salaoData.promptWhatsApp.defaultTel}
                placeholder="Ex: 11999998888"
                confirmText="Enviar"
                cancelText="Cancelar"
                onConfirm={salaoData.executarEnvioWhatsApp}
                onCancel={() => salaoData.setPromptWhatsApp({ open: false, venda: null, defaultTel: '' })}
            />

            {isOffline && (
                <div className="bg-red-500 text-white p-3 rounded-2xl mb-4 shadow-lg flex items-center justify-center gap-2 font-bold animate-[pulse_2s_ease-in-out_infinite]">
                    <IoCloudOffline size={20} />
                    Você está offline! Sincronizando dados assim que a conexão voltar...
                </div>
            )}

            {isModalOpen && <AdicionarMesaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={async (num) => { const res = await salaoData.handleAdicionarMesa(num); if(res.success) setIsModalOpen(false); }} mesasExistentes={salaoData.mesas} tipoNegocio={salaoData.tipoNegocio} />}

            {isModalPagamentoOpen && mesaParaPagamento && salaoData.estabelecimentoId && <ModalPagamento mesa={mesaParaPagamento} estabelecimentoId={salaoData.estabelecimentoId} tipoNegocio={salaoData.tipoNegocio} onClose={() => setIsModalPagamentoOpen(false)} onSucesso={(vd) => salaoData.handlePagamentoConcluido(vd, setMesaParaPagamento, setIsModalPagamentoOpen)} />}

            <Suspense fallback={null}>
                {isModalTicketsOpen && <GeradorTickets onClose={() => setIsModalTicketsOpen(false)} estabelecimentoNome={salaoData.nomeEstabelecimento} estabelecimentoId={salaoData.estabelecimentoId} />}
                {isRelatorioOpen && <RelatorioTicketsModal onClose={() => setIsRelatorioOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} />}
                {isVendaRapidaOpen && <ModalVendaRapida isOpen={isVendaRapidaOpen} onClose={() => setIsVendaRapidaOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} estabelecimentoNome={salaoData.nomeEstabelecimento} />}
                {isHistoricoMesasOpen && <HistoricoMesasModal isOpen={isHistoricoMesasOpen} onClose={() => setIsHistoricoMesasOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} tipoNegocio={salaoData.tipoNegocio} />}
                {isModalComissaoOpen && <RelatorioGarcomModal isOpen={isModalComissaoOpen} onClose={() => setIsModalComissaoOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} />}
            </Suspense>
            
            <ModalRecibo 
                visivel={salaoData.mostrarRecibo} 
                dados={salaoData.dadosRecibo} 
                onClose={() => salaoData.setMostrarRecibo(false)} 
                onNovaVenda={() => salaoData.setMostrarRecibo(false)} 
                onEmitirNfce={salaoData.handleEmitirNfce} 
                nfceStatus={salaoData.nfceStatus} 
                nfceUrl={salaoData.nfceUrl} 
                onBaixarXml={salaoData.handleBaixarXml} 
                onConsultarStatus={salaoData.handleConsultarStatus} 
                onBaixarPdf={salaoData.handleBaixarPdf} 
                onBaixarXmlCancelamento={async (venda) => { /* Simplificado no hook */ }} 
                onEnviarWhatsApp={salaoData.handleEnviarWhatsApp} 
                onCancelarNfce={salaoData.handleCancelarNfce} 
            />

            <ModalHistorico 
                visivel={salaoData.isHistoricoVendasOpen || mostrarHistorico} 
                onClose={() => { salaoData.setIsHistoricoVendasOpen(false); setMostrarHistorico(false); }} 
                vendas={mostrarHistorico ? vendasHistoricoExibicao : salaoData.vendasHistoricoExibicao} 
                titulo={mostrarHistorico ? tituloHistorico : "Histórico de Vendas & NFC-e"} 
                onSelecionarVenda={salaoData.selecionarVendaHistorico} 
                carregando={salaoData.carregandoHistorico || pdvCaixa.carregandoHistorico} 
                onConsultarStatus={salaoData.handleConsultarStatus} 
                onBaixarPdf={salaoData.handleBaixarPdf} 
                onBaixarXml={salaoData.handleBaixarXml} 
                onBaixarXmlCancelamento={async () => {}} 
                onEnviarWhatsApp={salaoData.handleEnviarWhatsApp} 
                onProcessarLote={async () => {}}
                onCancelarNfce={salaoData.handleCancelarNfce}
            />

            <ModalAberturaCaixa 
                visivel={mostrarAberturaCaixa} 
                onAbrir={pdvCaixa.handleAbrirCaixa} 
                usuarioNome={userData?.name} 
            />

            <ModalFechamentoCaixa 
                visivel={pdvCaixa.mostrarFechamentoCaixa} 
                caixa={pdvCaixa.caixaAberto} 
                vendasDoDia={pdvCaixa.vendasTurnoAtual} 
                movimentacoes={pdvCaixa.movimentacoesDoTurno} 
                onClose={() => pdvCaixa.setMostrarFechamentoCaixa(false)} 
                onConfirmarFechamento={(d) => pdvCaixa.handleConfirmarFechamento(d, null)} 
            />

            <ModalMovimentacao 
                visivel={pdvCaixa.mostrarMovimentacao} 
                onClose={() => pdvCaixa.setMostrarMovimentacao(false)} 
                onConfirmar={pdvCaixa.handleSalvarMovimentacao} 
            />

            <ModalResumoTurno 
                visivel={pdvCaixa.mostrarResumoTurno} 
                turno={pdvCaixa.turnoSelecionadoResumo} 
                onClose={() => { pdvCaixa.setMostrarResumoTurno(false); if (!pdvCaixa.caixaAberto) setMostrarAberturaCaixa(true); }} 
                onVerVendas={() => pdvCaixa.visualizarVendasTurno(pdvCaixa.turnoSelecionadoResumo)}
                vendasDoDia={pdvCaixa.vendasTurnoAtual}
            />

            <ModalListaTurnos 
                visivel={mostrarListaTurnos} 
                onClose={() => setMostrarListaTurnos(false)} 
                turnos={pdvCaixa.listaTurnos} 
                carregando={pdvCaixa.carregandoHistorico} 
                onSelecionarTurno={pdvCaixa.visualizarResumoTurno} 
                vendasDoDia={pdvCaixa.vendasTurnoAtual} 
            />

            <div className="sticky top-0 bg-[#F8FAFC]/90 backdrop-blur-xl z-30 pb-4 pt-2 mb-2 w-full flex flex-col gap-2">
                {!isGarcom && (
                    <div className="mb-2">
                        <BackButton to="/dashboard" />
                    </div>
                )}
                <div className="flex flex-col gap-4 w-full">
                    {/* Linha 1: Status e Botões de Ação */}
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 w-full">
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full xl:w-auto shrink-0">
                            <StatCard icon={IoGrid} label="Ocupação" colorClass="text-blue-600" bgClass="bg-blue-50">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden min-w-[50px] sm:min-w-[60px]">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                                salaoData.stats.ocupacaoPercent >= 80 ? 'bg-red-500' : 
                                                salaoData.stats.ocupacaoPercent >= 50 ? 'bg-amber-400' : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${salaoData.stats.ocupacaoPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-gray-900">{salaoData.stats.ocupacaoPercent}%</span>
                                </div>
                            </StatCard>
                            <StatCard icon={IoPeople} label="Pessoas" value={salaoData.stats.pessoas} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
                            {!isGarcom && (
                                <StatCard icon={IoWalletOutline} label="Aberto" bgClass="bg-purple-50" colorClass="text-purple-600">
                                    <div className="flex items-center justify-between gap-1 mt-0.5">
                                        <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight truncate">
                                            {isValorOculto ? 'R$ •••••' : formatarReal(salaoData.stats.vendas)}
                                        </h3>
                                        <button onClick={toggleValorOculto} className="text-purple-400 hover:text-purple-600 active:scale-95 transition-all outline-none" title={isValorOculto ? "Mostrar valores" : "Ocultar valores"}>
                                            {isValorOculto ? <IoEyeOff size={18} /> : <IoEye size={18} />}
                                        </button>
                                    </div>
                                </StatCard>
                            )}
                            {pdvCaixa.caixaAberto && getDuracaoTurno() && (
                                <StatCard 
                                    icon={IoTimeOutline} 
                                    label="Duração Turno" 
                                    bgClass={isTurnoExcedido24h() ? "bg-red-50" : "bg-amber-50"} 
                                    colorClass={isTurnoExcedido24h() ? "text-red-600" : "text-amber-600"}
                                    onClick={pdvCaixa.prepararFechamento}
                                >
                                    <h3 className={`text-sm sm:text-base font-black leading-tight mt-0.5 truncate ${isTurnoExcedido24h() ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>
                                        {getDuracaoTurno()}{isTurnoExcedido24h() ? ' - FECHAR!' : ''}
                                    </h3>
                                </StatCard>
                            )}
                            <StatCard 
                                icon={IoTimeOutline} 
                                label="Data e Hora" 
                                bgClass="bg-slate-50" 
                                colorClass="text-slate-500"
                            >
                                <h3 className="text-sm sm:text-base font-black text-gray-900 leading-tight mt-0.5 truncate">
                                    {formatarDataHora(currentDateTime)}
                                </h3>
                            </StatCard>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end relative z-40">
                            <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 hover:bg-black text-white font-black py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                                <IoAdd className="text-lg" /> <span>{getTerminology('novaMesa', salaoData.tipoNegocio)}</span>
                            </button>
                            <button onClick={() => setIsVendaRapidaOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                                <IoCash className="text-lg" /> <span>Venda Rápida</span>
                            </button>
                            
                            {!isGarcom && (
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsMenuCaixaAberto(!isMenuCaixaAberto)} 
                                        className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm"
                                    >
                                        <span>⚙️ Caixa & Admin</span>
                                        <IoChevronDown size={14} className={`transition-transform duration-200 ${isMenuCaixaAberto ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {isMenuCaixaAberto && (
                                        <>
                                            {/* Backdrop overlay for closing click */}
                                            <div className="fixed inset-0 z-30 cursor-default" onClick={() => setIsMenuCaixaAberto(false)} />
                                            
                                            {/* Dropdown Menu */}
                                            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                                                {pdvCaixa.caixaAberto ? (
                                                    <>
                                                        <button 
                                                            onClick={() => { setIsMenuCaixaAberto(false); pdvCaixa.abrirMovimentacao(); }} 
                                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-amber-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                        >
                                                            <IoCash className="text-base" /> Sangria/Suprimento
                                                        </button>
                                                        <button 
                                                            onClick={() => { setIsMenuCaixaAberto(false); pdvCaixa.prepararFechamento(); }} 
                                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-rose-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                        >
                                                            <IoTimeOutline className="text-base" /> Fechar Turno
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button 
                                                        onClick={() => { setIsMenuCaixaAberto(false); setMostrarAberturaCaixa(true); }} 
                                                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-emerald-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                    >
                                                        <IoTimeOutline className="text-base" /> Abrir Turno
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => { setIsMenuCaixaAberto(false); salaoData.abrirHistoricoVendas(); }} 
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-purple-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                >
                                                    <IoReceiptOutline className="text-base" /> Notas Fiscais
                                                </button>
                                                <button 
                                                    onClick={() => { setIsMenuCaixaAberto(false); setIsHistoricoMesasOpen(true); }} 
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-blue-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                >
                                                    <IoTimeOutline className="text-base" /> {getTerminology('mesasAntigas', salaoData.tipoNegocio)}
                                                </button>
                                                <button 
                                                    onClick={() => { setIsMenuCaixaAberto(false); pdvCaixa.carregarListaTurnos(); setMostrarListaTurnos(true); }} 
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-indigo-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                >
                                                    <IoTimeOutline className="text-base" /> Histórico de Turnos
                                                </button>
                                                <button 
                                                    onClick={() => { setIsMenuCaixaAberto(false); setIsModalComissaoOpen(true); }} 
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-green-700 font-bold rounded-xl transition-colors text-xs text-left"
                                                >
                                                    <IoPeople className="text-base" /> Comissões
                                                </button>
                                                <button 
                                                    onClick={() => { setIsMenuCaixaAberto(false); salaoData.handleExcluirMesasLivres(); }} 
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-red-600 font-bold rounded-xl transition-colors text-xs text-left"
                                                >
                                                    <IoTrash className="text-base" /> Limpar Livres
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            <button onClick={toggleFullScreen} className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm" title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                                {isFullscreen ? <IoContract className="text-lg" /> : <IoExpand className="text-lg" />} 
                                <span className="hidden sm:inline">{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Linha 2: Busca e Filtros */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                            <div className="relative w-full sm:w-48 md:w-64">
                                <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" className="w-full pl-10 pr-9 py-3 bg-white border border-gray-200 rounded-2xl text-[16px] focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-gray-800 placeholder-gray-400 outline-none shadow-sm transition-all" placeholder={getTerminology('buscarMesa', salaoData.tipoNegocio)} value={salaoData.buscaMesa} onChange={(e) => salaoData.setBuscaMesa(e.target.value)} />
                                {salaoData.buscaMesa && <button onClick={() => salaoData.setBuscaMesa('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><IoClose size={18}/></button>}
                            </div>

                        </div>
                        <div className="flex bg-gray-200/60 p-1 rounded-2xl overflow-x-auto gap-1">
                            {['todos', 'livres', 'ocupadas'].map(t => {
                                const qtsLivres = salaoData.mesas.filter(m => m.status === 'livre').length;
                                const qtsOcupadas = salaoData.mesas.filter(m => m.status !== 'livre').length;
                                const qtd = t === 'todos' ? salaoData.mesas.length : t === 'livres' ? qtsLivres : qtsOcupadas;
                                const isSelected = salaoData.filtro === t;
                                const dotColor = t === 'livres' ? 'bg-gray-400' : t === 'ocupadas' ? 'bg-red-500' : 'bg-gray-800';
                                
                                return (
                                    <button 
                                        key={t} 
                                        onClick={() => salaoData.setFiltro(t)} 
                                        className={`flex items-center gap-1.5 flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-black capitalize transition-all whitespace-nowrap ${isSelected ? 'bg-white text-gray-900 shadow-md transform scale-105 my-0.5' : 'text-gray-500 hover:text-gray-800 hover:bg-white/50 my-0.5'}`}
                                    >
                                        {t !== 'todos' && <div className={`w-2 h-2 rounded-full ${isSelected ? dotColor : 'bg-gray-300 transition-colors'}`}></div>}
                                        {t} <span className={`ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] ${isSelected ? 'bg-gray-100 text-gray-800' : 'bg-gray-200 text-gray-500'}`}>{qtd}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <LegendaCores />

            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm min-h-[70vh] w-full relative">
                {salaoData.mesasFiltradas.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 w-full">
                        {salaoData.mesasFiltradas.map(mesa => (
                            <MesaCard
                                key={mesa.id}
                                mesa={mesa}
                                isOciosa={salaoData.verificarMesaOciosa(mesa)}
                                currentTime={salaoData.currentTime}
                                onClick={() => salaoData.handleMesaClick(mesa)}
                                onPagar={() => { setMesaParaPagamento(mesa); setIsModalPagamentoOpen(true); }}
                                onExcluir={() => salaoData.handleExcluirMesa(mesa.id)}
                                onLimparAlerta={salaoData.limparAlertaMesa}
                                isValorOculto={isGarcom || isValorOculto}
                                tipoNegocio={salaoData.tipoNegocio}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400 w-full">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><IoRestaurant className="text-3xl text-gray-300" /></div>
                        <p className="text-base font-bold text-gray-500">Nenhuma {getTerminology('mesa', salaoData.tipoNegocio).toLowerCase()} encontrada.</p>
                        {salaoData.mesas.length === 0 && (
                            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-600 font-bold hover:underline text-sm">+ Adicionar {getTerminology('mesas', salaoData.tipoNegocio)}</button>
                        )}
                    </div>
                )}
            </div>

            <div style={{ position: 'absolute', width: '0px', height: '0px', overflow: 'hidden', left: '-9999px' }}>
                {salaoData.imprimindoAtualmente && (
                    <iframe key={salaoData.imprimindoAtualmente} src={salaoData.imprimindoAtualmente} title="print-ativo" />
                )}
            </div>
        </div>
    );
}