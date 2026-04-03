import { describe, it, expect } from 'vitest';

// Extrai lógica EXATA do DashBoardSummary.jsx (linhas 8-15)
export function isPedidoCancelado(p) {
  if (!p) return false;
  const s1 = String(p.status || '').toLowerCase().trim();
  const s2 = String(p.fiscal?.status || '').toLowerCase().trim();
  const s3 = String(p.statusVenda || '').toLowerCase().trim();
  const termos = ['cancelad', 'recusad', 'excluid', 'estornad', 'devolvid', 'rejeitad', 'erro'];
  return termos.some(t => s1.includes(t) || s2.includes(t) || s3.includes(t));
}

// Extrai lógica EXATA do DashBoardSummary.jsx (linhas 20-22) 
export function isMesaDoc(data) {
  return data.tipo === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
}

// Extrai matemática do DashBoardSummary.jsx (linhas 152-176)
export function calcularStatsDashboard(pedidosDelivery, pedidosSalao, pedidosPdv) {
  const parse = val => parseFloat(String(val || 0).replace(/[R$\s]/g, '').replace(',', '.')) || 0;
  
  let fatSalao = 0, fatDel = 0, fatPdv = 0, totalTaxas = 0;
  const frota = {};

  pedidosSalao.forEach(p => fatSalao += parse(p.totalFinal || p.total || p.valorTotal));
  pedidosPdv.forEach(p => fatPdv += parse(p.totalFinal || p.total || p.valorTotal));
  pedidosDelivery.forEach(p => {
    fatDel += parse(p.totalFinal || p.total || p.valorTotal);
    if (p.motoboyNome || p.motoboyId) {
      const moto = p.motoboyNome || 'Desconhecido';
      if (!frota[moto]) frota[moto] = { nome: moto, qtd: 0, taxas: 0 };
      frota[moto].qtd++;
      frota[moto].taxas += parse(p.taxaEntrega || p.deliveryFee);
      totalTaxas += parse(p.taxaEntrega || p.deliveryFee);
    }
  });

  const totPeds = pedidosSalao.length + pedidosDelivery.length + pedidosPdv.length;
  return {
    fatTotal: fatSalao + fatDel + fatPdv,
    totPeds,
    fatSalao, fatDel, fatPdv,
    totalTaxas,
    ticket: totPeds ? (fatSalao + fatDel + fatPdv) / totPeds : 0,
    entregadores: Object.values(frota).sort((a, b) => b.qtd - a.qtd)
  };
}

describe('📊 QA - Classificação de Pedidos (Mesa vs Delivery)', () => {
  it('Pedido com tipo "mesa" é doc de mesa', () => {
    expect(isMesaDoc({ tipo: 'mesa' })).toBe(true);
  });

  it('Pedido com source "salao" é doc de mesa', () => {
    expect(isMesaDoc({ source: 'salao' })).toBe(true);
  });

  it('Pedido com mesaNumero é doc de mesa', () => {
    expect(isMesaDoc({ mesaNumero: 5 })).toBe(true);
  });

  it('Pedido de delivery NÃO é doc de mesa', () => {
    expect(isMesaDoc({ tipo: 'delivery' })).toBe(false);
  });
});

describe('📊 QA - Detector de Cancelamento Robusto', () => {
  it('Status "cancelado" deve ser detectado', () => {
    expect(isPedidoCancelado({ status: 'cancelado' })).toBe(true);
  });

  it('Status "Cancelada pelo gerente" deve ser detectado (contains)', () => {
    expect(isPedidoCancelado({ status: 'Cancelada pelo gerente' })).toBe(true);
  });

  it('Status fiscal "estornado" deve ser detectado', () => {
    expect(isPedidoCancelado({ fiscal: { status: 'estornado' } })).toBe(true);
  });

  it('StatusVenda "recusado" deve ser detectado', () => {
    expect(isPedidoCancelado({ statusVenda: 'recusado' })).toBe(true);
  });

  it('Status "finalizado" NÃO é cancelamento', () => {
    expect(isPedidoCancelado({ status: 'finalizado' })).toBe(false);
  });

  it('Pedido null deve retornar false (sem crash)', () => {
    expect(isPedidoCancelado(null)).toBe(false);
  });

  it('Status "erro_sefaz" deve ser detectado', () => {
    expect(isPedidoCancelado({ status: 'erro_sefaz' })).toBe(true);
  });
});

describe('📊 QA - Cálculo do Dashboard Principal', () => {
  const delivery = [
    { totalFinal: 55, motoboyNome: 'Carlos', motoboyId: 'm1', taxaEntrega: 8 },
    { totalFinal: 40, motoboyNome: 'Carlos', motoboyId: 'm1', taxaEntrega: 8 },
    { totalFinal: 30, motoboyNome: 'João', motoboyId: 'm2', taxaEntrega: 5 },
  ];
  const salao = [
    { totalFinal: 120 },
    { totalFinal: 80 }
  ];
  const pdv = [
    { totalFinal: 25 }
  ];

  it('Deve calcular faturamento total correto', () => {
    const stats = calcularStatsDashboard(delivery, salao, pdv);
    expect(stats.fatTotal).toBe(55 + 40 + 30 + 120 + 80 + 25); // 350
  });

  it('Deve separar faturamento por tipo', () => {
    const stats = calcularStatsDashboard(delivery, salao, pdv);
    expect(stats.fatDel).toBe(125); // 55+40+30
    expect(stats.fatSalao).toBe(200); // 120+80
    expect(stats.fatPdv).toBe(25);
  });

  it('Deve calcular ticket médio', () => {
    const stats = calcularStatsDashboard(delivery, salao, pdv);
    expect(stats.ticket).toBeCloseTo(350 / 6, 2);
  });

  it('Deve rankear Carlos como top entregador (2 entregas)', () => {
    const stats = calcularStatsDashboard(delivery, salao, pdv);
    expect(stats.entregadores[0].nome).toBe('Carlos');
    expect(stats.entregadores[0].qtd).toBe(2);
    expect(stats.entregadores[0].taxas).toBe(16); // 8+8
  });

  it('Deve calcular total de taxas de entrega', () => {
    const stats = calcularStatsDashboard(delivery, salao, pdv);
    expect(stats.totalTaxas).toBe(21); // 8+8+5
  });

  it('Deve tratar valores como string (vindo do Firestore)', () => {
    const stats = calcularStatsDashboard([], [{ totalFinal: 'R$ 150,50' }], []);
    expect(stats.fatSalao).toBeCloseTo(150.50, 2);
  });

  it('Ticket médio deve ser 0 quando não tem pedidos', () => {
    const stats = calcularStatsDashboard([], [], []);
    expect(stats.ticket).toBe(0);
    expect(stats.totPeds).toBe(0);
  });
});
