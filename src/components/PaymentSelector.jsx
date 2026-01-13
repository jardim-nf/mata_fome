// src/components/PaymentSelector.jsx
import React from 'react';
import { usePayment } from '../context/PaymentContext.jsx';

const PaymentSelector = ({ amount, orderId, onPaymentSuccess }) => {
  const {
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    paymentLoading,
    processPayment,
    pixCode
  } = usePayment();

  const handlePayment = async () => {
    if (!selectedPayment) {
      alert('Selecione uma forma de pagamento');
      return;
    }

    try {
      const result = await processPayment(amount, orderId);
      
      if (result.success && onPaymentSuccess) {
        onPaymentSuccess(result);
      }
    } catch (error) {
      console.error('Erro no pagamento:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="payment-selector">
      <div className="payment-header">
        <h3 className="text-lg font-semibold mb-4">Forma de Pagamento</h3>
        <div className="total-amount bg-gray-50 p-3 rounded-lg mb-4">
          <span className="text-gray-600">Total: </span>
          <span className="text-xl font-bold text-[#FF6B35]">
            {formatCurrency(amount)}
          </span>
        </div>
      </div>

      {/* Métodos de Pagamento */}
      <div className="payment-methods space-y-3 mb-6">
        {paymentMethods.filter(method => method.enabled).map(method => (
          <div
            key={method.id}
            className={`payment-method border-2 rounded-lg p-4 cursor-pointer transition-all ${
              selectedPayment === method.id
                ? 'border-[#FF6B35] bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedPayment(method.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{method.icon}</span>
                <div>
                  <div className="font-medium">{method.name}</div>
                  <div className="text-sm text-gray-500">{method.description}</div>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 ${
                selectedPayment === method.id
                  ? 'bg-[#FF6B35] border-[#FF6B35]'
                  : 'border-gray-300'
              }`} />
            </div>
          </div>
        ))}
      </div>

      {/* QR Code PIX */}
      {pixCode && selectedPayment === 'pix' && (
        <div className="pix-section bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h4 className="font-semibold text-green-800 mb-2">Pagamento PIX</h4>
          <div className="qr-code-container bg-white p-4 rounded-lg text-center">
            <img 
              src={pixCode.qr_code_base64} 
              alt="QR Code PIX" 
              className="mx-auto mb-3 max-w-[200px]"
            />
            <p className="text-sm text-gray-600 mb-2">
              Escaneie o QR Code com seu app bancário
            </p>
            <button
              onClick={() => navigator.clipboard.writeText(pixCode.qr_code)}
              className="text-sm text-green-600 hover:text-green-700"
            >
              📋 Copiar código PIX
            </button>
          </div>
        </div>
      )}

      {/* Botão de Pagamento */}
      <button
        onClick={handlePayment}
        disabled={paymentLoading || !selectedPayment}
        className={`flex-col sm:flex-row py-3 px-4 rounded-lg font-semibold text-white transition ${
          paymentLoading || !selectedPayment
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-[#FF6B35] hover:bg-[#e55a2b]'
        }`}
      >
        {paymentLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Processando...
          </div>
        ) : (
          `Pagar ${formatCurrency(amount)}`
        )}
      </button>

      {/* Informações de Segurança */}
      <div className="security-info mt-4 text-center">
        <p className="text-xs text-gray-500">
          🔒 Pagamento 100% seguro • Seus dados estão protegidos
        </p>
      </div>
    </div>
  );
};

export default PaymentSelector;