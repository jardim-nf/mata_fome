import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint, IoWarning } from 'react-icons/io5';

const TERMOS_BEBIDA = [
    'bebida', 'refrigerante', 'suco', 'cerveja', 'agua', 'água', 
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'garrafa', 'h2oh', 'coca', 'guarana'
];

const ComandaParaImpressao = ({ pedido: pedidoProp }) => {
    const params = useParams();
    const idUrl = params.id || params.pedidoId;
    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();
    
    const modoImpressao = searchParams.get('modo'); 
    const estabIdUrl = searchParams.get('estabId');

    const [pedidoState, setPedidoState] = useState(null);
    const [loading, setLoading] = useState(!pedidoProp);
    const [erro, setErro] = useState('');

    const pedido = pedidoProp || pedidoState;

    useEffect(() => {
        if (pedidoProp) { setLoading(false); return; }

        if (!idUrl) { setLoading(false); setErro("ID não fornecido."); return; }
        if (authLoading) return;

        const buscarPedido = async () => {
            setLoading(true);
            setErro('');
            try {
                let docSnap, encontrou = false, dados = null;
                const refGlobal = doc(db, 'pedidos', idUrl);
                docSnap = await getDoc(refGlobal);
                
                if (docSnap.exists()) {
                    dados = { id: docSnap.id, ...docSnap.data() };
                    encontrou = true;
                } else {
                    const lojaId = estabIdUrl || primeiroEstabelecimento;
                    if (lojaId) {
                        const refLoja = doc(db, 'estabelecimentos', lojaId, 'pedidos', idUrl);
                        docSnap = await getDoc(refLoja);
                        if (docSnap.exists()) {
                            dados = { id: docSnap.id, ...docSnap.data() };
                            encontrou = true;
                        }
                    }
                }

                if (encontrou) setPedidoState(dados);
                else {
                    const q = query(collectionGroup(db, 'pedidos'), where('id', '==', idUrl));
                    const querySnap = await getDocs(q);
                    if (!querySnap.empty) setPedidoState({ id: querySnap.docs[0].id, ...querySnap.docs[0].data() });
                    else throw new Error("Pedido não encontrado.");
                }
            } catch (error) { console.error("Erro:", error); setErro(error.message); } 
            finally { setLoading(false); }
        };
        buscarPedido();
    }, [idUrl, authLoading, primeiroEstabelecimento, estabIdUrl, pedidoProp]);

    useEffect(() => {
        if (!pedidoProp && pedido && !loading && !erro) {
            document.title = `PEDIDO ${pedido.senha || pedido.id.slice(0,4)}`;
            // Aumentei o tempo para garantir que o navegador renderize antes de imprimir
            const timer = setTimeout(() => { window.print(); }, 800);
            return () => clearTimeout(timer);
        }
    }, [pedido, loading, erro, pedidoProp]);

    const itensAgrupados = useMemo(() => {
        if (!pedido || !pedido.itens) return {};
        let itensParaProcessar = pedido.itens;
        if (modoImpressao === 'cozinha') {
            itensParaProcessar = itensParaProcessar.filter(item => {
                const nome = (item.nome || item.produto?.nome || '').toLowerCase();
                const categoria = (item.categoria || item.produto?.categoria || '').toLowerCase();
                const textoCompleto = `${nome} ${categoria}`;
                return !TERMOS_BEBIDA.some(termo => textoCompleto.includes(termo));
            });
        }
        return itensParaProcessar.reduce((acc, item) => {
            const nomePessoa = item.cliente || item.clienteNome || item.destinatario || 'Geral';
            if (!acc[nomePessoa]) acc[nomePessoa] = [];
            acc[nomePessoa].push(item);
            return acc;
        }, {});
    }, [pedido, modoImpressao]);

    if (loading) return <div className="flex items-center justify-center h-screen font-bold text-xl">Carregando...</div>;
    if (erro && !pedidoProp) return <div className="flex items-center justify-center h-screen font-bold text-red-600">{erro}</div>;
    if (!pedido) return null;

    const enderecoFinal = pedido.endereco || pedido.cliente?.endereco || null;
    const nomeClientePrincipal = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const telefoneCliente = pedido.telefone || pedido.cliente?.telefone || null;
    const temItens = Object.keys(itensAgrupados).length > 0;
    const dataPedido = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : (pedido.dataPedido?.toDate ? pedido.dataPedido.toDate() : new Date());
    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;

    return (
        // 🔥 CORREÇÃO: h-auto em vez de min-h-screen, text-black forçado e padding removido
        <div className="bg-white text-black font-mono text-xs leading-tight p-2 w-full h-auto" style={{ maxWidth: '80mm', margin: '0 auto' }}>
            <button onClick={() => window.print()} className="print:hidden fixed top-2 right-2 bg-gray-200 p-2 rounded-full"><IoPrint size={20}/></button>

            <div className="text-center border-b-2 border-black pb-2 mb-2">
                <h1 className="text-xl font-black uppercase">{pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}</h1>
                <p className="text-[10px] mt-1 font-bold">PEDIDO #{pedido.senha || pedido.id?.slice(-4).toUpperCase()}</p>
                <p className="text-[10px]">{dataPedido.toLocaleString('pt-BR')}</p>
                {modoImpressao === 'cozinha' && <div className="mt-1 bg-black text-white font-black uppercase text-sm py-1 print-color-adjust">** COZINHA **</div>}
            </div>

            <div className="mb-3 border-b-2 border-dashed border-black pb-2">
                <p className="font-black text-sm uppercase mb-1">{nomeClientePrincipal}</p>
                {telefoneCliente && <p className="text-xs font-bold mb-1">Tel: {telefoneCliente}</p>}
                {enderecoFinal ? (
                    <div className="border border-black p-1 mt-1 bg-gray-100 print-bg-gray">
                        <p className="font-bold text-xs uppercase">ENTREGA:</p>
                        <p className="font-bold text-xs">{enderecoFinal.rua}, {enderecoFinal.numero}</p>
                        <p className="text-xs">{enderecoFinal.bairro}</p>
                        {enderecoFinal.complemento && <p className="text-xs italic">({enderecoFinal.complemento})</p>}
                    </div>
                ) : (!pedido.mesaNumero && <div className="mt-1 border border-black p-1 text-center font-black text-xs bg-gray-100 print-bg-gray">RETIRADA NO BALCÃO</div>)}
            </div>

            <div className="mb-2">
                {!temItens ? <div className="text-center py-4 border border-black p-2">Sem itens.</div> : 
                    Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                        <div key={nomePessoa} className="mb-2">
                            {pedido.mesaNumero && nomePessoa !== 'Geral' && <div className="font-black px-1 text-[20px] uppercase mb-1 print-color-adjust">👤 {nomePessoa}</div>}
                            {itens.map((item, index) => (
                                <div key={index} className="mb-3 border-b border-dotted border-gray-400 pb-2 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <span className="font-black text-sm flex-1 pr-2">{item.quantidade}x {item.nome || item.produto?.nome}</span>
                                        {modoImpressao !== 'cozinha' && <span className="font-bold whitespace-nowrap">{formatMoney((item.precoFinal || item.preco) * item.quantidade)}</span>}
                                    </div>
                                    {item.variacaoSelecionada && <div className="pl-3 text-xs font-bold mt-0.5">Opção: {item.variacaoSelecionada.nome}</div>}
                                    {item.adicionais?.map((adic, idx) => <div key={idx} className="pl-2 mt-0.5 flex items-center text-xs font-black"><span className="mr-1">+</span><span>{adic.quantidade || 1}x {adic.nome}</span></div>)}
                                    {item.observacao && <div className={`mt-1 ml-2 text-xs uppercase font-bold p-0.5 ${modoImpressao === 'cozinha' ? 'bg-black text-white inline-block print-color-adjust' : 'text-black'}`}>OBS: {item.observacao}</div>}
                                </div>
                            ))}
                        </div>
                    ))
                }
            </div>

            {modoImpressao !== 'cozinha' && (
                <div className="border-t-2 border-black pt-2 mt-2">
                    <div className="flex justify-between text-xs font-bold"><span>Subtotal:</span><span>{formatMoney(pedido.totalItens || (pedido.totalFinal - (pedido.taxaEntrega || 0)))}</span></div>
                    {Number(pedido.taxaEntrega) > 0 && <div className="flex justify-between text-xs"><span>Taxa de Entrega:</span><span>{formatMoney(pedido.taxaEntrega)}</span></div>}
                    {Number(pedido.desconto) > 0 && <div className="flex justify-between text-xs"><span>Desconto:</span><span>- {formatMoney(pedido.desconto)}</span></div>}
                    <div className="flex justify-between text-lg font-black mt-1 border-t border-dotted border-black pt-1"><span>TOTAL:</span><span>{formatMoney(pedido.totalFinal || pedido.total)}</span></div>
                    <div className="mt-3 border border-black p-1 text-center">
                        <p className="font-bold text-xs uppercase">PAGAMENTO:</p>
                        <p className="font-black text-sm uppercase">{pedido.metodoPagamento || pedido.formaPagamento || 'A Combinar'}</p>
                        {pedido.trocoPara && <p className="text-xs font-bold mt-0.5">Troco para: {formatMoney(pedido.trocoPara)}</p>}
                    </div>
                </div>
            )}
            
            <div className="text-center mt-6 text-[10px] font-bold">*** FIM DO PEDIDO ***</div>
            
            {/* CSS HARDCORE PARA IMPRESSÃO */}
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 0; background-color: white !important; }
                    .print\\:hidden { display: none !important; }
                    
                    /* Forçar contraste máximo */
                    * { 
                        color: #000 !important; 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                    }
                    
                    /* Fundos cinzas para destaque */
                    .print-bg-gray {
                        background-color: #f3f4f6 !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ComandaParaImpressao;