import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { osService } from '../../services/osService';
import { useEstablishment } from '../../hooks/useEstablishment';
import qz from 'qz-tray';
import { conectarQZ } from '../../services/printService';
import BackButton from '../../components/BackButton';
import { getStatusBadgeStyle } from './GestaoOS';
import { toast } from 'react-toastify';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  IoBuildOutline,
  IoPrintOutline,
  IoPencilOutline,
  IoTrashOutline,
  IoCheckmarkCircleOutline,
  IoWalletOutline,
  IoPersonOutline,
  IoPhonePortraitOutline,
  IoDocumentTextOutline,
  IoChevronBackOutline,
  IoCashOutline,
  IoThumbsUpOutline,
  IoThumbsDownOutline,
  IoPlayOutline,
  IoHourglassOutline
} from 'react-icons/io5';

const cleanPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 10) {
    return '55' + digits;
  }
  return digits;
};

const formatarOrcamentoZap = (os, valorServicos, valorPecas, total) => {
  const nomeCliente = os.cliente?.nome || 'Cliente';
  const numeroOS = os.numeroOS || '';
  const marca = os.equipamento?.marca || '';
  const modelo = os.equipamento?.modelo || '';
  
  let texto = `Olá, *${nomeCliente}*! 🛠️\n`;
  texto += `O orçamento para a sua *Ordem de Serviço #${numeroOS}* do dispositivo *${marca} ${modelo}* está pronto.\n\n`;
  
  if (os.servicos && os.servicos.length > 0) {
    texto += `*Serviços (Mão de Obra):*\n`;
    os.servicos.forEach(s => {
      texto += `- ${s.descricao}: R$ ${parseFloat(s.valor || 0).toFixed(2)}\n`;
    });
    texto += `\n`;
  }
  
  if (os.pecas && os.pecas.length > 0) {
    texto += `*Peças/Componentes:*\n`;
    os.pecas.forEach(p => {
      texto += `- ${p.nome}: R$ ${parseFloat(p.valor || 0).toFixed(2)}\n`;
    });
    texto += `\n`;
  }
  
  if (Number(os.desconto) > 0) {
    texto += `*Desconto:* - R$ ${parseFloat(os.desconto).toFixed(2)}\n`;
  }
  
  texto += `*VALOR TOTAL:* R$ ${total.toFixed(2)}\n\n`;
  texto += `Por favor, responda se aprova a execução do serviço. Obrigado!`;
  
  return encodeURIComponent(texto);
};

const gerarLayoutOS = (os, valorServicos, valorPecas, total) => {
  const ESC = '\x1B';
  const GS = '\x1D';
  const INIT = ESC + '@';
  const BOLD_ON = ESC + 'E' + '\x01';
  const BOLD_OFF = ESC + 'E' + '\x00';
  const CENTER = ESC + 'a' + '\x01';
  const LEFT = ESC + 'a' + '\x00';
  const TEXT_DOUBLE = GS + '!' + '\x11';
  const TEXT_NORMAL = GS + '!' + '\x00';
  const CUT = GS + 'V' + '\x41' + '\x03';
  const BEEP = ESC + 'B' + '\x03' + '\x02';
  
  const removerAcentos = (texto) => {
    if (!texto) return '';
    return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  const formatarDataLocal = (timestamp) => {
    if (!timestamp) return '---';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleString('pt-BR');
  };

  let data = [];
  data.push(INIT);

  // Cabeçalho
  data.push(CENTER);
  data.push(TEXT_DOUBLE + BOLD_ON);
  data.push(`ASSISTENCIA TECNICA\n`);
  data.push(`OS #${os.numeroOS}\n`);
  data.push(TEXT_NORMAL + BOLD_OFF);
  data.push(`Abertura: ${formatarDataLocal(os.createdAt)}\n`);
  if (os.dataPrevisaoEntrega) {
    const prevDate = os.dataPrevisaoEntrega.toDate ? os.dataPrevisaoEntrega.toDate() : new Date(os.dataPrevisaoEntrega);
    data.push(`Previsao: ${prevDate.toLocaleDateString('pt-BR')}\n`);
  }
  data.push("--------------------------------\n");

  // Cliente
  data.push(LEFT);
  data.push(BOLD_ON + `CLIENTE: ${removerAcentos(os.cliente?.nome)}\n` + BOLD_OFF);
  data.push(`Telefone: ${os.cliente?.telefone || '---'}\n`);
  if (os.cliente?.cpf) data.push(`CPF: ${os.cliente.cpf}\n`);
  data.push("--------------------------------\n");

  // Aparelho
  data.push(BOLD_ON + `APARELHO: ${removerAcentos(os.equipamento?.marca)} ${removerAcentos(os.equipamento?.modelo)}\n` + BOLD_OFF);
  if (os.equipamento?.nSerieOrImei) data.push(`IMEI/Serie: ${os.equipamento.nSerieOrImei}\n`);
  data.push(`Estado Fisico: ${removerAcentos(os.equipamento?.estadoFisico || 'Nenhum')}\n`);
  data.push(`Defeito Relatado: ${removerAcentos(os.defeitoRelatado || '---')}\n`);
  data.push("--------------------------------\n");

  // Serviços e Peças
  if ((os.servicos && os.servicos.length > 0) || (os.pecas && os.pecas.length > 0)) {
    data.push(CENTER + BOLD_ON + "SERVICOS E PECAS\n" + BOLD_OFF + LEFT);
    
    if (os.servicos && os.servicos.length > 0) {
      data.push(BOLD_ON + `Servicos:\n` + BOLD_OFF);
      os.servicos.forEach(s => {
        data.push(`- ${removerAcentos(s.descricao)}: R$ ${parseFloat(s.valor || 0).toFixed(2)}\n`);
      });
    }
    
    if (os.pecas && os.pecas.length > 0) {
      data.push(BOLD_ON + `Pecas:\n` + BOLD_OFF);
      os.pecas.forEach(p => {
        data.push(`- ${removerAcentos(p.nome)}: R$ ${parseFloat(p.valor || 0).toFixed(2)}\n`);
      });
    }
    data.push("--------------------------------\n");
  }

  // Totais
  data.push(LEFT);
  data.push(`Subtotal Servicos: R$ ${valorServicos.toFixed(2)}\n`);
  data.push(`Subtotal Pecas: R$ ${valorPecas.toFixed(2)}\n`);
  if (Number(os.desconto) > 0) {
    data.push(`Desconto: - R$ ${parseFloat(os.desconto).toFixed(2)}\n`);
  }
  data.push(BOLD_ON + TEXT_DOUBLE + `TOTAL: R$ ${total.toFixed(2)}\n` + TEXT_NORMAL + BOLD_OFF);
  data.push(`Situacao: ${os.situacaoFinanceira === 'pago' ? 'PAGO' : 'PENDENTE'}\n`);
  data.push("--------------------------------\n");

  // Garantia
  data.push(LEFT);
  data.push(BOLD_ON + `TERMOS DE GARANTIA:\n` + BOLD_OFF);
  data.push(`A garantia para este conserto e de ${os.garantiaDias} dias, cobrindo defeitos de fabricacao dos componentes substituidos.\n`);
  data.push("--------------------------------\n");

  // Assinatura
  data.push("\n\n");
  data.push(CENTER + "_______________________________\n");
  data.push("Assinatura do Cliente\n");
  
  data.push("\n\n\n\n");
  data.push(CUT);
  data.push(BEEP);

  return data;
};

export default function OSDetalhes() {
  const { osId } = useParams();
  const { estabelecimentoIdPrincipal } = useAuth();
  const navigate = useNavigate();

  const { estabelecimentoInfo } = useEstablishment(estabelecimentoIdPrincipal);

  const [loading, setLoading] = useState(true);
  const [os, setOs] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const carregarOS = async () => {
    if (!estabelecimentoIdPrincipal || !osId) return;
    setLoading(true);
    try {
      const data = await osService.obterOrdemServicoPorId(estabelecimentoIdPrincipal, osId);
      if (data) {
        setOs(data);
      } else {
        toast.error("Ordem de serviço não encontrada.");
        navigate('/admin/os');
      }
    } catch (err) {
      toast.error("Erro ao carregar dados da OS.");
      navigate('/admin/os');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarOS();
  }, [estabelecimentoIdPrincipal, osId]);

  // Alteração de Status
  const handleAlterarStatus = async (novoStatus) => {
    setUpdatingStatus(true);
    try {
      const updateData = { status: novoStatus };
      
      // Se entregue, marcar financeiro como pago por padrão (se o usuário desejar)
      if (novoStatus === 'entregue') {
        updateData.dataEntregaEfetiva = new Date();
      }
      
      await osService.atualizarOrdemServico(estabelecimentoIdPrincipal, osId, updateData);
      toast.success(`Status alterado para: ${getStatusBadgeStyle(novoStatus).label}`);
      carregarOS();
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Alteração Financeira (Baixa de Pagamento)
  const handleRegistrarPagamento = async () => {
    setUpdatingStatus(true);
    try {
      await osService.atualizarOrdemServico(estabelecimentoIdPrincipal, osId, { 
        situacaoFinanceira: 'pago' 
      });
      toast.success("Pagamento registrado com sucesso!");
      carregarOS();
    } catch (err) {
      toast.error("Erro ao registrar pagamento.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Excluir OS
  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  // Totais
  const valorServicos = useMemo(() => os?.servicos?.reduce((acc, s) => acc + Number(s.valor || 0), 0) || 0, [os]);
  const valorPecas = useMemo(() => os?.pecas?.reduce((acc, p) => acc + Number(p.valor || 0), 0) || 0, [os]);
  const total = useMemo(() => os?.total || 0, [os]);

  // Formatar data
  const formatarData = (timestamp) => {
    if (!timestamp) return '---';
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleString('pt-BR');
  };

  // Imprimir OS (Thermal layout via QZ Tray)
  const handlePrint = async () => {
    const printerName = estabelecimentoInfo?.impressoraBalcao;
    if (printerName) {
      try {
        toast.info("Enviando impressão para o QZ Tray...");
        await conectarQZ();
        const config = qz.configs.create(printerName);
        const layoutOS = gerarLayoutOS(os, valorServicos, valorPecas, total);
        await qz.print(config, layoutOS);
        toast.success("Impresso com sucesso via QZ Tray!");
      } catch (err) {
        console.error("Erro ao imprimir via QZ Tray, usando navegador...", err);
        toast.warn("QZ Tray inativo ou impressora offline. Abrindo diálogo do navegador...");
        window.print();
      }
    } else {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] font-sans">
        <div className="animate-spin w-12 h-12 border-4 border-slate-200 border-t-slate-800 rounded-full mb-3"></div>
        <p className="text-xs font-black text-slate-400">Carregando detalhes do atendimento...</p>
      </div>
    );
  }

  if (!os) return null;

  const statusInfo = getStatusBadgeStyle(os.status);

  return (
    <div className="space-y-6 font-sans relative">
      
      {/* CSS @media print de alta fidelidade para cupom térmico de 80mm/58mm */}
      <style>{`
        @media print {
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 72mm !important;
            max-width: 72mm !important;
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            line-height: 1.3;
            color: #000 !important;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
          @page {
            margin: 0;
            size: auto;
          }
        }
      `}</style>

      {/* --- DASHBOARD VIEW (SCREEN ONLY) --- */}
      <div className="no-print space-y-6">
        
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/os')}
              className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-all"
            >
              <IoChevronBackOutline size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-800">Ordem de Serviço #{os.numeroOS}</h1>
                <span className={`px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 ${statusInfo.bg}`}>
                  <span>{statusInfo.icon}</span>
                  <span>{statusInfo.label}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold">Abertura: {formatarData(os.createdAt)} • Atualizada: {formatarData(os.updatedAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePrint}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5 transition-all"
            >
              <IoPrintOutline size={16} /> IMPRIMIR OS
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50 font-extrabold text-xs px-4 py-3 rounded-2xl flex items-center gap-1.5 transition-all"
            >
              <IoTrashOutline size={16} /> EXCLUIR
            </button>
          </div>
        </div>

        {/* WORKFLOW QUICK ACTION BUTTONS */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-[2.2rem] p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-black text-slate-450 uppercase tracking-widest">Ações Técnicas e Financeiras Rápidas</h3>
          <div className="flex flex-wrap gap-2">
            {os.status === 'em_analise' && (
              <button
                disabled={updatingStatus}
                onClick={async () => {
                  await handleAlterarStatus('aguardando_orcamento');
                  const zapUrl = `https://wa.me/${cleanPhone(os.cliente?.telefone)}?text=${formatarOrcamentoZap(os, valorServicos, valorPecas, total)}`;
                  window.open(zapUrl, '_blank');
                }}
                className="bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <IoHourglassOutline size={16} /> Enviar Orçamento p/ Cliente
              </button>
            )}
            {['em_analise', 'aguardando_orcamento'].includes(os.status) && (
              <button
                type="button"
                onClick={() => {
                  const zapUrl = `https://wa.me/${cleanPhone(os.cliente?.telefone)}?text=${formatarOrcamentoZap(os, valorServicos, valorPecas, total)}`;
                  window.open(zapUrl, '_blank');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                💬 Enviar por WhatsApp
              </button>
            )}
            {['em_analise', 'aguardando_orcamento'].includes(os.status) && (
              <>
                <button
                  disabled={updatingStatus}
                  onClick={() => handleAlterarStatus('orcamento_aprovado')}
                  className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <IoThumbsUpOutline size={16} /> Orçamento Aprovado
                </button>
                <button
                  disabled={updatingStatus}
                  onClick={() => handleAlterarStatus('orcamento_rejeitado')}
                  className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                >
                  <IoThumbsDownOutline size={16} /> Rejeitar Orçamento
                </button>
              </>
            )}
            {['orcamento_aprovado', 'em_analise'].includes(os.status) && (
              <button
                disabled={updatingStatus}
                onClick={() => handleAlterarStatus('em_manutencao')}
                className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <IoPlayOutline size={16} /> Iniciar Reparo
              </button>
            )}
            {os.status === 'em_manutencao' && (
              <button
                disabled={updatingStatus}
                onClick={() => handleAlterarStatus('pronto')}
                className="bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
              >
                <IoCheckmarkCircleOutline size={16} /> Reparo Concluído (Pronto)
              </button>
            )}
            {os.status === 'pronto' && (
              <button
                disabled={updatingStatus}
                onClick={() => handleAlterarStatus('entregue')}
                className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm"
              >
                📦 Entregar Aparelho ao Cliente
              </button>
            )}
            
            {/* Ação Financeira */}
            {os.situacaoFinanceira === 'pendente' && (
              <button
                disabled={updatingStatus}
                onClick={handleRegistrarPagamento}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-sm ml-auto"
              >
                <IoCashOutline size={16} /> Dar Baixa (Pago)
              </button>
            )}
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COL 1 & 2: TECHNICAL & DESCRIPTION */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Aparelho & Ficha técnica */}
            <div className="bg-white border border-slate-200/60 rounded-[2.2rem] p-6 shadow-sm space-y-5">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <IoPhonePortraitOutline size={18} className="text-indigo-500" />
                <span>Informações do Dispositivo</span>
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Aparelho</p>
                  <p className="text-slate-800 text-sm mt-1">{os.equipamento?.tipo || 'Não especificado'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Marca</p>
                  <p className="text-slate-800 text-sm mt-1">{os.equipamento?.marca}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Modelo</p>
                  <p className="text-slate-800 text-sm mt-1">{os.equipamento?.modelo}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">IMEI / Nº Série</p>
                  <p className="text-slate-900 font-mono text-sm mt-1">{os.equipamento?.nSerieOrImei || '---'}</p>
                </div>
              </div>
              
              <div className="text-xs font-bold">
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Estado Físico na Entrega</p>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-2xl mt-1.5 border border-slate-100 leading-relaxed font-semibold">
                  {os.equipamento?.estadoFisico || 'Sem observações visuais catalogadas.'}
                </p>
              </div>
            </div>

            {/* Diagnóstico técnico */}
            <div className="bg-white border border-slate-200/60 rounded-[2.2rem] p-6 shadow-sm space-y-5">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <IoBuildOutline size={18} className="text-blue-500" />
                <span>Laudo Técnico & Manutenção</span>
              </h3>
              
              <div className="space-y-4 text-xs font-bold">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Defeito Relatado pelo Cliente</p>
                  <p className="text-slate-700 mt-1.5 bg-slate-50 p-4 border border-slate-100 rounded-2xl leading-relaxed">
                    {os.defeitoRelatado || '---'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Defeito Detectado em Testes</p>
                  <p className="text-slate-700 mt-1.5 bg-slate-50 p-4 border border-slate-100 rounded-2xl leading-relaxed">
                    {os.defeitoDetectado || '---'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Diagnóstico / Procedimento Solicitado</p>
                  <p className="text-slate-800 font-extrabold mt-1.5 bg-amber-50/30 p-4 border border-amber-100/50 rounded-2xl leading-relaxed">
                    {os.diagnosticoTecnico || '---'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mão de Obra e Peças aplicadas */}
            <div className="bg-white border border-slate-200/60 rounded-[2.2rem] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                Especificação de Peças e Serviços
              </h3>
              
              {/* Serviços list */}
              {os.servicos && os.servicos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Serviços executados</p>
                  <div className="divide-y divide-slate-150 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                    {os.servicos.map((s, idx) => (
                      <div key={idx} className="flex justify-between p-3.5 bg-slate-50/50 font-bold">
                        <span className="text-slate-700">{s.descricao}</span>
                        <span className="text-slate-900 font-black">R$ {parseFloat(s.valor).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Peças list */}
              {os.pecas && os.pecas.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Peças / Componentes aplicados</p>
                  <div className="divide-y divide-slate-150 border border-slate-100 rounded-2xl overflow-hidden text-xs">
                    {os.pecas.map((p, idx) => (
                      <div key={idx} className="flex justify-between p-3.5 bg-slate-50/50 font-bold">
                        <span className="text-slate-700">{p.nome}</span>
                        <span className="text-slate-900 font-black">R$ {parseFloat(p.valor).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* COL 3: CLIENTE & FECHAMENTO */}
          <div className="space-y-6">
            
            {/* Informações do Cliente */}
            <div className="bg-white border border-slate-200/60 rounded-[2.2rem] p-6 shadow-sm space-y-5">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
                <IoPersonOutline size={18} className="text-slate-500" />
                <span>Dados do Cliente</span>
              </h3>
              
              <div className="text-xs font-bold space-y-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Nome do Titular</p>
                  <p className="text-slate-800 text-sm mt-1">{os.cliente?.nome}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">WhatsApp / Telefone</p>
                  <a href={`https://wa.me/${cleanPhone(os.cliente?.telefone)}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-700 text-sm mt-1 block font-extrabold hover:underline">
                    {os.cliente?.telefone} (Enviar Mensagem 📲)
                  </a>
                </div>
                {os.cliente?.cpf && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">CPF</p>
                    <p className="text-slate-800 mt-1">{os.cliente?.cpf}</p>
                  </div>
                )}
                {os.cliente?.email && (
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">E-mail</p>
                    <p className="text-slate-800 mt-1">{os.cliente?.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Técnico & Garantia */}
            <div className="bg-white border border-slate-200/60 rounded-[2.2rem] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-100 pb-2">
                Técnico & prazos
              </h3>
              
              <div className="text-xs font-bold space-y-3">
                <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-450 text-[10px] uppercase">Responsável</span>
                  <span className="text-slate-800 font-extrabold">{os.tecnicoResponsavel?.nome || 'Não definido'}</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-450 text-[10px] uppercase">Garantia</span>
                  <span className="text-slate-800 font-extrabold">{os.garantiaDias} dias técnicos</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <span className="text-slate-450 text-[10px] uppercase">Previsão Entrega</span>
                  <span className="text-slate-800 font-extrabold">{os.dataPrevisaoEntrega ? new Date(os.dataPrevisaoEntrega.toDate ? os.dataPrevisaoEntrega.toDate() : os.dataPrevisaoEntrega).toLocaleDateString('pt-BR') : 'Sem previsão'}</span>
                </div>
              </div>
            </div>

            {/* Fechamento Financeiro */}
            <div className="bg-slate-900 border border-slate-950 rounded-[2.2rem] p-6 shadow-lg text-white space-y-5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
                Resumo Financeiro
              </h3>
              
              <div className="text-xs font-bold space-y-2 border-b border-slate-800 pb-4">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total em Serviços</span>
                  <span>R$ {valorServicos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total em Peças</span>
                  <span>R$ {valorPecas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Desconto Aplicado</span>
                  <span>- R$ {Number(os.desconto || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Líquido</p>
                  <p className="text-3xl font-black text-white mt-1">R$ {total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Situação</p>
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block mt-2 ${
                    os.situacaoFinanceira === 'pago' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {os.situacaoFinanceira === 'pago' ? 'PAGO' : 'PENDENTE'}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* --- PRINT THERMAL LAYOUT (ONLY DETECTED ON window.print() PRINT MEDIA) --- */}
      <div id="printable-receipt" className="hidden print:block text-black bg-white" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', width: '72mm', color: '#000' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>Ficha Assistência Técnica</div>
          <div style={{ fontSize: '16px', fontWeight: 'black', margin: '4px 0' }}>OS #{os.numeroOS}</div>
          <div style={{ fontSize: '11px' }}>Abertura: {formatarData(os.createdAt)}</div>
          <div style={{ fontSize: '11px' }}>Previsão: {os.dataPrevisaoEntrega ? new Date(os.dataPrevisaoEntrega.toDate ? os.dataPrevisaoEntrega.toDate() : os.dataPrevisaoEntrega).toLocaleDateString('pt-BR') : '---'}</div>
        </div>

        {/* Client */}
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '11px' }}>
          <b>CLIENTE:</b> {os.cliente?.nome}<br />
          <b>TEL:</b> {os.cliente?.telefone}<br />
          {os.cliente?.cpf && <><b>CPF:</b> {os.cliente.cpf}<br /></>}
        </div>

        {/* Device */}
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '11px' }}>
          <b>EQUIPAMENTO:</b> {os.equipamento?.marca} {os.equipamento?.modelo}<br />
          {os.equipamento?.nSerieOrImei && <><b>IMEI/SÉRIE:</b> {os.equipamento.nSerieOrImei}<br /></>}
          <b>ESTADO FÍSICO:</b> {os.equipamento?.estadoFisico || 'Nenhum defeito físico relatado.'}<br />
          <b>DEFEITO RELATADO:</b> {os.defeitoRelatado || '---'}<br />
        </div>

        {/* Price list */}
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '11px' }}>
          <div style={{ fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Especificação Técnica e Comercial</div>
          
          {os.servicos && os.servicos.length > 0 && (
            <div style={{ paddingBottom: '4px' }}>
              <b>SERVIÇOS:</b><br />
              {os.servicos.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>- {s.descricao}</span>
                  <span>R$ {parseFloat(s.valor).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          
          {os.pecas && os.pecas.length > 0 && (
            <div style={{ paddingBottom: '4px' }}>
              <b>PEÇAS:</b><br />
              {os.pecas.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>- {p.nome}</span>
                  <span>R$ {parseFloat(p.valor).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Financial Sum */}
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '12px' }}>
          <div style={{ display: 'flex', justify: 'space-between' }}>
            <span>Mão de Obra:</span>
            <span>R$ {valorServicos.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justify: 'space-between' }}>
            <span>Componentes:</span>
            <span>R$ {valorPecas.toFixed(2)}</span>
          </div>
          {Number(os.desconto) > 0 && (
            <div style={{ display: 'flex', justify: 'space-between', color: '#000' }}>
              <span>Desconto:</span>
              <span>- R$ {parseFloat(os.desconto).toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justify: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '4px' }}>
            <span>VALOR TOTAL:</span>
            <span>R$ {total.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>
            STATUS OS: {statusInfo.label.toUpperCase()}<br />
            STATUS FINANCEIRO: {os.situacaoFinanceira === 'pago' ? 'PAGO' : 'AGUARDANDO PAGAMENTO'}
          </div>
        </div>

        {/* Warranty Term */}
        <div style={{ fontSize: '9px', textAlign: 'justify', lineHeight: '1.2', marginBottom: '20px' }}>
          <b>TERMOS DE GARANTIA:</b> A garantia para este conserto é de <b>{os.garantiaDias} dias</b> a contar da data de entrega, cobrindo exclusivamente defeitos de fabricação dos componentes substituídos. A garantia não cobre danos decorrentes de quedas, contato com líquidos ou manuseio inadequado por terceiros.
        </div>

        {/* Signature */}
        <div style={{ textAlign: 'center', marginTop: '30px' }}>
          <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto', paddingTop: '4px', fontSize: '10px' }}>
            Assinatura do Cliente
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '20px' }}>
          IdeaFood Assistência Técnica<br />
          Obrigado pela preferência!
        </div>

      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          open={true}
          title="Excluir Ordem de Serviço"
          message="Deseja realmente excluir esta ordem de serviço? Esta ação não pode ser desfeita."
          variant="danger"
          confirmText="Excluir"
          cancelText="Cancelar"
          onConfirm={async () => {
            setShowDeleteConfirm(false);
            try {
              await osService.excluirOrdemServico(estabelecimentoIdPrincipal, osId);
              toast.success("Ordem de serviço excluída!");
              navigate('/admin/os');
            } catch (err) {
              toast.error("Erro ao excluir OS.");
            }
          }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
