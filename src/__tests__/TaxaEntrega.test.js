import { describe, it, expect } from 'vitest';

/**
 * Extrai lógica de cálculo de taxa de entrega do Menu.jsx (linhas 298-314)
 * BUG ENCONTRADO:
 *  1. A busca usa .includes() na normalização, um bairro "Centro" também matcharia "Centro Norte"
 *  2. Se 2 bairros matcham, pega o ÚLTIMO (não o mais específico)
 */

export function normalizarTexto(texto) {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// VERSÃO CORRIGIDA: match exato primeiro, includes como fallback
export function encontrarTaxaBairro(bairroCliente, listaTaxas) {
  if (!bairroCliente || !listaTaxas || listaTaxas.length === 0) return 0;

  const bairroNorm = normalizarTexto(bairroCliente);

  // 1. Prioridade: match EXATO
  const matchExato = listaTaxas.find(t => normalizarTexto(t.nomeBairro || '') === bairroNorm);
  if (matchExato) return Number(matchExato.valorTaxa) || 0;

  // 2. Fallback: contains
  const matchParcial = listaTaxas.find(t => normalizarTexto(t.nomeBairro || '').includes(bairroNorm));
  if (matchParcial) return Number(matchParcial.valorTaxa) || 0;

  return 0; // Bairro não cadastrado
}

// Validação de frete grátis por valor mínimo
export function verificarFreteGratis(subtotal, valorMinimoFreteGratis) {
  if (!valorMinimoFreteGratis || valorMinimoFreteGratis <= 0) return false;
  return subtotal >= valorMinimoFreteGratis;
}

describe('🛵 QA - Taxa de Entrega: Busca por Bairro', () => {
  const taxas = [
    { nomeBairro: 'Centro', valorTaxa: 5 },
    { nomeBairro: 'Centro Norte', valorTaxa: 12 },
    { nomeBairro: 'Jardim América', valorTaxa: 8 },
    { nomeBairro: 'Vila Nova', valorTaxa: 10 },
    { nomeBairro: 'São José', valorTaxa: 15 }
  ];

  it('Match exato: "Centro" retorna R$5 (não R$12 do "Centro Norte")', () => {
    expect(encontrarTaxaBairro('Centro', taxas)).toBe(5);
  });

  it('Match exato com acento: "São José" → R$15', () => {
    expect(encontrarTaxaBairro('São José', taxas)).toBe(15);
  });

  it('Match normalizado: "sao jose" (sem acento) → R$15', () => {
    expect(encontrarTaxaBairro('sao jose', taxas)).toBe(15);
  });

  it('Match case-insensitive: "JARDIM AMÉRICA" → R$8', () => {
    expect(encontrarTaxaBairro('JARDIM AMÉRICA', taxas)).toBe(8);
  });

  it('Bairro não cadastrado → R$0', () => {
    expect(encontrarTaxaBairro('Bairro Fantasma', taxas)).toBe(0);
  });

  it('Bairro vazio → R$0', () => {
    expect(encontrarTaxaBairro('', taxas)).toBe(0);
    expect(encontrarTaxaBairro(null, taxas)).toBe(0);
  });

  it('Lista de taxas vazia → R$0', () => {
    expect(encontrarTaxaBairro('Centro', [])).toBe(0);
  });
});

describe('🛵 QA - Frete Grátis por Valor Mínimo', () => {
  it('Subtotal R$120 com mínimo R$100 → frete grátis', () => {
    expect(verificarFreteGratis(120, 100)).toBe(true);
  });

  it('Subtotal R$80 com mínimo R$100 → NÃO é frete grátis', () => {
    expect(verificarFreteGratis(80, 100)).toBe(false);
  });

  it('Subtotal R$100 com mínimo R$100 → frete grátis (borda exata)', () => {
    expect(verificarFreteGratis(100, 100)).toBe(true);
  });

  it('Sem configuração de mínimo → nunca é grátis', () => {
    expect(verificarFreteGratis(500, null)).toBe(false);
    expect(verificarFreteGratis(500, 0)).toBe(false);
  });
});
