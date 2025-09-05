import { useState, useEffect } from 'react';

const useCarrinho = () => {
  // ... (código do hook que enviei na resposta anterior)
  const [carrinho, setCarrinho] = useState(() => {
    const carrinhoSalvo = localStorage.getItem('carrinho');
    return carrinhoSalvo ? JSON.parse(carrinhoSalvo) : [];
  });

  useEffect(() => {
    localStorage.setItem('carrinho', JSON.stringify(carrinho));
  }, [carrinho]);

  const adicionarAoCarrinho = (produto, quantidade = 1, adicionais = [], observacao = '') => {
    setCarrinho(prevCarrinho => {
      const itemExistente = prevCarrinho.find(
        item => item.id === produto.id && JSON.stringify(item.adicionais) === JSON.stringify(adicionais)
      );

      if (itemExistente) {
        return prevCarrinho.map(item =>
          item.id === produto.id && JSON.stringify(item.adicionais) === JSON.stringify(adicionais)
            ? { ...item, quantidade: item.quantidade + quantidade }
            : item
        );
      } else {
        const precoAdicionais = adicionais.reduce((total, adicional) => total + adicional.preco, 0);
        return [
          ...prevCarrinho,
          { ...produto, quantidade, adicionais, observacao, precoFinal: produto.preco + precoAdicionais }
        ];
      }
    });
  };

  const removerDoCarrinho = (produtoId, adicionais) => {
    setCarrinho(prevCarrinho => {
      return prevCarrinho.filter(
        item => !(item.id === produtoId && JSON.stringify(item.adicionais) === JSON.stringify(adicionais))
      );
    });
  };
  
  const atualizarQuantidade = (produtoId, adicionais, novaQuantidade) => {
    if (novaQuantidade <= 0) {
        removerDoCarrinho(produtoId, adicionais);
    } else {
        setCarrinho(prevCarrinho => 
            prevCarrinho.map(item => 
                (item.id === produtoId && JSON.stringify(item.adicionais) === JSON.stringify(adicionais))
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

  const subtotal = carrinho.reduce((total, item) => total + item.precoFinal * item.quantidade, 0);

  return {
    carrinho,
    adicionarAoCarrinho,
    removerDoCarrinho,
    atualizarQuantidade,
    limparCarrinho,
    subtotal,
  };
};

export default useCarrinho;