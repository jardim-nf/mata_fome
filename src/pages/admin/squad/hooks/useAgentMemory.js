import { useState, useCallback } from 'react';

/**
 * useAgentMemory — Manages long-term memory for AI agents using localStorage.
 * Allows agents to "remember" architectural decisions, coding patterns, and past discussions.
 */

const STORAGE_KEY = 'squad3d_agent_memory';

export const useAgentMemory = () => {
  const [memory, setMemory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      oscar: { decissoes: [], padroes: [] },
      leo: { padroesUI: [], componentesReutilizaveis: [] },
      afrodite: { regrasBanco: [], collections: [] },
      thor: { validacoesFrequentes: [] },
      sabotagem: { campanhasAnteriores: [] },
    };
  });

  const persist = (newMemory) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newMemory));
    setMemory(newMemory);
  };

  const addMemory = useCallback((agentId, category, itemText) => {
    setMemory(prev => {
      const agentMem = prev[agentId] || {};
      const catArray = agentMem[category] || [];
      // Keep only the last 10 items per category to avoid prompt bloating
      const newArray = [itemText, ...catArray].slice(0, 10);
      
      const updated = {
        ...prev,
        [agentId]: {
          ...agentMem,
          [category]: newArray
        }
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearMemory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setMemory({});
  }, []);

  const formatAgentMemoryForPrompt = useCallback((agentId) => {
    const mem = memory[agentId];
    if (!mem) return '';
    
    let text = 'MEMÓRIA DE LONGO PRAZO:\n';
    let hasMemory = false;
    
    for (const [cat, items] of Object.entries(mem)) {
      if (items.length > 0) {
        hasMemory = true;
        text += `- ${cat.toUpperCase()}:\n`;
        items.forEach(item => {
          text += `  * ${item}\n`;
        });
      }
    }
    
    return hasMemory ? text : '';
  }, [memory]);

  return { memory, addMemory, clearMemory, formatAgentMemoryForPrompt };
};
