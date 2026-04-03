import { describe, it, expect } from 'vitest';

// Extrai lógica do produtoService.js (linhas 12-52) 
function formatarNomeCategoria(categoriaId) {
  const mapeamentoNomes = {
    'bebidas': 'Bebidas',
    'grandes-fomes': 'Grandes Fomes',
    'lanches-na-baguete': 'Lanches na Baguete',
    'os-classicos': 'Os Clássicos',
    'os-novatos': 'Os Novatos',
    'os-queridinhos': 'Os Queridinhos',
    'petiscos': 'Petiscos'
  };
  return mapeamentoNomes[categoriaId] || categoriaId;
}

function formatarProdutoReal(id, data, categoriaId) {
  return {
    id,
    name: data.nome || data.name || 'Produto sem nome',
    price: Number(data.preco || data.price || data.valor || 0),
    category: categoriaId,
    categoriaNome: formatarNomeCategoria(categoriaId),
    descricao: data.descricao || data.description || '',
    emEstoque: data.disponivel !== false && data.estoque !== false,
    ativo: data.ativo !== false,
    codigoBarras: data.codigoBarras || data.ean || data.gtin || '',
    variacoes: Array.isArray(data.variacoes) ? data.variacoes.filter(v => v.ativo !== false) : [],
    adicionais: Array.isArray(data.adicionais) ? data.adicionais : [],
    fiscal: data.fiscal || {
      ncm: '', cfop: '', cest: '', origem: '0', csosn: '102', unidade: 'UN', aliquotaIcms: 0
    }
  };
}

describe('📦 QA - Serviço de Produtos (Normalização)', () => {
  it('Deve mapear slug da categoria para nome legível', () => {
    expect(formatarNomeCategoria('os-classicos')).toBe('Os Clássicos');
    expect(formatarNomeCategoria('lanches-na-baguete')).toBe('Lanches na Baguete');
  });

  it('Categoria desconhecida deve retornar o próprio ID', () => {
    expect(formatarNomeCategoria('categoria-nova-do-admin')).toBe('categoria-nova-do-admin');
  });

  it('Deve extrair preço de diferentes campos do Firebase', () => {
    expect(formatarProdutoReal('1', { preco: 25 }, 'cat').price).toBe(25);
    expect(formatarProdutoReal('2', { price: 30 }, 'cat').price).toBe(30);
    expect(formatarProdutoReal('3', { valor: 15 }, 'cat').price).toBe(15);
  });

  it('Produto sem nome deve ter fallback "Produto sem nome"', () => {
    expect(formatarProdutoReal('x', {}, 'cat').name).toBe('Produto sem nome');
  });

  it('Deve filtrar variações inativas', () => {
    const data = {
      nome: 'Pizza',
      variacoes: [
        { nome: 'P', ativo: true },
        { nome: 'M', ativo: false },
        { nome: 'G' } // ativo não setado = ativo
      ]
    };
    const prod = formatarProdutoReal('x', data, 'pizzas');
    expect(prod.variacoes.length).toBe(2); // P e G
  });

  it('Deve ler código de barras de múltiplos campos', () => {
    expect(formatarProdutoReal('x', { codigoBarras: '7891234567890' }, 'cat').codigoBarras).toBe('7891234567890');
    expect(formatarProdutoReal('x', { ean: '7891234567890' }, 'cat').codigoBarras).toBe('7891234567890');
    expect(formatarProdutoReal('x', { gtin: '7891234567890' }, 'cat').codigoBarras).toBe('7891234567890');
  });

  it('Produto sem dados fiscais deve ter defaults do Simples Nacional', () => {
    const prod = formatarProdutoReal('x', { nome: 'Item' }, 'cat');
    expect(prod.fiscal.csosn).toBe('102');
    expect(prod.fiscal.origem).toBe('0');
    expect(prod.fiscal.unidade).toBe('UN');
  });

  it('Produto indisponível deve ter emEstoque = false', () => {
    expect(formatarProdutoReal('x', { disponivel: false }, 'cat').emEstoque).toBe(false);
    expect(formatarProdutoReal('x', { estoque: false }, 'cat').emEstoque).toBe(false);
    expect(formatarProdutoReal('x', {}, 'cat').emEstoque).toBe(true); // padrão = disponível
  });
});
