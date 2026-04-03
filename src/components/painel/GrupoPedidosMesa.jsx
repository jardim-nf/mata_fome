import React, { useMemo } from 'react';
import { IoTime, IoRestaurant } from "react-icons/io5";
import PedidoCard from "../PedidoCard";

const GrupoPedidosMesa = ({ 
    pedidos, 
    onUpdateStatus, 
    onExcluir, 
    newOrderIds, 
    estabelecimentoInfo, 
    onEmitirNfce, 
    onUpdateFormaPagamento 
}) => {
    const pedidosAgrupados = useMemo(() => {
        const grupos = {};
        pedidos.forEach(pedido => {
            if (!pedido || !pedido.id) return;
            
            // Filtra os itens reais que vão para a cozinha (IGNORANDO itensCozinha que pode vir como [] vazio por bug de sínc)
            const itensCozinhaReais = (pedido.itens || []).filter(it => {
                const c = (it.categoria || it.category || '').toLowerCase();
                return !['bebida', 'drink', 'suco', 'refrigerante', 'agua', 'cerveja'].some(t => c.includes(t));
            });
            
            // Se o pedido não tiver NENHUM item aplicável à cozinha, ignoramos
            if (itensCozinhaReais.length === 0) return;

            const chave = `${pedido.mesaNumero || '0'}-${pedido.loteHorario || 'principal'}`;
            
            if (!grupos[chave]) {
                grupos[chave] = {
                    mesaNumero: pedido.mesaNumero || 0,
                    loteHorario: pedido.loteHorario || '',
                    pedidos: [],
                    totalItens: 0,
                    status: pedido.status || 'recebido',
                    pessoas: pedido.pessoas || 1
                };
            }
            // Clona o pedido para não afetar o objeto original e injeta os itens filtrados
            const pedidoAjustado = { ...pedido, itensCozinha: itensCozinhaReais };
            
            grupos[chave].pedidos.push(pedidoAjustado);
            grupos[chave].totalItens += itensCozinhaReais.reduce((acc, it) => acc + (Number(it.quantidade) || 1), 0);
        });
        return Object.values(grupos);
    }, [pedidos]);

    if (pedidosAgrupados.length === 0) return (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-60">
            <IoRestaurant className="text-5xl mb-3 text-slate-300" />
            <p className="font-medium">Sem pedidos da cozinha</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {pedidosAgrupados.map((grupo, index) => (
                <div key={`grupo-${grupo.mesaNumero}-${index}`} className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                    <div className="bg-slate-50/50 p-3 border-b border-slate-200/60 border-dashed flex flex-wrap justify-between items-center gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-slate-800 text-base flex items-center gap-2">
                                <span className="w-7 h-7 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">
                                    <IoRestaurant />
                                </span>
                                Mesa {grupo.mesaNumero}
                            </span>
                            {grupo.loteHorario && (
                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full flex items-center gap-1 font-mono font-medium shrink-0">
                                    <IoTime className="w-3.5 h-3.5" /> {grupo.loteHorario}
                                </span>
                            )}
                        </div>
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200/60 shrink-0">
                            {grupo.totalItens} itens
                        </span>
                    </div>
                    <div className="p-3 space-y-3 bg-white">
                        {grupo.pedidos.map(pedido => (
                            <PedidoCard 
                                key={pedido.id} 
                                item={pedido} 
                                onUpdateStatus={onUpdateStatus} 
                                onExcluir={onExcluir} 
                                newOrderIds={newOrderIds} 
                                estabelecimentoInfo={estabelecimentoInfo} 
                                showMesaInfo={false} 
                                isAgrupado={true} 
                                motoboysDisponiveis={[]} 
                                onAtribuirMotoboy={null} 
                                onEmitirNfce={onEmitirNfce} 
                                onUpdateFormaPagamento={onUpdateFormaPagamento} 
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GrupoPedidosMesa;
