import { describe, it, expect } from 'vitest';

// Extrai validação do Menu.jsx (linha 516) e CheckoutPage.jsx
export function validarEnderecoDelivery(endereco, isRetirada) {
  // Se é retirada, não precisa de endereço
  if (isRetirada) return { valido: true };

  if (!endereco) return { valido: false, campo: 'endereco', motivo: 'Endereço não informado.' };
  if (!endereco.rua || !endereco.rua.trim()) return { valido: false, campo: 'rua', motivo: 'Preencha a RUA.' };
  if (!endereco.numero || !endereco.numero.trim()) return { valido: false, campo: 'numero', motivo: 'Preencha o NÚMERO.' };
  
  return { valido: true };
}

// Extrai normalização de endereço pra impressão (printService.js linha 70-77)
export function formatarEnderecoParaImpressao(pedido) {
  const endData = pedido.cliente?.endereco;
  if (!endData) return null;

  const partes = [];
  if (endData.rua) partes.push(`End: ${endData.rua}, ${endData.numero || 'S/N'}`);
  if (endData.bairro) partes.push(`Bairro: ${endData.bairro}`);
  if (endData.complemento) partes.push(`Comp: ${endData.complemento}`);
  if (endData.referencia) partes.push(`Ref: ${endData.referencia}`);

  return partes;
}

describe('📍 QA - Validação de Endereço para Delivery', () => {
  it('Deve aceitar endereço completo', () => {
    const result = validarEnderecoDelivery({ rua: 'Av Brasil', numero: '123', bairro: 'Centro' }, false);
    expect(result.valido).toBe(true);
  });

  it('Deve barrar se rua está vazia', () => {
    const result = validarEnderecoDelivery({ rua: '', numero: '123' }, false);
    expect(result.valido).toBe(false);
    expect(result.campo).toBe('rua');
  });

  it('Deve barrar se número está vazio', () => {
    const result = validarEnderecoDelivery({ rua: 'Rua X', numero: '   ' }, false);
    expect(result.valido).toBe(false);
    expect(result.campo).toBe('numero');
  });

  it('Deve ignorar validação de endereço para RETIRADA', () => {
    const result = validarEnderecoDelivery(null, true);
    expect(result.valido).toBe(true);
  });

  it('Deve barrar se endereço é null (delivery sem cadastro)', () => {
    const result = validarEnderecoDelivery(null, false);
    expect(result.valido).toBe(false);
  });
});

describe('📍 QA - Formatação de Endereço na Comanda Impressa', () => {
  it('Deve formatar endereço completo com todas as linhas', () => {
    const pedido = {
      cliente: { endereco: { rua: 'Av Brasil', numero: '500', bairro: 'Centro', complemento: 'Apto 301', referencia: 'Próximo ao Banco' } }
    };
    const linhas = formatarEnderecoParaImpressao(pedido);
    expect(linhas.length).toBe(4);
    expect(linhas[0]).toContain('Av Brasil');
    expect(linhas[3]).toContain('Próximo ao Banco');
  });

  it('Deve pôr S/N quando não tem número', () => {
    const pedido = { cliente: { endereco: { rua: 'Rua X', numero: '', bairro: 'Bairro Y' } } };
    const linhas = formatarEnderecoParaImpressao(pedido);
    expect(linhas[0]).toContain('S/N');
  });

  it('Deve retornar null quando não tem endereço (pedido de mesa)', () => {
    const pedido = { cliente: {} };
    expect(formatarEnderecoParaImpressao(pedido)).toBeNull();
  });
});
