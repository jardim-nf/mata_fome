import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { isPedidoCancelado, traduzirPagamento, fmtBRL } from '../utils/reportUtils';

export function useReportExport(startDate, endDate) {
    const handleExportCSV = useCallback((filteredPedidos) => {
        if (!filteredPedidos || !filteredPedidos.length) return toast.warn("Sem dados.");
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
        link.download = `relatorio_${startDate || 'export'}.csv`;
        link.click();
    }, [startDate]);

    const formatBR = (dt) => {
        if (!dt) return '—';
        const [y, m, d] = dt.split('-');
        return `${d}/${m}/${y}`;
    };

    // =====================================================
    // HELPERS compartilhados
    // =====================================================
    const drawPdfHeader = (pdf, pageW, margin) => {
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 0, pageW, 14, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Relatório de Desempenho', margin, 9);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const dateText = `Período: ${formatBR(startDate)} a ${formatBR(endDate)}`;
        pdf.text(dateText, pageW - margin - pdf.getTextWidth(dateText), 9);
        pdf.setTextColor(0, 0, 0);
    };

    const drawPdfFooters = (pdf, pageW, pageH, margin) => {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            pdf.setPage(p);
            if (p > 1) {
                pdf.setFillColor(37, 99, 235);
                pdf.rect(0, 0, pageW, 5, 'F');
            }
            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.setFont('helvetica', 'normal');
            const footerText = `Página ${p} de ${totalPages}`;
            const dateGen = `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
            pdf.text(dateGen, margin, pageH - 3);
            pdf.text(footerText, pageW - margin - pdf.getTextWidth(footerText), pageH - 3);
        }
    };

    const drawLine = (pdf, margin, pageW, y, color = [220, 220, 220]) => {
        pdf.setDrawColor(...color);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, pageW - margin, y);
    };

    // =====================================================
    // Renderizar tabela de Detalhamento no PDF
    // =====================================================
    const renderDetalhamento = (pdf, filteredPedidos, metrics, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        let currentPage = pdf.internal.getNumberOfPages();
        const rowH = 7;
        const colWidths = [22, 15, 38, 30, 25, 25, 22, 15];
        const headers = ['Data', 'Tipo', 'Cliente/Mesa', 'Entregador', 'Pagamento', 'Valor Pgto', 'Vlr Líquido', 'Status'];

        // Título
        pdf.setFontSize(13);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Detalhamento (${filteredPedidos.length} pedidos)`, margin, cursorY + 5);
        cursorY += 10;

        const drawTableHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, rowH, 'F');
            drawLine(pdf, margin, pageW, cursorY + rowH, [200, 200, 200]);
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let xPos = margin + 2;
            headers.forEach((h, i) => {
                pdf.text(h.toUpperCase(), xPos, cursorY + 4.5);
                xPos += colWidths[i];
            });
            cursorY += rowH;
            pdf.setTextColor(0, 0, 0);
        };

        drawTableHeader();

        filteredPedidos.forEach((p, idx) => {
            if (cursorY + rowH + 1 > pageH - footerH) {
                pdf.addPage(); currentPage++; cursorY = margin + 6;
                drawTableHeader();
            }

            const cancelado = isPedidoCancelado(p);
            if (idx % 2 === 1) {
                pdf.setFillColor(248, 250, 252);
                pdf.rect(margin, cursorY, usableW, rowH, 'F');
            }

            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(50, 50, 50);
            let xPos = margin + 2;

            // Data
            pdf.text(format(p.data, 'dd/MM HH:mm'), xPos, cursorY + 4.5);
            xPos += colWidths[0];

            // Tipo badge
            const isMesa = p.tipo === 'mesa';
            pdf.setFillColor(isMesa ? 243 : 219, isMesa ? 232 : 234, isMesa ? 255 : 254);
            pdf.roundedRect(xPos, cursorY + 1.2, 12, 4.5, 1, 1, 'F');
            pdf.setFontSize(5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(isMesa ? 126 : 37, isMesa ? 87 : 99, isMesa ? 194 : 235);
            pdf.text(isMesa ? 'MESA' : 'DELIVERY', xPos + 1, cursorY + 4.3);
            pdf.setTextColor(50, 50, 50);
            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            xPos += colWidths[1];

            // Cliente/Mesa
            const clienteText = isMesa ? `Mesa ${p.mesaNumero || ''}` : (p.clienteNome || '-');
            pdf.text(clienteText.substring(0, 24), xPos, cursorY + 4.5);
            xPos += colWidths[2];

            // Entregador
            pdf.text((p.motoboyNome || '-').substring(0, 20), xPos, cursorY + 4.5);
            xPos += colWidths[3];

            // Pagamento
            let formaPgtoText = '-';
            if (p.pagamentos && Object.keys(p.pagamentos).length > 0) {
                formaPgtoText = Object.values(p.pagamentos).map(pg => traduzirPagamento(pg.formaPagamento || pg.forma)).join(', ');
            } else if (p.formaPagamento) {
                formaPgtoText = traduzirPagamento(p.formaPagamento);
            }
            pdf.text(formaPgtoText.substring(0, 16), xPos, cursorY + 4.5);
            xPos += colWidths[4];

            // Valor Pagamento
            let valorPgtoText = '';
            if (p.pagamentos && Object.keys(p.pagamentos).length > 0) {
                valorPgtoText = Object.values(p.pagamentos).map(pg => fmtBRL(pg.valor || 0)).join(', ');
            }
            pdf.setFontSize(6.5);
            pdf.text(valorPgtoText.substring(0, 18), xPos, cursorY + 4.5);
            pdf.setFontSize(7);
            xPos += colWidths[5];

            // Valor Líquido
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(cancelado ? 180 : 30, cancelado ? 180 : 30, cancelado ? 180 : 30);
            pdf.text(fmtBRL(p.totalFinal), xPos, cursorY + 4.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(50, 50, 50);
            xPos += colWidths[6];

            // Status badge
            const statusLabel = cancelado ? 'CANCEL.' : 'OK';
            pdf.setFillColor(cancelado ? 254 : 220, cancelado ? 226 : 252, cancelado ? 226 : 231);
            pdf.roundedRect(xPos, cursorY + 1.2, 12, 4.5, 1, 1, 'F');
            pdf.setFontSize(5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(cancelado ? 185 : 22, cancelado ? 28 : 101, cancelado ? 28 : 52);
            pdf.text(statusLabel, xPos + 1, cursorY + 4.3);

            pdf.setTextColor(0, 0, 0);
            drawLine(pdf, margin, pageW, cursorY + rowH, [235, 235, 235]);
            cursorY += rowH;
        });

        // Total row
        if (cursorY + 10 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
        pdf.setFillColor(239, 246, 255);
        pdf.rect(margin, cursorY, usableW, 8, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(37, 99, 235);
        pdf.text(`TOTAL: ${fmtBRL(metrics.totalVendas)}`, margin + 2, cursorY + 5.5);
        const resumoDir = `${metrics.count} pedidos válidos`;
        pdf.text(resumoDir, pageW - margin - pdf.getTextWidth(resumoDir) - 2, cursorY + 5.5);
        cursorY += 14;
        pdf.setTextColor(0, 0, 0);

        return cursorY;
    };

    // =====================================================
    // Renderizar Resumo por Pagamento
    // =====================================================
    const renderResumoPagamento = (pdf, metrics, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        if (!metrics.byPayment || !metrics.byPayment.labels.length) return cursorY;

        if (cursorY + 30 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Resumo por Forma de Pagamento', margin, cursorY);
        cursorY += 7;

        const totalGeral = metrics.byPayment.data.reduce((a, b) => a + b, 0);
        const colors = [[16,185,129], [59,130,246], [245,158,11], [239,68,68], [139,92,246]];
        const sorted = metrics.byPayment.labels
            .map((label, i) => ({ label, valor: metrics.byPayment.data[i], color: colors[i % colors.length] }))
            .sort((a, b) => b.valor - a.valor);

        sorted.forEach((item) => {
            if (cursorY + 10 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            const pct = totalGeral > 0 ? ((item.valor / totalGeral) * 100).toFixed(1) : '0.0';
            pdf.setFillColor(248, 250, 252);
            pdf.roundedRect(margin, cursorY, usableW, 8, 1.5, 1.5, 'F');
            pdf.setFillColor(...item.color);
            pdf.circle(margin + 5, cursorY + 4, 1.5, 'F');
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            pdf.text(item.label, margin + 10, cursorY + 5.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 30, 30);
            pdf.text(fmtBRL(item.valor), pageW - margin - 30, cursorY + 5.5);
            pdf.setFontSize(7);
            pdf.setTextColor(120, 120, 120);
            pdf.text(`${pct}%`, pageW - margin - 8, cursorY + 5.5);
            cursorY += 10;
        });

        if (cursorY + 10 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
        drawLine(pdf, margin, pageW, cursorY, [37, 99, 235]);
        cursorY += 3;
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(37, 99, 235);
        pdf.text('TOTAL', margin + 10, cursorY + 4);
        pdf.setTextColor(16, 185, 129);
        pdf.text(fmtBRL(totalGeral), pageW - margin - 30, cursorY + 4);
        cursorY += 12;
        pdf.setTextColor(0, 0, 0);

        return cursorY;
    };

    // =====================================================
    // Renderizar Tabela de Itens Vendidos
    // =====================================================
    const renderItensVendidos = (pdf, metrics, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        if (!metrics.allItems || !metrics.allItems.length) return cursorY;

        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        const totalReceita = metrics.allItems.reduce((sum, it) => sum + it.receita, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Itens Vendidos (${metrics.totalItensVendidos} un.)`, margin, cursorY);
        cursorY += 3;
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(120, 120, 120);
        pdf.text(`${metrics.allItems.length} produtos  •  ${fmtBRL(totalReceita)} em itens`, margin, cursorY + 3);
        cursorY += 7;

        const itemColW = [10, 78, 15, 28, 28, 20];
        const itemHeaders = ['#', 'Produto', 'Qtd', 'Preço Unit.', 'Receita', '% Vendas'];

        const drawItemsHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, 6, 'F');
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let ix = margin + 2;
            itemHeaders.forEach((h, i) => {
                if (i >= 2) {
                    pdf.text(h.toUpperCase(), ix + itemColW[i] - 3, cursorY + 4, { align: 'right' });
                } else {
                    pdf.text(h.toUpperCase(), ix, cursorY + 4);
                }
                ix += itemColW[i];
            });
            cursorY += 7;
        };

        drawItemsHeader();

        metrics.allItems.forEach((item, idx) => {
            if (cursorY + 7 > pageH - footerH) {
                pdf.addPage(); cursorY = margin + 6;
                drawItemsHeader();
            }

            if (idx % 2 === 1) {
                pdf.setFillColor(248, 250, 252);
                pdf.rect(margin, cursorY, usableW, 6.5, 'F');
            }

            pdf.setFontSize(7);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(50, 50, 50);
            let ix = margin + 2;

            pdf.setFont('helvetica', 'bold');
            pdf.text(String(idx + 1), ix + 3, cursorY + 4.5);
            pdf.setFont('helvetica', 'normal');
            ix += itemColW[0];

            pdf.setFont('helvetica', 'bold');
            pdf.text(item.nome.substring(0, 50), ix, cursorY + 4.5);
            pdf.setFont('helvetica', 'normal');
            ix += itemColW[1];

            pdf.setTextColor(37, 99, 235);
            pdf.setFont('helvetica', 'bold');
            pdf.text(String(item.qtd), ix + itemColW[2] - 5, cursorY + 4.5, { align: 'right' });
            pdf.setTextColor(50, 50, 50);
            pdf.setFont('helvetica', 'normal');
            ix += itemColW[2];

            pdf.text(fmtBRL(item.precoUnit), ix + itemColW[3] - 3, cursorY + 4.5, { align: 'right' });
            ix += itemColW[3];

            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(16, 185, 129);
            pdf.text(fmtBRL(item.receita), ix + itemColW[4] - 3, cursorY + 4.5, { align: 'right' });
            pdf.setTextColor(50, 50, 50);
            pdf.setFont('helvetica', 'normal');
            ix += itemColW[4];

            pdf.text(`${item.pctQtd}%`, ix + itemColW[5] - 5, cursorY + 4.5, { align: 'right' });

            drawLine(pdf, margin, pageW, cursorY + 6.5, [240, 240, 240]);
            cursorY += 6.5;
        });

        return cursorY + 4;
    };

    // =====================================================
    // Capturar seções visíveis via html2canvas
    // =====================================================
    const captureVisibleSections = async (pdf, input, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        const gapBetweenSections = 4;

        const sections = input.querySelectorAll('[data-pdf-section]');
        const elements = sections.length > 0 ? Array.from(sections) : Array.from(input.children).filter(c => c.offsetHeight > 0);

        for (const el of elements) {
            const canvas = await html2canvas(el, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                allowTaint: true,
                windowWidth: 1200,
            });

            const sectionMmW = usableW;
            const sectionMmH = (canvas.height / canvas.width) * sectionMmW;
            const maxUsableH = pageH - footerH - margin;

            if (sectionMmH > (maxUsableH - margin)) {
                if (cursorY > 20) { pdf.addPage(); cursorY = margin; }
                const ratio = sectionMmW / canvas.width;
                let sliceOffset = 0;
                while (sliceOffset < canvas.height) {
                    const availableH = maxUsableH - cursorY;
                    const sliceHeightPx = Math.min(Math.floor(availableH / ratio), canvas.height - sliceOffset);
                    if (sliceHeightPx <= 0) { pdf.addPage(); cursorY = margin; continue; }
                    const sliceCanvas = document.createElement('canvas');
                    sliceCanvas.width = canvas.width;
                    sliceCanvas.height = sliceHeightPx;
                    const ctx = sliceCanvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                    ctx.drawImage(canvas, 0, sliceOffset, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
                    const imgData = sliceCanvas.toDataURL('image/png');
                    const imgH = sliceHeightPx * ratio;
                    pdf.addImage(imgData, 'PNG', margin, cursorY, sectionMmW, imgH);
                    cursorY += imgH;
                    sliceOffset += sliceHeightPx;
                    if (sliceOffset < canvas.height) { pdf.addPage(); cursorY = margin; }
                }
                cursorY += gapBetweenSections;
            } else {
                const spaceLeft = maxUsableH - cursorY;
                if (sectionMmH > spaceLeft) { pdf.addPage(); cursorY = margin; }
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', margin, cursorY, sectionMmW, sectionMmH);
                cursorY += sectionMmH + gapBetweenSections;
            }
        }

        return cursorY;
    };

    /**
     * PDF PRINCIPAL
     * - viewMode 'charts': Captura gráficos/cards da tela + adiciona tabelas programáticas
     * - viewMode 'table': Captura a tabela de lista da tela + adiciona itens vendidos
     */
    const handleExportPDF = useCallback(async (reportContentRef, filteredPedidos, metrics, viewMode) => {
        const input = reportContentRef?.current;
        if (!input) return;
        if (!filteredPedidos || !filteredPedidos.length) return toast.warn("Sem dados para exportar.");

        const loadingToast = toast.loading("Gerando PDF completo...");

        const btns = document.querySelectorAll('.no-print');
        btns.forEach(b => b.style.display = 'none');

        const originalStyle = input.style.cssText;
        input.style.width = '1200px';
        input.style.maxWidth = '1200px';
        input.style.minWidth = '1200px';
        input.style.overflow = 'visible';

        const gridOverrides = [];
        input.querySelectorAll('.grid').forEach(grid => {
            const origStyle = grid.style.cssText;
            const cls = grid.className;
            if (cls.includes('lg:grid-cols-4')) grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            else if (cls.includes('lg:grid-cols-3') || cls.includes('md:grid-cols-3')) grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            else if (cls.includes('lg:grid-cols-2') || cls.includes('md:grid-cols-2')) grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            else if (cls.includes('md:grid-cols-6')) grid.style.gridTemplateColumns = 'repeat(6, 1fr)';
            else if (cls.includes('md:grid-cols-4') || cls.includes('sm:grid-cols-4')) grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            gridOverrides.push({ el: grid, origStyle });
        });

        await new Promise(r => setTimeout(r, 600));

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const usableW = pageW - margin * 2;
            const footerH = 8;

            // Cabeçalho
            drawPdfHeader(pdf, pageW, margin);
            let cursorY = 18;

            if (viewMode === 'charts') {
                // ==============================
                // MODO GRÁFICOS: Tudo
                // ==============================
                // 1) Capturar gráficos e cards visíveis na tela (exceto itens-vendidos que será programático)
                cursorY = await captureVisibleSections(pdf, input, margin, pageW, pageH, usableW, footerH, cursorY);

                // 2) Nova página com tabela de Detalhamento
                pdf.addPage();
                cursorY = margin + 6;
                cursorY = renderDetalhamento(pdf, filteredPedidos, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

                // 3) Itens Vendidos (programático - mais bonito que screenshot)
                if (cursorY + 30 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
                cursorY = renderItensVendidos(pdf, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

                // 4) Resumo por Pagamento
                cursorY = renderResumoPagamento(pdf, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

            } else {
                // ==============================
                // MODO LISTA: Detalhamento + tabelas programáticas
                // ==============================
                // 1) Detalhamento (tabela de pedidos - lista)
                cursorY = renderDetalhamento(pdf, filteredPedidos, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

                // 2) Itens Vendidos (programático)
                if (cursorY + 30 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
                cursorY = renderItensVendidos(pdf, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

                // 3) Resumo por Pagamento
                if (cursorY + 30 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
                cursorY = renderResumoPagamento(pdf, metrics, margin, pageW, pageH, usableW, footerH, cursorY);
            }

            // Rodapés
            drawPdfFooters(pdf, pageW, pageH, margin);

            pdf.save(`relatorio_${startDate}_${endDate}.pdf`);
            toast.dismiss(loadingToast);
            toast.success("PDF exportado com sucesso!");
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            toast.dismiss(loadingToast);
            toast.error("Erro ao gerar PDF");
        } finally {
            gridOverrides.forEach(({ el, origStyle }) => { el.style.cssText = origStyle; });
            input.style.cssText = originalStyle;
            btns.forEach(b => b.style.display = '');
        }
    }, [startDate, endDate]);

    return {
        handleExportCSV,
        handleExportPDF
    };
}
