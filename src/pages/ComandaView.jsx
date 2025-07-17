// src/pages/ComandaView.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-toastify';

function ComandaView() {
  const { pedidoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [pedido, setPedido] = useState(null);
  const [estabelecimento, setEstabelecimento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoPrintBlocked, setAutoPrintBlocked] = useState(false);

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

          if (pedidoData.estabelecimentoId) {
            const estabelecimentoRef = doc(db, 'estabelecimentos', pedidoData.estabelecimentoId);
            const estabelecimentoSnap = await getDoc(estabelecimentoRef);

            if (estabelecimentoSnap.exists()) {
              setEstabelecimento(estabelecimentoSnap.data());
            } else {
              console.warn("Estabelecimento não encontrado para o ID:", pedidoData.estabelecimentoId);
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

  // NOVO useEffect para tentar a impressão automática
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const shouldAutoPrintFromURL = queryParams.get('print') === 'true'; // Verifica o parâmetro na URL
    const autoPrintEnabledPref = localStorage.getItem('autoPrintEnabled') === 'true'; // Lê a preferência do localStorage

    // Só tenta imprimir se o parâmetro estiver na URL E a preferência estiver ativada
    if (shouldAutoPrintFromURL && autoPrintEnabledPref && !loading && !error && pedido) {
      const timer = setTimeout(() => {
        try {
          window.print();
          setAutoPrintBlocked(false);
        } catch (printError) {
          console.error("Erro ao tentar impressão automática:", printError);
          setAutoPrintBlocked(true);
          toast.warn("Impressão automática bloqueada. Por favor, clique no botão 'Imprimir Comanda'.");
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [loading, error, pedido, location.search]);

  const handlePrint = () => {
    try {
      window.print();
      setAutoPrintBlocked(false);
    } catch (printError) {
      console.error("Erro ao tentar impressão manual:", printError);
      toast.error("Não foi possível iniciar a impressão. Verifique as configurações da sua impressora.");
    }
  };

  const handleBackToPainel = () => {
    navigate('/painel');
  };

  const totalPedido = pedido?.itens ? pedido.itens.reduce((acc, item) => acc + (item.preco * item.quantidade), 0) : 0;
  const taxaEntregaExibida = pedido?.taxaEntrega || 0;
  const descontoCupomExibido = pedido?.cupomAplicado?.descontoCalculado || 0;
  const totalFinalComDesconto = totalPedido + taxaEntregaExibida - descontoCupomExibido;

  const dataPedido = pedido?.criadoEm && typeof pedido.criadoEm.toDate === 'function'
                         ? pedido.criadoEm.toDate().toLocaleString('pt-BR')
                         : 'Data não disponível';

  const enderecoCliente = pedido?.cliente?.endereco;
  const enderecoFormatado = enderecoCliente
    ? `${enderecoCliente.rua || ''}, ${enderecoCliente.numero || ''}` +
      (enderecoCliente.complemento ? `, ${enderecoCliente.complemento}` : '') +
      (enderecoCliente.bairro ? `\n${enderecoCliente.bairro}` : '') +
      (enderecoCliente.cidade && enderecoCliente.estado ? `\n${enderecoCliente.cidade}, ${enderecoCliente.estado}` : '') +
      (enderecoCliente.cep ? ` - CEP: ${enderecoCliente.cep}` : '')
    : 'Endereço não disponível';

  const numeroPedidoFormatado = pedido?.numeroSequencial ? String(pedido.numeroSequencial).padStart(3, '0') : (pedido?.id ? pedido.id.substring(0, 7).toUpperCase() : 'N/A');

  const enderecoEstabelecimento = estabelecimento?.endereco;
  const enderecoEstabelecimentoFormatado = enderecoEstabelecimento
    ? `${enderecoEstabelecimento.rua || ''}, ${enderecoEstabelecimento.numero || ''}` +
      (enderecoEstabelecimento.bairro ? `, ${enderecoEstabelecimento.bairro}` : '') +
      (enderecoEstabelecimento.cidade && enderecoEstabelecimento.estado ? ` - ${enderecoEstabelecimento.cidade}/${enderecoEstabelecimento.estado}` : '') +
      (enderecoEstabelecimento.cep ? ` - CEP: ${enderecoEstabelecimento.cep}` : '')
    : 'Endereço não disponível';

  return (
    <div className="bg-[var(--bege-claro)] min-h-screen p-4 flex flex-col items-center">
      <div className="w-full max-w-sm mb-4 flex justify-between gap-2 no-print">
        <button
          onClick={handleBackToPainel}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold flex-1"
        >
          Voltar
        </button>
        <button
          onClick={handlePrint}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold flex-1"
        >
          Imprimir Comanda
        </button>
      </div>

      {autoPrintBlocked && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4 w-full max-w-sm" role="alert">
          <p className="font-bold">Atenção!</p>
          <p>A impressão automática foi bloqueada pelo navegador. **A comanda foi aberta em uma nova aba.** Por favor, clique no botão "Imprimir Comanda" acima para imprimir.</p>
        </div>
      )}

      <div className="comanda-print-area p-6 bg-white max-w-sm w-full border border-gray-300 rounded-lg shadow-lg text-gray-800 font-mono">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-lg text-[var(--marrom-escuro)] mb-4">Carregando comanda...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--vermelho-principal)] mx-auto"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-lg text-red-600 font-semibold mb-4">{error}</p>
            <p className="text-sm text-gray-500">Por favor, tente voltar e abrir o pedido novamente.</p>
          </div>
        ) : !pedido ? (
          <div className="text-center py-12">
            <p className="text-lg text-gray-500 italic mb-4">Pedido não disponível.</p>
            <p className="text-sm text-gray-500">O pedido pode ter sido excluído ou não existe.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-4">
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
              <p className="text-base"><strong>Tipo de Entrega:</strong> {pedido.tipoEntrega === 'retirada' ? 'Retirada no Local' : 'Delivery'}</p>
              {pedido.tipoEntrega !== 'retirada' && (
                <p className="text-base whitespace-pre-line"><strong>Endereço:</strong> {enderecoFormatado}</p>
              )}
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
                      <td className="py-1 text-right">R$ {item.preco.toFixed(2).replace('.', ',')}</td>
                      <td className="py-1 text-right">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <hr className="border-t-2 border-gray-400 my-4" />

            <div className="text-right text-xl font-bold mb-2">
              <p>Subtotal: R$ {totalPedido.toFixed(2).replace('.', ',')}</p>
              {taxaEntregaExibida > 0 && <p>Taxa de Entrega: R$ {taxaEntregaExibida.toFixed(2).replace('.', ',')}</p>}

              {descontoCupomExibido > 0 && (
                <p className="text-green-700">Desconto ({pedido.cupomAplicado.codigo}): - R$ {descontoCupomExibido.toFixed(2).replace('.', ',')}</p>
              )}

              <p className="mt-2 text-2xl">TOTAL A PAGAR: R$ {totalFinalComDesconto.toFixed(2).replace('.', ',')}</p>
            </div>

            <hr className="border-t border-gray-300 my-4" />

            <div className="text-center text-lg mb-4">
              <p><strong>FORMA DE PAGAMENTO:</strong> {pedido.formaPagamento || 'N/A'}</p>
              {pedido.formaPagamento === 'dinheiro' && pedido.trocoPara && (
                  <p><strong>TROCO PARA:</strong> R$ {pedido.trocoPara.toFixed(2).replace('.', ',')}</p>
              )}
            </div>

            <p className="text-center text-sm mt-6 text-gray-600">
              Agradecemos a sua preferência!
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default ComandaView;