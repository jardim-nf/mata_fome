import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ComandaSalaoImpressao = React.forwardRef(({ pedido, estabelecimento }, ref) => {
  if (!pedido) return <div ref={ref}>Carregando...</div>;

  // 1. Agrupar itens por cliente (igual fizemos na tela de pedidos)
  const itensPorPessoa = useMemo(() => {
    if (!pedido.itens) return {};
    
    return pedido.itens.reduce((acc, item) => {
      // Tenta pegar o nome do cliente, ou usa "Mesa"
      const nome = item.clienteNome || item.destinatario || 'Mesa';
      if (!acc[nome]) acc[nome] = [];
      acc[nome].push(item);
      return acc;
    }, {});
  }, [pedido.itens]);

  const dataPedido = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date();

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
          border-bottom: 1px solid #000;
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
            {pedido.mesaNumero}
        </p>
        
        <p className="mt-2">Pedido #{pedido.id?.slice(0,6).toUpperCase()}</p>
        <p>{format(dataPedido, "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </div>

      <div className="divider"></div>

      {/* LISTA DE ITENS (AGRUPADOS POR PESSOA) */}
      <div>
        {Object.entries(itensPorPessoa).map(([nomeCliente, itens]) => (
          <div key={nomeCliente}>
            {/* Nome do Cliente Destacado */}
            <div className="cliente-header">
                👤 {nomeCliente}
            </div>

            {/* Itens desse Cliente */}
            {itens.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '4px' }}>
                <div className="item-row">
                  <span className="font-bold">{item.quantidade}x {item.nome}</span>
                </div>
                
                {/* Observações */}
                {item.observacao && (
                  <div className="obs">** {item.observacao}</div>
                )}
                
                {/* Adicionais */}
                {item.adicionais && item.adicionais.length > 0 && (
                  <div className="obs">
                    + {item.adicionais.map(a => a.nome).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="divider"></div>

      {/* RODAPÉ */}
      <div className="text-center">
        <p className="font-bold text-lg">
            TOTAL: R$ {pedido.total?.toFixed(2)}
        </p>
        <p className="divider"></p>
        <p className="font-bold">*** FIM DO PEDIDO ***</p>
      </div>
    </div>
  );
});

export default ComandaSalaoImpressao;