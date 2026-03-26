// Barrel export — todos os modais do PDV
export { default as ModalEdicaoItemCarrinho } from './ModalEdicaoItemCarrinho';
export { default as ModalDescontoPdv } from './ModalDescontoPdv';
export { default as ModalFechamento } from './ModalFechamento';
export { ModalHistoricoVendas } from './ModalHistoricoVendas';
export { ModalListaTurnos } from './ModalListaTurnos';
export { ModalResumoTurno } from './ModalResumoTurno';
export { ModalVendasSuspensas } from './ModalVendasSuspensas';
export { ModalPesoBalanca } from './ModalPesoBalanca';
export { ModalSelecaoVariacao } from './ModalSelecaoVariacao';
export { ModalAberturaCaixa } from './ModalAberturaCaixa';
export { ModalMovimentacao } from './ModalMovimentacao';
export { ModalFinalizacao } from './ModalFinalizacao';
export { ModalRecibo } from './ModalRecibo';

// Aliases de compatibilidade — nomes usados pelo PdvModals.jsx legado
export { default as ModalFechamentoCaixa } from './ModalFechamento';
export { ModalHistoricoVendas as ModalHistorico } from './ModalHistoricoVendas';

// Re-exporta helpers para quem importava de PdvModals (PdvScreen, etc.)
export { formatarMoeda, formatarHora, formatarData } from './pdvHelpers';


