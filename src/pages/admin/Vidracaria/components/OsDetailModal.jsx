import React from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'react-toastify';
import { 
  IoCloseOutline, 
  IoDownloadOutline, 
  IoPrintOutline, 
  IoLogoWhatsapp, 
  IoTrashOutline 
} from 'react-icons/io5';
import ProjectSvgViewer from '../../../../components/Vidracaria/ProjectSvgViewer';

const OsDetailModal = ({ 
  selectedOS, 
  setSelectedOS, 
  handleDeleteOS, 
  handleUpdateStatus, 
  STATUS_FLOW, 
  STATUS_OS 
}) => {
  const [showSafetyReport, setShowSafetyReport] = React.useState(false);
  if (!selectedOS) return null;

  const printOS = () => {
    window.print();
  };

  const shareWhatsApp = (os) => {
    const wMetros = os.projeto.largura > 10 ? (os.projeto.largura / 1000).toFixed(2) : os.projeto.largura.toFixed(2);
    const hMetros = os.projeto.altura > 10 ? (os.projeto.altura / 1000).toFixed(2) : os.projeto.altura.toFixed(2);
    const msg = `Olá *${os.cliente.nome}*,\n\nSegue o orçamento do seu projeto na *IdeaGlass*:\n\n` +
      `📌 *Projeto:* ${os.projeto.modelo.toUpperCase()}\n` +
      `📏 *Medidas:* ${wMetros}m x ${hMetros}m (${os.projeto.area.toFixed(2)} m²)\n` +
      `💎 *Vidro:* ${os.projeto.tipoVidro} (${os.projeto.corVidro})\n` +
      `⚙️ *Alumínios/Acessórios:* ${os.projeto.kitAluminio}\n\n` +
      `💵 *Valor Total:* R$ ${os.projeto.precoVenda.toFixed(2)}\n\n` +
      `Qualquer dúvida estamos à disposição!`;

    const url = `https://api.whatsapp.com/send?phone=55${os.cliente.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const generateProfessionalPDF = async (os) => {
    const toastId = toast.info('⏳ Gerando PDF profissional da Ordem de Serviço...', { autoClose: false });
    try {
      const element = document.getElementById('printable-receipt');
      if (!element) {
        toast.update(toastId, { render: '❌ Erro: Elemento da OS não encontrado!', type: 'error', autoClose: 3000 });
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const toHide = clonedDoc.querySelectorAll('.print\\:hidden, [class*="print:hidden"]');
          toHide.forEach(el => el.style.display = 'none');
          
          const container = clonedDoc.getElementById('printable-receipt');
          if (container) {
            container.style.boxShadow = 'none';
            container.style.border = 'none';
            container.style.padding = '30px';
            container.style.width = '720px'; 
            container.style.maxWidth = '720px';
            container.style.borderRadius = '0';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = (canvas.height * contentWidth) / canvas.width;
      
      let heightLeft = contentHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      heightLeft -= (pdfHeight - (margin * 2));

      while (heightLeft > 0) {
        position = heightLeft - contentHeight + margin - 5; 
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        heightLeft -= (pdfHeight - (margin * 2));
      }

      const clientName = os.cliente?.nome ? os.cliente.nome.replace(/\s+/g, '_') : 'cliente';
      pdf.save(`OS_${os.id.substring(0, 5).toUpperCase()}_${clientName}.pdf`);
      
      toast.update(toastId, { render: '✅ PDF gerado e baixado com sucesso!', type: 'success', autoClose: 3000 });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.update(toastId, { render: '❌ Erro ao gerar PDF. Tente novamente.', type: 'error', autoClose: 3000 });
    }
  };

  const calculateSafetyForOS = (os) => {
    if (!os || !os.projeto) return null;
    const proj = os.projeto;
    const nameLower = (proj.tipoVidro || '').toLowerCase();
    const isSafety = nameLower.includes('temperado') || nameLower.includes('laminado') || nameLower.includes('aramado') || nameLower.includes('espelho');
    const is8mm = nameLower.includes('8mm');
    const areaReal = (Number(proj.largura) * Number(proj.altura)) / 1000000;

    let needsUpgrade = false;
    let upgradeReason = '';

    if (proj.tipoProjeto === 'porta' && (Number(proj.altura) >= 1900 || Number(proj.largura) >= 800)) {
      needsUpgrade = true;
      upgradeReason = 'Portas com altura ≥ 1.90m ou largura ≥ 0.80m exigem espessura mínima de 10mm para estabilidade e segurança.';
    } else if ((proj.modelo || '').toLowerCase().includes('pivotante')) {
      needsUpgrade = true;
      upgradeReason = 'Portas pivotantes exigem vidro de 10mm devido ao peso e torque nos eixos de rotação.';
    } else if (Number(proj.altura) > 2200 || Number(proj.largura) > 1200 || areaReal > 2.2) {
      needsUpgrade = true;
      upgradeReason = 'Dimensões do vão (altura > 2.20m, largura > 1.20m ou área > 2.20m²) excedem o limite seguro do vidro de 8mm.';
    }

    const checklistItems = [
      {
        text: "Vidro de Segurança (Temperado/Laminado)",
        status: isSafety ? 'success' : 'danger',
        desc: isSafety ? "Em conformidade." : "Exigido para portas, divisórias e boxes."
      },
      {
        text: "Espessura de Vidro Adequada",
        status: (needsUpgrade && is8mm) ? 'danger' : 'success',
        desc: (needsUpgrade && is8mm) ? "Exige espessura mínima de 10mm." : "Espessura compatível com as cargas mecânicas."
      },
      {
        text: "Estabilidade Estrutural",
        status: (proj.tipoProjeto === 'porta' && is8mm && (Number(proj.altura) >= 1900 || Number(proj.largura) >= 800)) ? 'danger' : 'success',
        desc: "Verificação de torção e flecha do painel."
      },
      {
        text: "Dimensões Limites do Vão",
        status: (Number(proj.altura) > 2600 || Number(proj.largura) > 2000 || areaReal > 4.5) ? 'danger' : 'success',
        desc: (Number(proj.altura) > 2600 || Number(proj.largura) > 2000 || areaReal > 4.5) 
          ? "Área crítica. Sugere-se dividir o vão." 
          : "Dimensões seguras para fabricação."
      }
    ];

    let score = 100;
    if (!isSafety) score -= 40;
    if (needsUpgrade && is8mm) score -= 30;
    if (Number(proj.altura) > 2600 || Number(proj.largura) > 2000 || areaReal > 4.5) score -= 30;
    else if (areaReal > 2.2 && is8mm) score -= 15;
    score = Math.max(10, score);

    let generalType = 'success';
    let generalMsg = '✅ Sistema em total conformidade técnica com a ABNT NBR 7199.';
    if (score < 60) {
      generalType = 'critical';
      generalMsg = `⚠️ ALERTA CRÍTICO: Projeto apresenta riscos de ruptura ou flexão excessiva.`;
    } else if (score < 90) {
      generalType = 'warning';
      generalMsg = `⚠️ ALERTA: Dimensões elevadas para a espessura selecionada. Reduza o vão ou mude para 10mm.`;
    }

    return {
      tipo: generalType,
      mensagem: generalMsg,
      score,
      checklist: checklistItems
    };
  };

  const safety = calculateSafetyForOS(selectedOS);
  const hoje = new Date();

  return (
    <div className="fixed inset-0 bg-slate-950/60 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm print:relative print:inset-auto print:bg-white print:p-0">
      <div id="printable-receipt" className="modal-animate bg-white border border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5 shadow-2xl relative text-left print:border-none print:shadow-none print:bg-white print:text-black">
        {/* Fechar */}
        <button
          onClick={() => setSelectedOS(null)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-900 border border-slate-200 p-1 rounded-lg hover:bg-slate-100 transition-all print:hidden"
        >
          <IoCloseOutline size={20} />
        </button>

        <div className="border-b border-slate-200 pb-3.5 flex justify-between items-start print:border-black print:text-black">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-slate-100 border border-slate-300 text-slate-700 font-black px-2 py-0.5 rounded-full uppercase tracking-wider print:hidden">
                OS #{selectedOS.id.substring(0, 5).toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border print:hidden ${STATUS_OS[selectedOS.status]?.color || 'bg-slate-100'}`}>
                {STATUS_OS[selectedOS.status]?.label}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-2 print:text-black flex items-center gap-1.5">
              <span className="text-slate-800">💎</span> IdeaGlass OS
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold print:text-black">Criada em: {new Date(selectedOS.criadoEm).toLocaleString('pt-BR')}</p>
          </div>
          <div className="text-right">
            <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-wider print:text-black">IdeaGlass Tempera & Acessórios</h4>
            <p className="text-[9px] text-slate-500 print:text-black">CNPJ: 12.345.678/0001-90</p>
            <p className="text-[9px] text-slate-500 print:text-black">contato@ideaglass.com.br | (11) 98765-4321</p>
          </div>
        </div>

        {/* Timeline Progresso OS */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 print:hidden">
          <div className="flex justify-between items-center relative">
            {/* Line backdrop */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            
            {/* Active line progress */}
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-emerald-600 -translate-y-1/2 z-0 transition-all duration-300"
              style={{ 
                width: `${(STATUS_FLOW.indexOf(selectedOS.status) / (STATUS_FLOW.length - 1)) * 100}%` 
              }}
            />

            {STATUS_FLOW.map((step, idx) => {
              const stepIndex = STATUS_FLOW.indexOf(selectedOS.status);
              const isCompleted = idx < stepIndex;
              const isActive = idx === stepIndex;
              const label = STATUS_OS[step]?.label || step;

              return (
                <div key={step} className="flex flex-col items-center relative z-10 flex-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedOS.id, step)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all duration-200 ${
                      isCompleted 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm shadow-emerald-600/20' 
                        : isActive 
                          ? 'bg-slate-900 border-slate-900 text-white animate-pulse' 
                          : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </button>
                  <span 
                    className={`text-[8px] font-black uppercase mt-1.5 text-center px-1 leading-none ${
                      isActive ? 'text-slate-900 font-extrabold' : isCompleted ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Cliente */}
        <div className="space-y-1 text-xs text-slate-600 print:text-black">
          <p className="font-extrabold text-slate-800 text-sm print:text-black">👤 Cliente: {selectedOS.cliente.nome}</p>
          {selectedOS.cliente.telefone && <p>📞 WhatsApp: {selectedOS.cliente.telefone}</p>}
          {selectedOS.cliente.endereco && <p>📍 Endereço: {selectedOS.cliente.endereco}</p>}
        </div>

        {/* Detalhes do Vidro/Projeto */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5 text-xs print:bg-white print:border-black print:text-black">
          <p className="font-extrabold text-slate-900 print:text-black uppercase tracking-wider text-[10px]">Especificações do Projeto</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-500 block">Modelo</span>
              <span className="font-extrabold text-slate-800 capitalize print:text-black">{selectedOS.projeto.modelo}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Área & Dimensões</span>
              <span className="font-mono font-bold text-slate-800 print:text-black block">
                {selectedOS.projeto.largura > 10 ? (selectedOS.projeto.largura / 1000).toFixed(2) : selectedOS.projeto.largura.toFixed(2)}x
                {selectedOS.projeto.altura > 10 ? (selectedOS.projeto.altura / 1000).toFixed(2) : selectedOS.projeto.altura.toFixed(2)}m
                {selectedOS.projeto.largura > 10 && ` (${selectedOS.projeto.largura}x${selectedOS.projeto.altura} mm)`}
              </span>
              {selectedOS.projeto.larguraFaturada && (
                <span className="text-[9px] text-slate-400 block font-mono">
                  Faturado Têmpera: {selectedOS.projeto.larguraFaturada.toFixed(2)}x{selectedOS.projeto.alturaFaturada.toFixed(2)}m 
                  ({selectedOS.projeto.area.toFixed(3)}m² faturados)
                </span>
              )}
              {selectedOS.projeto.larguraVidro && (
                <span className="text-[9px] text-slate-500 block font-mono">
                  Corte Vidro: {selectedOS.projeto.larguraVidro}x{selectedOS.projeto.alturaVidro} mm 
                  (Folga L: {selectedOS.projeto.folgaLargura >= 0 ? `+${selectedOS.projeto.folgaLargura}` : selectedOS.projeto.folgaLargura}mm | Desc A: -{selectedOS.projeto.descontoAltura}mm)
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Tipo do Vidro</span>
              <span className="font-bold text-slate-800 print:text-black">{selectedOS.projeto.tipoVidro}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Cor & Ferragem</span>
              <span className="font-bold text-slate-800 print:text-black">
                {selectedOS.projeto.corVidro} / {selectedOS.projeto.kitAluminio}
              </span>
            </div>
          </div>

          {selectedOS.observacoes && (
            <div className="pt-2 border-t border-slate-200">
              <span className="text-[9px] text-slate-500 block">Observações</span>
              <p className="text-slate-600 text-[11px] print:text-black italic">{selectedOS.observacoes}</p>
            </div>
          )}
        </div>

        {/* Relatório de Segurança NBR 7199 (Collapsible & Print Hidden) */}
        {safety && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden print:hidden">
            <button
              type="button"
              onClick={() => setShowSafetyReport(!showSafetyReport)}
              className="w-full flex items-center justify-between p-3.5 hover:bg-slate-100/70 transition-all text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">🛡️</span>
                <div>
                  <span className="font-extrabold text-slate-900 uppercase tracking-wider text-[10px] block">
                    Verificação de Segurança (ABNT NBR 7199)
                  </span>
                  <span className="text-[9px] text-slate-400 font-semibold">
                    {showSafetyReport ? 'Clique para recolher o relatório' : 'Clique para ver conformidade técnica e score'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                  safety.score >= 90 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : safety.score >= 60 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'
                }`}>
                  Score: {safety.score}/100
                </span>
                <span className="text-slate-400 text-[10px] font-bold">
                  {showSafetyReport ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {showSafetyReport && (
              <div className="p-3.5 border-t border-slate-200 bg-white space-y-3 text-xs transition-all duration-300">
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      safety.score >= 90 ? 'bg-emerald-500' : safety.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${safety.score}%` }}
                  />
                </div>

                <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                  {safety.mensagem}
                </p>

                {safety.checklist && safety.checklist.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {safety.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                        <span className={`text-sm leading-none ${item.status === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {item.status === 'success' ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className="font-bold text-[10px] text-slate-800">{item.text}</p>
                          <p className="text-[9px] text-slate-500">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Desenho Técnico (Blueprint) */}
        <div className="flex flex-col items-center justify-center p-3 border border-slate-200 rounded-xl bg-slate-50/50 print:bg-white print:border-black">
          <span className="text-[9px] uppercase font-black tracking-wider text-slate-500 mb-2 print:text-black">Desenho Técnico do Projeto</span>
          <div className="w-full flex flex-col sm:flex-row print:flex-row gap-4 justify-center items-center p-1 bg-white rounded-lg border border-slate-200/60 print:border-none">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black uppercase text-slate-400 mb-1">Vista Fechada</span>
              <ProjectSvgViewer
                modeloType={selectedOS.projeto.tipoProjeto || 'outros'}
                modeloNome={selectedOS.projeto.modelo}
                w={selectedOS.projeto.larguraVidro || selectedOS.projeto.largura}
                h={selectedOS.projeto.alturaVidro || selectedOS.projeto.altura}
                wVao={selectedOS.projeto.largura}
                hVao={selectedOS.projeto.altura}
                lado={selectedOS.projeto.ladoAbertura || 'esquerda'}
                sentido={selectedOS.projeto.sentidoAbertura || 'dentro'}
                puxador={selectedOS.projeto.tipoPuxador || 'puxadorH'}
                aluminio={selectedOS.projeto.corAluminio || 'natural'}
                corGlass={selectedOS.projeto.corVidro || 'Incolor'}
                isOpen={false}
                width={200}
                height={155}
              />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black uppercase text-slate-400 mb-1">Vista Aberta</span>
              <ProjectSvgViewer
                modeloType={selectedOS.projeto.tipoProjeto || 'outros'}
                modeloNome={selectedOS.projeto.modelo}
                w={selectedOS.projeto.larguraVidro || selectedOS.projeto.largura}
                h={selectedOS.projeto.alturaVidro || selectedOS.projeto.altura}
                wVao={selectedOS.projeto.largura}
                hVao={selectedOS.projeto.altura}
                lado={selectedOS.projeto.ladoAbertura || 'esquerda'}
                sentido={selectedOS.projeto.sentidoAbertura || 'dentro'}
                puxador={selectedOS.projeto.tipoPuxador || 'puxadorH'}
                aluminio={selectedOS.projeto.corAluminio || 'natural'}
                corGlass={selectedOS.projeto.corVidro || 'Incolor'}
                isOpen={true}
                width={200}
                height={155}
              />
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-extrabold mt-1.5 text-center bg-white border border-slate-200 px-3 py-1.5 rounded-lg w-full">
            📏 Vão Obra: {selectedOS.projeto.largura}x{selectedOS.projeto.altura} mm 
            {selectedOS.projeto.larguraVidro && ` | 🔍 Corte Vidro: ${selectedOS.projeto.larguraVidro}x${selectedOS.projeto.alturaVidro} mm`}
          </div>
          {(selectedOS.projeto.ladoAbertura || selectedOS.projeto.sentidoAbertura) && (
            <div className="text-[9px] text-slate-600 font-bold mt-1 text-center bg-white border border-slate-200 px-3 py-1 rounded-lg w-full uppercase">
              🚪 Lado Fixação/Abertura: <span className="text-slate-800 font-extrabold">{selectedOS.projeto.ladoAbertura || 'Esquerda'}</span> 
              {selectedOS.projeto.sentidoAbertura && ` | Sentido: ${selectedOS.projeto.sentidoAbertura === 'dentro' ? 'Para Dentro ↩' : 'Para Fora ↪'}`}
              {selectedOS.projeto.tipoPuxador && ` | Puxador: ${selectedOS.projeto.tipoPuxador}`}
              {selectedOS.projeto.perfilAluminio && ` | Perfis: ${
                Array.isArray(selectedOS.projeto.perfilAluminio)
                  ? selectedOS.projeto.perfilAluminio.join(', ')
                  : selectedOS.projeto.perfilAluminio
              }`}
            </div>
          )}
        </div>

        {/* Financeiro */}
        <div className="flex justify-between items-center bg-slate-100 border border-slate-200 p-4 rounded-xl print:border-black print:text-black">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500">Total do Projeto</span>
            <p className="text-xl font-black font-mono text-emerald-600 print:text-black">R$ {selectedOS.projeto.precoVenda.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Responsável</span>
            <span className="text-xs font-bold text-slate-800 print:text-black">👷 {selectedOS.instalacao.vidraceiro}</span>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="pt-4 border-t border-dashed border-slate-200 print:border-black space-y-4">
          <div className="text-[9px] text-slate-400 print:text-black italic leading-normal text-center">
            * Declaro estar de acordo com as especificações técnicas, dimensões do vão e condições de instalação especificadas nesta OS.
          </div>
          <div className="grid grid-cols-2 gap-8 pt-2">
            <div className="flex flex-col items-center">
              <div className="w-full border-b border-slate-300 print:border-black h-8" />
              <span className="text-[8px] font-extrabold text-slate-500 uppercase mt-1">IdeaGlass / Responsável</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-full border-b border-slate-300 print:border-black h-8" />
              <span className="text-[8px] font-extrabold text-slate-500 uppercase mt-1">Cliente / Aceite Técnico</span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2.5 pt-2 print:hidden">
          <button
            onClick={() => generateProfessionalPDF(selectedOS)}
            className="flex-1 min-w-[130px] py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-sky-600/10 hover:shadow-sky-600/20"
          >
            <IoDownloadOutline size={15} /> PDF Profissional
          </button>
          <button
            onClick={printOS}
            className="flex-1 min-w-[130px] py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300/60 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <IoPrintOutline size={15} /> Imprimir Recibo
          </button>
          <button
            onClick={() => shareWhatsApp(selectedOS)}
            className="flex-1 min-w-[130px] py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
          >
            <IoLogoWhatsapp size={15} /> Enviar WhatsApp
          </button>
          <button
            onClick={() => handleDeleteOS(selectedOS.id)}
            className="py-3 px-4 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl border border-red-200 transition-all"
          >
            <IoTrashOutline size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OsDetailModal;
