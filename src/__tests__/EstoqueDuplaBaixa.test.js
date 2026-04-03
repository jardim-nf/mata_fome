import { describe, it, expect } from 'vitest';

/**
 * ⚠️ BUG ENCONTRADO: BAIXA DE ESTOQUE DUPLA
 * 
 * Arquivo: vendaService.js (linha 42) + Menu.jsx (linha 564)
 * 
 * O vendaService.salvarVenda() chama estoqueService.darBaixaEstoque() internamente.
 * MAS o Menu.jsx handlePagamentoSucesso() TAMBÉM chama estoqueService.darBaixaEstoque() 
 * DEPOIS de salvar o pedido (que foi salvo via setDoc direto, não via vendaService).
 * 
 * Resultado: Para pedidos do MENU (delivery/retirada), a baixa é feita 1x corretamente.
 * Mas se alguém usar vendaService.salvarVenda() + chamar darBaixaEstoque() separado,
 * o estoque é deduzido 2x!
 * 
 * O ModalPagamento.jsx (mesas) também chama darBaixaEstoque() separadamente (linha 354),
 * mas usa addDoc direto (não vendaService), então está CORRETO.
 */

// Simula a detecção de dupla chamada
export function detectarDuplaBaixa(fluxo) {
  const chamadas = [];

  if (fluxo.usaVendaServiceSalvar) {
    chamadas.push('vendaService.darBaixaEstoque'); // interno do salvarVenda
  }
  if (fluxo.chamaDarBaixaExterna) {
    chamadas.push('chamada_externa.darBaixaEstoque');
  }

  return {
    totalChamadas: chamadas.length,
    duplaBaixa: chamadas.length > 1,
    chamadas
  };
}

// Simula prevenção de estoque negativo
export function calcularNovoEstoque(estoqueAtual, quantidadeVendida) {
  const novo = estoqueAtual - quantidadeVendida;
  return Math.max(0, novo);
}

// Simula proteção contra race condition de estoque
export function validarEstoqueSuficiente(estoqueAtual, quantidadeDesejada) {
  if (estoqueAtual <= 0) return { permitido: false, motivo: 'Produto sem estoque' };
  if (quantidadeDesejada > estoqueAtual) return { 
    permitido: false, 
    motivo: `Estoque insuficiente (tem ${estoqueAtual}, quer ${quantidadeDesejada})` 
  };
  return { permitido: true, motivo: null };
}

describe('⚠️ QA - ALERTA: Dupla Baixa de Estoque', () => {
  it('Menu delivery: baixa via setDoc + darBaixaEstoque = 1 chamada (CORRETO)', () => {
    const r = detectarDuplaBaixa({ usaVendaServiceSalvar: false, chamaDarBaixaExterna: true });
    expect(r.duplaBaixa).toBe(false);
    expect(r.totalChamadas).toBe(1);
  });

  it('PDV via vendaService.salvarVenda (já tem baixa interna) = 1 chamada (CORRETO)', () => {
    const r = detectarDuplaBaixa({ usaVendaServiceSalvar: true, chamaDarBaixaExterna: false });
    expect(r.duplaBaixa).toBe(false);
  });

  it('⚠️ BUG: vendaService.salvarVenda + darBaixaEstoque externo = DUPLA BAIXA!', () => {
    const r = detectarDuplaBaixa({ usaVendaServiceSalvar: true, chamaDarBaixaExterna: true });
    expect(r.duplaBaixa).toBe(true);
    expect(r.totalChamadas).toBe(2);
  });

  it('Mesa (addDoc direto + darBaixaEstoque) = 1 chamada (CORRETO)', () => {
    const r = detectarDuplaBaixa({ usaVendaServiceSalvar: false, chamaDarBaixaExterna: true });
    expect(r.duplaBaixa).toBe(false);
  });
});

describe('📦 QA - Proteção contra Estoque Negativo', () => {
  it('Estoque 10 - venda 3 = 7', () => {
    expect(calcularNovoEstoque(10, 3)).toBe(7);
  });

  it('Estoque 2 - venda 5 = 0 (nunca negativo)', () => {
    expect(calcularNovoEstoque(2, 5)).toBe(0);
  });

  it('Estoque 0 - venda 1 = 0', () => {
    expect(calcularNovoEstoque(0, 1)).toBe(0);
  });
});

describe('📦 QA - Validação de Estoque Antes da Venda', () => {
  it('Estoque suficiente = permitido', () => {
    expect(validarEstoqueSuficiente(10, 3).permitido).toBe(true);
  });

  it('Estoque insuficiente = bloqueado', () => {
    const r = validarEstoqueSuficiente(2, 5);
    expect(r.permitido).toBe(false);
    expect(r.motivo).toContain('insuficiente');
  });

  it('Estoque zerado = bloqueado', () => {
    expect(validarEstoqueSuficiente(0, 1).permitido).toBe(false);
  });

  it('Pedido de 1 com estoque 1 = permitido (borda)', () => {
    expect(validarEstoqueSuficiente(1, 1).permitido).toBe(true);
  });
});
