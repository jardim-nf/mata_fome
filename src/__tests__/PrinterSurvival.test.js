import { describe, it, expect, vi } from 'vitest';

// Simulação Isolada do Fluxo de Impressão do printService.js
export async function tentarImprimirSeguro(qzMock, config, conteudo) {
  try {
    if (!qzMock.websocket.isActive()) {
      await qzMock.websocket.connect();
    }
    await qzMock.print(config, conteudo);
    return { sucesso: true, filaPendente: false };
  } catch (error) {
    // Escudo: Retornar pra fila sem Crash visual pra tela do caixa
    console.warn('QZTray offline. Guardando na memória.');
    return { sucesso: false, erro: error.message, filaPendente: true };
  }
}

describe('🖨️ QA - Proteção de Hardware e Impressão', () => {
  it('Impressão perfeita deve passar limpo', async () => {
    const qzMockNormal = {
      websocket: { isActive: () => true, connect: async () => true },
      print: async () => true
    };
    
    const resultado = await tentarImprimirSeguro(qzMockNormal, {}, 'Cozinha: 1x Burguer');
    expect(resultado.sucesso).toBe(true);
    expect(resultado.filaPendente).toBe(false);
  });

  it('Desconexão severa de Cabo USB ou Rede não deve travar o POS', async () => {
    const qzMockQuebrado = {
      websocket: { 
        isActive: () => false, 
        connect: async () => { throw new Error("Socket refused"); } 
      },
      print: async () => { throw new Error("Not reachable"); }
    };
    
    // Testa se o catch interno segurou o erro (se o await abaixo não explodir o runtime, passou!)
    const resultado = await tentarImprimirSeguro(qzMockQuebrado, {}, 'Receita de Desastre');
    
    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toBe("Socket refused");
    expect(resultado.filaPendente).toBe(true); // O Painel sabe que a comanda deve re-tentar na fila
  });
});
