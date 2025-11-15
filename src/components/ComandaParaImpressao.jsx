// src/components/ComandaParaImpressao.jsx

import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ComandaParaImpressao = React.forwardRef(({ pedido, estabelecimento }, ref) => {
  if (!pedido || !estabelecimento) {
    return <div ref={ref}>Carregando dados...</div>;
  }

  // 🔧 FUNÇÃO PARA CONVERTER TIMESTAMP DO FIREBASE
  const converterTimestampParaData = (timestamp) => {
    if (!timestamp) return new Date();
    
    // Se for um objeto Timestamp do Firebase
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Se já for uma Date
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Se for um string ou número
    return new Date(timestamp);
  };

  const formatarTelefone = (tel) => {
    if (!tel) return 'Não informado';
    const cleaned = ("" + tel).replace(/\D/g, '');
    if (cleaned.length === 11) return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    return tel;
  };
  
  const enderecoCliente = pedido?.cliente?.endereco;
  const enderecoFormatado = enderecoCliente
    ? `${enderecoCliente.rua || ''}, ${enderecoCliente.numero || ''}${enderecoCliente.complemento ? `, ${enderecoCliente.complemento}` : ''}\n${enderecoCliente.bairro || ''}`
    : 'Endereço não disponível';

  // ▼▼▼ LÓGICA DE CÁLCULO REFORÇADA ▼▼▼
  const subTotal = pedido.itens?.reduce((acc, item) => acc + (item.preco * item.quantidade), 0) || 0;
  const taxaEntrega = pedido.taxaEntrega || 0;
  const totalFinal = pedido.totalFinal || 0;

  // 🔧 CONVERTE A DATA CORRETAMENTE
  const dataPedido = converterTimestampParaData(pedido.criadoEm);
  const dataFormatada = format(dataPedido, "dd/MM/yy HH:mm", { locale: ptBR });

  return (
    <div ref={ref}>
      <style>{`
        body { margin: 0; padding: 0; background-color: #fff; }
        .comanda-print-area {
          width: 80mm;
          padding: 10px;
          font-family: 'Courier New', monospace;
          color: #000;
          font-size: 12px;
        }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { font-size: 18px; font-weight: bold; margin: 0; }
        .header p { margin: 2px 0; font-size: 11px; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .section-title { font-weight: bold; font-size: 14px; text-transform: uppercase; margin-bottom: 8px; text-align: center; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px; }
        .info-block p { margin: 2px 0; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th, .items-table td { text-align: left; padding: 4px 0; border-bottom: 1px solid #eee; }
        .items-table .qty { width: 15%; }
        .items-table .price { text-align: right; }
        .totals { margin-top: 10px; text-align: right; font-size: 13px; }
        .totals p { margin: 3px 0; }
        .totals .total-final { font-size: 16px; font-weight: bold; }
        .pagamento { text-align: center; margin-top: 10px; font-size: 14px; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; }
        .whitespace-pre-line { white-space: pre-line; }
        @media print {
          body { margin: 0; padding: 0; }
          .comanda-print-area { width: 80mm; padding: 10px; }
        }
      `}</style>
      
      <div className="comanda-print-area">
        <div className="header">
          <h1>{estabelecimento?.nome || 'SEU ESTABELECIMENTO'}</h1>
          <p>{estabelecimento?.endereco?.rua}, {estabelecimento?.endereco?.numero}</p>
          <p>{estabelecimento?.endereco?.cidade || ''}</p>
        </div>

        <div className="divider"></div>
        <div className="section-title">Comanda de Pedido</div>
        
        <div className="info-grid">
          <p><strong>No. Pedido:</strong> #{pedido.id?.substring(0, 5).toUpperCase() || 'N/A'}</p>
          {/* 🔧 DATA AGORA FUNCIONANDO */}
          <p><strong>Data:</strong> {dataFormatada}</p>
        </div>
        <div className="divider"></div>

        <div className="info-block">
          <h3 className="font-bold mb-2">DADOS DO CLIENTE</h3>
          <p><strong>Cliente:</strong> {pedido.cliente?.nome || 'N/A'}</p>
          <p><strong>Telefone:</strong> {formatarTelefone(pedido.cliente?.telefone)}</p>
          {pedido.tipo !== 'retirada' && pedido.tipoEntrega !== 'retirada' && (
            <p className="whitespace-pre-line"><strong>Endereço:</strong> {enderecoFormatado}</p>
          )}
          {pedido.tipo === 'retirada' && (
            <p><strong>Tipo:</strong> 🏪 Retirada no Local</p>
          )}
        </div>
        
        <div className="divider"></div>

        <div>
          <h3 className="font-bold mb-2">ITENS DO PEDIDO</h3>
          <table className="items-table">
            <thead>
              <tr>
                <th className="qty">Qtd</th>
                <th>Descrição</th>
                <th className="price">Total</th>
              </tr>
            </thead>
            <tbody>
              {pedido.itens?.map((item, index) => (
                <tr key={index}>
                  <td className="qty">{item.quantidade}x</td>
                  <td>{item.nome}</td>
                  <td className="price">R$ {(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divider"></div>

        {/* ▼▼▼ SEÇÃO DE TOTAIS CORRIGIDA ▼▼▼ */}
        <div className="totals">
          <p>Subtotal: R$ {subTotal.toFixed(2).replace('.', ',')}</p>
          {taxaEntrega > 0 && (
            <p>Taxa de Entrega: R$ {taxaEntrega.toFixed(2).replace('.', ',')}</p>
          )}
          {pedido.cupomAplicado && (
            <p>Desconto: -R$ {(pedido.cupomAplicado.descontoCalculado || 0).toFixed(2).replace('.', ',')}</p>
          )}
          <p className="total-final">TOTAL A PAGAR: R$ {totalFinal.toFixed(2).replace('.', ',')}</p>
        </div>

        <div className="divider"></div>

        <div className="pagamento">
          <p><strong>PAGAMENTO:</strong> {pedido.formaPagamento || 'N/A'}</p>
          {pedido.formaPagamento === 'dinheiro' && pedido.trocoPara && (
            <p><strong>TROCO PARA:</strong> R$ {Number(pedido.trocoPara).toFixed(2).replace('.', ',')}</p>
          )}
        </div>

        <div className="divider"></div>

        <div className="footer">
          <p>** {estabelecimento?.nome || 'Estabelecimento'} **</p>
          <p>Agradecemos a sua preferência!</p>
          <p>{format(dataPedido, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
      </div>
    </div>
  );
});

export default ComandaParaImpressao;