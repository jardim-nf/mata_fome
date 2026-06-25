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
import { collection, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import ModalFinalizacaoOS from './Serralheria/components/ModalFinalizacaoOS';
import { caixaService } from '../../services/caixaService';
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
import { FiSun, FiMoon } from 'react-icons/fi';

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
  const isVeiculo = ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(os.equipamento?.tipo);
  const identificadorUnico = isVeiculo 
    ? (os.equipamento?.placa ? ` (Placa: ${os.equipamento.placa.toUpperCase()})` : '')
    : (os.equipamento?.nSerieOrImei ? ` (Série/IMEI: ${os.equipamento.nSerieOrImei})` : '');
  
  let texto = `Olá, *${nomeCliente}*! 🛠️\n`;
  texto += `O orçamento para a sua *Ordem de Serviço #${numeroOS}* do ${isVeiculo ? 'veículo' : 'dispositivo'} *${marca} ${modelo}*${identificadorUnico} está pronto.\n\n`;
  
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

const gerarLayoutOS = (os, valorServicos, valorPecas, total, configOS) => {
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
  if (configOS?.empresaNome) {
    data.push(`${removerAcentos(configOS.empresaNome).toUpperCase()}\n`);
  } else {
    data.push(`ASSISTENCIA TECNICA\n`);
  }
  data.push(`OS #${os.numeroOS}\n`);
  data.push(TEXT_NORMAL + BOLD_OFF);

  if (configOS?.empresaCNPJ) {
    data.push(`CNPJ: ${configOS.empresaCNPJ}\n`);
  }
  if (configOS?.empresaEndereco) {
    data.push(`END: ${removerAcentos(configOS.empresaEndereco)}\n`);
  }
  if (configOS?.empresaTelefone) {
    data.push(`TEL: ${configOS.empresaTelefone}\n`);
  }

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

  // Aparelho / Veículo
  const isVeiculo = ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(os.equipamento?.tipo);
  if (isVeiculo) {
    data.push(BOLD_ON + `VEICULO: ${removerAcentos(os.equipamento?.marca)} ${removerAcentos(os.equipamento?.modelo)}\n` + BOLD_OFF);
    if (os.equipamento?.placa) data.push(`Placa: ${removerAcentos(os.equipamento.placa.toUpperCase())}\n`);
    if (os.equipamento?.nSerieOrImei) data.push(`Chassi: ${removerAcentos(os.equipamento.nSerieOrImei)}\n`);
    if (os.equipamento?.quilometragem) data.push(`KM: ${Number(os.equipamento.quilometragem).toLocaleString('pt-BR')} KM\n`);
    if (os.equipamento?.nivelCombustivel) {
      const fuel = os.equipamento.nivelCombustivel === 'reserva' ? 'Reserva' :
                   os.equipamento.nivelCombustivel === '1_4' ? '1/4' :
                   os.equipamento.nivelCombustivel === '1_2' ? '1/2' :
                   os.equipamento.nivelCombustivel === '3_4' ? '3/4' : 'Cheio';
      data.push(`Combustivel: ${fuel}\n`);
    }
  } else {
    data.push(BOLD_ON + `APARELHO: ${removerAcentos(os.equipamento?.marca)} ${removerAcentos(os.equipamento?.modelo)}\n` + BOLD_OFF);
    if (os.equipamento?.nSerieOrImei) data.push(`IMEI/Serie: ${os.equipamento.nSerieOrImei}\n`);
    if (os.equipamento?.senhaDesbloqueio) data.push(`Senha: ${removerAcentos(os.equipamento.senhaDesbloqueio)}\n`);
    if (os.equipamento?.desenhoDesbloqueio) data.push(`Padrao: ${os.equipamento.desenhoDesbloqueio}\n`);
    if (os.equipamento?.acessoriosDeixados && os.equipamento.acessoriosDeixados.length > 0) {
      const accList = os.equipamento.acessoriosDeixados.map(acc => {
        const labels = { carregador: 'Carregador', cabo: 'Cabo', capinha: 'Capinha', chip: 'Chip SIM', memoria: 'Cartao Memoria', fone: 'Fone' };
        return labels[acc] || acc;
      }).join(', ');
      data.push(`Acessorios: ${removerAcentos(accList)}\n`);
    }
  }
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
  if (configOS?.termosGarantiaPadrao) {
    data.push(`${removerAcentos(configOS.termosGarantiaPadrao)}\n`);
  } else {
    data.push(`A garantia para este conserto e de ${os.garantiaDias} dias, cobrindo defeitos de fabricacao dos componentes substituidos.\n`);
  }
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

const SignaturePad = ({ onSave, onCancel, isDark = true }) => {
  const canvasRef = React.useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.warn("Por favor, assine antes de salvar!");
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className={`p-4 rounded-3xl border space-y-4 transition-colors duration-300 ${isDark ? 'bg-zinc-950/60 border-white/5' : 'bg-slate-50 border-slate-200 shadow-inner'}`}>
      <p className={`text-xs font-black uppercase tracking-wider text-center ${isDark ? 'text-zinc-300' : 'text-slate-655'}`}>✍️ Assinatura do Cliente</p>
      <div className={`bg-white rounded-2xl border overflow-hidden shadow-inner touch-none ${isDark ? 'border-zinc-700' : 'border-slate-300'}`}>
        <canvas
          ref={canvasRef}
          width={400}
          height={180}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full bg-white cursor-crosshair"
        />
      </div>
      <div className="flex gap-2 justify-center">
        <button type="button" onClick={clear} className={`px-4 py-2 border rounded-xl text-[10px] font-black transition-all ${
          isDark
            ? 'border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white'
            : 'border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800'
        }`}>Limpar</button>
        <button type="button" onClick={handleSave} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black shadow-md transition-all">Salvar</button>
        {onCancel && <button type="button" onClick={onCancel} className={`px-4 py-2 text-[10px] font-black transition-all ${
          isDark ? 'text-zinc-500 hover:text-zinc-300' : 'text-slate-400 hover:text-slate-600'
        }`}>Cancelar</button>}
      </div>
    </div>
  );
};

const DesenhoDesbloqueioViewer = ({ value, isDark = true, forPrint = false }) => {
  if (!value) return null;
  const points = value.split('-').map(Number);
  const coords = [
    { x: 15, y: 15 },  { x: 50, y: 15 },  { x: 85, y: 15 },
    { x: 15, y: 50 },  { x: 50, y: 50 },  { x: 85, y: 50 },
    { x: 15, y: 85 },  { x: 50, y: 85 },  { x: 85, y: 85 }
  ];

  if (forPrint) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '1px solid #000', padding: '6px', borderRadius: '12px', width: '90px', margin: '4px 0', backgroundColor: '#fff' }}>
        <p style={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', color: '#000' }}>Padrão</p>
        <div style={{ position: 'relative', width: '80px', height: '80px', border: '1px solid #000', borderRadius: '8px', padding: '2px', backgroundColor: '#fff' }}>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 100 100">
            {points.map((pt, i) => {
              if (i === 0) return null;
              const prev = coords[points[i - 1]];
              const curr = coords[pt];
              return (
                <line
                  key={i}
                  x1={prev.x}
                  y1={prev.y}
                  x2={curr.x}
                  y2={curr.y}
                  stroke="#000"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', height: '100%', width: '100%' }}>
            {coords.map((c, idx) => {
              const isSelected = points.includes(idx);
              const order = points.indexOf(idx);
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: isSelected ? '1px solid #000' : '1px solid #ccc',
                    backgroundColor: '#fff'
                  }}>
                    <div style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#000' : '#888'
                    }} />
                  </div>
                  {isSelected && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-4px',
                      backgroundColor: '#000',
                      color: '#fff',
                      fontSize: '7px',
                      fontWeight: 'bold',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #fff'
                    }}>
                      {order + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center border p-2.5 rounded-2xl w-28 shrink-0 no-print transition-colors duration-300 ${
      isDark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-50 border-slate-200'
    }`}>
      <p className={`text-[8px] font-black uppercase tracking-wider mb-1 ${isDark ? 'text-zinc-400' : 'text-slate-400'}`}>Padrão</p>
      <div className={`relative w-20 h-20 rounded-xl border p-1 transition-colors duration-300 ${
        isDark ? 'bg-zinc-950 border-white/10' : 'bg-white border-slate-200'
      }`}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          {points.map((pt, i) => {
            if (i === 0) return null;
            const prev = coords[points[i - 1]];
            const curr = coords[pt];
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={curr.x}
                y2={curr.y}
                stroke="#6366f1"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="grid grid-cols-3 gap-1.5 h-full w-full">
          {coords.map((c, idx) => {
            const isSelected = points.includes(idx);
            const order = points.indexOf(idx);
            return (
              <div key={idx} className="relative flex items-center justify-center">
                <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                  isSelected ? 'bg-indigo-500/10 border border-indigo-500' : (isDark ? 'bg-zinc-900 border border-white/5' : 'bg-slate-100 border border-slate-200')
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-indigo-400' : (isDark ? 'bg-zinc-700' : 'bg-slate-300')}`} />
                </div>
                {isSelected && (
                  <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[6px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {order + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
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
  const [mostrarFinalizacao, setMostrarFinalizacao] = useState(false);
  const [salvandoFaturamento, setSalvandoFaturamento] = useState(false);
  const [statusParaAtualizarAposPago, setStatusParaAtualizarAposPago] = useState(null);
  const [configOS, setConfigOS] = useState(null);

  // Tema
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'dashboard_theme') {
        setTheme(e.newValue || 'dark');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const isDark = theme === 'dark';

  const styles = {
    bg: isDark
      ? 'bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-slate-300'
      : 'bg-gradient-to-br from-slate-50 via-slate-100 to-zinc-100 text-slate-700',
    title: isDark ? 'text-white' : 'text-slate-800',
    subtitle: isDark ? 'text-zinc-400' : 'text-slate-500',
    border: isDark ? 'border-white/5' : 'border-slate-200',
    headerBorder: isDark ? 'border-white/5' : 'border-slate-200',
    card: isDark
      ? 'bg-zinc-900/40 backdrop-blur-xl border border-white/5 shadow-2xl'
      : 'bg-white border border-slate-200 shadow-md',
    cardTitle: isDark ? 'text-white border-b border-white/5' : 'text-slate-800 border-b border-slate-200',
    textMuted: isDark ? 'text-zinc-400' : 'text-slate-500',
    textTitle: isDark ? 'text-white' : 'text-slate-800',
    textHighlight: isDark ? 'text-indigo-400' : 'text-indigo-600',
    badgeText: isDark ? 'bg-zinc-950/60 text-zinc-300 border-white/5' : 'bg-slate-100 text-slate-700 border border-slate-200',
    nestedContainer: isDark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-50 border border-slate-200',
    nestedItem: isDark ? 'bg-zinc-950/40 border border-white/5' : 'bg-slate-100/70 border border-slate-200',
    
    // buttons
    btnQuickAction: isDark
      ? 'bg-zinc-950/60 hover:bg-zinc-900 text-indigo-400 border border-white/10'
      : 'bg-indigo-50 hover:bg-indigo-100/80 text-indigo-600 border border-indigo-200',
    btnGhost: isDark
      ? 'bg-zinc-900 hover:bg-zinc-800 border border-white/5 text-white'
      : 'bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 shadow-sm',
    
    // timeline
    timelineDot: isDark ? 'bg-zinc-950 border border-white/10 text-indigo-400' : 'bg-slate-100 border border-slate-300 text-indigo-600 shadow-sm',
    timelineLine: isDark ? 'bg-zinc-800' : 'bg-slate-300',
    
    // summary box
    summaryBox: isDark ? 'bg-zinc-950 border border-white/10 text-white' : 'bg-slate-50 border border-slate-200 text-slate-800',
    summaryBorder: isDark ? 'border-white/5' : 'border-slate-200',
    summaryTotalText: isDark ? 'text-white' : 'text-slate-900',
    summaryMuted: isDark ? 'text-zinc-400' : 'text-slate-500',
  };

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
        return;
      }
      
      try {
        const configRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'config', 'ordensServico');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          setConfigOS(snap.data());
        }
      } catch (configErr) {
        console.error("Erro ao carregar config da OS:", configErr);
      }
    } catch (err) {
      toast.error("Erro ao carregar dados da OS.");
      navigate('/admin/os');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSignature = async (base64Data) => {
    try {
      await osService.atualizarOrdemServico(estabelecimentoIdPrincipal, osId, {
        assinaturaCliente: base64Data
      });
      toast.success(base64Data ? "Assinatura salva com sucesso!" : "Assinatura removida.");
      carregarOS();
    } catch (err) {
      toast.error("Erro ao salvar assinatura.");
    }
  };

  useEffect(() => {
    carregarOS();
  }, [estabelecimentoIdPrincipal, osId]);

  // Alteração de Status
  const handleAlterarStatus = async (novoStatus) => {
    if (novoStatus === 'entregue' && os.situacaoFinanceira !== 'pago') {
      setStatusParaAtualizarAposPago('entregue');
      setMostrarFinalizacao(true);
      return;
    }

    setUpdatingStatus(true);
    try {
      const updateData = { status: novoStatus };
      
      if (novoStatus === 'entregue') {
        updateData.dataEntregaEfetiva = new Date();
      }
      
      await osService.atualizarOrdemServico(estabelecimentoIdPrincipal, osId, updateData);
      toast.success(`Status alterado para: ${getStatusBadgeStyle(novoStatus, isDark).label}`);
      
      // Envia notificação admin em background
      try {
        const { notificarAdmin } = await import('../../services/whatsappService');
        notificarAdmin(estabelecimentoIdPrincipal, 'os_status', { ...os, status: novoStatus });
      } catch (errWpp) {
        console.error("Erro ao enviar wpp notification:", errWpp);
      }

      carregarOS();
    } catch (err) {
      toast.error("Erro ao atualizar status.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Alteração Financeira (Baixa de Pagamento)
  const handleRegistrarPagamento = async () => {
    setMostrarFinalizacao(true);
  };

  const handleFinalizarPagamentoOS = async (payload) => {
    setSalvandoFaturamento(true);
    try {
      const cleanPhone = (os.cliente?.telefone || '').replace(/\D/g, '');
      let finalClientId = payload.clienteId;
      
      // Se o cliente não existia na lista de clientes, cadastrá-lo para fins de crediário
      if (payload.clienteNaoExiste) {
        const clientData = {
          id: finalClientId,
          nome: (os.cliente?.nome || 'CLIENTE OS').toUpperCase().trim(),
          telefone: cleanPhone,
          cpf: os.cliente?.cpf || '',
          email: os.cliente?.email || '',
          limiteCrediario: 0,
          saldoDevedor: 0,
          fidelidade: { carimbos: 0, premioDisponivel: false, cartelasCompletadas: 0 },
          criadoEm: new Date()
        };
        await setDoc(doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', finalClientId), clientData);
        if (cleanPhone && cleanPhone.length >= 8) {
          await setDoc(doc(db, 'clientes', cleanPhone), {
            nome: clientData.nome,
            telefone: clientData.telefone,
            cpf: clientData.cpf,
            email: clientData.email,
            limiteCrediario: clientData.limiteCrediario,
            criadoEm: clientData.criadoEm
          });
        }
      }

      // Atualizar OS com os dados do pagamento e garantia
      const osUpdate = {
        situacaoFinanceira: 'pago',
        pagamentos: payload.pagamentos,
        desconto: payload.desconto,
        acrescimo: payload.acrescimo,
        total: payload.total,
        valorRecebido: payload.valorRecebido,
        troco: payload.troco,
        garantia: payload.garantia,
        observacaoGarantia: payload.observacaoGarantia,
        faturadoEm: new Date()
      };

      if (statusParaAtualizarAposPago) {
        osUpdate.status = statusParaAtualizarAposPago;
        if (statusParaAtualizarAposPago === 'entregue') {
          osUpdate.dataEntregaEfetiva = new Date();
        }
      }

      await osService.atualizarOrdemServico(estabelecimentoIdPrincipal, osId, osUpdate);

      // Se houver pagamento em Crediário, registrar saldo devedor
      const valorCrediario = payload.pagamentos
        .filter(p => p.forma === 'crediario')
        .reduce((acc, p) => acc + p.valor, 0);

      if (valorCrediario > 0 && finalClientId) {
        // Atualizar no estabelecimento
        const cRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', finalClientId);
        const cSnap = await getDoc(cRef);
        const currentSaldo = cSnap.exists() ? (cSnap.data().saldoDevedor || 0) : 0;
        await updateDoc(cRef, {
          saldoDevedor: currentSaldo + valorCrediario
        });

        // Sincronizar global
        const gRef = doc(db, 'clientes', finalClientId);
        const gSnap = await getDoc(gRef);
        if (gSnap.exists()) {
          await updateDoc(gRef, {
            saldoDevedor: (gSnap.data().saldoDevedor || 0) + valorCrediario
          });
        }

        // Histórico de crediário
        const crediarioPagt = payload.pagamentos.find(p => p.forma === 'crediario');
        const dataVencimentoObj = crediarioPagt?.dataVencimento
          ? new Date(crediarioPagt.dataVencimento + 'T12:00:00')
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const histRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'clientes', finalClientId, 'historico_crediario'));
        await setDoc(histRef, {
          tipo: 'compra',
          valor: valorCrediario,
          saldoPendente: valorCrediario,
          status: 'pendente',
          dataVencimento: dataVencimentoObj,
          descricao: `OS #${osId.substring(0, 5).toUpperCase()}`,
          vendaId: osId,
          data: new Date(),
          itens: [
            ...(os.servicos || []).map(s => ({ nome: `SERVIÇO: ${s.descricao}`, quantidade: 1, preco: Number(s.valor || 0) })),
            ...(os.pecas || []).map(p => ({ nome: `PEÇA: ${p.nome}`, quantidade: 1, preco: Number(p.valor || 0) }))
          ]
        });
      }

      // Registrar recebimento da OS no caixa aberto (se houver)
      try {
        const userUid = auth.currentUser?.uid;
        if (userUid) {
          const caixaAberto = await caixaService.verificarCaixaAberto(userUid, estabelecimentoIdPrincipal);
          if (caixaAberto) {
            const identOS = os.numeroOS ? `#${os.numeroOS}` : `#${osId.substring(0, 5).toUpperCase()}`;
            for (const pag of (payload.pagamentos || [])) {
              if (pag.forma === 'crediario') {
                continue;
              }
              const meio = pag.forma || 'dinheiro';
              const tipoMov = meio.toLowerCase() === 'dinheiro' ? 'suprimento' : `suprimento_${meio.toLowerCase()}`;
              await caixaService.adicionarMovimentacao(caixaAberto.id, {
                tipo: tipoMov,
                valor: Number(pag.valor || 0),
                descricao: `Receb. OS ${identOS}: ${os.cliente?.nome || 'Cliente OS'} (via ${meio.toUpperCase()})`,
                usuarioId: userUid,
                estabelecimentoId: estabelecimentoIdPrincipal
              });
            }
          }
        }
      } catch (caixaErr) {
        console.error("Erro ao registrar recebimento de OS no caixa:", caixaErr);
      }

      toast.success("Pagamento e faturamento registrados com sucesso!");
      
      // Envia notificação admin em background
      try {
        const { notificarAdmin } = await import('../../services/whatsappService');
        notificarAdmin(estabelecimentoIdPrincipal, 'os_pagamento', { ...os, ...osUpdate });
      } catch (errWpp) {
        console.error("Erro ao enviar wpp notification:", errWpp);
      }

      setMostrarFinalizacao(false);
      setStatusParaAtualizarAposPago(null);
      carregarOS();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar pagamento da OS.");
    } finally {
      setSalvandoFaturamento(false);
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
        const layoutOS = gerarLayoutOS(os, valorServicos, valorPecas, total, configOS);
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
        <div className="animate-spin w-12 h-12 border-4 border-white/10 border-t-indigo-500 rounded-full mb-3"></div>
        <p className="text-xs font-black text-zinc-400">Carregando detalhes do atendimento...</p>
      </div>
    );
  }

  if (!os) return null;

  const statusInfo = getStatusBadgeStyle(os.status, isDark);

  return (
    <div className={`space-y-6 font-sans min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -my-6 md:-my-8 p-6 md:p-8 relative overflow-hidden transition-colors duration-300 ${styles.bg}`}>
      
      {/* Background neon glows */}
      {isDark && (
        <>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none no-print" />
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none no-print" />
        </>
      )}
      {!isDark && (
        <>
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-550/5 rounded-full blur-[100px] pointer-events-none no-print" />
          <div className="absolute bottom-10 left-10 w-80 h-80 bg-blue-550/5 rounded-full blur-[100px] pointer-events-none no-print" />
        </>
      )}

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
            font-weight: bold !important;
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
      <div className="no-print space-y-6 relative z-10">
        
        {/* HEADER BAR */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 ${styles.headerBorder}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/os')}
              className={`p-2 border rounded-xl transition-all ${
                isDark 
                  ? 'border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white' 
                  : 'border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800'
              }`}
            >
              <IoChevronBackOutline size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-2xl font-black tracking-tight ${styles.title}`}>Ordem de Serviço #{os.numeroOS}</h1>
                <span className={`px-2.5 py-0.5 rounded-lg border text-[9px] font-black uppercase whitespace-nowrap inline-flex items-center gap-1 ${statusInfo.bg}`}>
                  <span>{statusInfo.icon}</span>
                  <span>{statusInfo.label}</span>
                </span>
              </div>
              <p className={`text-xs font-bold mt-0.5 ${styles.subtitle}`}>Abertura: {formatarData(os.createdAt)} • Atualizada: {formatarData(os.updatedAt)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-2xl border transition-all ${
                isDark 
                  ? 'bg-zinc-900/50 border-white/10 hover:bg-zinc-800/50 text-zinc-400 hover:text-white' 
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-850'
              }`}
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
            >
              {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>
            <button
              onClick={handlePrint}
              className={`font-extrabold text-xs px-5 py-3 rounded-2xl flex items-center gap-1.5 transition-all ${styles.btnGhost}`}
            >
              <IoPrintOutline size={16} /> IMPRIMIR OS
            </button>
            <button
              onClick={handleDelete}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-extrabold text-xs px-5 py-3 rounded-2xl flex items-center gap-1.5 transition-all"
            >
              <IoTrashOutline size={16} /> EXCLUIR
            </button>
          </div>
        </div>

        {/* WORKFLOW QUICK ACTION BUTTONS */}
        <div className={`rounded-[2.2rem] p-5 space-y-3 ${styles.card}`}>
          <h3 className={`text-xs font-black uppercase tracking-widest ${styles.textMuted}`}>Ações Técnicas e Financeiras Rápidas</h3>
          <div className="flex flex-wrap gap-2">
            {os.status === 'em_analise' && (
              <button
                disabled={updatingStatus}
                onClick={async () => {
                  await handleAlterarStatus('aguardando_orcamento');
                  const zapUrl = `https://wa.me/${cleanPhone(os.cliente?.telefone)}?text=${formatarOrcamentoZap(os, valorServicos, valorPecas, total)}`;
                  window.open(zapUrl, '_blank');
                }}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${styles.btnQuickAction}`}
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-600/10"
              >
                💬 Enviar por WhatsApp
              </button>
            )}
            {['em_analise', 'aguardando_orcamento'].includes(os.status) && (
              <>
                <button
                  disabled={updatingStatus}
                  onClick={() => handleAlterarStatus('orcamento_aprovado')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${styles.btnQuickAction}`}
                >
                  <IoThumbsUpOutline size={16} /> Orçamento Aprovado
                </button>
                <button
                  disabled={updatingStatus}
                  onClick={() => handleAlterarStatus('orcamento_rejeitado')}
                  className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${styles.btnQuickAction}`}
                >
                  <IoThumbsDownOutline size={16} /> Rejeitar Orçamento
                </button>
              </>
            )}
            {['orcamento_aprovado', 'em_analise'].includes(os.status) && (
              <button
                disabled={updatingStatus}
                onClick={() => handleAlterarStatus('em_manutencao')}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${styles.btnQuickAction}`}
              >
                <IoPlayOutline size={16} /> Iniciar Reparo
              </button>
            )}
            {os.status === 'em_manutencao' && (
              <button
                disabled={updatingStatus}
                onClick={() => handleAlterarStatus('pronto')}
                className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 border ${styles.btnQuickAction}`}
              >
                <IoCheckmarkCircleOutline size={16} /> Reparo Concluído (Pronto)
              </button>
            )}
            {os.status === 'pronto' && (
              <button
                disabled={updatingStatus}
                onClick={() => handleAlterarStatus('entregue')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/10"
              >
                📦 Entregar Aparelho ao Cliente
              </button>
            )}
            
            {/* Ação Financeira */}
            {os.situacaoFinanceira === 'pendente' && (
              <button
                disabled={updatingStatus}
                onClick={handleRegistrarPagamento}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-600/10 ml-auto"
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
            {(() => {
              const isVeiculo = ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(os.equipamento?.tipo);
              return (
                <div className={`rounded-[2.2rem] p-6 space-y-5 ${styles.card}`}>
                  <h3 className={`text-xs font-black uppercase tracking-widest pb-2 flex items-center gap-2 ${styles.cardTitle}`}>
                    <IoPhonePortraitOutline size={18} className="text-indigo-400" />
                    <span>{isVeiculo ? 'Informações do Veículo' : 'Informações do Dispositivo'}</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold">
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>{isVeiculo ? 'Tipo de Veículo' : 'Aparelho'}</p>
                      <p className={`text-sm mt-1 ${styles.textTitle}`}>{os.equipamento?.tipo || 'Não especificado'}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Marca</p>
                      <p className={`text-sm mt-1 ${styles.textTitle}`}>{os.equipamento?.marca}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Modelo</p>
                      <p className={`text-sm mt-1 ${styles.textTitle}`}>{os.equipamento?.modelo}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>
                        {isVeiculo ? 'Chassi' : 'Nº de Série / IMEI'}
                      </p>
                      <p className={`font-mono text-sm mt-1 ${styles.textHighlight}`}>{os.equipamento?.nSerieOrImei || '---'}</p>
                    </div>
                  </div>

                  {/* Seção dinâmica na exibição */}
                  {isVeiculo ? (
                    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-bold border-t pt-4 ${styles.border}`}>
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Placa</p>
                        <p className={`font-black text-sm mt-1 uppercase border px-2 py-0.5 rounded inline-block font-mono ${styles.badgeText}`}>{os.equipamento?.placa || '---'}</p>
                      </div>
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>KM / Odômetro</p>
                        <p className={`text-sm mt-1 ${styles.textTitle}`}>{os.equipamento?.quilometragem ? `${Number(os.equipamento.quilometragem).toLocaleString('pt-BR')} KM` : '---'}</p>
                      </div>
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Ano Modelo</p>
                        <p className={`text-sm mt-1 ${styles.textTitle}`}>{os.equipamento?.ano || '---'}</p>
                      </div>
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Combustível</p>
                        <p className={`text-sm mt-1 ${styles.textTitle}`}>
                          {os.equipamento?.nivelCombustivel === 'reserva' && '⛽ Reserva'}
                          {os.equipamento?.nivelCombustivel === '1_4' && '⛽ 1/4'}
                          {os.equipamento?.nivelCombustivel === '1_2' && '⛽ 1/2'}
                          {os.equipamento?.nivelCombustivel === '3_4' && '⛽ 3/4'}
                          {os.equipamento?.nivelCombustivel === 'cheio' && '⛽ Cheio'}
                          {!os.equipamento?.nivelCombustivel && '---'}
                        </p>
                      </div>
                      {os.equipamento?.motor && (
                        <div className="col-span-4">
                          <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Motorização</p>
                          <p className={`text-xs mt-1 p-2.5 rounded-xl border font-semibold inline-block ${styles.badgeText}`}>{os.equipamento.motor}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={`grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-bold border-t pt-4 ${styles.border}`}>
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider font-extrabold ${styles.textMuted}`}>Senha / Padrão de Desbloqueio</p>
                        <div className="flex flex-wrap items-start gap-4 mt-2">
                          <div>
                            <p className={`font-mono text-sm ${styles.textTitle}`}>{os.equipamento?.senhaDesbloqueio || 'Sem Senha em Texto'}</p>
                          </div>
                          {os.equipamento?.desenhoDesbloqueio && (
                            <DesenhoDesbloqueioViewer value={os.equipamento.desenhoDesbloqueio} isDark={isDark} />
                          )}
                        </div>
                      </div>
                      {os.equipamento?.imei2 && (
                        <div>
                          <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>IMEI 2</p>
                          <p className={`font-mono text-sm mt-1 ${styles.textTitle}`}>{os.equipamento.imei2}</p>
                        </div>
                      )}
                      <div>
                        <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Backup de Dados</p>
                        <p className={`text-sm mt-1 ${styles.textTitle}`}>
                          {os.equipamento?.backupRealizado === 'sim' && '✅ Realizado'}
                          {os.equipamento?.backupRealizado === 'nao' && '❌ Não Realizado'}
                          {os.equipamento?.backupRealizado === 'risco_cliente' && '⚠️ Assumido p/ Cliente'}
                          {os.equipamento?.backupRealizado === 'nao_se_aplica' && '🔌 Não se aplica'}
                          {!os.equipamento?.backupRealizado && '---'}
                        </p>
                      </div>
                      {os.equipamento?.acessoriosDeixados && os.equipamento.acessoriosDeixados.length > 0 && (
                        <div className="col-span-3">
                          <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Acessórios Deixados</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {os.equipamento.acessoriosDeixados.map(acc => {
                              const labels = {
                                carregador: '🔌 Carregador',
                                cabo: '🎗️ Cabo USB',
                                capinha: '📱 Capinha',
                                chip: '📟 Chip SIM',
                                memoria: '💾 Cartão Memória',
                                fone: '🎧 Fone'
                              };
                              return (
                                <span key={acc} className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${styles.badgeText}`}>
                                  {labels[acc] || acc}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Exibição do Checklist */}
                  {os.checklist && Object.keys(os.checklist).length > 0 && (
                    <div className={`border-t pt-4 space-y-3 ${styles.border}`}>
                      <p className={`text-[10px] uppercase tracking-wider font-extrabold ${styles.textMuted}`}>📋 Checklist de Entrada</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {Object.entries(os.checklist).map(([key, value]) => {
                          const labels = isVeiculo
                            ? { farois: '💡 Faróis', setas: '🔊 Setas/Buzina', pneus: '🛞 Pneus', vidros: '🪟 Vidros', oleo_agua: '🛢️ Óleo/Água', freios: '🛑 Freios', ar_condicionado: '❄️ Ar Cond.' }
                            : { touch: '📱 Touch/Tela', cam_frontal: '📸 Câm. Frontal', cam_traseira: '📸 Câm. Traseira', som: '🔊 Mic/Áudio', conector_carga: '🔌 Carga', biometria: '🔐 Biometria', botoes: '🎛️ Botões' };
                          
                          const label = labels[key] || key;
                          return (
                            <div key={key} className={`flex items-center justify-between p-2.5 rounded-xl border font-bold transition-colors duration-300 ${styles.nestedItem}`}>
                              <span className={`truncate mr-1 ${isDark ? 'text-zinc-400' : 'text-slate-600'}`}>{label}</span>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                value === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                value === 'defeito' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                (isDark ? 'bg-zinc-800 text-zinc-400 border border-white/5' : 'bg-slate-100 text-slate-500 border border-slate-200')
                              }`}>
                                {value === 'ok' ? 'OK' : value === 'defeito' ? 'Defeito' : 'N/T'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Registro Fotográfico */}
                  {os.fotos && os.fotos.length > 0 && (
                    <div className={`border-t pt-4 space-y-3 ${styles.border}`}>
                      <p className={`text-[10px] uppercase tracking-wider font-extrabold ${styles.textMuted}`}>📸 Fotos da Entrada</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {os.fotos.map((url, idx) => (
                          <a href={url} target="_blank" rel="noreferrer" key={idx} className={`aspect-video rounded-xl overflow-hidden border transition-all hover:opacity-90 ${
                            isDark ? 'bg-zinc-950 border-white/10 hover:border-indigo-500' : 'bg-slate-100 border-slate-300 hover:border-indigo-600'
                          }`}>
                            <img src={url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className={`text-xs font-bold border-t pt-4 ${styles.border}`}>
                    <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>{isVeiculo ? 'Avarias / Detalhes Visuais' : 'Estado Físico na Entrega'}</p>
                    <p className={`p-4 rounded-2xl mt-1.5 border leading-relaxed font-semibold transition-colors duration-300 ${styles.nestedContainer}`}>
                      {os.equipamento?.estadoFisico || (isVeiculo ? 'Sem avarias relatadas.' : 'Sem observações visuais catalogadas.')}
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Diagnóstico técnico */}
            <div className={`rounded-[2.2rem] p-6 space-y-5 ${styles.card}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest pb-2 flex items-center gap-2 ${styles.cardTitle}`}>
                <IoBuildOutline size={18} className="text-blue-400" />
                <span>Laudo Técnico & Manutenção</span>
              </h3>
              
              <div className="space-y-4 text-xs font-bold">
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Defeito Relatado pelo Cliente</p>
                  <p className={`mt-1.5 p-4 border rounded-2xl leading-relaxed transition-colors duration-300 ${styles.nestedContainer}`}>
                    {os.defeitoRelatado || '---'}
                  </p>
                </div>
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Defeito Detectado em Testes</p>
                  <p className={`mt-1.5 p-4 border rounded-2xl leading-relaxed transition-colors duration-300 ${styles.nestedContainer}`}>
                    {os.defeitoDetectado || '---'}
                  </p>
                </div>
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Diagnóstico / Procedimento Solicitado</p>
                  <p className={`font-extrabold mt-1.5 p-4 border rounded-2xl leading-relaxed ${
                    isDark ? 'text-amber-300 bg-amber-500/5 border-amber-500/10' : 'text-amber-700 bg-amber-50/50 border-amber-200'
                  }`}>
                    {os.diagnosticoTecnico || '---'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mão de Obra e Peças aplicadas */}
            <div className={`rounded-[2.2rem] p-6 space-y-4 ${styles.card}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest pb-2 ${styles.cardTitle}`}>
                Especificação de Peças e Serviços
              </h3>
              
              {/* Serviços list */}
              {os.servicos && os.servicos.length > 0 && (
                <div className="space-y-2">
                  <p className={`text-[9px] font-black uppercase tracking-wider ${styles.textMuted}`}>Serviços executados</p>
                  <div className={`divide-y border rounded-2xl overflow-hidden text-xs ${styles.border}`}>
                    {os.servicos.map((s, idx) => (
                      <div key={idx} className={`flex justify-between p-3.5 font-bold ${isDark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={isDark ? 'text-zinc-300' : 'text-slate-700'}>{s.descricao}</span>
                        <span className={`font-black ${styles.textTitle}`}>R$ {parseFloat(s.valor).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Peças list */}
              {os.pecas && os.pecas.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className={`text-[9px] font-black uppercase tracking-wider ${styles.textMuted}`}>Peças / Componentes aplicados</p>
                  <div className={`divide-y border rounded-2xl overflow-hidden text-xs ${styles.border}`}>
                    {os.pecas.map((p, idx) => (
                      <div key={idx} className={`flex justify-between p-3.5 font-bold ${isDark ? 'bg-zinc-950/40 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={isDark ? 'text-zinc-300' : 'text-slate-700'}>{p.nome}</span>
                        <span className={`font-black ${styles.textTitle}`}>R$ {parseFloat(p.valor).toFixed(2)}</span>
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
            <div className={`rounded-[2.2rem] p-6 space-y-5 ${styles.card}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest pb-2 flex items-center gap-2 ${styles.cardTitle}`}>
                <IoPersonOutline size={18} className="text-zinc-400" />
                <span>Dados do Cliente</span>
              </h3>
              
              <div className="text-xs font-bold space-y-4">
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>Nome do Titular</p>
                  <p className={`text-sm mt-1 ${styles.textTitle}`}>{os.cliente?.nome}</p>
                </div>
                <div>
                  <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>WhatsApp / Telefone</p>
                  <a href={`https://wa.me/${cleanPhone(os.cliente?.telefone)}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-500 text-sm mt-1 block font-extrabold hover:underline">
                    {os.cliente?.telefone} (Enviar Mensagem 📲)
                  </a>
                </div>
                {os.cliente?.cpf && (
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>CPF</p>
                    <p className={`mt-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{os.cliente?.cpf}</p>
                  </div>
                )}
                {os.cliente?.email && (
                  <div>
                    <p className={`text-[10px] uppercase tracking-wider ${styles.textMuted}`}>E-mail</p>
                    <p className={`mt-1 ${isDark ? 'text-zinc-300' : 'text-slate-700'}`}>{os.cliente?.email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Técnico & Garantia */}
            <div className={`rounded-[2.2rem] p-6 space-y-4 ${styles.card}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest pb-2 ${styles.cardTitle}`}>
                Técnico & prazos
              </h3>
              
              <div className="text-xs font-bold space-y-3">
                <div className={`flex justify-between items-center p-3.5 rounded-2xl border ${styles.nestedItem}`}>
                  <span className={`text-[10px] uppercase ${styles.textMuted}`}>Responsável</span>
                  <span className={`font-extrabold ${styles.textTitle}`}>{os.tecnicoResponsavel?.nome || 'Não definido'}</span>
                </div>
                <div className={`flex justify-between items-center p-3.5 rounded-2xl border ${styles.nestedItem}`}>
                  <span className={`text-[10px] uppercase ${styles.textMuted}`}>Garantia</span>
                  <span className={`font-extrabold ${styles.textTitle}`}>{os.garantiaDias} dias técnicos</span>
                </div>
                <div className={`flex justify-between items-center p-3.5 rounded-2xl border ${styles.nestedItem}`}>
                  <span className={`text-[10px] uppercase ${styles.textMuted}`}>Previsão Entrega</span>
                  <span className={`font-extrabold ${styles.textTitle}`}>{os.dataPrevisaoEntrega ? new Date(os.dataPrevisaoEntrega.toDate ? os.dataPrevisaoEntrega.toDate() : os.dataPrevisaoEntrega).toLocaleDateString('pt-BR') : 'Sem previsão'}</span>
                </div>
              </div>
            </div>

            {/* Assinatura Digital */}
            <div className={`rounded-[2.2rem] p-6 space-y-5 ${styles.card}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest pb-2 ${styles.cardTitle}`}>
                ✍️ Assinatura Digital do Cliente
              </h3>
              {os.assinaturaCliente ? (
                <div className="space-y-4 text-center">
                  <div className={`border rounded-2xl p-4 inline-block ${isDark ? 'bg-white border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <img 
                      src={os.assinaturaCliente} 
                      alt="Assinatura Cliente" 
                      className={`max-w-full h-auto max-h-[85px] ${isDark ? 'invert' : ''}`} 
                      style={{ filter: isDark ? "brightness(0.95)" : "" }} 
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 items-center">
                    <span className="text-[10px] text-emerald-500 font-black bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">🟢 Assinatura Confirmada</span>
                    <button
                      type="button"
                      onClick={() => handleSaveSignature('')}
                      className="text-[9px] text-rose-400 hover:text-rose-400 font-bold hover:underline"
                    >
                      Remover / Refazer Assinatura
                    </button>
                  </div>
                </div>
              ) : (
                <SignaturePad onSave={handleSaveSignature} isDark={isDark} />
              )}
            </div>

            {/* Linha do Tempo da OS */}
            <div className={`rounded-[2.2rem] p-6 space-y-5 ${styles.card}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest pb-2 ${styles.cardTitle}`}>
                ⏳ Histórico de Status
              </h3>
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {os.timeline && os.timeline.length > 0 ? (
                  os.timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-3 text-xs relative">
                      {idx !== os.timeline.length - 1 && (
                        <div className={`absolute top-4 left-2.5 bottom-[-16px] w-[1.5px] ${styles.timelineLine}`} />
                      )}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 relative z-10 ${styles.timelineDot}`}>
                        {idx + 1}
                      </div>
                      <div className="space-y-1">
                        <p className={`font-extrabold leading-snug ${styles.textTitle}`}>{event.anotacao}</p>
                        <p className={`text-[10px] font-semibold ${styles.textMuted}`}>
                          {event.data?.toDate ? event.data.toDate().toLocaleString('pt-BR') : new Date(event.data).toLocaleString('pt-BR')} • {event.tecnico}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-500 font-bold text-center py-4">Sem registros de histórico.</p>
                )}
              </div>
            </div>

            {/* Fechamento Financeiro */}
            <div className={`rounded-[2.2rem] p-6 shadow-2xl text-white space-y-5 transition-colors duration-300 ${styles.summaryBox}`}>
              <h3 className={`text-xs font-black uppercase tracking-widest border-b pb-2 ${styles.summaryBorder} ${styles.summaryMuted}`}>
                Resumo Financeiro
              </h3>
              
              <div className={`text-xs font-bold space-y-2 border-b pb-4 ${styles.summaryBorder}`}>
                <div className="flex justify-between">
                  <span className={styles.summaryMuted}>Total em Serviços</span>
                  <span className={styles.summaryTotalText}>R$ {valorServicos.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={styles.summaryMuted}>Total em Peças</span>
                  <span className={styles.summaryTotalText}>R$ {valorPecas.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-rose-500">
                  <span>Desconto Aplicado</span>
                  <span>- R$ {Number(os.desconto || 0).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${styles.summaryMuted}`}>Valor Líquido</p>
                  <p className={`text-3xl font-black mt-1 ${styles.summaryTotalText}`}>R$ {total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${styles.summaryMuted}`}>Situação</p>
                  <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block mt-2 ${
                    os.situacaoFinanceira === 'pago' 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    {os.situacaoFinanceira === 'pago' ? 'PAGO' : 'PENDENTE'}
                  </span>
                </div>
              </div>

              {os.situacaoFinanceira === 'pago' && (
                <div className={`space-y-4 border-t pt-4 text-xs font-bold ${styles.summaryBorder}`}>
                  
                  {/* Acréscimo / Markup */}
                  {Number(os.acrescimo || 0) > 0 && (
                    <div className="flex justify-between text-indigo-400">
                      <span className={styles.summaryMuted}>Acréscimo Aplicado</span>
                      <span>+ R$ {Number(os.acrescimo).toFixed(2)}</span>
                    </div>
                  )}

                  {/* Payment Details */}
                  {os.pagamentos && os.pagamentos.length > 0 && (
                    <div className="space-y-1.5">
                      <span className={`text-[10px] font-black uppercase tracking-wider block ${styles.summaryMuted}`}>Formas de Pagamento</span>
                      <div className="flex flex-wrap gap-1.5">
                        {os.pagamentos.map((p, idx) => (
                          <span key={idx} className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                            isDark 
                              ? 'bg-zinc-900 border-white/5 text-zinc-300' 
                              : 'bg-white border-slate-200 text-slate-700 shadow-sm'
                          }`}>
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

                  {/* Warranty Information */}
                  {os.garantia && (
                    <div className="space-y-1">
                      <span className={`text-[10px] font-black uppercase tracking-wider block ${styles.summaryMuted}`}>🛡️ Garantia Registrada</span>
                      <span className={`text-[11px] font-black block ${styles.summaryTotalText}`}>
                        {os.garantia === '90_dias' ? '90 dias (CDC)' : os.garantia === '180_dias' ? '180 dias' : '365 dias'}
                      </span>
                      {os.observacaoGarantia && (
                        <p className={`text-[10px] leading-normal font-semibold italic ${styles.summaryMuted} whitespace-pre-line border-l-2 pl-2 ${
                          isDark ? 'border-white/10' : 'border-slate-300'
                        }`}>
                          {os.observacaoGarantia}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Faturado em date */}
                  {os.faturadoEm && (
                    <div className="flex justify-between items-center text-[10px]">
                      <span className={styles.summaryMuted}>Faturado em</span>
                      <span className={styles.summaryMuted}>
                        {formatarData(os.faturadoEm)}
                      </span>
                    </div>
                  )}

                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* --- PRINT THERMAL LAYOUT (ONLY DETECTED ON window.print() PRINT MEDIA) --- */}
      <div id="printable-receipt" className="hidden print:block text-black bg-white" style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '13px', width: '72mm', color: '#000' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
          {configOS?.empresaLogo && (
            <img 
              src={configOS.empresaLogo} 
              alt="Logo Empresa" 
              style={{ maxWidth: '120px', maxHeight: '60px', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }} 
            />
          )}
          <div style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {configOS?.empresaNome || 'Ficha Assistência Técnica'}
          </div>
          {configOS?.empresaCNPJ && <div style={{ fontSize: '10px' }}>CNPJ: {configOS.empresaCNPJ}</div>}
          {configOS?.empresaEndereco && <div style={{ fontSize: '9px', margin: '2px 0' }}>{configOS.empresaEndereco}</div>}
          {configOS?.empresaTelefone && <div style={{ fontSize: '10px', fontWeight: 'bold' }}>Tel: {configOS.empresaTelefone}</div>}
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
        {(() => {
          const isVeiculo = ['Carro', 'Moto', 'Caminhão', 'Utilitário'].includes(os.equipamento?.tipo);
          return (
            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px', fontSize: '11px' }}>
              <b>{isVeiculo ? 'VEÍCULO:' : 'EQUIPAMENTO:'}</b> {os.equipamento?.marca} {os.equipamento?.modelo}<br />
              {isVeiculo ? (
                <>
                  {os.equipamento?.placa && <><b>PLACA:</b> {os.equipamento.placa.toUpperCase()}<br /></>}
                  {os.equipamento?.nSerieOrImei && <><b>CHASSI:</b> {os.equipamento.nSerieOrImei}<br /></>}
                  {os.equipamento?.quilometragem && <><b>KM:</b> {Number(os.equipamento.quilometragem).toLocaleString('pt-BR')} KM<br /></>}
                  {os.equipamento?.nivelCombustivel && (
                    <>
                      <b>COMBUS.:</b> {
                        os.equipamento.nivelCombustivel === 'reserva' ? 'Reserva' :
                        os.equipamento.nivelCombustivel === '1_4' ? '1/4' :
                        os.equipamento.nivelCombustivel === '1_2' ? '1/2' :
                        os.equipamento.nivelCombustivel === '3_4' ? '3/4' : 'Cheio'
                      }<br />
                    </>
                  )}
                </>
              ) : (
                <>
                  {os.equipamento?.nSerieOrImei && <><b>IMEI/SÉRIE:</b> {os.equipamento.nSerieOrImei}<br /></>}
                   {os.equipamento?.senhaDesbloqueio && <><b>SENHA:</b> {os.equipamento.senhaDesbloqueio}<br /></>}
                    {os.equipamento?.desenhoDesbloqueio && (
                      <>
                        <b>PADRÃO DE DESBLOQUEIO:</b><br />
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                          <DesenhoDesbloqueioViewer value={os.equipamento.desenhoDesbloqueio} forPrint={true} />
                        </div>
                      </>
                    )}
                  {os.equipamento?.acessoriosDeixados && os.equipamento.acessoriosDeixados.length > 0 && (
                    <>
                      <b>ACESSÓRIOS:</b> {
                        os.equipamento.acessoriosDeixados.map(acc => {
                          const labels = { carregador: 'Carregador', cabo: 'Cabo', capinha: 'Capinha', chip: 'Chip SIM', memoria: 'Cartão Memória', fone: 'Fone' };
                          return labels[acc] || acc;
                        }).join(', ')
                      }<br />
                    </>
                  )}
                </>
              )}
              <b>{isVeiculo ? 'AVARIAS:' : 'ESTADO FÍSICO:'}</b> {os.equipamento?.estadoFisico || 'Nenhum'}<br />
              <b>DEFEITO RELATADO:</b> {os.defeitoRelatado || '---'}<br />
            </div>
          );
        })()}

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
          <b>TERMOS DE GARANTIA:</b> {configOS?.termosGarantiaPadrao ? configOS.termosGarantiaPadrao : `A garantia para este conserto é de ${os.garantiaDias} dias a contar da data de entrega, cobrindo exclusivamente defeitos de fabricação dos componentes substituídos. A garantia não cobre danos decorrentes de quedas, contato com líquidos ou manuseio inadequado por terceiros.`}
        </div>

        {/* Signature image in print */}
        {os.assinaturaCliente && (
          <div style={{ textAlign: 'center', marginTop: '15px', marginBottom: '5px' }}>
            <img src={os.assinaturaCliente} style={{ maxWidth: '180px', height: 'auto', maxHeight: '60px' }} alt="Assinatura" />
          </div>
        )}

        {/* Signature */}
        <div style={{ textAlign: 'center', marginTop: os.assinaturaCliente ? '5px' : '30px' }}>
          <div style={{ borderTop: '1px solid #000', width: '80%', margin: '0 auto', paddingTop: '4px', fontSize: '10px' }}>
            Assinatura do Cliente
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '20px' }}>
          {configOS?.empresaNome || 'IdeaFood Assistência Técnica'}<br />
          Obrigado pela preferência!
        </div>

      </div>

      {mostrarFinalizacao && (
        <ModalFinalizacaoOS
          visivel={mostrarFinalizacao}
          os={os}
          onClose={() => {
            setMostrarFinalizacao(false);
            setStatusParaAtualizarAposPago(null);
          }}
          onFinalizar={handleFinalizarPagamentoOS}
          salvando={salvandoFaturamento}
          estabelecimentoId={estabelecimentoIdPrincipal}
        />
      )}

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
