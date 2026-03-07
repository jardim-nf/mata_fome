import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint } from 'react-icons/io5';

// 🔥 LISTA DE BLOQUEIO PARA COZINHA (Bebidas e Bomboniere não saem lá)
const TERMOS_BLOQUEADOS_COZINHA = [
    'bebida', 'refrigerante', 'suco', 'cerveja', 'agua', 'água', 
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'garrafa', 'h2oh', 'coca', 'guarana',
    'bomboniere', 'doce', 'sobremesa', 'chiclete', 'bala ', 'chocolate', 'halls', 'mentos', 'pirulito'
];

const ComandaParaImpressao = ({ pedido: pedidoProp }) => {
    const params = useParams();
    const idUrl = params.id || params.pedidoId;
    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();
    
    const setor = searchParams.get('setor') || searchParams.get('modo'); 
    const estabIdUrl = searchParams.get('estabId');

    const [pedidoState, setPedidoState] = useState(null);
    const [loading, setLoading] = useState(!pedidoProp);
    const [erro, setErro] = useState('');

    const pedido = pedidoProp || pedidoState;

    // --- 1. BUSCA O PEDIDO ---
    useEffect(() => {
        if (pedidoProp) { setLoading(false); return; }
        if (!idUrl || authLoading) return;

        const buscarPedido = async () => {
            setLoading(true);
            try {
                let dados = null;
                const refGlobal = doc(db, 'pedidos', idUrl);
                const snap = await getDoc(refGlobal);
                
                if (snap.exists()) {
                    dados = { id: snap.id, ...snap.data() };
                } else {
                    const lojaId = estabIdUrl || primeiroEstabelecimento;
                    if (lojaId) {
                        const refLoja = doc(db, 'estabelecimentos', lojaId, 'pedidos', idUrl);
                        const snapLoja = await getDoc(refLoja);
                        if (snapLoja.exists()) dados = { id: snapLoja.id, ...snapLoja.data() };
                    }
                }

                if (!dados) {
                    const q = query(collectionGroup(db, 'pedidos'), where('id', '==', idUrl));
                    const qSnap = await getDocs(q);
                    if (!qSnap.empty) dados = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
                }

                if (dados) setPedidoState(dados);
                else setErro("Pedido não encontrado.");
            } catch (e) { setErro("Erro ao carregar dados."); }
            finally { setLoading(false); }
        };
        buscarPedido();
    }, [idUrl, authLoading, primeiroEstabelecimento, estabIdUrl, pedidoProp]);

    // --- 2. AUTO-PRINT ---
    useEffect(() => {
        if (pedido && !loading && !erro) {
            document.title = `TICKET_${pedido.id?.slice(-4)}`;
            const t = setTimeout(() => { 
                window.print();
                window.onafterprint = () => window.close();
            }, 1000);
            return () => clearTimeout(t);
        }
    }, [pedido, loading, erro]);

    // --- 3. CÁLCULOS ---
    const totais = useMemo(() => {
        if (!pedido) return { subtotal: 0, totalGeral: 0, jaPago: 0, restante: 0 };
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const subtotal = itens.reduce((acc, i) => acc + ((i.precoFinal || i.preco || 0) * (i.quantidade || 1)), 0);
        const taxa = Number(pedido.taxaEntrega) || 0;
        const desc = Number(pedido.desconto) || 0;
        const totalGeral = (pedido.totalFinal || (subtotal + taxa - desc));
        
        const pagamentos = Array.isArray(pedido.pagamentosParciais) ? pedido.pagamentosParciais : [];
        const jaPago = pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);

        return { subtotal, totalGeral, jaPago, restante: Math.max(0, totalGeral - jaPago) };
    }, [pedido]);

    // --- 4. FILTRAGEM POR SETOR ---
    const itensAgrupados = useMemo(() => {
        if (!pedido?.itens) return {};
        let lista = [...pedido.itens];

        if (setor === 'cozinha') {
            lista = lista.filter(i => {
                const txt = `${i.nome} ${i.categoria}`.toLowerCase();
                return !TERMOS_BLOQUEADOS_COZINHA.some(t => txt.includes(t));
            });
        } else if (setor === 'bar') {
            lista = lista.filter(i => {
                const txt = `${i.nome} ${i.categoria}`.toLowerCase();
                return TERMOS_BLOQUEADOS_COZINHA.some(t => txt.includes(t));
            });
        }

        return lista.reduce((acc, item) => {
            const dono = item.cliente || item.clienteNome || 'Geral';
            if (!acc[dono]) acc[dono] = [];
            acc[dono].push(item);
            return acc;
        }, {});
    }, [pedido, setor]);

    const formatMoney = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (loading) return <div className="p-10 text-center font-bold">Gerando Ticket...</div>;
    if (erro) return <div className="p-10 text-center text-red-600 font-bold">{erro}</div>;
    if (!pedido) return null;

    const endereco = pedido.endereco || pedido.cliente?.endereco;
    const isDelivery = !pedido.mesaNumero || pedido.mesaNumero === 0;

    return (
        <div className="bg-white">
            <style>{`
                @media print {
                    @page { margin: 0; size: 58mm auto; }
                    body { margin: 0; padding: 0; background: white; }
                    .no-print { display: none; }
                }
                #ticket { 
                    width: 58mm; 
                    font-family: 'Courier New', Courier, monospace; 
                    font-size: 11px; 
                    line-height: 1.1;
                    color: black;
                    padding: 1mm;
                    margin: 0 auto;
                }
                .dashed { border-bottom: 1px dashed black; }
                .bold { font-weight: bold; }
                .text-center { text-align: center; }
                .big { font-size: 14px; }
            `}</style>

            <div id="ticket">
                {/* CABEÇALHO */}
                <div className="text-center dashed pb-1 mb-1">
                    <h2 className="bold big uppercase">{pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}</h2>
                    <p className="bold">#{pedido.senha || pedido.numeroPedido || pedido.id?.slice(-4).toUpperCase()}</p>
                    <p style={{ fontSize: '9px' }}>{new Date().toLocaleString('pt-BR')}</p>
                    {setor && <div className="mt-1 border border-black bold uppercase p-0.5">** {setor} **</div>}
                </div>

                {/* CLIENTE E ENTREGA (TURBINADO) */}
                <div className="dashed pb-1 mb-1">
                    <p className="bold uppercase">{pedido.clienteNome || pedido.cliente?.nome || 'CLIENTE'}</p>
                    {(pedido.telefone || pedido.cliente?.telefone) && <p className="bold">Tel: {pedido.telefone || pedido.cliente?.telefone}</p>}
                    
                    {isDelivery && endereco && (
                        <div className="mt-1 border-t pt-1">
                            <p className="bold underline">ENDEREÇO DE ENTREGA:</p>
                            <p className="bold">{endereco.rua}, {endereco.numero}</p>
                            <p>{endereco.bairro} - {endereco.cidade || ''}</p>
                            {endereco.complemento && <p className="italic">({endereco.complemento})</p>}
                            {pedido.pontoReferencia && <p className="bold">Ref: {pedido.pontoReferencia}</p>}
                        </div>
                    )}
                </div>

                {/* ITENS */}
                <div className="mb-1">
                    {Object.keys(itensAgrupados).length === 0 ? <p className="text-center italic">Sem itens.</p> : 
                        Object.entries(itensAgrupados).map(([pessoa, itens]) => (
                            <div key={pessoa} className="mb-1">
                                {pedido.mesaNumero && pessoa !== 'Geral' && <div className="bold border-b mb-1">👤 {pessoa}</div>}
                                {itens.map((item, i) => (
                                    <div key={i} className="mb-1">
                                        <div className="flex justify-between bold">
                                            <span className="uppercase">{item.quantidade || 1}x {item.nome}</span>
                                            {setor !== 'cozinha' && <span>{formatMoney((item.precoFinal || item.preco || 0) * (item.quantidade || 1))}</span>}
                                        </div>
                                        {item.variacaoSelecionada && <div className="pl-2">- {item.variacaoSelecionada.nome}</div>}
                                        {item.observacao && <div className="bg-black text-white px-1 mt-0.5 bold uppercase" style={{fontSize: '9px'}}>OBS: {item.observacao}</div>}
                                    </div>
                                ))}
                            </div>
                        ))
                    }
                </div>

                {/* FINANCEIRO (Não sai na cozinha) */}
                {setor !== 'cozinha' && (
                    <div className="border-t pt-1 mt-1">
                        <div className="flex justify-between"><span>Subtotal:</span><span>{formatMoney(totais.subtotal)}</span></div>
                        {pedido.taxaEntrega > 0 && <div className="flex justify-between"><span>Taxa Entrega:</span><span>{formatMoney(pedido.taxaEntrega)}</span></div>}
                        {pedido.desconto > 0 && <div className="flex justify-between bold"><span>Desconto:</span><span>-{formatMoney(pedido.desconto)}</span></div>}
                        
                        <div className="flex justify-between bold mt-1 big">
                            <span>TOTAL:</span><span>{formatMoney(totais.totalGeral)}</span>
                        </div>

                        {totais.jaPago > 0 && (
                            <>
                                <div className="flex justify-between"><span>JÁ PAGO:</span><span>-{formatMoney(totais.jaPago)}</span></div>
                                <div className="flex justify-between bold big border-t mt-1"><span>A PAGAR:</span><span>{formatMoney(totais.restante)}</span></div>
                            </>
                        )}

                        <div className="mt-1 border border-black p-0.5 text-center bold uppercase">
                            PAGAMENTO: {pedido.formaPagamento || 'A COMBINAR'}
                        </div>
                        
                        {/* LÓGICA DE TROCO */}
                        {pedido.trocoPara > 0 && (
                            <div className="text-center mt-1 border-t pt-1">
                                <p>Troco para: {formatMoney(pedido.trocoPara)}</p>
                                <p className="bold big">DEVOLVER: {formatMoney(pedido.trocoPara - totais.restante)}</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="text-center mt-3 dashed pt-1" style={{ fontSize: '8px' }}>
                    *** OBRIGADO PELA PREFERÊNCIA ***
                </div>
            </div>
        </div>
    );
};

export default ComandaParaImpressao;