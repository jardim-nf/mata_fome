// src/pages/CheckoutPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayment } from '../context/PaymentContext';
import useCarrinho from '../hooks/useCarrinho';
import PaymentSelector from '../components/PaymentSelector';
import RaspadinhaModal from '../components/RaspadinhaModal';
import { toast } from 'react-toastify';
import { estoqueService } from '../services/estoqueService';
// 🔥 IMPORTS DO FIREBASE
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore'; 

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { processPayment, selectedPayment } = usePayment();
  const { currentUser, currentClientData } = useAuth();
  const { carrinho, subtotal, adicionarAoCarrinho, limparCarrinho } = useCarrinho();
  
  const [showRaspadinha, setShowRaspadinha] = useState(false);
  const [premioAplicado, setPremioAplicado] = useState(null);
  const [jaJogou, setJaJogou] = useState(false);
  const [taxaEntrega, setTaxaEntrega] = useState(8.00); 
  const [descontoValor, setDescontoValor] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // 🔥 Estado para armazenar o valor mínimo vindo do banco
  const [valorGatilhoRaspadinha, setValorGatilhoRaspadinha] = useState(9999); // Começa alto para não abrir sem querer

  // 1. useEffect para buscar a configuração da loja
  useEffect(() => {
    const fetchConfigRaspadinha = async () => {
        const estabId = carrinho[0]?.estabelecimentoId;
        if (!estabId) return;

        try {
            const docRef = doc(db, 'estabelecimentos', estabId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Pega o valor ou define 100 como padrão se não tiver configurado
                const valorMinimo = data.valorMinimoRaspadinha ? parseFloat(data.valorMinimoRaspadinha) : 100;
                setValorGatilhoRaspadinha(valorMinimo);
            }
        } catch (error) {
            console.error("Erro ao buscar config da raspadinha:", error);
        }
    };

    if (carrinho.length > 0) {
        fetchConfigRaspadinha();
    }
  }, [carrinho]);

  // 2. useEffect do Gatilho (Agora usa a variável dinâmica)
  useEffect(() => {
    // 🔥 Agora compara com 'valorGatilhoRaspadinha' em vez de 100 fixo
    if (subtotal >= valorGatilhoRaspadinha && !jaJogou && !premioAplicado) {
        setTimeout(() => {
            setShowRaspadinha(true);
        }, 1000);
    }
  }, [subtotal, jaJogou, premioAplicado, valorGatilhoRaspadinha]);

  const handleGanharPremio = (premio) => {
    setShowRaspadinha(false);
    setJaJogou(true);
    setPremioAplicado(premio);

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
        adicionarAoCarrinho(
            { ...premio.produto, id: 'brinde-raspadinha', preco: 0, nome: `${premio.produto.nome} (Brinde)` },
            1,
            [],
            'Ganho na raspadinha'
        );
        toast.success(`🎉 Ganhou ${premio.produto.nome}!`);
    }
  };

  const totalFinal = subtotal + taxaEntrega - descontoValor;

  const handlePaymentSuccess = async () => {
    if (isSaving) return;
    
    const estabelecimentoId = carrinho[0]?.estabelecimentoId;

    if (!estabelecimentoId) {
        toast.error("Erro crítico: Estabelecimento não identificado.");
        return;
    }

    if (!currentUser) {
        toast.error("Você precisa estar logado.");
        navigate('/login');
        return;
    }

    setIsSaving(true);

    try {
        const pedido = {
            clienteId: currentUser.uid,
            clienteNome: currentClientData?.nome || currentUser.displayName || 'Cliente App',
            clienteTelefone: currentClientData?.telefone || '',
            
            endereco: currentClientData?.endereco || { 
                rua: 'Endereço não cadastrado', 
                numero: 'S/N', 
                bairro: 'Verificar com cliente' 
            },
            
            itens: carrinho,
            total: totalFinal,
            
            formaPagamento: selectedPayment || 'Não selecionado',
            metodoPagamento: selectedPayment, 
            
            tipoEntrega: 'delivery',
            status: 'recebido',
            createdAt: Timestamp.now(),
            dataPedido: Timestamp.now(),
            
            descontoAplicado: descontoValor,
            premioRaspadinha: premioAplicado ? premioAplicado.type : null,
            estabelecimentoId: estabelecimentoId
        };

        // Salva o pedido no Firestore
        await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos'), pedido);

        // 🔥 NOVA LINHA: CHAMA A BAIXA DE ESTOQUE APÓS SALVAR O PEDIDO
        await estoqueService.darBaixaEstoque(estabelecimentoId, carrinho);

        toast.success('🎉 Pedido enviado para a loja!');
        limparCarrinho();
        setTimeout(() => { navigate('/historico-pedidos'); }, 2000);

    } catch (error) {
        console.error("Erro ao salvar pedido:", error);
        toast.error("Erro ao processar pedido. Tente novamente.");
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 relative">
      {showRaspadinha && (
        <RaspadinhaModal 
            onGanhar={handleGanharPremio} 
            onClose={() => setShowRaspadinha(false)} 
        />
      )}

      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-[#FF6B35] text-white p-6">
            <h1 className="text-2xl font-bold">Finalizar Pedido</h1>
            {premioAplicado && (
                <div className="mt-2 bg-white/20 inline-block px-3 py-1 rounded text-sm font-bold animate-pulse">
                    🎁 Prêmio Ativo: {premioAplicado.label}
                </div>
            )}
          </div>

          <div className="p-6">
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Resumo do Pedido</h2>
              
              {currentClientData?.endereco && (
                  <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                      <p className="font-bold text-gray-700">📍 Entregar em:</p>
                      <p>{currentClientData.endereco.rua}, {currentClientData.endereco.numero} - {currentClientData.endereco.bairro}</p>
                  </div>
              )}

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

            <PaymentSelector
              amount={totalFinal}
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