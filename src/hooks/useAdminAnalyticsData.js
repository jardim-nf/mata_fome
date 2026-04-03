import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// ── HELPERS ──
const parse = (v) => parseFloat(String(v || 0).replace(/[R$\s]/g, '').replace(',', '.')) || 0;
export const hojeStr = () => { const h = new Date(); return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0'); };
export const semanaAtrasStr = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

export function useAdminAnalyticsData(estabId) {
    const [loading, setLoading] = useState(true);
    const [dataInicio, setDataInicio] = useState(semanaAtrasStr());
    const [dataFim, setDataFim] = useState(hojeStr());
    const [nomeEstab, setNomeEstab] = useState('');

    const [pedidosDelivery, setPedidosDelivery] = useState([]);
    const [vendasSalao, setVendasSalao] = useState([]);

    // ── BUSCAR NOME ──
    useEffect(() => {
        if (!estabId) return;
        getDoc(doc(db, 'estabelecimentos', estabId)).then(snap => {
            if (snap.exists()) setNomeEstab(snap.data().nome || '');
        }).catch((err) => { console.error(err); });
    }, [estabId]);

    // ── QUERIES FIREBASE ──
    useEffect(() => {
        if (!estabId || !dataInicio || !dataFim) return;
        setLoading(true);

        const start = new Date(`${dataInicio}T00:00:00`);
        const end = new Date(`${dataFim}T23:59:59.999`);

        const qDel = query(collection(db, 'estabelecimentos', estabId, 'pedidos'),
            where('createdAt', '>=', start), where('createdAt', '<=', end)
        );
        const qSal = query(collection(db, 'estabelecimentos', estabId, 'vendas'),
            where('criadoEm', '>=', start), where('criadoEm', '<=', end)
        );
        const fetchData = async () => {
            try {
                const [snapDel, snapSal] = await Promise.all([getDocs(qDel), getDocs(qSal)]);
                setPedidosDelivery(snapDel.docs.map(d => ({ id: d.id, ...d.data() })));
                setVendasSalao(snapSal.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error('[AdminAnalytics] Erro:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [estabId, dataInicio, dataFim]);

    // ── STATS CALCULADOS ──
    const stats = useMemo(() => {
        const delOk = pedidosDelivery.filter(p => p.status !== 'cancelado');
        const salOk = vendasSalao.filter(v => v.status !== 'cancelado');

        let fatDel = 0, fatSal = 0;
        delOk.forEach(p => fatDel += parse(p.totalFinal || p.total || p.valorTotal));
        salOk.forEach(v => fatSal += parse(v.totalFinal || v.total || v.valorTotal));

        const totalPedidos = delOk.length + salOk.length;
        const fatTotal = fatDel + fatSal;
        const ticketMedio = totalPedidos > 0 ? fatTotal / totalPedidos : 0;

        // Formas de pagamento
        const formas = {};
        [...delOk, ...salOk].forEach(p => {
            let fp = p.formaPagamento || p.forma_pagamento || p.paymentMethod || 'outro';
            fp = fp.toLowerCase().replace(/[áàã]/g, 'a').replace(/[éèê]/g, 'e').replace(/[íì]/g, 'i');
            if (fp.includes('pix')) fp = 'PIX';
            else if (fp.includes('cred') || fp === 'credit_card') fp = 'Crédito';
            else if (fp.includes('deb') || fp === 'debit_card') fp = 'Débito';
            else if (fp.includes('dinh') || fp === 'cash') fp = 'Dinheiro';
            else fp = fp.charAt(0).toUpperCase() + fp.slice(1);

            if (!formas[fp]) formas[fp] = { qtd: 0, valor: 0 };
            formas[fp].qtd++;
            formas[fp].valor += parse(p.totalFinal || p.total || p.valorTotal);
        });

        // Horário de pico
        const horas = Array.from({ length: 24 }, (_, i) => ({ hora: i, qtd: 0 }));
        [...delOk, ...salOk].forEach(p => {
            const ts = p.createdAt || p.criadoEm;
            if (!ts) return;
            const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
            horas[d.getHours()].qtd++;
        });

        // Faturamento por dia
        const porDia = {};
        const processaDia = (lista, campoData) => {
            lista.forEach(p => {
                const ts = p[campoData];
                if (!ts) return;
                const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
                const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                if (!porDia[key]) porDia[key] = 0;
                porDia[key] += parse(p.totalFinal || p.total || p.valorTotal);
            });
        };
        processaDia(delOk, 'createdAt');
        processaDia(salOk, 'criadoEm');

        // Ordenar por data
        const diasChart = Object.entries(porDia)
            .map(([dia, valor]) => ({ dia, valor }))
            .sort((a, b) => {
                const [dA, mA] = a.dia.split('/').map(Number);
                const [dB, mB] = b.dia.split('/').map(Number);
                return mA !== mB ? mA - mB : dA - dB;
            });

        // Top produtos
        const produtos = {};
        const extrairItens = (lista) => {
            lista.forEach(p => {
                (p.itens || p.items || []).forEach(item => {
                    const nome = item.nome || item.name || 'Sem nome';
                    const qtd = item.quantidade || item.quantity || item.qtd || 1;
                    const val = parse(item.precoUnitario || item.preco || item.valor || item.price) * qtd;
                    if (!produtos[nome]) produtos[nome] = { nome, qtd: 0, valor: 0 };
                    produtos[nome].qtd += qtd;
                    produtos[nome].valor += val;
                });
            });
        };
        extrairItens(delOk);
        extrairItens(salOk);

        const topProdutos = Object.values(produtos).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

        return {
            fatTotal, fatDel, fatSal, totalPedidos,
            qtdDel: delOk.length, qtdSal: salOk.length,
            ticketMedio, formas, horas, diasChart, topProdutos,
            ticketDel: delOk.length > 0 ? fatDel / delOk.length : 0,
            ticketSal: salOk.length > 0 ? fatSal / salOk.length : 0,
            // Cancelamentos
            cancelados: pedidosDelivery.filter(p => p.status === 'cancelado').length + vendasSalao.filter(v => v.status === 'cancelado').length,
            taxaCancelamento: (pedidosDelivery.length + vendasSalao.length) > 0
                ? ((pedidosDelivery.filter(p => p.status === 'cancelado').length + vendasSalao.filter(v => v.status === 'cancelado').length) / (pedidosDelivery.length + vendasSalao.length)) * 100 : 0,
            // Média por dia da semana
            porDiaSemana: (() => {
                const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const acum = Array.from({ length: 7 }, () => ({ total: 0, qtd: 0 }));
                const processaDiaSemana = (lista, campoData) => {
                    lista.forEach(p => {
                        const ts = p[campoData]; if (!ts) return;
                        const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
                        acum[d.getDay()].total += parse(p.totalFinal || p.total || p.valorTotal);
                        acum[d.getDay()].qtd++;
                    });
                };
                processaDiaSemana(delOk, 'createdAt');
                processaDiaSemana(salOk, 'criadoEm');
                return acum.map((d, i) => ({ dia: diasSemana[i], total: d.total, qtd: d.qtd, media: d.qtd > 0 ? d.total / d.qtd : 0 }));
            })(),
        };
    }, [pedidosDelivery, vendasSalao]);

    // ── FORMAS DE PAGAMENTO ORDENADAS ──
    const formasOrdenadas = useMemo(() =>
        Object.entries(stats.formas).map(([nome, d]) => ({ nome, ...d })).sort((a, b) => b.valor - a.valor)
    , [stats.formas]);

    const maxFormaValor = formasOrdenadas.length > 0 ? formasOrdenadas[0].valor : 1;

    // ── HORÁRIO DE PICO (top 3) ──
    const horasComDados = useMemo(() => {
        const comDados = stats.horas.filter(h => h.qtd > 0);
        const sorted = [...comDados].sort((a, b) => b.qtd - a.qtd);
        const top3 = new Set(sorted.slice(0, 3).map(h => h.hora));
        return { horas: comDados.length > 0 ? stats.horas : [], top3, maxQtd: sorted[0]?.qtd || 1 };
    }, [stats.horas]);

    return {
        // Utils
        loading,
        
        // Data Range Controls
        dataInicio, setDataInicio,
        dataFim, setDataFim,
        nomeEstab,
        
        // Data Matrix Outputs
        stats,
        formasOrdenadas,
        maxFormaValor,
        horasComDados
    };
}
