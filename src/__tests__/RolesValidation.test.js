import { describe, it, expect } from 'vitest';

export function temPermissao(roleAdmin, roleExigida) {
  const ALCADA = {
    'master': 100,
    'gerente': 50,
    'caixa': 20,
    'garcom': 10,
    'auxiliar': 5
  };
  return (ALCADA[roleAdmin] || 0) >= (ALCADA[roleExigida] || 0);
}

describe('🧪 Validação de Roles & Hierarquia', () => {
  it('Master deve ter acesso a ações de Gerente', () => {
    expect(temPermissao('master', 'gerente')).toBe(true);
  });

  it('Garçom NÃO deve ter acesso a ações de Caixa', () => {
    expect(temPermissao('garcom', 'caixa')).toBe(false);
  });

  it('Role inexistente deve ter privilégio zero', () => {
    expect(temPermissao('intruso', 'auxiliar')).toBe(false);
  });
});
