import { describe, it, expect } from 'vitest';

// Extrai lógica PURA de movimentações do caixaService.js (linhas 32-43)
export function calcularTotaisMovimentacoes(itens) {
  let totalSuprimento = 0;
  let totalSangria = 0;

  itens.forEach(d => {
    if (d.tipo === 'suprimento') totalSuprimento += Number(d.valor);
    if (d.tipo === 'sangria') totalSangria += Number(d.valor);
  });

  return { totalSuprimento, totalSangria, itens };
}

// Função de fechamento de caixa: calcula saldo esperado
export function calcularSaldoEsperado(valorAbertura, totalVendas, totalSuprimento, totalSangria) {
  return valorAbertura + totalVendas + totalSuprimento - totalSangria;
}

// Detecta diferença entre saldo esperado e saldo real (conferência de caixa)
export function calcularDiferencaCaixa(saldoEsperado, saldoReal) {
  const diferenca = saldoReal - saldoEsperado;
  return {
    diferenca,
    status: diferenca === 0 ? 'conferido' : diferenca > 0 ? 'sobra' : 'falta',
    alerta: Math.abs(diferenca) > 20 // Alerta se diferença > R$20
  };
}

describe('💰 QA - Caixa: Movimentações (Sangria/Suprimento)', () => {
  it('Deve somar suprimentos e sangrias separadamente', () => {
    const itens = [
      { tipo: 'suprimento', valor: 200 },
      { tipo: 'sangria', valor: 50 },
      { tipo: 'suprimento', valor: 100 },
      { tipo: 'sangria', valor: 30 },
    ];
    const result = calcularTotaisMovimentacoes(itens);
    expect(result.totalSuprimento).toBe(300);
    expect(result.totalSangria).toBe(80);
  });

  it('Sem movimentações = zeros', () => {
    const result = calcularTotaisMovimentacoes([]);
    expect(result.totalSuprimento).toBe(0);
    expect(result.totalSangria).toBe(0);
  });

  it('Valor como string deve funcionar (Number() parse)', () => {
    const result = calcularTotaisMovimentacoes([{ tipo: 'suprimento', valor: '150.50' }]);
    expect(result.totalSuprimento).toBeCloseTo(150.50);
  });
});

describe('💰 QA - Caixa: Fechamento (Saldo Esperado)', () => {
  it('Abertura R$200 + Vendas R$500 + Suprimento R$100 - Sangria R$50 = R$750', () => {
    expect(calcularSaldoEsperado(200, 500, 100, 50)).toBe(750);
  });

  it('Apenas abertura sem vendas = valor da abertura', () => {
    expect(calcularSaldoEsperado(300, 0, 0, 0)).toBe(300);
  });
});

describe('💰 QA - Caixa: Conferência (Sobra/Falta)', () => {
  it('Saldo real igual ao esperado = conferido', () => {
    const r = calcularDiferencaCaixa(750, 750);
    expect(r.status).toBe('conferido');
    expect(r.diferenca).toBe(0);
  });

  it('Saldo real maior = sobra', () => {
    const r = calcularDiferencaCaixa(750, 760);
    expect(r.status).toBe('sobra');
    expect(r.diferenca).toBe(10);
  });

  it('Saldo real menor = falta', () => {
    const r = calcularDiferencaCaixa(750, 700);
    expect(r.status).toBe('falta');
    expect(r.diferenca).toBe(-50);
  });

  it('Diferença > R$20 gera alerta', () => {
    expect(calcularDiferencaCaixa(750, 720).alerta).toBe(true);
    expect(calcularDiferencaCaixa(750, 745).alerta).toBe(false);
  });
});
