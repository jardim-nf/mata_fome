import { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

export function useCart() {
  const [carrinho, setCarrinho] = useState([]);

  const subtotalCalculado = useMemo(() =>
    carrinho.reduce((acc, item) => acc + (item.precoFinal || 0) * item.qtd, 0),
  [carrinho]);

  const adicionarItem = useCallback((item) => {
    const preco = Number(item.precoFinal !== undefined ? item.precoFinal : item.preco) || 0;
    setCarrinho(prev => [...prev, {
      ...item,
      qtd: 1,
      cartItemId: uuidv4(),
      precoFinal: preco,
      observacao: item.observacao || ''
    }]);
    toast.success(`✅ ${item.nome} adicionado!`);
  }, []);

  const alterarQuantidade = useCallback((cartItemId, delta) => {
    setCarrinho(prev => prev.map(item =>
      item.cartItemId === cartItemId
        ? { ...item, qtd: Math.max(1, item.qtd + delta) }
        : item
    ));
  }, []);

  const removerItem = useCallback((cartItemId) => {
    setCarrinho(prev => prev.filter(item => item.cartItemId !== cartItemId));
  }, []);

  const limparCarrinho = useCallback(() => setCarrinho([]), []);

  const adicionarBrinde = useCallback((produto) => {
    setCarrinho(prev => [...prev, {
      ...produto,
      qtd: 1,
      cartItemId: uuidv4(),
      precoFinal: 0,
      nome: `${produto.nome} (Brinde)`,
      observacao: 'Ganho na raspadinha'
    }]);
  }, []);

  return {
    carrinho,
    setCarrinho,
    subtotalCalculado,
    adicionarItem,
    alterarQuantidade,
    removerItem,
    limparCarrinho,
    adicionarBrinde,
  };
}