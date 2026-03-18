import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import qz from 'qz-tray';
// 🔥 O CÉREBRO DO FILTRO 🔥
const getSetorItemRefinado = (item) => {
    const categoria = (item.categoria || '').toLowerCase();
    const nome = (item.nome || '').toLowerCase();
    
    const termosBar = ['bebida', 'drink', 'suco', 'refriga', 'refrigerante', 'agua', 'água', 'cerveja', 'chopp', 'vinho', 'dose', 'caipirinha', 'coca', 'guarana', 'fanta', 'sprite'];
    
    const ehBar = termosBar.some(t => categoria.includes(t) || nome.includes(t));
    return ehBar ? 'bar' : 'cozinha';
};

export default function ImpressaoIsolada() {
    const [searchParams] = useSearchParams();
    const pedidoId = searchParams.get('pedidoId');
    const estabId = searchParams.get('estabId');
    const origem = searchParams.get('origem'); 
    const setorAlvo = searchParams.get('setor')?.toLowerCase(); 
    
    const [pedido, setPedido] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const buscarDados = async () => {
            if (!pedidoId || !estabId) {
                setError("ID ou Estabelecimento não fornecido.");
                setLoading(false);
                return;
            }
            try {
                let dadosPedido = null;

                if (origem === 'salao') {
                    const mesaRef = doc(db, 'estabelecimentos', estabId, 'mesas', pedidoId);
                    const mesaSnap = await getDoc(mesaRef);
                    if (mesaSnap.exists()) {
                        dadosPedido = { id: mesaSnap.id, ...mesaSnap.data(), isMesa: true };
                    }
                } 
                else {
                    const pedidoRef = doc(db, 'estabelecimentos', estabId, 'pedidos', pedidoId);
                    let pedidoSnap = await getDoc(pedidoRef);
                    
                    if (pedidoSnap.exists()) {
                        dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data(), isMesa: false };
                    }
                }

                if (!dadosPedido) throw new Error("Registro não encontrado no banco de dados.");
                setPedido(dadosPedido);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        buscarDados();
    }, [pedidoId, estabId, origem]);

    const printData = useMemo(() => {
        if (!pedido) return null;
        
        let listaItens = pedido.itens || pedido.pedidos || [];

        // 🔥 O FILTRO DE SETOR ACONTECE AQUI 🔥
        if (setorAlvo && setorAlvo !== 'tudo' && setorAlvo !== 'null' && setorAlvo !== '') {
            listaItens = listaItens.filter(item => {
                const setorDoItem = getSetorItemRefinado(item);
                return setorDoItem === setorAlvo;
            });
        }

        if (listaItens.length === 0) return null; 

        const agrupados = {};
        listaItens.forEach(item => {
            const pessoa = item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
            if (!agrupados[pessoa]) agrupados[pessoa] = { itens: [], total: 0 };
            
            const qtd = item.quantidade || item.qtd || 1;
            agrupados[pessoa].itens.push(item);
            agrupados[pessoa].total += ((item.preco || 0) * qtd);
        });

        const totalConsumo = listaItens.reduce((acc, item) => {
            const qtd = item.quantidade || item.qtd || 1;
            return acc + ((item.preco || 0) * qtd);
        }, 0);
        
        const jaPago = (pedido.pagamentosParciais || []).reduce((acc, pgto) => acc + (Number(pgto.valor) || 0), 0);
        const restante = Math.max(0, totalConsumo - jaPago);

        return { 
            agrupados, 
            totalConsumo, 
            jaPago, 
            restante, 
            numero: pedido.numero || pedido.mesaNumero || 'Balcão',
            isMesa: pedido.isMesa 
        };
    }, [pedido, setorAlvo]);

useEffect(() => {
        if (!loading && printData && !error) {
            const realizarImpressao = async () => {
                // 1. Define qual impressora usar baseado no setor
                // (O ideal no futuro é puxar isso do banco de dados do estabelecimento)
                const nomeImpressora = setorAlvo === 'cozinha' || setorAlvo === 'bar' 
                    ? 'COZINHA' 
                    : 'ELGIN i7(USB)';

                try {
                    // 2. Tenta conectar no QZ Tray
                    if (!qz.websocket.isActive()) {
                        await qz.websocket.connect();
                    }

                    // 3. Pega todo o visual do seu recibo que já está pronto no HTML
                    const htmlContent = document.getElementById('printable-receipt').outerHTML;

                    // 4. Configura a impressora no QZ
                    const config = qz.configs.create(nomeImpressora, {
                        margins: { top: 0, bottom: 0, left: 0, right: 0 }
                    });

                    // 5. Monta o pacote de dados avisando que é um HTML
                    const data = [{
                        type: 'pixel',
                        format: 'html',
                        flavor: 'plain',
                        data: `<html><body style="margin:0;padding:0;font-family:monospace;">${htmlContent}</body></html>`
                    }];

                    // 6. Manda imprimir silenciosamente!
                    await qz.print(config, data);

                    // 7. Fecha a aba fantasma invisível
                    setTimeout(() => window.close(), 1000);

                } catch (err) {
                    console.log("QZ Tray não encontrado ou erro. Caindo pro Plano B (Chrome):", err);
                    
                    // PLANO B: Cliente não tem QZ Tray instalado, usa a tela do Chrome
                    window.focus();
                    setTimeout(() => window.print(), 500);
                    window.onafterprint = () => window.close();
                }
            };

            // Dá 1 segundo pro React desenhar o HTML na tela antes de capturar
            setTimeout(realizarImpressao, 1000); 
        }
    }, [loading, printData, error, setorAlvo]);
    const formatarMoeda = (valor) => (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'monospace' }}>Carregando impressão...</div>;
    
    if (error || !printData) return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
            <p>Não há itens para o setor: {setorAlvo?.toUpperCase() || ''}</p>
            <button className="no-print" onClick={() => window.close()} style={{ padding: '10px 20px', cursor: 'pointer', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px' }}>Fechar Janela</button>
        </div>
    );

    // 🔥 TITULO INTELIGENTE 🔥
    let tituloImpressao = 'PRÉ-CONFERÊNCIA';
    if (!printData.isMesa) {
        tituloImpressao = setorAlvo && setorAlvo !== 'tudo' ? `PEDIDO: ${setorAlvo.toUpperCase()}` : 'NOVO PEDIDO';
    } else if (setorAlvo && setorAlvo !== 'tudo') {
        tituloImpressao = `PEDIDO: ${setorAlvo.toUpperCase()}`; // Mesmo sendo a mesa, avisa que é pra Cozinha/Bar
    }

    return (
        <div id="printable-receipt" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', backgroundColor: '#ffffff', fontFamily: "'Courier New', Courier, monospace", color: '#000000', padding: '5px' }}>
            <style>{`
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-text-size-adjust: 100% !important; }
                table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; }
                td { padding: 2px 0 !important; vertical-align: top !important; word-wrap: break-word !important; }
                @media print {
                    html, body { height: auto !important; overflow: visible !important; width: 100% !important; }
                    #printable-receipt { position: relative !important; height: auto !important; overflow: visible !important; max-width: 100% !important; width: 100% !important; }
                    @page { margin: 0; }
                    .no-print { display: none !important; }
                }
            `}</style>
            
            <button className="no-print" onClick={() => window.close()} style={{ width: '100%', padding: '12px', marginBottom: '15px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>FECHAR TELA</button>

            <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{tituloImpressao}</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>MESA {printData.numero}</div>
                <div style={{ fontSize: '12px' }}>{new Date().toLocaleString('pt-BR')}</div>
            </div>

            {Object.entries(printData.agrupados).map(([pessoa, dados]) => (
                <div key={pessoa} style={{ marginBottom: '15px' }}>
                    <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', paddingBottom: '2px' }}>
                        <table style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            <tbody>
                                <tr>
                                    <td style={{ width: '65%', textAlign: 'left' }}>{pessoa}</td>
                                    <td style={{ width: '35%', textAlign: 'right' }}>R$ {formatarMoeda(dados.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <table style={{ fontSize: '12px' }}>
                        <tbody>
                            {dados.itens.map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ width: '75%', textAlign: 'left', paddingRight: '5px' }}>
                                        <span style={{fontWeight: 'bold', fontSize: '13px'}}>{item.quantidade || item.qtd || 1}x</span> {item.nome}
                                        {item.observacao && <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>* OBS: {item.observacao}</div>}
                                    </td>
                                    <td style={{ width: '25%', textAlign: 'right' }}>
                                        {formatarMoeda((item.preco || 0) * (item.quantidade || item.qtd || 1))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px' }}>
                <table style={{ fontSize: '13px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '60%', textAlign: 'left' }}>TOTAL:</td>
                            <td style={{ width: '40%', textAlign: 'right' }}>R$ {formatarMoeda(printData.totalConsumo)}</td>
                        </tr>
                    </tbody>
                </table>
                
                {printData.isMesa && (!setorAlvo || setorAlvo === 'tudo') && (
                    <table style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '5px', borderTop: '1px solid #000', paddingTop: '5px' }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '50%', textAlign: 'left' }}>A PAGAR:</td>
                                <td style={{ width: '50%', textAlign: 'right' }}>R$ {formatarMoeda(printData.restante)}</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
            
            <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '15px', fontWeight: 'bold' }}>
                *** {(!printData.isMesa || (setorAlvo && setorAlvo !== 'tudo')) ? 'VIA DE PRODUÇÃO' : 'NÃO É DOCUMENTO FISCAL'} ***
            </div>
        </div>
    );
}