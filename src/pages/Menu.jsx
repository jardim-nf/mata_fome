// src/pages/Menu.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Importe useNavigate
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, Timestamp, query, onSnapshot, orderBy } from 'firebase/firestore';
import CardapioItem from '../components/CardapioItem';
import { useAuth } from '../context/AuthContext';

function Menu() {
  const { estabelecimentoId } = useParams();
  const navigate = useNavigate(); // Inicialize useNavigate
  const { currentUser, currentClientData, loading: authLoading } = useAuth();
  
  const [carrinho, setCarrinho] = useState([]);
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [complemento, setComplemento] = useState(''); 

  const [formaPagamento, setFormaPagamento] = useState('');
  const [trocoPara, setTrocoPara] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState(0);

  const [produtos, setProdutos] = useState([]);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Carregando Cardápio...");
  const [estabelecimentoInfo, setEstabelecimentoInfo] = useState(null);
  
  // Efeito para preencher nome, telefone e endereço do cliente logado ou do localStorage
  useEffect(() => {
    if (!authLoading) {
      if (currentUser && currentClientData) {
        setNomeCliente(currentClientData.nome || '');
        setTelefoneCliente(currentClientData.telefone || '');
        
        if (currentClientData.endereco) {
            setRua(currentClientData.endereco.rua || '');
            setNumero(currentClientData.endereco.numero || '');
            setBairro(currentClientData.endereco.bairro || '');
            setComplemento(currentClientData.endereco.complemento || '');
        } else {
            setNomeCliente(localStorage.getItem('nomeCliente') || '');
            setTelefoneCliente(localStorage.getItem('telefoneCliente') || '');
            setRua(localStorage.getItem('rua') || '');
            setNumero(localStorage.getItem('numero') || '');
            setBairro(localStorage.getItem('bairro') || '');
            setComplemento(localStorage.getItem('complemento') || '');
        }
      } else {
        setNomeCliente(localStorage.getItem('nomeCliente') || '');
        setTelefoneCliente(localStorage.getItem('telefoneCliente') || '');
        setRua(localStorage.getItem('rua') || '');
        setNumero(localStorage.getItem('numero') || '');
        setBairro(localStorage.getItem('bairro') || '');
        setComplemento(localStorage.getItem('complemento') || '');
      }
    }
  }, [currentUser, currentClientData, authLoading]);

  // Efeito para carregar os produtos do Firestore e informações do estabelecimento
  useEffect(() => {
    if (!estabelecimentoId) {
      setNomeEstabelecimento("Nenhum estabelecimento selecionado.");
      return;
    }

    let unsubscribeCardapio; 

    const fetchEstabelecimentoAndCardapio = async () => {
      try {
        const estabelecimentoRef = doc(db, 'estabelecimentos', estabelecimentoId);
        const estabelecimentoSnap = await getDoc(estabelecimentoRef);

        if (estabelecimentoSnap.exists()) {
          const data = estabelecimentoSnap.data();
          setEstabelecimentoInfo(data);
          setNomeEstabelecimento(data.nome || "Cardápio");
          
          setTaxaEntrega(data.taxaEntrega || 0); 

          const cardapioRef = collection(db, 'estabelecimentos', estabelecimentoId, 'cardapio');
          const q = query(cardapioRef, orderBy('nome'));
          
          unsubscribeCardapio = onSnapshot(q, (snapshot) => { 
            const produtosData = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            setProdutos(produtosData);
          });
          
        } else {
          setNomeEstabelecimento("Estabelecimento não encontrado.");
          setProdutos([]);
        }
      } catch (error) {
        console.error("Erro ao carregar cardápio:", error);
        setNomeEstabelecimento("Erro ao carregar cardápio.");
        setProdutos([]);
      }
    };

    fetchEstabelecimentoAndCardapio(); 

    return () => {
      if (unsubscribeCardapio) {
        unsubscribeCardapio();
      }
    };
  }, [estabelecimentoId]);

  const adicionarAoCarrinho = (item) => {
    const existe = carrinho.find((p) => p.id === item.id);
    if (existe) {
      setCarrinho(carrinho.map((p) => (p.id === item.id ? { ...p, qtd: p.qtd + 1 } : p)));
    } else {
      setCarrinho([...carrinho, { ...item, qtd: 1 }]);
    }
  };

  const removerDoCarrinho = (id) => {
    const produtoNoCarrinho = carrinho.find((p) => p.id === id);
    if (!produtoNoCarrinho) return;

    if (produtoNoCarrinho.qtd === 1) {
      setCarrinho(carrinho.filter((p) => p.id !== id));
    } else {
      setCarrinho(carrinho.map((p) => (p.id === id ? { ...p, qtd: p.qtd - 1 } : p)));
    }
  };

  const enviarPedido = async () => {
    const subtotalCalculado = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
    const totalComTaxaCalculado = subtotalCalculado + taxaEntrega;

    if (
      !nomeCliente.trim() || 
      !telefoneCliente.trim() || 
      !rua.trim() || 
      !numero.trim() || 
      !bairro.trim() || 
      carrinho.length === 0 ||
      !formaPagamento
    ) {
      alert('Por favor, preencha todos os seus dados, adicione itens ao carrinho e selecione uma forma de pagamento.');
      return;
    }

    let valorTrocoPara = null;
    if (formaPagamento === 'dinheiro' && trocoPara.trim() !== '') {
        const trocoNum = Number(trocoPara);
        if (trocoNum > totalComTaxaCalculado) { 
            valorTrocoPara = trocoNum;
        } else {
            alert(`O valor para troco (R$ ${trocoNum.toFixed(2)}) deve ser maior que o total do pedido (R$ ${totalComTaxaCalculado.toFixed(2)}).`);
            return;
        }
    }

    if (!currentUser) { 
      localStorage.setItem('nomeCliente', nomeCliente.trim());
      localStorage.setItem('telefoneCliente', telefoneCliente.trim());
      localStorage.setItem('rua', rua.trim());
      localStorage.setItem('numero', numero.trim());
      localStorage.setItem('bairro', bairro.trim());
      localStorage.setItem('complemento', complemento.trim());
    }

    const pedido = {
      cliente: { 
        nome: nomeCliente.trim(), 
        telefone: telefoneCliente.trim(),
        endereco: {
          rua: rua.trim(),
          numero: numero.trim(),
          bairro: bairro.trim(),
          complemento: complemento.trim() 
        }
      },
      estabelecimentoId: estabelecimentoId,
      itens: carrinho.map(item => ({ 
        nome: item.nome, 
        quantidade: item.qtd, 
        preco: Number(item.preco),
        imageUrl: item.imageUrl 
      })),
      status: 'recebido',
      criadoEm: Timestamp.now(),
      formaPagamento: formaPagamento,
      trocoPara: valorTrocoPara,
      taxaEntrega: taxaEntrega,
      totalFinal: totalComTaxaCalculado
    };

    try {
      const docRef = await addDoc(collection(db, 'pedidos'), pedido);
      
      // Opcional: Navegar para a comanda na mesma aba
      navigate(`/comanda/${docRef.id}`); 
      // Ou, se preferir abrir em nova aba para impressão imediata (o que estava antes):
      // window.open(`/comanda/${docRef.id}`, '_blank');

      alert('🎉 Seu pedido foi enviado com sucesso! Aguarde a confirmação.');
      setCarrinho([]);
      setFormaPagamento('');
      setTrocoPara('');

    } catch (error) {
      console.error("Erro ao enviar pedido: ", error);
      alert("❌ Ocorreu um erro ao enviar seu pedido. Por favor, tente novamente.");
    }
  };

  const subtotalPedido = carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  const totalPedidoComTaxa = subtotalPedido + taxaEntrega;

  return (
    <div className="p-4 max-w-3xl mx-auto mb-20 md:mb-0"> {/* Adicionado mb-20 para dar espaço para o botão fixo no mobile */}
      <h1 className="text-3xl font-bold text-center text-[var(--vermelho-principal)] mb-4">
        Cardápio de {nomeEstabelecimento}
      </h1>
      {estabelecimentoInfo && estabelecimentoInfo.descricao && (
        <p className="text-center text-[var(--cinza-texto)] mb-8">{estabelecimentoInfo.descricao}</p>
      )}

      {/* Seção de Produtos */}
      {produtos.length === 0 && nomeEstabelecimento !== "Carregando Cardápio..." ? (
        <p className="text-center text-gray-500 italic mt-8">Nenhum item disponível neste cardápio ou estabelecimento não encontrado.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {produtos.map((item) => (
            <CardapioItem
              key={item.id}
              item={item}
              cartItem={carrinho.find(p => p.id === item.id)}
              addToCart={adicionarAoCarrinho}
              removeFromCart={removerDoCarrinho}
            />
          ))}
        </div>
      )}

      {/* SEU PEDIDO (RESUMO DO CARRINHO) */}
      <div className="bg-white p-6 mt-10 rounded-lg shadow-xl border border-gray-200">
        <h2 className="font-bold text-2xl mb-4 text-[var(--marrom-escuro)]">Seu Pedido</h2>
        
        {carrinho.length === 0 ? (
          <p className="text-gray-500 italic text-center py-4">
            🛒 Nenhum item adicionado ainda. Comece a escolher!
          </p>
        ) : (
          <>
            <ul className="mb-4 space-y-3">
              {carrinho.map((item) => (
                <li key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-100">
                  <span className="font-medium text-[var(--cinza-texto)]">
                    {item.nome} <span className="text-sm text-gray-500">({item.qtd}x)</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => removerDoCarrinho(item.id)}
                      className="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                      aria-label={`Remover um ${item.nome}`}
                    >
                      -
                    </button>
                    <span className="font-semibold text-[var(--marrom-escuro)]">R$ {(item.preco * item.qtd).toFixed(2)}</span>
                    <button
                      onClick={() => adicionarAoCarrinho(item)}
                      className="bg-[var(--verde-destaque)] hover:bg-green-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
                      aria-label={`Adicionar mais um ${item.nome}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            
            <div className="border-t border-gray-200 pt-4 mt-4 text-[var(--marrom-escuro)]">
              <div className="flex justify-between items-center text-lg mb-1">
                <span>Subtotal:</span>
                <span>R$ {subtotalPedido.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-lg mb-2">
                <span>Taxa de Entrega:</span>
                <span>R$ {taxaEntrega.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-bold">
                <span>Total:</span>
                <span>R$ {totalPedidoComTaxa.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        {/* DADOS DO CLIENTE E ENDEREÇO */}
        <div className="mb-4 mt-6">
          <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Seus Dados</h3>
          <div className="mb-4">
            <label htmlFor="nomeCliente" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Seu Nome *</label>
            <input
              id="nomeCliente"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              placeholder="Ex: Ana Silva"
              required
              disabled={!!currentUser} 
            />
          </div>
          <div className="mb-6">
            <label htmlFor="telefoneCliente" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Seu Telefone (com DDD) *</label>
            <input
              id="telefoneCliente"
              value={telefoneCliente}
              onChange={(e) => setTelefoneCliente(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              placeholder="Ex: 22999999999"
              type="tel"
              required
              disabled={!!currentUser}
            />
          </div>

          {/* CAMPOS DE ENDEREÇO */}
          <div className="mb-4">
            <label htmlFor="rua" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Rua *</label>
            <input
              id="rua"
              value={rua}
              onChange={(e) => setRua(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              placeholder="Ex: Rua das Flores"
              required
              disabled={!!currentUser && currentClientData?.endereco?.rua} 
            />
          </div>
          <div className="mb-4 flex gap-4">
            <div className="flex-1">
              <label htmlFor="numero" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Número *</label>
              <input
                id="numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                placeholder="Ex: 123"
                required
                disabled={!!currentUser && currentClientData?.endereco?.numero}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="bairro" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Bairro *</label>
              <input
                id="bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                placeholder="Ex: Centro"
                required
                disabled={!!currentUser && currentClientData?.endereco?.bairro}
              />
            </div>
          </div>
          <div className="mb-6">
            <label htmlFor="complemento" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">Complemento / Ponto de Referência</label>
            <input
              id="complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
              placeholder="Ex: Apt 101, Próximo à praça"
              disabled={!!currentUser && currentClientData?.endereco?.complemento}
            />
          </div>
        </div>

        {/* --- SEÇÃO: FORMA DE PAGAMENTO --- */}
        <div className="bg-white p-6 mt-6 rounded-lg shadow-xl border border-gray-200">
            <h3 className="font-bold text-xl mb-3 text-[var(--marrom-escuro)]">Forma de Pagamento *</h3>
            <div className="space-y-3">
                <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                    <input 
                        type="radio" 
                        name="paymentMethod" 
                        value="pix" 
                        checked={formaPagamento === 'pix'} 
                        onChange={(e) => setFormaPagamento(e.target.value)}
                        className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                    />
                    PIX
                </label>
                <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                    <input 
                        type="radio" 
                        name="paymentMethod" 
                        value="cartao" 
                        checked={formaPagamento === 'cartao'} 
                        onChange={(e) => setFormaPagamento(e.target.value)}
                        className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                    />
                    Cartão (Crédito/Débito na entrega)
                </label>
                <label className="flex items-center text-base text-[var(--cinza-texto)] cursor-pointer">
                    <input 
                        type="radio" 
                        name="paymentMethod" 
                        value="dinheiro" 
                        checked={formaPagamento === 'dinheiro'} 
                        onChange={(e) => setFormaPagamento(e.target.value)}
                        className="mr-2 h-4 w-4 text-[var(--vermelho-principal)] focus:ring-[var(--vermelho-principal)]"
                    />
                    Dinheiro
                </label>
            </div>

            {/* Campo para troco, visível APENAS se "Dinheiro" for selecionado */}
            {formaPagamento === 'dinheiro' && (
                <div className="mt-4">
                    <label htmlFor="troco" className="block text-sm font-medium text-[var(--cinza-texto)] mb-1">
                        Precisa de troco para? (Opcional)
                    </label>
                    <input
                        id="troco"
                        type="number"
                        value={trocoPara}
                        onChange={(e) => setTrocoPara(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-[var(--vermelho-principal)] focus:border-[var(--vermelho-principal)]"
                        placeholder={`Ex: R$ ${(totalPedidoComTaxa + 10).toFixed(2)}`} 
                    />
                </div>
            )}
        </div>
        {/* --- FIM SEÇÃO: FORMA DE PAGAMENTO --- */}

      </div> {/* Fim do div que encapsula o pedido e dados */}

      {/* --- NOVO: BOTÃO DE ENVIO FIXO NO RODAPÉ PARA MOBILE --- */}
      {carrinho.length > 0 && ( // Só mostra o botão se houver itens no carrinho
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-4 shadow-lg z-50 md:relative md:p-0 md:mt-8 md:border-none md:shadow-none">
          <button
            onClick={enviarPedido}
            className="bg-[var(--vermelho-principal)] text-white px-6 py-3 rounded-lg hover:bg-red-700 transition duration-300 ease-in-out w-full text-lg font-semibold shadow-lg"
            disabled={!nomeCliente.trim() || !telefoneCliente.trim() || !rua.trim() || !numero.trim() || !bairro.trim() || !formaPagamento}
          >
            Enviar Pedido Agora!
          </button>
        </div>
      )}
      {/* --- FIM NOVO BOTÃO FIXO --- */}

    </div> // Fim do div principal .p-4 .max-w-3xl .mx-auto

  );
}

export default Menu;