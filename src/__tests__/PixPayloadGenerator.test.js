import { describe, it, expect } from 'vitest';

// Extrai lógica EXATA do PaymentModal.jsx (linhas 19-75)
const sanitizeTxId = (text) => {
    if (!text) return '***';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "");
};

const sanitizeText = (text) => {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
};

const sanitizeKey = (key) => {
    if (!key) return '';
    return key.trim().replace(/[^a-zA-Z0-9@.\-+]/g, "");
};

const generatePixPayload = ({ key, name, city, transactionId, amount }) => {
    const cleanKey = sanitizeKey(key);
    const cleanName = sanitizeText(name || 'LOJA').substring(0, 25);
    const cleanCity = sanitizeText(city || 'BRASIL').substring(0, 15);
    const cleanTxId = sanitizeTxId(transactionId).substring(0, 25) || '***';
    const cleanAmount = Number(amount).toFixed(2);

    const format = (id, value) => {
        const str = String(value);
        const len = str.length.toString().padStart(2, '0');
        return `${id}${len}${str}`;
    };

    const payloadFormat = format('00', '01');
    const merchantAccount = format('26', format('00', 'br.gov.bcb.pix') + format('01', cleanKey));
    const merchantCat = format('52', '0000');
    const currency = format('53', '986');
    const amountField = format('54', cleanAmount);
    const country = format('58', 'BR');
    const merchantName = format('59', cleanName);
    const merchantCity = format('60', cleanCity);
    const additionalData = format('62', format('05', cleanTxId));
    const payloadBase = `${payloadFormat}${merchantAccount}${merchantCat}${currency}${amountField}${country}${merchantName}${merchantCity}${additionalData}6304`;

    const polynomial = 0x1021;
    let crc = 0xFFFF;
    for (let i = 0; i < payloadBase.length; i++) {
        crc ^= payloadBase.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ polynomial;
            else crc = crc << 1;
        }
    }
    crc &= 0xFFFF;
    const crcStr = crc.toString(16).toUpperCase().padStart(4, '0');
    return `${payloadBase}${crcStr}`;
};

describe('💳 QA - Gerador de Payload PIX (EMVCo BR Code)', () => {
  it('Deve gerar payload começando com 000201 (formato PIX obrigatório)', () => {
    const payload = generatePixPayload({ key: '22998102575', name: 'MATAFOME', city: 'MACAE', transactionId: 'pedido123', amount: 50 });
    expect(payload.startsWith('000201')).toBe(true);
  });

  it('Deve conter o domínio br.gov.bcb.pix no merchant account', () => {
    const payload = generatePixPayload({ key: 'teste@email.com', name: 'LOJA', city: 'RIO', transactionId: 'tx1', amount: 10 });
    expect(payload).toContain('br.gov.bcb.pix');
  });

  it('Deve conter código de moeda 986 (Real Brasileiro)', () => {
    const payload = generatePixPayload({ key: '123', name: 'T', city: 'C', transactionId: 'x', amount: 1 });
    expect(payload).toContain('5303986');
  });

  it('Deve formatar o valor com 2 casas decimais', () => {
    const payload = generatePixPayload({ key: '123', name: 'T', city: 'C', transactionId: 'x', amount: 35.5 });
    expect(payload).toContain('35.50');
  });

  it('Deve terminar com CRC16 de 4 caracteres hex (63 + 04 + XXXX)', () => {
    const payload = generatePixPayload({ key: '22998102575', name: 'LOJA', city: 'MACAE', transactionId: 'abc', amount: 20 });
    expect(payload).toMatch(/6304[A-F0-9]{4}$/);
  });

  it('Deve gerar payloads DIFERENTES para valores diferentes', () => {
    const p1 = generatePixPayload({ key: '123', name: 'T', city: 'C', transactionId: 'x', amount: 10 });
    const p2 = generatePixPayload({ key: '123', name: 'T', city: 'C', transactionId: 'x', amount: 50 });
    expect(p1).not.toBe(p2);
  });
});

describe('💳 QA - Sanitização PIX (Anti-Injeção)', () => {
  it('sanitizeTxId deve remover acentos e caracteres especiais', () => {
    expect(sanitizeTxId('café-123')).toBe('cafe123');
  });

  it('sanitizeText deve remover acentos e converter para UPPERCASE', () => {
    expect(sanitizeText('João da Silva')).toBe('JOAO DA SILVA');
  });

  it('sanitizeKey deve manter @, . e - (chaves PIX válidas)', () => {
    expect(sanitizeKey('email@loja.com')).toBe('email@loja.com');
    expect(sanitizeKey('+5522998102575')).toBe('+5522998102575');
  });

  it('sanitizeKey deve remover caracteres perigosos', () => {
    expect(sanitizeKey('chave<script>alert(1)</script>')).toBe('chavescriptalert1script');
  });

  it('sanitizeTxId null deve retornar "***"', () => {
    expect(sanitizeTxId(null)).toBe('***');
    expect(sanitizeTxId('')).toBe('***');
  });
});
