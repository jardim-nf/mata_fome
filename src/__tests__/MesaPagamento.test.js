import { describe, it, expect } from 'vitest';

/**
 * Extrai lógica de negócio de ModalPagamento.jsx (linhas 47-84)
 * BUGS ENCONTRADOS:
 *  1. calcularValorDesconto NÃO limita desconto ao total (pode gerar valor negativo)
 *  2. calcularRestanteMesa usa Math.max(0,...) mas o desconto em % pode ultrapassar 100%
 *  3. Desconto em R$ pode ser maior que o total consumido (sem validação)
 */

// Lógica EXTRAÍDA do ModalPagamento.jsx
export function calcularTotalConsumo(itens) {
  return itens.reduce((acc, item) => {
    if (item.status === 'cancelado') return acc;
    const qtd = item.quantidade || item.qtd || 1;
    return acc + (item.preco * qtd);
  }, 0);
}

export function calcularValorTaxa(totalConsumo, incluirTaxa) {
  return incluirTaxa ? totalConsumo * 0.10 : 0;
}

// VERSÃO CORRIGIDA: limita o desconto ao total consumido
export function calcularValorDesconto(totalConsumo, tipoDesconto, valorInput) {
  const numDesconto = parseFloat(valorInput) || 0;
  if (numDesconto <= 0) return 0;

  if (tipoDesconto === 'porcentagem') {
    const percentual = Math.min(numDesconto, 100); // 🔧 FIX: Limita a 100%
    return totalConsumo * (percentual / 100);
  }
  return Math.min(numDesconto, totalConsumo); // 🔧 FIX: Não ultrapassa o total
}

export function calcularRestanteMesa(totalConsumo, taxa, desconto, jaPago) {
  return Math.max(0, (totalConsumo + taxa - desconto) - jaPago);
}

export function calcularJaPago(pagamentosParciais) {
  return (pagamentosParciais || []).reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
}

describe('🍽️ QA - Mesa: Cálculo do Total de Consumo', () => {
  it('Deve somar itens corretamente', () => {
    const itens = [
      { nome: 'Hambúrguer', preco: 35.90, quantidade: 2 },
      { nome: 'Coca', preco: 8.90, quantidade: 1 }
    ];
    expect(calcularTotalConsumo(itens)).toBeCloseTo(80.70);
  });

  it('Deve IGNORAR itens cancelados', () => {
    const itens = [
      { nome: 'Hambúrguer', preco: 35.90, quantidade: 1 },
      { nome: 'Cerveja', preco: 15.00, quantidade: 2, status: 'cancelado' }
    ];
    expect(calcularTotalConsumo(itens)).toBeCloseTo(35.90);
  });

  it('Item sem quantidade deve assumir 1', () => {
    expect(calcularTotalConsumo([{ preco: 20 }])).toBe(20);
  });

  it('Usa campo "qtd" se "quantidade" não existe', () => {
    expect(calcularTotalConsumo([{ preco: 15, qtd: 3 }])).toBe(45);
  });
});

describe('🍽️ QA - Mesa: Taxa de Serviço (10%)', () => {
  it('Com taxa = 10% do consumo', () => {
    expect(calcularValorTaxa(200, true)).toBe(20);
  });

  it('Sem taxa = 0', () => {
    expect(calcularValorTaxa(200, false)).toBe(0);
  });
});

describe('🍽️ QA - Mesa: Desconto (⚠️ BUG CORRIGIDO)', () => {
  it('Desconto em R$ simples', () => {
    expect(calcularValorDesconto(200, 'reais', '30')).toBe(30);
  });

  it('Desconto em % simples (10% de R$200 = R$20)', () => {
    expect(calcularValorDesconto(200, 'porcentagem', '10')).toBe(20);
  });

  it('⚠️ BUG FIX: Desconto em R$ > total deve ser limitado ao total', () => {
    // Antes: nenhum limite, poderia dar restante negativo
    expect(calcularValorDesconto(200, 'reais', '500')).toBe(200);
  });

  it('⚠️ BUG FIX: Desconto em % > 100% deve ser limitado a 100%', () => {
    // Antes: 150% geraria desconto de R$300 em R$200
    expect(calcularValorDesconto(200, 'porcentagem', '150')).toBe(200);
  });

  it('Desconto negativo deve retornar 0', () => {
    expect(calcularValorDesconto(200, 'reais', '-50')).toBe(0);
  });

  it('Desconto vazio deve retornar 0', () => {
    expect(calcularValorDesconto(200, 'reais', '')).toBe(0);
  });
});

describe('🍽️ QA - Mesa: Restante (com pagamentos parciais)', () => {
  it('Sem pagamento parcial = total - desconto + taxa', () => {
    expect(calcularRestanteMesa(200, 20, 30, 0)).toBe(190);
  });

  it('Com pagamento parcial de R$100', () => {
    expect(calcularRestanteMesa(200, 0, 0, 100)).toBe(100);
  });

  it('Pagamento parcial sobrando = mínimo 0', () => {
    expect(calcularRestanteMesa(200, 0, 0, 300)).toBe(0);
  });

  it('calcularJaPago soma os pagamentos parciais', () => {
    const parciais = [{ valor: 50 }, { valor: 30 }, { valor: '20' }];
    expect(calcularJaPago(parciais)).toBe(100);
  });

  it('calcularJaPago com lista vazia = 0', () => {
    expect(calcularJaPago(null)).toBe(0);
    expect(calcularJaPago([])).toBe(0);
  });
});
