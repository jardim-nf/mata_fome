// src/utils/formatCurrency.js
// ────────────────────────────────────────────────────
// Fonte única de verdade para formatação de moeda BRL.
// USE ESTE ARQUIVO em vez de definir formatarMoeda localmente.
// ────────────────────────────────────────────────────

const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/**
 * Formata um valor numérico (ou string "10,00") como moeda BRL.
 * Retorna "R$ 0,00" para valores inválidos.
 */
export const formatCurrency = (amount) => {
    // Trata strings com vírgula decimal ("10,00" → 10.00)
    const parsed = typeof amount === 'string'
        ? parseFloat(amount.replace(',', '.'))
        : parseFloat(amount);

    if (isNaN(parsed)) return 'R$ 0,00';
    return formatter.format(parsed);
};

/** Alias usado por componentes legados (PdvModals, PedidoCard, CartBar etc.) */
export const formatarMoeda = formatCurrency;

/**
 * Versão curta para dashboards: "12,5k" / "1,2M"
 */
export const formatarMoedaCurta = (valor) => {
    const num = parseFloat(valor) || 0;
    if (num >= 1_000_000) return `R$ ${(num / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (num >= 1_000) return `R$ ${(num / 1_000).toFixed(1).replace('.', ',')}k`;
    return formatCurrency(num);
};