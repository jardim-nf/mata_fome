/**
 * Roles do sistema — fonte única de verdade.
 * Usar sempre estas constantes em vez de strings hardcoded.
 */
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  MASTER_ADMIN: 'masterAdmin',
  GERENTE: 'gerente',
  GARCOM: 'garcom',
  COZINHEIRO: 'cozinheiro',
  CAIXA: 'caixa',
  ATENDENTE: 'atendente',
  ENTREGADOR: 'entregador',
  AUXILIAR: 'auxiliar',
});

/**
 * Grupos de roles pré-definidos (combinações mais usadas).
 * Evita duplicação de arrays em cada rota.
 */
export const ROLE_GROUPS = Object.freeze({
  /** Apenas administradores */
  ADMIN_ONLY: [ROLES.ADMIN, ROLES.MASTER_ADMIN],

  /** Apenas master admin */
  MASTER_ONLY: [ROLES.MASTER_ADMIN],

  /** Admin + Gerente (relatórios, analytics) */
  ADMIN_GERENTE: [ROLES.ADMIN, ROLES.MASTER_ADMIN, ROLES.GERENTE],

  /** PDV: admin, gerente, caixa */
  PDV: [ROLES.ADMIN, ROLES.MASTER_ADMIN, ROLES.GERENTE, ROLES.CAIXA],

  /** Salão: admin, gerente, garçom, atendente */
  SALAO: [ROLES.ADMIN, ROLES.MASTER_ADMIN, ROLES.GERENTE, ROLES.GARCOM, ROLES.ATENDENTE],

  /** Todos os roles (painel geral, dashboard) */
  TODOS: [
    ROLES.ADMIN,
    ROLES.MASTER_ADMIN,
    ROLES.GERENTE,
    ROLES.GARCOM,
    ROLES.COZINHEIRO,
    ROLES.CAIXA,
    ROLES.ATENDENTE,
    ROLES.ENTREGADOR,
    ROLES.AUXILIAR,
  ],
});
