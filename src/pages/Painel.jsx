import React, { useMemo } from 'react';
import BackButton from '../components/BackButton';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import PedidoCard from "../components/PedidoCard";
import NovoPedidoDeliveryModal from '../components/NovoPedidoDeliveryModal';
import PromptDialog from '../components/ui/PromptDialog';
import { ModalRecibo, ModalHistorico } from '../components/pdv-modals';
import { IoTime, IoArrowBack, IoRestaurant, IoBicycle, IoCalendarOutline, IoNotificationsOutline, IoNotificationsOffOutline, IoPrint, IoReceiptOutline, IoWalletOutline, IoCartOutline, IoAddCircleOutline } from "react-icons/io5";

import { useOrdersPanel } from '../hooks/useOrdersPanel';
import { useFiscalNfce } from '../hooks/useFiscalNfce';
import GrupoPedidosMesa from '../components/painel/GrupoPedidosMesa';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
function Painel() {
    const navigate = useNavigate();
    const { loading: authLoading, estabelecimentosGerenciados } = useAuth();
    const estabelecimentoAtivo = useMemo(() => estabelecimentosGerenciados?.[0] || null, [estabelecimentosGerenciados]);

    const {
        dataSelecionada, setDataSelecionada,
        pedidos, loading, motoboys,
        estabelecimentoInfo,
        abaAtiva, setAbaAtiva,
        colunaMobile, setColunaMobile,
        notificationsEnabled, setNotificationsEnabled, userInteracted, setUserInteracted,
        modoImpressao, alternarModoImpressao,
        handleAtribuirMotoboy, handleExcluirPedido, handleUpdateStatusAndNotify, handleUpdateFormaPagamento,
        newOrderIds
    } = useOrdersPanel(estabelecimentoAtivo, authLoading);

    const nfce = useFiscalNfce(estabelecimentoAtivo);

    const [showNovoPedidoModal, setShowNovoPedidoModal] = React.useState(false);

    const colunasAtivas = useMemo(() => abaAtiva === 'cozinha' ? ['recebido', 'preparo', 'pronto_para_servir', 'finalizado'] : ['recebido', 'preparo', 'em_entrega', 'pronto_para_servir', 'finalizado'], [abaAtiva]);

    const STATUS_UI = {
        recebido: { title: 'Novos', icon: '📥', dot: 'bg-rose-500', bgBadge: 'bg-rose-100', textBadge: 'text-rose-700', emptyTitle: 'Tudo certo!', emptyMsg: 'Nenhum pedido novo aguardando' },
        preparo: { title: 'Em Preparo', icon: '🔥', dot: 'bg-amber-500', bgBadge: 'bg-amber-100', textBadge: 'text-amber-700', emptyTitle: 'Cozinha livre', emptyMsg: 'Nenhum pedido em preparo' },
        em_entrega: { title: 'Em Entrega', icon: '🛵', dot: 'bg-blue-500', bgBadge: 'bg-blue-100', textBadge: 'text-blue-700', emptyTitle: 'Sem entregas', emptyMsg: 'Nenhum pedido na rua' },
        pronto_para_servir: { title: abaAtiva === 'cozinha' ? 'Pronto (Mesa)' : 'Pronto p/ Retirada', icon: '✅', dot: 'bg-emerald-500', bgBadge: 'bg-emerald-100', textBadge: 'text-emerald-700', emptyTitle: 'Nada pronto', emptyMsg: abaAtiva === 'cozinha' ? 'Aparecerão aqui quando ficarem prontos' : 'Pedidos de retirada prontos aparecerão aqui' },
        finalizado: { title: 'Concluídos', icon: '🏁', dot: 'bg-slate-400', bgBadge: 'bg-slate-200', textBadge: 'text-slate-700', emptyTitle: 'Sem concluídos', emptyMsg: 'Os pedidos finalizados aparecerão aqui' }
    };

    const pedidosPorColuna = useMemo(() => {
        const resultado = {};
        colunasAtivas.forEach(statusKey => {
            let lista = (pedidos[statusKey] || []).filter(p => {
                if (abaAtiva === 'cozinha') return p.source === 'salao' || p.tipo === 'mesa';
                return p.source !== 'salao' && p.tipo !== 'mesa';
            });
            if (statusKey === 'finalizado') lista = [...lista].sort((a, b) => (b.dataFinalizado?.seconds || 0) - (a.dataFinalizado?.seconds || 0));
            resultado[statusKey] = lista;
        });
        return resultado;
    }, [pedidos, abaAtiva, colunasAtivas]);

    const statsDoDia = useMemo(() => {
        const todosPedidos = colunasAtivas.flatMap(status => pedidosPorColuna[status] || []);
        const total = todosPedidos.reduce((acc, p) => acc + (p.totalFinal || p.total || 0), 0);
        return { quantidade: todosPedidos.length, faturamento: total };
    }, [pedidosPorColuna, colunasAtivas]);

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    if (!estabelecimentoAtivo) return <div className="p-10 text-center font-medium text-slate-500">Sem estabelecimento selecionado.</div>;

    const navTop = (
        <div className="bg-white border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center px-4 py-2 gap-4">
                <div className="flex items-center gap-3">
                    <BackButton to="/admin" />
                    <div className="hidden md:flex flex-col"><span className="text-sm font-semibold text-gray-800">Mata Fome</span><span className="text-xs text-gray-500">KDS (Painel de Pedidos)</span></div>
                    <div className="h-8 w-px bg-gray-300 hidden md:block"></div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { if (!userInteracted) setUserInteracted(true); setNotificationsEnabled(!notificationsEnabled); }} className={`p-2 rounded-full cursor-pointer transition-colors ${notificationsEnabled ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`} title={notificationsEnabled ? "Notificações ligadas" : "Ligar notificações sonoras"}>{notificationsEnabled ? <IoNotificationsOutline size={22} /> : <IoNotificationsOffOutline size={22} />}</button>
                        <button onClick={alternarModoImpressao} className={`p-2 rounded-full flex gap-1 items-center font-bold text-xs cursor-pointer transition-colors ${modoImpressao === 'tudo' ? 'text-blue-600 bg-blue-50' : modoImpressao === 'cozinha' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:bg-gray-100'}`} title={`Modo Auto-Print: ${modoImpressao.toUpperCase()}`}><IoPrint size={20} />{modoImpressao === 'tudo' ? 'ALL' : modoImpressao === 'cozinha' ? 'KDS' : 'OFF'}</button>
                        <button onClick={nfce.abrirHistoricoVendas} className="p-2 border-orange-200 border bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg flex items-center font-bold text-xs gap-1 ml-2 transition-colors"><IoReceiptOutline size={18} /> Histórico XML/PDF</button>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner w-full sm:w-auto">
                        <button onClick={() => setAbaAtiva('delivery')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${abaAtiva === 'delivery' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><IoBicycle size={18} /> Delivery</button>
                        <button onClick={() => setAbaAtiva('cozinha')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${abaAtiva === 'cozinha' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><IoRestaurant size={18} /> Salão</button>
                    </div>
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm shrink-0"><IoCalendarOutline className="text-gray-400 mr-2" size={20} /><input type="date" value={dataSelecionada} onChange={(e) => setDataSelecionada(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none" /></div>
                </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 border-b border-blue-100 flex justify-between items-center">
                <div className="flex items-center gap-6"><div className="flex items-center gap-2 text-sm"><IoTime className="text-blue-500 flex-shrink-0" size={18}/><span className="text-gray-600">Mostrando Dia:</span><span className="font-bold text-blue-700">{dataSelecionada.split('-').reverse().join('/')}</span></div><div className="hidden md:flex items-center gap-2 text-sm border-l border-blue-200 pl-6"><IoCartOutline className="text-emerald-500" size={18}/><span className="text-gray-600">Total de Pedidos:</span><span className="font-black text-emerald-700">{statsDoDia.quantidade}</span></div><div className="hidden md:flex items-center gap-2 text-sm border-l border-blue-200 pl-6"><IoWalletOutline className="text-purple-500" size={18}/><span className="text-gray-600">Faturamento Realizado:</span><span className="font-black text-purple-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(statsDoDia.faturamento)}</span></div></div>
                <button onClick={() => setShowNovoPedidoModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm transition-colors"><IoAddCircleOutline size={20} /> Novo Lançamento</button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <PromptDialog open={nfce.promptCancelNfce.open} title="Cancelar NFC-e" message="Motivo do cancelamento:" confirmText="Cancelar Nota" cancelText="Voltar" onConfirm={nfce.executarCancelamentoNfce} onCancel={() => nfce.setPromptCancelNfce({ open: false, venda: null })} />
            <PromptDialog open={nfce.promptWhatsApp.open} title="Enviar NFC-e por WhatsApp" message="📱 WhatsApp do cliente:" defaultValue={nfce.promptWhatsApp.defaultTel} confirmText="Enviar" cancelText="Cancelar" onConfirm={nfce.executarEnvioWhatsApp} onCancel={() => nfce.setPromptWhatsApp({ open: false, venda: null, defaultTel: '' })} />

            <ModalRecibo visivel={nfce.mostrarRecibo} dados={nfce.dadosRecibo} onClose={() => nfce.setMostrarRecibo(false)} onNovaVenda={() => nfce.setMostrarRecibo(false)} onEmitirNfce={nfce.handleEmitirNfce} nfceStatus={nfce.nfceStatus} nfceUrl={nfce.nfceUrl} onBaixarXml={nfce.handleBaixarXml} onBaixarPdf={nfce.handleBaixarPdf} />
            <ModalHistorico visivel={nfce.isHistoricoVendasOpen} vendas={nfce.vendasHistoricoExibicao} isCarregando={nfce.carregandoHistorico} onClose={() => nfce.setIsHistoricoVendasOpen(false)} onIrParaNovaVenda={() => nfce.setIsHistoricoVendasOpen(false)} onSelecionarVenda={nfce.selecionarVendaHistorico} consultarStatusNfce={nfce.handleConsultarStatus} cancelarNfce={nfce.handleCancelarNfce} handleEnviarWhatsApp={nfce.handleEnviarWhatsApp} />

            {/* Navbar Menu */}
            <div className="sticky top-0 z-40 shadow-sm">{navTop}</div>
            
            <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex flex-col sm:hidden px-4 mb-4">
                    <select value={colunaMobile} onChange={(e) => setColunaMobile(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        {colunasAtivas.map(status => <option key={status} value={status}>{STATUS_UI[status].title} ({pedidosPorColuna[status].length})</option>)}
                    </select>
                </div>
                <div className="flex-1 overflow-x-auto pb-4 px-2 sm:px-3">
                    <div className="grid gap-2 sm:gap-3 h-full" style={{ gridTemplateColumns: `repeat(${colunasAtivas.length}, minmax(180px, 1fr))` }}>
                        {colunasAtivas.map((statusKey) => {
                            const isMobileActive = colunaMobile === statusKey;
                            const isMobile = window.innerWidth < 640;
                            if (isMobile && !isMobileActive) return null;

                            let listaRender = pedidosPorColuna[statusKey];

                            // No KDS (Cozinha), filtramos para ocultar COMPLETAMENTE pedidos que só tenham bebidas
                            if (abaAtiva === 'cozinha') {
                                listaRender = listaRender.filter(pedido => {
                                    const itensCozinhaReais = (pedido.itens || []).filter(it => {
                                        const c = (it.categoria || it.category || '').toLowerCase();
                                        return !['bebida', 'drink', 'suco', 'refrigerante', 'agua', 'cerveja'].some(t => c.includes(t));
                                    });
                                    return itensCozinhaReais.length > 0;
                                });
                            }

                            return (
                                <div key={statusKey} className={`flex flex-col h-full ${isMobile ? 'w-full' : ''} bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden`}>
                                    <div className="p-4 border-b border-gray-200 bg-gray-50/80 shrink-0">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-full ${STATUS_UI[statusKey].bgBadge} flex items-center justify-center text-base shadow-inner`}>{STATUS_UI[statusKey].icon}</div>
                                                <h2 className="font-bold text-gray-800 text-[13px] truncate">{STATUS_UI[statusKey].title}</h2>
                                            </div>
                                            <div className={`px-2.5 py-1 rounded-full text-xs font-black shadow-sm ${STATUS_UI[statusKey].bgBadge} ${STATUS_UI[statusKey].textBadge}`}>
                                                {listaRender.length}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-2 sm:p-3 bg-[#F8FAFC]">
                                        <div className="space-y-3">
                                            {listaRender.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-48 text-center px-4"><div className={`w-16 h-16 rounded-full ${STATUS_UI[statusKey].bgBadge} flex items-center justify-center text-3xl mb-3 opacity-50`}>{STATUS_UI[statusKey].icon}</div><p className="font-bold text-gray-500">{STATUS_UI[statusKey].emptyTitle}</p><p className="text-xs text-gray-400 mt-1">{STATUS_UI[statusKey].emptyMsg}</p></div>
                                            ) : (
                                                <>
                                                    {abaAtiva === 'cozinha' ? (
                                                        <GrupoPedidosMesa 
                                                            pedidos={pedidosPorColuna[statusKey]} 
                                                            status={statusKey} 
                                                            onUpdateStatus={handleUpdateStatusAndNotify} 
                                                            isNewOrder={(id) => newOrderIds.has(id)}
                                                            onExcluir={handleExcluirPedido}
                                                            onEmitirNfce={(p) => nfce.handleNfceDoPedido(p)}
                                                        />
                                                    ) : (
                                                        listaRender.map(pedido => (
                                                            <div key={pedido.id} className="relative group/card transform transition-all duration-200">
                                                                <PedidoCard item={pedido} motoboysDisponiveis={motoboys} onUpdateStatus={handleUpdateStatusAndNotify} onAtribuirMotoboy={handleAtribuirMotoboy} onEmitirNfce={() => nfce.handleNfceDoPedido(pedido)} newOrderIds={newOrderIds} onExcluir={handleExcluirPedido} onUpdateFormaPagamento={handleUpdateFormaPagamento} estabelecimentoInfo={estabelecimentoInfo} />
                                                            </div>
                                                        ))
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <NovoPedidoDeliveryModal 
                isOpen={showNovoPedidoModal} 
                onClose={() => setShowNovoPedidoModal(false)} 
                estabelecimentoId={estabelecimentoAtivo}
                onSave={async (pedidoData) => {
                    if (!estabelecimentoAtivo) {
                        toast.error('Estabelecimento não identificado!');
                        return;
                    }
                    try {
                        const novaId = await addDoc(collection(db, 'estabelecimentos', estabelecimentoAtivo, 'pedidos'), {
                            ...pedidoData,
                            // Objeto `cliente` para compatibilidade com trigger de WhatsApp e PedidoCard
                            cliente: {
                                nome: pedidoData.nomeCliente || 'Cliente',
                                telefone: pedidoData.telefoneCliente || '',
                                endereco: {
                                    rua: pedidoData.enderecoEntrega || '',
                                    bairro: pedidoData.bairro || '',
                                    referencia: pedidoData.pontoReferencia || ''
                                }
                            },
                            clienteNome: pedidoData.nomeCliente || 'Cliente',
                            clienteTelefone: pedidoData.telefoneCliente || '',
                            totalFinal: pedidoData.total || 0,
                            status: 'recebido',
                            source: 'painel',
                            tipo: 'delivery',
                            createdAt: serverTimestamp(),
                            dataPedido: serverTimestamp()
                        });
                        toast.success('✅ Pedido delivery adicionado com sucesso!');
                    } catch (error) {
                        console.error('Erro ao adicionar pedido manualmente:', error);
                        toast.error('Erro ao salvar o pedido. Tente novamente.');
                    }
                }}
            />
        </div>
    );
}

export default withEstablishmentAuth(Painel);
