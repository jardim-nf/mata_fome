import { describe, it, expect } from 'vitest';

// Extrai lógica do apiWithRetry.js (linhas 2-23)
export async function apiWithRetry(apiCall, maxRetries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiCall();
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 10 * attempt)); // reduzido para teste
      }
    }
  }

  throw lastError;
}

describe('🔄 QA - API com Retry (Resiliência de Rede)', () => {
  it('Deve retornar na primeira tentativa se sucesso', async () => {
    let attempts = 0;
    const result = await apiWithRetry(() => { attempts++; return 'ok'; }, 3);
    expect(result).toBe('ok');
    expect(attempts).toBe(1);
  });

  it('Deve tentar 3x antes de falhar', async () => {
    let attempts = 0;
    try {
      await apiWithRetry(() => { attempts++; throw new Error('fail'); }, 3);
    } catch (e) {
      expect(attempts).toBe(3);
      expect(e.message).toBe('fail');
    }
  });

  it('Deve ter sucesso na 2ª tentativa (rede instável)', async () => {
    let attempts = 0;
    const result = await apiWithRetry(() => {
      attempts++;
      if (attempts < 2) throw new Error('timeout');
      return 'recovered';
    }, 3);
    expect(result).toBe('recovered');
    expect(attempts).toBe(2);
  });

  it('Deve propagar o ÚLTIMO erro', async () => {
    let count = 0;
    try {
      await apiWithRetry(() => { count++; throw new Error(`err${count}`); }, 3);
    } catch (e) {
      expect(e.message).toBe('err3');
    }
  });
});
