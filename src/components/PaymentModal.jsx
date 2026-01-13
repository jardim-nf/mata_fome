// src/components/PaymentModal.jsx
import React, { useState, useEffect } from 'react';
import { usePayment } from '../context/PaymentContext';
import { toast } from 'react-toastify';

const PaymentModal = ({ 
  isOpen, 
  onClose, 
  amount, 
  orderId, 
  cartItems = [], 
  customer = {},  
  onSuccess,
  onError,
  pixKey, 
  establishmentName 
}) => {
  
  const {
    paymentMethods,
    selectedPayment,
    setSelectedPayment,
    paymentLoading,
    pixCode,
    generatePixCode,
    clearPixCode,
    pixConfig,
    submitOrder
  } = usePayment();

  const [localLoading, setLocalLoading] = useState(false);

  // 🔎 FUNÇÃO VISUAL (Para mostrar na tela bonitinho)
  const formatarChaveVisual = (chave) => {
    if (!chave) return "Chave não informada";
    if (chave.includes('@')) return chave;
    
    const limpa = chave.replace(/\D/g, '');

    // CNPJ
    if (limpa.length === 14) return limpa.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    // Celular
    if (limpa.length === 11 && limpa[2] === '9') return limpa.replace(/^(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    // CPF
    if (limpa.length === 11) return limpa.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    
    return chave;
  };

  // ⚙️ FUNÇÃO TÉCNICA (Para gerar o QR Code correto)
  const prepararChaveParaApi = (chave) => {
    if (!chave) return '';
    
    // Se for email, só remove espaços
    if (chave.includes('@')) return chave.trim();
    
    // Se for chave aleatória (tem letras mas não é email), manda limpa
    if (/[a-zA-Z]/.test(chave)) return chave.trim();

    // Remove tudo que não for número
    const limpa = chave.replace(/\D/g, '');

    // LÓGICA DE OURO: Adicionar +55 se for celular
    // Celular Brasil: 11 dígitos e o 3º dígito é 9
    if (limpa.length === 11 && limpa[2] === '9') {
        return `+55${limpa}`;
    }
    
    // Telefone fixo (10 dígitos)
    if (limpa.length === 10) {
         return `+55${limpa}`;
    }

    // CPF (11 dígitos, mas não é celular) ou CNPJ (14), manda apenas números
    return limpa;
  };

  // 🔥 EFEITO CORRIGIDO: Usa a chave preparada (+55) para gerar
  useEffect(() => {
    if (isOpen && selectedPayment === 'pix' && !pixCode && !paymentLoading) {
      const chaveCrua = pixKey || pixConfig?.chave;

      if (chaveCrua) {
        // Prepara a chave (adiciona +55 se precisar)
        const chaveParaApi = prepararChaveParaApi(chaveCrua);
        
        console.log(`🔄 Gerando PIX. Visual: ${chaveCrua} | API: ${chaveParaApi}`);
        generatePixCode(amount, orderId, chaveParaApi);
      } else {
        console.warn("⚠️ Nenhuma chave PIX encontrada.");
      }
    }
  }, [isOpen, selectedPayment, pixCode, amount, orderId, pixConfig, paymentLoading, generatePixCode, pixKey]);

  const handleCopyPixCode = async () => {
    if (!pixCode?.payload_pix) {
      toast.error('❌ Código PIX não disponível');
      return;
    }
    try {
      await navigator.clipboard.writeText(pixCode.payload_pix);
      toast.success('📋 Copiado com sucesso!');
    } catch (error) {
      // Fallback para mobile
      const textArea = document.createElement('textarea');
      textArea.value = pixCode.payload_pix;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('📋 Copiado com sucesso!');
    }
  };

  const handleCopyPixKey = async () => {
    const chave = pixKey || pixConfig?.chave;
    if (!chave) return;
    
    try {
      await navigator.clipboard.writeText(chave);
      toast.success('📋 Chave copiada!');
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = chave;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast.success('📋 Chave copiada!');
    }
  };

  const handleFinishOrder = async () => {
    if (!selectedPayment) return toast.warn("Selecione uma forma de pagamento.");

    setLocalLoading(true);

    try {
      const orderData = {
        orderId,
        amount,
        paymentMethod: selectedPayment,
        items: cartItems,
        customer,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      const result = await submitOrder(orderData);

      if (result.success) {
        const paymentResult = {
          success: true,
          method: selectedPayment,
          transactionId: selectedPayment === 'pix' ? (pixCode?.transaction_id || `pix_${Date.now()}`) : `manual_${Date.now()}`,
          amount: amount,
          orderId: orderId,
          date: new Date().toISOString(),
          status: 'confirmed'
        };

        if (selectedPayment === 'pix') {
          const zapTarget = pixCode?.whatsapp_target || pixConfig?.whatsapp || '';
          const message = `Olá *${establishmentName || 'Restaurante'}*! Fiz o pagamento via PIX do *Pedido #${orderId}*.\nValor: R$ ${parseFloat(amount).toFixed(2)}\n\nEstou enviando o comprovante em anexo.`;
          
          if (zapTarget) {
            window.open(`https://wa.me/${zapTarget}?text=${encodeURIComponent(message)}`, '_blank');
          }
          toast.success("✅ Pedido confirmado! Envie o comprovante.");
        } else {
          toast.success("✅ Pedido Enviado com Sucesso!");
        }

        if (onSuccess) onSuccess(paymentResult);
      }

    } catch (error) {
      console.error('❌ Erro:', error);
      if (onError) onError(error);
      else toast.error('Erro ao processar pedido.');
    } finally {
      setLocalLoading(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentPixKey = pixKey || pixConfig?.chave;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md flex-col sm:flex-row overflow-hidden animate-fade-in-up">
        
        {/* HEADER */}
        <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-700">Pagamento</h2>
          <button 
            onClick={() => { clearPixCode(); onClose(); }}
            className="text-gray-400 hover:text-red-500 text-2xl font-bold px-2"
          >
            &times;
          </button>
        </div>

        {/* BODY */}
        <div className="p-6">
            <div className="text-center mb-6">
                 <p className="text-sm text-gray-500">Total a pagar</p>
                 <p className="text-3xl font-bold text-green-600">R$ {parseFloat(amount).toFixed(2)}</p>
                 <p className="text-xs text-gray-400 mt-1">Pedido: {orderId}</p>
                 {establishmentName && <p className="text-xs text-gray-500 font-semibold">{establishmentName}</p>}
            </div>

          {/* SELETOR DE MÉTODO */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {paymentMethods.filter(m => m.enabled).map(method => (
              <button
                key={method.id}
                onClick={() => {
                  setSelectedPayment(method.type);
                  if (method.type !== 'pix') clearPixCode();
                }}
                className={`p-3 rounded-lg border text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  selectedPayment === method.type
                    ? 'border-green-500 bg-green-50 text-green-700 ring-1 ring-green-500 shadow-sm'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span>{method.icon}</span>
                {method.name}
              </button>
            ))}
          </div>

          {/* 📱 ÁREA DO PIX */}
          {selectedPayment === 'pix' && (
            <div className="animate-fade-in">
              <div className="flex flex-col items-center justify-center mb-4">
                {(!pixCode || paymentLoading) ? (
                  <div className="h-48 w-48 flex flex-col items-center justify-center bg-gray-100 rounded-lg">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                    <span className="text-xs text-gray-500">
                        {currentPixKey ? 'Gerando QR Code...' : 'Aguardando Chave PIX...'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-xl border-2 border-green-500 shadow-sm relative">
                    {pixCode.qr_code_base64 ? (
                        <img 
                        src={pixCode.qr_code_base64} 
                        alt="QR Code PIX" 
                        className="w-48 h-48 object-contain"
                        />
                    ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-center text-red-500 text-xs p-2">
                            Erro ao gerar imagem. Tente copiar o código abaixo.
                        </div>
                    )}
                  </div>
                )}
              </div>

              {/* INFORMAÇÕES PIX */}
              {currentPixKey && (
                <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Chave PIX:</p>
                  <div className="flex items-center justify-between">
                    <div className="overflow-hidden">
                      <code className="text-sm font-mono font-bold text-gray-800 truncate block">
                        {formatarChaveVisual(currentPixKey)}
                      </code>
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {establishmentName || pixConfig?.nome || 'Pagamento'}
                      </p>
                    </div>
                    <button
                      onClick={handleCopyPixKey}
                      className="ml-2 text-green-600 hover:text-green-700 text-xs font-bold bg-green-100 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                    >
                      Copiar Chave
                    </button>
                  </div>
                </div>
              )}

              {/* ALERTA IMPORTANTE */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4 rounded-r">
                <div className="flex">
                  <div className="flex-shrink-0">⚠️</div>
                  <div className="ml-3">
                    <p className="text-xs text-yellow-800 font-medium">
                      Após pagar, envie o comprovante para confirmar.
                    </p>
                  </div>
                </div>
              </div>

              {/* BOTÕES PIX */}
              <div className="space-y-3">
                {pixCode?.payload_pix && (
                  <button
                    onClick={handleCopyPixCode}
                    className="flex-col sm:flex-row bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-gray-300 transition-colors"
                  >
                    <span>📄</span> Copiar Código PIX (Copia e Cola)
                  </button>
                )}
                
                <button
                  onClick={handleFinishOrder}
                  disabled={paymentLoading || localLoading}
                  className="flex-col sm:flex-row bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-transform active:scale-95"
                >
                  {paymentLoading || localLoading ? 'Processando...' : '✅ Enviar Comprovante no WhatsApp'}
                </button>
              </div>
            </div>
          )}

          {/* CARTÃO / DINHEIRO */}
          {selectedPayment && selectedPayment !== 'pix' && (
            <div className="text-center py-4 animate-fade-in">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                  <p className="text-blue-800 font-semibold mb-1">
                      {selectedPayment === 'cash' ? 'Pagamento em Dinheiro' : 'Pagamento com Cartão'}
                  </p>
                  <p className="text-sm text-blue-600">
                      O pagamento será realizado diretamente com o entregador.
                  </p>
              </div>
              
              <button
                onClick={handleFinishOrder}
                disabled={paymentLoading || localLoading}
                className={`flex-col sm:flex-row py-3 rounded-lg font-bold text-white transition-colors ${
                  paymentLoading || localLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-md'
                }`}
              >
                {paymentLoading || localLoading ? 'Processando...' : `Finalizar Pedido - R$ ${parseFloat(amount).toFixed(2)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;