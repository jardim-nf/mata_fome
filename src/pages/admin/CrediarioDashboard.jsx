// src/pages/admin/CrediarioDashboard.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BackButton from '../../components/BackButton';
import { db } from '../../firebase';
import { collection, query, getDocs, doc, updateDoc, getDoc, setDoc, orderBy, where } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { 
    IoSearch, IoWalletOutline, IoPrintOutline, IoCheckmarkCircleOutline, 
    IoClose, IoCalendarOutline, IoCardOutline, IoPersonOutline, IoCreateOutline 
} from 'react-icons/io5';

const formatarMoeda = (val) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function CrediarioDashboard() {
    const { estabelecimentoIdPrincipal } = useAuth();
    const [clientes, setClientes] = useState([]);
    const [busca, setBusca] = useState('');
    const [carregando, setCarregando] = useState(true);

    // States de Ação
    const [clienteSelecionado, setClienteSelecionado] = useState(null);
    const [modalBaixa, setModalBaixa] = useState(false);
    const [modalLimite, setModalLimite] = useState(false);
    const [modalExtrato, setModalExtrato] = useState(false);

    // Form inputs
    const [valorBaixa, setValorBaixa] = useState('');
    const [acrescimoBaixa, setAcrescimoBaixa] = useState('0');
    const [meioPagamento, setMeioPagamento] = useState('dinheiro');
    const [novoLimite, setNovoLimite] = useState('');
    const [saving, setSaving] = useState(false);

    // Extrato History
    const [historico, setHistorico] = useState([]);
    const [loadingHistorico, setLoadingHistorico] = useState(false);

    // Recebimento por notas
    const [notasPendentes, setNotasPendentes] = useState([]);
    const [notasSelecionadas, setNotasSelecionadas] = useState([]);
    const [loadingNotas, setLoadingNotas] = useState(false);

    // Ref para impressão
    const printAreaRef = useRef();

    // Carregar clientes do estabelecimento
    const carregarClientes = async () => {
        if (!estabelecimentoIdPrincipal) return;
        setCarregando(true);
        try {
            const q = query(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes'));
            const snap = await getDocs(q);
            const list = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                limiteCrediario: Number(d.data().limiteCrediario || 0),
                saldoDevedor: Number(d.data().saldoDevedor || 0)
            }));
            // Ordenar por maior saldo devedor primeiro
            list.sort((a, b) => b.saldoDevedor - a.saldoDevedor);
            setClientes(list);
        } catch (e) {
            console.error("Erro ao carregar clientes do crediário:", e);
            toast.error("Erro ao carregar lista do crediário.");
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        carregarClientes();
    }, [estabelecimentoIdPrincipal]);

    // Filtrar clientes
    const clientesFiltrados = useMemo(() => {
        const t = busca.toLowerCase().trim();
        if (!t) return clientes;
        return clientes.filter(c => 
            (c.nome || '').toLowerCase().includes(t) ||
            (c.telefone || '').includes(t) ||
            (c.cpf || '').includes(t)
        );
    }, [clientes, busca]);

    // Resumos Gerais
    const totalDevedorGlobal = useMemo(() => {
        return clientes.reduce((acc, c) => acc + c.saldoDevedor, 0);
    }, [clientes]);

    const totalDevedoresCount = useMemo(() => {
        return clientes.filter(c => c.saldoDevedor > 0).length;
    }, [clientes]);

    const totalLimiteConcedido = useMemo(() => {
        return clientes.reduce((acc, c) => acc + c.limiteCrediario, 0);
    }, [clientes]);

    // Carregar histórico do crediário do cliente
    const carregarHistoricoCrediario = async (cliente) => {
        setLoadingHistorico(true);
        setHistorico([]);
        try {
            // 1. Carregar histórico oficial (baixas, pagamentos e compras registradas no sub-documento)
            const q = query(
                collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', cliente.id, 'historico_crediario')
            );
            const snap = await getDocs(q);
            const listOficial = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    data: data.data?.toDate ? data.data.toDate() : (data.data ? new Date(data.data) : new Date())
                };
            });

            // 2. Buscar vendas na coleção global de vendas para preencher histórico retroativo
            const qVendas = query(
                collection(db, 'vendas'),
                where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
                where('clienteId', '==', cliente.id)
            );
            const vSnap = await getDocs(qVendas);
            const vendasCrediario = [];
            
            vSnap.forEach(docSnap => {
                const vData = docSnap.data();
                const pagamentos = vData.pagamentos || [];
                const valorCrediario = pagamentos
                    .filter(p => p.forma === 'crediario')
                    .reduce((acc, p) => acc + p.valor, 0);

                if (valorCrediario > 0) {
                    vendasCrediario.push({
                        id: docSnap.id,
                        valorCrediario,
                        itens: vData.itens || [],
                        data: vData.createdAt?.toDate ? vData.createdAt.toDate() : (vData.criadoEm?.toDate ? vData.criadoEm.toDate() : new Date())
                    });
                }
            });

            // 3. Mesclar as vendas da coleção global que não estão no histórico oficial
            const listMesclada = [...listOficial];
            
            vendasCrediario.forEach(v => {
                const jaExiste = listOficial.some(h => h.vendaId === v.id);
                if (!jaExiste) {
                    listMesclada.push({
                        id: `v_${v.id}`,
                        tipo: 'compra',
                        valor: v.valorCrediario,
                        descricao: `Venda #${v.id.slice(-6).toUpperCase()}`,
                        vendaId: v.id,
                        data: v.data,
                        itens: v.itens.map(item => ({
                            nome: item.nome || item.name || 'Item',
                            quantidade: item.quantidade || item.quantity || item.qtd || 1,
                            preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                        }))
                    });
                }
            });

            // Ordenar por data decrescente
            listMesclada.sort((a, b) => b.data - a.data);
            setHistorico(listMesclada);

            // 4. Carregar itens em background para lançamentos oficiais que vieram sem array 'itens'
            listMesclada.forEach(async (h) => {
                if (h.tipo === 'compra' && (!h.itens || h.itens.length === 0) && h.vendaId && !h.id.startsWith('v_')) {
                    try {
                        const vDocSnap = await getDoc(doc(db, 'vendas', h.vendaId));
                        if (vDocSnap.exists() && vDocSnap.data().itens) {
                            const itensDaVenda = vDocSnap.data().itens.map(item => ({
                                nome: item.nome || item.name || 'Item',
                                quantidade: item.quantidade || item.quantity || item.qtd || 1,
                                preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                            }));
                            
                            // Atualizar estado com os itens carregados
                            setHistorico(current => current.map(itemHist => {
                                if (itemHist.id === h.id) {
                                    return { ...itemHist, itens: itensDaVenda };
                                }
                                return itemHist;
                            }));
                        }
                    } catch (err) {
                        console.error(`Erro ao resgatar itens da venda antiga ${h.vendaId}:`, err);
                    }
                }
            });

        } catch (e) {
            console.error("Erro ao carregar histórico do crediário:", e);
            toast.error("Erro ao carregar histórico.");
        } finally {
            setLoadingHistorico(false);
        }
    };

    // Ação: Editar Limite
    const handleSalvarLimite = async (e) => {
        e.preventDefault();
        const limitNum = parseFloat(novoLimite);
        if (isNaN(limitNum) || limitNum < 0) return toast.warn("Digite um limite válido!");
        setSaving(true);
        try {
            // Atualiza na subcoleção
            const cRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', clienteSelecionado.id);
            await updateDoc(cRef, { limiteCrediario: limitNum });

            // Atualiza na coleção global
            const gRef = doc(db, 'clientes', clienteSelecionado.id);
            const gSnap = await getDoc(gRef);
            if (gSnap.exists()) {
                await updateDoc(gRef, { limiteCrediario: limitNum });
            }

            toast.success(`Limite de ${clienteSelecionado.nome} atualizado para ${formatarMoeda(limitNum)}.`);
            setModalLimite(false);
            setClienteSelecionado(null);
            carregarClientes();
        } catch (err) {
            console.error("Erro ao atualizar limite:", err);
            toast.error("Erro ao salvar limite.");
        } finally {
            setSaving(false);
        }
    };

    // Abrir Modal de Baixa e carregar notas pendentes do cliente
    const abrirModalBaixa = async (cliente) => {
        setClienteSelecionado(cliente);
        setNotasSelecionadas([]);
        setValorBaixa('0');
        setAcrescimoBaixa('0');
        setMeioPagamento('dinheiro');
        setModalBaixa(true);
        setLoadingNotas(true);
        setNotasPendentes([]);

        try {
            // 1. Carregar faturas do histórico oficial do cliente
            const q = query(
                collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', cliente.id, 'historico_crediario')
            );
            const snap = await getDocs(q);
            const listOficial = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    data: data.data?.toDate ? data.data.toDate() : (data.data ? new Date(data.data) : new Date()),
                    saldoPendente: data.saldoPendente !== undefined ? Number(data.saldoPendente) : (data.status === 'pago' ? 0 : Number(data.valor || 0))
                };
            });

            // 2. Carregar do histórico global de vendas
            const qVendas = query(
                collection(db, 'vendas'),
                where('estabelecimentoId', '==', estabelecimentoIdPrincipal),
                where('clienteId', '==', cliente.id)
            );
            const vSnap = await getDocs(qVendas);
            const vendasCrediario = [];
            
            vSnap.forEach(docSnap => {
                const vData = docSnap.data();
                const pagamentos = vData.pagamentos || [];
                const valorCrediario = pagamentos
                    .filter(p => p.forma === 'crediario')
                    .reduce((acc, p) => acc + p.valor, 0);

                if (valorCrediario > 0) {
                    vendasCrediario.push({
                        id: docSnap.id,
                        valorCrediario,
                        itens: vData.itens || [],
                        data: vData.createdAt?.toDate ? vData.createdAt.toDate() : (vData.criadoEm?.toDate ? vData.criadoEm.toDate() : new Date())
                    });
                }
            });

            // 3. Mesclar
            const listMesclada = [];
            
            listOficial.forEach(h => {
                if (h.tipo === 'compra' && h.saldoPendente > 0) {
                    listMesclada.push({
                        ...h,
                        itens: h.itens?.map(item => ({
                            nome: item.nome || item.name || 'Item',
                            quantidade: item.quantidade || item.quantity || item.qtd || 1,
                            preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                        })) || []
                    });
                }
            });

            vendasCrediario.forEach(v => {
                const jaExiste = listOficial.some(h => h.vendaId === v.id);
                if (!jaExiste) {
                    listMesclada.push({
                        id: `v_${v.id}`,
                        tipo: 'compra',
                        valor: v.valorCrediario,
                        saldoPendente: v.valorCrediario,
                        descricao: `Venda #${v.id.slice(-6).toUpperCase()}`,
                        vendaId: v.id,
                        data: v.data,
                        itens: v.itens.map(item => ({
                            nome: item.nome || item.name || 'Item',
                            quantidade: item.quantidade || item.quantity || item.qtd || 1,
                            preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                        }))
                    });
                }
            });

            // Resolver itens das faturas oficiales antigas que vieram sem array
            await Promise.all(listMesclada.map(async (h) => {
                if (h.tipo === 'compra' && (!h.itens || h.itens.length === 0) && h.vendaId && !h.id.startsWith('v_')) {
                    try {
                        const vDocSnap = await getDoc(doc(db, 'vendas', h.vendaId));
                        if (vDocSnap.exists() && vDocSnap.data().itens) {
                            h.itens = vDocSnap.data().itens.map(item => ({
                                nome: item.nome || item.name || 'Item',
                                quantidade: item.quantidade || item.quantity || item.qtd || 1,
                                preco: Number(item.precoFinal || item.precoUnitario || item.preco || item.valor || item.price || 0)
                            }));
                        }
                    } catch (err) {
                        console.error(`Erro ao carregar itens da nota ${h.vendaId}:`, err);
                    }
                }
            }));

            // Ordenar por data decrescente (mais recentes primeiro no checklist)
            listMesclada.sort((a, b) => b.data - a.data);

            // Caso especial: cliente com saldo devedor mas sem histórico detalhado
            if (listMesclada.length === 0 && cliente.saldoDevedor > 0) {
                listMesclada.push({
                    id: 'residual',
                    tipo: 'compra',
                    valor: cliente.saldoDevedor,
                    saldoPendente: cliente.saldoDevedor,
                    descricao: 'Saldo Devedor Residual/Legado',
                    data: new Date(),
                    itens: []
                });
            }

            setNotasPendentes(listMesclada);

            // Selecionar todas por padrão ao abrir
            setNotasSelecionadas(listMesclada.map(n => n.id));
            const totalSum = listMesclada.reduce((acc, n) => acc + n.saldoPendente, 0);
            setValorBaixa(totalSum.toFixed(2));

        } catch (e) {
            console.error("Erro ao carregar notas para baixa:", e);
            toast.error("Erro ao carregar faturas pendentes.");
        } finally {
            setLoadingNotas(false);
        }
    };

    // Alternar seleção de nota e recalcular soma
    const toggleNotaSelecionada = (id) => {
        setNotasSelecionadas(prev => {
            let newSel;
            if (prev.includes(id)) {
                newSel = prev.filter(item => item !== id);
            } else {
                newSel = [...prev, id];
            }
            const sum = notasPendentes
                .filter(n => newSel.includes(n.id))
                .reduce((acc, n) => acc + n.saldoPendente, 0);
            setValorBaixa(sum.toFixed(2));
            return newSel;
        });
    };

    // Aplicar taxa de acréscimo baseada em percentual
    const aplicarAcrecimoPercentual = (percent) => {
        const base = parseFloat(valorBaixa) || 0;
        const calc = base * (percent / 100);
        setAcrescimoBaixa(calc.toFixed(2));
    };

    // Aplicar taxa de acréscimo fixa
    const aplicarAcrecimoFixo = (valor) => {
        setAcrescimoBaixa(valor.toFixed(2));
    };

    // Ação: Dar Baixa (Receber pagamento com amortização por notas)
    const handleSalvarBaixa = async (e) => {
        e.preventDefault();
        const valorNum = parseFloat(valorBaixa);
        if (isNaN(valorNum) || valorNum <= 0) return toast.warn("Digite um valor válido!");

        const acrescimoNum = parseFloat(acrescimoBaixa) || 0;
        const totalPagoNum = valorNum + acrescimoNum;

        const maxPossivel = notasPendentes
            .filter(n => notasSelecionadas.includes(n.id))
            .reduce((acc, n) => acc + n.saldoPendente, 0);

        if (valorNum > maxPossivel) {
            return toast.warn(`O valor amortizado não pode ser maior que o total das notas selecionadas (${formatarMoeda(maxPossivel)})!`);
        }

        setSaving(true);
        try {
            let valorRestante = valorNum;
            const notesLoggedForReceipt = [];

            // Ordenar selecionadas por data (mais antigas primeiro) para FIFO amortização
            const notasSelecionadasOrdenadas = notasPendentes
                .filter(n => notasSelecionadas.includes(n.id))
                .sort((a, b) => a.data - b.data);

            for (const nota of notasSelecionadasOrdenadas) {
                if (valorRestante <= 0) break;

                const abatimento = Math.min(nota.saldoPendente, valorRestante);
                const novoSaldoPendente = Math.max(0, nota.saldoPendente - abatimento);
                const novoStatus = novoSaldoPendente === 0 ? 'pago' : 'pendente';

                valorRestante -= abatimento;

                notesLoggedForReceipt.push({
                    descricao: nota.descricao,
                    valorPago: abatimento,
                    saldoPendenteAnterior: nota.saldoPendente,
                    novoSaldoPendente: novoSaldoPendente
                });

                if (nota.id === 'residual') {
                    // Nota virtual residual legado
                    continue;
                }

                if (nota.id.startsWith('v_')) {
                    // Nota do vendas global que não tinha doc local no historico_crediario
                    const newHistRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', clienteSelecionado.id, 'historico_crediario', nota.vendaId);
                    await setDoc(newHistRef, {
                        tipo: 'compra',
                        valor: nota.valor,
                        descricao: nota.descricao,
                        vendaId: nota.vendaId,
                        data: nota.data,
                        itens: nota.itens || [],
                        saldoPendente: novoSaldoPendente,
                        status: novoStatus
                    });
                } else {
                    // Atualizar nota oficial existente
                    const histRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', clienteSelecionado.id, 'historico_crediario', nota.id);
                    await updateDoc(histRef, {
                        saldoPendente: novoSaldoPendente,
                        status: novoStatus
                    });
                }
            }

            // Atualizar saldo devedor do cliente na subcoleção do estabelecimento
            const cRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', clienteSelecionado.id);
            const novoSaldoGeral = Math.max(0, clienteSelecionado.saldoDevedor - valorNum);
            await updateDoc(cRef, { saldoDevedor: novoSaldoGeral });

            // Sincronizar com a coleção global de clientes
            const gRef = doc(db, 'clientes', clienteSelecionado.id);
            const gSnap = await getDoc(gRef);
            if (gSnap.exists()) {
                const globalSaldo = Math.max(0, (gSnap.data().saldoDevedor || 0) - valorNum);
                await updateDoc(gRef, { saldoDevedor: globalSaldo });
            }

            // Registrar transação de pagamento no histórico de crediário
            const histRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', clienteSelecionado.id, 'historico_crediario'));
            await setDoc(histRef, {
                tipo: 'pagamento',
                valor: valorNum,
                acrescimo: acrescimoNum,
                valorTotalPago: totalPagoNum,
                descricao: `Recebido por faturas via ${meioPagamento.toUpperCase()}${acrescimoNum > 0 ? ` (+${formatarMoeda(acrescimoNum)} taxa)` : ''}`,
                meioPagamento,
                data: new Date(),
                notasAbatidas: notesLoggedForReceipt
            });

            // Imprimir comprovante de quitação detalhado
            imprimirComprovanteBaixaDetalmada(clienteSelecionado, valorNum, acrescimoNum, novoSaldoGeral, meioPagamento, notesLoggedForReceipt);

            toast.success(`Baixa de ${formatarMoeda(valorNum)} registrada com sucesso!`);
            setModalBaixa(false);
            setClienteSelecionado(null);
            setValorBaixa('');
            setAcrescimoBaixa('0');
            setNotasSelecionadas([]);
            setNotasPendentes([]);
            carregarClientes();
        } catch (err) {
            console.error("Erro ao registrar baixa:", err);
            toast.error("Erro ao registrar pagamento.");
        } finally {
            setSaving(false);
        }
    };

    // Imprimir extrato (notinha)
    const handleImprimir = () => {
        const printContent = printAreaRef.current.innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Extrato Crediário - ${clienteSelecionado?.nome}</title>
                    <style>
                        body {
                            font-family: 'Courier New', monospace;
                            width: 80mm;
                            margin: 0 auto;
                            padding: 5mm;
                            font-size: 12px;
                            color: #000;
                        }
                        h2, h3 {
                            text-align: center;
                            margin: 5px 0;
                        }
                        .divider {
                            border-top: 1px dashed #000;
                            margin: 10px 0;
                        }
                        .flex {
                            display: flex;
                            justify-content: space-between;
                        }
                        .text-right {
                            text-align: right;
                        }
                        .bold {
                            font-weight: bold;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 10px;
                        }
                        th, td {
                            text-align: left;
                            padding: 4px 0;
                        }
                        .text-red { color: #000; }
                        .text-green { color: #000; }
                    </style>
                </head>
                <body>
                    ${printContent}
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Imprimir comprovante de nota/venda individual
    const handleImprimirNotaIndividual = (lancamento) => {
        const printWindow = window.open('', '_blank');
        const dataLancamento = lancamento.data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const limiteDisponivel = Math.max(0, clienteSelecionado.limiteCrediario - clienteSelecionado.saldoDevedor);

        const listItensHtml = lancamento.itens && lancamento.itens.length > 0 
            ? lancamento.itens.map(item => `
                <tr>
                    <td style="font-size: 9px; padding: 2px 0;">${item.quantidade || 1}x ${item.nome}</td>
                    <td style="font-size: 9px; padding: 2px 0; text-align: right;">${formatarMoeda((item.preco || 0) * (item.quantidade || 1))}</td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td style="font-size: 9px; padding: 2px 0;">Compra no Crediário</td>
                    <td style="font-size: 9px; padding: 2px 0; text-align: right;">${formatarMoeda(lancamento.valor)}</td>
                </tr>
            `;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Reimpressão de Nota - ${clienteSelecionado?.nome}</title>
                    <style>
                        body {
                            font-family: 'Courier New', monospace;
                            width: 80mm;
                            margin: 0 auto;
                            padding: 5mm;
                            font-size: 12px;
                            color: #000;
                        }
                        h2, h3 {
                            text-align: center;
                            margin: 5px 0;
                        }
                        .divider {
                            border-top: 1px dashed #000;
                            margin: 10px 0;
                        }
                        .flex {
                            display: flex;
                            justify-content: space-between;
                        }
                        .bold {
                            font-weight: bold;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-top: 5px;
                        }
                    </style>
                </head>
                <body>
                    <h3>COMPROVANTE DE VENDA</h3>
                    <h3 style="font-size: 11px;">CREDIÁRIO (REIMPRESSÃO)</h3>
                    <div class="divider"></div>
                    <div><span class="bold">CLIENTE:</span> ${clienteSelecionado?.nome?.toUpperCase()}</div>
                    <div><span class="bold">DATA:</span> ${dataLancamento}</div>
                    <div><span class="bold">DOC:</span> ${lancamento.descricao}</div>
                    <div class="divider"></div>
                    <div style="font-weight: bold; font-size: 10px; text-align: center; margin-bottom: 5px;">ITENS COMPRADOS</div>
                    <table>
                        <tbody>
                            ${listItensHtml}
                        </tbody>
                    </table>
                    <div class="divider"></div>
                    <div class="flex"><span class="bold">TOTAL DA NOTA:</span> <span class="bold">${formatarMoeda(lancamento.valor)}</span></div>
                    <div class="divider"></div>
                    <div style="font-weight: bold; font-size: 9px; text-align: center; margin-bottom: 5px;">SITUAÇÃO CONTA CLIENTE</div>
                    <div class="flex"><span>LIMITE TOTAL:</span> <span>${formatarMoeda(clienteSelecionado?.limiteCrediario)}</span></div>
                    <div class="flex"><span>SALDO DEVEDOR:</span> <span>${formatarMoeda(clienteSelecionado?.saldoDevedor)}</span></div>
                    <div class="flex"><span>SALDO DISPONÍVEL:</span> <span>${formatarMoeda(limiteDisponivel)}</span></div>
                    <div class="divider"></div>
                    <div style="text-align: center; margin-top: 25px; font-size: 9px;">Assinatura do Cliente:</div>
                    <br />
                    <div style="border-top: 1px solid #000; width: 80%; margin: 10px auto 0 auto;"></div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Imprimir comprovante de quitação detalhado com notas baixadas e acréscimos
    const imprimirComprovanteBaixaDetalmada = (cliente, valorPago, acrescimo, novoSaldo, meio, notasAbatidas) => {
        const printWindow = window.open('', '_blank');
        const dataPagamento = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        const limiteDisponivel = Math.max(0, cliente.limiteCrediario - novoSaldo);
        const totalPago = valorPago + acrescimo;

        const notasHtml = notasAbatidas.map(n => `
            <div style="font-size: 10px; margin-bottom: 4px;">
                <div class="flex">
                    <span>${n.descricao}</span>
                    <span class="bold">${formatarMoeda(n.valorPago)}</span>
                </div>
                <div style="font-size: 8px; color: #555; text-align: right;">
                    Restante: ${formatarMoeda(n.novoSaldoPendente)} (Antes: ${formatarMoeda(n.saldoPendenteAnterior)})
                </div>
            </div>
        `).join('');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Comprovante de Pagamento - ${cliente.nome}</title>
                    <style>
                        body {
                            font-family: 'Courier New', monospace;
                            width: 80mm;
                            margin: 0 auto;
                            padding: 5mm;
                            font-size: 12px;
                            color: #000;
                        }
                        h2, h3 {
                            text-align: center;
                            margin: 5px 0;
                        }
                        .divider {
                            border-top: 1px dashed #000;
                            margin: 10px 0;
                        }
                        .flex {
                            display: flex;
                            justify-content: space-between;
                        }
                        .bold {
                            font-weight: bold;
                        }
                    </style>
                </head>
                <body>
                    <h3>COMPROVANTE DE PAGAMENTO</h3>
                    <h3 style="font-size: 11px;">CREDIÁRIO / AMORTIZAÇÃO</h3>
                    <div class="divider"></div>
                    <div><span class="bold">CLIENTE:</span> ${cliente.nome?.toUpperCase()}</div>
                    <div><span class="bold">DATA/HORA:</span> ${dataPagamento}</div>
                    <div class="divider"></div>
                    <div style="font-weight: bold; font-size: 10px; text-align: center; margin-bottom: 5px;">NOTAS COMPENSADAS</div>
                    ${notasHtml || '<div style="font-size: 10px; text-align: center;">Nenhuma nota individual</div>'}
                    <div class="divider"></div>
                    <div class="flex"><span>VALOR AMORTIZADO:</span> <span>${formatarMoeda(valorPago)}</span></div>
                    ${acrescimo > 0 ? `<div class="flex"><span>TAXA/ACRÉSCIMO:</span> <span>${formatarMoeda(acrescimo)}</span></div>` : ''}
                    <div class="flex"><span class="bold">TOTAL PAGO:</span> <span class="bold">${formatarMoeda(totalPago)}</span></div>
                    <div class="flex"><span>MEIO DE PAGAMENTO:</span> <span style="text-transform: uppercase;">${meio}</span></div>
                    <div class="divider"></div>
                    <div style="font-weight: bold; font-size: 9px; text-align: center; margin-bottom: 5px;">SITUAÇÃO CONTA CLIENTE</div>
                    <div class="flex"><span>SALDO ANTERIOR:</span> <span>${formatarMoeda(cliente.saldoDevedor)}</span></div>
                    <div class="flex"><span class="bold">SALDO ATUAL:</span> <span class="bold">${formatarMoeda(novoSaldo)}</span></div>
                    <div class="flex"><span>LIMITE DISPONÍVEL:</span> <span>${formatarMoeda(limiteDisponivel)}</span></div>
                    <div class="divider"></div>
                    <div style="text-align: center; font-size: 10px; margin-top: 15px; font-weight: bold;">
                        Recebemos o valor acima para quitação/baixa.
                    </div>
                    <div style="text-align: center; font-size: 9px; margin-top: 5px;">
                        Obrigado pela preferência!
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-24 pt-4 px-4 sm:px-8">
            <main className="max-w-[1400px] mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <BackButton to="/dashboard" />
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-slate-900">Crediário & Contas</h1>
                            <p className="text-slate-500 text-xs font-semibold">Gerencie saldos devedores, limites e baixas de clientes.</p>
                        </div>
                    </div>
                </div>

                {/* Resumo Bento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total de Crédito Aberto</p>
                            <h2 className="text-3xl font-black tracking-tight text-red-500">{formatarMoeda(totalDevedorGlobal)}</h2>
                        </div>
                        <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center text-xl">
                            <IoWalletOutline />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Clientes Devedores</p>
                            <h2 className="text-3xl font-black tracking-tight text-slate-800">{totalDevedoresCount}</h2>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center text-xl">
                            <IoPersonOutline />
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Concedido (Limite)</p>
                            <h2 className="text-3xl font-black tracking-tight text-emerald-600">{formatarMoeda(totalLimiteConcedido)}</h2>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center text-xl">
                            <IoCheckmarkCircleOutline />
                        </div>
                    </div>
                </div>

                {/* Filtro e Tabela */}
                <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
                    
                    {/* Barra de Busca */}
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <h3 className="font-extrabold text-sm text-slate-700 uppercase tracking-wider">Contas de Clientes</h3>
                        <div className="relative w-full sm:max-w-xs">
                            <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Buscar cliente, telefone, CPF..." 
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                                value={busca} 
                                onChange={e => setBusca(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Tabela */}
                    <div className="overflow-x-auto">
                        {carregando ? (
                            <div className="text-center py-20 text-slate-400">
                                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-emerald-600 mx-auto mb-2"></div>
                                <span className="text-xs font-bold">Carregando contas...</span>
                            </div>
                        ) : clientesFiltrados.length === 0 ? (
                            <div className="text-center py-20 text-slate-400">
                                <span className="text-sm font-semibold">Nenhum cliente cadastrado ou localizado.</span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <th className="px-6 py-4">Cliente</th>
                                        <th className="px-6 py-4">Uso do Limite</th>
                                        <th className="px-6 py-4">Saldo Devedor</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                    {clientesFiltrados.map(c => {
                                        const usoPercent = c.limiteCrediario > 0 ? Math.min(100, (c.saldoDevedor / c.limiteCrediario) * 100) : 0;
                                        const limiteDisponivel = Math.max(0, c.limiteCrediario - c.saldoDevedor);
                                        return (
                                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td 
                                                    className="px-6 py-4 cursor-pointer group"
                                                    onClick={() => { setClienteSelecionado(c); carregarHistoricoCrediario(c); setModalExtrato(true); }}
                                                    title="Clique para ver o extrato do cliente"
                                                >
                                                    <p className="font-extrabold text-slate-800 uppercase group-hover:text-emerald-600 group-hover:underline transition-all">{c.nome}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{c.telefone} {c.cpf ? `| CPF: ${c.cpf}` : ''}</p>
                                                </td>
                                                <td className="px-6 py-4 min-w-[200px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${usoPercent > 90 ? 'bg-red-500' : usoPercent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                style={{ width: `${usoPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-black text-slate-400">{Math.round(usoPercent)}%</span>
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">Disponível: {formatarMoeda(limiteDisponivel)} / Limite: {formatarMoeda(c.limiteCrediario)}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`font-black text-sm ${c.saldoDevedor > 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                                        {formatarMoeda(c.saldoDevedor)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => { setClienteSelecionado(c); setNovoLimite(c.limiteCrediario.toString()); setModalLimite(true); }}
                                                            className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 transition-all flex items-center gap-1 active:scale-95"
                                                            title="Editar Limite de Crédito"
                                                        >
                                                            <IoCreateOutline size={14} /> LIMITE
                                                        </button>
                                                        
                                                        <button 
                                                            disabled={c.saldoDevedor <= 0}
                                                            onClick={() => abrirModalBaixa(c)}
                                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:pointer-events-none text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                                            title="Dar baixa no débito"
                                                        >
                                                            RECEBER
                                                        </button>

                                                        <button 
                                                            onClick={() => { setClienteSelecionado(c); carregarHistoricoCrediario(c); setModalExtrato(true); }}
                                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 active:scale-95 shadow-sm"
                                                            title="Ver extrato e faturas"
                                                        >
                                                            EXTRATO
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* MODAL: EDITAR LIMITE */}
                {modalLimite && clienteSelecionado && (
                    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm">
                        <div className="bg-white p-6 rounded-[2rem] w-full max-w-sm shadow-2xl animate-slideUp">
                            <div className="flex justify-between items-center mb-5">
                                <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-1.5"><IoCreateOutline className="text-emerald-500" /> Limite de Crédito</h3>
                                <button onClick={() => { setModalLimite(false); setClienteSelecionado(null); }} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                            </div>

                            <form onSubmit={handleSalvarLimite} className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
                                    <p className="font-black text-sm text-slate-800 uppercase">{clienteSelecionado.nome}</p>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Novo Limite (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                                        <input 
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={novoLimite}
                                            onChange={e => setNovoLimite(e.target.value)}
                                            className="w-full p-3.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                            placeholder="0,00"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-1">Limite zero desativa a opção de crediário para o cliente.</p>
                                </div>

                                <button 
                                    type="submit" 
                                    disabled={saving} 
                                    className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                                >
                                    {saving ? 'Salvando...' : 'ALTERAR LIMITE'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL: DAR BAIXA (RECEBER) */}
                {modalBaixa && clienteSelecionado && (
                    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] animate-slideUp">
                            
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-1.5">
                                        <IoWalletOutline className="text-emerald-500" size={22} /> Receber Crediário
                                    </h3>
                                    <p className="text-slate-400 text-xs font-black uppercase tracking-wider">{clienteSelecionado.nome}</p>
                                </div>
                                <button 
                                    onClick={() => { setModalBaixa(false); setClienteSelecionado(null); setNotasSelecionadas([]); setNotasPendentes([]); }} 
                                    className="bg-slate-100 p-2.5 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Content (Scrollable) */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                
                                {/* Saldo Geral */}
                                <div className="bg-red-50 border border-red-100 p-5 rounded-[1.5rem] flex justify-between items-center shrink-0">
                                    <div>
                                        <p className="text-xs font-black text-red-500 uppercase tracking-widest">Saldo Devedor Geral</p>
                                        <p className="font-black text-slate-800 text-sm uppercase mt-0.5">{clienteSelecionado.nome}</p>
                                    </div>
                                    <span className="text-2xl font-black text-red-500">{formatarMoeda(clienteSelecionado.saldoDevedor)}</span>
                                </div>

                                {/* List of Pending Notes */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Notas / Compras em aberto</h4>
                                        <div className="flex gap-2">
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setNotasSelecionadas(notasPendentes.map(n => n.id));
                                                    const sum = notasPendentes.reduce((acc, n) => acc + n.saldoPendente, 0);
                                                    setValorBaixa(sum.toFixed(2));
                                                }}
                                                className="text-[11px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Selecionar Todas
                                            </button>
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setNotasSelecionadas([]);
                                                    setValorBaixa('0');
                                                }}
                                                className="text-[11px] font-black text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
                                            >
                                                Desmarcar Todas
                                            </button>
                                        </div>
                                    </div>

                                    {loadingNotas ? (
                                        <div className="text-center py-10 text-slate-400">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-emerald-600 mx-auto mb-2"></div>
                                            <span className="text-xs font-black">Buscando faturas em aberto...</span>
                                        </div>
                                    ) : notasPendentes.length === 0 ? (
                                        <div className="text-center py-10 border border-dashed border-slate-200 rounded-[1.5rem] text-slate-400">
                                            <span className="text-sm font-bold">Nenhuma fatura em aberto encontrada.</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                                            {notasPendentes.map(n => {
                                                const selecionado = notasSelecionadas.includes(n.id);
                                                return (
                                                    <div 
                                                        key={n.id}
                                                        onClick={() => toggleNotaSelecionada(n.id)}
                                                        className={`p-4 border rounded-[1.5rem] cursor-pointer transition-all flex flex-col gap-3 ${
                                                            selecionado 
                                                                ? 'border-emerald-500 bg-emerald-50/20 shadow-sm' 
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between text-xs font-semibold">
                                                            <div className="flex items-center gap-3">
                                                                <input 
                                                                    type="checkbox"
                                                                    checked={selecionado}
                                                                    onChange={() => {}} // toggled by click on parent div
                                                                    className="w-5 h-5 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 accent-emerald-600 cursor-pointer pointer-events-none"
                                                                />
                                                                <div>
                                                                    <span className="text-slate-900 font-black text-base">{n.descricao}</span>
                                                                    <p className="text-[13px] text-slate-700 font-extrabold mt-0.5">
                                                                        {n.data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="font-black text-base text-slate-900 block">
                                                                    {formatarMoeda(n.saldoPendente)}
                                                                </span>
                                                                {n.valor !== n.saldoPendente && (
                                                                    <span className="text-[10px] text-slate-400 font-bold block">
                                                                        Original: {formatarMoeda(n.valor)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Items details inside the checklist card */}
                                                        {n.itens && n.itens.length > 0 && (
                                                            <div className="pl-8 pr-3 py-2 bg-slate-50/70 rounded-xl border border-slate-100 text-xs font-semibold text-slate-700 space-y-1.5">
                                                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Itens comprados:</span>
                                                                {n.itens.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between hover:bg-slate-100/50 p-0.5 rounded transition-all text-[13px] font-bold text-slate-700">
                                                                        <span><b className="text-slate-900 font-extrabold mr-1">{item.quantidade || 1}x</b> {item.nome}</span>
                                                                        <span className="text-slate-800 font-extrabold">{formatarMoeda((item.preco || 0) * (item.quantidade || 1))}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Form Inputs (Meio de recebimento e valor parcial se desejar) */}
                                <form onSubmit={handleSalvarBaixa} className="space-y-4 pt-4 border-t border-slate-100 shrink-0">
                                    
                                    {/* Meio de Recebimento */}
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Meio de Recebimento</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['dinheiro', 'pix', 'cartao'].map(m => (
                                                <button 
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setMeioPagamento(m)}
                                                    className={`py-3 px-2 border rounded-2xl font-extrabold text-xs uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${
                                                        meioPagamento === m 
                                                            ? 'bg-slate-800 border-slate-800 text-white shadow-md' 
                                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    <span className="text-lg">{m === 'dinheiro' ? '💵' : m === 'pix' ? '💠' : '💳'}</span>
                                                    <span>{m === 'dinheiro' ? 'Dinheiro' : m === 'pix' ? 'Pix' : 'Cartão'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Valores e Acréscimos */}
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Valor da Amortização (R$)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={valorBaixa}
                                                    onChange={e => setValorBaixa(e.target.value)}
                                                    className="w-full p-3.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                                    placeholder="0,00"
                                                    required
                                                />
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold mt-1 block">
                                                Amortiza a dívida selecionada.
                                            </span>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1.5">Acréscimo / Taxa Extra (R$)</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={acrescimoBaixa}
                                                    onChange={e => setAcrescimoBaixa(e.target.value)}
                                                    className="w-full p-3.5 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:border-emerald-500 focus:bg-white transition-all"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                            {/* Quick preset buttons */}
                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                <button 
                                                    type="button" 
                                                    onClick={() => aplicarAcrecimoPercentual(2)}
                                                    className="text-[9px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all"
                                                    title="Adicionar taxa de 2%"
                                                >
                                                    +2%
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => aplicarAcrecimoPercentual(5)}
                                                    className="text-[9px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all"
                                                    title="Adicionar taxa de 5%"
                                                >
                                                    +5%
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => aplicarAcrecimoFixo(1)}
                                                    className="text-[9px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all"
                                                >
                                                    +R$1
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => aplicarAcrecimoFixo(2)}
                                                    className="text-[9px] font-black text-slate-600 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-all"
                                                >
                                                    +R$2
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setAcrescimoBaixa('0')}
                                                    className="text-[9px] font-black text-red-600 bg-red-50 hover:bg-red-100 px-1.5 py-0.5 rounded transition-all ml-auto"
                                                >
                                                    Zerar
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Preview de Valores */}
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-1 text-xs font-bold text-slate-600 shrink-0">
                                        <div className="flex justify-between">
                                            <span>Amortização da Dívida:</span>
                                            <span className="text-slate-800">{formatarMoeda(Number(valorBaixa))}</span>
                                        </div>
                                        {Number(acrescimoBaixa) > 0 && (
                                            <div className="flex justify-between text-amber-600">
                                                <span>Acréscimo / Taxa cobrada:</span>
                                                <span>{formatarMoeda(Number(acrescimoBaixa))}</span>
                                            </div>
                                        )}
                                        <div className="border-t border-slate-200 my-1"></div>
                                        <div className="flex justify-between text-sm font-black text-slate-800">
                                            <span>Total a Pagar pelo Cliente:</span>
                                            <span className="text-xl text-emerald-600">{formatarMoeda(Number(valorBaixa) + Number(acrescimoBaixa))}</span>
                                        </div>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={saving || notasSelecionadas.length === 0 || Number(valorBaixa) <= 0} 
                                        className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 shadow-md shadow-emerald-100 text-base"
                                    >
                                        {saving ? 'Processando...' : `CONFIRMAR RECEBIMENTO (${formatarMoeda(Number(valorBaixa) + Number(acrescimoBaixa))})`}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL: EXTRATO / HISTÓRICO */}
                {modalExtrato && clienteSelecionado && (
                    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[9000] p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] animate-slideUp">
                            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                                <div>
                                    <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-1.5"><IoCalendarOutline className="text-emerald-500" /> Extrato Crediário</h3>
                                    <p className="text-slate-400 text-xs font-semibold uppercase">{clienteSelecionado.nome}</p>
                                </div>
                                <button onClick={() => { setModalExtrato(false); setClienteSelecionado(null); }} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Limite de Crédito</span>
                                        <span className="text-sm font-black text-slate-800">{formatarMoeda(clienteSelecionado.limiteCrediario)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-bold text-slate-400 block uppercase">Saldo Devedor Atual</span>
                                        <span className="text-sm font-black text-red-500">{formatarMoeda(clienteSelecionado.saldoDevedor)}</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico de Lançamentos</h4>
                                    
                                    {loadingHistorico ? (
                                        <div className="text-center py-10 text-slate-400">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-emerald-600 mx-auto mb-2"></div>
                                            <span className="text-[11px] font-bold">Buscando faturas...</span>
                                        </div>
                                    ) : historico.length === 0 ? (
                                        <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl text-slate-400">
                                            <span className="text-xs font-bold">Nenhum lançamento no crediário.</span>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                                            {historico.map(h => (
                                                <div key={h.id} className="flex flex-col p-3.5 bg-white hover:bg-slate-50/50 transition-all text-xs font-semibold">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div>
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold uppercase mr-2 ${h.tipo === 'compra' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                                {h.tipo === 'compra' ? 'Débito' : 'Crédito'}
                                                            </span>
                                                            <span className="text-slate-800 font-bold text-sm">{h.descricao}</span>
                                                            <p className="text-[11px] text-slate-500 mt-1 font-bold">
                                                                {h.data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`font-black text-sm ${h.tipo === 'compra' ? 'text-red-500' : 'text-emerald-600'}`}>
                                                                {h.tipo === 'compra' ? '+' : '-'}{formatarMoeda(h.valor)}
                                                            </span>
                                                            {h.tipo === 'compra' && (
                                                                <button 
                                                                    onClick={() => handleImprimirNotaIndividual(h)}
                                                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center justify-center active:scale-95 no-print border border-slate-200/50"
                                                                    title="Reimprimir esta notinha"
                                                                >
                                                                    <IoPrintOutline size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {h.tipo === 'compra' && h.itens && h.itens.length > 0 && (
                                                        <div className="mt-2 pl-4 border-l-2 border-slate-200 text-xs text-slate-600 font-semibold space-y-1.5">
                                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-0.5">Itens comprados:</span>
                                                            {h.itens.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between max-w-xs hover:bg-slate-50 p-0.5 rounded transition-all">
                                                                    <span><b className="text-slate-900 font-extrabold mr-1">{item.quantidade || 1}x</b> {item.nome}</span>
                                                                    <span className="text-slate-800 font-bold">{formatarMoeda((item.preco || 0) * (item.quantidade || 1))}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Área oculta usada estritamente para Renderizar impressão de Notinha Térmica */}
                            <div className="hidden">
                                <div ref={printAreaRef}>
                                    <h3 style={{ textTransform: 'uppercase' }}>EXTRATO DE CREDIÁRIO</h3>
                                    <div style={{ textAlign: 'center', fontSize: '10px' }}>CONTA CLIENTE</div>
                                    <div className="divider"></div>
                                    <div><span className="bold">CLIENTE:</span> {clienteSelecionado?.nome?.toUpperCase()}</div>
                                    <div><span className="bold">FONE:</span> {clienteSelecionado?.telefone || ''}</div>
                                    <div><span className="bold">DATA:</span> {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                    <div className="divider"></div>
                                    <div className="flex"><span className="bold">LIMITE TOTAL:</span> <span>{formatarMoeda(clienteSelecionado?.limiteCrediario)}</span></div>
                                    <div className="flex"><span className="bold">SALDO DEVEDOR:</span> <span>{formatarMoeda(clienteSelecionado?.saldoDevedor)}</span></div>
                                    <div className="flex"><span className="bold">LIMITE DISPONÍVEL:</span> <span>{formatarMoeda(Math.max(0, clienteSelecionado?.limiteCrediario - clienteSelecionado?.saldoDevedor))}</span></div>
                                    <div className="divider"></div>
                                    <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold' }}>ÚLTIMOS LANÇAMENTOS</div>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th style={{ fontSize: '10px' }}>DATA</th>
                                                <th style={{ fontSize: '10px' }}>DESCRICAO</th>
                                                <th style={{ fontSize: '10px', textAlign: 'right' }}>VALOR</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historico.slice(0, 15).map(h => (
                                                <React.Fragment key={h.id}>
                                                    <tr style={{ borderTop: '1px dashed #eee' }}>
                                                        <td style={{ fontSize: '9px', verticalAlign: 'top', paddingTop: '4px' }}>{h.data.toLocaleDateString('pt-BR')}</td>
                                                        <td style={{ fontSize: '9px', verticalAlign: 'top', paddingTop: '4px' }}>
                                                            <strong>{h.descricao}</strong>
                                                        </td>
                                                        <td style={{ fontSize: '9px', textAlign: 'right', verticalAlign: 'top', paddingTop: '4px' }}>
                                                            {h.tipo === 'compra' ? '+' : '-'}{formatarMoeda(h.valor)}
                                                        </td>
                                                    </tr>
                                                    {h.tipo === 'compra' && h.itens && h.itens.length > 0 && (
                                                        <tr>
                                                            <td></td>
                                                            <td colSpan={2} style={{ fontSize: '8px', color: '#666', paddingBottom: '4px', paddingLeft: '8px' }}>
                                                                {h.itens.map((item, idx) => (
                                                                    <div key={idx}>
                                                                        - {item.quantidade}x {item.nome} ({formatarMoeda(item.preco)})
                                                                    </div>
                                                                ))}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="divider"></div>
                                    <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '10px' }}>Assinatura do Cliente:</div>
                                    <br />
                                    <div style={{ borderTop: '1px solid #000', width: '80%', margin: '10px auto 0 auto' }}></div>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0 rounded-b-[2rem]">
                                <button onClick={() => { setModalExtrato(false); setClienteSelecionado(null); }} className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 p-3.5 rounded-xl font-bold text-slate-500 transition-all">Fechar</button>
                                <button onClick={handleImprimir} disabled={loadingHistorico} className="flex-1 bg-slate-800 text-white p-3.5 rounded-xl font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50">
                                    <IoPrintOutline size={16} /> IMPRIMIR NOTINHA
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}

export default CrediarioDashboard;
