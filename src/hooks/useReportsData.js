import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';
import { startOfDay, endOfDay, format } from 'date-fns';
import { processarDado, isPedidoCancelado, traduzirPagamento } from '../utils/reportUtils';

export const useReportsData = (estabelecimentoIdPrincipal, startDate, endDate, statusFilter, paymentMethodFilter, deliveryTypeFilter, motoboyFilter, searchTerm, minValue, maxValue) => {
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [availableMotoboys, setAvailableMotoboys] = useState([]);

    const fetchData = async () => {
        if (!estabelecimentoIdPrincipal) return;
        
        try {
            setLoadingData(true);
            const start = startOfDay(new Date(startDate + 'T00:00:00'));
            const end = endOfDay(new Date(endDate + 'T23:59:59'));
            const startTs = Timestamp.fromDate(start);
            const endTs = Timestamp.fromDate(end);
            
            let allDataMap = new Map(); 
            const businessKeySet = new Set();

            const gerarBusinessKey = (item) => {
                const mesa = item.mesaNumero || item.mesaId || '';
                const total = (item.totalFinal || 0).toFixed(2);
                const dia = item.data ? `${item.data.getFullYear()}-${String(item.data.getMonth()+1).padStart(2,'0')}-${String(item.data.getDate()).padStart(2,'0')}` : '';
                
                if (mesa) return `mesa_${mesa}_${total}_${dia}`;
                
                const cliente = (item.clienteNome || '').toLowerCase().trim();
                const pagamento = (item.formaPagamento || '').toLowerCase().trim();
                if (cliente && total !== '0.00') return `delivery_${cliente}_${total}_${pagamento}_${dia}`;
                
                if (item.pedidoId) return `ref_${item.pedidoId}`;
                
                return null;
            };

            const addData = (doc, origem) => {
                const item = processarDado(doc, origem);
                if (item.data >= start && item.data <= end) {
                    if (allDataMap.has(item.id)) return;
                    
                    if (item.pedidoId && allDataMap.has(item.pedidoId)) return;
                    for (const [, existing] of allDataMap) {
                        if (existing.pedidoId === item.id) return;
                    }
                    
                    const bk = gerarBusinessKey(item);
                    if (bk && businessKeySet.has(bk)) return;
                    
                    allDataMap.set(item.id, item);
                    if (bk) businessKeySet.add(bk);
                }
            };

            const isMesaDoc = (d) => {
                const data = d.data();
                return data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
            };

            try {
                const qSub = query(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'pedidos'), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
                const snapSub = await getDocs(qSub);
                snapSub.docs.forEach(d => { if (!isMesaDoc(d)) addData(d, 'delivery'); });
            } catch (e) { console.error(e); }
            
            try {
                const qGlob = query(collection(db, 'pedidos'), where('estabelecimentoId', '==', estabelecimentoIdPrincipal), where('createdAt', '>=', startTs), where('createdAt', '<=', endTs));
                const snapGlob = await getDocs(qGlob);
                snapGlob.docs.forEach(d => { if (!isMesaDoc(d)) addData(d, 'delivery'); });
            } catch (e) { console.error(e); }

            try {
                const qGlobVendas = query(collection(db, 'vendas'), where('estabelecimentoId', '==', estabelecimentoIdPrincipal), where('criadoEm', '>=', startTs), where('criadoEm', '<=', endTs));
                const snapGlobVendas = await getDocs(qGlobVendas);
                snapGlobVendas.docs.forEach(d => {
                    const data = d.data();
                    const tipo = data.origem === 'pdv_web' ? 'pdv' : 'mesa';
                    addData(d, tipo);
                });
            } catch (e) { console.error(e); }

            let allData = Array.from(allDataMap.values());

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
        
        if (paymentMethodFilter !== 'todos') currentPedidos = currentPedidos.filter(i => i.formaPagamento === paymentMethodFilter);
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
                p.clienteNome?.toLowerCase().includes(term) ||
                p.motoboyNome?.toLowerCase().includes(term);
            
            const matchesMin = minValue === '' || p.totalFinal >= parseFloat(minValue);
            const matchesMax = maxValue === '' || p.totalFinal <= parseFloat(maxValue);
            
            return matchesSearch && matchesMin && matchesMax;
        }).sort((a,b) => b.data - a.data); 
    }, [pedidos, searchTerm, minValue, maxValue, statusFilter, paymentMethodFilter, deliveryTypeFilter, motoboyFilter]);

    const metrics = useMemo(() => {
        let totalVendas = 0;
        let totalTaxas = 0;
        
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

                const cleanName = it.nome?.replace(/\s*\(.*\)/g, '').trim() || 'Item';
                const qtd = Number(it.quantidade) || 1;
                const preco = parseFloat(it.preco) || 0;
                const subtotal = preco * qtd;
                itemsCount[cleanName] = (itemsCount[cleanName] || 0) + qtd;
                itemsRevenue[cleanName] = (itemsRevenue[cleanName] || 0) + subtotal;
                if (!itemsPrice[cleanName]) itemsPrice[cleanName] = preco;
                totalItensVendidos += qtd;
            });

            const dayKey = format(p.data, 'dd/MM');
            byDay[dayKey] = Math.round(((byDay[dayKey] || 0) + p.totalFinal) * 100) / 100;

            const hourKey = format(p.data, 'HH:00');
            byHour[hourKey] = (byHour[hourKey] || 0) + 1;

            const payKey = traduzirPagamento(p.formaPagamento);
            byPayment[payKey] = Math.round(((byPayment[payKey] || 0) + p.totalFinal) * 100) / 100;

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
                const cNome = p.clienteNome && p.clienteNome !== 'Cliente' ? p.clienteNome : 'Não Identificado';
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
        fetchData
    };
};
