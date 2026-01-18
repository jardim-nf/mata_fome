// src/pages/CheckoutPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayment } from '../context/PaymentContext';
import useCarrinho from '../hooks/useCarrinho'; // <--- 1. Importamos o carrinho real
import PaymentSelector from '../components/PaymentSelector';
import RaspadinhaModal from '../components/RaspadinhaModal'; // <--- 2. Importamos a raspadinha
import { toast } from 'react-toastify';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { processPayment } = usePayment();
  
  // --- AQUI MUDOU: Usamos dados reais do carrinho ---
  const { carrinho, subtotal, adicionarAoCarrinho } = useCarrinho();
  
  // Estados para controlar a Raspadinha
  const [showRaspadinha, setShowRaspadinha] = useState(false);
  const [premioAplicado, setPremioAplicado] = useState(null);
  const [jaJogou, setJaJogou] = useState(false);

  // Estados de valores (Taxa e Desconto)
  const [taxaEntrega, setTaxaEntrega] = useState(8.00); 
  const [descontoValor, setDescontoValor] = useState(0);

  // --- O GATILHO: Verifica se deve mostrar a raspadinha ---
  useEffect(() => {
    // Se passou de R$ 100 e ainda não jogou...
    if (subtotal >= 100 && !jaJogou && !premioAplicado) {
        // Espera 1 segundinho e mostra a tela!
        setTimeout(() => {
            setShowRaspadinha(true);
        }, 1000);
    }
  }, [subtotal, jaJogou, premioAplicado]);

  // --- LÓGICA DO PRÊMIO: O que fazer quando ganhar ---
  const handleGanharPremio = (premio) => {
    setShowRaspadinha(false); // Fecha o modal
    setJaJogou(true);         // Marca que já jogou
    setPremioAplicado(premio); // Salva qual foi o prêmio

    if (premio.type === 'desconto') {
        const valorDoDesconto = subtotal * (premio.valor / 100);
        setDescontoValor(valorDoDesconto);
        toast.success(`🎉 Ganhou ${premio.valor}% de desconto!`);
    } 
    else if (premio.type === 'frete') {
        setTaxaEntrega(0);
        toast.success('🎉 Ganhou Frete Grátis!');
    } 
    else if (premio.type === 'brinde') {
        // Adiciona o brinde no carrinho com preço R$ 0,00
        adicionarAoCarrinho(
            { ...premio.produto, id: 'brinde-raspadinha', preco: 0, nome: `${premio.produto.nome} (Brinde)` },
            1,
            [],
            'Ganho na raspadinha'
        );
        toast.success(`🎉 Ganhou ${premio.produto.nome}!`);
    }
  };

  // Cálculo final do total
  const totalFinal = subtotal + taxaEntrega - descontoValor;

  const handlePaymentSuccess = () => {
    toast.success('🎉 Pagamento realizado com sucesso!');
    setTimeout(() => {
      navigate('/historico-pedidos');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 relative">
      
      {/* --- AQUI ENTRA A RASPADINHA (Fica por cima de tudo) --- */}
      {showRaspadinha && (
        <RaspadinhaModal 
            onGanhar={handleGanharPremio} 
            onClose={() => setShowRaspadinha(false)} 
        />
      )}

      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-[#FF6B35] text-white p-6">
            <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
            
            {/* Aviso visual se tiver prêmio aplicado */}
            {premioAplicado && (
                <div className="mt-2 bg-white/20 inline-block px-3 py-1 rounded text-sm font-bold animate-pulse">
                    🎁 Prêmio Ativo: {premioAplicado.label}
                </div>
            )}
          </div>

          <div className="p-6">
            {/* Resumo do Pedido (Agora com dados reais) */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
              <div className="space-y-3">
                {carrinho.map((item, index) => (
                  <div key={item._cartId || index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-medium">{item.nome || item.name}</span>
                      {item.preco === 0 && <span className="text-xs text-[#FF6B35] ml-2 font-bold">PRESENTE</span>}
                      <span className="text-gray-500 ml-2">x{item.quantidade}</span>
                    </div>
                    <span className="font-medium">
                        {item.preco === 0 ? 'Grátis' : `R$ ${(item.precoFinal * item.quantidade).toFixed(2)}`}
                    </span>
                  </div>
                ))}
                
                <div className="flex justify-between py-2 border-b">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>

                {/* Linha do Desconto (só aparece se tiver) */}
                {descontoValor > 0 && (
                    <div className="flex justify-between py-2 border-b text-green-600 font-bold">
                        <span>Desconto Raspadinha</span>
                        <span>- R$ {descontoValor.toFixed(2)}</span>
                    </div>
                )}
                
                <div className="flex justify-between py-2 border-b">
                  <span>Taxa de Entrega</span>
                  {taxaEntrega === 0 ? (
                      <span className="text-green-600 font-bold">Grátis</span>
                  ) : (
                      <span>R$ {taxaEntrega.toFixed(2)}</span>
                  )}
                </div>
                
                <div className="flex justify-between py-3 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#FF6B35]">R$ {totalFinal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Seletor de Pagamento */}
            <PaymentSelector
              amount={totalFinal}
              // Passamos metadata para saber no futuro que esse pedido teve prêmio
              metadata={{ 
                  premioRaspadinha: premioAplicado ? premioAplicado.type : null 
              }}
              onPaymentSuccess={handlePaymentSuccess}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;