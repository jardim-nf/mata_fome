import { describe, it, expect } from 'vitest';

// Extrai lógica do formatDate.js (linhas 2-14)
export function formatarHora(data) {
  if (!data) return '--:--';
  if (data.toDate) return data.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (data instanceof Date) return data.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return '--:--';
}

export function formatarData(data) {
  if (!data) return '-';
  if (data.toDate) return data.toDate().toLocaleDateString('pt-BR');
  if (data instanceof Date) return data.toLocaleDateString('pt-BR');
  return '-';
}

describe('📅 QA - Formatação de Data/Hora', () => {
  it('Data null deve retornar "--:--" para hora', () => {
    expect(formatarHora(null)).toBe('--:--');
    expect(formatarHora(undefined)).toBe('--:--');
  });

  it('Data null deve retornar "-" para data', () => {
    expect(formatarData(null)).toBe('-');
    expect(formatarData(undefined)).toBe('-');
  });

  it('Date válida deve formatar hora', () => {
    const d = new Date('2025-03-15T14:30:00');
    const resultado = formatarHora(d);
    expect(resultado).toContain('14');
    expect(resultado).toContain('30');
  });

  it('Date válida deve formatar data pt-BR', () => {
    const d = new Date('2025-03-15T14:30:00');
    const resultado = formatarData(d);
    expect(resultado).toContain('15');
    expect(resultado).toContain('03');
    expect(resultado).toContain('2025');
  });

  it('Timestamp do Firestore (com .toDate()) deve funcionar', () => {
    const fakeTimestamp = { toDate: () => new Date('2025-06-20T10:00:00') };
    const hora = formatarHora(fakeTimestamp);
    expect(hora).toContain('10');
    expect(hora).toContain('00');

    const data = formatarData(fakeTimestamp);
    expect(data).toContain('20');
    expect(data).toContain('06');
  });

  it('String passada diretamente deve retornar fallback', () => {
    expect(formatarHora('alguma coisa')).toBe('--:--');
    expect(formatarData('alguma coisa')).toBe('-');
  });
});
