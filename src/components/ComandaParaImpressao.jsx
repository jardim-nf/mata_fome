import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore'; // Removido collectionGroup
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint, IoWarning } from 'react-icons/io5';

// Lista de palavras para identificar o que é bebida (para o filtro de cozinha)
const TERMOS_BEBIDA = [
    'bebida', 'refrigerante', 'suco', 'cerveja', 'agua', 'água', 
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'garrafa', 'h2oh', 'coca', 'guarana'
];

const ComandaParaImpressao = ({ pedido: pedidoProp }) => {
    const params = useParams();
    const idUrl = params.id || params.pedidoId;
    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();
    
    const modoImpressao = searchParams.get('modo'); // 'cozinha' ou null
    const estabIdUrl = searchParams.get('estabId');

    const [pedidoState, setPedidoState] = useState(null);
    const [loading, setLoading] = useState(!pedidoProp);
    const [erro, setErro] = useState('');

    const pedido = pedidoProp || pedidoState;

    useEffect(() => {
        // Se o pedido veio via PROPS (Impressão direta do painel), não busca nada.
        if (pedidoProp) {
            setLoading(false);
            return;
        }

        if (!idUrl) {
            setLoading(false);
            setErro("ID não fornecido na URL.");
            return;
        }
        
        if (authLoading) return;

        const buscarPedido = async () => {
            setLoading(true);
            setErro('');
            try {
                let docSnap;
                let encontrou = false;
                let dadosPedido = null;

                // TENTATIVA 1: Busca na coleção global 'pedidos' (Delivery Comum)
                // É o local mais provável para pedidos de delivery
                const refGlobal = doc(db, 'pedidos', idUrl);
                docSnap = await getDoc(refGlobal);
                
                if (docSnap.exists()) {
                    dadosPedido = { id: docSnap.id, ...docSnap.data() };
                    encontrou = true;
                } 
                
                // TENTATIVA 2: Busca na subcoleção do estabelecimento (Mesas/Comanda)
                // Só executa se não achou no global e se temos o ID do estabelecimento
                if (!encontrou) {
                    const lojaId = estabIdUrl || primeiroEstabelecimento;
                    
                    if (lojaId) {
                        const refLoja = doc(db, 'estabelecimentos', lojaId, 'pedidos', idUrl);
                        docSnap = await getDoc(refLoja);
                        
                        if (docSnap.exists()) {
                            dadosPedido = { id: docSnap.id, ...docSnap.data() };
                            encontrou = true;
                        }
                    }
                }

                if (encontrou && dadosPedido) {
                    setPedidoState(dadosPedido);
                } else {
                    throw new Error("Pedido não encontrado em nenhuma coleção.");
                }

            } catch (error) {
                console.error("Erro ao buscar pedido:", error);
                setErro("Pedido não encontrado."); 
            } finally {
                setLoading(false);
            }
        };

        buscarPedido();
    }, [idUrl, authLoading, primeiroEstabelecimento, estabIdUrl, pedidoProp]);

    // Auto-Print (Apenas se for janela nova/URL)
    useEffect(() => {
        if (!pedidoProp && pedido && !loading && !erro) {
            const titulo = modoImpressao === 'cozinha' ? 'COZINHA' : 'CONFERÊNCIA';
            document.title = `${titulo} - ${pedido.mesaNumero || pedido.id.slice(0,4)}`;
            
            const timer = setTimeout(() => { window.print(); }, 800);
            return () => clearTimeout(timer);
        }
    }, [pedido, loading, erro, modoImpressao, pedidoProp]);

    // Lógica de Agrupamento
    const itensAgrupados = useMemo(() => {
        if (!pedido || !pedido.itens) return {};

        let itensParaProcessar = pedido.itens;

        // FILTRO COZINHA: Remove bebidas
        if (modoImpressao === 'cozinha') {
            itensParaProcessar = itensParaProcessar.filter(item => {
                const nome = (item.nome || item.produto?.nome || '').toLowerCase();
                const categoria = (item.categoria || item.produto?.categoria || '').toLowerCase();
                const textoCompleto = `${nome} ${categoria}`;
                const ehBebida = TERMOS_BEBIDA.some(termo => textoCompleto.includes(termo));
                return !ehBebida;
            });
        }

        return itensParaProcessar.reduce((acc, item) => {
            const nomePessoa = item.cliente || item.clienteNome || item.destinatario || 'Geral';
            if (!acc[nomePessoa]) acc[nomePessoa] = [];
            acc[nomePessoa].push(item);
            return acc;
        }, {});
    }, [pedido, modoImpressao]);

    if (loading) return <div className="flex items-center justify-center h-screen font-bold text-xl">Carregando Comanda...</div>;

    if (erro) return (
        <div className="flex flex-col items-center justify-center h-screen text-red-600 p-4 text-center">
            <IoWarning className="text-5xl mb-2"/>
            <h1 className="text-xl font-bold">{erro}</h1>
            <p className="text-sm text-gray-500 mt-2">ID: {idUrl}</p>
        </div>
    );

    if (!pedido) return null;

    const enderecoFinal = pedido.endereco || pedido.cliente?.endereco || null;
    const nomeClientePrincipal = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const telefoneCliente = pedido.telefone || pedido.cliente?.telefone || null;
    const temItens = Object.keys(itensAgrupados).length > 0;
    const dataPedido = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date();

    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;

    return (
        <div className="bg-white text-black font-mono text-xs leading-tight p-2" style={{ maxWidth: '80mm', margin: '0 auto' }}>
            
            <button onClick={() => window.print()} className="print:hidden fixed top-2 right-2 bg-gray-200 p-2 rounded-full z-50 hover:bg-gray-300">
                <IoPrint size={20} />
            </button>

            {/* --- CABEÇALHO --- */}
            <div className="text-center border-b-2 border-black pb-2 mb-2">
                <h1 className="text-xl font-black uppercase tracking-wide">
                    {pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}
                </h1>
                <p className="text-[10px] mt-1 font-bold">
                    PEDIDO #{pedido.senha || pedido.id?.slice(-4).toUpperCase()}
                </p>
                <p className="text-[10px]">
                    {dataPedido.toLocaleString('pt-BR')}
                </p>
                {modoImpressao === 'cozinha' && (
                    <div className="mt-1 bg-black text-white font-black uppercase text-sm py-1">
                        ** COZINHA **
                    </div>
                )}
            </div>

            {/* --- DADOS DO CLIENTE --- */}
            <div className="mb-3 border-b-2 border-dashed border-black pb-2">
                <p className="font-black text-sm uppercase mb-1">{nomeClientePrincipal}</p>
                {telefoneCliente && <p className="text-xs font-bold mb-1">Tel: {telefoneCliente}</p>}

                {enderecoFinal ? (
                    <div className="border border-black p-1 mt-1 bg-gray-100">
                        <p className="font-bold text-xs uppercase">ENTREGA:</p>
                        <p className="font-bold text-xs">{enderecoFinal.rua}, {enderecoFinal.numero}</p>
                        <p className="text-xs">{enderecoFinal.bairro}</p>
                        {enderecoFinal.complemento && <p className="text-xs italic">({enderecoFinal.complemento})</p>}
                    </div>
                ) : (
                    !pedido.mesaNumero && (
                        <div className="mt-1 border border-black p-1 text-center font-black text-xs bg-gray-100">
                            RETIRADA NO BALCÃO
                        </div>
                    )
                )}
            </div>

            {/* --- ITENS --- */}
            <div className="mb-2">
                {!temItens ? (
                    <div className="text-center py-4 font-bold border border-black p-2 bg-gray-100">
                        {modoImpressao === 'cozinha' ? 'SEM ITENS DE COZINHA' : 'Nenhum item.'}
                    </div>
                ) : (
                    Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                        <div key={nomePessoa} className="mb-2">
                            {pedido.mesaNumero && nomePessoa !== 'Geral' && (
                                <div className="font-black bg-black text-white px-1 text-[10px] uppercase mb-1">
                                    👤 {nomePessoa}
                                </div>
                            )}
                            {itens.map((item, index) => (
                                <div key={index} className="mb-3 border-b border-dotted border-gray-400 pb-2 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <span className="font-black text-sm flex-1 pr-2">
                                            {item.quantidade}x {item.nome || item.produto?.nome}
                                        </span>
                                        {modoImpressao !== 'cozinha' && (
                                            <span className="font-bold whitespace-nowrap">
                                                {formatMoney((item.precoFinal || item.preco) * item.quantidade)}
                                            </span>
                                        )}
                                    </div>
                                    {item.variacaoSelecionada && (
                                        <div className="pl-3 text-xs font-bold mt-0.5">Opção: {item.variacaoSelecionada.nome}</div>
                                    )}
                                    {item.adicionais && item.adicionais.length > 0 && (
                                        <div className="pl-2 mt-1 space-y-0.5">
                                            {item.adicionais.map((adic, idx) => (
                                                <div key={idx} className="flex items-center text-xs font-black">
                                                    <span className="mr-1">+</span>
                                                    <span>{adic.quantidade || 1}x {adic.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {item.observacao && (
                                        <div className={`mt-1 ml-2 text-xs uppercase font-bold p-0.5 ${modoImpressao === 'cozinha' ? 'bg-black text-white inline-block' : 'text-black'}`}>
                                            OBS: {item.observacao}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* --- TOTAIS --- */}
            {modoImpressao !== 'cozinha' && (
                <div className="border-t-2 border-black pt-2 mt-2">
                    <div className="flex justify-between text-xs font-bold">
                        <span>Subtotal:</span>
                        <span>{formatMoney(pedido.totalItens || (pedido.totalFinal - (pedido.taxaEntrega || 0)))}</span>
                    </div>
                    {Number(pedido.taxaEntrega) > 0 && (
                        <div className="flex justify-between text-xs"><span>Taxa de Entrega:</span><span>{formatMoney(pedido.taxaEntrega)}</span></div>
                    )}
                    {Number(pedido.desconto) > 0 && (
                        <div className="flex justify-between text-xs"><span>Desconto:</span><span>- {formatMoney(pedido.desconto)}</span></div>
                    )}
                    <div className="flex justify-between text-lg font-black mt-1 border-t border-dotted border-black pt-1">
                        <span>TOTAL:</span>
                        <span>{formatMoney(pedido.totalFinal || pedido.total)}</span>
                    </div>
                    <div className="mt-3 border border-black p-1 text-center">
                        <p className="font-bold text-xs uppercase">FORMA DE PAGAMENTO:</p>
                        <p className="font-black text-sm uppercase">{pedido.metodoPagamento || pedido.formaPagamento || 'A Combinar'}</p>
                        {pedido.trocoPara && <p className="text-xs font-bold mt-0.5">Troco para: {formatMoney(pedido.trocoPara)}</p>}
                    </div>
                </div>
            )}

            <div className="text-center mt-6 text-[10px] font-bold">*** FIM DO PEDIDO ***</div>

            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
                    .print\\:hidden { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default ComandaParaImpressao;