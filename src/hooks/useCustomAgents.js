import { useState, useCallback } from 'react';

/**
 * useCustomAgents — Manage custom AI agents with personalities stored in localStorage
 * Custom agents can be added to the Squad alongside or replacing default agents.
 */

const STORAGE_KEY = 'squad3d_custom_agents';

const EMOJI_OPTIONS = ['🧠', '🦾', '🎯', '🔮', '🚀', '💡', '🛡️', '⚙️', '🌊', '🔥', '🎪', '🎭', '🐉', '👁️', '🌟', '💎', '🦅', '🐺', '🧬', '🎸'];
const COLOR_OPTIONS = [
  { label: 'Roxo', hex: '#8b5cf6', three: 0x8b5cf6 },
  { label: 'Azul', hex: '#3b82f6', three: 0x3b82f6 },
  { label: 'Ciano', hex: '#06b6d4', three: 0x06b6d4 },
  { label: 'Verde', hex: '#10b981', three: 0x10b981 },
  { label: 'Amarelo', hex: '#f59e0b', three: 0xf59e0b },
  { label: 'Rosa', hex: '#ec4899', three: 0xec4899 },
  { label: 'Vermelho', hex: '#ef4444', three: 0xef4444 },
  { label: 'Laranja', hex: '#f97316', three: 0xf97316 },
];

const PERSONALITY_TEMPLATES = [
  { label: '🤖 Analítico', prompt: 'Você é um agente analítico e metódico. Responda com dados, métricas e lógica. Use linguagem técnica e precisa.' },
  { label: '🎨 Criativo', prompt: 'Você é um agente criativo e inovador. Pense fora da caixa, sugira soluções não-convencionais e use metáforas visuais.' },
  { label: '⚡ Veloz', prompt: 'Você é direto e objetivo. Respostas curtas, sem enrolação. Foque na solução e na ação imediata.' },
  { label: '🛡️ Cauteloso', prompt: 'Você é cuidadoso e detalhista. Sempre levante riscos, edge cases e considerações de segurança. Prefira validação antes de ação.' },
  { label: '🎯 Estrategista', prompt: 'Você pensa em longo prazo. Conecte decisões técnicas com impacto no negócio, ROI e escalabilidade.' },
  { label: '📚 Professor', prompt: 'Você explica conceitos de forma didática. Use analogias, exemplos e quebre problemas complexos em partes simples.' },
  { label: '✍️ Custom', prompt: '' },
];

export const useCustomAgents = () => {
  const [customAgents, setCustomAgents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch { return {}; }
  });

  const persist = (agents) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    setCustomAgents(agents);
  };

  const saveAgent = useCallback((agentData) => {
    const id = agentData.id || `custom_${Date.now()}`;
    const agent = {
      id,
      nome: agentData.nome || 'Novo Agente',
      cargo: agentData.cargo || 'Agente Customizado',
      emoji: agentData.emoji || '🧠',
      color: agentData.color || 0x8b5cf6,
      phase: agentData.phase || 'custom',
      isCustom: true,
      systemPrompt: agentData.systemPrompt || '',
      createdAt: agentData.createdAt || new Date().toISOString(),
    };
    const updated = { ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'), [id]: agent };
    persist(updated);
    return id;
  }, []);

  const deleteAgent = useCallback((id) => {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete existing[id];
    persist(existing);
  }, []);

  const updateAgent = useCallback((id, updates) => {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (existing[id]) {
      existing[id] = { ...existing[id], ...updates };
      persist(existing);
    }
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setCustomAgents({});
  }, []);

  return {
    customAgents,
    saveAgent,
    deleteAgent,
    updateAgent,
    clearAll,
    EMOJI_OPTIONS,
    COLOR_OPTIONS,
    PERSONALITY_TEMPLATES,
  };
};
