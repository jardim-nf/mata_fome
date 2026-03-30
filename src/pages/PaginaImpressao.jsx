import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Filtro de itens de cozinha (mesma lógica do Painel.jsx) ---
const isItemCozinha = (item) => {
    try {
        if (!item || typeof item !== 'object') return false;
        const nome = String(item.nome || item.name || item.produto?.nome || '').toLowerCase();
        // 🔥 Verifica tanto 'categoria' quanto 'categoriaId' (campo salvo pelo delivery)
        const categoria = String(item.categoria || item.categoriaId || item.produto?.categoria || '').toLowerCase();
        const textoCompleto = `${nome} ${categoria}`;
        if (categoria.includes('combo') || nome.includes('combo')) return true;
        const categoriasBloqueadas = ['bebida', 'bomboniere', 'bar', 'sobremesa', 'doces', 'doce'];
        if (categoriasBloqueadas.some(cat => categoria.includes(cat))) return false;
        const palavrasBloqueadas = ['refrigerante', 'suco', 'cerveja', 'long neck', 'drink', 'vinho', 'coca', 'guarana', 'pepsi', 'sprite', 'h2oh', 'agua mineral', 'água mineral', 'sorvete', 'bala ', 'chiclete', 'chocolate', 'pirulito', 'halls', 'mentos'];
        if (palavrasBloqueadas.some(p => textoCompleto.includes(p))) return false;
        return true;
    } catch { return true; }
};

// --- LAYOUT SALÃO (Mesa) ---
const LayoutSalao = ({ pedido, estabelecimento, setor }) => {
    // 💡 SOLUÇÃO: Puxa de 'itens', 'carrinho' ou 'produtos'
    const todosItens = pedido.itens || pedido.carrinho || pedido.produtos || [];
    // 🔥 Se setor=cozinha, filtra bebidas/bomboniere
    const listaItens = setor === 'cozinha' ? todosItens.filter(isItemCozinha) : todosItens;

    // Agrupa itens por pessoa
    const itensPorPessoa = useMemo(() => {
        if (listaItens.length === 0) return {};
        return listaItens.reduce((acc, item) => {
            const nome = item.clienteNome || item.cliente || 'Mesa';
            if (!acc[nome]) acc[nome] = [];
            acc[nome].push(item);
            return acc;
        }, {});
    }, [pedido, listaItens]);

    // 🔥 CÁLCULO DE SEGURANÇA: Soma os itens na hora caso o total do banco venha zerado
    const totalCalculado = useMemo(() => {
        return listaItens.reduce((acc, item) => {
            const qtd = item.quantidade || item.quantity || item.qtd || 1;
            const preco = Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || item.produto?.preco || 0);
            return acc + (preco * qtd);
        }, 0);
    }, [listaItens]);

    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;

    return (
        <div className="font-mono text-xs text-black w-full max-w-[80mm] mx-auto p-2 bg-white">
            
            {/* Cabeçalho Limpo */}
            <div className="text-center border-b border-black pb-2 mb-2">
                <h1 className="font-bold text-sm uppercase">{estabelecimento?.nome || 'RESTAURANTE'}</h1>
                
                {/* MESA EM DESTAQUE */}
                <div className="text-xl font-black mt-1 border-2 border-black inline-block px-3 rounded">
                    MESA {pedido.mesaNumero || pedido.mesa || pedido.numero}
                </div>
                
                <p className="text-[10px] mt-1">
                    {pedido.createdAt?.toDate 
                        ? format(pedido.createdAt.toDate(), "dd/MM/yyyy HH:mm", { locale: ptBR }) 
                        : new Date().toLocaleString()}
                </p>
                <p className="text-[10px]">Senha: {pedido.senha || pedido.id?.slice(0,4)}</p>
                {setor === 'cozinha' && (
                    <div className="mt-1 border-2 border-black font-black uppercase text-sm py-1">
                        ** COZINHA **
                    </div>
                )}
            </div>

            {/* Aviso se vazio */}
            {listaItens.length === 0 && (
                <div className="text-center font-bold py-2 border-b border-black">Nenhum item lançado.</div>
            )}

            {/* Lista Agrupada */}
            <div>
                {Object.entries(itensPorPessoa).map(([nomeCliente, itens]) => (
                    <div key={nomeCliente} className="mb-2">
                        {nomeCliente !== 'Mesa' && (
                            <div className="font-black text-sm border-b border-dotted border-black mb-1 mt-2 pb-1 uppercase">
                                👤 {nomeCliente}
                            </div>
                        )}

                        {itens.map((item, idx) => {
                            // 🔥 CORREÇÃO: Lê inglês e português para nunca mais dar erro
                            const nomeProduto = item.nome || item.name || item.produto?.nome || 'Item sem nome';
                            const qtdProduto = item.quantidade || item.quantity || item.qtd || 1;
                            const valor = Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || item.produto?.preco || 0);

                            return (
                                <div key={idx} className="mb-2 border-b border-gray-200 pb-1">
                                    <div className="flex justify-between items-start font-bold text-sm">
                                        <span>{qtdProduto}x {nomeProduto}</span>
                                        <span>{formatMoney(valor * qtdProduto)}</span>
                                    </div>

                                    {/* Detalhes */}
                                    <div className="pl-2 text-[11px] font-normal">
                                        {(item.variacaoSelecionada || item.variacao) && (
                                            <div className="italic">- {item.variacaoSelecionada?.nome || item.variacao?.nome}</div>
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
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Totais */}
            <div className="border-t border-black pt-2 mt-2 text-right">
                <div className="flex justify-between text-lg font-bold">
                    <span>TOTAL:</span>
                    {/* 🔥 CORREÇÃO: Se pedido.total for 0 ou falhar, usa o totalCalculado */}
                    <span>{formatMoney(pedido.total || pedido.totalFinal || totalCalculado)}</span>
                </div>
            </div>
            
            <div className="text-center text-[10px] mt-4 font-bold">*** NÃO É DOCUMENTO FISCAL ***</div>
        </div>
    );
};

// --- LAYOUT DELIVERY ---
const LayoutDelivery = ({ pedido, estabelecimento, modoImpressao, setor }) => {
    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;
    // 💡 SOLUÇÃO: Puxa de 'itens', 'carrinho' ou 'produtos'
    const todosItens = pedido.itens || pedido.carrinho || pedido.produtos || [];
    // 🔥 Se setor=cozinha, filtra bebidas/bomboniere
    const listaItens = setor === 'cozinha' ? todosItens.filter(isItemCozinha) : todosItens;
    
    // 🔥 CÁLCULO DE SEGURANÇA: Soma os itens na hora caso o total do banco venha zerado
    const totalCalculado = useMemo(() => {
        return listaItens.reduce((acc, item) => {
            const qtd = item.quantidade || item.quantity || item.qtd || 1;
            const preco = Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || item.produto?.preco || 0);
            return acc + (preco * qtd);
        }, 0);
    }, [listaItens]);

    return (
        <div className="font-mono text-xs text-black w-full max-w-[80mm] mx-auto p-2 bg-white">
            <div className="text-center border-b border-black pb-2 mb-2">
                <h1 className="font-bold text-sm uppercase">{estabelecimento?.nome || 'DELIVERY'}</h1>
                <p className="font-bold mt-1">PEDIDO #{pedido.numeroPedido || pedido.id?.slice(0,5)}</p>
                <p className="text-[10px]">{new Date().toLocaleString()}</p>
                
                {modoImpressao === 'cozinha' && (
                    <div className="mt-1 border-2 border-black font-black uppercase text-sm py-1">
                        ** COZINHA **
                    </div>
                )}
            </div>

            {/* Cliente */}
            <div className="mb-3 border-b border-black pb-2">
                <div className="font-bold text-sm uppercase">{pedido.cliente?.nome || pedido.nome || "Cliente"}</div>
                {(pedido.cliente?.telefone || pedido.telefone) && <div>Tel: {pedido.cliente?.telefone || pedido.telefone}</div>}
                
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
                {listaItens.length === 0 && <div className="text-center font-bold">Nenhum item listado.</div>}
                
                {listaItens.map((item, idx) => {
                    // 🔥 CORREÇÃO: Lê inglês e português para nunca mais dar erro
                    const nomeProduto = item.nome || item.name || item.produto?.nome || 'Item sem nome';
                    const qtdProduto = item.quantidade || item.quantity || item.qtd || 1;
                    const valor = Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || item.produto?.preco || 0);

                    return (
                        <div key={idx} className="mb-2 border-b border-dashed border-gray-300 pb-1">
                            <div className="flex justify-between items-start font-bold">
                                <span>{qtdProduto}x {nomeProduto}</span>
                                <span>{formatMoney(valor * qtdProduto)}</span>
                            </div>
                            <div className="pl-2 text-[10px] font-normal">
                                {(item.variacao || item.variacaoSelecionada) && (
                                    <div className="italic">- {item.variacao?.nome || item.variacaoSelecionada?.nome}</div>
                                )}
                                
                                {((item.adicionaisSelecionados && item.adicionaisSelecionados.length > 0) ? item.adicionaisSelecionados : (item.adicionais || [])).map((adc, i) => (
                                    <div key={i}>+ {adc.nome}</div>
                                ))}

                                {item.observacao && <div className="font-bold uppercase">** {item.observacao}</div>}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Totais */}
            <div className="border-t border-black pt-2 space-y-1 text-right">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatMoney(pedido.totalItens || pedido.subtotal || totalCalculado)}</span></div>
                {Number(pedido.taxaEntrega) > 0 && <div className="flex justify-between"><span>Taxa:</span><span>{formatMoney(pedido.taxaEntrega)}</span></div>}
                {Number(pedido.desconto) > 0 && <div className="flex justify-between"><span>Desconto:</span><span>- {formatMoney(pedido.desconto)}</span></div>}
                
                {/* 🔥 CORREÇÃO: Total Blindado */}
                <div className="flex justify-between text-lg font-bold border-t border-dotted border-black pt-1 mt-1">
                    <span>TOTAL:</span>
                    <span>{formatMoney(pedido.totalFinal || pedido.total || (totalCalculado + Number(pedido.taxaEntrega || 0) - Number(pedido.desconto || 0)))}</span>
                </div>
            </div>

            {/* Pagamento */}
            <div className="mt-2 border border-black p-1 text-center font-bold">
                {pedido.metodoPagamento || pedido.formaPagamento || "A Combinar"}
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
    const modoImpressao = searchParams.get('modo') || searchParams.get('setor'); // 'cozinha' ou undefined
    const setor = searchParams.get('setor') || searchParams.get('modo'); // compatível com ambos
    const estabIdUrl = searchParams.get('estabId');

    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    const jaImprimiu = useRef(false);

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

                if (!jaImprimiu.current) {
                    jaImprimiu.current = true;
                    setTimeout(() => window.print(), 800);
                }

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
                    /* 🔥 DESTRÓI QUALQUER BLOQUEIO DE ALTURA OU OVERFLOW DO TAILWIND 🔥 */
                    html, body, #root { 
                        height: auto !important; 
                        min-height: auto !important;
                        width: 100% !important;
                        overflow: visible !important; 
                        position: static !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    
                    /* Força o papel da bobina térmica (80mm) */
                    @page { 
                        margin: 0; 
                        size: 80mm auto; 
                    }
                    
                    /* Esconde os botões */
                    .no-print { 
                        display: none !important; 
                    }
                    
                    /* Força tudo a ficar preto no branco para a impressora não falhar */
                    * { 
                        color: black !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    .border-gray-200, .border-gray-300 { 
                        border-color: black !important; 
                    }
                }
            `}</style>
            <button onClick={() => window.print()} className="no-print fixed top-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-50">
                <IoPrint size={24} />
            </button>

            {(origem === 'salao' || pedido.mesaNumero || pedido.isMesa) ? (
                <LayoutSalao pedido={pedido} estabelecimento={estabelecimento} setor={setor} />
            ) : (
                <LayoutDelivery pedido={pedido} estabelecimento={estabelecimento} modoImpressao={modoImpressao} setor={setor} />
            )}
        </div>
    );
};

export default PaginaImpressao;