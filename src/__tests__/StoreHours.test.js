import { describe, it, expect } from 'vitest';

// Replica EXATA do algoritmo corrigido do Menu.jsx para validação isolada
export function checarIsLojaAberta(estabelecimentoInfo, dataFakeString) {
  if (!estabelecimentoInfo) return false;
  const fakeDate = new Date(dataFakeString);
  const dias = ['domingo','segunda','terca','quarta','quinta','sexta','sabado'];
  const diaKey = dias[fakeDate.getDay()];
  const diaAnteriorKey = dias[(fakeDate.getDay() + 6) % 7];

  // Se está marcado botão "forçar fechado" pelo admin
  if (estabelecimentoInfo.forcadoFechado) return false;

  const calcTempo = (str) => {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const verificar = (abertura, fechamento) => {
    try {
      const agora = fakeDate.getHours() * 60 + fakeDate.getMinutes();
      const abre = calcTempo(abertura);
      const fecha = calcTempo(fechamento);
      if (abre === fecha) return true;
      return abre < fecha ? (agora >= abre && agora <= fecha) : (agora >= abre || agora <= fecha);
    } catch { return true; }
  };

  const checarTurnoAnterior = () => {
    if (estabelecimentoInfo.horariosFuncionamento) {
      const configOntem = estabelecimentoInfo.horariosFuncionamento[diaAnteriorKey];
      if (!configOntem?.ativo || !configOntem.abertura || !configOntem.fechamento) return false;
      const abreOntem = calcTempo(configOntem.abertura);
      const fechaOntem = calcTempo(configOntem.fechamento);
      if (fechaOntem < abreOntem) {
        const agoraMin = fakeDate.getHours() * 60 + fakeDate.getMinutes();
        return agoraMin <= fechaOntem;
      }
    }
    return false;
  };

  if (estabelecimentoInfo.horariosFuncionamento) {
    const config = estabelecimentoInfo.horariosFuncionamento[diaKey];
    if (config?.ativo) return verificar(config.abertura, config.fechamento);
    return checarTurnoAnterior();
  }
  if (estabelecimentoInfo.horaAbertura && estabelecimentoInfo.horaFechamento) {
    return verificar(estabelecimentoInfo.horaAbertura, estabelecimentoInfo.horaFechamento);
  }
  return true;
}

describe('⏱️ QA - Barreira de Caixa Fechado (com fix Madrugada)', () => {
  // Usa a estrutura REAL do Firebase: horariosFuncionamento
  const configReal = {
    forcadoFechado: false,
    horariosFuncionamento: {
      sexta:   { ativo: true, abertura: '18:00', fechamento: '23:00' },
      sabado:  { ativo: true, abertura: '18:00', fechamento: '02:00' }, // Cruza meia-noite!
      domingo: { ativo: false } // Domingo fechado
    }
  };

  it('Deve barrar cliente tentando comprar Domingo de manhã (10h)', () => {
    // 05/04/2026 é Domingo
    expect(checarIsLojaAberta(configReal, '2026-04-05T10:00:00')).toBe(false);
  });

  it('Deve aceitar cliente Sexta às 20h', () => {
    // 03/04/2026 é Sexta
    expect(checarIsLojaAberta(configReal, '2026-04-03T20:00:00')).toBe(true);
  });

  it('✅ FIX: Deve aceitar cliente às 01:30 de Domingo (turno do Sábado ainda ativo)', () => {
    // 05/04/2026 é Domingo, mas Sábado fechava às 02:00
    expect(checarIsLojaAberta(configReal, '2026-04-05T01:30:00')).toBe(true);
  });

  it('Deve barrar cliente às 03:00 de Domingo (já passou do fechamento de 02:00)', () => {
    expect(checarIsLojaAberta(configReal, '2026-04-05T03:00:00')).toBe(false);
  });

  it('Deve obedecer o Botão do Pânico (Forçado Fechado pelo Gerente)', () => {
    const configPanico = { ...configReal, forcadoFechado: true };
    expect(checarIsLojaAberta(configPanico, '2026-04-03T20:00:00')).toBe(false);
  });

  it('Deve barrar Sexta às 17h (antes de abrir às 18h)', () => {
    expect(checarIsLojaAberta(configReal, '2026-04-03T17:00:00')).toBe(false);
  });
});
