import { useCallback } from 'react';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

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
        pdf.text('Relatório Financeiro e de Desempenho', margin, 9);
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
    // Renderizar resumo em cartões visuais
    // =====================================================
    const renderCardsResumo = (pdf, metrics, contasPagar, crediarioPagamentos, ordensServicoCriadas, ordensServicoPagas, caixasMovimentacoes, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Resumo Financeiro do Período', margin, cursorY + 5);
        cursorY += 10;

        const totalFiadosRecebidos = crediarioPagamentos.reduce((acc, c) => acc + c.valorTotalPago, 0);
        const totalDespesasPagas = contasPagar.filter(c => c.status === 'pago').reduce((acc, c) => acc + c.valor, 0);
        const totalSangrias = caixasMovimentacoes
            .filter(m => m.tipo && m.tipo.startsWith('sangria'))
            .reduce((acc, m) => acc + m.valor, 0);
        const totalSuprimentos = caixasMovimentacoes
            .filter(m => m.tipo && m.tipo.startsWith('suprimento'))
            .reduce((acc, m) => acc + m.valor, 0);
        const totalOSRecebidas = ordensServicoPagas.reduce((acc, os) => acc + os.total, 0);
        const totalOSCriadas = ordensServicoCriadas.reduce((acc, os) => acc + os.total, 0);

        const faturamentoDinheiroPixCartao = metrics.totalVendas - metrics.totalFiadosGerados;
        const saldoLiquidoEstimado = faturamentoDinheiroPixCartao + totalFiadosRecebidos - totalDespesasPagas - totalSangrias + totalSuprimentos;

        const gap = 4;
        const cardW = (usableW - gap) / 2;
        const cardH = 14;

        const drawCard = (x, y, title, val, color) => {
            pdf.setFillColor(248, 250, 252);
            pdf.setDrawColor(226, 232, 240);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

            pdf.setFontSize(6.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            pdf.text(title.toUpperCase(), x + 3, y + 4.5);

            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...color);
            pdf.text(fmtBRL(val), x + 3, y + 10.5);
        };

        const green = [16, 185, 129];
        const red = [239, 68, 68];
        const blue = [59, 130, 246];
        const indigo = [99, 102, 241];

        // Linha 1
        drawCard(margin, cursorY, 'Liquidez Estimada Caixa', saldoLiquidoEstimado, saldoLiquidoEstimado >= 0 ? green : red);
        drawCard(margin + cardW + gap, cursorY, 'Vendas Totais (Líquido)', metrics.totalVendas, green);
        cursorY += cardH + gap;

        // Linha 2
        drawCard(margin, cursorY, 'OS Recebidas (Faturadas)', totalOSRecebidas, green);
        drawCard(margin + cardW + gap, cursorY, 'OS Criadas (Abertas)', totalOSCriadas, indigo);
        cursorY += cardH + gap;

        // Linha 3
        drawCard(margin, cursorY, 'Amortizações Fiado', totalFiadosRecebidos, blue);
        drawCard(margin + cardW + gap, cursorY, 'Contas Pagas (Despesas)', totalDespesasPagas, red);
        cursorY += cardH + gap;

        // Linha 4
        drawCard(margin, cursorY, 'Sangrias Realizadas', totalSangrias, red);
        drawCard(margin + cardW + gap, cursorY, 'Suprimentos Realizados', totalSuprimentos, blue);
        cursorY += cardH + gap;

        return cursorY + 4;
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
        pdf.text('Resumo por Forma de Pagamento (Vendas)', margin, cursorY + 2);
        cursorY += 8;

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
    // Renderizar Tabela de Despesas
    // =====================================================
    const renderDespesas = (pdf, contasPagar, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        const rowH = 6;
        const colWidths = [70, 45, 30, 25, 20];
        const headers = ['Descrição', 'Categoria', 'Valor', 'Vencimento', 'Status'];

        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Despesas / Contas a Pagar (${contasPagar.length})`, margin, cursorY + 4);
        cursorY += 8;

        const drawHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, rowH, 'F');
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let xPos = margin + 2;
            headers.forEach((h, i) => {
                pdf.text(h.toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[i];
            });
            cursorY += rowH + 1;
        };

        drawHeader();

        if (contasPagar.length === 0) {
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(120, 120, 120);
            pdf.text('Nenhuma despesa registrada no período.', margin + 2, cursorY + 4);
            cursorY += rowH + 4;
        } else {
            contasPagar.forEach((c, idx) => {
                if (cursorY + rowH + 1 > pageH - footerH) {
                    pdf.addPage(); cursorY = margin + 6;
                    drawHeader();
                }

                if (idx % 2 === 1) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, cursorY, usableW, rowH, 'F');
                }

                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(50, 50, 50);
                let xPos = margin + 2;

                pdf.setFont('helvetica', 'bold');
                pdf.text(c.descricao.substring(0, 40), xPos, cursorY + 4);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[0];

                pdf.text(c.categoria.substring(0, 25), xPos, cursorY + 4);
                xPos += colWidths[1];

                pdf.text(fmtBRL(c.valor), xPos, cursorY + 4);
                xPos += colWidths[2];

                pdf.text(c.dataVencimento ? c.dataVencimento.split('-').reverse().join('/') : '-', xPos, cursorY + 4);
                xPos += colWidths[3];

                const isPago = c.status === 'pago';
                pdf.setFillColor(isPago ? 220 : 254, isPago ? 252 : 243, isPago ? 231 : 237);
                pdf.roundedRect(xPos, cursorY + 1, 10, 4, 0.8, 0.8, 'F');
                pdf.setFontSize(5);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(isPago ? 22 : 180, isPago ? 101 : 83, isPago ? 52 : 9);
                pdf.text(isPago ? 'PAGO' : 'PEND.', xPos + 1.5, cursorY + 3.8);

                cursorY += rowH;
            });
        }

        return cursorY + 6;
    };

    // =====================================================
    // Renderizar Tabela de Amortizações Fiado
    // =====================================================
    const renderFiadosRecebidos = (pdf, crediarioPagamentos, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        const rowH = 6;
        const colWidths = [65, 35, 45, 45];
        const headers = ['Cliente', 'Meio Pagamento', 'Valor Pago', 'Data/Hora'];

        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Amortizações / Recebimentos de Fiado (${crediarioPagamentos.length})`, margin, cursorY + 4);
        cursorY += 8;

        const drawHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, rowH, 'F');
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let xPos = margin + 2;
            headers.forEach((h, i) => {
                pdf.text(h.toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[i];
            });
            cursorY += rowH + 1;
        };

        drawHeader();

        if (crediarioPagamentos.length === 0) {
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(120, 120, 120);
            pdf.text('Nenhuma amortização registrada no período.', margin + 2, cursorY + 4);
            cursorY += rowH + 4;
        } else {
            crediarioPagamentos.forEach((p, idx) => {
                if (cursorY + rowH + 1 > pageH - footerH) {
                    pdf.addPage(); cursorY = margin + 6;
                    drawHeader();
                }

                if (idx % 2 === 1) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, cursorY, usableW, rowH, 'F');
                }

                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(50, 50, 50);
                let xPos = margin + 2;

                pdf.setFont('helvetica', 'bold');
                pdf.text(p.clienteNome.substring(0, 35), xPos, cursorY + 4);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[0];

                pdf.text(p.meioPagamento.toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[1];

                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(16, 185, 129);
                pdf.text(fmtBRL(p.valorTotalPago), xPos, cursorY + 4);
                pdf.setTextColor(50, 50, 50);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[2];

                pdf.text(format(p.data, 'dd/MM/yyyy HH:mm'), xPos, cursorY + 4);

                cursorY += rowH;
            });
        }

        return cursorY + 6;
    };

    // =====================================================
    // Renderizar OS Criadas
    // =====================================================
    const renderOSCriadas = (pdf, ordensServicoCriadas, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        const rowH = 6;
        const colWidths = [20, 55, 60, 25, 30];
        const headers = ['# OS', 'Cliente', 'Equipamento', 'Total', 'Abertura'];

        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Ordens de Serviço Criadas (${ordensServicoCriadas.length})`, margin, cursorY + 4);
        cursorY += 8;

        const drawHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, rowH, 'F');
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let xPos = margin + 2;
            headers.forEach((h, i) => {
                pdf.text(h.toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[i];
            });
            cursorY += rowH + 1;
        };

        drawHeader();

        if (ordensServicoCriadas.length === 0) {
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(120, 120, 120);
            pdf.text('Nenhuma ordem de serviço aberta no período.', margin + 2, cursorY + 4);
            cursorY += rowH + 4;
        } else {
            ordensServicoCriadas.forEach((os, idx) => {
                if (cursorY + rowH + 1 > pageH - footerH) {
                    pdf.addPage(); cursorY = margin + 6;
                    drawHeader();
                }

                if (idx % 2 === 1) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, cursorY, usableW, rowH, 'F');
                }

                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(50, 50, 50);
                let xPos = margin + 2;

                pdf.setFont('helvetica', 'bold');
                pdf.text(`#${os.numeroOS}`, xPos, cursorY + 4);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[0];

                pdf.text((os.cliente?.nome || 'Cliente').substring(0, 30), xPos, cursorY + 4);
                xPos += colWidths[1];

                pdf.text(`${os.equipamento?.marca || ''} ${os.equipamento?.modelo || ''}`.substring(0, 30), xPos, cursorY + 4);
                xPos += colWidths[2];

                pdf.text(fmtBRL(os.total), xPos, cursorY + 4);
                xPos += colWidths[3];

                pdf.text(os.createdAt ? format(os.createdAt, 'dd/MM/yyyy') : '-', xPos, cursorY + 4);

                cursorY += rowH;
            });
        }

        return cursorY + 6;
    };

    // =====================================================
    // Renderizar OS Recebidas
    // =====================================================
    const renderOSPagas = (pdf, ordensServicoPagas, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        const rowH = 6;
        const colWidths = [20, 60, 45, 30, 35];
        const headers = ['# OS', 'Cliente', 'Forma Pagto', 'Valor Pago', 'Faturamento'];

        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Recebimentos de Ordens de Serviço (${ordensServicoPagas.length})`, margin, cursorY + 4);
        cursorY += 8;

        const drawHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, rowH, 'F');
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let xPos = margin + 2;
            headers.forEach((h, i) => {
                pdf.text(h.toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[i];
            });
            cursorY += rowH + 1;
        };

        drawHeader();

        if (ordensServicoPagas.length === 0) {
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(120, 120, 120);
            pdf.text('Nenhum recebimento de OS no período.', margin + 2, cursorY + 4);
            cursorY += rowH + 4;
        } else {
            ordensServicoPagas.forEach((os, idx) => {
                if (cursorY + rowH + 1 > pageH - footerH) {
                    pdf.addPage(); cursorY = margin + 6;
                    drawHeader();
                }

                if (idx % 2 === 1) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, cursorY, usableW, rowH, 'F');
                }

                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(50, 50, 50);
                let xPos = margin + 2;

                pdf.setFont('helvetica', 'bold');
                pdf.text(`#${os.numeroOS}`, xPos, cursorY + 4);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[0];

                pdf.text((os.cliente?.nome || 'Cliente').substring(0, 30), xPos, cursorY + 4);
                xPos += colWidths[1];

                pdf.text((os.formaPagamento || 'Pix').toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[2];

                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(16, 185, 129);
                pdf.text(fmtBRL(os.total), xPos, cursorY + 4);
                pdf.setTextColor(50, 50, 50);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[3];

                pdf.text(os.faturadoEm ? format(os.faturadoEm, 'dd/MM/yyyy HH:mm') : '-', xPos, cursorY + 4);

                cursorY += rowH;
            });
        }

        return cursorY + 6;
    };

    // =====================================================
    // Renderizar Sangrias e Suprimentos de Caixa
    // =====================================================
    const renderCaixasMovimentacoes = (pdf, caixasMovimentacoes, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        const rowH = 6;
        const colWidths = [45, 30, 60, 25, 34];
        const headers = ['Operador', 'Tipo', 'Descrição', 'Valor', 'Data/Hora'];

        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text(`Sangrias e Suprimentos de Caixa (${caixasMovimentacoes.length})`, margin, cursorY + 4);
        cursorY += 8;

        const drawHeader = () => {
            pdf.setFillColor(241, 245, 249);
            pdf.rect(margin, cursorY, usableW, rowH, 'F');
            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(100, 116, 139);
            let xPos = margin + 2;
            headers.forEach((h, i) => {
                pdf.text(h.toUpperCase(), xPos, cursorY + 4);
                xPos += colWidths[i];
            });
            cursorY += rowH + 1;
        };

        drawHeader();

        if (caixasMovimentacoes.length === 0) {
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(120, 120, 120);
            pdf.text('Nenhuma sangria ou suprimento no período.', margin + 2, cursorY + 4);
            cursorY += rowH + 4;
        } else {
            caixasMovimentacoes.forEach((m, idx) => {
                if (cursorY + rowH + 1 > pageH - footerH) {
                    pdf.addPage(); cursorY = margin + 6;
                    drawHeader();
                }

                if (idx % 2 === 1) {
                    pdf.setFillColor(248, 250, 252);
                    pdf.rect(margin, cursorY, usableW, rowH, 'F');
                }

                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(50, 50, 50);
                let xPos = margin + 2;

                // Operador
                pdf.setFont('helvetica', 'bold');
                pdf.text((m.usuarioNome || 'Operador').substring(0, 20), xPos, cursorY + 4);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[0];

                // Tipo badge
                const isSangria = m.tipo && m.tipo.startsWith('sangria');
                pdf.setFillColor(isSangria ? 254 : 220, isSangria ? 226 : 252, isSangria ? 226 : 231);
                pdf.roundedRect(xPos, cursorY + 1, 15, 4, 0.8, 0.8, 'F');
                pdf.setFontSize(5);
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(isSangria ? 185 : 22, isSangria ? 28 : 101, isSangria ? 28 : 52);
                pdf.text(isSangria ? 'SANGRIA' : 'SUPRIM.', xPos + 1.5, cursorY + 3.8);
                pdf.setTextColor(50, 50, 50);
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[1];

                // Descrição
                pdf.text((m.descricao || '-').substring(0, 35), xPos, cursorY + 4);
                xPos += colWidths[2];

                // Valor
                pdf.setFont('helvetica', 'bold');
                pdf.setTextColor(isSangria ? 239 : 16, isSangria ? 68 : 185, isSangria ? 68 : 129);
                pdf.text(`${isSangria ? '-' : '+'}${fmtBRL(m.valor)}`, xPos, cursorY + 4);
                pdf.setTextColor(50, 50, 50);
                pdf.setFont('helvetica', 'normal');
                xPos += colWidths[3];

                // Data/Hora
                pdf.text(m.data ? format(m.data, 'dd/MM/yyyy HH:mm') : '-', xPos, cursorY + 4);

                cursorY += rowH;
            });
        }

        return cursorY + 6;
    };

    // =====================================================
    // Renderizar tabela de Detalhamento no PDF
    // =====================================================
    const renderDetalhamento = (pdf, filteredPedidos, metrics, margin, pageW, pageH, usableW, footerH, startCursorY) => {
        let cursorY = startCursorY;
        if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
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

    /**
     * PDF PRINCIPAL (100% Programático, Vetorial e com todos os dados financeiros)
     */
    const handleExportPDF = useCallback(async (reportContentRef, filteredPedidos, metrics, viewMode, contasPagar = [], crediarioPagamentos = [], ordensServicoCriadas = [], ordensServicoPagas = [], caixasMovimentacoes = []) => {
        if (!filteredPedidos || !filteredPedidos.length) return toast.warn("Sem dados para exportar.");

        const loadingToast = toast.loading("Gerando PDF completo...");

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const usableW = pageW - margin * 2;
            const footerH = 8;

            // PÁGINA 1: Cabeçalho, Cards de Resumo e Resumo de Vendas por Forma de Pagamento
            drawPdfHeader(pdf, pageW, margin);
            let cursorY = 18;
            cursorY = renderCardsResumo(pdf, metrics, contasPagar, crediarioPagamentos, ordensServicoCriadas, ordensServicoPagas, caixasMovimentacoes, margin, pageW, pageH, usableW, footerH, cursorY);
            cursorY = renderResumoPagamento(pdf, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

            // Despesas
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderDespesas(pdf, contasPagar, margin, pageW, pageH, usableW, footerH, cursorY);

            // Amortizações Fiado
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderFiadosRecebidos(pdf, crediarioPagamentos, margin, pageW, pageH, usableW, footerH, cursorY);

            // OS Criadas
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderOSCriadas(pdf, ordensServicoCriadas, margin, pageW, pageH, usableW, footerH, cursorY);

            // OS Recebidas
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderOSPagas(pdf, ordensServicoPagas, margin, pageW, pageH, usableW, footerH, cursorY);

            // Movimentações de Caixa (Sangrias e Suprimentos)
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderCaixasMovimentacoes(pdf, caixasMovimentacoes, margin, pageW, pageH, usableW, footerH, cursorY);

            // Itens/Produtos Vendidos (Top Items)
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderItensVendidos(pdf, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

            // Detalhamento das Vendas (Pedidos)
            if (cursorY + 25 > pageH - footerH) { pdf.addPage(); cursorY = margin + 6; }
            cursorY = renderDetalhamento(pdf, filteredPedidos, metrics, margin, pageW, pageH, usableW, footerH, cursorY);

            // Rodapés em todas as páginas geradas
            drawPdfFooters(pdf, pageW, pageH, margin);

            pdf.save(`relatorio_${startDate}_${endDate}.pdf`);
            toast.dismiss(loadingToast);
            toast.success("PDF exportado com sucesso!");
        } catch (e) {
            console.error('Erro ao gerar PDF:', e);
            toast.dismiss(loadingToast);
            toast.error("Erro ao gerar PDF");
        }
    }, [startDate, endDate]);

    return {
        handleExportCSV,
        handleExportPDF
    };
}
