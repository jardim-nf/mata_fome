// src/components/PaymentModal.jsx
import React, { useState, useEffect } from 'react';
import { IoClose, IoCard, IoCash, IoQrCode, IoCheckmarkCircle } from 'react-icons/io5';
import { toast } from 'react-toastify';

const PaymentModal = ({ isOpen, onClose, amount, cartItems, customer, onSuccess, coresEstabelecimento, pixKey, establishmentName }) => {
  const [method, setMethod] = useState('pix'); // pix, card, money
  const [trocoPara, setTrocoPara] = useState('');
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Seleção, 2: Processando/Sucesso

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setProcessing(true);

    // Simulação de processamento (ou integração real aqui)
    setTimeout(() => {
      const paymentData = {
        method,
        amount,
        details: method === 'money' ? { troco: trocoPara } : {},
        transactionId: `tx_${Date.now()}`,
        status: 'approved',
        date: new Date().toISOString()
      };

      setProcessing(false);
      setStep(2); // Vai para tela de sucesso
      
      // Chama a função de sucesso do Menu.jsx após 1.5s
      setTimeout(() => {
        onSuccess(paymentData);
      }, 1500);
    }, 2000);
  };

  const formatCurrency = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md h-[85vh] sm:h-auto rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        
        {/* HEADER */}
        <div className="p-5 flex justify-between items-center border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">
            {step === 1 ? 'Forma de Pagamento' : 'Processando...'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <IoClose size={24} className="text-gray-500" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 p-6 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6">
              {/* RESUMO VALOR */}
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-sm text-green-600 mb-1">Total a pagar</p>
                <p className="text-3xl font-black text-green-700">{formatCurrency(amount)}</p>
              </div>

              {/* SELEÇÃO DE MÉTODO */}
              <div className="space-y-3">
                <p className="font-bold text-gray-700 text-sm">Escolha como pagar:</p>
                
                {/* PIX */}
                <button 
                  onClick={() => setMethod('pix')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${method === 'pix' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'pix' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <IoQrCode size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-bold ${method === 'pix' ? 'text-green-800' : 'text-gray-700'}`}>Pix (Instantâneo)</p>
                    <p className="text-xs text-gray-500">Aprovação imediata</p>
                  </div>
                  {method === 'pix' && <IoCheckmarkCircle className="text-green-500 text-xl" />}
                </button>

                {/* CARTÃO */}
                <button 
                  onClick={() => setMethod('card')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${method === 'card' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'card' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <IoCard size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-bold ${method === 'card' ? 'text-blue-800' : 'text-gray-700'}`}>Cartão / Maquininha</p>
                    <p className="text-xs text-gray-500">Crédito ou Débito na entrega</p>
                  </div>
                  {method === 'card' && <IoCheckmarkCircle className="text-blue-500 text-xl" />}
                </button>

                {/* DINHEIRO */}
                <button 
                  onClick={() => setMethod('money')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${method === 'money' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${method === 'money' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <IoCash size={20} />
                  </div>
                  <div className="text-left flex-1">
                    <p className={`font-bold ${method === 'money' ? 'text-yellow-800' : 'text-gray-700'}`}>Dinheiro</p>
                    <p className="text-xs text-gray-500">Pagamento na entrega</p>
                  </div>
                  {method === 'money' && <IoCheckmarkCircle className="text-yellow-500 text-xl" />}
                </button>
              </div>

              {/* DETALHES ESPECÍFICOS */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 animate-fade-in">
                {method === 'pix' && (
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Ao confirmar, o código Pix será gerado.</p>
                    <div className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full inline-block">🚀 +Rápido</div>
                  </div>
                )}

                {method === 'money' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Precisa de troco para quanto?</label>
                    <input 
                      type="number" 
                      placeholder="Ex: 50,00 (Deixe vazio se não precisar)" 
                      value={trocoPara}
                      onChange={(e) => setTrocoPara(e.target.value)}
                      className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-400"
                    />
                  </div>
                )}

                {method === 'card' && (
                  <p className="text-sm text-gray-600 text-center">O entregador levará a maquininha até você. 💳</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center justify-center h-full py-10 text-center animate-fade-in">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <IoCheckmarkCircle className="text-green-600 text-5xl animate-bounce" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Pagamento Confirmado!</h3>
              <p className="text-gray-500">Estamos enviando seu pedido para a cozinha...</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {step === 1 && (
          <div className="p-5 border-t border-gray-100 bg-white">
            <button 
              onClick={handleConfirm}
              disabled={processing}
              className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all flex items-center justify-center gap-2
                ${processing ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95'}`}
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processando...
                </>
              ) : (
                '✅ Confirmar Pedido'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;