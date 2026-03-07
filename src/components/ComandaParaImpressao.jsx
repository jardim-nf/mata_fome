import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { IoPrint } from 'react-icons/io5';

// 🔥 LISTA AMPLIADA PARA BLOQUEAR BEBIDAS E BOMBONIERE NA COZINHA
const TERMOS_BLOQUEADOS_COZINHA = [
    'bebida', 'refrigerante', 'suco', 'cerveja', 'agua', 'água', 
    'drink', 'vinho', 'dose', 'long neck', 'lata', 'garrafa', 'h2oh', 'coca', 'guarana',
    'bomboniere', 'doce', 'sobremesa', 'chiclete', 'bala ', 'chocolate', 'halls', 'mentos'
];

const ComandaParaImpressao = ({ pedido: pedidoProp }) => {
    const params = useParams();
    const idUrl = params.id || params.pedidoId;
    const [searchParams] = useSearchParams();
    const { primeiroEstabelecimento, loading: authLoading } = useAuth();
    
    const modoImpressao = searchParams.get('modo'); 
    const setorParam = searchParams.get('setor');
    const setor = setorParam || modoImpressao; 

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
                setErro(error.message); 
            } 
            finally { setLoading(false); }
        };
        buscarPedido();
    }, [idUrl, authLoading, primeiroEstabelecimento, estabIdUrl, pedidoProp]);

    useEffect(() => {
        if (!pedidoProp && pedido && !loading && !erro) {
            document.title = `PEDIDO_${pedido.senha || pedido.numeroPedido || pedido.id?.slice(-4)}`;
            const timer = setTimeout(() => { 
                window.focus();
                window.onafterprint = () => { window.close(); };
                window.print(); 
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [pedido, loading, erro, pedidoProp]);

    const totais = useMemo(() => {
        if (!pedido) return { consumo: 0, jaPago: 0, restante: 0, taxa: 0, desconto: 0, totalGeral: 0 };
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const consumo = itens.reduce((acc, item) => item.preco > 0 ? acc + (item.preco * (item.quantidade || 1)) : acc, 0);
        const taxa = Number(pedido.taxaEntrega) || 0;
        let desconto = Number(pedido.desconto) || 0;
        const totalGeral = consumo + taxa - Math.abs(desconto);
        const pagamentos = Array.isArray(pedido.pagamentosParciais) ? pedido.pagamentosParciais : [];
        const jaPago = pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
        return { consumo, taxa, desconto: Math.abs(desconto), totalGeral, jaPago, restante: Math.max(0, totalGeral - jaPago) };
    }, [pedido]);

    const itensAgrupados = useMemo(() => {
        if (!pedido || !Array.isArray(pedido.itens)) return {};
        let itensParaProcessar = [...pedido.itens];
        
        // 🔥 LÓGICA DE FILTRAGEM DE SETOR MELHORADA
        if (setor === 'cozinha') {
            itensParaProcessar = itensParaProcessar.filter(item => {
                const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
                const categoria = String(item.categoria || item.produto?.categoria || '').toLowerCase();
                const textoCompleto = `${nome} ${categoria}`;
                // NÃO deixa passar se for bebida ou bomboniere
                return !TERMOS_BLOQUEADOS_COZINHA.some(termo => textoCompleto.includes(termo));
            });
        } else if (setor === 'bar') {
            itensParaProcessar = itensParaProcessar.filter(item => {
                const nome = String(item.nome || item.produto?.nome || '').toLowerCase();
                const categoria = String(item.categoria || item.produto?.categoria || '').toLowerCase();
                const textoCompleto = `${nome} ${categoria}`;
                // Deixa passar APENAS se for bebida ou bomboniere
                return TERMOS_BLOQUEADOS_COZINHA.some(termo => textoCompleto.includes(termo));
            });
        }

        return itensParaProcessar.reduce((acc, item) => {
            if (item.preco <= 0 && setor !== 'cozinha') return acc;
            const nomePessoa = item.cliente || item.clienteNome || item.destinatario || 'Geral';
            if (!acc[nomePessoa]) acc[nomePessoa] = [];
            acc[nomePessoa].push(item);
            return acc;
        }, {});
    }, [pedido, setor]);

    const formatMoney = (val) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const formatarPagamento = (p) => {
        const metodo = String(p.formaPagamento || p.metodoPagamento || '').toLowerCase().trim();
        if (metodo.includes('dinheiro') || metodo === '4') return 'DINHEIRO';
        if (metodo.includes('pix') || metodo === '1') return 'PIX';
        if (metodo.includes('credito') || metodo === '2') return 'CRÉDITO';
        if (metodo.includes('debito') || metodo === '3') return 'DÉBITO';
        return metodo.toUpperCase() || 'A COMBINAR';
    };

    if (loading) return <div className="bg-white p-4 text-center font-bold">Carregando...</div>;
    if (erro) return <div className="bg-white p-4 text-red-600 font-bold">ERRO: {erro}</div>;
    if (!pedido) return null;

    return (
        <>
            <style>{`
                @media print {
                    @page { margin: 0; }
                    html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    body * { visibility: hidden; }
                    #area-impressao, #area-impressao * { visibility: visible !important; color: black !important; background: transparent !important; }
                    #area-impressao { position: absolute; left: 0; top: 0; width: 58mm !important; padding: 2mm; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div id="area-impressao" className="bg-white text-black font-mono text-xs leading-tight w-full mx-auto" style={{ maxWidth: '58mm' }}>
                <div className="text-center border-b-2 border-black pb-2 mb-2">
                    <h1 className="text-xl font-black uppercase">{pedido.mesaNumero ? `MESA ${pedido.mesaNumero}` : 'DELIVERY'}</h1>
                    <p className="text-[12px] mt-1 font-bold">PEDIDO #{pedido.senha || pedido.id?.slice(-4).toUpperCase()}</p>
                    <p className="text-[10px]">{new Date().toLocaleString('pt-BR')}</p>
                    
                    {setor === 'cozinha' && <div className="mt-1 border-2 border-black font-black uppercase text-sm py-1 px-2 inline-block">** COZINHA **</div>}
                    {setor === 'bar' && <div className="mt-1 border-2 border-black font-black uppercase text-sm py-1 px-2 inline-block">** BAR / BOMBONIERE **</div>}
                </div>

                <div>
                    {Object.entries(itensAgrupados).map(([nomePessoa, itens]) => (
                        <div key={nomePessoa} className="mb-2">
                            {pedido.mesaNumero && nomePessoa !== 'Geral' && <div className="font-black text-[12px] border-b border-black mb-1">👤 {nomePessoa}</div>}
                            {itens.map((item, index) => (
                                <div key={index} className="mb-1 border-b border-dotted border-black pb-1 last:border-0">
                                    <div className="flex justify-between font-black">
                                        <span className="uppercase">{item.quantidade || 1}x {item.nome}</span>
                                        {setor !== 'cozinha' && <span>{formatMoney((item.preco || 0) * (item.quantidade || 1))}</span>}
                                    </div>
                                    {item.observacao && <div className="bg-black text-white px-1 text-[10px] uppercase font-bold mt-1">OBS: {item.observacao}</div>}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                {setor !== 'cozinha' && (
                    <div className="border-t-2 border-black pt-1 mt-2">
                        <div className="flex justify-between font-black text-sm"><span>TOTAL:</span><span>{formatMoney(totais.totalGeral)}</span></div>
                        <div className="mt-2 border border-black p-1 text-center font-bold uppercase">
                            Pagamento: {formatarPagamento(pedido)}
                        </div>
                    </div>
                )}
                
                <div className="text-center mt-4 text-[9px] border-t border-black pt-1">
                    *** FIM DO TICKET ***
                </div>
            </div>
        </>
    );
};

export default ComandaParaImpressao;