import { describe, it, expect } from 'vitest';

// Extrai a função formatarData do printService.js (linhas 18-22)
export function formatarData(dataBase) {
  if (!dataBase) return new Date().toLocaleString('pt-BR');
  const d = dataBase.toDate ? dataBase.toDate() : new Date(dataBase);
  return d.toLocaleString('pt-BR');
}

// Extrai lógica de extração de ID do printService.js (linhas 49-50)
export function extrairShortId(orderId) {
  if (!orderId || typeof orderId !== 'string') return '000000';
  return orderId.slice(-6).toUpperCase();
}

// Extrai lógica de detecção delivery do printService.js (linha 57)
export function isDeliveryOrder(pedido) {
  return pedido.source !== 'salao' && pedido.tipo !== 'mesa' && !pedido.mesaNumero;
}

// Extrai lógica de nome do cliente do printService.js (linha 58)
export function extrairNomeCliente(pedido) {
  return pedido.cliente?.nome || pedido.nome || 'Mesa ' + (pedido.mesaNumero || pedido.numero || '');
}

// Extrai lógica de subtotal do printService.js (linhas 123-129)
export function calcularSubtotalComanda(pedido) {
  const total = Number(pedido.totalFinal || pedido.total || 0) || 0;
  const taxa = Number(pedido.taxaEntrega || 0) || 0;
  const desconto = Number(pedido.valorDesconto || 0) || 0;

  let subtotal = total - taxa + desconto;
  if (subtotal < 0) subtotal = total; // Previne negativo
  return { total, taxa, desconto, subtotal };
}

// Extrai lógica do troco impresso (linhas 148-152)
export function calcularTrocoComanda(pedido) {
  const total = Number(pedido.totalFinal || pedido.total || 0) || 0;
  const troco = Number(pedido.trocoPara || 0);
  if (troco > 0) return { trocoPara: troco, levarTroco: troco - total };
  return null;
}

// Extrai lógica de extração de complementos (linhas 101-106)
export function extrairComplementosItem(item) {
  return item.adicionaisSelecionados || item.adicionais || [];
}

describe('🖨️ QA - Layout ESC/POS: Extração de ID do Pedido', () => {
  it('ID normal deve retornar últimos 6 chars em UPPERCASE', () => {
    expect(extrairShortId('abc123def456')).toBe('DEF456');
  });

  it('ID curto deve retornar o que tem', () => {
    expect(extrairShortId('AB')).toBe('AB');
  });

  it('Null/undefined deve retornar fallback 000000', () => {
    expect(extrairShortId(null)).toBe('000000');
    expect(extrairShortId(undefined)).toBe('000000');
  });
});

describe('🖨️ QA - Layout ESC/POS: Detecção de Tipo', () => {
  it('Pedido delivery deve ser detectado', () => {
    expect(isDeliveryOrder({ tipo: 'delivery', source: null })).toBe(true);
  });

  it('Pedido de mesa NÃO é delivery', () => {
    expect(isDeliveryOrder({ tipo: 'mesa' })).toBe(false);
  });

  it('Pedido de salão NÃO é delivery', () => {
    expect(isDeliveryOrder({ source: 'salao' })).toBe(false);
  });

  it('Pedido com mesaNumero NÃO é delivery', () => {
    expect(isDeliveryOrder({ mesaNumero: 5 })).toBe(false);
  });
});

describe('🖨️ QA - Layout ESC/POS: Nome do Cliente', () => {
  it('Deve usar cliente.nome quando disponível', () => {
    expect(extrairNomeCliente({ cliente: { nome: 'João' } })).toBe('João');
  });

  it('Deve usar nome raiz quando não tem cliente aninhado', () => {
    expect(extrairNomeCliente({ nome: 'Maria' })).toBe('Maria');
  });

  it('Mesa sem nome = "Mesa X"', () => {
    expect(extrairNomeCliente({ mesaNumero: 7 })).toBe('Mesa 7');
  });
});

describe('🖨️ QA - Layout ESC/POS: Cálculo do Subtotal', () => {
  it('Total R$108, taxa R$8, desconto R$0 → subtotal R$100', () => {
    const r = calcularSubtotalComanda({ totalFinal: 108, taxaEntrega: 8 });
    expect(r.subtotal).toBe(100);
    expect(r.total).toBe(108);
  });

  it('Total R$90, taxa R$10, desconto R$15 → subtotal R$95', () => {
    const r = calcularSubtotalComanda({ totalFinal: 90, taxaEntrega: 10, valorDesconto: 15 });
    expect(r.subtotal).toBe(95); // 90 - 10 + 15
  });

  it('Subtotal negativo impossível → fallback para total', () => {
    const r = calcularSubtotalComanda({ totalFinal: 5, taxaEntrega: 50 });
    expect(r.subtotal).toBe(5); // fallback
  });
});

describe('🖨️ QA - Layout ESC/POS: Troco Impresso', () => {
  it('Troco para R$100 em pedido de R$75 = levar R$25', () => {
    const r = calcularTrocoComanda({ totalFinal: 75, trocoPara: 100 });
    expect(r.levarTroco).toBe(25);
  });

  it('Pedido sem troco (pagamento exato ou PIX) = null', () => {
    const r = calcularTrocoComanda({ totalFinal: 50 });
    expect(r).toBeNull();
  });
});

describe('🖨️ QA - Layout ESC/POS: Complementos do Item', () => {
  it('Deve preferir adicionaisSelecionados (campo do Menu.jsx)', () => {
    const item = { adicionaisSelecionados: [{ nome: 'Bacon' }], adicionais: [{ nome: 'Queijo' }] };
    const comps = extrairComplementosItem(item);
    expect(comps[0].nome).toBe('Bacon');
  });

  it('Deve usar fallback adicionais se adicionaisSelecionados não existe', () => {
    const item = { adicionais: [{ nome: 'Cheddar' }] };
    const comps = extrairComplementosItem(item);
    expect(comps[0].nome).toBe('Cheddar');
  });

  it('Sem complementos = array vazio (sem crash)', () => {
    const comps = extrairComplementosItem({});
    expect(comps).toEqual([]);
  });
});
