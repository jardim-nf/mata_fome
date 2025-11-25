import { useState, useEffect } from 'react';

// Função auxiliar para gerar ID único (curto e eficiente)
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const useCarrinho = () => {
  const [carrinho, setCarrinho] = useState(() => {
    try {
      const carrinhoSalvo = localStorage.getItem('carrinho');
      return carrinhoSalvo ? JSON.parse(carrinhoSalvo) : [];
    } catch (error) {
      console.error("Erro ao carregar carrinho:", error);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
  }, [carrinho]);

  const adicionarAoCarrinho = (produto, quantidade = 1, adicionais = [], observacao = '') => {
    setCarrinho(prevCarrinho => {
      // Cria uma assinatura única do item para verificar se ele já existe (mesmo produto + mesmas opções + obs)
      // Isso agrupa itens idênticos visualmente
      const assinaturaItem = JSON.stringify({
        id: produto.id,
        adicionais: adicionais.sort((a, b) => a.nome.localeCompare(b.nome)), // Ordena para evitar duplicatas por ordem diferente
        observacao: observacao.trim()
      });

      // Tenta encontrar um item idêntico já no carrinho
      const itemExistenteIndex = prevCarrinho.findIndex(item => {
        const assinaturaExistente = JSON.stringify({
          id: item.id,
          adicionais: item.adicionais ? item.adicionais.sort((a, b) => a.nome.localeCompare(b.nome)) : [],
          observacao: item.observacao ? item.observacao.trim() : ''
        });
        return assinaturaExistente === assinaturaItem;
      });

      if (itemExistenteIndex >= 0) {
        // Se existe igualzinho, apenas aumenta a quantidade do existente
        const novoCarrinho = [...prevCarrinho];
        novoCarrinho[itemExistenteIndex].quantidade += quantidade;
        return novoCarrinho;
      } else {
        // Se é novo, adiciona com um ID único de carrinho (_cartId)
        const precoAdicionais = adicionais.reduce((total, ad) => total + (Number(ad.preco) || 0), 0);
        const precoFinal = (Number(produto.preco) || 0) + precoAdicionais;

        return [
          ...prevCarrinho,
          {
            ...produto,
            _cartId: generateId(), // ID EXCLUSIVO DESTE ITEM NO CARRINHO
            quantidade,
            adicionais,
            observacao,
            precoFinal
          }
        ];
      }
    });
  };

  // AGORA REMOVEMOS PELO ID ÚNICO DO CARRINHO (MUITO MAIS SEGURO)
  const removerDoCarrinho = (cartId) => {
    setCarrinho(prevCarrinho => prevCarrinho.filter(item => item._cartId !== cartId));
  };
  
  // ATUALIZAMOS QUANTIDADE PELO ID ÚNICO TAMBÉM
  const atualizarQuantidade = (cartId, novaQuantidade) => {
    if (novaQuantidade <= 0) {
        removerDoCarrinho(cartId);
    } else {
        setCarrinho(prevCarrinho => 
            prevCarrinho.map(item => 
                item._cartId === cartId 
                ? { ...item, quantidade: novaQuantidade }
                : item
            )
        );
    }
  };

  const limparCarrinho = () => {
    setCarrinho([]);
    localStorage.removeItem('carrinho');
  };

  const subtotal = carrinho.reduce((total, item) => total + (item.precoFinal * item.quantidade), 0);
  const totalItens = carrinho.reduce((total, item) => total + item.quantidade, 0);

  return {
    carrinho,
    adicionarAoCarrinho,
    removerDoCarrinho,
    atualizarQuantidade,
    limparCarrinho,
    subtotal,
    totalItens
  };
};

export default useCarrinho;