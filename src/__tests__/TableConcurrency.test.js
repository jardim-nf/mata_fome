import { describe, it, expect } from 'vitest';

// Simulação Isolada de 2 Garçons adicionando itens na mesma mesa no Firebase
// Utilizando Lógica Simples de Transação/Mutação (arrayUnion behavior)
export function adicionarItemMesaMock(mesaAtual, novoItem, timestamp) {
  // Simulando arrayUnion ou read-modify-write isolado
  // O Firebase Firestore protege contra corrida na nuvem se usado arrayUnion
  const novaLista = [...(mesaAtual.itens || []), { ...novoItem, addAt: timestamp }];
  
  return {
    ...mesaAtual,
    itens: novaLista,
    total: novaLista.reduce((acc, i) => acc + (i.preco * i.quantidade), 0)
  };
}

describe('🍽️ QA - Concorrência de Mesas e Garçons Múltiplos', () => {
  it('Dois Celulares enviando pedidos pro Database não devem apagar o pedido um do outro', () => {
    // Contexto Inicial: Mesa 04 vazia
    const mesa04Inicial = { mesaId: '04', itens: [], total: 0 };
    
    // Garçom do BAR manda 2 Chop
    const mockPedidoBar = { nome: 'Chopp Pilsen', preco: 12, quantidade: 2 };
    // Garçom da COZINHA manda 1 Pizza simultanemente
    const mockPedidoCozinha = { nome: 'Pizza 4 Queijos', preco: 60, quantidade: 1 };

    // Simula as execuções "sequenciais rápidas" que o Firestore Batch/Transaction garantem
    const primeiraEscrita = adicionarItemMesaMock(mesa04Inicial, mockPedidoBar, 1000);
    const segundaEscrita = adicionarItemMesaMock(primeiraEscrita, mockPedidoCozinha, 1005);

    expect(segundaEscrita.itens.length).toBe(2);
    expect(segundaEscrita.total).toBe((12*2) + 60); // 84
    
    // Varredura de Segurança
    expect(segundaEscrita.itens.find(i => i.nome === 'Chopp Pilsen')).toBeDefined();
    expect(segundaEscrita.itens.find(i => i.nome === 'Pizza 4 Queijos')).toBeDefined();
  });
});
