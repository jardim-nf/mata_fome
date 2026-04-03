import { useState, useMemo, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

const CART_KEY = 'ideafood_carrinho';
const CART_TIME_KEY = 'ideafood_carrinho_time';

export function useCart() {
  // Recuperar carrinho do localStorage
  const [carrinho, setCarrinho] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      const savedTime = localStorage.getItem(CART_TIME_KEY);
      if (saved && savedTime) {
        const hoursAgo = (Date.now() - Number(savedTime)) / 3600000;
        if (hoursAgo < 24) return JSON.parse(saved); // Carrinho válido por 24h
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(CART_TIME_KEY);
      }
    } catch (e) {
      console.warn('[useCart] Erro ao recuperar carrinho do localStorage:', e);
    }
    return [];
  });

  const [carrinhoRecuperado, setCarrinhoRecuperado] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_KEY);
      return saved && JSON.parse(saved).length > 0;
    } catch (e) { 
      console.warn('[useCart] Erro ao verificar status do carrinho recuperado:', e);
      return false; 
    }
  });

  // Salvar carrinho no localStorage a cada mudança
  useEffect(() => {
    if (carrinho.length > 0) {
      localStorage.setItem(CART_KEY, JSON.stringify(carrinho));
      localStorage.setItem(CART_TIME_KEY, String(Date.now()));
    } else {
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(CART_TIME_KEY);
    }
  }, [carrinho]);

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
    setCarrinhoRecuperado(false);
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

  const limparCarrinho = useCallback(() => {
    setCarrinho([]);
    setCarrinhoRecuperado(false);
  }, []);

  const descartarRecuperacao = useCallback(() => {
    setCarrinhoRecuperado(false);
    setCarrinho([]);
  }, []);

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
    carrinhoRecuperado,
    descartarRecuperacao,
  };
}