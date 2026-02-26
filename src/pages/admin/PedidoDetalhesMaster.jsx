import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  collectionGroup, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { auditLogger } from '../../utils/auditLogger';
import { vendaService } from '../../services/vendaService'; // <-- IMPORTANTE: Adicionado o serviço de Vendas/Fiscal
import { 
  FaStore, 
  FaUser, 
  FaMoneyBillWave, 
  FaMotorcycle, 
  FaBoxOpen, 
  FaArrowLeft, 
  FaWhatsapp, 
  FaPrint,
  FaCalendarAlt,
  FaUtensils,
  FaSignOutAlt,
  FaCheck,
  FaTimes,
  FaBan,
  FaFileInvoice // <-- IMPORTANTE: Novo ícone para a área Fiscal
} from 'react-icons/fa';

// --- Header Minimalista ---
const DashboardHeader = ({ navigate, logout }) => (
  <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
         <div className="flex items-center gap-1">
            <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                <FaStore />
            </div>
            <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                Na<span className="text-yellow-500">Mão</span>
            </span>
        </div>
      </div>
      <button 
          onClick={logout} 
          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
          title="Sair"
      >
        <FaSignOutAlt />
      </button>
    </div>
  </header>
);

// --- HELPERS ---
const formatId = (id) => {
  if (!id) return '#---';
  const parts = id.split('_');
  if (parts.length > 1) return `#${parts[1].substring(0, 6).toUpperCase()}`;
  if (id.length > 8) return `#${id.substring(0, 6).toUpperCase()}`;
  return `#${id.toUpperCase()}`;
};

const getDate = (data) => {
  if (!data) return null;
  const t = data.dataPedido || data.criadoEm || data.createdAt || data.adicionadoEm || data.updatedAt;
  if (!t) return null;
  if (t.toDate) return t.toDate();
  return new Date(t);
};

function PedidoDetalhesMaster() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isMasterAdmin, loading: authLoading, logout } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [loadingPedido, setLoadingPedido] = useState(true);
  const [updating, setUpdating] = useState(false); // Estado para loading de ação de status
  const [nfceStatus, setNfceStatus] = useState('idle'); // Estado de loading para ações fiscais
  const [error, setError] = useState('');
  const [estabNome, setEstabNome] = useState('Carregando...');
  const [docRefPath, setDocRefPath] = useState(null);

  // Carregar Pedido
  useEffect(() => {
    if (authLoading) return;
    if (!isMasterAdmin) {
      navigate('/master-dashboard');
      return;
    }

    const fetchPedido = async () => {
      try {
        setLoadingPedido(true);
        let foundData = null;
        let foundEstabId = null;
        let path = null;

        // Tenta encontrar o pedido (Root ou Subcoleção)
        let docSnap = await getDoc(doc(db, 'pedidos', id));
        if (docSnap.exists()) {
            foundData = { id: docSnap.id, ...docSnap.data() };
            path = docSnap.ref;
        }

        if (!foundData) {
           const qPed = query(collectionGroup(db, 'pedidos'), where('id', '==', id));
           const snapPed = await getDocs(qPed);
           if (!snapPed.empty) {
              const d = snapPed.docs[0];
              foundData = { id: d.id, ...d.data() };
              path = d.ref;
           }
        }

        if (!foundData) throw new Error('Pedido não encontrado.');

        setPedido(foundData);
        setDocRefPath(path);
        
        // Nome do Estabelecimento
        foundEstabId = foundData.estabelecimentoId;
        if (!foundEstabId && path.path.includes('estabelecimentos/')) {
            const parts = path.path.split('/');
            foundEstabId = parts[1];
        }

        if (foundEstabId) {
          try {
            const estabSnap = await getDoc(doc(db, 'estabelecimentos', foundEstabId));
            if (estabSnap.exists()) setEstabNome(estabSnap.data().nome);
            else setEstabNome('ID não encontrado');
          } catch { setEstabNome('Erro bus. estab.'); }
        } else {
          setEstabNome('Global / N/A');
        }

      } catch (err) {
        console.error(err);
        setError("Não foi possível carregar este pedido.");
      } finally {
        setLoadingPedido(false);
      }
    };

    if (id) fetchPedido();
  }, [id, isMasterAdmin, authLoading, navigate]);

  // --- FUNÇÃO: ALTERAR STATUS DO PEDIDO ---
  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Tem certeza que deseja mudar o status para "${newStatus.toUpperCase()}"?`)) return;
    if (!docRefPath) return toast.error("Referência do pedido perdida.");

    setUpdating(true);
    try {
        const oldStatus = pedido.status;

        await updateDoc(docRefPath, { 
            status: newStatus,
            updatedAt: new Date()
        });

        await auditLogger(
            'PEDIDO_STATUS_ALTERADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, 
            { type: 'pedido', id: pedido.id, name: `Pedido ${formatId(pedido.id)}` }, 
            { de: oldStatus, para: newStatus, estabelecimento: estabNome } 
        );

        setPedido(prev => ({ ...prev, status: newStatus }));
        toast.success(`Status alterado para ${newStatus}`);

    } catch (err) {
        console.error("Erro ao atualizar:", err);
        toast.error("Erro ao atualizar status.");
    } finally {
        setUpdating(false);
    }
  };

  // --- FUNÇÕES FISCAIS (NFC-E) ---

  // 1. REPROCESSAR OU EMITIR NOTA
  const handleReprocessarNfce = async () => {
    setNfceStatus('loading');
    try {
        // Envia o pedido novamente com o MESMO ID. A Plugnotas entende que é um reprocessamento.
        const res = await vendaService.emitirNfce(pedido.id, pedido.clienteCpf || pedido.cliente?.cpf);
        
        if (res.sucesso || res.success) {
            toast.success("Nota enviada para reprocessamento com sucesso!");
            setPedido(prev => ({
                ...prev,
                fiscal: {
                    ...prev.fiscal,
                    status: 'PROCESSANDO',
                    idPlugNotas: res.idPlugNotas
                }
            }));
        } else {
            toast.error("Erro ao reprocessar: " + (res.error || res.message));
        }
    } catch (error) {
        toast.error("Erro de comunicação ao reprocessar a nota.");
    } finally {
        setNfceStatus('idle');
    }
  };

  // 2. ATUALIZAR STATUS MANUALMENTE
  const handleConsultarStatus = async () => {
    if (!pedido.fiscal?.idPlugNotas) return toast.error("A nota não possui ID de Integração.");
    setNfceStatus('loading');
    try {
        const res = await vendaService.consultarStatusNfce(pedido.id, pedido.fiscal.idPlugNotas);
        if (res.sucesso) {
            toast.success(`Status Sincronizado: ${res.statusAtual}`);
            setPedido(prev => ({
                ...prev, 
                fiscal: { 
                    ...prev.fiscal, 
                    status: res.statusAtual, 
                    pdf: res.pdf || prev.fiscal?.pdf, 
                    xml: res.xml || prev.fiscal?.xml,
                    motivoRejeicao: res.mensagem || prev.fiscal?.motivoRejeicao
                } 
            }));
        } else {
            toast.error("Erro ao consultar status: " + res.error);
        }
    } catch (error) {
        toast.error("Erro de conexão ao consultar a Sefaz.");
    } finally {
        setNfceStatus('idle');
    }
  };

  // 3. VISUALIZAR XML
  const handleVerXml = async () => {
    const idPlugNotas = pedido.fiscal?.idPlugNotas;
    if (!idPlugNotas) return toast.error("A nota não possui ID na PlugNotas.");

    setNfceStatus('loading');
    try {
        const res = await vendaService.baixarXmlNfce(idPlugNotas, pedido.id.slice(-6));
        if (!res.success) {
            toast.error("Erro ao baixar XML: " + res.error);
        }
    } catch (error) {
        toast.error("Erro de conexão ao tentar baixar o XML.");
    } finally {
        setNfceStatus('idle');
    }
  };

  // 4. VISUALIZAR PDF
  const handleVerPdf = async () => {
    const idPlugNotas = pedido.fiscal?.idPlugNotas;
    const linkSefaz = pedido.fiscal?.pdf;
    if (!idPlugNotas) return toast.error("A nota não possui ID na PlugNotas.");

    setNfceStatus('loading');
    try {
        const res = await vendaService.baixarPdfNfce(idPlugNotas, linkSefaz);
        if (!res.success) {
            toast.error("Erro ao gerar PDF: " + res.error);
        }
    } catch (error) {
        toast.error("Falha de comunicação ao tentar abrir o PDF.");
    } finally {
        setNfceStatus('idle');
    }
  };

  // 5. CANCELAR NOTA
  const handleCancelarNfce = async () => {
    if (!pedido.fiscal?.idPlugNotas) return;
    const justificativa = window.prompt("Digite o motivo do cancelamento da nota (MÍNIMO de 15 caracteres):");
    if (!justificativa) return;
    
    if (justificativa.trim().length < 15) {
        toast.warning("A justificativa deve ter pelo menos 15 caracteres para a SEFAZ aceitar.");
        return;
    }

    setNfceStatus('loading');
    try {
        const res = await vendaService.cancelarNfce(pedido.id, justificativa.trim());
        if (res.success) {
            toast.success("Solicitação de cancelamento enviada!");
            setPedido(prev => ({
                ...prev,
                status: 'cancelada',
                fiscal: { ...prev.fiscal, status: 'PROCESSANDO' }
            }));
        } else {
            toast.error("Erro ao cancelar: " + res.error);
        }
    } catch (e) {
        toast.error('Falha de comunicação ao tentar cancelar a nota.');
    } finally {
        setNfceStatus('idle');
    }
  };

  // Renderizador de Badge de Status de Preparo
  const renderStatusBadge = (status) => {
      const s = (status || '').toLowerCase();
      let colorClass = 'bg-gray-100 text-gray-600';
      if (s.includes('recebido') || s.includes('pendente')) colorClass = 'bg-yellow-100 text-yellow-800';
      else if (s.includes('preparo') || s.includes('aceito')) colorClass = 'bg-blue-100 text-blue-800';
      else if (s.includes('entrega') || s.includes('saiu')) colorClass = 'bg-orange-100 text-orange-800';
      else if (s.includes('finalizado') || s.includes('entregue')) colorClass = 'bg-green-100 text-green-800';
      else if (s.includes('cancelado') || s.includes('recusado')) colorClass = 'bg-red-100 text-red-800';

      return <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${colorClass}`}>{status || 'Desconhecido'}</span>;
  };

  if (authLoading || loadingPedido) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;
  if (error) return <div className="p-10 text-center text-red-500 font-bold">{error} <button onClick={() => navigate(-1)} className="ml-4 underline text-blue-500">Voltar</button></div>;
  if (!pedido) return null;

  const dataExibicao = getDate(pedido);
  const totalExibicao = pedido.totalFinal ?? pedido.total ?? 0;
  const clienteNome = pedido.clienteNome || pedido.cliente?.nome || 'Cliente';
  const clienteTel = pedido.cliente?.telefone || pedido.clienteTelefone || '';
  const tipo = pedido._isVenda || pedido.mesaId ? 'SALÃO' : 'DELIVERY';

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans text-gray-900">
      <DashboardHeader navigate={navigate} logout={logout} />

      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <button onClick={() => navigate('/master/pedidos')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                    <FaArrowLeft /> Voltar para Monitor
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">Pedido {formatId(pedido.id)}</h1>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tipo === 'SALÃO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {tipo}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                    <FaCalendarAlt className="text-gray-400" />
                    {dataExibicao ? format(dataExibicao, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : '--/--'}
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <button onClick={() => window.print()} className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-50 shadow-sm flex items-center gap-2 font-bold text-sm">
                    <FaPrint /> Imprimir
                </button>
                <div className="bg-black text-white px-5 py-2 rounded-xl shadow-lg flex flex-col items-end">
                    <span className="text-[10px] text-gray-400 uppercase font-bold">Total</span>
                    <span className="text-lg font-bold">R$ {totalExibicao.toFixed(2).replace('.', ',')}</span>
                </div>
            </div>
        </div>

        {/* CONTEÚDO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* COLUNA ESQUERDA */}
            <div className="space-y-6">
                
                {/* 🚀 CARD STATUS E AÇÕES */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-bold uppercase text-gray-400">Status Atual</h3>
                        {renderStatusBadge(pedido.status)}
                    </div>
                    
                    {/* Botões de Ação */}
                    <div className="space-y-2 pt-2 border-t border-gray-50">
                        <p className="text-xs font-bold text-gray-400 uppercase mb-2">Ações Rápidas</p>
                        
                        {pedido.status !== 'cancelado' && pedido.status !== 'finalizado' && (
                            <>
                                {pedido.status === 'recebido' && (
                                    <button 
                                        onClick={() => handleStatusChange('preparo')} 
                                        disabled={updating}
                                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2"
                                    >
                                        <FaCheck /> Aceitar / Preparar
                                    </button>
                                )}
                                
                                {pedido.status === 'preparo' && (
                                    <button 
                                        onClick={() => handleStatusChange(tipo === 'SALÃO' ? 'finalizado' : 'em_entrega')} 
                                        disabled={updating}
                                        className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 transition-colors flex justify-center items-center gap-2"
                                    >
                                        <FaMotorcycle /> {tipo === 'SALÃO' ? 'Finalizar' : 'Saiu para Entrega'}
                                    </button>
                                )}

                                {pedido.status === 'em_entrega' && (
                                    <button 
                                        onClick={() => handleStatusChange('finalizado')} 
                                        disabled={updating}
                                        className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors flex justify-center items-center gap-2"
                                    >
                                        <FaCheck /> Confirmar Entrega
                                    </button>
                                )}

                                <button 
                                    onClick={() => handleStatusChange('cancelado')} 
                                    disabled={updating}
                                    className="w-full py-2 bg-white border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors flex justify-center items-center gap-2"
                                >
                                    <FaBan /> Cancelar Pedido
                                </button>
                            </>
                        )}

                        {pedido.status === 'cancelado' && (
                            <div className="text-center text-red-500 text-xs font-bold py-2">
                                Pedido Cancelado
                            </div>
                        )}
                        {pedido.status === 'finalizado' && (
                            <div className="text-center text-green-600 text-xs font-bold py-2">
                                Pedido Concluído
                            </div>
                        )}
                    </div>
                </div>

                {/* Card Cliente */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2">
                        <FaUser /> Cliente
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-sm font-bold text-gray-900">{clienteNome}</p>
                            {pedido.mesaNumero && <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded">Mesa {pedido.mesaNumero}</span>}
                        </div>
                        {clienteTel && (
                            <a href={`https://wa.me/55${clienteTel.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 hover:text-green-700 text-sm font-semibold bg-green-50 p-2 rounded-lg transition-colors">
                                <FaWhatsapp /> {clienteTel}
                            </a>
                        )}
                    </div>
                </div>

                {/* Card Pagamento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2">
                        <FaMoneyBillWave /> Pagamento
                    </h3>
                    <p className="font-bold text-gray-900 text-sm uppercase">{pedido.metodoPagamento || pedido.formaPagamento || 'Não informado'}</p>
                    {pedido.trocoPara && <p className="text-xs text-gray-500 mt-1">Troco para: R$ {pedido.trocoPara}</p>}
                </div>

                {/* 🔥 NOVO: Card Fiscal (NFC-e) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2">
                        <FaFileInvoice /> Área Fiscal (NFC-e)
                    </h3>
                    
                    {/* Status da Nota na Sefaz */}
                    <div className="mb-4">
                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Status da Sefaz:</p>
                        {pedido.fiscal?.status ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                                pedido.fiscal.status === 'AUTORIZADA' || pedido.fiscal.status === 'CONCLUIDO' ? 'bg-green-100 text-green-700' : 
                                pedido.fiscal.status === 'REJEITADO' || pedido.fiscal.status === 'REJEITADA' || pedido.fiscal.status === 'ERRO' ? 'bg-red-100 text-red-700' : 
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                                {pedido.fiscal.status}
                            </span>
                        ) : (
                            <span className="text-sm font-medium text-gray-500">Não emitida</span>
                        )}
                        
                        {/* Motivo de Rejeição */}
                        {pedido.fiscal?.motivoRejeicao && (
                            <div className="mt-2 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg font-medium leading-relaxed">
                                ⚠️ <b>Motivo:</b> {pedido.fiscal.motivoRejeicao}
                            </div>
                        )}
                    </div>

{/* Botões de Ações Fiscais */}
                    <div className="flex flex-col gap-2 border-t border-gray-50 pt-4">
                        
                        {/* Se não foi emitida, ou se foi rejeitada/erro, permite Emitir/Reprocessar */}
                        {(!pedido.fiscal || pedido.fiscal.status === 'REJEITADO' || pedido.fiscal.status === 'REJEITADA' || pedido.fiscal.status === 'ERRO') && (
                            <button 
                                onClick={handleReprocessarNfce}
                                disabled={nfceStatus === 'loading'}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                {nfceStatus === 'loading' ? 'Processando...' : (pedido.fiscal ? '🔄 Corrigir e Reenviar' : '🧾 Emitir NFC-e')}
                            </button>
                        )}

                        {/* Se estiver PROCESSANDO, permite atualizar o status manualmente */}
                        {(pedido.fiscal?.status === 'PROCESSANDO') && (
                            <button 
                                onClick={handleConsultarStatus}
                                disabled={nfceStatus === 'loading'}
                                className="w-full py-2 bg-yellow-500 text-white rounded-lg text-sm font-bold hover:bg-yellow-600 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                            >
                                {nfceStatus === 'loading' ? 'Consultando...' : '🔄 Sincronizar Sefaz'}
                            </button>
                        )}

                        {/* Se foi Autorizada, permite Baixar PDF/XML e Cancelar */}
                        {(pedido.fiscal?.status === 'AUTORIZADA' || pedido.fiscal?.status === 'CONCLUIDO') && (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={handleVerPdf} 
                                        disabled={nfceStatus === 'loading'}
                                        className="py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex justify-center"
                                    >
                                        📄 PDF
                                    </button>
                                    <button 
                                        onClick={handleVerXml} 
                                        disabled={nfceStatus === 'loading'}
                                        className="py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex justify-center"
                                    >
                                        {'</>'} XML
                                    </button>
                                </div>
                                <button 
                                    onClick={handleCancelarNfce} 
                                    disabled={nfceStatus === 'loading'}
                                    className="w-full py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors mt-1 disabled:opacity-70"
                                >
                                    Cancelar Nota (NFC-e)
                                </button>
                            </>
                        )}

                        {/* Se foi Rejeitada, permite ver o XML do retorno para analisar o erro bruto */}
                        {(pedido.fiscal?.status === 'REJEITADO' || pedido.fiscal?.status === 'REJEITADA') && pedido.fiscal?.idPlugNotas && (
                            <button 
                                onClick={handleVerXml} 
                                disabled={nfceStatus === 'loading'}
                                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
                            >
                                {'</>'} Ver XML de Retorno (Sefaz)
                            </button>
                        )}

                        {/* 🔥 NOVO: Se foi CANCELADA, exibe o botão para recuperar o XML do cancelamento */}
                        {(pedido.fiscal?.status === 'CANCELADO' || pedido.fiscal?.status === 'CANCELADA') && pedido.fiscal?.idPlugNotas && (
                            <button 
                                onClick={handleVerXml} 
                                disabled={nfceStatus === 'loading'}
                                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors mt-1 flex justify-center gap-2"
                            >
                                {'</>'} Baixar XML de Cancelamento
                            </button>
                        )}
                    </div>
                </div>

            </div>

            {/* COLUNA DIREITA: ITENS */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full flex flex-col">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <FaUtensils className="text-yellow-500" /> Itens
                        </h3>
                        <span className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-bold text-gray-500">{pedido.itens?.length || 0} itens</span>
                    </div>

                    <div className="flex-1 p-6 space-y-6">
                        {pedido.itens && pedido.itens.length > 0 ? (
                            pedido.itens.map((item, idx) => (
                                <div key={idx} className="flex gap-4 items-start">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center shrink-0">{item.quantidade}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <p className="font-bold text-gray-900 text-sm">{item.nome}</p>
                                            <p className="font-bold text-gray-900 text-sm">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</p>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                                            {item.variacaoSelecionada && <p className="text-gray-400">Var: <span className="text-gray-600">{item.variacaoSelecionada.nome}</span></p>}
                                            {iftem.adicionais?.length > 0 && (
                                                <div className="pl-2 border-l-2 border-gray-200 my-1">
                                                    {item.adicionais.map((add, i) => <p key={i}>+ {add.quantidade}x {add.nome}</p>)}
                                                </div>
                                            )}
                                            {item.observacoesItem && <p className="text-red-500 bg-red-50 p-1.5 rounded inline-block mt-1 font-medium">⚠️ {item.observacoesItem}</p>}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : <div className="text-center py-10 text-gray-400">Lista vazia.</div>}
                    </div>

                    {/* Totais */}
                    <div className="bg-gray-50 p-6 border-t border-gray-100 space-y-2">
                        <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>R$ {(pedido.subtotal || totalExibicao).toFixed(2).replace('.', ',')}</span></div>
                        {pedido.taxaEntrega > 0 && <div className="flex justify-between text-sm text-gray-500"><span>Taxa de Entrega</span><span>R$ {Number(pedido.taxaEntrega).toFixed(2).replace('.', ',')}</span></div>}
                        {pedido.desconto > 0 && <div className="flex justify-between text-sm text-green-600 font-medium"><span>Desconto</span><span>- R$ {Number(pedido.desconto).toFixed(2).replace('.', ',')}</span></div>}
                        <div className="flex justify-between text-xl font-bold text-gray-900 pt-4 border-t border-gray-200 mt-2"><span>Total</span><span>R$ {totalExibicao.toFixed(2).replace('.', ',')}</span></div>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}

export default PedidoDetalhesMaster;