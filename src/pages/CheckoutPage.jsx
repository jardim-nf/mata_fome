// src/pages/CheckoutPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayment } from '../context/PaymentContext';
import PaymentSelector from '../components/PaymentSelector';
import { toast } from 'react-toastify';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { processPayment, paymentLoading } = usePayment();
  
  // Dados mock do pedido - substitua pelos dados reais do carrinho
  const [order] = useState({
    id: `order_${Date.now()}`,
    items: [
      { name: 'Pizza Margherita', price: 45.90, quantity: 1 },
      { name: 'Coca-Cola 2L', price: 12.00, quantity: 1 }
    ],
    subtotal: 57.90,
    deliveryFee: 8.00,
    total: 65.90
  });

  const handlePaymentSuccess = (paymentResult) => {
    toast.success('🎉 Pagamento realizado com sucesso!');
    
    // Redirecionar para página de confirmação
    setTimeout(() => {
      navigate('/historico-pedidos');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-[#FF6B35] text-white p-6">
            <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
            <p className="opacity-90">Pedido #{order.id}</p>
          </div>

          <div className="p-6">
            {/* Resumo do Pedido */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-500 ml-2">x{item.quantity}</span>
                    </div>
                    <span className="font-medium">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                
                <div className="flex justify-between py-2 border-b">
                  <span>Subtotal</span>
                  <span>R$ {order.subtotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between py-2 border-b">
                  <span>Taxa de Entrega</span>
                  <span>R$ {order.deliveryFee.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between py-3 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#FF6B35]">R$ {order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Seletor de Pagamento */}
            <PaymentSelector
              amount={order.total}
              orderId={order.id}
              onPaymentSuccess={handlePaymentSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;