// src/pages/ComandaView.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase'; // Importe a instância do Firestore

function ComandaView() {
  const { pedidoId } = useParams();
  const [pedido, setPedido] = useState(null);
  const [estabelecimento, setEstabelecimento] = useState(null); // Novo estado para o estabelecimento
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pedidoId) {
      setError("ID do pedido não fornecido na URL.");
      setLoading(false);
      return;
    }

    const fetchPedidoAndEstabelecimento = async () => {
      try {
        const pedidoRef = doc(db, 'pedidos', pedidoId);
        const pedidoSnap = await getDoc(pedidoRef);

        if (pedidoSnap.exists()) {
          const pedidoData = { id: pedidoSnap.id, ...pedidoSnap.data() };
          setPedido(pedidoData);

          // Se o pedido tiver um ID de estabelecimento, busca os dados do estabelecimento
          if (pedidoData.estabelecimentoId) {
            const estabelecimentoRef = doc(db, 'estabelecimentos', pedidoData.estabelecimentoId);
            const estabelecimentoSnap = await getDoc(estabelecimentoRef);

            if (estabelecimentoSnap.exists()) {
              setEstabelecimento(estabelecimentoSnap.data());
            } else {
              console.warn("Estabelecimento não encontrado para o ID:", pedidoData.estabelecimentoId);
              // Opcional: setError("Estabelecimento associado ao pedido não encontrado.");
            }
          }
        } else {
          setError("Pedido não encontrado no banco de dados.");
        }
      } catch (err) {
        console.error("Erro ao carregar pedido ou estabelecimento:", err);
        setError("Erro ao carregar os detalhes do pedido. Verifique o console para mais informações.");
      } finally {
        setLoading(false);
      }
    };

    fetchPedidoAndEstabelecimento();
  }, [pedidoId]);

  // Efeito para acionar a impressão automaticamente
  useEffect(() => {
    if (pedido && !loading && !error) {
      const timer = setTimeout(() => {
        window.print();
        // Opcional: window.close(); // Pense bem se quer fechar automaticamente
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pedido, loading, error]);

  if (loading) {
    return <div className="text-center p-4 text-[var(--marrom-escuro)]">Carregando comanda...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-600 font-semibold">{error}</div>;
  }

  if (!pedido) {
    return <div className="text-center p-4 text-gray-500 italic">Pedido não disponível.</div>;
  }

  // --- Processamento dos dados para exibição ---
  const totalPedido = pedido.itens ? pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0) : 0;
  // A taxa de entrega agora vem diretamente do pedido.taxaEntrega
  const taxaEntregaExibida = pedido.taxaEntrega || 0; // Garante que é 0 se não estiver definido
  const totalFinalComTaxa = totalPedido + taxaEntregaExibida; // NOVO: Calcula o total final com a taxa exibida


  const dataPedido = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function' 
                       ? pedido.criadoEm.toDate().toLocaleString('pt-BR') 
                       : 'Data não disponível';

  // Extrair e formatar endereço do cliente
  const enderecoCliente = pedido.cliente?.endereco;
  const enderecoFormatado = enderecoCliente 
    ? `${enderecoCliente.rua || ''}, ${enderecoCliente.numero || ''}` +
      (enderecoCliente.complemento ? `, ${enderecoCliente.complemento}` : '') +
      (enderecoCliente.bairro ? `\n${enderecoCliente.bairro}` : '') + // Inclui o bairro
      (enderecoCliente.cidade && enderecoCliente.estado ? `\n${enderecoCliente.cidade}, ${enderecoCliente.estado}` : '') +
      (enderecoCliente.cep ? ` - CEP: ${enderecoCliente.cep}` : '')
    : 'Endereço não disponível';
  
  // Formatando o número do pedido para ter 3 dígitos (ex: 1 -> 001)
  const numeroPedidoFormatado = pedido.numeroSequencial ? String(pedido.numeroSequencial).padStart(3, '0') : pedido.id.substring(0, 7).toUpperCase();

  // Formatar endereço do estabelecimento
  const enderecoEstabelecimento = estabelecimento?.endereco;
  const enderecoEstabelecimentoFormatado = enderecoEstabelecimento 
    ? `${enderecoEstabelecimento.rua || '', 
        enderecoEstabelecimento.numero || ''}` +
      (enderecoEstabelecimento.bairro ? `, ${enderecoEstabelecimento.bairro}` : '') +
      (enderecoEstabelecimento.cidade && enderecoEstabelecimento.estado ? ` - ${enderecoEstabelecimento.cidade}/${enderecoEstabelecimento.estado}` : '') +
      (enderecoEstabelecimento.cep ? ` - CEP: ${enderecoEstabelecimento.cep}` : '')
    : 'Endereço não disponível';

  return (
    <div className="comanda-print-area p-6 bg-white max-w-sm mx-auto my-4 border border-gray-300 rounded-lg shadow-lg text-gray-800 font-mono">
      {/* Cabeçalho do Estabelecimento */}
      <div className="text-center mb-4">
        {/* Você pode adicionar uma logo aqui se tiver estabelecimento.logoUrl */}
        {/* {estabelecimento?.logoUrl && <img src={estabelecimento.logoUrl} alt="Logo" className="h-12 mx-auto mb-2" />} */}
        <h1 className="text-2xl font-bold text-[var(--marrom-escuro)]">{estabelecimento?.nome || 'SEU ESTABELECIMENTO'}</h1>
        <p className="text-sm">{enderecoEstabelecimentoFormatado}</p>
        <p className="text-sm">Telefone: {estabelecimento?.telefone || 'N/A'} | Site: {estabelecimento?.site || 'N/A'}</p>
      </div>
      <hr className="border-t-2 border-gray-400 mb-4" />

      <h2 className="text-2xl font-bold text-center mb-4">COMANDA DE PEDIDO</h2>
      
      <hr className="border-t border-gray-300 mb-2" />
      <div className="flex justify-between text-sm mb-2">
        <p><strong>No. Pedido:</strong> {numeroPedidoFormatado}</p>
        <p><strong>Data:</strong> {dataPedido}</p>
      </div>
      <hr className="border-t border-gray-300 mb-4" />

      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2">DADOS DO CLIENTE</h3>
        <p className="text-base"><strong>Cliente:</strong> {pedido.cliente?.nome || 'N/A'}</p>
        <p className="text-base"><strong>Telefone:</strong> {pedido.cliente?.telefone ? `(${pedido.cliente.telefone.substring(0, 2)}) ${pedido.cliente.telefone.substring(2, 7)}-${pedido.cliente.telefone.substring(7)}` : 'N/A'}</p>
        <p className="text-base whitespace-pre-line"><strong>Endereço:</strong> {enderecoFormatado}</p>
      </div>

      <hr className="border-t-2 border-gray-400 my-4" />

      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2">ITENS DO PEDIDO</h3>
        <table className="w-full text-left table-fixed">
          <thead>
            <tr className="border-b border-gray-300 text-sm">
              <th className="w-1/6 py-1">Qtd.</th>
              <th className="w-3/6 py-1">Descrição do Item</th>
              <th className="w-1/6 py-1 text-right">Preço Un.</th>
              <th className="w-1/6 py-1 text-right">Total Item</th>
            </tr>
          </thead>
          <tbody>
            {pedido.itens?.map((item, index) => (
              <tr key={index} className="border-b border-gray-200 text-base">
                <td className="py-1">{item.quantidade}x</td>
                <td className="py-1">
                  {item.nome}
                  {item.observacao && <span className="block text-xs text-gray-600">- Obs: {item.observacao}</span>}
                </td>
                <td className="py-1 text-right">R$ {item.preco.toFixed(2)}</td>
                <td className="py-1 text-right">R$ {(item.preco * item.quantidade).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <hr className="border-t-2 border-gray-400 my-4" />

      <div className="text-right text-xl font-bold mb-2">
        <p>Subtotal: R$ {totalPedido.toFixed(2)}</p>
        {/* Usa a taxa de entrega que veio do pedido */}
        {taxaEntregaExibida > 0 && <p>Taxa de Entrega: R$ {taxaEntregaExibida.toFixed(2)}</p>}
        {pedido.desconto > 0 && <p>Desconto: R$ {pedido.desconto.toFixed(2)}</p>}
        {/* Exibe o total final com a taxa */}
        <p className="mt-2 text-2xl">TOTAL A PAGAR: R$ {totalFinalComTaxa.toFixed(2)}</p>
      </div>

      <hr className="border-t border-gray-300 my-4" />

      <div className="text-center text-lg mb-4">
        <p><strong>FORMA DE PAGAMENTO:</strong> {pedido.formaPagamento || 'N/A'}</p>
      </div>

      <p className="text-center text-sm mt-6 text-gray-600">
        Agradecemos a sua preferência!
      </p>
    </div>
  );
}

export default ComandaView;