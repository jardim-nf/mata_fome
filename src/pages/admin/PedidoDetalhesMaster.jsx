import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  doc, 
  getDoc, 
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

// --- HELPERS PARA EVITAR ERROS DE DADOS ---
const safeString = (val) => {
  if (!val) return 'N/A';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val.nome || val.name || 'Cliente';
  return String(val);
};

const getDate = (data) => {
  if (!data) return null;
  // Tenta todos os campos possíveis de data
  const t = data.dataPedido || data.criadoEm || data.createdAt || data.adicionadoEm || data.updatedAt;
  if (!t) return null;
  if (t.toDate) return t.toDate();
  return new Date(t);
};

function PedidoDetalhesMaster() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isMasterAdmin, loading: authLoading } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [loadingPedido, setLoadingPedido] = useState(true);
  const [error, setError] = useState('');
  const [estabNome, setEstabNome] = useState('Carregando...');

  useEffect(() => {
    if (authLoading) return;
    if (!isMasterAdmin) {
      toast.error('Acesso negado.');
      navigate('/master-dashboard');
      return;
    }

    const fetchPedido = async () => {
      try {
        setLoadingPedido(true);
        setError('');
        let foundData = null;
        let foundEstabId = null;

        // --- ESTRATÉGIA DE BUSCA GLOBAL (Procura em todo lugar) ---

        // 1. Tenta pegar direto na coleção 'pedidos' (Root)
        let docSnap = await getDoc(doc(db, 'pedidos', id));
        if (docSnap.exists()) {
           foundData = { id: docSnap.id, ...docSnap.data() };
        }

        // 2. Se não achou, tenta na coleção 'vendas' (Root)
        if (!foundData) {
           docSnap = await getDoc(doc(db, 'vendas', id));
           if (docSnap.exists()) {
              foundData = { id: docSnap.id, ...docSnap.data(), _isVenda: true };
           }
        }

        // 3. Se ainda não achou, faz uma VARREDURA GLOBAL (Sub-coleções)
        // Procura em qualquer coleção 'pedidos' ou 'vendas' que tenha esse ID
        if (!foundData) {
           // Busca onde o campo 'id' é igual ao ID da URL
           const qPed = query(collectionGroup(db, 'pedidos'), where('id', '==', id));
           const snapPed = await getDocs(qPed);
           
           if (!snapPed.empty) {
              foundData = { id: snapPed.docs[0].id, ...snapPed.docs[0].data() };
           } else {
              // Tenta em vendas global
              const qVen = query(collectionGroup(db, 'vendas'), where('id', '==', id));
              const snapVen = await getDocs(qVen);
              if (!snapVen.empty) {
                 foundData = { id: snapVen.docs[0].id, ...snapVen.docs[0].data(), _isVenda: true };
              }
           }
        }

        if (!foundData) {
           throw new Error('Pedido não encontrado em nenhuma coleção.');
        }

        setPedido(foundData);
        foundEstabId = foundData.estabelecimentoId;

        // --- BUSCA NOME DO ESTABELECIMENTO ---
        if (foundEstabId) {
          try {
            const estabSnap = await getDoc(doc(db, 'estabelecimentos', foundEstabId));
            if (estabSnap.exists()) setEstabNome(estabSnap.data().nome);
            else setEstabNome('Estabelecimento não encontrado');
          } catch { setEstabNome('Erro ao buscar estab.'); }
        } else {
          setEstabNome('Estabelecimento N/A');
        }

      } catch (err) {
        console.error("Erro detalhes:", err);
        setError("Não foi possível carregar este pedido. Ele pode ter sido excluído ou você não tem permissão.");
      } finally {
        setLoadingPedido(false);
      }
    };

    if (id) fetchPedido();
  }, [id, isMasterAdmin, authLoading, navigate]);

  if (authLoading || loadingPedido) return (
    <div className="flex justify-center items-center h-screen bg-gray-50">
       <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-yellow-500"></div>
    </div>
  );

  if (error) return (
    <div className="p-10 text-center">
       <div className="text-red-500 text-xl font-bold mb-4">{error}</div>
       <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-800 text-white rounded">Voltar</button>
    </div>
  );

  if (!pedido) return null;

  // Normalização de Dados para Exibição
  const dataExibicao = getDate(pedido);
  const totalExibicao = pedido.totalFinal ?? pedido.total ?? 0;
  const clienteNome = safeString(pedido.clienteNome || pedido.cliente);
  const clienteTel = pedido.cliente?.telefone || pedido.clienteTelefone || 'N/A';
  const tipo = pedido._isVenda || pedido.mesaId ? 'SALÃO / MESA' : 'DELIVERY';

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
           <div>
             <div className="flex items-center gap-3 mb-1">
                <Link to="/master/pedidos" className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-bold uppercase tracking-wider">
                  ← Voltar
                </Link>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase text-gray-900 ${tipo.includes('SALÃO') ? 'bg-blue-200' : 'bg-yellow-400'}`}>
                  {tipo}
                </span>
             </div>
             <h1 className="text-3xl font-bold">Pedido #{pedido.id.substring(0,8)}</h1>
             <p className="text-gray-400 text-sm mt-1">
               {dataExibicao ? format(dataExibicao, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : 'Data desconhecida'}
             </p>
           </div>
           <div className="text-right hidden sm:block">
             <p className="text-xs text-gray-400 uppercase tracking-widest">Valor Total</p>
             <p className="text-4xl font-bold text-green-400">R$ {totalExibicao.toFixed(2).replace('.', ',')}</p>
           </div>
        </div>

        {/* Status Bar */}
        <div className="bg-gray-50 border-b p-4 flex flex-wrap gap-4 items-center justify-between">
           <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-500 uppercase">Status Atual:</span>
              <span className={`px-4 py-1 rounded-full text-sm font-bold uppercase shadow-sm ${
                  pedido.status === 'recebido' ? 'bg-red-100 text-red-600' :
                  pedido.status === 'preparo' ? 'bg-yellow-100 text-yellow-600' :
                  pedido.status === 'em_entrega' ? 'bg-orange-100 text-orange-600' :
                  pedido.status === 'finalizado' ? 'bg-green-100 text-green-600' :
                  'bg-gray-200 text-gray-600'
              }`}>
                {pedido.status || 'DESCONHECIDO'}
              </span>
           </div>
           <div className="text-sm font-bold text-gray-600">
              Estabelecimento: <span className="text-gray-900">{estabNome}</span>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
          
          {/* Coluna 1: Dados do Cliente e Entrega */}
          <div className="space-y-6">
             <div className="bg-white border rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                   👤 Cliente
                </h2>
                <div className="space-y-2 text-sm text-gray-600">
                   <p><strong className="text-gray-900">Nome:</strong> {clienteNome}</p>
                   <p><strong className="text-gray-900">Telefone:</strong> {clienteTel}</p>
                   {pedido.mesaNumero && (
                     <p className="mt-2 text-blue-600 font-bold bg-blue-50 p-2 rounded text-center">
                        MESA {pedido.mesaNumero}
                     </p>
                   )}
                </div>
             </div>

             {(pedido.tipoEntrega === 'entrega' || pedido.enderecoEntrega) && (
               <div className="bg-white border rounded-xl p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3 flex items-center gap-2">
                     📍 Entrega
                  </h2>
                  <div className="space-y-1 text-sm text-gray-600">
                     {pedido.enderecoEntrega ? (
                        <>
                          <p>{pedido.enderecoEntrega.rua}, {pedido.enderecoEntrega.numero}</p>
                          <p>{pedido.enderecoEntrega.bairro} - {pedido.enderecoEntrega.cidade}</p>
                          {pedido.enderecoEntrega.complemento && <p className="text-xs text-gray-500">Comp: {pedido.enderecoEntrega.complemento}</p>}
                          {pedido.enderecoEntrega.referencia && <p className="text-xs text-gray-500">Ref: {pedido.enderecoEntrega.referencia}</p>}
                        </>
                     ) : (
                        <p>Retirada no Balcão</p>
                     )}
                  </div>
               </div>
             )}
             
             <div className="bg-white border rounded-xl p-5 shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 border-b pb-2 mb-3">💳 Pagamento</h2>
                <p className="text-sm text-gray-600 uppercase font-bold">{pedido.metodoPagamento || pedido.formaPagamento || 'Não informado'}</p>
                {pedido.trocoPara && <p className="text-sm text-gray-500">Troco para: R$ {pedido.trocoPara}</p>}
             </div>
          </div>

          {/* Coluna 2: Itens */}
          <div>
             <div className="bg-gray-50 rounded-xl p-6 h-full border">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex justify-between items-center">
                   🛒 Itens do Pedido
                   <span className="text-xs font-normal bg-gray-200 px-2 py-1 rounded text-gray-600">{pedido.itens?.length || 0} itens</span>
                </h2>
                
                <div className="space-y-4">
                  {pedido.itens && pedido.itens.map((item, idx) => (
                    <div key={idx} className="flex gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                       <div className="bg-yellow-100 text-yellow-800 font-bold w-8 h-8 flex items-center justify-center rounded text-sm shrink-0">
                          {item.quantidade}x
                       </div>
                       <div className="flex-1">
                          <p className="font-bold text-gray-800 text-sm">{item.nome}</p>
                          {item.variacaoSelecionada && (
                             <p className="text-xs text-gray-500">Var: {item.variacaoSelecionada.nome}</p>
                          )}
                          {item.observacoesItem && (
                             <p className="text-xs text-red-400 mt-1 italic">Obs: {item.observacoesItem}</p>
                          )}
                          {item.adicionais && item.adicionais.length > 0 && (
                             <ul className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                                {item.adicionais.map((add, i) => (
                                   <li key={i}>+ {add.quantidade}x {add.nome}</li>
                                ))}
                             </ul>
                          )}
                       </div>
                       <div className="text-right font-bold text-gray-700 text-sm">
                          R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}
                       </div>
                    </div>
                  ))}

                  {(!pedido.itens || pedido.itens.length === 0) && (
                     <p className="text-center text-gray-400 py-10">Lista de itens vazia.</p>
                  )}
                </div>

                {/* Resumo Financeiro Mobile (Já que o header esconde em telas pequenas) */}
                <div className="mt-6 pt-4 border-t flex justify-between items-center sm:hidden">
                   <span className="font-bold text-gray-900 uppercase">Total</span>
                   <span className="font-bold text-2xl text-green-600">R$ {totalExibicao.toFixed(2).replace('.', ',')}</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PedidoDetalhesMaster;