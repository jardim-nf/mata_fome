import { describe, it, expect } from 'vitest';

// Extrai lógica PURA de cálculo de estoque do estoqueService.js (linhas 38-81)
// SEM Firebase — testa apenas a MATEMÁTICA da baixa

export function calcularBaixaEstoqueLegado(dadosProduto, quantidadeComprada) {
  const updates = {};
  const alertas = [];

  // Campo legado: estoqueAtual + controlaEstoque
  if (dadosProduto.controlaEstoque === true && typeof dadosProduto.estoqueAtual === 'number') {
    let novoEstoque = dadosProduto.estoqueAtual - quantidadeComprada;
    if (novoEstoque < 0) novoEstoque = 0;
    updates.estoqueAtual = novoEstoque;
    if (novoEstoque === 0) updates.disponivel = false;

    if (novoEstoque <= (dadosProduto.estoqueMinimo || 3)) {
      alertas.push({ nome: dadosProduto.nome || 'Produto', estoque: novoEstoque, minimo: dadosProduto.estoqueMinimo || 3 });
    }
  }

  return { updates, alertas };
}

export function calcularBaixaEstoqueNovo(dadosProduto, quantidadeComprada) {
  const updates = {};
  const alertas = [];

  if (typeof dadosProduto.estoque === 'number') {
    let novoEstoque = dadosProduto.estoque - quantidadeComprada;
    if (novoEstoque < 0) novoEstoque = 0;
    updates.estoque = novoEstoque;
    if (novoEstoque === 0) updates.ativo = false;

    if (novoEstoque <= (dadosProduto.estoqueMinimo || 3)) {
      alertas.push({ nome: dadosProduto.nome || 'Produto', estoque: novoEstoque, minimo: dadosProduto.estoqueMinimo || 3 });
    }
  }

  return { updates, alertas };
}

export function calcularBaixaVariacao(variacoes, variacaoId, quantidadeComprada) {
  const novasVariacoes = variacoes.map(v => {
    if (v.id === variacaoId) {
      let novoEstoque = (Number(v.estoque) || 0) - quantidadeComprada;
      if (novoEstoque < 0) novoEstoque = 0;
      return { ...v, estoque: novoEstoque };
    }
    return v;
  });

  const estoqueTotal = novasVariacoes.reduce((acc, v) => acc + (Number(v.estoque) || 0), 0);
  return { variacoes: novasVariacoes, estoqueTotal };
}

describe('📦 QA - Baixa de Estoque (Campo Legado: estoqueAtual)', () => {
  it('Estoque 10, compra 3 = estoque 7', () => {
    const { updates } = calcularBaixaEstoqueLegado({ controlaEstoque: true, estoqueAtual: 10 }, 3);
    expect(updates.estoqueAtual).toBe(7);
  });

  it('Estoque 2, compra 5 = estoque 0 (nunca negativo)', () => {
    const { updates } = calcularBaixaEstoqueLegado({ controlaEstoque: true, estoqueAtual: 2 }, 5);
    expect(updates.estoqueAtual).toBe(0);
  });

  it('Estoque zerado deve marcar disponivel = false', () => {
    const { updates } = calcularBaixaEstoqueLegado({ controlaEstoque: true, estoqueAtual: 1 }, 1);
    expect(updates.estoqueAtual).toBe(0);
    expect(updates.disponivel).toBe(false);
  });

  it('Deve gerar alerta quando estoque <= mínimo', () => {
    const { alertas } = calcularBaixaEstoqueLegado({ controlaEstoque: true, estoqueAtual: 5, estoqueMinimo: 5, nome: 'Hambúrguer' }, 2);
    expect(alertas.length).toBe(1);
    expect(alertas[0].nome).toBe('Hambúrguer');
    expect(alertas[0].estoque).toBe(3);
  });

  it('Sem controlaEstoque = não faz nada (produto sem controle)', () => {
    const { updates } = calcularBaixaEstoqueLegado({ estoqueAtual: 10 }, 3);
    expect(Object.keys(updates).length).toBe(0);
  });
});

describe('📦 QA - Baixa de Estoque (Campo Novo: estoque)', () => {
  it('Estoque 15, compra 4 = estoque 11', () => {
    const { updates } = calcularBaixaEstoqueNovo({ estoque: 15 }, 4);
    expect(updates.estoque).toBe(11);
  });

  it('Estoque zerado deve marcar ativo = false (pausa automática)', () => {
    const { updates } = calcularBaixaEstoqueNovo({ estoque: 1 }, 1);
    expect(updates.estoque).toBe(0);
    expect(updates.ativo).toBe(false);
  });

  it('Alerta padrão com estoqueMinimo = 3 se não definido', () => {
    const { alertas } = calcularBaixaEstoqueNovo({ estoque: 5, nome: 'Batata' }, 3);
    expect(alertas.length).toBe(1);
    expect(alertas[0].minimo).toBe(3); // default
  });
});

describe('📦 QA - Baixa de Estoque em Variações (P/M/G)', () => {
  const variacoes = [
    { id: 'v1', nome: 'P', estoque: 10 },
    { id: 'v2', nome: 'M', estoque: 5 },
    { id: 'v3', nome: 'G', estoque: 8 }
  ];

  it('Compra de 2x tamanho M: M fica com 3, total = 21', () => {
    const result = calcularBaixaVariacao(variacoes, 'v2', 2);
    const m = result.variacoes.find(v => v.id === 'v2');
    expect(m.estoque).toBe(3);
    expect(result.estoqueTotal).toBe(10 + 3 + 8); // 21
  });

  it('Compra maior que estoque da variação: fica 0 (não negativo)', () => {
    const result = calcularBaixaVariacao(variacoes, 'v2', 20);
    const m = result.variacoes.find(v => v.id === 'v2');
    expect(m.estoque).toBe(0);
  });

  it('Compra de variação inexistente: nada muda', () => {
    const result = calcularBaixaVariacao(variacoes, 'v_inexistente', 5);
    expect(result.estoqueTotal).toBe(10 + 5 + 8); // 23 — inalterado
  });
});
