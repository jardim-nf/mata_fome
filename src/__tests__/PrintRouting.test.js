import { describe, it, expect } from 'vitest';

// Extrai a lógica de roteamento do printService.js (linha 179-201)
export function rotearItensParaImpressoras(itens, roteamentoConfig, isDelivery) {
  let itensCozinha = [];
  let itensBalcao = [];
  const config = roteamentoConfig || {};

  itens.forEach(item => {
    if (item.status === 'cancelado') return;
    const categoriaId = item.categoriaId || 'default';
    const destino = config[categoriaId] || 'balcao';

    if (destino === 'cozinha') itensCozinha.push(item);
    else if (destino === 'balcao') itensBalcao.push(item);
    else if (destino === 'ambos') { itensCozinha.push(item); itensBalcao.push(item); }
  });

  // Se delivery, tudo pro balcão (via do motoboy completa)  
  if (isDelivery && itens.length > 0) {
    itensBalcao = itens.filter(i => i.status !== 'cancelado');
  } else if (itens.length > 0 && itensCozinha.length === 0 && itensBalcao.length === 0) {
    itensBalcao = itens.filter(i => i.status !== 'cancelado');
  }

  return { itensCozinha, itensBalcao };
}

describe('🖨️ QA - Roteamento de Impressão Cozinha/Balcão', () => {
  const roteamento = {
    'cat-lanches': 'cozinha',
    'cat-bebidas': 'balcao',
    'cat-combo': 'ambos'
  };

  const itens = [
    { nome: 'X-Burger', categoriaId: 'cat-lanches' },
    { nome: 'Coca-Cola', categoriaId: 'cat-bebidas' },
    { nome: 'Combo Casal', categoriaId: 'cat-combo' },
    { nome: 'Batata Cancelada', categoriaId: 'cat-lanches', status: 'cancelado' }
  ];

  it('Deve rotear lanche pra cozinha e bebida pro balcão', () => {
    const result = rotearItensParaImpressoras(itens, roteamento, false);
    expect(result.itensCozinha.map(i => i.nome)).toContain('X-Burger');
    expect(result.itensBalcao.map(i => i.nome)).toContain('Coca-Cola');
  });

  it('Combo marcado como "ambos" deve ir pra cozinha E balcão', () => {
    const result = rotearItensParaImpressoras(itens, roteamento, false);
    expect(result.itensCozinha.map(i => i.nome)).toContain('Combo Casal');
    expect(result.itensBalcao.map(i => i.nome)).toContain('Combo Casal');
  });

  it('Item cancelado NÃO deve ir pra nenhuma impressora', () => {
    const result = rotearItensParaImpressoras(itens, roteamento, false);
    const todosNomes = [...result.itensCozinha, ...result.itensBalcao].map(i => i.nome);
    expect(todosNomes).not.toContain('Batata Cancelada');
  });

  it('Delivery deve mandar TUDO pro balcão (via completa do motoboy)', () => {
    const result = rotearItensParaImpressoras(itens, roteamento, true);
    // Deve ter 3 itens no balcão (excluindo o cancelado)
    expect(result.itensBalcao.length).toBe(3);
    expect(result.itensBalcao.map(i => i.nome)).toContain('X-Burger');
  });

  it('Sem config de roteamento = tudo vai pro balcão por padrão', () => {
    const result = rotearItensParaImpressoras(itens, {}, false);
    expect(result.itensBalcao.length).toBe(3);
    expect(result.itensCozinha.length).toBe(0);
  });
});
