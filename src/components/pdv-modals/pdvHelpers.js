// src/components/pdv-modals/pdvHelpers.js
// Funções auxiliares compartilhadas entre os modais do PDV

export { formatarMoeda } from '../../utils/formatCurrency';

export const formatarHora = (data) => {
    if (!data) return '--:--';
    if (data.toDate) return data.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (data instanceof Date) return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return '--:--';
};

export const formatarData = (data) => {
    if (!data) return '-';
    if (data.toDate) return data.toDate().toLocaleDateString('pt-BR');
    if (data instanceof Date) return data.toLocaleDateString('pt-BR');
    return '-';
};
