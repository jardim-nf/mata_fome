import React, { useMemo } from 'react';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PedidoCard from "../components/PedidoCard";
import NovoPedidoDeliveryModal from '../components/NovoPedidoDeliveryModal';
import PromptDialog from '../components/ui/PromptDialog';
import { IoTime, IoArrowBack, IoRestaurant, IoBicycle, IoCalendarOutline, IoNotificationsOutline, IoNotificationsOffOutline, IoPrint, IoReceiptOutline, IoWalletOutline, IoCartOutline, IoAddCircleOutline } from "react-icons/io5";

import { useNetworkOrdersPanel } from '../hooks/useNetworkOrdersPanel';
import GrupoPedidosMesa from '../components/painel/GrupoPedidosMesa';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { matchTermos, TERMOS_BEBIDA } from '../utils/categoriaUtils';

export default function PainelRede() {
    const navigate = useNavigate();
    const { loading: authLoading, estabelecimentosGerenciados, userData } = useAuth();

    const {
        dataSelecionada, setDataSelecionada,
        pedidos, loading, motoboys,
        estabelecimentosInfo,
        abaAtiva, setAbaAtiva,
        colunaMobile, setColunaMobile,
        notificationsEnabled, setNotificationsEnabled, userInteracted, setUserInteracted,
        modoImpressao, alternarModoImpressao,
        handleAtribuirMotoboy, handleCancelarPedido, handleUpdateStatusAndNotify, handleUpdateFormaPagamento,
        newOrderIds
    } = useNetworkOrdersPanel(estabelecimentosGerenciados, authLoading);

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
                if (abaAtiva === 'cozinha') {
                    const isMesa = p.source === 'salao' || p.tipo === 'mesa';
                    if (!isMesa) return false;
                    
                    if (modoImpressao === 'cozinha') {
                        const itensCozinhaReais = (p.itens || []).filter(it => {
                            const nome = String(it.nome || it.produto?.nome || '').toLowerCase();
                            const categoria = String(it.categoria || it.produto?.categoria || '').toLowerCase();
                            const textoCompleto = `${nome} ${categoria}`;
                            return !matchTermos(textoCompleto, TERMOS_BEBIDA);
                        });
                        return itensCozinhaReais.length > 0;
                    }
                    return true;
                }
                return p.source !== 'salao' && p.tipo !== 'mesa';
            });
            if (statusKey === 'finalizado') lista = [...lista].sort((a, b) => (b.dataFinalizado?.seconds || 0) - (a.dataFinalizado?.seconds || 0));
            resultado[statusKey] = lista;
        });
        return resultado;
    }, [pedidos, abaAtiva, colunasAtivas, modoImpressao]);

    const statsDoDia = useMemo(() => {
        const todosPedidos = colunasAtivas.flatMap(status => pedidosPorColuna[status] || []);
        const total = todosPedidos.reduce((acc, p) => acc + (p.totalFinal || p.total || 0), 0);
        return { quantidade: todosPedidos.length, faturamento: total };
    }, [pedidosPorColuna, colunasAtivas]);

    if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    const navTop = (
        <div className="bg-white border-b border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center px-4 py-2 gap-4">
                <div className="flex items-center gap-3">
                    <BackButton to="/master-dashboard" />
                    <div className="hidden md:flex flex-col"><span className="text-sm font-semibold text-gray-800">Monitor Unificado de Rede</span><span className="text-xs text-indigo-500 font-bold">Gerenciando {estabelecimentosGerenciados.length} lojas</span></div>
                    <div className="h-8 w-px bg-gray-300 hidden md:block"></div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { if (!userInteracted) setUserInteracted(true); setNotificationsEnabled(!notificationsEnabled); }} className={`p-2 rounded-full cursor-pointer transition-colors ${notificationsEnabled ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`} title={notificationsEnabled ? "Notificações ligadas" : "Ligar notificações sonoras"}>{notificationsEnabled ? <IoNotificationsOutline size={22} /> : <IoNotificationsOffOutline size={22} />}</button>
                        <button onClick={alternarModoImpressao} className={`p-2 rounded-full flex gap-1 items-center font-bold text-xs cursor-pointer transition-colors ${modoImpressao === 'tudo' ? 'text-blue-600 bg-blue-50' : modoImpressao === 'cozinha' ? 'text-orange-600 bg-orange-50' : 'text-gray-400 hover:bg-gray-100'}`} title={`Modo Auto-Print: ${modoImpressao.toUpperCase()}`}><IoPrint size={20} />{modoImpressao === 'tudo' ? 'ALL' : modoImpressao === 'cozinha' ? 'KDS' : 'OFF'}</button>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner w-full sm:w-auto">
                        <button onClick={() => setAbaAtiva('delivery')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${abaAtiva === 'delivery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><IoBicycle size={18} /> Delivery</button>
                        <button onClick={() => setAbaAtiva('cozinha')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${abaAtiva === 'cozinha' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><IoRestaurant size={18} /> Salão</button>
                    </div>
                    <div className="flex items-center bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm shrink-0"><IoCalendarOutline className="text-gray-400 mr-2" size={20} /><input type="date" value={dataSelecionada} onChange={(e) => setDataSelecionada(e.target.value)} className="bg-transparent text-sm font-bold text-gray-700 outline-none" /></div>
                </div>
            </div>
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-2 border-b border-indigo-100 flex justify-between items-center">
                <div className="flex items-center gap-6"><div className="flex items-center gap-2 text-sm"><IoTime className="text-indigo-500 flex-shrink-0" size={18}/><span className="text-gray-600">Mostrando Dia:</span><span className="font-bold text-indigo-700">{dataSelecionada.split('-').reverse().join('/')}</span></div><div className="hidden md:flex items-center gap-2 text-sm border-l border-indigo-200 pl-6"><IoCartOutline className="text-emerald-500" size={18}/><span className="text-gray-600">Total de Pedidos:</span><span className="font-black text-emerald-700">{statsDoDia.quantidade}</span></div><div className="hidden md:flex items-center gap-2 text-sm border-l border-indigo-200 pl-6"><IoWalletOutline className="text-purple-500" size={18}/><span className="text-gray-600">Faturamento da Rede:</span><span className="font-black text-purple-700">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(statsDoDia.faturamento)}</span></div></div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <div className="sticky top-0 z-40 shadow-sm">{navTop}</div>
            
            <div className="flex-1 overflow-hidden flex flex-col pt-4">
                <div className="flex flex-col sm:hidden px-4 mb-4">
                    <select value={colunaMobile} onChange={(e) => setColunaMobile(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-bold shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                        {colunasAtivas.map(status => <option key={status} value={status}>{STATUS_UI[status].title} ({pedidosPorColuna[status].length})</option>)}
                    </select>
                </div>
                <div className="flex-1 overflow-x-auto pb-4 px-2 sm:px-3">
                    <div className="grid gap-2 sm:gap-3 h-full" style={{ gridTemplateColumns: `repeat(${colunasAtivas.length}, minmax(200px, 1fr))` }}>
                        {colunasAtivas.map((statusKey) => {
                            const isMobileActive = colunaMobile === statusKey;
                            const isMobile = window.innerWidth < 640;
                            if (isMobile && !isMobileActive) return null;

                            let listaRender = pedidosPorColuna[statusKey];

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
                                                            onUpdateStatus={(pid, stat) => {
                                                                const p = listaRender.find(x => x.id === pid);
                                                                if(p) handleUpdateStatusAndNotify(pid, stat, p.estabelecimentoId);
                                                            }} 
                                                            isNewOrder={(id) => newOrderIds.has(id)}
                                                            onExcluir={(pid) => {
                                                                const p = listaRender.find(x => x.id === pid);
                                                                if(p) handleCancelarPedido(pid, p.estabelecimentoId);
                                                            }}
                                                            modoImpressao={modoImpressao}
                                                            mostrarLabelLoja={true}
                                                            estabelecimentosInfo={estabelecimentosInfo}
                                                        />
                                                    ) : (
                                                        listaRender.map(pedido => (
                                                            <div key={pedido.id} className="relative group/card transform transition-all duration-200 mb-2">
                                                                {/* Label de Loja */}
                                                                <div className="absolute -top-2 left-2 z-10">
                                                                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                                        {estabelecimentosInfo[pedido.estabelecimentoId]?.nome || 'Loja Desconhecida'}
                                                                    </span>
                                                                </div>
                                                                <div className="pt-2">
                                                                    <PedidoCard 
                                                                        item={pedido} 
                                                                        motoboysDisponiveis={motoboys.filter(m => m.estabelecimentoId === pedido.estabelecimentoId)} 
                                                                        onUpdateStatus={(pid, stat) => handleUpdateStatusAndNotify(pid, stat, pedido.estabelecimentoId)} 
                                                                        onAtribuirMotoboy={(pid, mid, mnome) => handleAtribuirMotoboy(pid, mid, mnome, pedido.estabelecimentoId)} 
                                                                        onEmitirNfce={() => {}} 
                                                                        newOrderIds={newOrderIds} 
                                                                        onExcluir={(pid) => handleCancelarPedido(pid, pedido.estabelecimentoId)} 
                                                                        onUpdateFormaPagamento={(pid, nf) => handleUpdateFormaPagamento(pid, nf, pedido.estabelecimentoId)} 
                                                                        estabelecimentoInfo={estabelecimentosInfo[pedido.estabelecimentoId]} 
                                                                    />
                                                                </div>
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
        </div>
    );
}
