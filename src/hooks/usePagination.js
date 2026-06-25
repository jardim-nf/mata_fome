// src/hooks/usePagination.js
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

export const usePagination = (items, itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  // Ajusta a página atual se ela exceder o total de páginas (ex: após exclusão de itens)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return items.slice(startIndex, startIndex + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  // Usamos ref para manter a referência das funções estável mesmo se o array de itens mudar
  const itemsLengthRef = useRef(items.length);
  useEffect(() => {
    itemsLengthRef.current = items.length;
  }, [items.length]);

  // 🔥 CORREÇÃO: useCallback com dependências estáveis evita que o reset da página dispare no useEffect externo
  const goToPage = useCallback((page) => {
    setCurrentPage(prev => {
      const total = Math.max(1, Math.ceil(itemsLengthRef.current / itemsPerPage));
      return Math.max(1, Math.min(page, total));
    });
  }, [itemsPerPage]);

  const nextPage = useCallback(() => {
    setCurrentPage(prev => {
      const total = Math.max(1, Math.ceil(itemsLengthRef.current / itemsPerPage));
      return Math.min(prev + 1, total);
    });
  }, [itemsPerPage]);

  const prevPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  return {
    currentPage,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
};