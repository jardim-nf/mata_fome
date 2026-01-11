import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint, IoWarning } from 'react-icons/io5';

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

                // 1. Busca na Loja (Mesas)
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
            console.log("DADOS DO PEDIDO PARA DEBUG:", pedido); // <--- OLHE AQUI NO CONSOLE
            document.title = `Comanda ${pedido.mesaNumero || pedido.id.slice(0,4)}`;
            
            const handleAfterPrint = () => { window.close(); };
            window.addEventListener("afterprint", handleAfterPrint);

            const timer = setTimeout(() => { window.print(); }, 500); // Aumentei um pouco o tempo para garantir renderização
            
            return () => {
                clearTimeout(timer);
                window.removeEventListener("afterprint", handleAfterPrint);
            };
        }
    }, [pedido, loading, erro]);

    if (loading) return <div className="flex items-center justify-center h-screen font-bold text-xl">Abrindo Comanda...</div>;

    if (erro) return (
        <div className="flex flex-col items-center justify-center h-screen text-red-600 p-4 text-center">
            <IoWarning className="text-5xl mb-2"/>
            <h1 className="text-xl font-bold">{erro}</h1>
        </div>
    );

    if (!pedido) return null;

    // --- CORREÇÃO DO ENDEREÇO ---
    // Tenta pegar o endereço na raiz OU dentro do objeto cliente
    const enderecoFinal = pedido.endereco || pedido.cliente?.endereco || null;
    const nomeCliente = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const telefoneCliente = pedido.telefone || pedido.cliente?.telefone || null;

    return (
        <div className="bg-white min-h-screen p-1 text-black font-mono text-sm max-w-[80mm] mx-auto">
            <button onClick={() => window.print()} className="print:hidden fixed top-2 right-2 bg-gray-200 p-2 rounded-full">
                <IoPrint size={20} />
            </button>

            {/* CABEÇALHO */}
            <div className="text-center border-b-2 border-dashed border-black pb-2 mb-2">
                <h2 className="text-2xl font-black uppercase">
                    {pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}
                </h2>
                <p className="text-[10px]">
                    {new Date().toLocaleString('pt-BR')}
                </p>
                <p className="text-[10px] font-bold">#{pedido.id.slice(0, 6).toUpperCase()}</p>
            </div>

            {/* DADOS DO CLIENTE E ENDEREÇO */}
            <div className="mb-3 border-b border-dashed border-black pb-2">
                <p className="font-bold text-base uppercase truncate">
                    {nomeCliente}
                </p>
                
                {/* LÓGICA DE EXIBIÇÃO DO ENDEREÇO */}
                {enderecoFinal ? (
                    <div className="text-xs mt-1 border-t border-dotted border-gray-400 pt-1">
                        <p className="font-bold text-sm">
                            {enderecoFinal.rua}, {enderecoFinal.numero}
                        </p>
                        <p>
                            {enderecoFinal.bairro} 
                            {enderecoFinal.cidade ? ` - ${enderecoFinal.cidade}` : ''}
                        </p>
                        
                        {(enderecoFinal.complemento || enderecoFinal.referencia) && (
                            <p className="mt-1 font-bold">
                                {enderecoFinal.complemento ? `Comp: ${enderecoFinal.complemento} ` : ''}
                                {enderecoFinal.referencia ? `Ref: ${enderecoFinal.referencia}` : ''}
                            </p>
                        )}
                        
                        {telefoneCliente && (
                            <p className="mt-1 font-bold">Tel: {telefoneCliente}</p>
                        )}
                    </div>
                ) : (
                    !pedido.mesaNumero && (
                        <div className="mt-2 border-2 border-black p-1 text-center font-bold">
                            RETIRADA NO BALCÃO
                            {telefoneCliente && <div className="text-xs font-normal mt-1">{telefoneCliente}</div>}
                        </div>
                    )
                )}

                {pedido.motoboyNome && (
                    <p className="mt-2 font-bold text-xs bg-black text-white inline-block px-1">
                        ENTREGADOR: {pedido.motoboyNome.toUpperCase()}
                    </p>
                )}
            </div>

            {/* LISTA DE ITENS */}
            <div className="space-y-2 mb-4">
                {pedido.itens.map((item, index) => (
                    <div key={index} className="border-b border-dotted border-gray-400 pb-1">
                        <div className="flex justify-between font-bold text-sm">
                            <span>{item.quantidade}x {item.nome || item.produto?.nome}</span>
                            <span>{(Number(item.precoFinal || item.preco) * item.quantidade).toFixed(2)}</span>
                        </div>
                        
                        <div className="pl-4 text-xs">
                            {item.variacaoSelecionada && <p>- {item.variacaoSelecionada.nome}</p>}
                            {item.adicionais?.map((ad, i) => <p key={i}>+ {ad.nome}</p>)}
                            {item.observacao && <p className="font-bold mt-0.5 uppercase">OBS: {item.observacao}</p>}
                        </div>
                    </div>
                ))}
            </div>

            {/* TOTAIS */}
            <div className="border-t-2 border-black pt-2">
                {Number(pedido.taxaEntrega) > 0 && (
                    <div className="flex justify-between text-xs mb-1">
                        <span>Taxa de Entrega</span>
                        <span>{Number(pedido.taxaEntrega).toFixed(2)}</span>
                    </div>
                )}
                
                {pedido.desconto > 0 && (
                     <div className="flex justify-between text-xs mb-1">
                        <span>Desconto</span>
                        <span>-{Number(pedido.desconto).toFixed(2)}</span>
                    </div>
                )}

                <div className="flex justify-between text-xl font-black mt-2">
                    <span>TOTAL</span>
                    <span>R$ {Number(pedido.total || pedido.totalFinal).toFixed(2)}</span>
                </div>
                
                <div className="mt-2 text-xs font-bold uppercase text-center border border-black p-1">
                    PAGAMENTO: {pedido.formaPagamento || 'Dinheiro'} 
                    {pedido.trocoPara ? ` (Troco p/ ${pedido.trocoPara})` : ''}
                </div>
            </div>
            
            <div className="mt-4 text-center text-[10px]">--- FIM ---</div>

            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 5px; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default ComandaParaImpressao;