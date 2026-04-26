import BackButton from '../components/BackButton';
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useHeader } from '../context/HeaderContext';
import { useControleSalaoData } from "../hooks/useControleSalaoData";
import MesaCard from "../components/MesaCard";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import ModalPagamento from "../components/ModalPagamento";
import GeradorTickets from "../components/GeradorTickets";
import RelatorioTicketsModal from "../components/RelatorioTicketsModal";
import HistoricoMesasModal from "../components/HistoricoMesasModal";
import RelatorioGarcomModal from "../components/RelatorioGarcomModal";
import PromptDialog from "../components/ui/PromptDialog";
import { ModalRecibo, ModalHistorico } from "../components/pdv-modals";
import StatCard from "../components/StatCard";
import ModalAbrirMesa from "../components/ModalAbrirMesa";
import LegendaCores from "../components/LegendaCores";
import {
    IoArrowBack, IoAdd, IoGrid, IoPeople, IoWalletOutline,
    IoRestaurant, IoSearch, IoClose, IoAlertCircle,
    IoTimeOutline, IoReceiptOutline, IoChevronDown, IoChevronUp, IoTrash, IoExpand, IoContract, IoCloudOffline, IoEye, IoEyeOff
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

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isModalPagamentoOpen, setIsModalPagamentoOpen] = useState(false);
    const [mesaParaPagamento, setMesaParaPagamento] = useState(null);
    const [isModalTicketsOpen, setIsModalTicketsOpen] = useState(false);
    const [isRelatorioOpen, setIsRelatorioOpen] = useState(false);
    const [isHistoricoMesasOpen, setIsHistoricoMesasOpen] = useState(false);
    const [isModalComissaoOpen, setIsModalComissaoOpen] = useState(false);

    // Online/Offline e Tela Cheia Status
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isFullscreen, setIsFullscreen] = useState(false);

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
        <div className="min-h-screen bg-[#F8FAFC] p-2 sm:p-4 lg:p-6 w-full max-w-[1600px] mx-auto pb-24 font-sans">
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

            <AdicionarMesaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={async (num) => { const res = await salaoData.handleAdicionarMesa(num); if(res.success) setIsModalOpen(false); }} mesasExistentes={salaoData.mesas} />
            <ModalAbrirMesa isOpen={salaoData.isModalAbrirMesaOpen} onClose={salaoData.handleCancelarAbertura} onConfirm={salaoData.handleConfirmarAbertura} mesaNumero={salaoData.mesaParaAbrir?.numero} isOpening={salaoData.isOpeningTable} />
            
            {isModalPagamentoOpen && mesaParaPagamento && salaoData.estabelecimentoId && <ModalPagamento mesa={mesaParaPagamento} estabelecimentoId={salaoData.estabelecimentoId} onClose={() => setIsModalPagamentoOpen(false)} onSucesso={(vd) => salaoData.handlePagamentoConcluido(vd, setMesaParaPagamento, setIsModalPagamentoOpen)} />}
            {isModalTicketsOpen && <GeradorTickets onClose={() => setIsModalTicketsOpen(false)} estabelecimentoNome={salaoData.nomeEstabelecimento} estabelecimentoId={salaoData.estabelecimentoId} />}
            {isRelatorioOpen && <RelatorioTicketsModal onClose={() => setIsRelatorioOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} />}
            {isHistoricoMesasOpen && <HistoricoMesasModal isOpen={isHistoricoMesasOpen} onClose={() => setIsHistoricoMesasOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} />}
            {isModalComissaoOpen && <RelatorioGarcomModal isOpen={isModalComissaoOpen} onClose={() => setIsModalComissaoOpen(false)} estabelecimentoId={salaoData.estabelecimentoId} />}
            
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
                visivel={salaoData.isHistoricoVendasOpen} 
                onClose={() => salaoData.setIsHistoricoVendasOpen(false)} 
                vendas={salaoData.vendasHistoricoExibicao} 
                titulo="Histórico de Vendas & NFC-e" 
                onSelecionarVenda={salaoData.selecionarVendaHistorico} 
                carregando={salaoData.carregandoHistorico} 
                onConsultarStatus={salaoData.handleConsultarStatus} 
                onBaixarPdf={salaoData.handleBaixarPdf} 
                onBaixarXml={salaoData.handleBaixarXml} 
                onBaixarXmlCancelamento={async () => {}} 
                onEnviarWhatsApp={salaoData.handleEnviarWhatsApp} 
                onProcessarLote={async () => {}}
                onCancelarNfce={salaoData.handleCancelarNfce}
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
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 no-scrollbar w-full xl:w-auto">
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
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end">
                            <button onClick={() => setIsModalOpen(true)} className="bg-gray-900 hover:bg-black text-white font-black py-2.5 px-4 rounded-xl shadow-lg flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                                <IoAdd className="text-lg" /> <span>Nova Mesa</span>
                            </button>
                            {!isGarcom && (
                                <>
                                    <button onClick={() => salaoData.abrirHistoricoVendas()} className="bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                                        <IoReceiptOutline className="text-lg" /> <span className="hidden sm:inline">Notas Fiscais</span>
                                    </button>
                                    <button onClick={() => setIsHistoricoMesasOpen(true)} className="bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                                        <IoTimeOutline className="text-lg" /> <span className="hidden sm:inline">Mesas Antigas</span>
                                    </button>
                                    <button onClick={() => setIsModalComissaoOpen(true)} className="bg-white text-green-700 border border-green-200 hover:bg-green-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm">
                                        <IoPeople className="text-lg" /> <span className="hidden sm:inline">Comissões</span>
                                    </button>
                                    <button onClick={toggleFullScreen} className="bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm" title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}>
                                        {isFullscreen ? <IoContract className="text-lg" /> : <IoExpand className="text-lg" />} 
                                        <span className="hidden sm:inline">{isFullscreen ? 'Sair Tela Cheia' : 'Tela Cheia'}</span>
                                    </button>
                                    <button onClick={() => salaoData.handleExcluirMesasLivres()} className="bg-white text-red-600 border border-red-200 hover:bg-red-50 font-black py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 active:scale-95 transition-all text-xs sm:text-sm" title="Limpar Mesas Livres">
                                        <IoTrash className="text-lg" /> <span className="hidden sm:inline">Limpar Livres</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Linha 2: Busca e Filtros */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
                        <div className="relative w-full sm:w-48 md:w-64">
                            <IoSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" className="w-full pl-10 pr-9 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 font-bold text-gray-800 placeholder-gray-400 outline-none shadow-sm transition-all" placeholder="Buscar mesa..." value={salaoData.buscaMesa} onChange={(e) => salaoData.setBuscaMesa(e.target.value)} />
                            {salaoData.buscaMesa && <button onClick={() => salaoData.setBuscaMesa('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><IoClose size={18}/></button>}
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
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center text-gray-400 w-full">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4"><IoRestaurant className="text-3xl text-gray-300" /></div>
                        <p className="text-base font-bold text-gray-500">Nenhuma mesa encontrada.</p>
                        {salaoData.mesas.length === 0 && (
                            <button onClick={() => setIsModalOpen(true)} className="mt-4 text-blue-600 font-bold hover:underline text-sm">+ Adicionar Mesas</button>
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