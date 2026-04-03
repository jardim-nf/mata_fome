import { describe, it, expect } from 'vitest';

// Extrai lógica de deduplicação do AdminReports.jsx (linhas 196-221)
export function gerarBusinessKey(item) {
  const mesa = item.mesaNumero || item.mesaId || '';
  const total = (item.totalFinal || 0).toFixed(2);
  const dia = item.data ? `${item.data.getFullYear()}-${String(item.data.getMonth()+1).padStart(2,'0')}-${String(item.data.getDate()).padStart(2,'0')}` : '';

  if (mesa) {
    return `mesa_${mesa}_${total}_${dia}`;
  }

  const cliente = (item.clienteNome || '').toLowerCase().trim();
  const pagamento = (item.formaPagamento || '').toLowerCase().trim();
  if (cliente && total !== '0.00') {
    return `delivery_${cliente}_${total}_${pagamento}_${dia}`;
  }

  if (item.pedidoId) {
    return `ref_${item.pedidoId}`;
  }

  return null;
}

// Simula o addData com dedup completa
export function adicionarComDedup(mapa, businessKeySet, item) {
  if (mapa.has(item.id)) return false; // doc duplicado
  if (item.pedidoId && mapa.has(item.pedidoId)) return false; // referência cruzada
  for (const [, existing] of mapa) {
    if (existing.pedidoId === item.id) return false;
  }
  const bk = gerarBusinessKey(item);
  if (bk && businessKeySet.has(bk)) return false; // business key duplicada
  
  mapa.set(item.id, item);
  if (bk) businessKeySet.add(bk);
  return true;
}

describe('🔍 QA - Deduplicação de Dados no Relatório', () => {
  it('Deve gerar business key igual para mesma mesa, mesmo dia, mesmo total', () => {
    const data = new Date('2025-03-15');
    const k1 = gerarBusinessKey({ mesaNumero: 5, totalFinal: 120, data });
    const k2 = gerarBusinessKey({ mesaNumero: 5, totalFinal: 120, data });
    expect(k1).toBe(k2);
  });

  it('Deve gerar business keys DIFERENTES para mesas diferentes', () => {
    const data = new Date('2025-03-15');
    const k1 = gerarBusinessKey({ mesaNumero: 5, totalFinal: 120, data });
    const k2 = gerarBusinessKey({ mesaNumero: 7, totalFinal: 120, data });
    expect(k1).not.toBe(k2);
  });

  it('Deve deduplicar delivery com mesmo cliente, total e pagamento', () => {
    const data = new Date('2025-03-15');
    const k1 = gerarBusinessKey({ clienteNome: 'João', totalFinal: 55, formaPagamento: 'pix', data });
    const k2 = gerarBusinessKey({ clienteNome: 'João', totalFinal: 55, formaPagamento: 'pix', data });
    expect(k1).toBe(k2);
  });

  it('Não deve deduplicar delivery com pagamentos diferentes', () => {
    const data = new Date('2025-03-15');
    const k1 = gerarBusinessKey({ clienteNome: 'João', totalFinal: 55, formaPagamento: 'pix', data });
    const k2 = gerarBusinessKey({ clienteNome: 'João', totalFinal: 55, formaPagamento: 'dinheiro', data });
    expect(k1).not.toBe(k2);
  });

  it('Pedido com referência cruzada (pedidoId) deve retornar key ref_', () => {
    const key = gerarBusinessKey({ pedidoId: 'abc123', totalFinal: 0 });
    expect(key).toBe('ref_abc123');
  });

  it('Item sem dados suficientes deve retornar null (sem dedup)', () => {
    const key = gerarBusinessKey({ totalFinal: 0 });
    expect(key).toBeNull();
  });
});

describe('🔍 QA - addData com Dedup Completa', () => {
  it('Deve rejeitar documento com mesmo ID', () => {
    const mapa = new Map();
    const set = new Set();
    const item = { id: 'doc1', totalFinal: 50, data: new Date() };
    
    expect(adicionarComDedup(mapa, set, item)).toBe(true);
    expect(adicionarComDedup(mapa, set, { ...item })).toBe(false); // mesmo id
  });

  it('Deve rejeitar referência cruzada (venda ↔ pedido)', () => {
    const mapa = new Map();
    const set = new Set();
    
    adicionarComDedup(mapa, set, { id: 'pedido1', totalFinal: 50, data: new Date() });
    const rejeitado = adicionarComDedup(mapa, set, { id: 'venda1', pedidoId: 'pedido1', totalFinal: 50, data: new Date() });
    expect(rejeitado).toBe(false);
  });

  it('Deve rejeitar business key duplicada (mesa em 2 collections)', () => {
    const mapa = new Map();
    const set = new Set();
    const data = new Date('2025-03-15');
    
    adicionarComDedup(mapa, set, { id: 'subCollection1', mesaNumero: 3, totalFinal: 80, data });
    const rejeitado = adicionarComDedup(mapa, set, { id: 'rootCollection1', mesaNumero: 3, totalFinal: 80, data });
    expect(rejeitado).toBe(false);
    expect(mapa.size).toBe(1); // Só 1 registro
  });
});
