import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { isPedidoCancelado, traduzirPagamento } from '../utils/reportUtils';

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

    const handleExportPDF = useCallback(async (reportContentRef) => {
        const input = reportContentRef.current;
        if (!input) return;
        
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
            if (cls.includes('lg:grid-cols-3') || cls.includes('md:grid-cols-3')) {
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

        await new Promise(r => setTimeout(r, 600));

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const usableWidth = pageWidth - margin * 2;
            const headerH = 18;
            const footerH = 8;
            const gapBetweenSections = 4;

            const sections = input.querySelectorAll('[data-pdf-section]');
            const elements = sections.length > 0 ? Array.from(sections) : Array.from(input.children).filter(c => c.offsetHeight > 0);

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

            let currentPage = 1;
            let cursorY = headerH;
            drawHeader();

            for (let i = 0; i < sectionCanvases.length; i++) {
                const canvas = sectionCanvases[i];
                const sectionMmWidth = usableWidth;
                const sectionMmHeight = (canvas.height / canvas.width) * sectionMmWidth;
                const maxUsableH = pageHeight - footerH - margin;

                if (sectionMmHeight > (maxUsableH - margin)) {
                    if (cursorY > headerH + 2) {
                        pdf.addPage();
                        currentPage++;
                        cursorY = margin;
                    }
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

                const spaceLeft = maxUsableH - cursorY;
                if (sectionMmHeight > spaceLeft) {
                    pdf.addPage();
                    currentPage++;
                    cursorY = margin;
                }

                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', margin, cursorY, sectionMmWidth, sectionMmHeight);
                cursorY += sectionMmHeight + gapBetweenSections;
            }

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
