import { describe, it, expect } from 'vitest';

// Extrai lógica PURA de paginação do usePagination.js (linhas 4-39)
export function calcularPaginacao(items, currentPage, itemsPerPage = 10) {
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const safeCurrentPage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedItems = items.slice(startIndex, startIndex + itemsPerPage);

  return {
    currentPage: safeCurrentPage,
    totalPages,
    paginatedItems,
    hasNextPage: safeCurrentPage < totalPages,
    hasPrevPage: safeCurrentPage > 1
  };
}

export function goToPage(currentPage, page, totalPages) {
  return Math.max(1, Math.min(page, totalPages));
}

describe('📄 QA - Hook de Paginação', () => {
  const items50 = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));

  it('50 itens com 10 por página = 5 páginas', () => {
    const r = calcularPaginacao(items50, 1, 10);
    expect(r.totalPages).toBe(5);
    expect(r.paginatedItems.length).toBe(10);
  });

  it('Página 1 deve retornar itens 1-10', () => {
    const r = calcularPaginacao(items50, 1, 10);
    expect(r.paginatedItems[0].id).toBe(1);
    expect(r.paginatedItems[9].id).toBe(10);
  });

  it('Página 3 deve retornar itens 21-30', () => {
    const r = calcularPaginacao(items50, 3, 10);
    expect(r.paginatedItems[0].id).toBe(21);
    expect(r.paginatedItems[9].id).toBe(30);
  });

  it('Última página (5) deve retornar itens 41-50', () => {
    const r = calcularPaginacao(items50, 5, 10);
    expect(r.paginatedItems[0].id).toBe(41);
    expect(r.paginatedItems.length).toBe(10);
  });

  it('Página 1 NÃO tem "anterior"', () => {
    const r = calcularPaginacao(items50, 1, 10);
    expect(r.hasPrevPage).toBe(false);
    expect(r.hasNextPage).toBe(true);
  });

  it('Última página NÃO tem "próxima"', () => {
    const r = calcularPaginacao(items50, 5, 10);
    expect(r.hasNextPage).toBe(false);
    expect(r.hasPrevPage).toBe(true);
  });

  it('Página além do máximo deve ser clampada', () => {
    const r = calcularPaginacao(items50, 99, 10);
    expect(r.currentPage).toBe(5);
  });

  it('Página 0 ou negativa deve ir pra 1', () => {
    expect(calcularPaginacao(items50, 0, 10).currentPage).toBe(1);
    expect(calcularPaginacao(items50, -5, 10).currentPage).toBe(1);
  });

  it('Lista vazia = 1 página, 0 itens', () => {
    const r = calcularPaginacao([], 1, 10);
    expect(r.totalPages).toBe(1);
    expect(r.paginatedItems.length).toBe(0);
  });

  it('7 itens com 5 por página = 2 páginas (última com 2 itens)', () => {
    const items7 = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }));
    const r = calcularPaginacao(items7, 2, 5);
    expect(r.totalPages).toBe(2);
    expect(r.paginatedItems.length).toBe(2);
  });
});

describe('📄 QA - goToPage (Navegação Segura)', () => {
  it('Ir para página 3 de 5 = 3', () => {
    expect(goToPage(1, 3, 5)).toBe(3);
  });

  it('Ir para página 99 em total de 5 = clampa em 5', () => {
    expect(goToPage(1, 99, 5)).toBe(5);
  });

  it('Ir para página 0 = clampa em 1', () => {
    expect(goToPage(3, 0, 5)).toBe(1);
  });
});
