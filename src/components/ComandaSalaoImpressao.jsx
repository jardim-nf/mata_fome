import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ComandaSalaoImpressao = React.forwardRef(({ pedido, estabelecimento }, ref) => {
  // 1. Agrupar itens por cliente (com fallback para garantir que acha a lista)
  const itensPorPessoa = useMemo(() => {
    if (!pedido) return {};
    // 💡 SOLUÇÃO: Puxa de 'itens', 'carrinho' ou 'produtos' para evitar que venha vazio
    const listaItens = pedido.itens || pedido.carrinho || pedido.produtos || [];
    
    if (listaItens.length === 0) return {};
    
    return listaItens.reduce((acc, item) => {
      // Tenta pegar o nome do cliente, ou usa "Mesa"
      const nome = item.clienteNome || item.destinatario || 'Mesa';
      if (!acc[nome]) acc[nome] = [];
      acc[nome].push(item);
      return acc;
    }, {});
  }, [pedido]);

  const dataPedido = pedido?.createdAt?.toDate ? pedido.createdAt.toDate() : new Date();

  if (!pedido) return <div ref={ref}>Carregando...</div>;

  return (
    <div ref={ref} className="print-container">
      <style>{`
        @media print {
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; padding: 0; background: white; }
          .print-container { margin: 0; padding: 10px; }
        }
        .print-container {
          width: 80mm;
          padding: 10px;
          font-family: 'Courier New', Courier, monospace;
          color: black;
          background: white;
          font-size: 12px;
          line-height: 1.2;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .text-xl { font-size: 24px; }
        .text-lg { font-size: 18px; }
        .divider { border-top: 1px dashed black; margin: 8px 0; }
        .item-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .cliente-header { 
          background: #eee; 
          font-weight: bold; 
          padding: 2px 0; 
          margin-top: 8px; 
          margin-bottom: 4px;
          border-bottom: 1px solid black; /* 💡 SOLUÇÃO: Adicionado 'black' que estava faltando */
          text-transform: uppercase;
        }
        .obs { font-size: 10px; font-style: italic; margin-left: 10px; }
      `}</style>

      {/* CABEÇALHO */}
      <div className="text-center">
        <h1 className="font-bold text-lg">{estabelecimento?.nome || 'RESTAURANTE'}</h1>
        <p className="divider"></p>
        
        {/* NÚMERO DA MESA GIGANTE */}
        <p className="text-lg font-bold">MESA</p>
        <p className="text-xl font-bold border-2 border-black inline-block px-4 py-1 rounded">
            {pedido.mesaNumero || pedido.numero || 'N/A'}
        </p>
        
        <p className="mt-2">Pedido #{pedido.id?.slice(0,6).toUpperCase()}</p>
        <p>{format(dataPedido, "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </div>

      <div className="divider"></div>

      {/* LISTA DE ITENS (AGRUPADOS POR PESSOA) */}
      <div>
        {/* 💡 SOLUÇÃO: Aviso caso a comanda realmente chegue sem itens visíveis */}
        {Object.keys(itensPorPessoa).length === 0 && (
            <div className="text-center font-bold">Nenhum item lançado nesta mesa.</div>
        )}

        {Object.entries(itensPorPessoa).map(([nomeCliente, itens]) => (
          <div key={nomeCliente}>
            {/* Nome do Cliente Destacado */}
            <div className="cliente-header">
                👤 {nomeCliente}
            </div>

            {/* Itens desse Cliente */}
            {itens.map((item, idx) => {
              // 💡 SOLUÇÃO: Previne itens em branco caso o objeto venha com chaves diferentes
              const nomeProduto = item.nome || item.produto?.nome || 'Item sem nome';
              const qtdProduto = item.quantidade || item.qtd || 1;
              const valor = item.preco || item.produto?.preco || 0;

              return (
                <div key={idx} style={{ marginBottom: '4px' }}>
                  <div className="item-row">
                    <span className="font-bold">{qtdProduto}x {nomeProduto}</span>
                    <span>R$ {(valor * qtdProduto).toFixed(2)}</span>
                  </div>
                  
                  {/* Observações */}
                  {item.observacao && (
                    <div className="obs">** {item.observacao}</div>
                  )}
                  
                  {/* Adicionais — checa ambas as chaves possíveis */}
                  {(() => {
                    const listaAdicionais = item.adicionaisSelecionados || item.adicionais || [];
                    if (!listaAdicionais || listaAdicionais.length === 0) return null;
                    return (
                      <div className="obs">
                        {listaAdicionais.map((a, ai) => {
                          const precoAdc = a.preco || a.valor || 0;
                          const nomeAdc = a.nome || 'Adicional';
                          return (
                            <div key={ai}>+ {nomeAdc}{precoAdc > 0 ? ` (R$ ${Number(precoAdc).toFixed(2)})` : ''}</div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="divider"></div>

      {/* RODAPÉ */}
      <div className="text-center">
        <p className="font-bold text-lg">
            TOTAL: R$ {(pedido.total || 0).toFixed(2)}
        </p>
        <p className="divider"></p>
        <p className="font-bold">*** FIM DO PEDIDO ***</p>
      </div>
    </div>
  );
});

export default ComandaSalaoImpressao;