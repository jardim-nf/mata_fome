import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, writeBatch } from 'firebase/firestore';
import { db, auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { vendaService } from '../services/vendaService';
import { estoqueService } from '../services/estoqueService';
import { toast } from 'react-toastify';

export function useModalPagamentoData(mesa, estabelecimentoId, onClose, onSucesso) {
    // --- ESTADOS ---
    const [etapa, setEtapa] = useState(1);
    const [tipoPagamento, setTipoPagamento] = useState(null);
    const [pagamentos, setPagamentos] = useState({});
    const [selecionados, setSelecionados] = useState({});
    const [carregando, setCarregando] = useState(false);

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
        return Object.entries(pagamentos).reduce((acc, [pessoa, dados]) => {
            return selecionados[pessoa] ? acc + dados.valor : acc;
        }, 0);
    }, [pagamentos, selecionados]);

    const totalPagoGeral = jaPago + totalPagoAgora;
    const restanteFinal = (totalConsumo + valorTaxa - valorDesconto) - totalPagoGeral;
    const vaiQuitar = restanteFinal <= 0.10;
    const troco = restanteFinal < -0.10 ? Math.abs(restanteFinal) : 0;

    // --- AGRUPAMENTO DE ITENS ---
    const agruparItensPorPessoa = useMemo(() => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];
        if (listaItens.length === 0) return {};

        const agrupados = {};
        const pessoasPagas = mesa?.pessoasPagas || [];

        listaItens.forEach(item => {
            if (item.status === 'cancelado') return;
            let pessoa = item.cliente || item.destinatario || item.nomeOcupante || 'Mesa';
            if ((!pessoa || pessoa === 'Mesa') && mesa?.nomesOcupantes?.length > 0) {
                if (!item.cliente && !item.destinatario) pessoa = mesa.nomesOcupantes[0];
            }
            if (!pessoa) pessoa = 'Cliente 1';

            if (pessoasPagas.includes(pessoa)) return;

            if (!agrupados[pessoa]) {
                agrupados[pessoa] = { itens: [], total: 0 };
            }

            const qtd = item.quantidade || item.qtd || 1;
            agrupados[pessoa].itens.push(item);
            agrupados[pessoa].total += (item.preco * qtd);
        });

        return agrupados;
    }, [mesa]);

    // --- INICIALIZAÇÃO E ATUALIZAÇÃO ---
    useEffect(() => {
        const listaItens = mesa?.itens || mesa?.pedidos || [];

        if (tipoPagamento === 'unico') {
            const key = 'Pagamento Único';
            setPagamentos({
                [key]: {
                    valor: restanteMesa,
                    formaPagamento: 'dinheiro',
                    itens: listaItens.filter(i => i.status !== 'cancelado')
                }
            });
            setSelecionados({ [key]: true });
        } else if (tipoPagamento === 'individual') {
            const pagamentosIniciais = {};
            const selecionadosIniciais = {};
            const grupos = agruparItensPorPessoa;

            if (Object.keys(grupos).length === 0) {
                const key = 'Mesa / Restante';
                pagamentosIniciais[key] = {
                    valor: restanteMesa,
                    formaPagamento: 'dinheiro',
                    itens: listaItens.filter(i => i.status !== 'cancelado')
                };
                selecionadosIniciais[key] = false;
            } else {
                Object.entries(grupos).forEach(([pessoa, dados]) => {
                    const taxaPessoa = incluirTaxa ? (dados.total * 0.10) : 0;
                    const descontoPessoa = valorDesconto > 0 ? (valorDesconto * (dados.total / totalConsumo)) : 0;
                    const valorSugerido = Math.min(dados.total + taxaPessoa - descontoPessoa, restanteMesa);

                    pagamentosIniciais[pessoa] = {
                        valor: valorSugerido > 0 ? valorSugerido : 0,
                        formaPagamento: 'dinheiro',
                        itens: dados.itens
                    };
                    selecionadosIniciais[pessoa] = false;
                });
            }
            setPagamentos(pagamentosIniciais);
            setSelecionados(selecionadosIniciais);
        }
    }, [tipoPagamento, agruparItensPorPessoa, mesa, incluirTaxa, valorDesconto, totalConsumo, restanteMesa]);

    // --- AÇÕES UI COMPORTAMENTAIS ---
    const toggleSelecao = useCallback((pessoa) => {
        setSelecionados(prev => ({ ...prev, [pessoa]: !prev[pessoa] }));
    }, []);

    const editarFormaPagamento = useCallback((pessoaId, novaForma) => {
        setPagamentos(prev => ({
            ...prev,
            [pessoaId]: { ...prev[pessoaId], formaPagamento: novaForma }
        }));
    }, []);

    const editarValorPagamento = useCallback((pessoaId, novoValor) => {
        let valorFormatado = novoValor;
        if (typeof novoValor === 'string') valorFormatado = novoValor.replace(',', '.');
        const valorNovoFloat = parseFloat(valorFormatado) || 0;

        setPagamentos(prev => ({
            ...prev,
            [pessoaId]: { ...prev[pessoaId], valor: valorNovoFloat }
        }));
        setSelecionados(prev => ({ ...prev, [pessoaId]: true }));
    }, []);

    const adicionarPessoa = useCallback(() => {
        setPagamentos(prev => {
            const novaPessoa = `Pagante Extra ${Object.keys(prev).length + 1}`;
            return { ...prev, [novaPessoa]: { valor: 0, formaPagamento: 'dinheiro', itens: [] } };
        });
        setSelecionados(prev => {
            const novaPessoa = `Pagante Extra ${Object.keys(pagamentos).length + 1}`;
            return { ...prev, [novaPessoa]: true };
        });
    }, [pagamentos]);

    const removerPessoa = useCallback((pessoaId) => {
        if (Object.keys(pagamentos).length <= 1) return;
        setPagamentos(prev => {
            const novos = { ...prev }; delete novos[pessoaId]; return novos;
        });
        setSelecionados(prev => {
            const novos = { ...prev }; delete novos[pessoaId]; return novos;
        });
    }, [pagamentos]);

    const dividirIgualmente = useCallback((qtd) => {
        const numPagantes = parseInt(qtd, 10);
        if (isNaN(numPagantes) || numPagantes <= 1 || restanteMesa <= 0) return;
        
        const valorPorPessoa = parseFloat((restanteMesa / numPagantes).toFixed(2));
        let valores = Array(numPagantes).fill(valorPorPessoa);
        
        const soma = valores.reduce((a, b) => a + b, 0);
        const dif = parseFloat((restanteMesa - soma).toFixed(2));
        if (Math.abs(dif) > 0) {
            valores[0] = parseFloat((valores[0] + dif).toFixed(2));
        }

        const novosPagamentos = {};
        const novosSelecionados = {};
        
        for (let i = 0; i < numPagantes; i++) {
            const nome = `Rateio \u{1F464} ${i + 1}`;
            novosPagamentos[nome] = {
                valor: valores[i],
                formaPagamento: 'dinheiro',
                itens: []
            };
            novosSelecionados[nome] = true;
        }
        
        setPagamentos(novosPagamentos);
        setSelecionados(novosSelecionados);
    }, [restanteMesa]);

    // --- IMPRESSÃO E SCRIPT LITERAL COM WINDOW ---
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

        // 🔥 NOVO: Agrupa os itens para mostrar o nome de cada pagante/comanda na impressão!
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
                <title>Conferência - Mesa ${mesa?.numero}</title>
                <style>
                    @media print { @page { margin: 0; size: 80mm auto; } body { margin: 0; } }
                    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0; padding: 5px; color: #000; background: #fff; font-weight: bold; }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; }
                    .header h2 { font-size: 14px; margin: 0; text-transform: uppercase; }
                    .pagante-block { margin-bottom: 8px; }
                    .pagante-header { display: flex; justify-content: space-between; font-weight: 900; border-bottom: 1px solid #000; margin-bottom: 2px; text-transform: uppercase; }
                    .item-row { display: flex; justify-content: space-between; padding-left: 5px; font-size: 11px; margin-bottom: 1px; }
                    .obs-row { font-size: 10px; padding-left: 10px; display: block; }
                    .resumo-box { border-top: 1px dashed #000; margin-top: 10px; padding-top: 5px; }
                    .linha-resumo { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px; }
                    .linha-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>PRÉ-CONFERÊNCIA</h2>
                    <p style="font-size: 14px; margin: 5px 0;">MESA ${mesa?.numero}</p>
                    <p style="font-size: 10px;">${new Date().toLocaleString('pt-BR')}</p>
                </div>

                ${Object.entries(gruposDisplay).map(([pessoa, dados]) => `
                    <div class="pagante-block">
                        <div class="pagante-header">
                            <span>${pessoa === 'Mesa' ? 'CONSUMO GERAL MESA' : `👤 ${pessoa}`}</span>
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
        win.document.write(conteudo);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); win.close(); }, 500);
    };

    // --- FINALIZAÇÕES ---
    const handleFinalizar = async (modo) => {
        setCarregando(true);
        try {
            const pagamentosValidos = Object.fromEntries(
                Object.entries(pagamentos).filter(([k]) => selecionados[k] && pagamentos[k].valor > 0)
            );

            const todosItensMesa = mesa?.itens || mesa?.pedidos || [];
            const itensValidos = Object.values(pagamentosValidos).flatMap(p => p.itens || []);
            const itensCancelados = todosItensMesa.filter(i => i.status === 'cancelado');
            const itensParaSalvar = [...itensValidos, ...itensCancelados];

            const primeiraPessoaValida = Object.values(pagamentosValidos)[0];
            const formaPagamentoPredominante = primeiraPessoaValida ? primeiraPessoaValida.formaPagamento : 'dinheiro';

            // ---- REFATORAÇÃO DE SEGURANÇA: ENVIAR PARA A CLOUD FUNCTION ----
            const fecharMesaBackend = httpsCallable(functions, 'fecharMesaBackend');
            
            const reqData = {
                estabelecimentoId,
                mesaId: mesa.id,
                pagamentosValidos,
                incluirTaxa,
                valorDescontoInput: parseFloat(valorDescontoInput) || 0,
                tipoDesconto,
                modo,
                cpfNota,
                emitirNota
            };

            const response = await fecharMesaBackend(reqData);
            
            if (!response.data || !response.data.success) {
                throw new Error(response.data?.message || 'Falha ao processar pagamento no servidor.');
            }

            const docId = response.data.vendaId;
            const quitouMesa = response.data.quitada;
            const restanteApos = response.data.restanteFinal;
            // ---------------------------------------------------------------
            
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

            // Mock dadosVenda for onSucesso to avoid breaking UI that relies on it
            const dadosVendaSimulados = {
                id: docId,
                vendaId: docId,
                total: totalPagoAgora,
                status: quitouMesa ? 'pago' : 'pago_parcial',
                itens: itensParaSalvar,
                createdAt: new Date(),
                estabelecimentoId: estabelecimentoId
            };

            if (onSucesso) onSucesso({ ...dadosVendaSimulados, parcial: !quitouMesa });
            
            try {
                if (typeof isMaquininha === 'undefined' || !isMaquininha) onClose();
            } catch (e) {
                onClose(); // Fallback
            }

        } catch (error) {
            console.error('Erro:', error);
            toast.error('Erro: ' + error.message);
        } finally {
            setCarregando(false);
        }
    };

    return {
        // Form states
        etapa, setEtapa,
        tipoPagamento, setTipoPagamento,
        pagamentos, 
        selecionados, 
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
        totalPagoGeral,
        restanteFinal,
        vaiQuitar,
        troco,

        // Agrupamentos
        agruparItensPorPessoa,

        // Handlers
        toggleSelecao,
        editarFormaPagamento,
        editarValorPagamento,
        adicionarPessoa,
        removerPessoa,
        dividirIgualmente,
        handleImprimirConferencia,
        handleFinalizar
    };
}
