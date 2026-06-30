/**
 * Formata um valor numérico para a moeda local (BRL).
 * @param {number|string} value O valor a ser formatado.
 * @returns {string} O valor formatado, ex: R$ 10,00
 */
export const formatCurrency = (value) => {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};
