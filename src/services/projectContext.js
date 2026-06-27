// src/services/projectContext.js

export const PROJECT_CONTEXT = {
  stack: 'React 18 + Vite + Firebase Firestore + Three.js',
  estrutura: {
    'src/pages/admin/': 'Dashboards administrativos e Reunião 3D (Vidraçaria, Marmoraria, PDV, SquadMeeting3D)',
    'src/pages/admin/squad/': 'Módulos, hooks, constants e UI do Squad',
    'src/components/': 'Componentes reutilizáveis (modais, botões, wrappers)',
    'src/services/': 'Integrações com IA (aiService) e config do contexto do projeto (projectContext)',
    'src/hooks/': 'Custom hooks gerais (ex: useMeetingHistory, usePdvCaixa)',
  },
  convencoes: [
    'Para estados locais muito complexos (5+ campos ou steps lógicos pesados), deve-se usar useReducer ao invés de múltiplos useState (ex: useSquadReducer).',
    'Arquivos grandes devem ser decompostos: lógica complexa vai para custom hooks.',
    'No front-end 3D, usamos Three.js de forma imperativa encapsulado em custom hooks passando `stateRef` para performance, ao invés de usar @react-three/fiber.',
    'A base de dados principal é o Firebase Firestore. Deve-se estruturar as collections seguindo sub-coleções lógicas.',
    'CSS de novos componentes UI deve ser modularizado e co-localizado com o arquivo JSX.'
  ]
};

export const formatProjectContext = () => {
  return `
---
[CONTEXTO TÉCNICO DO PROJETO - IDEA ERP]
Stack: ${PROJECT_CONTEXT.stack}

Principais Convenções:
${PROJECT_CONTEXT.convencoes.map(c => '- ' + c).join('\n')}

Mapeamento de Pastas:
${Object.entries(PROJECT_CONTEXT.estrutura).map(([path, desc]) => `- ${path} : ${desc}`).join('\n')}
---`;
};
