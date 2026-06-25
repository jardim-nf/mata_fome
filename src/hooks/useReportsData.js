import { useState, useEffect, useMemo } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { isPedidoCancelado, traduzirPagamento } from '../utils/reportUtils';
import { db } from '../firebase';
import { collection, getDocs, query, where, collectionGroup } from 'firebase/firestore';

// Helper para obter a data financeira do turno (corte às 06:00 AM)
const obterDataFinanceira = (date) => {
    if (!date) return new Date();
    const hours = date.getHours();
    if (hours < 6) {
        const prevDate = new Date(date.getTime());
        prevDate.setDate(prevDate.getDate() - 1);
        return prevDate;
    }
    return date;
};

export const useReportsData = (estabelecimentoIdPrincipal, startDate, endDate, statusFilter, paymentMethodFilter, deliveryTypeFilter, motoboyFilter, searchTerm, minValue, maxValue) => {
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [availableMotoboys, setAvailableMotoboys] = useState([]);
    const [contasPagar, setContasPagar] = useState([]);
    const [crediarioPagamentos, setCrediarioPagamentos] = useState([]);
    const [clientesList, setClientesList] = useState([]);
    const [caixasMovimentacoes, setCaixasMovimentacoes] = useState([]);
    const [ordensServicoCriadas, setOrdensServicoCriadas] = useState([]);
    const [ordensServicoPagas, setOrdensServicoPagas] = useState([]);

    const fetchData = async () => {
        if (!estabelecimentoIdPrincipal) return;
        setLoadingData(true);
        
        try {
            // 1. Buscar Vendas/Pedidos do Backend (Cloud Function)
            const functions = getFunctions();
            const relatorioBackend = httpsCallable(functions, 'gerarRelatorioBackend');

            const response = await relatorioBackend({
                estabelecimentoId: estabelecimentoIdPrincipal,
                startDate,
                endDate
            });

            if (!response.data.success) {
                throw new Error("Erro do servidor ao gerar relatório");
            }

            // Converter a dataStr de volta para objeto Date
            let allData = response.data.pedidos.map(p => ({
                ...p,
                data: new Date(p.dataStr)
            }));

            const uniqueMotoboys = [];
            const mapMotoboys = new Map();
            allData.forEach(item => {
                if (item.motoboyId && item.motoboyNome && !mapMotoboys.has(item.motoboyId)) {
                    mapMotoboys.set(item.motoboyId, true);
                    uniqueMotoboys.push({ id: item.motoboyId, nome: item.motoboyNome });
                }
            });
            setAvailableMotoboys(uniqueMotoboys);
            setPedidos(allData);

            // 2. Buscar Contas a Pagar do Firestore
            let listContas = [];
            try {
                const contasSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'contas_a_pagar'));
                listContas = contasSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        dataVencimento: data.dataVencimento || data.vencimento || '',
                        dataPagamento: data.dataPagamento || '',
                        categoria: data.categoria || 'Outros',
                        valor: Number(data.valor) || 0
                    };
                });
            } catch (err) {
                console.error("Erro ao buscar contas a pagar:", err);
            }

            // 3. Buscar Clientes e Amortizações/Recebimentos de Crediário
            let listClientes = [];
            let listPagamentos = [];
            try {
                const clientesSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes'));
                listClientes = clientesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    saldoDevedor: Number(doc.data().saldoDevedor) || 0
                }));

                // Otimização: buscar todas as amortizações em apenas uma query utilizando collectionGroup
                const histSnap = await getDocs(query(
                    collectionGroup(db, 'historico_crediario'),
                    where('tipo', '==', 'pagamento')
                ));

                histSnap.forEach(d => {
                    const pathParts = d.ref.path.split('/');
                    // O path do documento é: estabelecimentos/{estabelecimentoId}/clientes/{clienteId}/historico_crediario/{docId}
                    if (pathParts[1] === estabelecimentoIdPrincipal) {
                        const data = d.data();
                        const clientId = pathParts[3];
                        const client = listClientes.find(c => c.id === clientId);
                        listPagamentos.push({
                            id: d.id,
                            clienteId: clientId,
                            clienteNome: client ? client.nome : 'Cliente',
                            valor: Number(data.valor) || 0,
                            acrescimo: Number(data.acrescimo) || 0,
                            valorTotalPago: Number(data.valorTotalPago) || Number(data.valor) || 0,
                            meioPagamento: data.meioPagamento || 'dinheiro',
                            descricao: data.descricao || '',
                            data: data.data?.toDate ? data.data.toDate() : (data.data ? new Date(data.data) : new Date())
                        });
                    }
                });
            } catch (err) {
                console.error("Erro ao buscar clientes/crediario:", err);
            }

            // 4. Buscar Caixas e suas Movimentações (Sangrias/Suprimentos)
            let listMovimentacoes = [];
            try {
                const caixasSnap = await getDocs(query(
                    collection(db, 'caixas'),
                    where('estabelecimentoId', '==', estabelecimentoIdPrincipal)
                ));
                
                const start = new Date(startDate + 'T00:00:00');
                const end = new Date(endDate + 'T23:59:59');

                const caixasNoPeriodo = caixasSnap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        dataAbertura: data.dataAbertura?.toDate ? data.dataAbertura.toDate() : (data.dataAbertura ? new Date(data.dataAbertura) : null)
                    };
                }).filter(c => {
                    if (!c.dataAbertura) return false;
                    return c.dataAbertura >= start && c.dataAbertura <= end;
                });

                await Promise.all(caixasNoPeriodo.map(async (caixa) => {
                    try {
                        const movSnap = await getDocs(collection(db, 'caixas', caixa.id, 'movimentacoes'));
                        movSnap.forEach(d => {
                            const data = d.data();
                            const valor = Number(data.valor) || 0;
                            const dataMov = data.data?.toDate ? data.data.toDate() : (data.data ? new Date(data.data) : (caixa.dataAbertura || new Date()));
                            
                            // Filtrar suprimentos de crediário para evitar dupla contagem com os recebimentos de crediário
                            if ((data.tipo && data.tipo.startsWith('sangria')) || (data.tipo && data.tipo.startsWith('suprimento') && (!data.descricao || !data.descricao.startsWith('Receb. Crediário')))) {
                                listMovimentacoes.push({
                                    id: d.id,
                                    caixaId: caixa.id,
                                    usuarioNome: caixa.usuarioNome || '',
                                    tipo: data.tipo || 'sangria',
                                    valor,
                                    descricao: data.descricao || '',
                                    data: dataMov
                                });
                            }
                        });
                    } catch (e) {
                        console.error(`Erro ao buscar movimentações do caixa ${caixa.id}:`, e);
                    }
                }));
            } catch (err) {
                console.error("Erro ao buscar caixas/movimentações:", err);
            }

            listMovimentacoes.sort((a, b) => b.data - a.data);

            // Filtrar despesas vencendo ou pagas no período selecionado
            const filteredContas = listContas.filter(c => {
                const date = c.dataVencimento || c.dataPagamento || '';
                return date >= startDate && date <= endDate;
            });

            // Filtrar recebimentos de crediário no período selecionado
            const start = new Date(startDate + 'T00:00:00');
            const end = new Date(endDate + 'T23:59:59');
            const filteredPagamentos = listPagamentos.filter(p => {
                return p.data >= start && p.data <= end;
            });

            // 5. Buscar Ordens de Serviço (OS) do Firestore e filtrar pelo período
            let listOS = [];
            try {
                const osSnap = await getDocs(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'ordensServico'));
                listOS = osSnap.docs.map(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
                    const faturadoEm = data.faturadoEm?.toDate ? data.faturadoEm.toDate() : (data.faturadoEm ? new Date(data.faturadoEm) : null);
                    
                    return {
                        id: doc.id,
                        ...data,
                        createdAt,
                        faturadoEm,
                        total: Number(data.total) || 0
                    };
                });
            } catch (err) {
                console.error("Erro ao buscar ordens de serviço:", err);
            }

            const filteredOSCriadas = listOS.filter(os => {
                return os.createdAt && os.createdAt >= start && os.createdAt <= end;
            });

            const filteredOSPagas = listOS.filter(os => {
                return os.situacaoFinanceira === 'pago' && os.faturadoEm && os.faturadoEm >= start && os.faturadoEm <= end;
            });

            setContasPagar(filteredContas);
            setCrediarioPagamentos(filteredPagamentos);
            setClientesList(listClientes);
            setCaixasMovimentacoes(listMovimentacoes);
            setOrdensServicoCriadas(filteredOSCriadas);
            setOrdensServicoPagas(filteredOSPagas);

            if (allData.length === 0) toast.info("Nenhum dado encontrado para essas datas.");
            else toast.success(`${allData.length} registros carregados.`);

        } catch (err) {
            console.error(err);
            toast.error("Erro ao carregar dados.");
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        if (estabelecimentoIdPrincipal) fetchData();
    }, [estabelecimentoIdPrincipal]);

    const filteredPedidos = useMemo(() => {
        let currentPedidos = [...pedidos];
        
        if (paymentMethodFilter !== 'todos') {
            currentPedidos = currentPedidos.filter(i => {
                if (i.pagamentos && Object.keys(i.pagamentos).length > 0) {
                    return Object.values(i.pagamentos).some(pgto => pgto.formaPagamento === paymentMethodFilter);
                }
                return i.formaPagamento === paymentMethodFilter;
            });
        }
        if (deliveryTypeFilter !== 'todos') currentPedidos = currentPedidos.filter(i => i.tipo === deliveryTypeFilter);
        if (motoboyFilter !== 'todos') currentPedidos = currentPedidos.filter(i => i.motoboyId === motoboyFilter);

        return currentPedidos.filter(p => {
            const cancelado = isPedidoCancelado(p);
            
            if (statusFilter === 'valido' && cancelado) return false;
            if (statusFilter === 'cancelado' && !cancelado) return false;

            const term = searchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || 
                p.id?.toLowerCase().includes(term) ||
                p.mesaNumero?.toString().includes(term) ||
                (typeof p.clienteNome === 'string' ? p.clienteNome : (p.clienteNome?.nome || '')).toLowerCase().includes(term) ||
                p.motoboyNome?.toLowerCase().includes(term);
            
            const matchesMin = minValue === '' || p.totalFinal >= parseFloat(minValue);
            const matchesMax = maxValue === '' || p.totalFinal <= parseFloat(maxValue);
            
            return matchesSearch && matchesMin && matchesMax;
        }).sort((a,b) => b.data - a.data); 
    }, [pedidos, searchTerm, minValue, maxValue, statusFilter, paymentMethodFilter, deliveryTypeFilter, motoboyFilter]);

    const metrics = useMemo(() => {
        let totalVendas = 0;
        let totalTaxas = 0;
        let totalFiadosGerados = 0;
        
        let valorTotalCancelado = 0;
        let qtdPedidosInteirosCancelados = 0;
        let qtdItensAvulsosCancelados = 0;
        
        let qtdPedidosValidos = 0;
        let totalMesaValida = 0;
        let countMesaValida = 0;

        const byDay = {}, byPayment = {}, byType = {}, byHour = {}, itemsCount = {}, itemsRevenue = {}, itemsPrice = {}, motoboyStats = {}, bairrosStats = {}, clientsStats = {}; 
        let totalItensVendidos = 0;

        filteredPedidos.forEach(p => {
            const pedidoInteiroCancelado = isPedidoCancelado(p);

            if (pedidoInteiroCancelado) {
                qtdPedidosInteirosCancelados++;
                valorTotalCancelado += p.totalFinal;
                return;
            }

            qtdPedidosValidos++;
            totalVendas += p.totalFinal;
            totalTaxas += (p.taxaEntrega || 0);

            if (p.tipo === 'mesa') {
                totalMesaValida += p.totalFinal;
                countMesaValida++;
            }

            p.itens?.forEach(it => {
                const statusItem = String(it.status || '').toLowerCase().trim();
                if (statusItem === 'cancelado') {
                    valorTotalCancelado += (parseFloat(it.preco) || 0) * (parseInt(it.quantidade) || 1);
                    qtdItensAvulsosCancelados++;
                    return; 
                }

                const cleanName = (it.nome || it.name || it.titulo || it.title || 'Item').replace(/\s*\(.*\)/g, '').trim();
                const qtd = Number(it.quantidade) || 1;
                const preco = parseFloat(it.preco) || 0;
                const subtotal = preco * qtd;
                itemsCount[cleanName] = (itemsCount[cleanName] || 0) + qtd;
                itemsRevenue[cleanName] = (itemsRevenue[cleanName] || 0) + subtotal;
                if (!itemsPrice[cleanName]) itemsPrice[cleanName] = preco;
                totalItensVendidos += qtd;
            });

            const dayKey = format(obterDataFinanceira(p.data), 'dd/MM');
            byDay[dayKey] = Math.round(((byDay[dayKey] || 0) + p.totalFinal) * 100) / 100;

            const hourKey = format(p.data, 'HH:00');
            byHour[hourKey] = (byHour[hourKey] || 0) + 1;

            if (p.pagamentos && Object.keys(p.pagamentos).length > 0) {
                Object.values(p.pagamentos).forEach(pgto => {
                    const payKey = traduzirPagamento(pgto.formaPagamento || pgto.forma);
                    const valor = Number(pgto.valor) || 0;
                    byPayment[payKey] = Math.round(((byPayment[payKey] || 0) + valor) * 100) / 100;
                    if (payKey === 'Crediário') {
                        totalFiadosGerados += valor;
                    }
                });
            } else {
                const payKey = traduzirPagamento(p.formaPagamento);
                byPayment[payKey] = Math.round(((byPayment[payKey] || 0) + p.totalFinal) * 100) / 100;
                if (payKey === 'Crediário') {
                    totalFiadosGerados += p.totalFinal;
                }
            }

            const typeKey = p.tipo === 'mesa' ? 'Mesa' : 'Delivery';
            byType[typeKey] = (byType[typeKey] || 0) + 1;

            if (p.motoboyId && p.motoboyNome) {
                if (!motoboyStats[p.motoboyId]) motoboyStats[p.motoboyId] = { id: p.motoboyId, nome: p.motoboyNome, count: 0, totalTaxas: 0 };
                motoboyStats[p.motoboyId].count++;
                motoboyStats[p.motoboyId].totalTaxas += (p.taxaEntrega || 0);
            }

            if (p.tipo !== 'mesa' && p.bairro) {
                bairrosStats[p.bairro] = (bairrosStats[p.bairro] || 0) + 1;
            }

            if (p.tipo !== 'mesa') {
                const rawNome = p.clienteNome;
                const cNomeStr = (!rawNome || rawNome === 'Cliente') ? 'Não Identificado' : (typeof rawNome === 'object' ? (rawNome.nome || rawNome.name || 'Não Identificado') : String(rawNome));
                const cNome = cNomeStr !== 'Cliente' ? cNomeStr : 'Não Identificado';
                if (!clientsStats[cNome]) {
                    clientsStats[cNome] = { nome: cNome, count: 0, total: 0, bairro: p.bairro };
                }
                clientsStats[cNome].count += 1;
                clientsStats[cNome].total += p.totalFinal;
            }
        });

        const sortedDays = Object.keys(byDay).sort((a,b) => new Date(a.split('/').reverse().join('-')) - new Date(b.split('/').reverse().join('-')));
        const topItems = Object.entries(itemsCount).sort(([,a], [,b]) => b - a).slice(0, 5);
        const allItems = Object.entries(itemsCount)
            .map(([nome, qtd]) => ({
                nome,
                qtd,
                receita: itemsRevenue[nome] || 0,
                precoUnit: itemsPrice[nome] || 0,
                pctQtd: totalItensVendidos > 0 ? ((qtd / totalItensVendidos) * 100).toFixed(1) : '0.0'
            }))
            .sort((a, b) => b.qtd - a.qtd);
        const topMotoboys = Object.values(motoboyStats).sort((a, b) => b.count - a.count);
        const topBairros = Object.entries(bairrosStats).sort(([,a], [,b]) => b - a).slice(0, 5);
        const topClients = Object.values(clientsStats).sort((a, b) => b.total - a.total).slice(0, 5); 
        
        const taxaRejeicao = filteredPedidos.length > 0 ? ((qtdPedidosInteirosCancelados / filteredPedidos.length) * 100).toFixed(1) : 0;

        return {
            totalVendas,
            totalTaxas,
            totalFiadosGerados,
            count: qtdPedidosValidos,
            ticketMedio: qtdPedidosValidos ? totalVendas / qtdPedidosValidos : 0,
            byDay: { labels: sortedDays, data: sortedDays.map(d => byDay[d]) },
            byHour: { labels: Object.keys(byHour).sort(), data: Object.keys(byHour).sort().map(h => byHour[h]) },
            byPayment: { labels: Object.keys(byPayment), data: Object.values(byPayment) },
            topItems,
            allItems,
            totalItensVendidos,
            topMotoboys,
            topBairros,
            topClients, 
            mesaMetrics: {
                total: totalMesaValida,
                count: countMesaValida
            },
            cancelamentos: {
                qtd: qtdPedidosInteirosCancelados + qtdItensAvulsosCancelados,
                valor: valorTotalCancelado,
                taxa: taxaRejeicao,
                textoQtd: `${qtdPedidosInteirosCancelados} Pedidos e ${qtdItensAvulsosCancelados} Itens`
            }
        };
    }, [filteredPedidos]);

    return {
        loadingData,
        filteredPedidos,
        metrics,
        availableMotoboys,
        contasPagar,
        crediarioPagamentos,
        clientesList,
        caixasMovimentacoes,
        ordensServicoCriadas,
        ordensServicoPagas,
        fetchData
    };
};
