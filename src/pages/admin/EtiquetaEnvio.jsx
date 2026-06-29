import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import Barcode from 'react-barcode';

function EtiquetaEnvio() {
  const { pedidoId } = useParams();
  const [searchParams] = useSearchParams();
  const estabelecimentoId = searchParams.get('estabelecimentoId');

  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarPedido = async () => {
      if (!estabelecimentoId || !pedidoId) return;
      try {
        const docRef = doc(db, 'estabelecimentos', estabelecimentoId, 'pedidos', pedidoId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPedido({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    carregarPedido();
  }, [pedidoId, estabelecimentoId]);

  useEffect(() => {
    if (pedido) {
      setTimeout(() => {
        window.print();
      }, 1000);
    }
  }, [pedido]);

  if (loading) return <div className="p-4">Carregando etiqueta...</div>;
  if (!pedido) return <div className="p-4">Pedido não encontrado.</div>;

  const cliente = pedido.cliente || {};
  const endereco = cliente.endereco || {};

  return (
    <div id="printable-receipt" className="w-[80mm] min-h-[100mm] bg-white text-black p-2 mx-auto font-mono">
      <div className="text-center border-b-2 border-black pb-2 mb-2">
        <h1 className="font-bold text-lg uppercase leading-tight">Etiqueta de Envio</h1>
        <p className="text-xs">Pedido #{pedido.id.substring(0, 8).toUpperCase()}</p>
      </div>

      <div className="mb-4">
        <h2 className="font-bold text-sm mb-1 uppercase">Destinatário</h2>
        <p className="text-sm font-bold uppercase">{cliente.nome || 'Cliente não informado'}</p>
        <p className="text-xs mt-1">
          {endereco.rua || endereco.logradouro}, {endereco.numero}
          {endereco.complemento && ` - ${endereco.complemento}`}
        </p>
        <p className="text-xs">
          {endereco.bairro}
        </p>
        <p className="text-xs">
          {endereco.cidade} - {endereco.estado}
        </p>
        {endereco.cep && <p className="text-xs">CEP: {endereco.cep}</p>}
        {cliente.telefone && <p className="text-xs mt-1">Tel: {cliente.telefone}</p>}
      </div>

      <div className="border-t-2 border-black pt-2 mb-4">
        <h2 className="font-bold text-sm mb-1 uppercase">Itens</h2>
        {pedido.itens?.map((item, i) => (
          <div key={i} className="flex justify-between text-xs mb-1">
            <span className="truncate pr-2">{item.quantidade}x {item.nome}</span>
          </div>
        ))}
        <div className="font-bold text-sm text-right mt-2">
          Total: R$ {(pedido.total || 0).toFixed(2).replace('.', ',')}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center border-t-2 border-black pt-4">
        <Barcode 
          value={pedido.id} 
          width={1.5} 
          height={40} 
          fontSize={12} 
          displayValue={true} 
          background="#ffffff"
        />
        <p className="text-[10px] mt-2 text-center text-gray-600">
          Gerado por IdeaFood<br/>
          {new Date().toLocaleString('pt-BR')}
        </p>
      </div>
      
      <style>
        {`
          @media print {
            html, body, #root {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              height: auto !important;
              overflow: visible !important;
              width: 100% !important;
              display: block !important;
            }
            @page { margin: 0; }
          }
        `}
      </style>
    </div>
  );
}

export default EtiquetaEnvio;
