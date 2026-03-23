// src/pages/AdminReports.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

// Bibliotecas para PDF e Gráficos
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement } from 'chart.js';
import { Line, Pie, Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// Ícones
import { 
    IoArrowBack, IoFilterOutline, IoDownloadOutline, IoRefreshOutline, 
    IoStatsChartOutline, IoCashOutline, IoReceiptOutline, IoPrintOutline, 
    IoPeopleOutline, IoAnalyticsOutline, IoListOutline, IoMapOutline, IoAlertCircleOutline,
    IoFastFoodOutline, IoSearchOutline
} from 'react-icons/io5';
import { FaMotorcycle } from "react-icons/fa";

// Registro dos componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, ArcElement, ChartDataLabels);

// --- COMPONENTES UI ---
const Card = ({ title, children, className = "", ...rest }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 ${className}`} {...rest}>
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">{title}</h3>}
        {children}
    </div>
);

const StatCard = ({ title, value, subtitle, icon, color = "blue" }) => {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        red: 'bg-red-50 text-red-600 border-red-100',
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100'
    };
    const bgCircle = {
        blue: 'bg-blue-100', green: 'bg-emerald-100', amber: 'bg-amber-100',
        purple: 'bg-purple-100', red: 'bg-red-100', indigo: 'bg-indigo-100'
    };

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all relative overflow-hidden group ${colorClasses[color]?.split(' ')[2] ? `border-${color}-100` : 'border-gray-100'}`}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 ${bgCircle[color]} group-hover:scale-110 transition-transform`}></div>
            <div className="flex items-center justify-between relative z-10">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
                    <p className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">{value}</p>
                    {subtitle && <p className="text-[10px] text-gray-500 font-medium mt-1">{subtitle}</p>}
                </div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${colorClasses[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

// 🔥 FUNÇÃO GLOBAL PARA IDENTIFICAR PEDIDOS INTEIROS CANCELADOS 🔥
const isPedidoCancelado = (p) => {
    if (!p) return false;
    const s1 = String(p.status || '').toLowerCase().trim();
    const s2 = String(p.fiscal?.status || '').toLowerCase().trim();
    const s3 = String(p.statusVenda || '').toLowerCase().trim();
    
    const termos = ['cancelad', 'recusad', 'excluid', 'estornad', 'devolvid', 'rejeitad', 'erro'];
    return termos.some(t => s1.includes(t) || s2.includes(t) || s3.includes(t));
};

const AdminReports = () => {
    const { estabelecimentoIdPrincipal } = useAuth();
    const reportContentRef = useRef();

    // Estados
    const [loadingData, setLoadingData] = useState(false);
    const [pedidos, setPedidos] = useState([]);
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    
    // Filtros
    const [statusFilter, setStatusFilter] = useState('valido'); 
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('todos');
    const [deliveryTypeFilter, setDeliveryTypeFilter] = useState('todos');
    const [motoboyFilter, setMotoboyFilter] = useState('todos');
    const [availableMotoboys, setAvailableMotoboys] = useState([]);

    // Filtros Avançados
    const [searchTerm, setSearchTerm] = useState('');
    const [minValue, setMinValue] = useState('');
    const [maxValue, setMaxValue] = useState('');
    const [viewMode, setViewMode] = useState('charts'); 
    const [itemSearchTerm, setItemSearchTerm] = useState('');

    // --- OPÇÕES DE GRÁFICOS ---
    const fmtBRL = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
    const pieChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, font: { size: 12 } } },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmtBRL(ctx.parsed)}` } },
            datalabels: { display: false }
        }
    };
    const lineChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => fmtBRL(ctx.parsed.y) } }
        },
        scales: { y: { ticks: { callback: (v) => fmtBRL(v) } } }
    };
    const barChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    // --- TRADUTOR DE PAGAMENTO ---
    const traduzirPagamento = (metodo) => {
        if (!metodo || metodo === 'N/A') return 'Não Informado';
        const mapa = {
            'credit_card': 'Cartão de Crédito',
            'debit_card': 'Cartão de Débito',
            'money': 'Dinheiro',
            'cash': 'Dinheiro',
            'pix': 'PIX',
            'wallet': 'Carteira Digital',
            'card': 'Cartão',
            'online': 'Online'
        };
        return mapa[metodo.toLowerCase()] || mapa[metodo] || metodo;
    };

    // Normalização de Dados
    const processarDado = (doc, origem) => {
        const data = doc.data();
        
        let dataRegistro = data.createdAt?.toDate?.() || 
                           data.criadoEm?.toDate?.() || 
                           data.dataFechamento?.toDate?.() || 
                           data.updatedAt?.toDate?.() || 
                           new Date();

        const parseVal = (v) => {
            if (typeof v === 'number') return v;
            if (typeof v === 'string') return parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
            return 0;
        };
        
        let total = parseVal(data.totalFinal) || parseVal(data.total) || parseVal(data.valorTotal) || 0;
        const itens = data.itens || data.produtos || [];
        const bairro = data.endereco?.bairro || data.bairro || data.address?.district || null;

        const isMesa = origem === 'mesa' || data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero;

        return {
            id: doc.id,
            ...data,
            data: dataRegistro,
            totalFinal: total || 0,
            tipo: isMesa ? 'mesa' : 'delivery',
            origem: isMesa ? 'mesa' : 'delivery',
            status: data.status || (isMesa ? 'finalizada' : 'recebido'),
            formaPagamento: data.formaPagamento || data.metodoPagamento || data.tipoPagamento || 'N/A',
            mesaNumero: data.mesaNumero || data.numeroMesa || null,
            loteHorario: data.loteHorario || '',
            itens: itens,
            clienteNome: data.clienteNome || data.cliente?.nome || (isMesa ? 'Mesa' : 'Cliente'),
            motoboyId: data.motoboyId || null,
            motoboyNome: data.motoboyNome || null,
            taxaEntrega: Number(data.taxaEntrega) || Number(data.deliveryFee) || 0,
            bairro: bairro
        };
    };

    const fetchData = async () => {
        if (!estabelecimentoIdPrincipal) return;
        
        try {
            setLoadingData(true);
            const start = startOfDay(new Date(startDate + 'T00:00:00'));
            const end = endOfDay(new Date(endDate + 'T23:59:59'));
            
            let allDataMap = new Map(); 
            const businessKeySet = new Set(); // 🔥 FIX: dedup por chave de negócio

            // Gera chave de negócio para detectar mesma venda em collections diferentes
            // Usa data do DIA (não timestamp exato) porque vendas e historico_mesas têm timestamps diferentes
            const gerarBusinessKey = (item) => {
                const mesa = item.mesaNumero || item.mesaId || '';
                const total = (item.totalFinal || 0).toFixed(2);
                // Usa apenas o dia (YYYY-MM-DD) para evitar diferença de timestamps entre collections
                const dia = item.data ? `${item.data.getFullYear()}-${String(item.data.getMonth()+1).padStart(2,'0')}-${String(item.data.getDate()).padStart(2,'0')}` : '';
                return mesa ? `mesa_${mesa}_${total}_${dia}` : null;
            };

            const addData = (doc, origem) => {
                const item = processarDado(doc, origem);
                if (item.data >= start && item.data <= end) {
                    // 1. Dedup por doc.id (mesmo doc)
                    if (allDataMap.has(item.id)) return;
                    
                    // 2. Dedup por chave de negócio (mesma venda em collections diferentes)
                    const bk = gerarBusinessKey(item);
                    if (bk && businessKeySet.has(bk)) {
                        console.log('🔥 DEDUP: Ignorando duplicata:', item.id, 'key:', bk);
                        return;
                    }
                    
                    allDataMap.set(item.id, item);
                    if (bk) businessKeySet.add(bk);
                }
            };

            // 1. BUSCA DELIVERY (sempre busca tudo, filtro é aplicado depois)
            // ⚠️ Pula pedidos de mesa (tipo='mesa' ou com mesaNumero) porque esses são "rounds"
            // individuais dentro de uma sessão de mesa. A venda fechada já está no root "vendas".
            const isMesaDoc = (d) => {
                const data = d.data();
                return data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
            };

            try {
                const qSub = query(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'pedidos'));
                const snapSub = await getDocs(qSub);
                snapSub.docs.forEach(d => {
                    if (!isMesaDoc(d)) addData(d, 'delivery');
                });
            } catch(e) {}
            
            try {
                const qGlob = query(collection(db, 'pedidos'), where('estabelecimentoId', '==', estabelecimentoIdPrincipal));
                const snapGlob = await getDocs(qGlob);
                snapGlob.docs.forEach(d => {
                    if (!isMesaDoc(d)) addData(d, 'delivery');
                });
            } catch(e) {}

            // 2. BUSCA MESAS / PDV / VENDAS
            // ⚠️ Busca APENAS da raiz "vendas" — ModalPagamento.jsx já salva tudo lá.
            // Subcollection "vendas" e "historico_mesas" tinham os mesmos dados com IDs diferentes,
            // causando contagem duplicada (17 vendas apareciam como 35).
            try {
                const qGlobVendas = query(collection(db, 'vendas'), where('estabelecimentoId', '==', estabelecimentoIdPrincipal));
                const snapGlobVendas = await getDocs(qGlobVendas);
                snapGlobVendas.docs.forEach(d => {
                    const data = d.data();
                    const tipo = data.origem === 'pdv_web' ? 'pdv' : 'mesa';
                    addData(d, tipo);
                });
            } catch(e) {}

            let allData = Array.from(allDataMap.values());

            // Extrair Motoboys
            const uniqueMotoboys = [];
            const mapMotoboys = new Map();
            allData.forEach(item => {
                if (item.motoboyId && item.motoboyNome && !mapMotoboys.has(item.motoboyId)) {
                    mapMotoboys.set(item.motoboyId, true);
                    uniqueMotoboys.push({ id: item.motoboyId, nome: item.motoboyNome });
                }
            });
            setAvailableMotoboys(uniqueMotoboys);

            // Filtragem Rápida
            if (paymentMethodFilter !== 'todos') allData = allData.filter(i => i.formaPagamento === paymentMethodFilter);
            if (deliveryTypeFilter !== 'todos') allData = allData.filter(i => i.tipo === deliveryTypeFilter);
            if (motoboyFilter !== 'todos') allData = allData.filter(i => i.motoboyId === motoboyFilter);

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

    // Filtragem Dinâmica de Tela (Busca, Status e Valores)
    const filteredPedidos = useMemo(() => {
        return pedidos.filter(p => {
            const cancelado = isPedidoCancelado(p);
            
            // 🔥 Lógica de Filtro na Tabela Principal 🔥
            // Quando filtramos por "valido", ainda queremos ver as Mesas que foram pagas, mesmo que tenham 1 item cancelado dentro.
            if (statusFilter === 'valido' && cancelado) return false;
            // Se pedir "cancelado", só mostra pedidos inteiros cancelados
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
    }, [pedidos, searchTerm, minValue, maxValue, statusFilter]);

    // --- 🔥 CÁLCULO DE MÉTRICAS (A MÁGICA ESTÁ AQUI) 🔥 ---
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

            // 1. SE O PEDIDO INTEIRO FOI CANCELADO
            if (pedidoInteiroCancelado) {
                qtdPedidosInteirosCancelados++;
                valorTotalCancelado += p.totalFinal;
                return; // Pula o resto dos cálculos, não entra em vendas
            }

            // 2. SE O PEDIDO FOI PAGO (VÁLIDO)
            qtdPedidosValidos++;
            totalVendas += p.totalFinal;
            totalTaxas += (p.taxaEntrega || 0);

            if (p.tipo === 'mesa') {
                totalMesaValida += p.totalFinal;
                countMesaValida++;
            }

            // 3. AGORA NÓS "ABRIMOS A SACOLA" PARA CAÇAR ITENS CANCELADOS
            p.itens?.forEach(it => {
                const statusItem = String(it.status || '').toLowerCase().trim();
                if (statusItem === 'cancelado') {
                    // Achamos um item cancelado! Soma o prejuízo dele
                    valorTotalCancelado += (parseFloat(it.preco) || 0) * (parseInt(it.quantidade) || 1);
                    qtdItensAvulsosCancelados++;
                    return; // Impede que o item cancelado vá pro Top 5 Produtos
                }

                // Item válido — rastreia quantidade, receita e preço
                const cleanName = it.nome?.replace(/\s*\(.*\)/g, '').trim() || 'Item';
                const qtd = Number(it.quantidade) || 1;
                const preco = parseFloat(it.preco) || 0;
                const subtotal = preco * qtd;
                itemsCount[cleanName] = (itemsCount[cleanName] || 0) + qtd;
                itemsRevenue[cleanName] = (itemsRevenue[cleanName] || 0) + subtotal;
                if (!itemsPrice[cleanName]) itemsPrice[cleanName] = preco;
                totalItensVendidos += qtd;
            });

            // --- Cálculos dos Gráficos (Apenas Valores Válidos) ---
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

    // Exportações
    const handleExportCSV = () => {
        if (!filteredPedidos.length) return toast.warn("Sem dados.");
        const headers = ['Data', 'Hora', 'ID', 'Tipo', 'Mesa', 'Cliente', 'Motoboy', 'Bairro', 'Status', 'Pagamento', 'Total'];
        const rows = filteredPedidos.map(p => [
            format(p.data, 'dd/MM/yyyy'), format(p.data, 'HH:mm'),
            p.id, p.tipo, p.mesaNumero || '-', p.clienteNome, p.motoboyNome || '-', p.bairro || '-',
            isPedidoCancelado(p) ? 'Cancelado' : p.status, traduzirPagamento(p.formaPagamento), p.totalFinal.toFixed(2).replace('.', ',')
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio_${startDate}.csv`;
        link.click();
    };

    const handleExportPDF = async () => {
        const input = reportContentRef.current;
        if (!input) return;
        const btns = document.querySelectorAll('.no-print');
        btns.forEach(b => b.style.display = 'none');

        // Forçar largura desktop para grids renderizarem lado a lado
        const originalStyle = input.style.cssText;
        input.style.width = '1200px';
        input.style.maxWidth = '1200px';
        input.style.minWidth = '1200px';
        input.style.overflow = 'visible';

        // Forçar grids responsivos a renderizar em multi-coluna (media queries não funcionam com html2canvas)
        const gridOverrides = [];
        input.querySelectorAll('.grid').forEach(grid => {
            const origStyle = grid.style.cssText;
            const cls = grid.className;
            if (cls.includes('lg:grid-cols-3')) {
                grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            } else if (cls.includes('md:grid-cols-3')) {
                grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            } else if (cls.includes('lg:grid-cols-2') || cls.includes('md:grid-cols-2')) {
                grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            } else if (cls.includes('md:grid-cols-6')) {
                grid.style.gridTemplateColumns = 'repeat(6, 1fr)';
            } else if (cls.includes('md:grid-cols-4') || cls.includes('sm:grid-cols-4')) {
                grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            }
            gridOverrides.push({ el: grid, origStyle });
        });

        // Aguardar re-render
        await new Promise(r => setTimeout(r, 600));

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const usableWidth = pageWidth - margin * 2;
            const headerH = 18;
            const footerH = 8;
            const gapBetweenSections = 4; // mm entre seções

            // Coletar seções marcadas com data-pdf-section
            const sections = input.querySelectorAll('[data-pdf-section]');
            // Se não houver seções marcadas, pegar filhos diretos visíveis
            const elements = sections.length > 0 
                ? Array.from(sections) 
                : Array.from(input.children).filter(c => c.offsetHeight > 0);

            // Capturar cada seção individualmente como canvas
            const sectionCanvases = [];
            for (const el of elements) {
                const canvas = await html2canvas(el, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    allowTaint: true,
                    windowWidth: 1200,
                });
                sectionCanvases.push(canvas);
            }

            // Desenhar cabeçalho
            const drawHeader = () => {
                pdf.setFillColor(37, 99, 235);
                pdf.rect(0, 0, pageWidth, 14, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(13);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Relatório de Desempenho', margin, 9);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'normal');
                const dateText = `Período: ${startDate || '—'} a ${endDate || '—'}`;
                pdf.text(dateText, pageWidth - margin - pdf.getTextWidth(dateText), 9);
                pdf.setTextColor(0, 0, 0);
            };

            // Desenhar rodapé (número de página adicionado depois)
            const drawFooter = (pageNum, totalPgs) => {
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.setFont('helvetica', 'normal');
                const footerText = `Página ${pageNum} de ${totalPgs}`;
                const dateGen = `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                pdf.text(dateGen, margin, pageHeight - 3);
                pdf.text(footerText, pageWidth - margin - pdf.getTextWidth(footerText), pageHeight - 3);
                pdf.setTextColor(0, 0, 0);
            };

            // Posicionar seções nas páginas sem cortar nenhuma
            let currentPage = 1;
            let cursorY = headerH; // começa após o cabeçalho na primeira página
            drawHeader();

            for (let i = 0; i < sectionCanvases.length; i++) {
                const canvas = sectionCanvases[i];
                const sectionMmWidth = usableWidth;
                const sectionMmHeight = (canvas.height / canvas.width) * sectionMmWidth;
                const maxUsableH = pageHeight - footerH - margin;

                // Se a seção é maior que uma página inteira, fazer fallback com fatias
                if (sectionMmHeight > (maxUsableH - margin)) {
                    // Se não estamos no topo da página, criar nova página
                    if (cursorY > headerH + 2) {
                        pdf.addPage();
                        currentPage++;
                        cursorY = margin;
                    }
                    // Fatiar esta seção grande
                    const ratio = sectionMmWidth / canvas.width;
                    let sliceOffset = 0;
                    while (sliceOffset < canvas.height) {
                        const availableH = maxUsableH - cursorY;
                        const sliceHeightPx = Math.min(
                            Math.floor(availableH / ratio),
                            canvas.height - sliceOffset
                        );
                        if (sliceHeightPx <= 0) {
                            pdf.addPage();
                            currentPage++;
                            cursorY = margin;
                            continue;
                        }
                        const sliceCanvas = document.createElement('canvas');
                        sliceCanvas.width = canvas.width;
                        sliceCanvas.height = sliceHeightPx;
                        const ctx = sliceCanvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                        ctx.drawImage(canvas, 0, sliceOffset, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
                        const imgData = sliceCanvas.toDataURL('image/png');
                        const imgH = sliceHeightPx * ratio;
                        pdf.addImage(imgData, 'PNG', margin, cursorY, sectionMmWidth, imgH);
                        cursorY += imgH;
                        sliceOffset += sliceHeightPx;
                        if (sliceOffset < canvas.height) {
                            pdf.addPage();
                            currentPage++;
                            cursorY = margin;
                        }
                    }
                    cursorY += gapBetweenSections;
                    continue;
                }

                // Verificar se cabe na página atual
                const spaceLeft = maxUsableH - cursorY;
                if (sectionMmHeight > spaceLeft) {
                    // Não cabe: nova página
                    pdf.addPage();
                    currentPage++;
                    cursorY = margin;
                }

                // Desenhar seção inteira (sem cortar)
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', margin, cursorY, sectionMmWidth, sectionMmHeight);
                cursorY += sectionMmHeight + gapBetweenSections;
            }

            // Adicionar rodapés em todas as páginas
            const totalPages = pdf.internal.getNumberOfPages();
            for (let p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                drawFooter(p, totalPages);
            }

            pdf.save(`relatorio_${startDate}_${endDate}.pdf`);
            toast.success("PDF exportado com sucesso!");
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            toast.error("Erro ao gerar PDF");
        } finally {
            // Restaurar estilos originais dos grids
            gridOverrides.forEach(({ el, origStyle }) => { el.style.cssText = origStyle; });
            input.style.cssText = originalStyle;
            btns.forEach(b => b.style.display = '');
        }
    };

    const DetailedTable = () => (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente/Mesa</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entregador</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor Líquido</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredPedidos.map(p => {
                        const pedidoCancelado = isPedidoCancelado(p);
                        // Verifica se teve itens cancelados por dentro da mesa pra mostrar um aviso
                        const teveItemCancelado = p.itens?.some(it => String(it.status).toLowerCase() === 'cancelado');

                        return (
                        <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{format(p.data, 'dd/MM HH:mm')}</td>
                            <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.tipo === 'mesa' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {p.tipo.toUpperCase()}
                                </span>
                                <span className="ml-2 text-gray-500 font-mono text-xs">#{p.id.slice(0,6)}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {p.tipo === 'mesa' ? 
                                    <div className="font-bold">Mesa {p.mesaNumero} <span className="text-gray-400 font-normal text-xs">{p.loteHorario}</span></div> : 
                                    <div>{p.clienteNome} <div className="text-xs text-gray-400">{p.bairro}</div></div>
                                }
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {p.motoboyNome ? <div className="flex items-center gap-1"><FaMotorcycle className="text-gray-500"/> {p.motoboyNome}</div> : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                                {traduzirPagamento(p.formaPagamento)}
                            </td>
                            <td className={`px-4 py-3 text-sm font-bold ${pedidoCancelado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {p.totalFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-4 py-3 text-sm">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${pedidoCancelado ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                    {pedidoCancelado ? 'CANCELADO' : p.status}
                                </span>
                                {teveItemCancelado && !pedidoCancelado && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1">Teve item cancelado</p>
                                )}
                            </td>
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
    );

    const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

    return (
        <div className="min-h-screen bg-[#F8FAFC] p-3 sm:p-6 font-sans">
            <div className="max-w-7xl mx-auto mb-4">
                <div className="flex justify-end gap-2 no-print">
                    <button onClick={handleExportCSV} disabled={!filteredPedidos.length} className="bg-emerald-600 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
                        <IoDownloadOutline size={16}/> CSV
                    </button>
                    <button onClick={handleExportPDF} disabled={!filteredPedidos.length} className="bg-blue-600 text-white px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm">
                        <IoPrintOutline size={16}/> PDF
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto" ref={reportContentRef}>
                {/* FILTROS */}
                <Card title={<><IoFilterOutline className="text-blue-600"/> Filtros</>} className="mb-6" data-pdf-section="filtros">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">De</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-full" />
                        </div>
                        <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-black text-gray-400 mr-2 uppercase">Até</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs font-bold text-gray-700 outline-none w-full" />
                        </div>
                        <select value={deliveryTypeFilter} onChange={e => setDeliveryTypeFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm col-span-2 sm:col-span-1">
                            <option value="todos">Todos Tipos</option>
                            <option value="delivery">Delivery</option>
                            <option value="mesa">Mesas</option>
                        </select>
                        <select value={motoboyFilter} onChange={e => setMotoboyFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm col-span-2 sm:col-span-1">
                            <option value="todos">Todos Motoboys</option>
                            {availableMotoboys.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                        </select>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 bg-white shadow-sm col-span-2 sm:col-span-1">
                            <option value="valido">Apenas Válidos</option>
                            <option value="cancelado">Apenas Cancelados</option>
                            <option value="todos">Mostrar Tudo</option>
                        </select>
                        <button onClick={fetchData} disabled={loadingData} className="bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex justify-center items-center gap-2 text-xs font-bold transition-all shadow-sm no-print col-span-2 sm:col-span-1">
                            {loadingData ? '...' : <><IoRefreshOutline/> Filtrar</>}
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => { const h = format(new Date(), 'yyyy-MM-dd'); setStartDate(h); setEndDate(h); }} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition-all">Hoje</button>
                        <button onClick={() => { setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')); }} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition-all">7 dias</button>
                        <button onClick={() => { setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd')); setEndDate(format(new Date(), 'yyyy-MM-dd')); }} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:bg-gray-200 transition-all">30 dias</button>
                        <div className="flex-1 min-w-[150px]">
                            <input type="text" placeholder="🔍 Buscar cliente, bairro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border border-gray-200 rounded-xl text-xs font-medium bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500/50"/>
                        </div>
                        <div className="flex bg-gray-100 p-0.5 rounded-lg shadow-inner border border-gray-200">
                            <button onClick={() => setViewMode('charts')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'charts' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><IoAnalyticsOutline/> Gráficos</button>
                            <button onClick={() => setViewMode('table')} className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}><IoListOutline/> Lista</button>
                        </div>
                    </div>
                </Card>

                {/* GRÁFICOS E CARDS */}
                {viewMode === 'charts' && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6" data-pdf-section="stats">
                            <StatCard title="Faturamento Líquido" value={metrics.totalVendas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<IoCashOutline/>} color="green" />
                            <StatCard title="Taxas de Entrega" value={metrics.totalTaxas.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<FaMotorcycle/>} color="indigo" />
                            <StatCard title="Ticket Médio" value={metrics.ticketMedio.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} icon={<IoStatsChartOutline/>} color="purple" />
                            <StatCard title="Pedidos Válidos" value={metrics.count} subtitle={`${metrics.mesaMetrics.count} mesas`} icon={<IoReceiptOutline/>} color="blue" />
                        </div>

                        {/* ANALISE DE PERDA, BAIRROS E CLIENTES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6" data-pdf-section="health">
                            <Card title={<><IoAlertCircleOutline className="text-red-600"/> Saúde da Operação</>}>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-gray-500 text-sm">Cancelamentos Totais</p>
                                        <p className="text-2xl font-bold text-red-600">{metrics.cancelamentos.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                        <p className="text-xs text-gray-400 mt-1">{metrics.cancelamentos.textoQtd}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-red-600">{metrics.cancelamentos.taxa}%</div>
                                        <p className="text-xs text-gray-400">Taxa de Rejeição Geral</p>
                                    </div>
                                </div>
                                <div className="mt-4 bg-gray-200 rounded-full h-2"><div className="bg-red-600 h-2 rounded-full" style={{width: `${Math.min(metrics.cancelamentos.taxa, 100)}%`}}></div></div>
                            </Card>

                            <Card title={<><IoMapOutline className="text-orange-600"/> Top Bairros</>}>
                                <div className="space-y-2">
                                    {metrics.topBairros.length > 0 ? metrics.topBairros.map(([b, q], i) => (
                                        <div key={b} className="flex justify-between border-b pb-1 last:border-0">
                                            <div className="flex gap-2 text-sm"><span className="font-bold text-gray-600">#{i+1}</span> <span className="capitalize">{b}</span></div>
                                            <span className="font-bold text-blue-600 text-sm">{q}</span>
                                        </div>
                                    )) : <p className="text-gray-400 text-center text-sm">Sem dados de endereço</p>}
                                </div>
                            </Card>

                            <Card title={<><IoPeopleOutline className="text-purple-600"/> Top Clientes</>}>
                                <div className="space-y-3">
                                    {metrics.topClients.length > 0 ? (
                                        metrics.topClients.map((client, index) => (
                                            <div key={index} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                                        ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                                                          index === 1 ? 'bg-gray-200 text-gray-700' :
                                                          index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-purple-50 text-purple-600'}
                                                    `}>
                                                        {index + 1}º
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800 truncate w-[100px] sm:w-[120px]" title={client.nome}>
                                                            {client.nome}
                                                        </p>
                                                        <p className="text-[10px] text-gray-500">
                                                            {client.count} ped. {client.bairro ? `• ${client.bairro.substring(0,10)}...` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-green-600">
                                                        {client.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-gray-400 text-center text-sm py-4">Sem dados de clientes.</p>
                                    )}
                                </div>
                            </Card>
                        </div>

                        {/* DESEMPENHO DA FROTA */}
                        {metrics.topMotoboys.length > 0 && (
                            <div className="mb-6" data-pdf-section="frota">
                                <Card title={<><FaMotorcycle className="text-indigo-600"/> Performance da Frota</>}>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {metrics.topMotoboys.map((moto, index) => (
                                            <div key={moto.id} className="bg-gray-50 border rounded-lg p-3 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">{index+1}</div>
                                                    <div><p className="font-bold text-gray-800 text-sm">{moto.nome}</p><p className="text-xs text-gray-500">{moto.count} entregas</p></div>
                                                </div>
                                                <p className="font-bold text-green-600 text-sm">{moto.totalTaxas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {/* GRÁFICOS */}
                        <div className="grid lg:grid-cols-3 gap-6 mb-6" data-pdf-section="charts1">
                            <div className="lg:col-span-2">
                                <Card title="Evolução Diária">
                                    <div className="h-64"><Line data={{ labels: metrics.byDay.labels, datasets: [{ label: 'R$', data: metrics.byDay.data, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true }] }} options={lineChartOptions} /></div>
                                </Card>
                            </div>
                            <Card title="Top 5 Produtos Válidos">
                                {metrics.topItems.map(([n, q], i) => (
                                    <div key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded mb-2"><span className="text-sm truncate max-w-[180px] font-medium">{n}</span><span className="text-xs bg-blue-100 text-blue-800 px-2 rounded">{q}</span></div>
                                ))}
                            </Card>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6" data-pdf-section="charts2">
                            <Card title="Meios de Pagamento"><div className="h-64"><Pie data={{ labels: metrics.byPayment.labels, datasets: [{ data: metrics.byPayment.data, backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] }] }} options={pieChartOptions} /></div></Card>
                            <Card title="Vendas por Hora"><div className="h-64"><Bar data={{ labels: metrics.byHour.labels, datasets: [{ label: 'Vendas', data: metrics.byHour.data, backgroundColor: '#3b82f6' }] }} options={barChartOptions} /></div></Card>
                        </div>
                        {/* RESUMO POR PAGAMENTO */}
                        {metrics.byPayment.labels.length > 0 && (() => {
                            const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                            const totalGeral = metrics.byPayment.data.reduce((a, b) => a + b, 0);
                            const sorted = metrics.byPayment.labels
                                .map((label, i) => ({ label, valor: metrics.byPayment.data[i], cor: colors[i % colors.length] }))
                                .sort((a, b) => b.valor - a.valor);
                            return (
                                <Card title="Resumo por Forma de Pagamento" data-pdf-section="pagamento">
                                    <div className="space-y-3">
                                        {sorted.map((item, i) => {
                                            const pct = totalGeral > 0 ? ((item.valor / totalGeral) * 100).toFixed(1) : '0.0';
                                            return (
                                                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.cor }}></span>
                                                        <span className="font-semibold text-gray-700 capitalize">{item.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className="text-sm font-bold text-gray-900">{fmtBRL(item.valor)}</span>
                                                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">{pct}%</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex items-center justify-between border-t-2 border-gray-200 pt-3 mt-2 px-4">
                                            <span className="font-bold text-gray-800">Total</span>
                                            <span className="font-bold text-green-600 text-lg">{fmtBRL(totalGeral)}</span>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })()}

                    </>
                )}

                {viewMode === 'table' && <Card title={`Detalhamento (${filteredPedidos.length})`}><DetailedTable /></Card>}

                {/* 🔥 SEÇÃO: ITENS VENDIDOS — visível em AMBOS os modos 🔥 */}
                {metrics.allItems.length > 0 && (() => {
                    const filteredItems = metrics.allItems.filter(it => 
                        itemSearchTerm === '' || it.nome.toLowerCase().includes(itemSearchTerm.toLowerCase())
                    );
                    const totalReceita = metrics.allItems.reduce((sum, it) => sum + it.receita, 0);
                    return (
                        <div className="mt-6" data-pdf-section="itens-vendidos">
                            <Card title={<><IoFastFoodOutline className="text-orange-600"/> Itens Vendidos ({metrics.totalItensVendidos} un.)</>}>
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                                            <span className="text-orange-600 font-bold">{metrics.allItems.length}</span>
                                            <span className="text-gray-500 ml-1">produtos diferentes</span>
                                        </div>
                                        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                                            <span className="text-green-600 font-bold">{fmtBRL(totalReceita)}</span>
                                            <span className="text-gray-500 ml-1">em itens</span>
                                        </div>
                                    </div>
                                    <div className="relative w-full sm:w-64">
                                        <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Buscar produto..." 
                                            value={itemSearchTerm} 
                                            onChange={e => setItemSearchTerm(e.target.value)} 
                                            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs font-medium bg-white shadow-sm outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">#</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black text-gray-400 uppercase tracking-wider">Produto</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">Qtd</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Preço Unit.</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black text-gray-400 uppercase tracking-wider">Receita</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-wider">% Vendas</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-100">
                                            {filteredItems.map((item, idx) => {
                                                const rankColors = [
                                                    'bg-yellow-100 text-yellow-700',
                                                    'bg-gray-200 text-gray-700',
                                                    'bg-orange-100 text-orange-700'
                                                ];
                                                const globalIdx = metrics.allItems.indexOf(item);
                                                return (
                                                    <tr key={item.nome} className="hover:bg-orange-50/50 transition-colors">
                                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${rankColors[globalIdx] || 'bg-gray-50 text-gray-500'}`}>
                                                                {globalIdx + 1}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-sm font-semibold text-gray-800 max-w-[200px] truncate" title={item.nome}>{item.nome}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full text-xs font-bold">{item.qtd}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-sm text-gray-600">{fmtBRL(item.precoUnit)}</td>
                                                        <td className="px-4 py-2.5 text-right text-sm font-bold text-green-600">{fmtBRL(item.receita)}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                                                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${Math.min(parseFloat(item.pctQtd), 100)}%` }}></div>
                                                                </div>
                                                                <span className="text-[10px] font-mono font-bold text-gray-500">{item.pctQtd}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {filteredItems.length === 0 && (
                                    <p className="text-center text-gray-400 text-sm py-6">Nenhum produto encontrado para "{itemSearchTerm}"</p>
                                )}
                            </Card>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default withEstablishmentAuth(AdminReports);
