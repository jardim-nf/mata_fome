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
import { auditLogger } from '../../utils/auditLogger'; // <--- IMPORTANTE: Importando o Logger
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
  FaBan
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
  const [updating, setUpdating] = useState(false); // Estado para loading de ação
  const [error, setError] = useState('');
  const [estabNome, setEstabNome] = useState('Carregando...');
  const [docRefPath, setDocRefPath] = useState(null); // Guardar o caminho exato do doc para update

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
        // Tenta extrair do path se não tiver no objeto
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

  // --- NOVA FUNÇÃO: ALTERAR STATUS + AUDIT LOG ---
  const handleStatusChange = async (newStatus) => {
    if (!window.confirm(`Tem certeza que deseja mudar o status para "${newStatus.toUpperCase()}"?`)) return;
    if (!docRefPath) return toast.error("Referência do pedido perdida.");

    setUpdating(true);
    try {
        const oldStatus = pedido.status;

        // 1. Atualiza no Firebase
        await updateDoc(docRefPath, { 
            status: newStatus,
            updatedAt: new Date()
        });

        // 2. Registra no Audit Log (Instrumentação)
        await auditLogger(
            'PEDIDO_STATUS_ALTERADO',
            { uid: currentUser.uid, email: currentUser.email, role: 'masterAdmin' }, // Quem
            { type: 'pedido', id: pedido.id, name: `Pedido ${formatId(pedido.id)}` }, // Onde
            { de: oldStatus, para: newStatus, estabelecimento: estabNome } // Detalhes
        );

        // 3. Atualiza estado local e avisa
        setPedido(prev => ({ ...prev, status: newStatus }));
        toast.success(`Status alterado para ${newStatus}`);

    } catch (err) {
        console.error("Erro ao atualizar:", err);
        toast.error("Erro ao atualizar status.");
    } finally {
        setUpdating(false);
    }
  };

  // Renderizador de Status
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

                {/* Card Loja */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-100 border border-yellow-200 flex items-center justify-center text-yellow-600">
                            <FaStore />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-bold uppercase">Loja</p>
                            <p className="text-sm font-bold text-gray-900 line-clamp-1">{estabNome}</p>
                        </div>
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

                {/* Card Entrega */}
                {tipo === 'DELIVERY' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2">
                            {pedido.tipoEntrega === 'retirada' ? <FaBoxOpen /> : <FaMotorcycle />} 
                            {pedido.tipoEntrega === 'retirada' ? 'Retirada' : 'Entrega'}
                        </h3>
                        {pedido.enderecoEntrega ? (
                            <div className="text-sm text-gray-600 space-y-1">
                                <p className="font-medium text-gray-900">{pedido.enderecoEntrega.rua}, {pedido.enderecoEntrega.numero}</p>
                                <p>{pedido.enderecoEntrega.bairro} - {pedido.enderecoEntrega.cidade}</p>
                                {pedido.enderecoEntrega.complemento && <p className="text-xs text-gray-400">Comp: {pedido.enderecoEntrega.complemento}</p>}
                            </div>
                        ) : <p className="text-sm text-gray-500">Retirada no balcão.</p>}
                    </div>
                )}

                {/* Card Pagamento */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold uppercase text-gray-400 mb-4 flex items-center gap-2">
                        <FaMoneyBillWave /> Pagamento
                    </h3>
                    <p className="font-bold text-gray-900 text-sm uppercase">{pedido.metodoPagamento || pedido.formaPagamento || 'Não informado'}</p>
                    {pedido.trocoPara && <p className="text-xs text-gray-500 mt-1">Troco para: R$ {pedido.trocoPara}</p>}
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
                                            {item.adicionais?.length > 0 && (
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