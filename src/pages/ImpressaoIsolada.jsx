import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import qz from 'qz-tray';

// 🔥 O PENTE FINO DE DADOS 🔥 (Garante que o nome do produto nunca venha em branco)
const extrairDadosDoItem = (rawItem) => {
    if (!rawItem) return null;

    let nome = rawItem.nome || rawItem.name || rawItem.descricao || rawItem.title || rawItem.titulo || rawItem.produtoNome;
    let preco = rawItem.precoFinal || rawItem.precoUnitario || rawItem.preco || rawItem.valor || rawItem.price;
    let categoria = rawItem.categoria;

    if (rawItem.produto && typeof rawItem.produto === 'object') {
        nome = rawItem.produto.nome || rawItem.produto.name || rawItem.produto.descricao || nome;
        preco = rawItem.produto.precoFinal || rawItem.produto.preco || rawItem.produto.valor || rawItem.produto.price || preco;
        categoria = rawItem.produto.categoria || categoria;
    } else if (rawItem.item && typeof rawItem.item === 'object') {
        nome = rawItem.item.nome || rawItem.item.name || rawItem.item.descricao || nome;
        preco = rawItem.item.precoFinal || rawItem.item.preco || rawItem.item.valor || rawItem.item.price || preco;
        categoria = rawItem.item.categoria || categoria;
    }

    if (!nome) nome = "PRODUTO SEM NOME IDENTIFICADO";

    const qtd = Number(rawItem.quantidade || rawItem.quantity || rawItem.qtd || rawItem.produto?.quantidade || 1);
    const obs = rawItem.observacao || rawItem.obs || '';

    return {
        ...rawItem,
        nomeCalculado: String(nome),
        precoCalculado: Number(preco) || 0,
        qtdCalculada: qtd || 1,
        obsCalculada: String(obs),
        categoriaCalculada: String(categoria || '').toLowerCase()
    };
};

const getSetorItemRefinado = (itemFormatado) => {
    const textoBusca = `${itemFormatado.nomeCalculado} ${itemFormatado.categoriaCalculada}`.toLowerCase();
    const termosBar = ['bebida', 'drink', 'suco', 'refriga', 'refrigerante', 'agua', 'água', 'cerveja', 'chopp', 'vinho', 'dose', 'caipirinha', 'coca', 'guarana', 'fanta', 'sprite'];
    const ehBar = termosBar.some(t => textoBusca.includes(t));
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
    const [impressoraConfig, setImpressoraConfig] = useState({ balcao: null, cozinha: null });

    useEffect(() => {
        const buscarDados = async () => {
            if (!pedidoId || !estabId) {
                setError("ID ou Estabelecimento não fornecido.");
                setLoading(false);
                return;
            }
            try {
                // Busca config das impressoras do estabelecimento
                const estabRef = doc(db, 'estabelecimentos', estabId);
                const estabSnap = await getDoc(estabRef);
                if (estabSnap.exists()) {
                    const estabData = estabSnap.data();
                    setImpressoraConfig({
                        balcao: estabData.impressoraBalcao || null,
                        cozinha: estabData.impressoraCozinha || null
                    });
                }

                let dadosPedido = null;

                // 1. Tenta buscar na coleção global de Vendas (Recibos do PDV e Salão finalizados)
                const vendaRef = doc(db, 'vendas', pedidoId);
                const vendaSnap = await getDoc(vendaRef);
                if (vendaSnap.exists()) {
                    // 🔥 AVISO ADICIONADO: isVendaFinalizada: true
                    dadosPedido = { id: vendaSnap.id, ...vendaSnap.data(), isMesa: !!vendaSnap.data().mesaNumero, isVendaFinalizada: true };
                }

                // 2. Se não achar, tenta buscar nas Mesas (Para impressão de Conferência antes de pagar)
                if (!dadosPedido) {
                    const mesaRef = doc(db, 'estabelecimentos', estabId, 'mesas', pedidoId);
                    const mesaSnap = await getDoc(mesaRef);
                    if (mesaSnap.exists()) dadosPedido = { id: mesaSnap.id, ...mesaSnap.data(), isMesa: true };
                }

                // 3. Se não achar, tenta buscar nos Pedidos (Delivery / Balcão em andamento)
                if (!dadosPedido) {
                    const pedidoRef = doc(db, 'estabelecimentos', estabId, 'pedidos', pedidoId);
                    let pedidoSnap = await getDoc(pedidoRef);
                    if (pedidoSnap.exists()) dadosPedido = { id: pedidoSnap.id, ...pedidoSnap.data(), isMesa: false };
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
        
        let itensBrutos = [];
        
        if (Array.isArray(pedido.itens)) itensBrutos.push(...pedido.itens);
        if (Array.isArray(pedido.carrinho)) itensBrutos.push(...pedido.carrinho);
        if (Array.isArray(pedido.produtos)) itensBrutos.push(...pedido.produtos);
        
        if (Array.isArray(pedido.pedidos)) {
            pedido.pedidos.forEach(sub => {
                if (Array.isArray(sub.itens)) itensBrutos.push(...sub.itens);
                else if (Array.isArray(sub.carrinho)) itensBrutos.push(...sub.carrinho);
                else if (Array.isArray(sub.produtos)) itensBrutos.push(...sub.produtos);
                else if (sub.nome || sub.produto || sub.descricao) itensBrutos.push(sub);
            });
        }

        let listaFormatada = itensBrutos.map(extrairDadosDoItem).filter(Boolean);

        if (setorAlvo && setorAlvo !== 'tudo' && setorAlvo !== 'null' && setorAlvo !== '') {
            listaFormatada = listaFormatada.filter(item => getSetorItemRefinado(item) === setorAlvo);
        }

        if (listaFormatada.length === 0) return { vazio: true }; 

        const agrupados = {};
        let totalConsumoCalculado = 0;

        listaFormatada.forEach(item => {
            const pessoa = item.clienteNome || item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
            if (!agrupados[pessoa]) agrupados[pessoa] = { itens: [], total: 0 };
            
            agrupados[pessoa].itens.push(item);
            
            const subtotalDoItem = item.precoCalculado * item.qtdCalculada;
            agrupados[pessoa].total += subtotalDoItem;
            totalConsumoCalculado += subtotalDoItem;
        });

        const jaPago = Array.isArray(pedido.pagamentosParciais) ? pedido.pagamentosParciais.reduce((acc, pgto) => acc + (Number(pgto.valor) || 0), 0) : 0;
        
        const valorFinalDoPedido = Number(pedido.totalFinal || pedido.total || totalConsumoCalculado);
        const restante = Math.max(0, valorFinalDoPedido - jaPago);

        return { 
            agrupados, 
            totalConsumo: valorFinalDoPedido > 0 ? valorFinalDoPedido : totalConsumoCalculado, 
            jaPago, 
            restante, 
            numero: pedido.numero || pedido.mesaNumero || 'Balcão',
            isMesa: pedido.isMesa,
            isVendaFinalizada: pedido.isVendaFinalizada, // Repassa a Flag!
            vazio: false
        };
    }, [pedido, setorAlvo]);

    useEffect(() => {
        if (!loading && printData && !error && !printData.vazio) {
            const realizarImpressao = async () => {
                // 🔥 CORREÇÃO: Usa as impressoras configuradas no Firestore ao invés de nomes fixos
                const ehSetorCozinha = setorAlvo === 'cozinha' || setorAlvo === 'bar';
                const nomeImpressora = ehSetorCozinha 
                    ? (impressoraConfig.cozinha || impressoraConfig.balcao) 
                    : (impressoraConfig.balcao || impressoraConfig.cozinha);

                // Se não tem impressora configurada, vai direto pro window.print()
                if (!nomeImpressora) {
                    console.log("Nenhuma impressora configurada no estabelecimento, usando impressão do navegador.");
                    window.focus();
                    setTimeout(() => window.print(), 500);
                    window.onafterprint = () => window.close();
                    return;
                }

                try {
                    if (!qz.websocket.isActive()) await qz.websocket.connect();
                    const htmlContent = document.getElementById('printable-receipt').outerHTML;
                    const config = qz.configs.create(nomeImpressora, { margins: { top: 0, bottom: 0, left: 0, right: 0 } });
                    
                    const data = [{
                        type: 'pixel',
                        format: 'html',
                        flavor: 'plain',
                        data: `<html><body style="margin:0;padding:0;font-family:monospace;">${htmlContent}</body></html>`
                    }];

                    await qz.print(config, data);
                    setTimeout(() => window.close(), 1000);
                } catch (err) {
                    console.log("QZ Tray não encontrado ou erro:", err);
                    window.focus();
                    setTimeout(() => window.print(), 500);
                    window.onafterprint = () => window.close();
                }
            };
            setTimeout(realizarImpressao, 1000); 
        }
    }, [loading, printData, error, setorAlvo, impressoraConfig]);

    const formatarMoeda = (valor) => (valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (loading) return <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'monospace' }}>Carregando impressão...</div>;
    
    if (error || !printData || printData.vazio) return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#000', fontFamily: 'monospace', fontWeight: 'bold' }}>
            <p>{error || `Nenhum item listado ou encontrado para o setor: ${setorAlvo?.toUpperCase() || ''}`}</p>
            <button className="no-print" onClick={() => window.close()} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: '#fff', borderRadius: '5px' }}>Fechar Janela</button>
        </div>
    );

    // 🔥 MUDA O TÍTULO SE FOR RECIBO PAGO 🔥
    let tituloImpressao = 'PRÉ-CONFERÊNCIA';
    if (printData.isVendaFinalizada) {
        tituloImpressao = 'RECIBO DE VENDA';
    } else if (!printData.isMesa) {
        tituloImpressao = setorAlvo && setorAlvo !== 'tudo' ? `PEDIDO: ${setorAlvo.toUpperCase()}` : 'NOVO PEDIDO';
    } else if (setorAlvo && setorAlvo !== 'tudo') {
        tituloImpressao = `PEDIDO: ${setorAlvo.toUpperCase()}`; 
    }

    return (
        <div id="printable-receipt" style={{ width: '100%', maxWidth: '300px', margin: '0 auto', backgroundColor: '#ffffff', fontFamily: "'Courier New', Courier, monospace", color: '#000000', padding: '5px' }}>
            
            <style>{`
                html, body { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-text-size-adjust: 100% !important; }
                table { border-collapse: collapse !important; width: 100% !important; table-layout: fixed !important; }
                td { padding: 2px 0 !important; vertical-align: top !important; word-wrap: break-word !important; }
                
                @media print {
                    html, body, #root { 
                        height: auto !important; 
                        min-height: auto !important;
                        width: 100% !important;
                        overflow: visible !important; 
                        position: static !important;
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    #printable-receipt { 
                        position: relative !important; 
                        height: auto !important; 
                        overflow: visible !important; 
                        max-width: 100% !important; 
                        width: 100% !important; 
                    }
                    @page { margin: 0; size: 80mm auto; }
                    .no-print { display: none !important; }
                    * { 
                        color: black !important; 
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
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
                    {pessoa !== 'Mesa' && (
                        <div style={{ borderBottom: '1px solid #000', marginBottom: '5px', paddingBottom: '2px' }}>
                            <table style={{ fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                <tbody>
                                    <tr>
                                        <td style={{ width: '65%', textAlign: 'left' }}>👤 {pessoa}</td>
                                        <td style={{ width: '35%', textAlign: 'right' }}>R$ {formatarMoeda(dados.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    <table style={{ fontSize: '12px' }}>
                        <tbody>
                            {dados.itens.map((item, idx) => {
                                let adicionais = [];
                                if (Array.isArray(item.adicionaisSelecionados)) adicionais = item.adicionaisSelecionados;
                                else if (Array.isArray(item.adicionais)) adicionais = item.adicionais;
                                else if (Array.isArray(item.produto?.adicionais)) adicionais = item.produto.adicionais;
                                else if (Array.isArray(item.item?.adicionais)) adicionais = item.item.adicionais;

                                return (
                                    <tr key={idx}>
                                        <td style={{ width: '75%', textAlign: 'left', paddingRight: '5px' }}>
                                            <span style={{fontWeight: 'bold', fontSize: '13px'}}>{item.qtdCalculada}x</span> <span style={{fontWeight: 'bold'}}>{item.nomeCalculado}</span>
                                            
                                            {(item.variacaoSelecionada || item.variacao) && (
                                                <div style={{ fontSize: '11px', marginTop: '2px', fontStyle: 'italic' }}>
                                                    - {item.variacaoSelecionada?.nome || item.variacao?.nome}
                                                </div>
                                            )}

                                            {adicionais.length > 0 && (
                                                <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                                    {adicionais.map((adc, i) => (
                                                        <div key={i}>+ {adc.nome}</div>
                                                    ))}
                                                </div>
                                            )}

                                            {item.obsCalculada && <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>* OBS: {item.obsCalculada}</div>}
                                        </td>
                                        <td style={{ width: '25%', textAlign: 'right', fontWeight: 'bold' }}>
                                            {formatarMoeda(item.precoCalculado * item.qtdCalculada)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px' }}>
                <table style={{ fontSize: '13px' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '60%', textAlign: 'left', fontWeight: 'bold' }}>TOTAL:</td>
                            <td style={{ width: '40%', textAlign: 'right', fontWeight: 'bold' }}>R$ {formatarMoeda(printData.totalConsumo)}</td>
                        </tr>
                    </tbody>
                </table>
                
                {/* 🔥 ESCONDE O "A PAGAR" SE A VENDA JÁ FOI FINALIZADA 🔥 */}
                {printData.isMesa && (!setorAlvo || setorAlvo === 'tudo') && !printData.isVendaFinalizada && (
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
                *** {printData.isVendaFinalizada ? 'NÃO É DOCUMENTO FISCAL' : (!printData.isMesa || (setorAlvo && setorAlvo !== 'tudo')) ? 'VIA DE PRODUÇÃO' : 'NÃO É DOCUMENTO FISCAL'} ***
            </div>
        </div>
    );
}