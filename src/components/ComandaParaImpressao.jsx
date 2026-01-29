import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint, IoWarning } from 'react-icons/io5';

// Lista de palavras para identificar o que é bebida
const TERMOS_BEBIDA = [
    'bebida', 'refrigerante', 'suco', 'cerveja', 'agua', 'água', 
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'garrafa', 'h2oh', 'coca', 'guarana'
];

const ComandaParaImpressao = () => {
    const params = useParams();
    const id = params.id || params.pedidoId;

    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();
    
    const [pedido, setPedido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    const origemUrl = searchParams.get('origem'); 
    const estabIdUrl = searchParams.get('estabId');

    useEffect(() => {
        if (!id) {
            setLoading(false);
            setErro("ID não fornecido.");
            return;
        }
        if (authLoading) return;

        const buscarPedido = async () => {
            setLoading(true);
            setErro('');

            try {
                let docSnap;
                let encontrou = false;

                // 1. Busca na Loja
                const lojaId = estabIdUrl || primeiroEstabelecimento;
                if (lojaId) {
                    const refLoja = doc(db, 'estabelecimentos', lojaId, 'pedidos', id);
                    docSnap = await getDoc(refLoja);
                    if (docSnap.exists()) {
                        setPedido({ id: docSnap.id, ...docSnap.data() });
                        encontrou = true;
                    }
                }

                // 2. Busca no Delivery Geral
                if (!encontrou) {
                    const refRaiz = doc(db, 'pedidos', id);
                    docSnap = await getDoc(refRaiz);
                    if (docSnap.exists()) {
                        setPedido({ id: docSnap.id, ...docSnap.data() });
                        encontrou = true;
                    }
                }

                // 3. Busca Global
                if (!encontrou) {
                    const q = query(collectionGroup(db, 'pedidos'), where('id', '==', id));
                    const querySnap = await getDocs(q);
                    if (!querySnap.empty) {
                        const dados = querySnap.docs[0].data();
                        setPedido({ id: querySnap.docs[0].id, ...dados });
                        encontrou = true;
                    }
                }

                if (!encontrou) throw new Error("Pedido não encontrado.");

            } catch (error) {
                console.error("Erro:", error);
                setErro(error.message);
            } finally {
                setLoading(false);
            }
        };

        buscarPedido();
    }, [id, authLoading, primeiroEstabelecimento, origemUrl, estabIdUrl]);

    useEffect(() => {
        if (pedido && !loading && !erro) {
            document.title = `Comanda ${pedido.mesaNumero || pedido.id.slice(0,4)}`;
            
            const handleAfterPrint = () => { window.close(); };
            window.addEventListener("afterprint", handleAfterPrint);

            const timer = setTimeout(() => { window.print(); }, 500);
            
            return () => {
                clearTimeout(timer);
                window.removeEventListener("afterprint", handleAfterPrint);
            };
        }
    }, [pedido, loading, erro]);

    const itensAgrupados = useMemo(() => {
        if (!pedido || !pedido.itens) return {};

        // --- FILTRO DE BEBIDAS ---
        // Filtra os itens removendo qualquer um que pareça ser bebida
        const itensFiltrados = pedido.itens.filter(item => {
            const nome = (item.nome || item.produto?.nome || '').toLowerCase();
            const categoria = (item.categoria || item.produto?.categoria || '').toLowerCase();
            const textoCompleto = `${nome} ${categoria}`;

            // Se encontrar algum termo de bebida, retorna FALSE (remove da lista)
            const ehBebida = TERMOS_BEBIDA.some(termo => textoCompleto.includes(termo));
            return !ehBebida;
        });

        // Se for delivery ou balcão (sem mesa), retorna lista direta filtrada
        if (!pedido.mesaNumero) return { 'Itens': itensFiltrados };

        // Se for mesa, agrupa por pessoa usando os itens filtrados
        return itensFiltrados.reduce((acc, item) => {
            const nomePessoa = item.cliente || item.clienteNome || item.destinatario || 'Geral';
            if (!acc[nomePessoa]) acc[nomePessoa] = [];
            acc[nomePessoa].push(item);
            return acc;
        }, {});
    }, [pedido]);

    if (loading) return <div className="flex items-center justify-center h-screen font-bold text-xl">Abrindo...</div>;

    if (erro) return (
        <div className="flex flex-col items-center justify-center h-screen text-red-600 p-4 text-center">
            <IoWarning className="text-5xl mb-2"/>
            <h1 className="text-xl font-bold">{erro}</h1>
        </div>
    );

    if (!pedido) return null;

    const enderecoFinal = pedido.endereco || pedido.cliente?.endereco || null;
    const nomeClientePrincipal = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const telefoneCliente = pedido.telefone || pedido.cliente?.telefone || null;

    // Verifica se sobrou algum item (se o pedido era só bebida, avisa)
    const temItensParaImprimir = Object.keys(itensAgrupados).length > 0 && 
                                 Object.values(itensAgrupados).some(lista => lista.length > 0);

    return (
        <div className="bg-white min-h-screen p-0 text-black font-mono text-xs max-w-[58mm] mx-auto leading-tight">
            <button onClick={() => window.print()} className="print:hidden fixed top-2 right-2 bg-gray-200 p-2 rounded-full">
                <IoPrint size={20} />
            </button>

            {/* CABEÇALHO */}
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                <h2 className="text-lg font-black uppercase">
                    {pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}
                </h2>
                <p className="text-[10px] uppercase font-bold">(SOMENTE COMIDA)</p>
                <p className="text-[10px]">
                    {new Date().toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] font-bold">#{pedido.id.slice(0, 6).toUpperCase()}</p>
            </div>

            {/* DADOS GERAIS */}
            <div className="mb-2 border-b border-dashed border-black pb-2">
                {!pedido.mesaNumero && (
                    <p className="font-bold text-sm uppercase truncate">
                        {nomeClientePrincipal}
                    </p>
                )}
                
                {enderecoFinal ? (
                    <div className="text-[10px] mt-1">
                        <p className="font-bold">
                            {enderecoFinal.rua}, {enderecoFinal.numero}
                        </p>
                        <p>
                            {enderecoFinal.bairro} 
                        </p>
                        {(enderecoFinal.complemento || enderecoFinal.referencia) && (
                            <p>
                                {enderecoFinal.complemento} {enderecoFinal.referencia}
                            </p>
                        )}
                    </div>
                ) : (
                    !pedido.mesaNumero && (
                        <div className="mt-1 border border-black p-1 text-center font-bold text-[10px]">
                            RETIRADA BALCÃO
                        </div>
                    )
                )}

                {pedido.motoboyNome && (
                    <p className="mt-1 font-bold text-[10px]">
                        MOTO: {pedido.motoboyNome.toUpperCase()}
                    </p>
                )}
            </div>

            {/* LISTA DE ITENS */}
            <div className="space-y-3 mb-2">
                {!temItensParaImprimir ? (
                    <div className="text-center py-4 font-bold">
                        Apenas bebidas neste pedido.
                    </div>
                ) : (
                    Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                        <div key={nomePessoa} className="border-b border-black pb-1">
                            {pedido.mesaNumero && (
                                <div className="font-black bg-gray-200 px-1 text-[10px] uppercase mb-1">
                                    👤 {nomePessoa}
                                </div>
                            )}

                            <div className="space-y-1">
                                {itens.map((item, index) => (
                                    <div key={index} className="border-b border-dotted border-gray-300 pb-1 last:border-0">
                                        <div className="flex justify-between items-start text-xs font-bold">
                                            <span className="mr-1 flex-1">
                                                {item.quantidade}x {item.nome || item.produto?.nome}
                                            </span>
                                            {/* Opcional: Se for para cozinha, talvez não queira mostrar preço. Se quiser esconder, remova este span */}
                                            <span className="whitespace-nowrap">
                                                {(Number(item.precoFinal || item.preco) * item.quantidade).toFixed(2)}
                                            </span>
                                        </div>
                                        
                                        <div className="pl-2 text-[10px] text-gray-600">
                                            {item.variacaoSelecionada && <p>- {item.variacaoSelecionada.nome}</p>}
                                            {item.adicionais?.map((ad, i) => <p key={i}>+ {ad.nome}</p>)}
                                            {item.observacao && <p className="font-bold text-black mt-0.5 uppercase">OBS: {item.observacao}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* TOTAIS */}
            <div className="border-t border-black pt-1">
                {/* Nota sobre o total */}
                <p className="text-[8px] text-center italic mb-1">*Total inclui itens de bebida não listados acima</p>

                {Number(pedido.taxaEntrega) > 0 && (
                    <div className="flex justify-between text-[10px]">
                        <span>Entrega</span>
                        <span>{Number(pedido.taxaEntrega).toFixed(2)}</span>
                    </div>
                )}
                
                {pedido.desconto > 0 && (
                     <div className="flex justify-between text-[10px]">
                        <span>Desconto</span>
                        <span>-{Number(pedido.desconto).toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between text-base font-black mt-1">
                    <span>TOTAL GERAL</span>
                    <span>R$ {Number(pedido.total || pedido.totalFinal).toFixed(2)}</span>
                </div>
                
                <div className="mt-2 text-[10px] font-bold uppercase text-center border border-black p-1">
                    PGTO: {pedido.formaPagamento || 'Dinheiro'} 
                    {pedido.trocoPara ? ` (Troco: ${pedido.trocoPara})` : ''}
                </div>
            </div>
            
            <div className="mt-4 text-center text-[10px]">.</div>

            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 0; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default ComandaParaImpressao;