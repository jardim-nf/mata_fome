import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint } from 'react-icons/io5';

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

    // --- 1. BUSCA O PEDIDO ---
    useEffect(() => {
        if (pedidoProp) { setLoading(false); return; }
        if (!idUrl) { setLoading(false); setErro("ID não fornecido."); return; }
        if (authLoading) return;

        const buscarPedido = async () => {
            setLoading(true);
            setErro('');
            console.log(`🖨️ [Comanda] Buscando pedido ${idUrl}...`);

            try {
                let encontrou = false, dados = null;
                const refGlobal = doc(db, 'pedidos', idUrl);
                let docSnap = await getDoc(refGlobal);
                
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

                if (!encontrou) {
                    const q = query(collectionGroup(db, 'pedidos'), where('id', '==', idUrl));
                    const querySnap = await getDocs(q);
                    if (!querySnap.empty) {
                        dados = { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
                        encontrou = true;
                    }
                }

                if (encontrou && dados) {
                    setPedidoState(dados);
                } else {
                    throw new Error("Pedido não encontrado.");
                }
            } catch (error) { 
                console.error("🖨️ [Comanda] Erro:", error); 
                setErro(error.message); 
            } 
            finally { setLoading(false); }
        };
        buscarPedido();
    }, [idUrl, authLoading, primeiroEstabelecimento, estabIdUrl, pedidoProp]);

    // --- 2. DISPARA A IMPRESSÃO ---
    useEffect(() => {
        if (!pedidoProp && pedido && !loading && !erro) {
            document.title = `PEDIDO ${pedido.senha || pedido.id.slice(0,4)}`;
            
            const timer = setTimeout(() => { 
                window.focus();
                
                // 🔥 A CORREÇÃO: O navegador avisa-nos quando a impressão termina, 
                // e só depois disso é que fechamos a janela em segurança.
                window.onafterprint = () => {
                    window.close();
                };

                window.print(); 
            }, 1200); // Tempo ligeiramente maior para garantir que o React desenha tudo
            
            return () => clearTimeout(timer);
        }
    }, [pedido, loading, erro, pedidoProp]);

    // --- 3. CÁLCULOS FINANCEIROS (BLINDAGEM) ---
    const totais = useMemo(() => {
        if (!pedido) return { consumo: 0, jaPago: 0, restante: 0, taxa: 0, desconto: 0, totalGeral: 0 };

        const itens = pedido.itens || [];
        
        // A) Total Consumo (Soma apenas itens positivos)
        const consumo = itens.reduce((acc, item) => {
            return item.preco > 0 ? acc + (item.preco * (item.quantidade || 1)) : acc;
        }, 0);

        // B) Taxas e Descontos
        const taxa = Number(pedido.taxaEntrega) || 0;
        const desconto = Number(pedido.desconto) || 0;
        
        // C) Total Geral da Conta (Antes de abater pagamentos)
        const totalGeral = consumo + taxa - desconto;

        // D) Já Pago (Histórico de parciais)
        const pagamentos = pedido.pagamentosParciais || [];
        const jaPago = pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

        // E) Restante Final
        const restante = Math.max(0, totalGeral - jaPago);

        return { consumo, taxa, desconto, totalGeral, jaPago, restante };
    }, [pedido]);

    // --- 4. AGRUPAMENTO DE ITENS ---
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
            // TRAVA: Ignora itens com preço negativo (pagamentos antigos)
            if (item.preco <= 0) return acc;

            const nomePessoa = item.cliente || item.clienteNome || item.destinatario || 'Geral';
            if (!acc[nomePessoa]) acc[nomePessoa] = [];
            acc[nomePessoa].push(item);
            return acc;
        }, {});
    }, [pedido, modoImpressao]);

    const formatMoney = (val) => `R$ ${parseFloat(val || 0).toFixed(2)}`;

    const formatarPagamento = (p) => {
        const metodo = p.formaPagamento || p.metodoPagamento || p.paymentMethod || '';
        const metodoString = String(metodo).toLowerCase().trim();
        
        switch(metodoString) {
            case 'dinheiro': case 'cash': case '4': return 'DINHEIRO';
            case 'pix': case '1': return 'PIX';
            case 'cartao': case 'card': return 'CARTÃO NA ENTREGA';
            case 'credit_card': case 'credito': case '2': return 'CRÉDITO NA ENTREGA';
            case 'debit_card': case 'debito': case '3': return 'DÉBITO NA ENTREGA';
            case 'online': return 'PAGO ONLINE';
            default: return metodo.toUpperCase() || 'A COMBINAR';
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen font-bold text-xl p-4 text-center">Carregando...</div>;
    if (erro && !pedidoProp) return <div className="flex items-center justify-center h-screen font-bold text-red-600 p-4 text-center">ERRO: {erro}</div>;
    if (!pedido) return null;

    const enderecoFinal = pedido.endereco || pedido.cliente?.endereco || null;
    const nomeClientePrincipal = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const telefoneCliente = pedido.telefone || pedido.cliente?.telefone || null;
    const temItens = Object.keys(itensAgrupados).length > 0;
    const dataPedido = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : (pedido.dataPedido?.toDate ? pedido.dataPedido.toDate() : new Date());

    // Troco (Calculado sobre o restante ou total geral)
    const metodoPagamento = (pedido.formaPagamento || pedido.metodoPagamento || '').toLowerCase();
    const isDinheiro = metodoPagamento.includes('dinheiro') || metodoPagamento === 'cash' || metodoPagamento === '4';
    const valorTroco = pedido.trocoPara ? parseFloat(pedido.trocoPara) : 0;
    
    // Se tiver pagamento parcial, o troco deve ser sobre o restante
    const valorBaseParaTroco = totais.restante > 0 ? totais.restante : totais.totalGeral;
    const precisaTroco = (isDinheiro && valorTroco > valorBaseParaTroco);
    const trocoDevolver = precisaTroco ? (valorTroco - valorBaseParaTroco) : 0;

    return (
        <div className="bg-white text-black font-mono text-xs leading-tight p-2 w-full h-auto" style={{ maxWidth: '80mm', margin: '0 auto' }}>
            <button onClick={() => window.print()} className="print:hidden fixed top-2 right-2 bg-gray-200 p-2 rounded-full shadow-md z-50 hover:bg-gray-300">
                <IoPrint size={20}/>
            </button>

            <div className="text-center border-b-2 border-black pb-2 mb-2">
                <h1 className="text-xl font-black uppercase">{pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}</h1>
                <p className="text-[10px] mt-1 font-bold">PEDIDO #{pedido.senha || pedido.id?.slice(-4).toUpperCase()}</p>
                <p className="text-[10px]">{dataPedido.toLocaleString('pt-BR')}</p>
                
                {modoImpressao === 'cozinha' && <div className="mt-1 border-4 border-black text-black font-black uppercase text-sm py-1 px-2 inline-block">** COZINHA **</div>}
            </div>

            <div className="mb-3 border-b-2 border-dashed border-black pb-2">
                <p className="font-black text-sm uppercase mb-1">{nomeClientePrincipal}</p>
                {telefoneCliente && <p className="text-xs font-bold mb-1">Tel: {telefoneCliente}</p>}
                
                {enderecoFinal ? (
                    <div className="border-2 border-black p-1 mt-1">
                        <p className="font-bold text-xs uppercase underline">ENTREGA:</p>
                        <p className="font-bold text-xs">{enderecoFinal.rua}, {enderecoFinal.numero}</p>
                        <p className="text-xs">{enderecoFinal.bairro}</p>
                        {enderecoFinal.complemento && <p className="text-xs italic">({enderecoFinal.complemento})</p>}
                    </div>
                ) : (!pedido.mesaNumero && (
                    <div className="mt-1 border-2 border-black p-1 text-center font-black text-xs uppercase">
                        RETIRADA NO BALCÃO
                    </div>
                ))}
            </div>

            <div className="mb-2">
                {!temItens ? <div className="text-center py-4 border border-black p-2">Sem itens para este setor.</div> : 
                    Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                        <div key={nomePessoa} className="mb-2">
                            {pedido.mesaNumero && nomePessoa !== 'Geral' && <div className="font-black px-1 text-[14px] uppercase mb-1 border-b border-black mt-2">👤 {nomePessoa}</div>}
                            {itens.map((item, index) => (
                                <div key={index} className="mb-2 border-b border-dotted border-gray-400 pb-1 last:border-0">
                                    <div className="flex justify-between items-start">
                                        <span className="font-black text-sm flex-1 pr-2 uppercase">{item.quantidade}x {item.nome || item.produto?.nome}</span>
                                        {modoImpressao !== 'cozinha' && <span className="font-bold whitespace-nowrap">{formatMoney((item.precoFinal || item.preco) * item.quantidade)}</span>}
                                    </div>
                                    {item.variacaoSelecionada && <div className="pl-3 text-xs font-bold mt-0.5">Opção: {item.variacaoSelecionada.nome}</div>}
                                    {item.adicionais?.length > 0 && (
                                        <div className="pl-2 mt-0.5">
                                            {item.adicionais.map((adic, idx) => (
                                                <div key={idx} className="flex items-center text-[10px] font-bold text-gray-700">
                                                    <span className="mr-1">+</span><span>{adic.quantidade || 1}x {adic.nome}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {item.observacao && <div className="mt-1 ml-1 text-xs uppercase font-black p-1 border border-black inline-block">OBS: {item.observacao}</div>}
                                </div>
                            ))}
                        </div>
                    ))
                }
            </div>

            {modoImpressao !== 'cozinha' && (
                <div className="border-t-2 border-black pt-2 mt-2">
                    {/* SUBTOTAL REAL (Soma dos produtos) */}
                    <div className="flex justify-between text-xs font-bold"><span>Subtotal:</span><span>{formatMoney(totais.consumo)}</span></div>
                    
                    {totais.taxa > 0 && <div className="flex justify-between text-xs"><span>Taxa de Entrega:</span><span>{formatMoney(totais.taxa)}</span></div>}
                    {totais.desconto > 0 && <div className="flex justify-between text-xs"><span>Desconto:</span><span>- {formatMoney(totais.desconto)}</span></div>}
                    
                    {/* SE TIVER PAGO PARCIALMENTE, MOSTRA O EXTRATO COMPLETO */}
                    {totais.jaPago > 0 ? (
                        <>
                            <div className="flex justify-between text-sm font-bold mt-1 border-t border-dotted border-gray-400 pt-1">
                                <span>TOTAL CONTA:</span>
                                <span>{formatMoney(totais.totalGeral)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>(-) JÁ PAGO:</span>
                                <span>{formatMoney(totais.jaPago)}</span>
                            </div>
                            <div className="flex justify-between text-xl font-black mt-2 border-t-2 border-black pt-1">
                                <span>A PAGAR:</span>
                                <span>{formatMoney(totais.restante)}</span>
                            </div>
                        </>
                    ) : (
                        /* SE NÃO TIVER PAGO NADA, MOSTRA O PADRÃO */
                        <div className="flex justify-between text-lg font-black mt-1 border-t border-dotted border-black pt-1">
                            <span>TOTAL:</span>
                            <span>{formatMoney(totais.totalGeral)}</span>
                        </div>
                    )}

                    <div className="mt-3 border-2 border-black p-1 text-center">
                        <p className="font-bold text-xs uppercase">PAGAMENTO:</p>
                        <p className="font-black text-sm uppercase">{formatarPagamento(pedido)}</p>
                        
                        {precisaTroco && (
                            <div className="mt-1 border-t border-black pt-1">
                                <p className="text-xs font-bold">Troco para: {formatMoney(valorTroco)}</p>
                                <p className="text-sm font-black italic">DEVOLVER: {formatMoney(trocoDevolver)}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <div className="text-center mt-6 text-[10px] font-bold border-t border-black pt-2">
                *** FIM DO PEDIDO ***
                <br/>
                {new Date().toLocaleTimeString()}
            </div>
            
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { margin: 0; padding: 0; background-color: white !important; }
                    .print\\:hidden { display: none !important; }
                    * { 
                        color: #000 !important; 
                        background-color: transparent !important;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default ComandaParaImpressao;
