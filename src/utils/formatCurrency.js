// src/utils/formatCurrency.js

// Função para formatar números para a moeda brasileira (BRL)
export const formatCurrency = (amount) => {
    // Garante que o valor é tratado como número
    const numericAmount = parseFloat(amount); 

    // Se for NaN, retorna R$ 0,00 ou um valor seguro
    if (isNaN(numericAmount)) {
        return 'R$ 0,00';
    }

    return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2
    }).format(numericAmount);
};