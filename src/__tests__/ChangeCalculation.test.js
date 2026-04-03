import { describe, it, expect } from 'vitest';

// Extrai a lógica EXATA de cálculo de troco que o printService.js usa (linha 148-151)
export function calcularTrocoImpressao(totalPedido, trocoPara) {
  const total = Number(totalPedido || 0) || 0;
  const troco = Number(trocoPara || 0);
  
  if (troco <= 0 || troco <= total) return { temTroco: false, valorTroco: 0 };
  
  return {
    temTroco: true,
    valorTroco: parseFloat((troco - total).toFixed(2))
  };
}

describe('💵 QA - Cálculo de Troco na Comanda Impressa', () => {
  it('Pedido de R$35 com "troco para R$50" = Levar R$15', () => {
    const result = calcularTrocoImpressao(35, 50);
    expect(result.temTroco).toBe(true);
    expect(result.valorTroco).toBe(15);
  });

  it('Pedido PIX (sem troco informado) = Não imprime campo de troco', () => {
    const result = calcularTrocoImpressao(35, 0);
    expect(result.temTroco).toBe(false);
  });

  it('Deve tratar o "troco para" menor que o total (erro do garçom)', () => {
    // Garçom digitou errado: pedido R$50 mas "troco pra R$40"
    const result = calcularTrocoImpressao(50, 40);
    expect(result.temTroco).toBe(false);
  });

  it('Deve proteger contra strings e nulls do Firebase', () => {
    const result = calcularTrocoImpressao("35.50", "100");
    expect(result.temTroco).toBe(true);
    expect(result.valorTroco).toBe(64.50);
  });

  it('Não deve gerar ponto flutuante estranho (ex: 0.30000000004)', () => {
    const result = calcularTrocoImpressao(9.70, 10);
    // JavaScript puro faria 10 - 9.70 = 0.30000000000000004
    expect(result.valorTroco).toBe(0.30);
  });
});
