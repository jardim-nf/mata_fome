// src/pages/CheckoutPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayment } from '../context/PaymentContext';
import { useCart } from '../hooks/useCart';
import PaymentSelector from '../components/PaymentSelector';
import RaspadinhaModal from '../components/RaspadinhaModal';
import { toast } from 'react-toastify';
import { estoqueService } from '../services/estoqueService';
// 🔥 IMPORTS DO FIREBASE
import { useAuth } from '../context/AuthContext';
import { db, functions } from '../firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore'; 
import { httpsCallable } from 'firebase/functions';

// Normaliza texto para comparação de bairros (igual ao Menu.jsx)
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { processPayment, selectedPayment } = usePayment();
  const { currentUser, currentClientData } = useAuth();
  const { carrinho, subtotalCalculado: subtotal, adicionarBrinde, limparCarrinho } = useCart();
  
  const [showRaspadinha, setShowRaspadinha] = useState(false);
  const [premioAplicado, setPremioAplicado] = useState(null);
  const [jaJogou, setJaJogou] = useState(false);
  // FIX #7: Taxa de entrega dinâmica (não mais hardcoded)
  const [taxaEntrega, setTaxaEntrega] = useState(0);
  const [taxaLoading, setTaxaLoading] = useState(false);
  const [descontoValor, setDescontoValor] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Cupons & Loja Fechada
  const [isFechado, setIsFechado] = useState(false);
  const [cupomInput, setCupomInput] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [descontoCupom, setDescontoCupom] = useState(0);

  // Cashback
  const [saldoCarteira, setSaldoCarteira] = useState(0);
  const [usarCashback, setUsarCashback] = useState(false);
  const [clienteDocRefIdUtilizado, setClienteDocRefIdUtilizado] = useState(null); // Guarda qual doc tem saldo para descontar

  // 🔥 Estado para armazenar o valor mínimo vindo do banco
  const [valorGatilhoRaspadinha, setValorGatilhoRaspadinha] = useState(9999); // Começa alto para não abrir sem querer

  // FIX #7: Busca a taxa de entrega dinamicamente pelo bairro do cliente
  useEffect(() => {
    const buscarTaxaEntrega = async () => {
      const estabId = carrinho[0]?.estabelecimentoId;
      const bairroCliente = currentClientData?.endereco?.bairro;
      if (!estabId || !bairroCliente) {
        setTaxaEntrega(0);
        return;
      }
      setTaxaLoading(true);
      try {
        const taxasSnap = await getDocs(collection(db, 'estabelecimentos', estabId, 'taxasDeEntrega'));
        const bairroNorm = normalizarTexto(bairroCliente);
        let taxa = 0;
        taxasSnap.forEach(docSnap => {
          if (normalizarTexto(docSnap.data().nomeBairro || '').includes(bairroNorm))
            taxa = Number(docSnap.data().valorTaxa);
        });
        setTaxaEntrega(taxa);
        if (taxa === 0 && bairroNorm) {
          toast.info(`Taxa de entrega para "${bairroCliente}" não encontrada. Confirme com a loja.`, { autoClose: 5000 });
        }
      } catch (error) {
        console.error('Erro ao buscar taxa de entrega:', error);
        setTaxaEntrega(0);
      } finally {
        setTaxaLoading(false);
      }
    };
    if (carrinho.length > 0) buscarTaxaEntrega();
  }, [carrinho, currentClientData]);

  // Busca a config da loja (raspadinha e status de funcionamento)
  useEffect(() => {
    const fetchConfigLoja = async () => {
      const estabId = carrinho[0]?.estabelecimentoId;
      if (!estabId) return;
      try {
        const docSnap = await getDoc(doc(db, 'estabelecimentos', estabId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setIsFechado(!!data.forcadoFechado);
          
          const valorMinimo = data.valorMinimoRaspadinha ? parseFloat(data.valorMinimoRaspadinha) : 100;
          setValorGatilhoRaspadinha(valorMinimo);
        }
      } catch (error) {
        console.error('Erro ao buscar config da loja:', error);
      }
    };
    if (carrinho.length > 0) fetchConfigLoja();
  }, [carrinho]);

  // Busca saldo de Cashback do Cliente
  useEffect(() => {
    const fetchCashback = async () => {
      const estabId = carrinho[0]?.estabelecimentoId;
      if (!estabId || !currentUser) return;
      
      let saldoEncontrado = 0;
      let docParaDescontar = null; // Vamos gravar qual documento abater
      try {
        const clienteRefId = doc(db, 'estabelecimentos', estabId, 'clientes', currentUser.uid);
        const clienteDocId = await getDoc(clienteRefId);
        if (clienteDocId.exists()) {
           const sc = Number(clienteDocId.data().saldoCashback) || Number(clienteDocId.data().saldoCarteira) || 0;
           if (sc > 0) {
             saldoEncontrado += sc;
             docParaDescontar = clienteRefId;
           }
        }

        const t = currentClientData?.telefone || currentUser.phoneNumber || '';
        const telefoneFormatado = t.replace(/\D/g, '');
        if (telefoneFormatado && telefoneFormatado !== currentUser.uid) {
           const clienteRefTel = doc(db, 'estabelecimentos', estabId, 'clientes', telefoneFormatado);
           const clienteDocTel = await getDoc(clienteRefTel);
           if (clienteDocTel.exists()) {
               const st = Number(clienteDocTel.data().saldoCashback) || Number(clienteDocTel.data().saldoCarteira) || 0;
               if (st > 0) {
                 saldoEncontrado += st;
                 if (!docParaDescontar) docParaDescontar = clienteRefTel; // Se uid nao tem saldo, desconta do tel
               }
           }
        }
        setSaldoCarteira(saldoEncontrado);
        setClienteDocRefIdUtilizado(docParaDescontar);
      } catch (e) {
        console.error("Erro ao buscar cashback:", e);
      }
    };
    fetchCashback();
  }, [carrinho, currentUser, currentClientData]);

  // Gatilho da raspadinha
  useEffect(() => {
    if (subtotal >= valorGatilhoRaspadinha && !jaJogou && !premioAplicado) {
      setTimeout(() => setShowRaspadinha(true), 1000);
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
        adicionarBrinde(
            { ...premio.produto, id: 'brinde-raspadinha' }
        );
        toast.success(`🎉 Ganhou ${premio.produto.nome}!`);
    }
  };


  const handleAplicarCupom = async () => {
    if (!cupomInput) return;
    const estabId = carrinho[0]?.estabelecimentoId;
    try {
        const codigo = cupomInput.trim().toUpperCase();
        const cupomSnap = await getDoc(doc(db, 'estabelecimentos', estabId, 'cupons', codigo));
        if (cupomSnap.exists()) {
             const cData = cupomSnap.data();
             if (cData.ativo !== false && subtotal >= (cData.valorMinimo || 0)) {
                  if (!cData.limiteUso || (cData.usos || 0) < cData.limiteUso) {
                       setCupomAplicado(codigo);
                       let valorDesconto = 0;
                       if (cData.tipo === 'porcentagem') {
                           valorDesconto = subtotal * (cData.valor / 100);
                       } else {
                           valorDesconto = cData.valor;
                       }
                       setDescontoCupom(valorDesconto);
                       toast.success('Cupom aplicado com sucesso!');
                  } else {
                       toast.error('Este cupom já atingiu o limite de usos.');
                  }
             } else {
                  toast.error('Cupom inválido para o valor atual do carrinho.');
             }
        } else {
            toast.error('Cupom não encontrado.');
        }
    } catch(e) {
        toast.error('Erro ao validar cupom.');
    }
  };

  const subtotalETaxas = subtotal + taxaEntrega - descontoValor - descontoCupom;
  const cashbackAplicado = usarCashback ? Math.min(saldoCarteira, subtotalETaxas) : 0;
  const totalFinal = Math.max(0, subtotalETaxas - cashbackAplicado);

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
        const finalizarFn = httpsCallable(functions, 'finalizarCheckoutDelivery');
        const payload = {
            estabelecimentoId: estabelecimentoId,
            carrinho: carrinho,
            clienteDados: { 
                ...currentClientData, 
                telefone: currentClientData?.telefone || currentUser?.phoneNumber || '' 
            },
            pagamento: selectedPayment,
            cupom: cupomAplicado,
            usarCashback: usarCashback,
            premioRaspadinha: premioAplicado
        };

        const result = await finalizarFn(payload);

        if (result.data.success) {
            toast.success('🎉 Pedido enviado com segurança!');
            limparCarrinho();
            setTimeout(() => { navigate('/historico-pedidos'); }, 2000);
        }

    } catch (error) {
        console.error("Erro ao salvar pedido via backend:", error);
        toast.error(error.message || "Erro ao processar pedido. Tente novamente.");
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
                  <div key={item.cartItemId || index} className="flex justify-between items-center py-2 border-b">
                    <div>
                      <span className="font-medium">{item.nome || item.name}</span>
                      {item.preco === 0 && <span className="text-xs text-[#FF6B35] ml-2 font-bold">PRESENTE</span>}
                      <span className="text-gray-500 ml-2">x{item.qtd}</span>
                    </div>
                    <span className="font-medium">
                        {item.preco === 0 ? 'Grátis' : `R$ ${(item.precoFinal * item.qtd).toFixed(2)}`}
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
                
                {descontoCupom > 0 && (
                    <div className="flex justify-between py-2 border-b text-green-600 font-bold">
                        <span>Cupom ({cupomAplicado})</span>
                        <span>- R$ {descontoCupom.toFixed(2)}</span>
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

                {saldoCarteira > 0 && (
                  <div className="py-2 border-b">
                    <label className="flex items-center space-x-2 cursor-pointer bg-[#00E6A4]/10 p-3 rounded-lg border border-[#00E6A4]/30">
                      <input 
                        type="checkbox" 
                        checked={usarCashback}
                        onChange={(e) => setUsarCashback(e.target.checked)}
                        className="w-5 h-5 text-[#00E6A4] rounded border-gray-300 focus:ring-[#00E6A4]"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800">Usar Saldo da Carteira</span>
                        <span className="text-xs text-gray-600">Ter de volta: R$ {saldoCarteira.toFixed(2)}</span>
                      </div>
                    </label>
                  </div>
                )}

                {cashbackAplicado > 0 && (
                  <div className="flex justify-between py-2 border-b text-[#00E6A4] font-bold">
                      <span>Cashback Aplicado</span>
                      <span>- R$ {cashbackAplicado.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between py-3 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#FF6B35]">R$ {totalFinal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="block text-sm font-bold text-gray-700 mb-2">Cupom de Desconto</label>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={cupomInput}
                  onChange={(e) => setCupomInput(e.target.value)}
                  disabled={!!cupomAplicado}
                  placeholder="Ex: QUERO10"
                  className="flex-1 border rounded-lg px-3 py-2 uppercase text-sm focus:ring-[#FF6B35] focus:border-[#FF6B35]"
                />
                <button 
                  onClick={handleAplicarCupom}
                  disabled={!cupomInput || !!cupomAplicado}
                  className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 hover:bg-gray-700"
                >
                  {cupomAplicado ? 'Aplicado' : 'Aplicar'}
                </button>
              </div>
            </div>

            {isFechado ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-6 rounded text-center">
                    <span className="block text-3xl mb-2">🚫</span>
                    <strong className="block text-lg">Restaurante Fechado</strong>
                    <span className="block text-sm mt-1">No momento não estamos aceitando novos pedidos.</span>
                </div>
            ) : (
                <PaymentSelector
                  amount={totalFinal}
                  metadata={{ 
                      premioRaspadinha: premioAplicado ? premioAplicado.type : null,
                      cupomAplicado: cupomAplicado 
                  }}
                  onPaymentSuccess={handlePaymentSuccess}
                />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;