import { describe, it, expect } from 'vitest';

// Simulação da lógica que está descentralizada no Menu.jsx hoje
export function calcularCarrinho(itens, taxaEntrega, descontoExtra = 0) {
  const subtotalItens = itens.reduce((acc, item) => {
    let un = Number(item.preco) || 0;
    let add = (item.adicionais || []).reduce((a, b) => a + (Number(b.preco) || 0), 0);
    return acc + ((un + add) * (item.quantidade || 1));
  }, 0);

  return Math.max(0, subtotalItens + Number(taxaEntrega) - descontoExtra);
}

describe('🛒 Matemática do Carrinho & Checkout', () => {
  it('Deve calcular 1 produto simples sem taxa corretamente', () => {
    const itens = [{ preco: 15, quantidade: 2 }]; // 30
    expect(calcularCarrinho(itens, 0)).toBe(30);
  });

  it('Deve incorporar adicionais no cálculo', () => {
    const itens = [{ preco: 20, quantidade: 1, adicionais: [{ preco: 5 }] }]; // 25
    expect(calcularCarrinho(itens, 10)).toBe(35); // 25 + taxa 10 = 35
  });

  it('Deve zerar o carrinho se o desconto ultrapassar o total (Sem valor negativo)', () => {
    const itens = [{ preco: 10, quantidade: 1 }]; 
    expect(calcularCarrinho(itens, 5, 50)).toBe(0); // Total era 15, mas desconto foi 50
  });

  it('Protege contra strings e nulls nos dados do Firebase', () => {
    const itens = [{ preco: "10.00", quantidade: "2", adicionais: [{ preco: null }, { preco: "5.50" }] }]; 
    // ((10 + 5.5) * 2) = 31
    expect(calcularCarrinho(itens, "4.00")).toBe(35);
  });
});
