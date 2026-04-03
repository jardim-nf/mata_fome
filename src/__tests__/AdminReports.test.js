import { describe, it, expect } from 'vitest';

// Extrai lógica de cálculo de métricas do AdminReports.jsx (linhas 359-467)
export function calcularMetricasRelatorio(pedidos) {
  let totalReceita = 0;
  let totalTaxas = 0;
  let totalDescontos = 0;
  const byPayment = {};
  const byType = {};
  const motoboyStats = {};
  const itemsCount = {};

  pedidos.forEach(p => {
    const valor = Number(p.totalFinal || p.total || 0);
    totalReceita += valor;
    totalTaxas += Number(p.taxaEntrega || 0);
    totalDescontos += Number(p.desconto || p.valorDesconto || 0);

    // Por forma de pagamento
    const pag = p.formaPagamento || 'outros';
    byPayment[pag] = (byPayment[pag] || 0) + 1;

    // Por tipo (delivery, mesa, balcao)
    const tipo = p.tipo || 'delivery';
    byType[tipo] = (byType[tipo] || 0) + 1;

    // Motoboys
    if (p.motoboyId && p.motoboyNome) {
      if (!motoboyStats[p.motoboyId]) motoboyStats[p.motoboyId] = { nome: p.motoboyNome, count: 0, totalTaxas: 0 };
      motoboyStats[p.motoboyId].count++;
      motoboyStats[p.motoboyId].totalTaxas += Number(p.taxaEntrega || 0);
    }

    // Top itens vendidos
    (p.itens || []).forEach(it => {
      const nome = it.nome || 'Desconhecido';
      if (!itemsCount[nome]) itemsCount[nome] = { nome, qtd: 0, receita: 0 };
      itemsCount[nome].qtd += Number(it.quantidade || it.qtd || 1);
      itemsCount[nome].receita += (Number(it.preco || 0) * Number(it.quantidade || it.qtd || 1));
    });
  });

  const ticketMedio = pedidos.length > 0 ? totalReceita / pedidos.length : 0;
  const topMotoboys = Object.values(motoboyStats).sort((a, b) => b.count - a.count);
  const topItens = Object.values(itemsCount).sort((a, b) => b.qtd - a.qtd);

  return { totalReceita, totalTaxas, totalDescontos, ticketMedio, byPayment, byType, topMotoboys, topItens, totalPedidos: pedidos.length };
}

describe('📊 QA - Motor de Relatórios Administrativos', () => {
  const pedidos = [
    { totalFinal: 50, taxaEntrega: 8, formaPagamento: 'pix', tipo: 'delivery', motoboyId: 'm1', motoboyNome: 'Carlos', itens: [{ nome: 'X-Burger', preco: 25, quantidade: 2 }] },
    { totalFinal: 35, taxaEntrega: 0, formaPagamento: 'dinheiro', tipo: 'mesa', itens: [{ nome: 'Coca-Cola', preco: 8, quantidade: 1 }, { nome: 'X-Burger', preco: 25, quantidade: 1 }] },
    { totalFinal: 80, taxaEntrega: 10, formaPagamento: 'pix', tipo: 'delivery', motoboyId: 'm1', motoboyNome: 'Carlos', desconto: 5, itens: [{ nome: 'Pizza GG', preco: 70, quantidade: 1 }] },
    { totalFinal: 22, taxaEntrega: 5, formaPagamento: 'cartao', tipo: 'delivery', motoboyId: 'm2', motoboyNome: 'João', itens: [{ nome: 'Hot Dog', preco: 15, quantidade: 1 }] },
  ];

  it('Deve calcular receita total corretamente', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.totalReceita).toBe(50 + 35 + 80 + 22); // 187
  });

  it('Deve calcular ticket médio', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.ticketMedio).toBeCloseTo(187 / 4, 2);
  });

  it('Deve somar taxas de entrega', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.totalTaxas).toBe(8 + 0 + 10 + 5); // 23
  });

  it('Deve somar descontos', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.totalDescontos).toBe(5);
  });

  it('Deve contar 2 pedidos PIX e 1 cartão', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.byPayment['pix']).toBe(2);
    expect(m.byPayment['cartao']).toBe(1);
    expect(m.byPayment['dinheiro']).toBe(1);
  });

  it('Deve rankear Carlos como top motoboy (2 entregas)', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.topMotoboys[0].nome).toBe('Carlos');
    expect(m.topMotoboys[0].count).toBe(2);
    expect(m.topMotoboys[0].totalTaxas).toBe(18); // 8+10
  });

  it('Deve rankear X-Burger como item mais vendido (3 unidades)', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.topItens[0].nome).toBe('X-Burger');
    expect(m.topItens[0].qtd).toBe(3);
  });

  it('Deve contar 3 delivery e 1 mesa', () => {
    const m = calcularMetricasRelatorio(pedidos);
    expect(m.byType['delivery']).toBe(3);
    expect(m.byType['mesa']).toBe(1);
  });

  it('Deve retornar ticket médio 0 se não tem pedidos', () => {
    const m = calcularMetricasRelatorio([]);
    expect(m.ticketMedio).toBe(0);
    expect(m.totalPedidos).toBe(0);
  });
});
