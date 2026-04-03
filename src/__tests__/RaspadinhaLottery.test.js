import { describe, it, expect } from 'vitest';

// Extrai lógica do RaspadinhaModal.jsx (linhas 15-41)
export function sortearPremio(config) {
  const chance = config?.chance ?? 20;
  const valor = config?.valor ?? 10;
  const random = config?._forceRandom ?? (Math.random() * 100);

  if (random <= chance) {
    return { type: 'desconto', valor, label: `${valor}% DE DESCONTO`, icon: '🎉', ganhou: true };
  } else {
    return { type: 'nada', valor: 0, label: 'NÃO FOI DESSA VEZ 😢', icon: '🍀', ganhou: false };
  }
}

// Extrai lógica de checkProgress (linhas 89-121)
export function verificarProgresso(percentRaspado) {
  return percentRaspado > 40;
}

describe('🎰 QA - Raspadinha: Motor de Sorteio', () => {
  it('Random = 0 com chance 20 → GANHOU (dentro da faixa)', () => {
    const r = sortearPremio({ chance: 20, valor: 15, _forceRandom: 0 });
    expect(r.ganhou).toBe(true);
    expect(r.type).toBe('desconto');
    expect(r.valor).toBe(15);
  });

  it('Random = 20 com chance 20 → GANHOU (borda exata)', () => {
    const r = sortearPremio({ chance: 20, valor: 10, _forceRandom: 20 });
    expect(r.ganhou).toBe(true);
  });

  it('Random = 21 com chance 20 → PERDEU', () => {
    const r = sortearPremio({ chance: 20, valor: 10, _forceRandom: 21 });
    expect(r.ganhou).toBe(false);
    expect(r.type).toBe('nada');
    expect(r.valor).toBe(0);
  });

  it('Chance 100% = SEMPRE ganha', () => {
    const r = sortearPremio({ chance: 100, valor: 50, _forceRandom: 99 });
    expect(r.ganhou).toBe(true);
  });

  it('Chance 0% = NUNCA ganha', () => {
    const r = sortearPremio({ chance: 0, valor: 10, _forceRandom: 0.1 });
    expect(r.ganhou).toBe(false);
  });

  it('Config null deve usar defaults (20% chance, 10% desconto)', () => {
    const r = sortearPremio({ _forceRandom: 5 }); // dentro de 20%
    expect(r.ganhou).toBe(true);
    expect(r.valor).toBe(10);
  });

  it('Label do prêmio deve conter o percentual', () => {
    const r = sortearPremio({ chance: 100, valor: 25, _forceRandom: 0 });
    expect(r.label).toBe('25% DE DESCONTO');
  });
});

describe('🎰 QA - Raspadinha: Progresso de Raspar', () => {
  it('40% raspado NÃO completa (precisa > 40%)', () => {
    expect(verificarProgresso(40)).toBe(false);
  });

  it('41% raspado COMPLETA', () => {
    expect(verificarProgresso(41)).toBe(true);
  });

  it('100% raspado COMPLETA', () => {
    expect(verificarProgresso(100)).toBe(true);
  });

  it('0% raspado NÃO completa', () => {
    expect(verificarProgresso(0)).toBe(false);
  });
});
