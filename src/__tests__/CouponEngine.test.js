import { describe, it, expect } from 'vitest';

// Extração isolada do algoritmo de validação de cupom do Menu.jsx (linha 442-484)
export function validarCupom(cupom, subtotal, userId, dataAtual = new Date()) {
  if (!cupom || !cupom.ativo) return { valido: false, motivo: 'Cupom inválido ou expirado.' };

  // Checagem de validade por data
  const validade = cupom.validadeFim instanceof Date ? cupom.validadeFim : new Date(cupom.validadeFim);
  if (validade < dataAtual) return { valido: false, motivo: 'Este cupom já expirou.' };

  // Pedido mínimo
  if (cupom.minimoPedido && subtotal < cupom.minimoPedido) {
    return { valido: false, motivo: `Valor mínimo: R$ ${cupom.minimoPedido.toFixed(2)}` };
  }

  // Uso único por cliente
  if (userId && Array.isArray(cupom.usuariosQueUsaram) && cupom.usuariosQueUsaram.includes(userId)) {
    return { valido: false, motivo: 'Você já utilizou este cupom anteriormente.' };
  }

  // Limite de usos globais
  if (cupom.usosMaximos && (cupom.usosAtuais || 0) >= cupom.usosMaximos) {
    return { valido: false, motivo: 'Este cupom atingiu o limite máximo de usos.' };
  }

  // Calcula o desconto
  let valorDesc = 0;
  if (cupom.tipoDesconto === 'percentual') valorDesc = (subtotal * cupom.valorDesconto) / 100;
  else if (cupom.tipoDesconto === 'valorFixo') valorDesc = cupom.valorDesconto;
  else if (cupom.tipoDesconto === 'freteGratis') valorDesc = -1; // Flag especial

  return { valido: true, desconto: valorDesc };
}

describe('🎟️ QA - Motor de Cupons (Anti-Fraude)', () => {
  const cupomBase = {
    ativo: true,
    codigo: 'PROMO10',
    tipoDesconto: 'percentual',
    valorDesconto: 10,
    validadeFim: new Date('2027-12-31'),
    minimoPedido: 30,
    usosMaximos: 100,
    usosAtuais: 5,
    usuariosQueUsaram: ['uid_joao', 'uid_maria']
  };

  it('Deve aplicar 10% de desconto num pedido de R$50', () => {
    const result = validarCupom(cupomBase, 50, 'uid_novo');
    expect(result.valido).toBe(true);
    expect(result.desconto).toBe(5); // 10% de 50
  });

  it('Deve BARRAR cliente que já usou o cupom (Fraude de reuso)', () => {
    const result = validarCupom(cupomBase, 50, 'uid_joao');
    expect(result.valido).toBe(false);
    expect(result.motivo).toContain('já utilizou');
  });

  it('Deve BARRAR pedido abaixo do valor mínimo', () => {
    const result = validarCupom(cupomBase, 20, 'uid_novo');
    expect(result.valido).toBe(false);
    expect(result.motivo).toContain('Valor mínimo');
  });

  it('Deve BARRAR cupom expirado', () => {
    const cupomVencido = { ...cupomBase, validadeFim: new Date('2020-01-01') };
    const result = validarCupom(cupomVencido, 50, 'uid_novo');
    expect(result.valido).toBe(false);
    expect(result.motivo).toContain('expirou');
  });

  it('Deve BARRAR cupom que excedeu limite de usos globais', () => {
    const cupomEsgotado = { ...cupomBase, usosMaximos: 5, usosAtuais: 5 };
    const result = validarCupom(cupomEsgotado, 50, 'uid_novo');
    expect(result.valido).toBe(false);
    expect(result.motivo).toContain('limite máximo');
  });

  it('Deve aplicar desconto de valor fixo corretamente', () => {
    const cupomFixo = { ...cupomBase, tipoDesconto: 'valorFixo', valorDesconto: 15 };
    const result = validarCupom(cupomFixo, 50, 'uid_novo');
    expect(result.valido).toBe(true);
    expect(result.desconto).toBe(15);
  });

  it('Deve retornar flag de frete grátis', () => {
    const cupomFrete = { ...cupomBase, tipoDesconto: 'freteGratis' };
    const result = validarCupom(cupomFrete, 50, 'uid_novo');
    expect(result.valido).toBe(true);
    expect(result.desconto).toBe(-1); // Flag especial
  });
});
