import { describe, it, expect } from 'vitest';

// Extrai lógica do AdminReports.jsx (linhas 481-494) 
export function gerarConteudoCsv(pedidos) {
  const headers = ['Data', 'Hora', 'ID', 'Tipo', 'Mesa', 'Cliente', 'Motoboy', 'Bairro', 'Status', 'Pagamento', 'Total'];
  
  const rows = pedidos.map(p => {
    const data = p.data instanceof Date ? p.data : new Date(p.data);
    return [
      data.toLocaleDateString('pt-BR'),
      data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      p.id || '',
      p.tipo || '',
      p.mesaNumero || '-',
      p.clienteNome || '',
      p.motoboyNome || '-',
      p.bairro || '-',
      p.status || '',
      p.formaPagamento || '',
      (p.totalFinal || 0).toFixed(2).replace('.', ',')
    ];
  });

  return [headers, ...rows].map(e => e.join(";")).join("\n");
}

// Simula injection de fórmula CSV (CSV Injection / Formula Injection)
export function sanitizarCampoCsv(valor) {
  const s = String(valor || '');
  // Protege contra CSV injection (=, +, -, @)
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

describe('📊 QA - Exportação CSV de Relatório', () => {
  const pedidos = [
    { data: new Date('2025-03-15T14:30:00'), id: 'abc123', tipo: 'delivery', mesaNumero: null, clienteNome: 'João', motoboyNome: 'Carlos', bairro: 'Centro', status: 'finalizado', formaPagamento: 'pix', totalFinal: 55.50 },
    { data: new Date('2025-03-15T18:00:00'), id: 'def456', tipo: 'mesa', mesaNumero: 5, clienteNome: 'Mesa 5', motoboyNome: null, bairro: null, status: 'finalizada', formaPagamento: 'dinheiro', totalFinal: 120 }
  ];

  it('Deve conter cabeçalho correto com 11 colunas', () => {
    const csv = gerarConteudoCsv(pedidos);
    const header = csv.split('\n')[0];
    expect(header.split(';').length).toBe(11);
    expect(header).toContain('Data');
    expect(header).toContain('Total');
  });

  it('Deve usar ponto-e-vírgula como separador (Excel PT-BR)', () => {
    const csv = gerarConteudoCsv(pedidos);
    expect(csv).toContain(';');
    expect(csv).not.toContain('\t'); // Não usa tab
  });

  it('Total deve estar em formato BR: vírgula como decimal', () => {
    const csv = gerarConteudoCsv(pedidos);
    expect(csv).toContain('55,50');
    expect(csv).toContain('120,00');
  });

  it('Mesa null deve mostrar "-" (não "null" ou "undefined")', () => {
    const csv = gerarConteudoCsv(pedidos);
    const linhaDelivery = csv.split('\n')[1];
    expect(linhaDelivery).toContain('-');
    expect(linhaDelivery).not.toContain('null');
  });

  it('CSV vazio deve retornar apenas cabeçalho', () => {
    const csv = gerarConteudoCsv([]);
    const linhas = csv.split('\n');
    expect(linhas.length).toBe(1);
  });
});

describe('📊 QA - Proteção contra CSV Injection', () => {
  it('Deve escapar campos começando com = (fórmula Excel)', () => {
    expect(sanitizarCampoCsv('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
  });

  it('Deve escapar campos começando com + ou -', () => {
    expect(sanitizarCampoCsv('+cmd|/C whoami')).toBe("'+cmd|/C whoami");
    expect(sanitizarCampoCsv('-1+1')).toBe("'-1+1");
  });

  it('Deve escapar campos começando com @', () => {
    expect(sanitizarCampoCsv('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('Deve deixar texto normal intacto', () => {
    expect(sanitizarCampoCsv('João da Silva')).toBe('João da Silva');
  });
});
