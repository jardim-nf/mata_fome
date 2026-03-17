import React, { useEffect, useState, useMemo } from 'react';
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

    // 🔥 CÁLCULOS E AGRUPAMENTOS PARA MESA FEITOS AQUI EM CIMA 🔥
    const mesaData = useMemo(() => {
        if (!pedido || !pedido.isMesa) return null;
        
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

        return { agrupados, totalConsumo, jaPago, restante, numero: mesa.numero };
    }, [pedido]);


    // 🔥 DISPARA A IMPRESSÃO E FECHA A TELA 🔥
    useEffect(() => {
        if (!loading && pedido && !error) {
            const timerPrint = setTimeout(() => {
                window.focus();
                window.print();
            }, 800); // Aguarda a tela renderizar bonitinho
            
            // O evento onafterprint tenta fechar a janela após a impressão ser concluída/cancelada
            window.onafterprint = () => {
                window.close();
            };

            return () => {
                clearTimeout(timerPrint);
                window.onafterprint = null;
            };
        }
    }, [loading, pedido, error]);

    const formatarMoeda = (valor) => (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>Carregando impressão...</div>;
    
    if (error) return (
        <div style={{ padding: '20px', textAlign: 'center', color: 'red', fontFamily: 'Arial, sans-serif' }}>
            <strong>Erro:</strong> {error}
            <br /><br />
            <button onClick={() => window.close()} style={{ padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer', backgroundColor: '#f44336', color: '#fff', border: 'none', borderRadius: '5px' }}>Fechar Janela</button>
        </div>
    );

    // Se for Delivery, usa o componente que já existia
    if (!pedido?.isMesa) {
        return <ComandaParaImpressao pedido={pedido} estabelecimento={estabelecimento} />;
    }

    // Se for MESA, renderiza o cupom aqui mesmo no React!
    return (
        <div style={{ width: '80mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '14px', color: '#000', padding: '5mm', backgroundColor: '#fff' }}>
            <style>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body, html { margin: 0; padding: 0; background: white; }
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>
            
            {/* BOTÃO DE SEGURANÇA PARA CELULARES (SÓ APARECE NA TELA, NÃO IMPRIME) */}
            <button className="no-print" onClick={() => window.close()} style={{ width: '100%', padding: '15px', marginBottom: '15px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                Fechar Tela
            </button>

            {/* CABEÇALHO DO CUPOM */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '900', margin: '0 0 5px 0' }}>PRÉ-CONFERÊNCIA</h2>
                <p style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 5px 0' }}>MESA {mesaData.numero}</p>
                <p style={{ fontSize: '10px', margin: '0' }}>{new Date().toLocaleString('pt-BR')}</p>
            </div>

            {/* LISTA DE ITENS */}
            {Object.entries(mesaData.agrupados).map(([pessoa, dados]) => (
                <div key={pessoa} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '900', borderBottom: '1px solid #000', marginBottom: '4px', textTransform: 'uppercase' }}>
                        <span>{pessoa.substring(0, 15)}</span>
                        <span>R$ {formatarMoeda(dados.total)}</span>
                    </div>
                    {dados.itens?.filter(i => i.preco > 0).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '5px', marginBottom: '2px' }}>
                            <span>{item.quantidade || item.qtd || 1}x {item.nome.substring(0,20)}</span>
                            <span>{formatarMoeda((item.preco || 0) * (item.quantidade || item.qtd || 1))}</span>
                        </div>
                    ))}
                </div>
            ))}

            {/* RESUMO FINANCEIRO */}
            <div style={{ borderTop: '1px dashed #000', marginTop: '15px', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>TOTAL CONSUMO:</span>
                    <span>R$ {formatarMoeda(mesaData.totalConsumo)}</span>
                </div>
                {mesaData.jaPago > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span>(-) JÁ PAGO:</span>
                        <span>R$ {formatarMoeda(mesaData.jaPago)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '900', marginTop: '8px', borderTop: '1px solid #000', paddingTop: '8px' }}>
                    <span>A PAGAR:</span>
                    <span>R$ {formatarMoeda(mesaData.restante)}</span>
                </div>
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '15px', fontWeight: 'bold' }}>
                *** NÃO É DOCUMENTO FISCAL ***
            </div>
        </div>
    );
}