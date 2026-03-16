import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint } from 'react-icons/io5';

const TERMOS_BEBIDA = [
    'bebida', 'bebidas', 'refrigerante', 'suco', 'cerveja', 'agua', 'água',
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'garrafa', 'h2oh', 'coca', 'guarana'
];

// 🔥 LISTA ESPECÍFICA PARA BLOQUEAR BOMBONIERE E DOCES NA COZINHA
const TERMOS_BOMBONIERE = [
    'bomboniere', 'doce', 'sobremesa', 'chiclete', 'bala', 'chocolate', 'halls', 'mentos', 'sorvete'
];

// 👇 1. TRAVA GLOBAL (FORA DO COMPONENTE) 👇
// Isto impede o loop infinito mesmo que o React recarregue a página
let ultimoPedidoImpresso = null;

const ComandaParaImpressao = ({ pedido: pedidoProp }) => {
    const params = useParams();
    const idUrl = params.id || params.pedidoId;
    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();

    // Captura tanto "modo" quanto "setor" para manter compatibilidade com links antigos
    const modoImpressao = searchParams.get('modo');
    const setorParam = searchParams.get('setor');
    const setor = setorParam || modoImpressao;

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
            document.title = `PEDIDO_${pedido.senha || pedido.numeroPedido || pedido.id?.slice(-4)}`;

            // 👇 2. A CHECAGEM DA TRAVA ENTRA AQUI 👇
            // Só manda imprimir se for um ID diferente do último impresso
            if (ultimoPedidoImpresso !== pedido.id) {
                ultimoPedidoImpresso = pedido.id; // Salva para não imprimir de novo

                const timer = setTimeout(() => {
                    window.focus();
                    window.onafterprint = () => {
                        window.close();
                    };
                    window.print();
                }, 1200);

                return () => clearTimeout(timer);
            }
        }
    }, [pedido, loading, erro, pedidoProp]);

    // --- 3. CÁLCULOS FINANCEIROS COMPLETOS ---
    const totais = useMemo(() => {
        if (!pedido) return { consumo: 0, jaPago: 0, restante: 0, taxa: 0, desconto: 0, totalGeral: 0 };

        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

        const consumo = itens.reduce((acc, item) => {
            return item.preco > 0 ? acc + (item.preco * (item.quantidade || 1)) : acc;
        }, 0);

        // 🔥 CORREÇÃO DO FRETE: Procura por várias nomenclaturas possíveis no banco de dados
        const taxa = Number(pedido.taxaEntrega || pedido.frete || pedido.valorFrete || pedido.valorEntrega || 0);
        let desconto = Number(pedido.desconto) || 0;

        // Se o banco salvou um "totalFinal" com desconto, mas não salvou o campo "desconto"
        const totalNoBanco = Number(pedido.totalFinal) || 0;
        if (desconto === 0 && totalNoBanco > 0 && totalNoBanco < (consumo + taxa)) {
            desconto = (consumo + taxa) - totalNoBanco;
        }

        const totalGeral = consumo + taxa - Math.abs(desconto);

        const pagamentos = Array.isArray(pedido.pagamentosParciais) ? pedido.pagamentosParciais : [];
        const jaPago = pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

        const restante = Math.max(0, totalGeral - jaPago);

        return { consumo, taxa, desconto: Math.abs(desconto), totalGeral, jaPago, restante };
    }, [pedido]);

    const isDelivery = !pedido?.mesaNumero || pedido?.mesaNumero === 0 || pedido?.mesaNumero === '0';

    // --- 4. AGRUPAMENTO DE ITENS E FILTRO POR SETOR ---
    const itensAgrupados = useMemo(() => {
        if (!pedido || !Array.isArray(pedido.itens)) return {};
        let itensParaProcessar = [...pedido.itens];

        // 🔥 AQUI ESTÁ A CORREÇÃO:
        // Se for Delivery, não filtra nada (imprime tudo).
        // Se for Salão (Cozinha/Bar), aplica os filtros.
        if (!isDelivery) {
            if (setor === 'cozinha') {
                // Cozinha: Remove as bebidas E bomboniere
                itensParaProcessar = itensParaProcessar.filter(item => {
                    const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
                    const categoria = String(item.categoria || item.produto?.categoria || '').toLowerCase();
                    const textoCompleto = `${nome} ${categoria}`;

                    const isBebida = TERMOS_BEBIDA.some(termo => textoCompleto.includes(termo));
                    const isBomboniere = TERMOS_BOMBONIERE.some(termo => textoCompleto.includes(termo));

                    return !isBebida && !isBomboniere; // Só passa se NÃO for bebida E NÃO for bomboniere
                });
            } else if (setor === 'bar') {
                // Bar: Deixa as bebidas E a bomboniere
                itensParaProcessar = itensParaProcessar.filter(item => {
                    const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
                    const categoria = String(item.categoria || item.produto?.categoria || '').toLowerCase();
                    const textoCompleto = `${nome} ${categoria}`;

                    const isBebida = TERMOS_BEBIDA.some(termo => textoCompleto.includes(termo));
                    const isBomboniere = TERMOS_BOMBONIERE.some(termo => textoCompleto.includes(termo));

                    return isBebida || isBomboniere; // Passa se for bebida OU bomboniere
                });
            }
        }

        return itensParaProcessar.reduce((acc, item) => {
            // Ignora itens com preço 0 apenas no ticket de produção da cozinha (para não sujar a tela com adicionais grátis)
            if (item.preco <= 0 && setor === 'cozinha') return acc;

            const nomePessoa = item.cliente || item.clienteNome || item.destinatario || 'Geral';
            if (!acc[nomePessoa]) acc[nomePessoa] = [];
            acc[nomePessoa].push(item);
            return acc;
        }, {});
    }, [pedido, setor, isDelivery]);

    const formatMoney = (val) => {
        return Number(val || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    };

    const formatarPagamento = (p) => {
        // Aceita a string direta ou busca do objeto
        const metodo = typeof p === 'string' ? p : (p.formaPagamento || p.metodoPagamento || p.paymentMethod || '');
        const metodoString = String(metodo).toLowerCase().trim();

        switch (metodoString) {
            case 'dinheiro': case 'cash': case '4': return 'DINHEIRO';
            case 'pix': case '1': return 'PIX';
            case 'cartao': case 'card': return 'CARTÃO (MÁQUINA)';
            case 'credit_card': case 'credito': case 'cartao_credito': case '2': return 'CRÉDITO (MÁQUINA)';
            case 'debit_card': case 'debito': case 'cartao_debito': case '3': return 'DÉBITO (MÁQUINA)';
            case 'online': return 'PAGO ONLINE';
            case 'vr': case 'vale_refeicao': case 'voucher': return 'VALE REFEIÇÃO';
            default: return metodoString ? metodoString.toUpperCase() : 'A COMBINAR';
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen font-bold text-xl p-4 text-center bg-white">Carregando comanda...</div>;
    if (erro && !pedidoProp) return <div className="flex items-center justify-center h-screen font-bold text-red-600 p-4 text-center bg-white">ERRO: {erro}</div>;
    if (!pedido) return null;

    const enderecoFinal = pedido.endereco || pedido.cliente?.endereco || null;
    const nomeClientePrincipal = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
    const telefoneCliente = pedido.telefone || pedido.cliente?.telefone || null;
    const temItens = Object.keys(itensAgrupados).length > 0;
    
    // Busca a referência em vários lugares possíveis do banco, priorizando o enderecoFinal.referencia
    const referenciaFinal = enderecoFinal?.referencia || pedido.pontoReferencia || pedido.referencia || null;

    // Fallback robusto para a data
    let stringData = new Date().toLocaleString('pt-BR');
    if (pedido.createdAt?.toDate) stringData = pedido.createdAt.toDate().toLocaleString('pt-BR');
    else if (pedido.dataPedido?.toDate) stringData = pedido.dataPedido.toDate().toLocaleString('pt-BR');

    const metodoPagamento = String(pedido.formaPagamento || pedido.metodoPagamento || '').toLowerCase();
    const isDinheiro = metodoPagamento.includes('dinheiro') || metodoPagamento === 'cash' || metodoPagamento === '4';
    const valorTroco = pedido.trocoPara ? parseFloat(pedido.trocoPara) : 0;
    const valorBaseParaTroco = totais.restante > 0 ? totais.restante : totais.totalGeral;
    const precisaTroco = (isDinheiro && valorTroco > valorBaseParaTroco);
    const trocoDevolver = precisaTroco ? (valorTroco - valorBaseParaTroco) : 0;

    return (
        <>
            <style>{`
                @media print {
                    @page { margin: 0; }
                    html, body, #root {
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    body * { visibility: hidden; }
                    #area-impressao, #area-impressao * {
                        visibility: visible !important;
                        color: black !important;
                        background-color: transparent !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        text-shadow: none !important;
                        box-shadow: none !important;
                    }
                    #area-impressao .border-gray-400 {
                        border-color: black !important;
                    }
                    #area-impressao {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 58mm !important;
                        margin: 0 !important;
                        padding: 2mm !important;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>

            <button onClick={() => window.print()} className="no-print fixed top-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg z-50">
                <IoPrint size={24} />
            </button>

            <div id="area-impressao" className="bg-white text-black font-mono text-xs leading-tight w-full mx-auto" style={{ maxWidth: '80mm' }}>

                {/* CABEÇALHO (COMO NA FOTO: DELIVERY COM ÍCONE) */}
                <div className="text-center border-b-2 border-black pb-2 mb-2">
                    <h1 className="text-xl font-black uppercase flex items-center justify-center gap-1">
                        {isDelivery ? '🚀 DELIVERY' : `MESA ${pedido.mesaNumero}`}
                    </h1>
                    <p className="text-[12px] mt-1 font-bold">#{pedido.senha || pedido.numeroPedido || pedido.id?.slice(-4).toUpperCase()}</p>
                    <p className="text-[10px]">{stringData}</p>

                    {setor === 'cozinha' && !isDelivery && <div className="mt-1 border-4 border-black text-black font-black uppercase text-sm py-1 px-2 inline-block">** COZINHA **</div>}                  
                    {setor === 'bar' && <div className="mt-1 border-4 border-black text-black font-black uppercase text-sm py-1 px-2 inline-block">** BAR **</div>}
                </div>

                {/* NOME DO CLIENTE E ENDEREÇO COM CAIXA AO REDOR */}
                <div className="mb-3 border-b-2 border-dashed border-black pb-2">
                    <p className="font-black text-sm uppercase mb-1">{nomeClientePrincipal}</p>
                    {telefoneCliente && <p className="text-xs font-bold mb-1">Tel: {telefoneCliente}</p>}

                    {isDelivery && enderecoFinal && (
                        <div className="border-2 border-black p-1 mt-1">
                            <p className="font-bold text-xs uppercase underline">ENTREGA:</p>
                            <p className="font-bold text-[13px] uppercase mt-1">{enderecoFinal.rua}, {enderecoFinal.numero}</p>
                            <p className="text-xs uppercase">{enderecoFinal.bairro}</p>
                            {enderecoFinal.complemento && <p className="text-xs italic uppercase">({enderecoFinal.complemento})</p>}
                            
                            {/* REF IMPRIMINDO CORRETAMENTE E QUEBRANDO TEXTO LONGO */}
                            {referenciaFinal && (
                                <p className="text-[10px] font-bold mt-1 uppercase break-words whitespace-normal">
                                    REF: {referenciaFinal}
                                </p>
                            )}
                        </div>
                    )}
                    {!isDelivery && !pedido.mesaNumero && (
                        <div className="mt-1 border-2 border-black p-1 text-center font-black text-xs uppercase">
                            RETIRADA NO BALCÃO
                        </div>
                    )}
                </div>

                {/* ITENS */}
                <div className="mb-2">
                    {!temItens ? <div className="text-center py-4 border border-black p-2 font-bold uppercase">Nenhum item para este setor.</div> :
                        Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                            <div key={nomePessoa} className="mb-2">
                                {!isDelivery && nomePessoa !== 'Geral' && <div className="font-black px-1 text-[14px] uppercase mb-1 border-b border-black mt-2">👤 {nomePessoa}</div>}
                                {itens.map((item, index) => {
                                    const adicionais = Array.isArray(item.adicionais) ? item.adicionais : [];
                                    return (
                                        <div key={index} className="mb-2 border-b border-dotted border-gray-400 pb-1 last:border-0">
                                            <div className="flex justify-between items-start">
                                                <span className="font-black text-[13px] flex-1 pr-2 uppercase">{item.quantidade || 1}X {item.nome || item.produto?.nome}</span>
                                                {/* Preço escondido apenas se for ticket da cozinha */}
                                                {(setor !== 'cozinha' || isDelivery) && <span className="font-bold whitespace-nowrap text-[13px]">{formatMoney((item.precoFinal || item.preco || 0) * (item.quantidade || 1))}</span>}                                            </div>
                                            {item.variacaoSelecionada && <div className="pl-3 text-xs font-bold mt-0.5 uppercase">- {item.variacaoSelecionada.nome}</div>}
                                            {adicionais.length > 0 && (
                                                <div className="pl-2 mt-0.5">
                                                    {adicionais.map((adic, idx) => (
                                                        <div key={idx} className="flex items-center text-[10px] font-bold text-gray-400 uppercase">
                                                            <span className="mr-1">+</span><span>{adic.quantidade || 1}X {adic.nome}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {item.observacao && <div className="mt-1 ml-1 text-xs uppercase font-black p-1 border border-black inline-block break-words whitespace-normal">OBS: {item.observacao}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ))
                    }
                </div>

                {/* BLOCO FINANCEIRO (COM TAXA DE ENTREGA) */}
                {(setor !== 'cozinha' || isDelivery) && (
                    <div className="border-t-2 border-black pt-2 mt-2">
                        {/* 1. RESUMO DOS VALORES */}
                        <div className="flex justify-between text-xs font-bold uppercase mb-1"><span>Subtotal:</span><span>{formatMoney(totais.consumo)}</span></div>

                        {totais.taxa > 0 && <div className="flex justify-between text-xs font-bold uppercase mb-1"><span>Taxa de Entrega:</span><span>{formatMoney(totais.taxa)}</span></div>}

                        {totais.desconto > 0 && <div className="flex justify-between text-sm font-black uppercase border-y border-dashed border-black py-1 my-1"><span>Desconto:</span><span>- {formatMoney(totais.desconto)}</span></div>}

                        <div className="flex justify-between text-[15px] font-black mt-1 border-t border-dashed border-black pt-1 uppercase">
                            <span>TOTAL:</span>
                            <span>{formatMoney(totais.totalGeral)}</span>
                        </div>

                        {/* 2. HISTÓRICO SE JÁ PAGOU ALGO ANTES */}
                        {totais.jaPago > 0 && (
                            <div className="mt-2 border-t border-dotted border-gray-400 pt-1">
                                <p className="text-[10px] font-bold uppercase underline mb-1">Valores já pagos:</p>
                                {Array.isArray(pedido.pagamentosParciais) && pedido.pagamentosParciais.map((pag, idx) => (
                                    <div key={idx} className="flex justify-between text-[11px] font-bold text-gray-700 uppercase">
                                        <span>{formatarPagamento(pag.formaPagamento || pag.metodoPagamento)}</span>
                                        <span>{formatMoney(pag.valor)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between text-[12px] font-black text-gray-800 uppercase mt-1 pt-1">
                                    <span>(-) ABATIMENTO:</span>
                                    <span>{formatMoney(totais.jaPago)}</span>
                                </div>
                            </div>
                        )}

                        {/* 3. CAIXA DE AÇÃO PARA O ENTREGADOR */}
                        <div className="mt-4 border-2 border-black text-center overflow-hidden">
                            {totais.restante <= 0 ? (
                                <div className="bg-black text-white py-3">
                                    <p className="font-black text-[16px] uppercase tracking-wide">✅ PEDIDO PAGO</p>
                                    <p className="text-[11px] font-bold tracking-widest mt-1">NÃO COBRAR DO CLIENTE</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {/* Tarja preta colada nas bordas */}
                                    <div className="bg-black text-white text-[13px] font-black uppercase py-1.5 tracking-wider">
                                        COBRAR NA ENTREGA
                                    </div>

                                    {/* Valor Gigante e Centralizado */}
                                    <div className="py-3">
                                        <span className="text-[24px] font-black leading-none block">{formatMoney(totais.restante)}</span>
                                    </div>

                                    {/* Forma de Pagamento com linha pontilhada padronizada */}
                                    <div className="border-t-2 border-dashed border-gray-400 mx-3 py-2 mb-1">
                                        <span className="text-[13px] font-bold uppercase tracking-wide">
                                            FORMA: {formatarPagamento(pedido)}
                                        </span>
                                    </div>

                                    {/* Bloco de Troco com destaque cinza (se precisar) */}
                                    {precisaTroco && (
                                        <div className="bg-gray-100 border-t-2 border-black py-2 px-2 flex flex-col items-center">
                                            <span className="text-[11px] font-bold uppercase mb-1">Troco para: {formatMoney(valorTroco)}</span>
                                            <span className="text-[16px] font-black uppercase bg-white border-2 border-black px-3 py-1 shadow-sm">
                                                DEVOLVER: {formatMoney(trocoDevolver)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="text-center mt-6 text-[10px] font-bold border-t border-black pt-2 uppercase">
                    *** OBRIGADO PELA PREFERÊNCIA ***
                    <br />
                    {new Date().toLocaleTimeString('pt-PT')}
                </div>
            </div>
        </>
    );
};

export default ComandaParaImpressao;