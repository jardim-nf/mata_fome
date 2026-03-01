export default function PedidoItem({ pedido }) {
  return (
    <div className="border rounded-lg p-2 flex justify-between items-center">
      <span>
        {pedido.qtd}x {pedido.nome}
      </span>
      <span className="font-semibold">R$ {pedido.preco}</span>
    </div>
  );
}
