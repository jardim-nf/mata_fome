import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { vendaService } from '../services/vendaService';
import { formatarMoeda } from '../utils/formatCurrency';
import {
    FaCheckCircle, FaClock, FaTimesCircle,
    FaExclamationTriangle, FaBan, FaInfoCircle
} from 'react-icons/fa';

// ─── Constantes ─────────────────────────────────────────────────────
const STATUS_MAP = {
    CONCLUIDO: { label: 'Autorizada', color: 'bg-green-100 text-green-800', icon: FaCheckCircle, iconColor: 'text-green-500' },
    PROCESSANDO: { label: 'Processando', color: 'bg-yellow-100 text-yellow-800', icon: FaClock, iconColor: 'text-yellow-500' },
    REJEITADO: { label: 'Rejeitada', color: 'bg-red-100 text-red-800', icon: FaTimesCircle, iconColor: 'text-red-500' },
    ERRO: { label: 'Erro', color: 'bg-red-100 text-red-800', icon: FaExclamationTriangle, iconColor: 'text-red-500' },
    CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600', icon: FaBan, iconColor: 'text-gray-500' },
};

const ITEMS_PER_PAGE = 20;

export function useRelatorioNfceData(estabelecimentoPrincipal) {
    const [vendas, setVendas] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [filtroStatus, setFiltroStatus] = useState('TODOS');
    const [busca, setBusca] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [paginaAtual, setPaginaAtual] = useState(1);

    // Modal detalhes
    const [vendaSelecionada, setVendaSelecionada] = useState(null);
    const [loadingAcao, setLoadingAcao] = useState(null);

    // ─── Helpers  ─────────────────────────────────────────────────────
    const getStatusInfo = useCallback((status) => {
        return STATUS_MAP[status] || { label: status || 'Sem nota', color: 'bg-gray-100 text-gray-500', icon: FaInfoCircle, iconColor: 'text-gray-400' };
    }, []);

    const formatDateTime = useCallback((date) => {
        if (!date) return '—';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }, []);

    const formatDate = useCallback((date) => {
        if (!date) return '—';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }, []);

    // ─── Carregamento Principal ──────────────────────────────────────
    const carregarVendas = useCallback(async () => {
        if (!estabelecimentoPrincipal) return;
        setLoading(true);
        try {
            const todas = await vendaService.buscarVendasPorEstabelecimento(estabelecimentoPrincipal, 500);
            const comFiscal = todas.filter(v => v.fiscal && v.fiscal.status);
            setVendas(comFiscal);
        } catch (err) {
            console.error('Erro ao carregar vendas:', err);
            toast.error('Erro ao carregar dados fiscais.');
        } finally {
            setLoading(false);
        }
    }, [estabelecimentoPrincipal]);

    useEffect(() => {
        carregarVendas();
    }, [carregarVendas]);

    // ─── Processamento do Array ──────────────────────────────────────
    const vendasFiltradas = useMemo(() => {
        let resultado = [...vendas];

        if (filtroStatus !== 'TODOS') {
            resultado = resultado.filter(v => v.fiscal?.status === filtroStatus);
        }

        if (dataInicio) {
            const inicio = new Date(dataInicio + 'T00:00:00');
            resultado = resultado.filter(v => v.createdAt >= inicio);
        }
        if (dataFim) {
            const fim = new Date(dataFim + 'T23:59:59');
            resultado = resultado.filter(v => v.createdAt <= fim);
        }

        if (busca.trim()) {
            const termo = busca.toLowerCase().trim();
            resultado = resultado.filter(v =>
                v.id?.toLowerCase().includes(termo) ||
                v.fiscal?.idPlugNotas?.toLowerCase().includes(termo) ||
                v.fiscal?.numero?.toString().includes(termo) ||
                v.operador?.toLowerCase().includes(termo) ||
                v.clienteCpf?.includes(termo)
            );
        }

        return resultado;
    }, [vendas, filtroStatus, dataInicio, dataFim, busca]);

    // ─── Paginação Dinâmica ──────────────────────────────────────────
    const totalPaginas = Math.ceil(vendasFiltradas.length / ITEMS_PER_PAGE);
    const vendasPaginadas = useMemo(() => {
        const inicio = (paginaAtual - 1) * ITEMS_PER_PAGE;
        return vendasFiltradas.slice(inicio, inicio + ITEMS_PER_PAGE);
    }, [vendasFiltradas, paginaAtual]);

    useEffect(() => {
        setPaginaAtual(1);
    }, [filtroStatus, dataInicio, dataFim, busca]);

    // ─── Estatísticas Globais ────────────────────────────────────────
    const stats = useMemo(() => {
        const total = vendasFiltradas.length;
        const autorizadas = vendasFiltradas.filter(v => v.fiscal?.status === 'CONCLUIDO').length;
        const processando = vendasFiltradas.filter(v => v.fiscal?.status === 'PROCESSANDO').length;
        const rejeitadas = vendasFiltradas.filter(v => ['REJEITADO', 'ERRO'].includes(v.fiscal?.status)).length;
        const canceladas = vendasFiltradas.filter(v => v.fiscal?.status === 'CANCELADA').length;
        const valorTotal = vendasFiltradas.reduce((sum, v) => sum + (v.total || 0), 0);
        return { total, autorizadas, processando, rejeitadas, canceladas, valorTotal };
    }, [vendasFiltradas]);

    // ─── Ações Web API Control ───────────────────────────────────────
    const handleBaixarPdf = async (venda) => {
        const idPlugNotas = venda.fiscal?.idPlugNotas;
        if (!idPlugNotas) return toast.warning('Sem ID PlugNotas para esta venda.');
        setLoadingAcao('pdf');
        try {
            const res = await vendaService.baixarPdfNfce(idPlugNotas, venda.fiscal?.pdf);
            if (!res.success) toast.error('Erro ao baixar PDF: ' + (res.error || ''));
            else toast.success('PDF aberto com sucesso!');
        } catch (e) {
            console.error(e);
            toast.error('Erro ao baixar PDF.');
        } finally {
            setLoadingAcao(null);
        }
    };

    const handleBaixarXml = async (venda) => {
        const idPlugNotas = venda.fiscal?.idPlugNotas;
        if (!idPlugNotas) return toast.warning('Sem ID PlugNotas para esta venda.');
        setLoadingAcao('xml');
        try {
            const res = await vendaService.baixarXmlNfce(idPlugNotas, venda.id.slice(-6));
            if (!res.success) toast.error('Erro ao baixar XML: ' + (res.error || ''));
            else toast.success('XML baixado!');
        } catch (e) {
            console.error(e);
            toast.error('Erro ao baixar XML.');
        } finally {
            setLoadingAcao(null);
        }
    };

    const handleBaixarXmlCancelamento = async (venda) => {
        const idPlugNotas = venda.fiscal?.idPlugNotas;
        if (!idPlugNotas) return toast.warning('Sem ID PlugNotas.');
        setLoadingAcao('xmlcancel');
        try {
            const res = await vendaService.baixarXmlCancelamentoNfce(idPlugNotas, venda.id.slice(-6));
            if (!res.success) toast.error('Erro: ' + (res.error || ''));
            else toast.success('XML de cancelamento baixado!');
        } catch (e) {
            console.error(e);
            toast.error('Erro ao baixar XML de cancelamento.');
        } finally {
            setLoadingAcao(null);
        }
    };

    const handleConsultarStatus = async (venda) => {
        const idPlugNotas = venda.fiscal?.idPlugNotas;
        if (!idPlugNotas) return toast.warning('Sem ID PlugNotas.');
        setLoadingAcao('status');
        try {
            const res = await vendaService.consultarStatusNfce(venda.id, idPlugNotas);
            if (res.sucesso || res.success) {
                toast.success('Status atualizado!');
                setVendas(prev => prev.map(v =>
                    v.id === venda.id ? { ...v, fiscal: { ...v.fiscal, ...res } } : v
                ));
                if (vendaSelecionada?.id === venda.id) {
                    setVendaSelecionada(prev => ({ ...prev, fiscal: { ...prev.fiscal, ...res } }));
                }
            } else {
                toast.error('Erro ao consultar: ' + (res.error || res.mensagem || ''));
            }
        } catch (e) {
            console.error(e);
            toast.error('Erro ao consultar status.');
        } finally {
            setLoadingAcao(null);
        }
    };

    // ─── Exportadores Geradores ──────────────────────────────────────
    const handleExportarCSV = () => {
        if (vendasFiltradas.length === 0) return toast.info('Nenhum dado para exportar.');
        const header = 'Data,Venda ID,Status NFC-e,ID PlugNotas,Valor,Forma Pgto,Operador,CPF Cliente';
        const linhas = vendasFiltradas.map(v => {
            return [
                formatDateTime(v.createdAt),
                v.id,
                getStatusInfo(v.fiscal?.status).label,
                v.fiscal?.idPlugNotas || '',
                (v.total || 0).toFixed(2).replace('.', ','),
                v.formaPagamento || '',
                v.operador || '',
                v.clienteCpf || ''
            ].join(';');
        });
        const csv = '\uFEFF' + header + '\n' + linhas.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_nfce_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('CSV exportado com sucesso!');
    };

    const handleBaixarLoteXml = async () => {
        const autorizadas = vendasFiltradas.filter(v => v.fiscal?.status === 'CONCLUIDO' && v.fiscal?.idPlugNotas);
        if (autorizadas.length === 0) return toast.warning('Nenhuma NF-e autorizada e com ID PlugNotas encontrada nos filtros atuais!');

        setLoadingAcao('lote');
        const toastId = toast.loading(`Preparando download de 0/${autorizadas.length} XMLs...`);

        try {
            // Lazy load JSZip
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();
            let sucessoCount = 0;

            for (let i = 0; i < autorizadas.length; i++) {
                const venda = autorizadas[i];
                const idPlugNotas = venda.fiscal.idPlugNotas;
                try {
                    const res = await vendaService.baixarXmlNfceRaw(idPlugNotas);
                    if (res.success && res.xml) {
                        zip.file(`NFCe_${venda.id.slice(-6)}_${idPlugNotas}.xml`, res.xml);
                        sucessoCount++;
                    }
                } catch (err) {
                    console.error('Erro baixar XML lote NF', idPlugNotas, err);
                }
                toast.update(toastId, { render: `Baixando ${i + 1}/${autorizadas.length} XMLs...` });
            }

            if (sucessoCount === 0) throw new Error('Falha ao baixar os XMLs.');

            toast.update(toastId, { render: "Compactando arquivos em ZIP...", type: "info", isLoading: true });

            const content = await zip.generateAsync({ type: "blob" });

            let estNomeLimpo = "Matafome_Lote";
            try {
                if (estabelecimentoPrincipal) {
                    const estDoc = await getDoc(doc(db, 'estabelecimentos', estabelecimentoPrincipal));
                    if (estDoc.exists()) {
                        const dataEst = estDoc.data();
                        const rawName = dataEst.nome || dataEst.slug || estabelecimentoPrincipal;
                        estNomeLimpo = rawName.toUpperCase().replace(/[-.,\s]+/g, '_');
                    }
                }
            } catch (err) {
                console.error("Erro ao buscar nome do estabelecimento", err);
            }

            const dataBaseForName = dataInicio ? new Date(dataInicio + 'T12:00:00') : new Date();
            const mesStr = (dataBaseForName.getMonth() + 1).toString().padStart(2, '0');
            const anoStr = dataBaseForName.getFullYear();
            
            saveAs(content, `XMLs_${estNomeLimpo}_${mesStr}_${anoStr}.zip`);

            toast.update(toastId, { render: `Sucesso! ${sucessoCount} XML(s) salvos no ZIP.`, type: 'success', isLoading: false, autoClose: 5000 });
        } catch (e) {
            console.error(e);
            toast.update(toastId, { render: e.message || 'Erro ao gerar lote de XMLs.', type: 'error', isLoading: false, autoClose: 5000 });
        } finally {
            setLoadingAcao(null);
        }
    };

    const handleExportarPDF = () => {
        if (vendasFiltradas.length === 0) return toast.info('Nenhum dado para exportar.');
        const rows = vendasFiltradas.map(v => {
            const si = getStatusInfo(v.fiscal?.status);
            return `<tr>
                <td>${formatDateTime(v.createdAt)}</td>
                <td style="font-family:monospace">${v.id.slice(-8)}</td>
                <td>${si.label}</td>
                <td style="font-family:monospace">${v.fiscal?.idPlugNotas || '—'}</td>
                <td style="text-align:right">${formatarMoeda(v.total || 0)}</td>
                <td>${v.formaPagamento || '—'}</td>
                <td>${v.operador || '—'}</td>
                <td>${v.clienteCpf || '—'}</td>
            </tr>`;
        }).join('');

        const periodoTxt = dataInicio || dataFim
            ? `Período: ${dataInicio || '...'} a ${dataFim || '...'}`
            : 'Período: Todos';
        const statusTxt = filtroStatus === 'TODOS' ? 'Todos' : getStatusInfo(filtroStatus).label;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
        <title>Relatório NFC-e</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
            th { background: #f3f4f6; font-size: 10px; text-transform: uppercase; font-weight: 600; }
            tr:nth-child(even) { background: #f9fafb; }
            .resumo { margin-top: 16px; font-size: 12px; }
            .resumo span { font-weight: bold; }
            @media print { body { padding: 0; } }
        </style></head><body>
        <h1>Relatório NFC-e</h1>
        <p class="meta">${periodoTxt} &nbsp;|&nbsp; Status: ${statusTxt} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
        <table>
            <thead><tr>
                <th>Data/Hora</th><th>Venda</th><th>Status</th><th>ID PlugNotas</th><th style="text-align:right">Valor</th><th>Pagamento</th><th>Operador</th><th>CPF</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="resumo">
            Total de notas: <span>${stats.total}</span> &nbsp;|&nbsp;
            Autorizadas: <span>${stats.autorizadas}</span> &nbsp;|&nbsp;
            Processando: <span>${stats.processando}</span> &nbsp;|&nbsp;
            Rejeitadas: <span>${stats.rejeitadas}</span> &nbsp;|&nbsp;
            Canceladas: <span>${stats.canceladas}</span> &nbsp;|&nbsp;
            Valor Total: <span>${formatarMoeda(stats.valorTotal)}</span>
        </div>
        <script>window.onload=function(){window.print();}<\/script>
        </body></html>`;

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        toast.success('PDF pronto para impressão!');
    };

    return {
        // Flags e Listagens
        loading, loadingAcao,
        vendasFiltradas, vendasPaginadas, stats,
        ITEMS_PER_PAGE, totalPaginas,
        
        // Contexto Modal/Selecionada (Compartilhado)
        vendaSelecionada, setVendaSelecionada,
        
        // Filters Binding
        filtroStatus, setFiltroStatus,
        busca, setBusca,
        dataInicio, setDataInicio,
        dataFim, setDataFim,
        paginaAtual, setPaginaAtual,

        // Ações Principais
        carregarVendas,
        handleExportarCSV, handleExportarPDF, handleBaixarLoteXml,
        handleBaixarPdf, handleBaixarXml, handleBaixarXmlCancelamento, handleConsultarStatus,
        
        // Utils
        formatDate, formatDateTime, getStatusInfo
    };
}
