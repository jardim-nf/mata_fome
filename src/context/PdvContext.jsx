// contexts/PdvContext.jsx
import React, { createContext, useState, useContext } from 'react';

const PdvContext = createContext();

export const usePdv = () => {
  const context = useContext(PdvContext);
  if (!context) {
    throw new Error('usePdv must be used within a PdvProvider');
  }
  return context;
};

export const PdvProvider = ({ children }) => {
  const [vendaAtual, setVendaAtual] = useState(null);
  const [mesas, setMesas] = useState([
    { id: '1', numero: 1, status: 'livre' },
    { id: '2', numero: 2, status: 'livre' },
    { id: '3', numero: 3, status: 'livre' },
    { id: '4', numero: 4, status: 'livre' },
  ]);

  const [produtos, setProdutos] = useState([
    { id: '1', name: 'Hambúrguer', price: 25.90, category: 'lanches' },
    { id: '2', name: 'Pizza', price: 45.90, category: 'lanches' },
    { id: '3', name: 'Refrigerante', price: 8.90, category: 'bebidas' },
    { id: '4', name: 'Suco', price: 12.90, category: 'bebidas' },
  ]);

  const iniciarVenda = (tipo, mesaId = null) => {
    const novaVenda = {
      id: Date.now().toString(),
      tipo,
      mesaId,
      itens: [],
      status: 'aberta',
      formaPagamento: '',
      total: 0,
      dataAbertura: new Date(),
    };
    setVendaAtual(novaVenda);

    // Se for mesa, marca como ocupada
    if (mesaId) {
      setMesas(prev => prev.map(mesa => 
        mesa.id === mesaId ? { ...mesa, status: 'ocupada' } : mesa
      ));
    }
  };

  const adicionarItem = (produto) => {
    if (!vendaAtual) return;

    setVendaAtual(prev => {
      const itemExistente = prev.itens.find(item => item.productId === produto.id);
      
      let novosItens;
      if (itemExistente) {
        novosItens = prev.itens.map(item =>
          item.productId === produto.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        novosItens = [
          ...prev.itens,
          {
            id: Date.now().toString(),
            productId: produto.id,
            name: produto.name,
            price: produto.price,
            quantity: 1,
          }
        ];
      }

      const total = novosItens.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      return {
        ...prev,
        itens: novosItens,
        total,
      };
    });
  };

  const removerItem = (itemId) => {
    if (!vendaAtual) return;

    setVendaAtual(prev => {
      const novosItens = prev.itens.filter(item => item.id !== itemId);
      const total = novosItens.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      return {
        ...prev,
        itens: novosItens,
        total,
      };
    });
  };

  const finalizarVenda = (formaPagamento, valorRecebido = 0) => {
    if (!vendaAtual) return;

    const vendaFinalizada = {
      ...vendaAtual,
      status: 'finalizada',
      formaPagamento,
      valorRecebido,
      troco: formaPagamento === 'dinheiro' ? valorRecebido - vendaAtual.total : 0,
      dataFechamento: new Date(),
    };

    // Libera a mesa se for venda de mesa
    if (vendaAtual.mesaId) {
      setMesas(prev => prev.map(mesa => 
        mesa.id === vendaAtual.mesaId ? { ...mesa, status: 'livre' } : mesa
      ));
    }

    setVendaAtual(null);
    return vendaFinalizada;
  };

  const cancelarVenda = () => {
    if (!vendaAtual) return;

    // Libera a mesa se for venda de mesa
    if (vendaAtual.mesaId) {
      setMesas(prev => prev.map(mesa => 
        mesa.id === vendaAtual.mesaId ? { ...mesa, status: 'livre' } : mesa
      ));
    }

    setVendaAtual(null);
  };

  const value = {
    vendaAtual,
    mesas,
    produtos,
    iniciarVenda,
    adicionarItem,
    removerItem,
    finalizarVenda,
    cancelarVenda,
  };

  return (
    <PdvContext.Provider value={value}>
      {children}
    </PdvContext.Provider>
  );
};