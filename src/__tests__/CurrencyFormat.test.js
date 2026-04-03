import { describe, it, expect } from 'vitest';
import { formatCurrency, formatarMoedaCurta } from '../utils/formatCurrency';

describe('💰 QA - Formatação de Moeda (BRL)', () => {
  it('Deve formatar número normal contendo "10" e "00"', () => {
    const result = formatCurrency(10);
    expect(result).toContain('10');
    expect(result).toContain('00');
    expect(result).toContain('R$');
  });

  it('Deve formatar centavos corretamente contendo "9" e "90"', () => {
    const result = formatCurrency(9.9);
    expect(result).toContain('9');
    expect(result).toContain('90');
  });

  it('Deve converter string com vírgula do Firebase "10,50"', () => {
    const result = formatCurrency('10,50');
    expect(result).toContain('10');
    expect(result).toContain('50');
  });

  it('Deve retornar R$ 0,00 para null, undefined e NaN', () => {
    expect(formatCurrency(null)).toContain('0');
    expect(formatCurrency(undefined)).toContain('0');
    expect(formatCurrency('texto_invalido')).toContain('0');
  });

  it('Deve abreviar valores grandes corretamente no Dashboard', () => {
    expect(formatarMoedaCurta(1500)).toContain('1,5k');
    expect(formatarMoedaCurta(2300000)).toContain('2,3M');
  });

  it('Deve exibir valores menores que 1000 como moeda normal (contendo R$)', () => {
    const result = formatarMoedaCurta(500);
    expect(result).toContain('R$');
    expect(result).toContain('500');
  });
});
