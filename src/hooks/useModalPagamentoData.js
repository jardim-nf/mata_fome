import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, updateDoc, doc } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { vendaService } from '../services/vendaService';
import { toast } from 'react-toastify';
import { getTerminology } from '../utils/terminologyUtils';

export function useModalPagamentoData(mesa, estabelecimentoId, tipoNegocio, onClose, onSucesso) {
    // --- ESTADOS ---
    const [pagamentosLancados, setPagamentosLancados] = useState([]);
    const [valorALancar, setValorALancar] = useState('');
    const [carregando, setCarregando] = useState(false);
    const finalizandoRef = useRef(false);

    // NFC-e
    const [emitirNota, setEmitirNota] = useState(false);
    const [cpfNota, setCpfNota] = useState('');

    // Taxas e Descontos
    const [incluirTaxa, setIncluirTaxa] = useState(false);
    const [tipoDesconto, setTipoDesconto] = useState('reais'); // 'reais' ou 'porcentagem'
    const [valorDescontoInput, setValorDescontoInput] = useState('');

    // --- CÁLCULOS FINANCEIROS (MEMOS) ---
    const totalConsumo = useMemo(() => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        return listaItens.reduce((acc, item) => {
            if (item.status === 'cancelado') return acc;
            const qtd = item.quantidade || item.qtd || 1;
            return acc + (item.preco * qtd);
        }, 0);
    }, [mesa]);

    const valorTaxa = useMemo(() => {
        if (!incluirTaxa) return 0;
        return totalConsumo * 0.10;
    }, [incluirTaxa, totalConsumo]);

    const valorDesconto = useMemo(() => {
        const numDesconto = parseFloat(valorDescontoInput) || 0;
        if (numDesconto <= 0) return 0;
        if (tipoDesconto === 'porcentagem') {
            const percentualSeguro = Math.min(numDesconto, 100);
            return totalConsumo * (percentualSeguro / 100);
        }
        return Math.min(numDesconto, totalConsumo);
    }, [totalConsumo, valorDescontoInput, tipoDesconto]);

    const jaPago = useMemo(() => {
        const historico = mesa?.pagamentosParciais || [];
        return historico.reduce((acc, pgto) => acc + (Number(pgto.valor) || 0), 0);
    }, [mesa]);

    const restanteMesa = useMemo(() => {
        return Math.max(0, (totalConsumo + valorTaxa - valorDesconto) - jaPago);
    }, [totalConsumo, valorTaxa, valorDesconto, jaPago]);

    const totalPagoAgora = useMemo(() => {
        return pagamentosLancados.reduce((acc, p) => acc + p.valor, 0);
    }, [pagamentosLancados]);

    const restanteFinal = useMemo(() => {
        return Math.max(0, restanteMesa - totalPagoAgora);
    }, [restanteMesa, totalPagoAgora]);

    const vaiQuitar = restanteFinal <= 0.10;
    const troco = totalPagoAgora > restanteMesa ? Math.abs(totalPagoAgora - restanteMesa) : 0;

    // --- AUTO-FILL VALOR A LANCAR ---
    useEffect(() => {
        setValorALancar(restanteFinal > 0 ? restanteFinal.toFixed(2) : '');
    }, [restanteFinal]);

    // --- AGRUPAMENTO DE ITENS POR PESSOA ---
    const agruparItensPorPessoa = useMemo(() => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        if (listaItens.length === 0) return {};

        const agrupados = {};
        const termMesa = getTerminology('mesa', tipoNegocio);

        listaItens.forEach(item => {
            if (item.status === 'cancelado') return;
            let pessoa = item.cliente || item.destinatario || item.nomeOcupante || termMesa;
            if ((!pessoa || pessoa === 'Mesa' || pessoa === termMesa) && mesa?.nomesOcupantes?.length > 0) {
                if (!item.cliente && !item.destinatario) pessoa = mesa.nomesOcupantes[0];
            }
            if (!pessoa) pessoa = 'Cliente 1';

            if (!agrupados[pessoa]) {
                agrupados[pessoa] = { itens: [], total: 0 };
            }

            const qtd = item.quantidade || item.qtd || 1;
            agrupados[pessoa].itens.push(item);
            agrupados[pessoa].total += (item.preco * qtd);
        });

        return agrupados;
    }, [mesa, tipoNegocio]);

    // Reset when modal opens
    useEffect(() => {
        setPagamentosLancados([]);
        setValorALancar('');
        setValorDescontoInput('');
        setIncluirTaxa(false);
        setEmitirNota(false);
        setCpfNota('');
    }, [mesa]);

    // --- AÇÕES UI ---
    const adicionarPagamento = useCallback((forma) => {
        const cleanVal = (valorALancar || '').toString().replace(',', '.').trim();
        let v = parseFloat(cleanVal);
        if (isNaN(v) || v <= 0) {
            v = restanteFinal;
        }
        if (v <= 0) return;

        // Limita o valor ao restante para cartão/pix/crediário. Dinheiro pode passar (gera troco).
        const valorAAdicionar = (forma === 'dinheiro') ? v : Math.min(v, restanteFinal);
        if (valorAAdicionar <= 0) return;

        setPagamentosLancados(prev => {
            const existeIdx = prev.findIndex(p => p.forma === forma);
            if (existeIdx > -1) {
                const novos = [...prev];
                novos[existeIdx].valor = parseFloat((novos[existeIdx].valor + valorAAdicionar).toFixed(2));
                return novos;
            } else {
                return [...prev, { forma, valor: parseFloat(valorAAdicionar.toFixed(2)) }];
            }
        });
    }, [valorALancar, restanteFinal]);

    const removerPagamento = useCallback((idx) => {
        setPagamentosLancados(prev => prev.filter((_, i) => i !== idx));
    }, []);

    // --- IMPRESSÃO E CONFERÊNCIA ---
    const handleImprimirConferencia = async () => {
        if (!estabelecimentoId || !mesa?.id) {
            toast.error("Erro: Dados da mesa ou estabelecimento não encontrados.");
            return;
        }

        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || window.innerWidth < 1024;

        if (isMobileDevice) {
            try {
                const mesaRef = doc(db, "estabelecimentos", estabelecimentoId, "mesas", mesa.id);
                await updateDoc(mesaRef, {
                    solicitarImpressaoConferencia: true,
                    timestampImpressao: new Date().toISOString() 
                });
                toast.success("Conferência enviada para a impressora do caixa!");
            } catch (erro) {
                console.error("Erro ao solicitar impressão:", erro);
                toast.error("Erro ao comunicar com a impressora.");
            }
            return; 
        }

        const listaItens = mesa?.itens || mesa?.pedidos || [];
        const todosItensAtivos = listaItens.filter(i => i.status !== 'cancelado');

        const gruposDisplay = {};
        todosItensAtivos.forEach(item => {
            let pessoa = item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
            if ((!pessoa || pessoa === 'Mesa') && mesa?.nomesOcupantes?.length > 0) {
                if (!item.cliente && !item.destinatario) pessoa = mesa.nomesOcupantes[0];
            }
            if (!pessoa) pessoa = 'Mesa';
            
            if (!gruposDisplay[pessoa]) gruposDisplay[pessoa] = { itens: [], total: 0 };
            const qtd = item.quantidade || item.qtd || 1;
            gruposDisplay[pessoa].itens.push(item);
            gruposDisplay[pessoa].total += (item.preco * qtd);
        });

        const conteudo = `
            <html>
            <head>
                <title>Conferência - ${getTerminology('mesa', tipoNegocio)} ${mesa?.numero}</title>
                <style>
                    @media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; } }
                    body { font-family: 'Courier New', monospace; font-size: 15px; width: 80mm; margin: 0; padding: 5px; color: #000; background: #fff; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    .header h2 { font-size: 18px; margin: 0; text-transform: uppercase; }
                    .pagante-block { margin-bottom: 8px; }
                    .pagante-header { display: flex; justify-content: space-between; font-weight: 900; border-bottom: 1px solid #000; margin-bottom: 2px; text-transform: uppercase; font-size: 15px; }
                    .item-row { display: flex; justify-content: space-between; padding-left: 5px; font-size: 14px; margin-bottom: 1px; }
                    .obs-row { font-size: 13px; padding-left: 10px; display: block; }
                    .resumo-box { border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; }
                    .linha-resumo { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 2px; }
                    .linha-total { display: flex; justify-content: space-between; font-size: 20px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>PRÉ-CONFERÊNCIA</h2>
                    <p style="font-size: 18px; margin: 5px 0;">${getTerminology('mesa', tipoNegocio).toUpperCase()} ${mesa?.numero}</p>
                    <p style="font-size: 12px;">${new Date().toLocaleString('pt-BR')}</p>
                </div>

                ${Object.entries(gruposDisplay).map(([pessoa, dados]) => `
                    <div class="pagante-block">
                        <div class="pagante-header">
                            <span>${(pessoa === 'Mesa' || pessoa === getTerminology('mesa', tipoNegocio)) ? `CONSUMO GERAL ${getTerminology('mesa', tipoNegocio).toUpperCase()}` : `👤 ${pessoa}`}</span>
                            <span>R$ ${dados.total.toFixed(2)}</span>
                        </div>
                        ${dados.itens.filter(i => i.preco > 0).map(item => {
                            let formatado = `<div class="item-row">
                                <span>${item.quantidade || item.qtd || 1}x ${(item.nome || '').substring(0,25)}</span>
                                <span>${((item.preco || 0) * (item.quantidade || item.qtd || 1)).toFixed(2)}</span>
                            </div>`;

                            if (item.variacao || item.variacaoSelecionada) {
                                formatado += `<span class="obs-row">- ${item.variacao?.nome || item.variacaoSelecionada?.nome}</span>`;
                            }
                            return formatado;
                        }).join('')}
                    </div>
                `).join('')}

                ${todosItensAtivos.length === 0 ? '<div class="item-row"><i>Nenhum item lançado</i></div>' : ''}

                <div class="resumo-box">
                    <div class="linha-resumo"><span>TOTAL CONSUMO:</span><span>R$ ${totalConsumo.toFixed(2)}</span></div>
                    ${incluirTaxa ? `<div class="linha-resumo"><span>TAXA SERVIÇO (10%):</span><span>R$ ${valorTaxa.toFixed(2)}</span></div>` : ''}
                    ${valorDesconto > 0 ? `<div class="linha-resumo"><span>(-) DESCONTO:</span><span>R$ ${valorDesconto.toFixed(2)}</span></div>` : ''}
                    ${jaPago > 0 ? `<div class="linha-resumo"><span>(-) JÁ PAGO:</span><span>R$ ${jaPago.toFixed(2)}</span></div>` : ''}
                    <div class="linha-total"><span>A PAGAR:</span><span>R$ ${restanteMesa.toFixed(2)}</span></div>
                </div>
                <br/>
                <div style="text-align:center; font-size:10px;">*** NÃO É DOCUMENTO FISCAL ***</div>
            </body>
            </html>
        `;
        
        const win = window.open('', '', 'height=600,width=400');
        if (!win) {
            toast.error("⚠️ Popup bloqueado! Vá em Configurações do navegador e permita popups neste site.");
            return;
        }
        win.document.write(conteudo);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
    };

    // --- FINALIZAÇÕES ---
    const handleFinalizar = async (modo) => {
        if (finalizandoRef.current) return;
        finalizandoRef.current = true;
        setCarregando(true);
        try {
            // Mapeia o array de pagamentos lançados para o objeto esperado pelo backend
            const pagamentosValidos = {};
            pagamentosLancados.forEach((p, idx) => {
                const label = `Pagamento ${idx + 1} (${p.forma.toUpperCase()})`;
                pagamentosValidos[label] = {
                    valor: p.valor,
                    formaPagamento: p.forma,
                    itens: [] // O backend usará o fallback de carregar todos os itens da mesa
                };
            });

            const fecharMesaBackend = httpsCallable(functions, 'fecharMesaBackend');
            
            const rawReqData = {
                estabelecimentoId,
                mesaId: mesa.id,
                pagamentosValidos,
                incluirTaxa,
                valorDescontoInput: parseFloat(valorDescontoInput) || 0,
                tipoDesconto,
                modo, // 'total' ou 'parcial'
                cpfNota,
                emitirNota
            };

            const reqData = JSON.parse(JSON.stringify(rawReqData, (key, value) => {
                if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
                    return 0;
                }
                return value;
            }));

            const response = await fecharMesaBackend(reqData);
            
            if (!response.data || !response.data.success) {
                throw new Error(response.data?.message || 'Falha ao processar pagamento no servidor.');
            }

            const docId = response.data.vendaId;
            const quitouMesa = response.data.quitada;
            const restanteApos = response.data.restanteFinal;
            
            let mensagemToast = "";
            if (quitouMesa) {
                mensagemToast = "Conta quitada! Mesa liberada.";
            } else {
                mensagemToast = `Recebido R$ ${totalPagoAgora.toFixed(2)}. Restam R$ ${restanteApos.toFixed(2)}`;
            }

            toast.success(mensagemToast);

            if (emitirNota) {
                toast.info("Processando Cupom Fiscal...", { autoClose: 3000 });
                const resultadoNfce = await vendaService.emitirNfce(docId, cpfNota);
                if (resultadoNfce.sucesso) toast.success("Nota enviada para a Sefaz!");
                else toast.error("Venda salva, mas ocorreu erro na nota: " + resultadoNfce.error);
            }

            const dadosVendaSimulados = {
                id: docId,
                vendaId: docId,
                total: totalPagoAgora,
                status: quitouMesa ? 'pago' : 'pago_parcial',
                itens: (mesa?.itens || []).filter(i => i.status !== 'cancelado'),
                createdAt: new Date(),
                estabelecimentoId: estabelecimentoId
            };

            if (onSucesso) onSucesso({ ...dadosVendaSimulados, parcial: !quitouMesa });
            
            setCarregando(false);
            onClose();
            return;

        } catch (error) {
            console.error('Erro:', error);
            if (error.message?.includes('já foi processado') || error.message?.includes('já está sendo fechada')) {
                toast.warn(error.message);
            } else {
                toast.error('Erro: ' + error.message);
            }
            setCarregando(false);
            finalizandoRef.current = false;
        }
    };

    return {
        carregando,
        emitirNota, setEmitirNota,
        cpfNota, setCpfNota,
        incluirTaxa, setIncluirTaxa,
        tipoDesconto, setTipoDesconto,
        valorDescontoInput, setValorDescontoInput,

        // Calcs
        totalConsumo,
        valorTaxa,
        valorDesconto,
        jaPago,
        restanteMesa,
        totalPagoAgora,
        restanteFinal,
        vaiQuitar,
        troco,

        // Novo POS-style states
        pagamentosLancados,
        valorALancar, setValorALancar,
        adicionarPagamento,
        removerPagamento,
        handleImprimirConferencia,
        handleFinalizar,
        
        // Agrupamentos
        agruparItensPorPessoa
    };
}
