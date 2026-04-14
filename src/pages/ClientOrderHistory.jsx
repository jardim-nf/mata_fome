import React, { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';

import { collection, query, where, orderBy, getDocs, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';

// Ícones
import { 
  IoArrowBack, 
  IoReceipt, 
  IoTime,
  IoCheckmarkCircle,
  IoBicycle,
  IoRestaurant,
  IoRefresh,
  IoEye,
  IoCloseCircle,
  IoLocation,
  IoCard,
  IoPricetag,
  IoStorefront,
  IoWalletOutline,
  IoCopyOutline,
  IoCameraOutline
} from 'react-icons/io5';

function ClientOrderHistory() {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [estabelecimentos, setEstabelecimentos] = useState({});
  const [saldoTotal, setSaldoTotal] = useState(0);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      toast.warn('Você precisa estar logado para ver seu histórico de pedidos.');
      navigate('/');
      return;
    }

    if (currentUser) {
      fetchOrders();
    }
  }, [currentUser, authLoading, navigate]);

  // 🔥 BUSCAR PEDIDOS DO CLIENTE
  const fetchOrders = async () => {
    setLoadingOrders(true);
    setError('');
    try {
      // 🔥 BUSCAR INFORMAÇÕES DO USUÁRIO PRIMEIRO PARA OBTER O TELEFONE (E BUSCAR PEDIDOS DO WHATSAPP)
      const userDoc = await getDoc(doc(db, 'usuarios', currentUser.uid));
      let telefoneFormatado = '';
      if (userDoc.exists()) {
        const t = userDoc.data().telefone || currentUser.phoneNumber || '';
        telefoneFormatado = t.replace(/\D/g, '');
      }

      // Buscar pedidos delivery do usuário por UID (feitos no Web App)
      const pedidosQueryId = query(
        collectionGroup(db, 'pedidos'),
        where('cliente.userId', '==', currentUser.uid)
      );
      const querySnapshotId = await getDocs(pedidosQueryId);
      let fetchedOrders = querySnapshotId.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        criadoEm: doc.data().createdAt || doc.data().criadoEm,
        tipo: 'delivery',
        origem: 'pedidos'
      }));

      // Buscar pedidos delivery do usuário por TELEFONE (feitos no WhatsApp via Bot)
      if (telefoneFormatado) {
         try {
           const pedidosQueryTel = query(
             collectionGroup(db, 'pedidos'),
             where('cliente.telefone', '==', telefoneFormatado)
           );
           const querySnapshotTel = await getDocs(pedidosQueryTel);
           const telOrders = querySnapshotTel.docs.map(doc => ({
             id: doc.id,
             ...doc.data(),
             criadoEm: doc.data().createdAt || doc.data().criadoEm,
             tipo: 'delivery',
             origem: 'pedidos'
           }));
           
           // Mesclar e remover duplicados (caso o pedido tenha os 2 campos)
           const existingIds = new Set(fetchedOrders.map(o => o.id));
           for (const order of telOrders) {
              if (!existingIds.has(order.id)) {
                 fetchedOrders.push(order);
              }
           }
         } catch (errTel) {
           console.log("Aviso: Falha ao buscar pedidos por telefone. É provável que o Firebase não possua o índice composite. Criar no console se necessário.", errTel);
         }
      }

      // 🔥 BUSCAR VENDAS DE MESA DO CLIENTE
      let vendasOrders = [];
      try {
        // Esta parte depende da sua estrutura de vendas de mesa
        // Ajuste conforme sua estrutura real
        const vendasQuery = query(
          collection(db, 'vendas'),
          where('clienteId', '==', currentUser.uid),
          orderBy('dataFechamento', 'desc')
        );
        const vendasSnapshot = await getDocs(vendasQuery);
        
        vendasOrders = vendasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          tipo: 'mesa',
          origem: 'vendas',
          criadoEm: doc.data().dataFechamento || doc.data().criadoEm || doc.data().createdAt || new Date()
        }));
      } catch (vendasError) {
        console.log("Vendas de mesa não disponíveis:", vendasError);
      }

      const allOrders = [...fetchedOrders, ...vendasOrders]
        .sort((a, b) => {
          const dateA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm);
          const dateB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm);
          return dateB - dateA;
        });

      const estabelecimentosMap = {};
      const estabelecimentoIds = [...new Set(allOrders.map(order => order.estabelecimentoId).filter(Boolean))];
      
      // Construir lista única de telefones deste cliente (baseado no perfil e nos pedidos)
      const telefonesCliente = new Set();
      if (telefoneFormatado) telefonesCliente.add(telefoneFormatado);
      allOrders.forEach(o => {
          const t = o.cliente?.telefone || o.clienteTelefone || '';
          const tf = t.replace(/\D/g, '');
          if (tf) telefonesCliente.add(tf);
      });

      let totalSaldoCarteira = 0;
      
      for (const estabelecimentoId of estabelecimentoIds) {
        try {
          const estabelecimentoDoc = await getDoc(doc(db, 'estabelecimentos', estabelecimentoId));
          if (estabelecimentoDoc.exists()) {
            estabelecimentosMap[estabelecimentoId] = estabelecimentoDoc.data();
            
            // BUSCAR SALDO DA CARTEIRA DIGITAL NESTE ESTABELECIMENTO
            let saldoLocal = 0;
            
            // 1. Tenta buscar pelo UID 
            const clienteRefId = doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', currentUser.uid);
            const clienteDocId = await getDoc(clienteRefId);
            if (clienteDocId.exists()) {
               saldoLocal += (Number(clienteDocId.data().saldoCashback) || Number(clienteDocId.data().saldoCarteira) || 0);
            }

            // 2. Busca pelos Telefones Únicos (já que o bot e o backend criam pelo telefone)
            for (const tel of telefonesCliente) {
               if (tel !== currentUser.uid) {
                 const clienteRefTel = doc(db, 'estabelecimentos', estabelecimentoId, 'clientes', tel);
                 const clienteDocTel = await getDoc(clienteRefTel);
                 if (clienteDocTel.exists()) {
                     saldoLocal += (Number(clienteDocTel.data().saldoCashback) || Number(clienteDocTel.data().saldoCarteira) || 0);
                 }
               }
            }

            totalSaldoCarteira += saldoLocal;
          }
        } catch (err) {
          console.log(`Erro ao buscar estabelecimento ${estabelecimentoId}:`, err);
        }
      }

      setEstabelecimentos(estabelecimentosMap);
      setSaldoTotal(totalSaldoCarteira);
      setOrders(allOrders);

    } catch (err) {
      console.error("Erro ao buscar histórico de pedidos:", err);
      setError("Não foi possível carregar seu histórico de pedidos.");
      toast.error("Erro ao carregar histórico de pedidos. Tente novamente.");
    } finally {
      setLoadingOrders(false);
    }
  };

  // 🔥 FILTRAR PEDIDOS POR STATUS
  const filteredOrders = orders.filter(order => {
    if (filterStatus === 'todos') return true;
    return order.status === filterStatus;
  });

  // 🔥 CALCULAR TEMPO DECORRIDO
  const getTimeAgo = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const orderDate = date.toDate ? date.toDate() : new Date(date);
    const diffMs = now - orderDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / (3600000 * 24));

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins < 60) return `${diffMins} min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    
    return format(orderDate, 'dd/MM/yyyy');
  };

  // 🔥 OBTER ÍCONE DO STATUS
  const getStatusIcon = (status) => {
    switch (status) {
      case 'finalizado':
      case 'entregue':
        return <IoCheckmarkCircle className="text-green-500" />;
      case 'em_entrega':
        return <IoBicycle className="text-orange-500" />;
      case 'em_preparo':
      case 'preparando':
        return <IoRestaurant className="text-blue-500" />;
      case 'cancelado':
        return <IoCloseCircle className="text-red-500" />;
      default:
        return <IoTime className="text-gray-500" />;
    }
  };

  // 🔥 TRADUZIR STATUS
  const translateStatus = (status) => {
    const statusMap = {
      'finalizado': 'Finalizado',
      'entregue': 'Entregue',
      'em_entrega': 'Em Entrega',
      'em_preparo': 'Em Preparo',
      'preparando': 'Preparando',
      'pendente': 'Pendente',
      'cancelado': 'Cancelado',
      'finalizada': 'Finalizada'
    };
    return statusMap[status] || status;
  };

  // 🔥 OBTER NOME DO ESTABELECIMENTO
  const getEstabelecimentoNome = (estabelecimentoId) => {
    return estabelecimentos[estabelecimentoId]?.nome || 'Estabelecimento';
  };

  // 🔥 OBTER TIPO DE PEDIDO
  const getTipoPedido = (order) => {
    if (order.tipo === 'mesa') return 'Consumo no Local';
    if (order.tipo === 'delivery') return 'Delivery';
    if (order.tipo === 'retirada') return 'Retirada';
    return 'Pedido';
  };

  // 🔥 OBTER ÍCONE DO TIPO
  const getTipoIcon = (order) => {
    if (order.tipo === 'mesa') return <IoRestaurant className="text-purple-500" />;
    if (order.tipo === 'delivery') return <IoBicycle className="text-blue-500" />;
    return <IoStorefront className="text-green-500" />;
  };

  if (authLoading || loadingOrders) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
        <p className="text-lg text-gray-600">Carregando histórico de pedidos...</p>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <BackButton />
          
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <IoReceipt className="text-red-600" />
            <span>Meu Histórico de Pedidos</span>
          </h1>
          
          <div className="w-32"></div>
        </div>

        {/* CARTEIRA DIGITAL */}
        {(saldoTotal > 0 || orders.some(o => o.cashbackGanho > 0 || o.cashbackUsado > 0)) && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl shadow-sm p-6 mb-6 text-white flex justify-between items-center relative overflow-hidden">
             <div className="absolute -right-8 -top-8 text-white opacity-10 text-9xl">
               <IoWalletOutline />
             </div>
             <div className="relative z-10 w-full flex flex-col md:flex-row justify-between items-start md:items-center">
                 <div>
                    <h2 className="text-3xl lg:text-4xl font-black text-white flex items-center gap-3">
                       <IoWalletOutline /> R$ {saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                    <p className="text-sm mt-1 font-medium text-emerald-50">Saldo disponível em Cashback no App</p>
                 </div>
                 <div className="mt-4 md:mt-0 bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                   <p className="text-sm font-bold text-white uppercase tracking-wider">Cashback</p>
                 </div>
             </div>
          </div>
        )}

        {/* FILTROS E ESTATÍSTICAS */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">Filtrar:</span>
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="todos">Todos os Pedidos</option>
                <option value="entregue">Entregues</option>
                <option value="finalizado">Finalizados</option>
                <option value="em_entrega">Em Entrega</option>
                <option value="em_preparo">Em Preparo</option>
                <option value="pendente">Pendentes</option>
                <option value="cancelado">Cancelados</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <span className="text-gray-600">
                <strong>{filteredOrders.length}</strong> {filteredOrders.length === 1 ? 'pedido' : 'pedidos'} encontrados
              </span>
              <button
                onClick={fetchOrders}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 font-medium"
              >
                <IoRefresh className="text-lg" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium mb-4">{error}</p>
            <Link to="/" className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition">
              Voltar para Home
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <IoReceipt className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {filterStatus === 'todos' ? 'Nenhum pedido encontrado' : 'Nenhum pedido com este status'}
            </h3>
            <p className="text-gray-500 mb-6">
              {filterStatus === 'todos' 
                ? 'Você ainda não fez nenhum pedido.' 
                : 'Não há pedidos com o status selecionado.'
              }
            </p>
            <Link 
              to="/estabelecimentos" 
              className="bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition inline-flex items-center space-x-2"
            >
              <IoStorefront />
              <span>Ver Estabelecimentos</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  {/* INFORMAÇÕES PRINCIPAIS */}
                  <div className="flex-1">
                    {/* CABEÇALHO DO PEDIDO */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Pedido #{order.id.substring(0, 8).toUpperCase()}
                          </h3>
                          <div className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-full">
                            {getTipoIcon(order)}
                            <span className="text-xs font-medium text-gray-700">
                              {getTipoPedido(order)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-1">
                          <span className="flex items-center space-x-1">
                            <IoStorefront className="text-gray-400" />
                            <span>{getEstabelecimentoNome(order.estabelecimentoId)}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <IoTime className="text-gray-400" />
                            <span>
                              {order.criadoEm ? format(order.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'Data não disponível'}
                            </span>
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-400">
                          {getTimeAgo(order.criadoEm)}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100">
                        {getStatusIcon(order.status)}
                        <span className={`text-sm font-medium ${
                          order.status === 'finalizado' || order.status === 'entregue' ? 'text-green-700' :
                          order.status === 'em_entrega' ? 'text-orange-700' :
                          order.status === 'em_preparo' ? 'text-blue-700' :
                          order.status === 'cancelado' ? 'text-red-700' :
                          'text-gray-700'
                        }`}>
                          {translateStatus(order.status)}
                        </span>
                      </div>
                    </div>

                    {/* ITENS DO PEDIDO */}
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Itens do pedido:</p>
                      <div className="space-y-2">
                        {order.itens?.map((item, index) => (
                          <div key={index} className="flex justify-between items-start text-sm">
                            <div>
                              <span className="text-gray-900 font-medium">
                                {item.quantidade}x {item.nome}
                              </span>
                              {item.observacoes && (
                                <p className="text-gray-500 text-xs mt-1">{item.observacoes}</p>
                              )}
                              {item.adicionais && item.adicionais.length > 0 && (
                                <p className="text-gray-500 text-xs mt-1">
                                  Adicionais: {item.adicionais.map(adicional => adicional.nome).join(', ')}
                                </p>
                              )}
                            </div>
                            <span className="text-gray-900 font-medium whitespace-nowrap ml-4">
                              R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* INFORMAÇÕES DE PAGAMENTO E ENTREGA */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {order.formaPagamento && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <IoCard className="text-gray-400" />
                          <span>
                            <strong>Pagamento:</strong> {order.formaPagamento}
                          </span>
                        </div>
                      )}
                      
                      {order.enderecoEntrega && (
                        <div className="flex items-start space-x-2 text-sm text-gray-600">
                          <IoLocation className="text-gray-400 mt-0.5" />
                          <span>
                            <strong>Entrega:</strong> {order.enderecoEntrega}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* RESUMO FINANCEIRO */}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="text-gray-900">
                            R$ {order.itens?.reduce((acc, item) => acc + (item.preco * item.quantidade), 0).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        
                        {order.taxaEntrega > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Taxa de entrega:</span>
                            <span className="text-gray-900">R$ {order.taxaEntrega?.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                        
                        {order.cupomAplicado && order.cupomAplicado.descontoCalculado > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600 flex items-center space-x-1">
                              <IoPricetag className="text-green-500" />
                              <span>Desconto ({order.cupomAplicado.codigo}):</span>
                            </span>
                            <span className="text-green-600">- R$ {order.cupomAplicado.descontoCalculado?.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}

                        {order.cashbackUsado > 0 && (
                          <div className="flex justify-between text-sm pt-1">
                            <span className="text-emerald-600 font-bold flex items-center space-x-1">
                              <IoWalletOutline className="text-emerald-500" />
                              <span>Cashback Resgatado:</span>
                            </span>
                            <span className="text-emerald-600 font-bold">- R$ {order.cashbackUsado?.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-gray-200">
                          <span className="text-gray-900">Total:</span>
                          <span className="text-red-600">R$ {order.totalFinal?.toFixed(2).replace('.', ',')}</span>
                        </div>

                        {order.cashbackGanho > 0 && order.status === 'finalizado' && (
                          <div className="flex justify-between text-sm mt-3 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                            <span className="text-emerald-700 font-bold flex items-center space-x-1 pl-1">
                              <IoCheckmarkCircle className="text-emerald-600" />
                              <span>Cashback Ganho nesta compra:</span>
                            </span>
                            <span className="text-emerald-700 font-black">+ R$ {order.cashbackGanho?.toFixed(2).replace('.', ',')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* FOTOS E GORJETAS (LOGÍSTICA PREMIUM) */}
                    {(order.status === 'em_entrega' || order.status === 'finalizado') && (order.motoboyNome || order.fotoComprovanteUrl) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                           {order.motoboyChavePix && (
                               <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3">
                                   <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
                                            <IoBicycle size={20} />
                                       </div>
                                       <div className="flex-1">
                                           <p className="text-sm font-bold text-gray-900">Gorjeta para {order.motoboyNome}</p>
                                           <p className="text-xs text-gray-600 leading-tight mt-0.5">Gostou da entrega? Envie um valor pro motoboy no PIX!</p>
                                        </div>
                                   </div>
                                   <button onClick={() => { navigator.clipboard.writeText(order.motoboyChavePix); toast.success('Chave copiada!'); }} className="mt-3 w-full flex items-center justify-center gap-2 bg-white border border-emerald-300 text-emerald-700 py-2 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors">
                                        <IoCopyOutline size={18} /> Copiar Chave ({order.motoboyChavePix})
                                   </button>
                               </div>
                           )}
                           
                           {order.fotoComprovanteUrl && (
                               <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                   <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1"><IoCameraOutline /> Comprovante de Entrega na Porta</p>
                                   <img src={order.fotoComprovanteUrl} alt="Comprovante" className="w-full h-32 object-cover rounded-lg cursor-pointer" onClick={() => window.open(order.fotoComprovanteUrl, '_blank')} />
                               </div>
                           )}
                        </div>
                    )}
                  </div>

                  {/* AÇÕES */}
                  <div className="flex lg:flex-col gap-2 lg:space-y-2 mt-4">
                    {order.status !== 'cancelado' && order.estabelecimentoId && (
                      <button
                        onClick={() => {
                          const itensParaRepetir = (order.itens || []).map(item => ({
                            id: item.produtoIdOriginal || item.id,
                            nomeOriginal: item.nome.split(' - ')[0].split(' (+')[0].trim(),
                            nome: item.nome,
                            preco: item.preco,
                            quantidade: item.quantidade || item.qtd || 1,
                            observacao: item.observacoes || item.observacao || '',
                            variacaoSelecionada: item.variacao || item.variacaoSelecionada || null,
                            adicionaisSelecionados: item.adicionais || item.adicionaisSelecionados || []
                          }));
                          localStorage.setItem('ideafood_repetir_pedido', JSON.stringify(itensParaRepetir));
                          const slug = estabelecimentos[order.estabelecimentoId]?.slug || order.estabelecimentoId;
                          toast.info('🔁 Preparando seu carrinho...');
                          navigate(`/cardapio/${slug}`);
                        }}
                        className="flex items-center justify-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium transition flex-1"
                      >
                        <IoRefresh className="text-lg" />
                        <span>Pedir de Novo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ClientOrderHistory;