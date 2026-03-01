import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- LAYOUT SALÃO (Mesa) ---
const LayoutSalao = ({ pedido, estabelecimento }) => {
    // Agrupa itens por pessoa
    const itensPorPessoa = useMemo(() => {
        if (!pedido.itens) return {};
        return pedido.itens.reduce((acc, item) => {
            const nome = item.clienteNome || item.cliente || 'Mesa';
            if (!acc[nome]) acc[nome] = [];
            acc[nome].push(item);
            return acc;
        }, {});
    }, [pedido.itens]);

    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;

    return (
        <div className="font-mono text-xs text-black w-full max-w-[80mm] mx-auto p-2 bg-white">
            
            {/* Cabeçalho Limpo */}
            <div className="text-center border-b border-black pb-2 mb-2">
                <h1 className="font-bold text-sm uppercase">{estabelecimento?.nome || 'RESTAURANTE'}</h1>
                
                {/* MESA EM DESTAQUE (SEM FUNDO PRETO) */}
                <div className="text-xl font-black mt-1 border-2 border-black inline-block px-3 rounded">
                    MESA {pedido.mesaNumero || pedido.mesa}
                </div>
                
                <p className="text-[10px] mt-1">
                    {pedido.createdAt?.toDate 
                        ? format(pedido.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) 
                        : new Date().toLocaleString()}
                </p>
                <p className="text-[10px]">Senha: {pedido.senha || pedido.id?.slice(0,4)}</p>
            </div>

            {/* Lista Agrupada */}
            <div>
                {Object.entries(itensPorPessoa).map(([nomeCliente, itens]) => (
                    <div key={nomeCliente} className="mb-2">
                        {/* 🔥 NOME SEM TARJA (Apenas Negrito) 🔥 */}
                        {nomeCliente !== 'Mesa' && (
                            <div className="font-black text-sm border-b border-dotted border-black mb-1 mt-2 pb-1 uppercase">
                                👤 {nomeCliente}
                            </div>
                        )}

                        {itens.map((item, idx) => (
                            <div key={idx} className="mb-2 border-b border-gray-200 pb-1">
                                <div className="flex justify-between items-start font-bold text-sm">
                                    <span>{item.quantidade}x {item.nome}</span>
                                    <span>{formatMoney((item.precoFinal || item.preco) * item.quantidade)}</span>
                                </div>

                                {/* Detalhes */}
                                <div className="pl-2 text-[11px] font-normal">
                                    {item.variacaoSelecionada && (
                                        <div className="italic">- {item.variacaoSelecionada.nome}</div>
                                    )}

                                    {/* Adicionais Selecionados */}
                                    {((item.adicionaisSelecionados && item.adicionaisSelecionados.length > 0) ? item.adicionaisSelecionados : (item.adicionais || [])).map((adc, i) => (
                                        <div key={i}>+ {adc.nome}</div>
                                    ))}

                                    {item.observacao && (
                                        <div className="font-bold mt-0.5 uppercase">** {item.observacao}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Totais */}
            <div className="border-t border-black pt-2 mt-2 text-right">
                <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL:</span>
                    <span>{formatMoney(pedido.total || pedido.totalFinal)}</span>
                </div>
            </div>
            
            <div className="text-center text-[10px] mt-4 font-bold">*** NÃO É DOCUMENTO FISCAL ***</div>
        </div>
    );
};

// --- LAYOUT DELIVERY ---
const LayoutDelivery = ({ pedido, estabelecimento, modoImpressao }) => {
    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;
    
    return (
        <div className="font-mono text-xs text-black w-full max-w-[80mm] mx-auto p-2 bg-white">
            <div className="text-center border-b border-black pb-2 mb-2">
                <h1 className="font-bold text-sm uppercase">{estabelecimento?.nome || 'DELIVERY'}</h1>
                <p className="font-bold mt-1">PEDIDO #{pedido.numeroPedido || pedido.id?.slice(0,5)}</p>
                <p className="text-[10px]">{new Date().toLocaleString()}</p>
                
                {/* 🔥 TARJA DE COZINHA REMOVIDA (Agora é borda) 🔥 */}
                {modoImpressao === 'cozinha' && (
                    <div className="mt-1 border-2 border-black font-black uppercase text-sm py-1">
                        ** COZINHA **
                    </div>
                )}
            </div>

            {/* Cliente */}
            <div className="mb-3 border-b border-black pb-2">
                <div className="font-bold text-sm uppercase">{pedido.cliente?.nome || "Cliente"}</div>
                {pedido.cliente?.telefone && <div>Tel: {pedido.cliente.telefone}</div>}
                
                {pedido.endereco || pedido.cliente?.endereco ? (
                    <div className="mt-1 border border-black p-1 rounded font-bold bg-white">
                        {(pedido.endereco || pedido.cliente.endereco).rua}, {(pedido.endereco || pedido.cliente.endereco).numero}
                        <div>{(pedido.endereco || pedido.cliente.endereco).bairro}</div>
                        {(pedido.endereco || pedido.cliente.endereco).complemento && <div>Obs: {(pedido.endereco || pedido.cliente.endereco).complemento}</div>}
                    </div>
                ) : (
                    <div className="mt-1 font-bold border border-black px-1 inline-block">RETIRADA</div>
                )}
            </div>

            {/* Itens */}
            <div className="mb-2">
                {pedido.itens?.map((item, idx) => (
                    <div key={idx} className="mb-2 border-b border-dashed border-gray-300 pb-1">
                        <div className="flex justify-between items-start font-bold">
                            <span>{item.quantidade}x {item.nome}</span>
                            <span>{formatMoney((item.preco || 0) * item.quantidade)}</span>
                        </div>
                        <div className="pl-2 text-[10px] font-normal">
                            {(item.variacao || item.variacaoSelecionada) && (
                                <div className="italic">- {item.variacao?.nome || item.variacaoSelecionada?.nome}</div>
                            )}
                            
                            {/* Adicionais Selecionados */}
                            {((item.adicionaisSelecionados && item.adicionaisSelecionados.length > 0) ? item.adicionaisSelecionados : (item.adicionais || [])).map((adc, i) => (
                                <div key={i}>+ {adc.nome}</div>
                            ))}

                            {item.observacao && <div className="font-bold uppercase">** {item.observacao}</div>}
                        </div>
                    </div>
                ))}
            </div>

            {/* Totais */}
            <div className="border-t border-black pt-2 space-y-1 text-right">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatMoney(pedido.totalItens || pedido.subtotal)}</span></div>
                {Number(pedido.taxaEntrega) > 0 && <div className="flex justify-between"><span>Taxa:</span><span>{formatMoney(pedido.taxaEntrega)}</span></div>}
                {Number(pedido.desconto) > 0 && <div className="flex justify-between"><span>Desconto:</span><span>- {formatMoney(pedido.desconto)}</span></div>}
                <div className="flex justify-between text-lg font-bold border-t border-dotted border-black pt-1 mt-1"><span>TOTAL:</span><span>{formatMoney(pedido.totalFinal || pedido.total)}</span></div>
            </div>

            {/* Pagamento */}
            <div className="mt-2 border border-black p-1 text-center font-bold">
                {pedido.metodoPagamento || "A Combinar"}
                {pedido.trocoPara && <div>Troco para: {formatMoney(pedido.trocoPara)}</div>}
            </div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---
const PaginaImpressao = () => {
    const params = useParams();
    const idUrl = params.id || params.pedidoId;
    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();
    
    // Pega parâmetros da URL
    const origem = searchParams.get('origem'); // 'salao' ou 'delivery'
    const modoImpressao = searchParams.get('modo'); // 'cozinha' ou undefined
    const estabIdUrl = searchParams.get('estabId');

    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    useEffect(() => {
        if (!idUrl || authLoading) return;

        const carregarDados = async () => {
            setLoading(true);
            try {
                // 1. Busca o Pedido
                let pedidoData = null;
                let docSnap = await getDoc(doc(db, 'pedidos', idUrl));
                
                if (docSnap.exists()) {
                    pedidoData = { id: docSnap.id, ...docSnap.data() };
                } else {
                    const q = query(collectionGroup(db, 'pedidos'), where('id', '==', idUrl));
                    const qs = await getDocs(q);
                    if (!qs.empty) {
                        pedidoData = { id: qs.docs[0].id, ...qs.docs[0].data() };
                    } else {
                        // Tenta buscar Mesa Ativa
                        const estabId = estabIdUrl || primeiroEstabelecimento;
                        if (estabId) {
                             const mesaSnap = await getDoc(doc(db, 'estabelecimentos', estabId, 'mesas', idUrl));
                             if (mesaSnap.exists()) {
                                 pedidoData = { id: mesaSnap.id, ...mesaSnap.data(), isMesa: true };
                             }
                        }
                    }
                }

                if (!pedidoData) throw new Error("Pedido não encontrado.");
                setPedido(pedidoData);

                // 2. Busca Estabelecimento
                const idEstab = pedidoData.estabelecimentoId || estabIdUrl || primeiroEstabelecimento;
                if (idEstab) {
                    const estabSnap = await getDoc(doc(db, 'estabelecimentos', idEstab));
                    if (estabSnap.exists()) setEstabelecimento(estabSnap.data());
                }

                // Auto-Print
                setTimeout(() => window.print(), 800);

            } catch (err) {
                console.error(err);
                setErro(err.message);
            } finally {
                setLoading(false);
            }
        };

        carregarDados();
    }, [idUrl, authLoading, estabIdUrl, primeiroEstabelecimento]);

    if (loading) return <div className="flex h-screen items-center justify-center font-bold text-xl">Carregando impressão...</div>;
    if (erro) return <div className="flex h-screen items-center justify-center font-bold text-red-600">{erro}</div>;
    if (!pedido) return null;

    return (
        <div className="bg-white min-h-screen">
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 0; background: white; }
                    .no-print { display: none !important; }
                    /* Garante texto preto puro */
                    * { color: black !important; }
                }
            `}</style>

            <button onClick={() => window.print()} className="no-print fixed top-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-50">
                <IoPrint size={24} />
            </button>

            {/* SELETOR DE LAYOUT */}
            {(origem === 'salao' || pedido.mesaNumero || pedido.isMesa) ? (
                <LayoutSalao pedido={pedido} estabelecimento={estabelecimento} />
            ) : (
                <LayoutDelivery pedido={pedido} estabelecimento={estabelecimento} modoImpressao={modoImpressao} />
            )}
        </div>
    );
};

export default PaginaImpressao;