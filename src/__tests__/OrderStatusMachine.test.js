import { describe, it, expect } from 'vitest';

// Fluxo oficial de status do Painel.jsx
const FLUXO_STATUS = {
  delivery: ['recebido', 'preparo', 'em_entrega', 'pronto_para_servir', 'finalizado'],
  cozinha:  ['recebido', 'preparo', 'pronto_para_servir', 'finalizado']
};

export function validarTransicaoStatus(statusAtual, novoStatus, modo) {
  const fluxo = FLUXO_STATUS[modo];
  if (!fluxo) return { valido: false, motivo: 'Modo inválido' };

  const idxAtual = fluxo.indexOf(statusAtual);
  const idxNovo = fluxo.indexOf(novoStatus);

  if (idxAtual === -1) return { valido: false, motivo: `Status "${statusAtual}" não existe no fluxo ${modo}` };
  if (idxNovo === -1) return { valido: false, motivo: `Status "${novoStatus}" não existe no fluxo ${modo}` };

  // Permite avançar 1 passo ou retroceder (correção de erro do garçom)
  if (idxNovo === idxAtual + 1) return { valido: true, tipo: 'avanço' };
  if (idxNovo < idxAtual) return { valido: true, tipo: 'retrocesso' };
  if (idxNovo === idxAtual) return { valido: false, motivo: 'Já está nesse status' };
  
  // Pular etapas (ex: recebido → finalizado direto)
  return { valido: true, tipo: 'pulo', alerta: `Pulou ${idxNovo - idxAtual - 1} etapa(s)` };
}

describe('🔄 QA - Máquina de Estados do Pedido', () => {
  it('Fluxo normal: recebido → preparo (delivery)', () => {
    const result = validarTransicaoStatus('recebido', 'preparo', 'delivery');
    expect(result.valido).toBe(true);
    expect(result.tipo).toBe('avanço');
  });

  it('Fluxo normal: preparo → pronto_para_servir (cozinha)', () => {
    const result = validarTransicaoStatus('preparo', 'pronto_para_servir', 'cozinha');
    expect(result.valido).toBe(true);
  });

  it('Retrocesso permitido: preparo → recebido (garçom errou)', () => {
    const result = validarTransicaoStatus('preparo', 'recebido', 'delivery');
    expect(result.valido).toBe(true);
    expect(result.tipo).toBe('retrocesso');
  });

  it('Pulo de etapa deve ter alerta (recebido → finalizado)', () => {
    const result = validarTransicaoStatus('recebido', 'finalizado', 'delivery');
    expect(result.valido).toBe(true);
    expect(result.tipo).toBe('pulo');
    expect(result.alerta).toContain('Pulou');
  });

  it('Status repetido deve ser rejeitado', () => {
    const result = validarTransicaoStatus('preparo', 'preparo', 'delivery');
    expect(result.valido).toBe(false);
    expect(result.motivo).toContain('Já está');
  });

  it('Status inventado deve ser rejeitado', () => {
    const result = validarTransicaoStatus('recebido', 'explodido', 'delivery');
    expect(result.valido).toBe(false);
  });

  it('Cozinha NÃO tem etapa "em_entrega"', () => {
    const result = validarTransicaoStatus('preparo', 'em_entrega', 'cozinha');
    expect(result.valido).toBe(false);
  });
});
