// src/pages/admin/PedidoDetalhesMaster.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Caminho correto para firebase.js
import { useAuth } from '../../context/AuthContext'; // Caminho correto para AuthContext.jsx
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function PedidoDetalhesMaster() {
  const { id } = useParams(); // Pega o ID do pedido da URL
  const navigate = useNavigate();
  const { isMasterAdmin, loading: authLoading } = useAuth();

  const [pedido, setPedido] = useState(null);
  const [loadingPedido, setLoadingPedido] = useState(true);
  const [error, setError] = useState('');
  const [estabelecimentoNome, setEstabelecimentoNome] = useState('Carregando...');


  useEffect(() => {
    if (authLoading) return;
    if (!isMasterAdmin) {
      toast.error('Acesso negado.');
      navigate('/master-dashboard');
      return;
    }

    const fetchPedidoDetails = async () => {
      try {
        const docRef = doc(db, 'pedidos', id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          throw new Error('Pedido não encontrado.');
        }
        const pedidoData = docSnap.data();
        setPedido(pedidoData);

        // Buscar o nome do estabelecimento
        if (pedidoData.estabelecimentoId) {
            const estabRef = doc(db, 'estabelecimentos', pedidoData.estabelecimentoId);
            const estabSnap = await getDoc(estabRef);
            if (estabSnap.exists()) {
                setEstabelecimentoNome(estabSnap.data().nome);
            } else {
                setEstabelecimentoNome('Estabelecimento Desconhecido');
            }
        } else {
            setEstabelecimentoNome('N/A');
        }

      } catch (err) {
        console.error("Erro ao buscar detalhes do pedido:", err);
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoadingPedido(false);
      }
    };

    fetchPedidoDetails();
  }, [id, isMasterAdmin, authLoading, navigate]); // Adicionado estabelecimentoNome nas dependências

  if (authLoading || loadingPedido) return <div className="text-center p-8">Carregando detalhes do pedido...</div>;
  if (error) return <div className="text-center p-8 text-red-600">Erro: {error}</div>;
  if (!pedido) return <div className="text-center p-8">Pedido não disponível.</div>; // Caso não encontre mesmo sem erro explícito

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <Link to="/master/pedidos" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Voltar para Todos os Pedidos
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Detalhes do Pedido #{id.substring(0,8)}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações do Pedido */}
          <div>
            <h2 className="text-xl font-semibold text-slate-700 mb-3 border-b pb-2">Dados Gerais</h2>
            <p className="text-slate-600"><strong>Status:</strong> <span className={`font-medium ${
                pedido.status === 'recebido' ? 'text-red-600' :
                pedido.status === 'preparo' ? 'text-yellow-600' :
                pedido.status === 'em_entrega' ? 'text-orange-600' :
                pedido.status === 'finalizado' ? 'text-green-600' :
                'text-gray-600'
              }`}>{pedido.status.replace('_', ' ').charAt(0).toUpperCase() + pedido.status.replace('_', ' ').slice(1)}</span></p>
            <p className="text-slate-600"><strong>Total Final:</strong> R$ {pedido.totalFinal?.toFixed(2).replace('.', ',') || '0,00'}</p>
            <p className="text-slate-600"><strong>Método de Pagamento:</strong> {pedido.metodoPagamento || 'N/A'}</p>
            <p className="text-slate-600"><strong>Criado Em:</strong> {pedido.criadoEm?.toDate ? format(pedido.criadoEm.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</p>
            {pedido.observacoes && <p className="text-slate-600"><strong>Observações:</strong> {pedido.observacoes}</p>}
            {pedido.chavePix && <p className="text-slate-600"><strong>Chave PIX Usada:</strong> {pedido.chavePix}</p>}
            {/* Usando o estado carregado para o nome do estabelecimento */}
            <p className="text-slate-600"><strong>Estabelecimento:</strong> {estabelecimentoNome}</p>
          </div>

          {/* Informações do Cliente */}
          <div>
            <h2 className="text-xl font-semibold text-slate-700 mb-3 border-b pb-2">Dados do Cliente</h2>
            <p className="text-slate-600"><strong>Nome:</strong> {pedido.cliente?.nome || 'N/A'}</p>
            <p className="text-slate-600"><strong>Telefone:</strong> {pedido.cliente?.telefone || 'N/A'}</p>
            {pedido.cliente?.email && <p className="text-slate-600"><strong>Email:</strong> {pedido.cliente.email}</p>}
            <p className="text-slate-600"><strong>Tipo de Entrega:</strong> {pedido.tipoEntrega || 'N/A'}</p>
          </div>

          {/* Endereço de Entrega */}
          {pedido.tipoEntrega === 'entrega' && pedido.enderecoEntrega && (
            <div className="md:col-span-2">
              <h2 className="text-xl font-semibold text-slate-700 mb-3 border-b pb-2">Endereço de Entrega</h2>
              <p className="text-slate-600"><strong>Rua:</strong> {pedido.enderecoEntrega.rua || 'N/A'}, {pedido.enderecoEntrega.numero || 'N/A'}</p>
              <p className="text-slate-600"><strong>Bairro:</strong> {pedido.enderecoEntrega.bairro || 'N/A'}</p>
              <p className="text-slate-600"><strong>Cidade:</strong> {pedido.enderecoEntrega.cidade || 'N/A'}</p>
              {pedido.enderecoEntrega.complemento && <p className="text-slate-600"><strong>Complemento:</strong> {pedido.enderecoEntrega.complemento}</p>}
              {pedido.enderecoEntrega.referencia && <p className="text-slate-600"><strong>Referência:</strong> {pedido.enderecoEntrega.referencia}</p>}
            </div>
          )}

          {/* Itens do Pedido */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-semibold text-slate-700 mb-3 border-b pb-2">Itens do Pedido</h2>
            {pedido.itens && pedido.itens.length > 0 ? (
              <ul className="list-disc pl-5 space-y-2">
                {pedido.itens.map((item, index) => (
                  <li key={index} className="text-slate-600">
                    {item.quantidade}x {item.nome} (R$ {item.preco?.toFixed(2).replace('.', ',')})
                    {item.observacoesItem && <p className="text-xs text-slate-500 ml-4">Obs: {item.observacoesItem}</p>}
                    {item.adicionais && item.adicionais.length > 0 && (
                      <ul className="list-circle pl-6 text-xs text-slate-500">
                        {item.adicionais.map((add, idx) => (
                          <li key={idx}>+ {add.quantidade}x {add.nome} (R$ {add.preco?.toFixed(2).replace('.', ',')})</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">Nenhum item encontrado para este pedido.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PedidoDetalhesMaster; // <<< ESTA LINHA É CRUCIAL!