import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
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

        const dadosBase = (etapa > 1 && Object.keys(pagamentos).length > 0) ? pagamentos : agruparItensPorPessoa;
        const dadosParaImpressao = etapa > 1 ? 
            Object.fromEntries(Object.entries(dadosBase).filter(([k]) => selecionados[k])) : 
            dadosBase;

        const dadosFinais = Object.keys(dadosParaImpressao).length > 0 ? dadosParaImpressao : agruparItensPorPessoa;

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

                ${Object.entries(dadosFinais).map(([pessoa, dados]) => `
                    <div class="pagante-block">
                        <div class="pagante-header">
                            <span>${pessoa.substring(0, 15)}</span>
                            <span>R$ ${(dados.valor !== undefined ? dados.valor : dados.total).toFixed(2)}</span>
                        </div>
                        ${dados.itens?.filter(i => i.preco > 0).map(item => `
                            <div class="item-row">
                                <span>${item.quantidade || 1}x ${item.nome.substring(0,20)}</span>
                                <span>${((item.preco || 0) * (item.quantidade || 1)).toFixed(2)}</span>
                            </div>
                        `).join('') || '<div class="item-row"><i>Valor Manual</i></div>'}
                    </div>
                `).join('')}

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

            const dadosVenda = {
                mesaId: mesa.id,
                mesaNumero: mesa.numero,
                estabelecimentoId: estabelecimentoId,
                itens: itensParaSalvar,
                pagamentos: pagamentosValidos,
                total: totalPagoAgora, 
                valorOriginal: totalConsumo,
                taxaServicoCobrada: incluirTaxa ? valorTaxa : 0,
                valorDesconto: valorDesconto,
                tipoDesconto: tipoDesconto,
                valorDescontoInput: parseFloat(valorDescontoInput) || 0,
                tipoPagamento: formaPagamentoPredominante,
                metodoPagamento: formaPagamentoPredominante, 
                status: vaiQuitar ? 'pago' : 'pago_parcial',
                criadoEm: serverTimestamp(),
                createdAt: serverTimestamp(),
                criadoPor: auth.currentUser?.uid,
                funcionario: auth.currentUser?.displayName || 'Garçom'
            };

            const docRef = await addDoc(collection(db, 'vendas'), dadosVenda);

            if (modo === 'total' || vaiQuitar) {
                const itensParaBaixaEstoque = itensValidos.filter(i => !i._estoqueBaixado);
                if (itensParaBaixaEstoque.length > 0) await estoqueService.darBaixaEstoque(estabelecimentoId, itensParaBaixaEstoque);
            }

            if (emitirNota) {
                toast.info("Processando Cupom Fiscal...", { autoClose: 3000 });
                const resultadoNfce = await vendaService.emitirNfce(docRef.id, cpfNota);
                if (resultadoNfce.sucesso) toast.success("Nota enviada para a Sefaz!");
                else toast.error("Venda salva, mas ocorreu erro na nota: " + resultadoNfce.error);
            }

            if (mesa.id) {
                if (modo === 'total' || vaiQuitar) {
                    await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), {
                        status: 'livre',
                        clientes: [],
                        nomesOcupantes: ["Mesa"],
                        itens: [],
                        pedidos: [],
                        total: 0,
                        pagamentos: {},
                        pagamentosParciais: [],
                        updatedAt: serverTimestamp()
                    });
                    toast.success("Conta quitada! Mesa liberada.");
                } else {
                    const pagantesArray = Object.keys(pagamentosValidos).filter(nome => !nome.includes('Mesa'));
                    
                    const novoPagamentoInfo = {
                        id: docRef.id,
                        valor: totalPagoAgora,
                        data: new Date().toISOString(),
                        responsavel: auth.currentUser?.displayName || 'Garçom',
                        tipo: tipoPagamento,
                        pagantes: pagantesArray.length > 0 ? pagantesArray.join(', ') : ''
                    };

                    const mesaUpdate = {
                        status: 'ocupada',
                        total: restanteFinal,
                        pagamentosParciais: arrayUnion(novoPagamentoInfo),
                        updatedAt: serverTimestamp()
                    };
                    
                    if (pagantesArray.length > 0) {
                        mesaUpdate.pessoasPagas = arrayUnion(...pagantesArray);
                    }

                    await updateDoc(doc(db, `estabelecimentos/${estabelecimentoId}/mesas/${mesa.id}`), mesaUpdate);
                    toast.success(`Recebido R$ ${totalPagoAgora.toFixed(2)}. Restam R$ ${restanteFinal.toFixed(2)}`);
                }
            }

            if (onSucesso) onSucesso({ id: docRef.id, ...dadosVenda, parcial: !vaiQuitar });
            onClose();

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
        handleImprimirConferencia,
        handleFinalizar
    };
}
