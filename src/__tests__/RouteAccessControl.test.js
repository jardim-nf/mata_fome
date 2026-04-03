import { describe, it, expect } from 'vitest';

// Extrai lógica de rotas do App.jsx (linhas 140-160) 
const ROLE_GROUPS = {
  TODOS: ['funcionario', 'garcomAtendente', 'caixa', 'gerente', 'admin', 'masterAdmin'],
  GARCOM_CIMA: ['garcomAtendente', 'caixa', 'gerente', 'admin', 'masterAdmin'],
  CAIXA_CIMA: ['caixa', 'gerente', 'admin', 'masterAdmin'],
  ADMIN_GERENTE: ['gerente', 'admin', 'masterAdmin'],
  ADMIN_ONLY: ['admin', 'masterAdmin'],
  MASTER_ONLY: ['masterAdmin']
};

// Simula o PrivateRoute real — verificação de acesso a rota
function temAcessoRota(userRole, rotaPermissions) {
  if (!userRole || !rotaPermissions) return false;
  return rotaPermissions.includes(userRole);
}

// Mapeamento de rotas → permissões exigidas (extraído do App.jsx)
const ROTAS_PERMISSOES = {
  '/admin/painel':          ROLE_GROUPS.TODOS,
  '/admin/salao':           ROLE_GROUPS.GARCOM_CIMA,
  '/admin/pdv':             ROLE_GROUPS.CAIXA_CIMA,
  '/admin/relatorios':      ROLE_GROUPS.ADMIN_GERENTE,
  '/admin/cardapio':        ROLE_GROUPS.ADMIN_GERENTE,
  '/admin/motoboys':        ROLE_GROUPS.ADMIN_GERENTE,
  '/admin/acerto-motoboys': ROLE_GROUPS.ADMIN_GERENTE,
  '/admin/config':          ROLE_GROUPS.ADMIN_ONLY,
  '/admin/fiscais':         ROLE_GROUPS.ADMIN_ONLY
};

describe('🔐 QA - Controle de Acesso por Rota (RBAC)', () => {
  it('Funcionário pode acessar Painel', () => {
    expect(temAcessoRota('funcionario', ROTAS_PERMISSOES['/admin/painel'])).toBe(true);
  });

  it('Funcionário NÃO pode acessar Salão', () => {
    expect(temAcessoRota('funcionario', ROTAS_PERMISSOES['/admin/salao'])).toBe(false);
  });

  it('Garçom pode acessar Salão', () => {
    expect(temAcessoRota('garcomAtendente', ROTAS_PERMISSOES['/admin/salao'])).toBe(true);
  });

  it('Garçom NÃO pode acessar PDV (caixa pra cima)', () => {
    expect(temAcessoRota('garcomAtendente', ROTAS_PERMISSOES['/admin/pdv'])).toBe(false);
  });

  it('Caixa pode acessar PDV', () => {
    expect(temAcessoRota('caixa', ROTAS_PERMISSOES['/admin/pdv'])).toBe(true);
  });

  it('Caixa NÃO pode acessar Relatórios', () => {
    expect(temAcessoRota('caixa', ROTAS_PERMISSOES['/admin/relatorios'])).toBe(false);
  });

  it('Gerente pode acessar Relatórios e Cardápio', () => {
    expect(temAcessoRota('gerente', ROTAS_PERMISSOES['/admin/relatorios'])).toBe(true);
    expect(temAcessoRota('gerente', ROTAS_PERMISSOES['/admin/cardapio'])).toBe(true);
  });

  it('Gerente NÃO pode acessar Config (admin-only)', () => {
    expect(temAcessoRota('gerente', ROTAS_PERMISSOES['/admin/config'])).toBe(false);
  });

  it('Admin pode acessar TUDO exceto Master-only', () => {
    expect(temAcessoRota('admin', ROTAS_PERMISSOES['/admin/config'])).toBe(true);
    expect(temAcessoRota('admin', ROTAS_PERMISSOES['/admin/painel'])).toBe(true);
  });

  it('MasterAdmin pode acessar TUDO', () => {
    Object.keys(ROTAS_PERMISSOES).forEach(rota => {
      expect(temAcessoRota('masterAdmin', ROTAS_PERMISSOES[rota])).toBe(true);
    });
  });

  it('Usuário sem role (null) = acesso negado em TUDO', () => {
    Object.keys(ROTAS_PERMISSOES).forEach(rota => {
      expect(temAcessoRota(null, ROTAS_PERMISSOES[rota])).toBe(false);
    });
  });
});

describe('🔐 QA - Hierarquia de Grupos de Permissão', () => {
  it('TODOS deve ter 6 roles', () => {
    expect(ROLE_GROUPS.TODOS.length).toBe(6);
  });

  it('Cada grupo deve ser subconjunto do anterior (hierarquia cascata)', () => {
    expect(ROLE_GROUPS.MASTER_ONLY.every(r => ROLE_GROUPS.ADMIN_ONLY.includes(r))).toBe(true);
    expect(ROLE_GROUPS.ADMIN_ONLY.every(r => ROLE_GROUPS.ADMIN_GERENTE.includes(r))).toBe(true);
    expect(ROLE_GROUPS.ADMIN_GERENTE.every(r => ROLE_GROUPS.CAIXA_CIMA.includes(r))).toBe(true);
    expect(ROLE_GROUPS.CAIXA_CIMA.every(r => ROLE_GROUPS.GARCOM_CIMA.includes(r))).toBe(true);
    expect(ROLE_GROUPS.GARCOM_CIMA.every(r => ROLE_GROUPS.TODOS.includes(r))).toBe(true);
  });

  it('masterAdmin deve estar presente em TODOS os grupos', () => {
    Object.values(ROLE_GROUPS).forEach(group => {
      expect(group.includes('masterAdmin')).toBe(true);
    });
  });
});
