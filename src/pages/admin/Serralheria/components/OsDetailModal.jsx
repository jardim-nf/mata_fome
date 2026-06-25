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
import ProjectSvgViewer from '../../../../components/Serralheria/ProjectSvgViewer';

const OsDetailModal = ({ 
  selectedOS, 
  setSelectedOS, 
  handleDeleteOS, 
  handleUpdateStatus, 
  STATUS_FLOW, 
  STATUS_OS 
}) => {
  const [docMode, setDocMode] = React.useState('client'); // 'client' (Orçamento) ou 'technical' (Oficina)
  if (!selectedOS) return null;

  const printOS = () => {
    window.print();
  };

  const shareWhatsApp = (os) => {
    const msg = `Olá *${os.cliente.nome}*,\n\nSegue o orçamento do seu projeto na *IdeaSerralheiro*:\n\n` +
      `📌 *Projeto:* ${os.projeto.modelo.toUpperCase()}\n` +
      `📏 *Vão Obra:* ${os.projeto.largura}x${os.projeto.altura} mm\n` +
      `⛓️ *Estrutura (Perfil):* ${os.projeto.tipoVidro}\n` +
      `🎨 *Pintura / Acabamento:* ${os.projeto.corVidro}\n` +
      `🛡️ *Cobertura / Placa:* ${os.projeto.kitAluminio || 'Nenhum'}\n\n` +
      `💵 *Valor Total:* R$ ${os.projeto.precoVenda.toFixed(2)}\n\n` +
      `Qualquer dúvida estamos à disposição!`;

    const url = `https://api.whatsapp.com/send?phone=55${os.cliente.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const generateProfessionalPDF = async (os) => {
    const toastId = toast.info('⏳ Gerando PDF profissional...', { autoClose: false });
    try {
      const element = document.getElementById('printable-receipt');
      if (!element) {
        toast.update(toastId, { render: '❌ Erro: Elemento do documento não encontrado!', type: 'error', autoClose: 3000 });
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
      const filePrefix = docMode === 'client' ? 'Orcamento_Serralheria' : 'OS_Serralheria';
      pdf.save(`${filePrefix}_${os.id.substring(0, 5).toUpperCase()}_${clientName}.pdf`);
      
      toast.update(toastId, { render: '✅ PDF gerado com sucesso!', type: 'success', autoClose: 3000 });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.update(toastId, { render: '❌ Erro ao gerar PDF.', type: 'error', autoClose: 3000 });
    }
  };

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

        {/* Seletor de Modo (Orçamento vs OS / Produção) */}
        <div className="flex gap-2 p-1.5 bg-slate-100/80 border border-slate-200/50 rounded-xl print:hidden">
          <button
            type="button"
            onClick={() => setDocMode('client')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase rounded-lg transition-all ${
              docMode === 'client'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-950/20'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            📄 Orçamento (Cliente)
          </button>
          <button
            type="button"
            onClick={() => setDocMode('technical')}
            className={`flex-1 py-2 text-center text-xs font-black uppercase rounded-lg transition-all ${
              docMode === 'technical'
                ? 'bg-slate-900 text-white shadow-md shadow-slate-950/20'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚙️ Plano de Corte (Oficina)
          </button>
        </div>

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
              <span className="text-slate-800">{docMode === 'client' ? '📄' : '⚙️'}</span>{' '}
              {docMode === 'client' ? 'Orçamento de Serralheria' : 'Ordem de Serviço / Oficina'}
            </h3>
            <p className="text-[10px] text-slate-500 font-semibold print:text-black">Criada em: {new Date(selectedOS.criadoEm).toLocaleString('pt-BR')}</p>
          </div>
          <div className="text-right">
            <h4 className="text-[10px] font-black uppercase text-slate-900 tracking-wider print:text-black">IdeaSerralheiro Estruturas</h4>
            <p className="text-[9px] text-slate-500 print:text-black">CNPJ: 12.345.678/0001-90</p>
            <p className="text-[9px] text-slate-500 print:text-black">contato@ideaserralheiro.com.br | (11) 98765-4321</p>
          </div>
        </div>

        {/* Timeline Progresso OS */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 print:hidden">
          <div className="flex justify-between items-center relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            <div 
              className="absolute top-1/2 left-0 h-0.5 bg-amber-500 -translate-y-1/2 z-0 transition-all duration-300"
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
                        ? 'bg-amber-500 border-amber-500 text-white shadow-sm shadow-amber-500/20' 
                        : isActive 
                          ? 'bg-slate-950 border-slate-950 text-white animate-pulse' 
                          : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </button>
                  <span 
                    className={`text-[8px] font-black uppercase mt-1.5 text-center px-1 leading-none ${
                      isActive ? 'text-slate-950 font-extrabold' : isCompleted ? 'text-slate-600' : 'text-slate-400'
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

        {/* Detalhes do Projeto + Desenho Técnico */}
        <div className="bg-slate-50 border border-slate-200 p-4 sm:p-5 rounded-xl space-y-3.5 text-xs print:bg-white print:border-black print:text-black">
          <p className="font-extrabold text-slate-900 print:text-black uppercase tracking-wider text-[10px]">Especificações do Projeto</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-5 items-start">
            {/* Coluna 1: Campos de Detalhe */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 block">Modelo Estrutural</span>
                  <span className="font-extrabold text-slate-800 capitalize print:text-black">{selectedOS.projeto.modelo}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Vão Obra</span>
                  <span className="font-mono font-bold text-slate-800 print:text-black block">
                    {(selectedOS.projeto.largura / 1000).toFixed(2)}x{(selectedOS.projeto.altura / 1000).toFixed(2)}m
                    {` (${selectedOS.projeto.largura}x${selectedOS.projeto.altura} mm)`}
                  </span>
                  {docMode === 'technical' && selectedOS.projeto.pesoTotal && (
                    <span className="text-[9px] text-amber-600 block font-bold font-mono">
                      ⚖️ Peso Estimado: {selectedOS.projeto.pesoTotal.toFixed(1)} kg
                    </span>
                  )}
                  {docMode === 'technical' && selectedOS.projeto.barrasNecessarias && (
                    <span className="text-[9px] text-slate-500 block font-mono">
                      ⛓️ Perfis: {selectedOS.projeto.barrasNecessarias} barra(s) de 6m
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Estrutura (Perfil)</span>
                  <span className="font-bold text-slate-800 print:text-black">{selectedOS.projeto.tipoVidro}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Acabamento / Cor</span>
                  <span className="font-bold text-slate-800 print:text-black">
                    {selectedOS.projeto.corVidro}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Cobertura / Chapas</span>
                  <span className="font-bold text-slate-800 print:text-black">
                    {selectedOS.projeto.kitAluminio || 'Nenhum'}
                  </span>
                </div>
                {selectedOS.projeto.qtdeFolhas && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      {selectedOS.projeto.tipoProjeto === 'telhado' ? "Quedas d'Água (Águas)" : 'Quantidade de Folhas'}
                    </span>
                    <span className="font-bold text-slate-800 print:text-black">
                      {selectedOS.projeto.tipoProjeto === 'telhado' ? (
                        `${selectedOS.projeto.qtdeFolhas} ${selectedOS.projeto.qtdeFolhas === 1 ? 'Água' : 'Águas'}`
                      ) : (
                        `${selectedOS.projeto.qtdeFolhas} ${selectedOS.projeto.qtdeFolhas === 1 ? 'Folha' : 'Folhas'}`
                      )}
                    </span>
                  </div>
                )}
              </div>

              {selectedOS.observacoes && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[9px] text-slate-500 block">Observações</span>
                  <p className="text-slate-600 text-[11px] print:text-black italic">{selectedOS.observacoes}</p>
                </div>
              )}
            </div>

            {/* Coluna 2: Desenho Técnico */}
            <div className="flex flex-col items-center justify-center p-2.5 border border-slate-200 rounded-xl bg-white print:border-none space-y-1.5 w-full">
              <span className="text-[8px] uppercase font-black tracking-wider text-slate-400 print:text-black">Esboço Estrutural do Vão</span>
              <div className="w-full flex flex-col sm:flex-row print:flex-row gap-3.5 justify-center items-center">
                <div className="flex flex-col items-center">
                  <span className="text-[7px] font-black uppercase text-slate-400 mb-0.5">Vista Fechada / Detalhada</span>
                  <ProjectSvgViewer
                    modeloType={selectedOS.projeto.tipoProjeto || 'portao'}
                    modeloNome={selectedOS.projeto.modelo}
                    wVao={selectedOS.projeto.largura}
                    hVao={selectedOS.projeto.altura}
                    lado={selectedOS.projeto.ladoAbertura || 'esquerda'}
                    puxador={selectedOS.projeto.tipoPuxador || 'padrao'}
                    aluminio={selectedOS.projeto.corVidro} // cor da pintura
                    corGlass={selectedOS.projeto.kitAluminio} // cor da cobertura
                    qtdeFolhas={selectedOS.projeto.qtdeFolhas || 1}
                    isOpen={false}
                    width={180}
                    height={140}
                  />
                </div>
              </div>
              <div className="text-[9px] text-slate-500 font-extrabold mt-1 text-center bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg w-full">
                📏 Dimensão Vão: {selectedOS.projeto.largura}x{selectedOS.projeto.altura} mm 
              </div>
              {docMode === 'technical' && (
                <div className="text-[8px] text-slate-600 font-bold mt-0.5 text-center bg-slate-50 border border-slate-200/60 px-2 py-1 rounded-lg w-full uppercase leading-normal">
                  🔨 Junta/Solda: {selectedOS.projeto.pontosSolda || 16} pontos | Área Pintura: {selectedOS.projeto.areaPintura?.toFixed(2) || '0.00'} m²
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Análise de Custo Interno (Apenas Técnico / Oficina e Oculto na Impressão) */}
        {docMode === 'technical' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-[10px] text-slate-600 print:hidden">
            <p className="font-extrabold text-slate-900 uppercase tracking-wider text-[9px]">📊 Resumo de Margens & Custos (Interno)</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div>
                <span className="text-slate-400 block font-semibold">Custo total insumos</span>
                <span className="font-mono font-bold text-slate-800">
                  R$ {(selectedOS.projeto.custoTotal - (selectedOS.projeto.custoFrete || 0)).toFixed(2)}
                </span>
              </div>
              {selectedOS.projeto.custoFrete > 0 && (
                <div>
                  <span className="text-slate-400 block font-semibold">Custo frete</span>
                  <span className="font-mono font-bold text-slate-800">
                    R$ {selectedOS.projeto.custoFrete.toFixed(2)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-slate-400 block font-semibold">Custo total projeto</span>
                <span className="font-mono font-bold text-slate-800">
                  R$ {selectedOS.projeto.custoTotal.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Markup aplicado</span>
                <span className="font-bold text-slate-800">
                  {selectedOS.projeto.markup ? `${selectedOS.projeto.markup}%` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Lucro líquido est.</span>
                <span className="font-mono font-bold text-emerald-700">
                  R$ {(selectedOS.projeto.precoVenda - selectedOS.projeto.custoTotal).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Financeiro */}
        <div className="flex justify-between items-center bg-slate-100 border border-slate-200 p-4 rounded-xl print:border-black print:text-black">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500">Valor Total do Orçamento</span>
            <p className="text-xl font-black font-mono text-amber-600 print:text-black">R$ {selectedOS.projeto.precoVenda.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Serralheiro Responsável</span>
            <span className="text-xs font-bold text-slate-800 print:text-black">👷 {selectedOS.instalacao.vidraceiro}</span>
          </div>
        </div>

        {/* Faturamento e Garantia */}
        {selectedOS.status === 'concluido' && (
          <div className="bg-emerald-50/50 border border-emerald-250 p-4 rounded-xl space-y-3 print:border-black print:text-black text-xs">
            <p className="font-extrabold text-emerald-800 print:text-black uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <span>💳</span> Detalhamento do Pagamento (OS Concluída)
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {selectedOS.desconto > 0 && (
                <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5 col-span-2 sm:col-span-1">
                  <span className="text-slate-500">Desconto:</span>
                  <span className="font-bold text-red-500">- R$ {selectedOS.desconto.toFixed(2)}</span>
                </div>
              )}
              {selectedOS.acrescimo > 0 && (
                <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5 col-span-2 sm:col-span-1">
                  <span className="text-slate-500">Acréscimo:</span>
                  <span className="font-bold text-blue-500">+ R$ {selectedOS.acrescimo.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-dashed border-emerald-200 pb-1.5 col-span-2">
                <span className="text-slate-700 font-extrabold">Total Pago:</span>
                <span className="font-black text-emerald-700 font-mono">R$ {(selectedOS.total || selectedOS.projeto.precoVenda).toFixed(2)}</span>
              </div>
            </div>
            
            {/* Pagamentos específicos */}
            {selectedOS.pagamentos && selectedOS.pagamentos.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Formas de Pagamento:</span>
                <div className="flex flex-wrap gap-2">
                  {selectedOS.pagamentos.map((p, idx) => (
                    <span key={idx} className="bg-white border border-slate-200 text-slate-700 font-bold px-2 py-1 rounded-lg text-[10px] uppercase shadow-sm">
                      {p.forma === 'dinheiro' ? '💵 Dinheiro' : 
                       p.forma === 'cartao_debito' ? '💳 Débito' : 
                       p.forma === 'cartao_credito' ? `💳 Crédito (${p.parcelas}x)` : 
                       p.forma === 'pix' ? '💠 PIX' : '🤝 Crediário'}
                      : R$ {p.valor.toFixed(2)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Garantia */}
            {selectedOS.garantia && (
              <div className="pt-2.5 border-t border-emerald-200 border-dashed">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">🛡️ Garantia de Serviço:</span>
                <span className="font-extrabold text-slate-800 text-[10px] block mt-0.5">
                  Garantia: {selectedOS.garantia === '90_dias' ? '90 dias (CDC)' : selectedOS.garantia === '180_dias' ? '180 dias' : '365 dias'}
                </span>
                {selectedOS.observacaoGarantia && (
                  <p className="text-[9px] text-slate-500 mt-1 whitespace-pre-line italic leading-normal">{selectedOS.observacaoGarantia}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Assinaturas */}
        <div className="pt-4 border-t border-dashed border-slate-200 print:border-black space-y-4">
          <div className="text-[9px] text-slate-400 print:text-black italic leading-normal text-center">
            * Declaro estar de acordo com as especificações físicas, dimensões do vão e condições de instalação especificadas nesta OS.
          </div>
          <div className="grid grid-cols-2 gap-8 pt-2">
            <div className="flex flex-col items-center">
              <div className="w-full border-b border-slate-300 print:border-black h-8" />
              <span className="text-[8px] font-extrabold text-slate-500 uppercase mt-1">IdeaSerralheiro / Responsável</span>
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
