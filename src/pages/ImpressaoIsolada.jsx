import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import ComandaParaImpressao from '../components/ComandaParaImpressao';

export default function ImpressaoIsolada() {
    const [searchParams] = useSearchParams();
    const pedidoId = searchParams.get('pedidoId');
    const estabId = searchParams.get('estabId');
    const origem = searchParams.get('origem'); // 'salao' ou null/delivery
    
    const [pedido, setPedido] = useState(null);
    const [estabelecimento, setEstabelecimento] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [htmlInjetado, setHtmlInjetado] = useState(false);

    useEffect(() => {
        const buscarDados = async () => {
            if (!pedidoId) {
                setError("ID não fornecido.");
                setLoading(false);
                return;
            }
            try {
                let dadosPedido = null;

                // FLUXO 1: SE VIER DO SALÃO (MESA)
                if (origem === 'salao' && estabId) {
                    const mesaRef = doc(db, 'estabelecimentos', estabId, 'mesas', pedidoId);
                    const mesaSnap = await getDoc(mesaRef);
                    if (mesaSnap.exists()) {
                        dadosPedido = { id: mesaSnap.id, ...mesaSnap.data(), isMesa: true };
                    }
                } 
                // FLUXO 2: SE FOR DELIVERY/NORMAL
                else {
                    const pedidoRef = doc(db, 'pedidos', pedidoId);
                    let pedidoSnap = await getDoc(pedidoRef);
                    
                    if (pedidoSnap.exists()) {
                        dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data(), isMesa: false };
                    } else {
                        const q = query(collectionGroup(db, 'pedidos'), where('id', '==', pedidoId));
                        const querySnap = await getDocs(q);
                        if (!querySnap.empty) {
                            dadosPedido = { id: querySnap.docs[0].id, ...querySnap.docs[0].data(), isMesa: false };
                        }
                    }
                }

                if (!dadosPedido) {
                    throw new Error("Registro não encontrado no banco de dados.");
                }
                
                setPedido(dadosPedido);

                // Busca Estabelecimento
                const idLoja = estabId || dadosPedido.estabelecimentoId;
                if (idLoja) {
                    const estabelecimentoRef = doc(db, 'estabelecimentos', idLoja);
                    const estabelecimentoSnap = await getDoc(estabelecimentoRef);
                    if (estabelecimentoSnap.exists()) {
                        setEstabelecimento({ id: estabelecimentoSnap.id, ...estabelecimentoSnap.data() });
                    }
                }

            } catch (err) {
                console.error("Erro ao buscar dados:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        buscarDados();
    }, [pedidoId, estabId, origem]);

    // 🔥 LÓGICA DE IMPRESSÃO BRUTA E GIGANTE PARA MESAS 🔥
    useEffect(() => {
        if (!loading && pedido && pedido.isMesa && !htmlInjetado) {
            const mesa = pedido;
            const listaItens = mesa?.itens || mesa?.pedidos || [];
            
            const agrupados = {};
            listaItens.forEach(item => {
                let pessoa = item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
                if ((!pessoa || pessoa === 'Mesa') && mesa.nomesOcupantes?.length > 0) {
                    if(!item.cliente && !item.destinatario) pessoa = mesa.nomesOcupantes[0]; 
                }
                if (!pessoa) pessoa = 'Cliente 1';

                if (!agrupados[pessoa]) { agrupados[pessoa] = { itens: [], total: 0 }; }
                
                const qtd = item.quantidade || item.qtd || 1;
                agrupados[pessoa].itens.push(item);
                agrupados[pessoa].total += ((item.preco || 0) * qtd);
            });

            const totalConsumo = listaItens.reduce((acc, item) => {
                const qtd = item.quantidade || item.qtd || 1;
                return acc + ((item.preco || 0) * qtd);
            }, 0);
            
            const jaPago = (mesa.pagamentosParciais || []).reduce((acc, pgto) => acc + (Number(pgto.valor) || 0), 0);
            const restante = Math.max(0, totalConsumo - jaPago);

            const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const conteudoMesa = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Conferência - Mesa ${mesa?.numero}</title>
                    <style>
                        @media print { 
                            @page { margin: 0; size: 80mm auto; } 
                            body { margin: 0; padding: 0; } 
                        }
                        body { 
                            font-family: 'Courier New', Courier, monospace !important; 
                            font-size: 15px !important; 
                            width: 80mm !important; 
                            margin: 0 !important; 
                            padding: 5px !important; 
                            color: #000 !important; 
                            background: #fff !important; 
                            font-weight: bold !important; 
                            -webkit-print-color-adjust: exact;
                        }
                        .header { text-align: center; margin-bottom: 12px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
                        .header h2 { font-size: 20px; margin: 0; text-transform: uppercase; }
                        .header p { font-size: 16px; margin: 5px 0; } 
                        
                        .pagante-block { margin-bottom: 12px; }
                        .pagante-header { display: flex; justify-content: space-between; font-weight: 900; border-bottom: 1px solid #000; margin-bottom: 4px; text-transform: uppercase; font-size: 14px; }
                        .item-row { display: flex; justify-content: space-between; padding-left: 5px; font-size: 14px; margin-bottom: 4px; }
                        
                        .resumo-box { border-top: 1px dashed #000; margin-top: 15px; padding-top: 8px; }
                        .linha-resumo { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px; }
                        .linha-total { display: flex; justify-content: space-between; font-size: 22px; font-weight: 900; margin-top: 8px; border-top: 1px solid #000; padding-top: 8px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h2>PRÉ-CONFERÊNCIA</h2>
                        <p style="font-size: 14px; margin: 5px 0;">MESA ${mesa?.numero}</p>
                        <p style="font-size: 10px;">${new Date().toLocaleString('pt-BR')}</p>
                    </div>

                    ${Object.entries(agrupados).map(([pessoa, dados]) => `
                        <div class="pagante-block">
                            <div class="pagante-header">
                                <span>${pessoa.substring(0, 15)}</span>
                                <span>R$ ${formatarMoeda(dados.total)}</span>
                            </div>
                            ${dados.itens?.filter(i => i.preco > 0).map(item => `
                                <div class="item-row">
                                    <span>${item.quantidade || item.qtd || 1}x ${item.nome.substring(0,20)}</span>
                                    <span>${formatarMoeda((item.preco || 0) * (item.quantidade || item.qtd || 1))}</span>
                                </div>
                            `).join('') || '<div class="item-row"><i>Valor Manual</i></div>'}
                        </div>
                    `).join('')}

                    <div class="resumo-box">
                        <div class="linha-resumo"><span>TOTAL CONSUMO:</span><span>R$ ${formatarMoeda(totalConsumo)}</span></div>
                        ${jaPago > 0 ? `<div class="linha-resumo"><span>(-) JÁ PAGO:</span><span>R$ ${formatarMoeda(jaPago)}</span></div>` : ''}
                        <div class="linha-total"><span>A PAGAR:</span><span>R$ ${formatarMoeda(restante)}</span></div>
                    </div>
                    <br/>
                    <div style="text-align:center; font-size:10px;">*** NÃO É DOCUMENTO FISCAL ***</div>
                </body>
                </html>
            `;
            
            document.open();
            document.write(conteudoMesa);
            document.close();
            setHtmlInjetado(true);

            setTimeout(() => { window.print(); }, 500);
        }
    }, [loading, pedido, htmlInjetado]);

    // O código de Delivery continua igual
    useEffect(() => {
        if (!loading && pedido && !pedido.isMesa) {
            const timer = setTimeout(() => { window.print(); }, 1000);
            return () => clearTimeout(timer);
        }
    }, [loading, pedido]);

    useEffect(() => {
        const handleAfterPrint = () => {
            setTimeout(() => { window.close(); }, 500);
        };
        window.onafterprint = handleAfterPrint;
        return () => { window.onafterprint = null; };
    }, []);

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>Carregando impressão...</div>;
    
    if (error) return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
            <strong>Erro:</strong> {error}
            <br /><br />
            <button onClick={() => window.close()} style={{ padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' }}>Fechar Janela</button>
        </div>
    );

    return (
        <div>
            {!pedido?.isMesa && (
                <ComandaParaImpressao pedido={pedido} estabelecimento={estabelecimento} />
            )}
        </div>
    );
}