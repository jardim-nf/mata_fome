import { describe, it, expect } from 'vitest';

/**
 * ⚠️ BUG ENCONTRADO: CPF na NFC-e não é validado
 * 
 * Arquivo: ModalPagamento.jsx (linhas 714-717)
 * O campo CPF aceita qualquer coisa (maxLength=11, mas semvalidação de dígito).
 * Um CPF inválido vai falhar na SEFAZ e rejeitar a nota.
 * 
 * MELHORIA: validar antes de enviar.
 */

export function validarCpf(cpf) {
  if (!cpf) return { valido: true, formatado: '' }; // CPF opcional na NFC-e
  
  const numeros = cpf.replace(/\D/g, '');
  
  if (numeros.length !== 11) return { valido: false, erro: 'CPF deve ter 11 dígitos' };
  
  // Regra: todos os dígitos iguais são inválidos
  if (/^(\d)\1{10}$/.test(numeros)) return { valido: false, erro: 'CPF inválido (dígitos repetidos)' };
  
  // Validação dos dígitos verificadores
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(numeros[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numeros[9])) return { valido: false, erro: 'CPF inválido (dígito verificador)' };

  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(numeros[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(numeros[10])) return { valido: false, erro: 'CPF inválido (dígito verificador)' };

  return { valido: true, formatado: numeros };
}

// Sanitização de nome de cliente (XSS)
export function sanitizarNomeCliente(nome) {
  if (!nome) return '';
  return nome
    .replace(/<[^>]*>/g, '')            // Remove HTML tags
    .replace(/[<>"'&;]/g, '')           // Remove caracteres perigosos
    .trim()
    .substring(0, 100);                 // Limita tamanho
}

// Validação de telefone brasileiro
export function validarTelefone(tel) {
  if (!tel) return { valido: false, erro: 'Telefone obrigatório' };
  const numeros = tel.replace(/\D/g, '');
  if (numeros.length < 10 || numeros.length > 11) return { valido: false, erro: 'Telefone inválido' };
  return { valido: true, formatado: numeros };
}

describe('🧾 QA - Validação de CPF (NFC-e)', () => {
  it('CPF válido deve passar', () => {
    expect(validarCpf('52998224725').valido).toBe(true);
  });

  it('CPF vazio deve ser válido (opcional na NFC-e)', () => {
    expect(validarCpf('').valido).toBe(true);
    expect(validarCpf(null).valido).toBe(true);
  });

  it('CPF com menos de 11 dígitos deve falhar', () => {
    expect(validarCpf('1234567').valido).toBe(false);
  });

  it('CPF com todos os dígitos iguais deve falhar (111.111.111-11)', () => {
    expect(validarCpf('11111111111').valido).toBe(false);
    expect(validarCpf('00000000000').valido).toBe(false);
  });

  it('CPF com dígito verificador errado deve falhar', () => {
    expect(validarCpf('12345678901').valido).toBe(false);
  });

  it('CPF com máscara deve funcionar (remove não-numéricos)', () => {
    expect(validarCpf('529.982.247-25').valido).toBe(true);
  });
});

describe('🛡️ QA - Sanitização de Nome do Cliente', () => {
  it('Nome normal passa limpo', () => {
    expect(sanitizarNomeCliente('João Silva')).toBe('João Silva');
  });

  it('HTML tags são removidas', () => {
    // <script>alert("xss")</script> → primeiro remove tags → alert("xss")João → remove " → alert(xss)João
    const result = sanitizarNomeCliente('<script>alert("xss")</script>João');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
  });

  it('Caracteres perigosos removidos', () => {
    expect(sanitizarNomeCliente('João <> "Silva" & filho;')).toBe('João  Silva  filho');
  });

  it('Nome longo é truncado em 100 chars', () => {
    const nome = 'A'.repeat(200);
    expect(sanitizarNomeCliente(nome).length).toBe(100);
  });

  it('Nome vazio retorna string vazia', () => {
    expect(sanitizarNomeCliente(null)).toBe('');
    expect(sanitizarNomeCliente('')).toBe('');
  });
});

describe('📱 QA - Validação de Telefone', () => {
  it('Celular válido (11 dígitos): (11) 99999-9999', () => {
    expect(validarTelefone('11999999999').valido).toBe(true);
  });

  it('Fixo válido (10 dígitos): (11) 3333-4444', () => {
    expect(validarTelefone('1133334444').valido).toBe(true);
  });

  it('Telefone curto demais deve falhar', () => {
    expect(validarTelefone('123').valido).toBe(false);
  });

  it('Telefone vazio deve falhar', () => {
    expect(validarTelefone('').valido).toBe(false);
  });

  it('Telefone com máscara deve funcionar', () => {
    expect(validarTelefone('(11) 99999-9999').valido).toBe(true);
  });
});
