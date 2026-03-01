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
      // 1. Calcular preço final UNITÁRIO (Base + Adicionais)
      // Se tiver variação, usa o preço da variação. Se não, usa o preço do produto.
      const precoBase = produto.variacaoSelecionada 
        ? Number(produto.variacaoSelecionada.preco) 
        : (Number(produto.preco) || 0);

      const precoAdicionais = adicionais.reduce((total, ad) => total + (Number(ad.preco) || 0), 0);
      
      // Preço final de UMA unidade
      const precoFinalUnitario = precoBase + precoAdicionais;

      // 2. Criar Assinatura Única (ID + Variação + Adicionais + Obs)
      // Adicionei 'variacao' aqui para diferenciar itens com variações diferentes (ex: P e G)
      const assinaturaItem = JSON.stringify({
        id: produto.id,
        variacao: produto.variacaoSelecionada?.nome || '', // IMPORTANTE: Agrupa por variação
        adicionais: adicionais.sort((a, b) => a.nome.localeCompare(b.nome)),
        observacao: observacao.trim()
      });

      // 3. Verificar se já existe item igual
      const itemExistenteIndex = prevCarrinho.findIndex(item => {
        const assinaturaExistente = JSON.stringify({
          id: item.id,
          variacao: item.variacaoSelecionada?.nome || '',
          adicionais: item.adicionais ? item.adicionais.sort((a, b) => a.nome.localeCompare(b.nome)) : [],
          observacao: item.observacao ? item.observacao.trim() : ''
        });
        return assinaturaExistente === assinaturaItem;
      });

      if (itemExistenteIndex >= 0) {
        // Se existe, soma a quantidade e atualiza o preço unitário (caso tenha mudado)
        const novoCarrinho = [...prevCarrinho];
        novoCarrinho[itemExistenteIndex].quantidade += quantidade;
        novoCarrinho[itemExistenteIndex].precoFinal = precoFinalUnitario;
        return novoCarrinho;
      } else {
        // Se é novo, cria um objeto limpo
        return [
          ...prevCarrinho,
          {
            ...produto,
            _cartId: generateId(), // ID exclusivo para controle do carrinho
            quantidade,
            adicionais,
            observacao,
            preco: precoBase, // Guarda o preço base real
            precoFinal: precoFinalUnitario // Guarda o preço final unitário calculado
          }
        ];
      }
    });
  };

  const removerDoCarrinho = (cartId) => {
    setCarrinho(prevCarrinho => prevCarrinho.filter(item => item._cartId !== cartId));
  };
  
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

  // Cálculo total: (Preço Unitário * Quantidade) de cada item
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

// ESTA LINHA É FUNDAMENTAL PARA CORRIGIR O ERRO "does not provide an export named 'default'"
export default useCarrinho;