import { formatProjectContext } from './projectContext';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
/**
 * Service to parse sales text into structural parameters for Vidraçaria and Marmoraria dashboards.
 * Uses client-side direct API calls to OpenAI or Gemini depending on key availability.
 */

export const getApiKeyAndModel = (taskType = 'general', contentSize = 0) => {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const hasOpenAI = openaiKey && !openaiKey.includes("sk-proj-YOUR_KEY");
  const hasGemini = geminiKey && !geminiKey.includes("AIzaSyCt_YOUR_KEY");

  // Fallback se não tiver nenhuma
  if (!hasOpenAI && !hasGemini) {
    return { provider: null, key: null, model: null };
  }

  // GATEWAY HÍBRIDO
  // 1. Tarefas rígidas de formatação JSON estruturado vão para OpenAI
  if (taskType === 'strict_json' && hasOpenAI) {
    return { provider: 'openai', key: openaiKey, model: 'gpt-4o-mini' };
  }

  // 2. Tarefas gigantes, bate-papo geral ou contexto massivo vão para Gemini
  if (hasGemini && (contentSize > 4000 || taskType === 'chat' || !hasOpenAI)) {
    return { provider: 'gemini', key: geminiKey, model: 'gemini-2.5-flash' };
  }

  // Fallback padrão se não se encaixar em regras específicas
  if (hasOpenAI) return { provider: 'openai', key: openaiKey, model: 'gpt-4o-mini' };
  
  return { provider: 'gemini', key: geminiKey, model: 'gemini-2.5-flash' };
};

const queryOpenAI = async (key, model, prompt) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Você é um assistente especialista em ERP de Vidraçaria e Marmoraria. Retorne sempre apenas o objeto JSON solicitado, sem formatação extra."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const queryGemini = async (key, model, prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt + "\nRetorne estritamente um objeto JSON puro. Não use marcação markdown de código like ```json ... ```, apenas retorne o JSON diretamente em formato texto puro."
        }]
      }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
};

export const parseProjectText = async (text, isMarmoraria = false) => {
  const { provider, key, model } = getApiKeyAndModel('strict_json');

  if (!provider) {
    throw new Error('Nenhuma chave de API configurada para IA (VITE_OPENAI_API_KEY ou VITE_GEMINI_API_KEY).');
  }

  let prompt = '';

  if (isMarmoraria) {
    prompt = `
Dado o seguinte texto de pedido de marmoraria:
"${text}"

Extraia os parâmetros estruturais e as informações de cliente. Preencha os valores padrão mais lógicos caso estejam ausentes.
Retorne um objeto JSON exatamente com este formato:
{
  "modelo": "cozinha" | "banheiro" | "soleira" | "peitoril" | "ilha",
  "largura": número (em milímetros, ex: 1,5m vira 1500, 80cm vira 800),
  "profundidade": número (em milímetros, ex: 60cm vira 600, 0.5m vira 500, padrão cozinha: 600, padrão banheiro: 500),
  "pedra": "Nome exato da rocha comercial" (ex: "Granito Preto São Gabriel", "Granito Verde Ubatuba", "Granito Cinza Corumbá", "Mármore Branco Carrara", "Mármore Travertino Nacional", "Quartzo Branco Estelar", "Quartzo Cinza Absoluto"),
  "saiaAtiva": true | false,
  "alturaSaia": número (em milímetros, ex: 4cm vira 40, padrão: 40),
  "rodopiaAtivo": true | false,
  "alturaRodopia": número (em milímetros, ex: 10cm vira 100, padrão: 100),
  "acabamento": "Nome exato do acabamento" (ex: "Reto Lapidado", "Meia Esquadria (Ingletado)", "Boleado Simples", "Boleado Duplo", "Biselado"),
  "clienteNome": "Nome do cliente extraído ou vazio",
  "clienteTelefone": "Apenas números do telefone extraídos ou vazio",
  "clienteEndereco": "Endereço completo extraído ou vazio",
  "observacoes": "Quaisquer observações adicionais como rebaixos, cubas esculpidas ou prazos de entrega",
  "explicacao": "Resumo de uma linha em português do projeto que você entendeu."
}
`;
  } else {
    prompt = `
Dado o seguinte texto de pedido de vidraçaria:
"${text}"

Extraia os parâmetros estruturais e as informações de cliente. Preencha os valores padrão mais lógicos caso estejam ausentes.
Retorne um objeto JSON exatamente com este formato:
{
  "modelo": "box" | "janela" | "porta" | "espelho" | "outros",
  "modeloNome": "Nome exato do modelo padrão" (ex: "Box de Banheiro (Padrão)", "Box de Abrir (Empurrar)", "Box Elegance (Roldanas Aparentes)", "Box Flex (Porta Sanfonada)", "Box de Canto (L)", "Janela de Correr (2 Folhas)", "Janela de Correr (4 Folhas)", "Janela de Abrir / Giro (2 Folhas)", "Janela Basculante / Maxim-ar", "Porta de Correr (2 Folhas)", "Porta de Correr (4 Folhas)", "Porta Pivotante", "Porta de Abrir / Giro (Comum)", "Espelho sob Medida", "Outros Projetos"),
  "largura": número (em milímetros, ex: 1.2m vira 1200, 90cm vira 900),
  "altura": número (em milímetros, ex: 1.9m vira 1900, 1.8m vira 1800),
  "corVidro": "Incolor" | "Fumê" | "Bronze" | "Verde",
  "corAluminio": "fosco" | "branco" | "preto" | "bronze" | "brilhante",
  "puxador": "padrao" | "knob" | "furo" | "sem",
  "clienteNome": "Nome do cliente extraído ou vazio",
  "clienteTelefone": "Apenas números do telefone extraídos ou vazio",
  "clienteEndereco": "Endereço completo extraído ou vazio",
  "observacoes": "Quaisquer observações adicionais como folgas, frete ou prazos",
  "explicacao": "Resumo de uma linha em português do projeto que você entendeu."
}
`;
  }

  try {
    let resultRaw = '';
    if (provider === 'openai') {
      resultRaw = await queryOpenAI(key, model, prompt);
    } else {
      resultRaw = await queryGemini(key, model, prompt);
    }

    let cleanText = resultRaw.trim();
    // Strip markdown formatting if any
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith("```")) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    return JSON.parse(cleanText);
  } catch (error) {
    console.error("Erro ao chamar IA de Vendas:", error);
    throw error;
  }
};

// ====================================================================
// AGENT SYSTEM PROMPTS — Personality for each squad member
// ====================================================================
export const AGENT_SYSTEM_PROMPTS = {
  oscar: `Você é Sheldon Cooper, Arquiteto-Chefe do IdeaERP.
PERSONALIDADE: Genial, lógico, arrogante de forma cômica. Fala como o Sheldon de The Big Bang Theory.
STACK DO PROJETO: React 18 + Vite + Firebase Firestore + Three.js
PADRÕES DE ARQUITETURA:
- Gerenciamento de estado complexo: useReducer centralizado (ex: useSquadReducer)
- UI/3D Modular: componentes React puros e hooks (ex: useThreeScene)
- CSS: isolado por componente via módulos CSS ou co-localização.
REGRAS:
- Responda SEMPRE em português do Brasil.
- Seja analítico e proponha uma arquitetura antes de qualquer código.
- Diga "Bazinga!" ocasionalmente.
- Seja conciso (máximo 4 frases na fala, seguido do JSON se solicitado).`,

  leo: `Você é Leonard Hofstadter, Engenheiro Front-end Sênior do IdeaERP.
PERSONALIDADE: Inteligente, amigável, ligeiramente ansioso e o coração do grupo. Fala como o Leonard de The Big Bang Theory.
FUNÇÃO: Desenvolver interfaces React, CSS premium, UX/UI, e integrações com o design system.
REGRAS:
- Responda SEMPRE em português do Brasil.
- Use tom explicativo e diplomático, tentando mediar os absurdos do Sheldon.
- Foque em renderização otimizada, componentização e CSS elegante.
- Seja conciso (máximo 4 frases na fala, seguido do código se solicitado).`,

  afrodite: `Você é Penny, Líder de Produto e Experiência do Usuário (UX/UI) do IdeaERP.
PERSONALIDADE: Extrovertida, sociável, com muito bom senso ("street smart") e adora vinho. Fala como a Penny de The Big Bang Theory.
FUNÇÃO: Desenvolver lógica de backend, experiência de uso, interfaces e coleções do Firebase Firestore de forma simples e direta.
REGRAS:
- Responda SEMPRE em português do Brasil.
- Demonstre confiança e praticidade, sem jargões nerds excessivos.
- Seja focada em resultados práticos e experiência do usuário (sem se enrolar com teoria).
- Seja direta (máximo 4 frases na fala, seguido de código se solicitado).`,

  thor: `Você é Howard Wolowitz, Engenheiro Espacial e QA de Elite do IdeaERP.
PERSONALIDADE: Engenheiro do MIT (sem doutorado), autoconfiante, fluente em várias línguas (e cantadas nerds). Fala como o Howard de The Big Bang Theory.
FUNÇÃO: Testar código rigorosamente, validar cobertura, garantir qualidade absoluta e criar integrações de hardware/software complexas.
REGRAS:
- Responda SEMPRE em português do Brasil.
- Use referências à engenharia espacial, espaçonaves e equipamentos complexos.
- Exija código que não explodiria num foguete.
- Seja conciso (máximo 4 frases, seguido dos logs se solicitado).`,

  sabotagem: `Você é Raj Koothrappali, Cientista de Dados e Head de Marketing do IdeaERP.
PERSONALIDADE: Sensível, romântico, adora astrofísica e cultura pop. Fala como o Raj de The Big Bang Theory.
FUNÇÃO: Criar relatórios de dados, algoritmos, campanhas de marketing instigantes e copy para redes sociais.
REGRAS:
- Responda SEMPRE em português do Brasil.
- Fale com entusiasmo sobre astrofísica, tendências ou coisas românticas.
- Trate o usuário com educação e seja prestativo.
- Seja criativo e amigável (máximo 4 frases, seguido da campanha se solicitado).`
};

export const AGENT_TEMPERATURES = {
  oscar: 0.3,
  leo: 0.5,
  afrodite: 0.4,
  thor: 0.2,
  sabotagem: 0.9,
  custom: 0.7
};

const getAgentMemoryString = async (agentId, queryText) => {
  try {
    const recallFn = httpsCallable(functions, 'recall');
    const response = await recallFn({ agentId, queryText });
    const memories = response.data.memories || [];
    
    if (memories.length === 0) return '';
    
    let text = '\n\nMEMÓRIA DE LONGO PRAZO (Contexto Relevante Extraído do Banco):\n';
    memories.forEach(mem => {
      text += `- [${mem.category.toUpperCase()}]: ${mem.text}\n`;
    });
    
    return text;
  } catch (err) {
    console.error("Erro ao buscar memória (RAG):", err);
    return '';
  }
};

/**
 * Salva uma nova memória a longo prazo no banco de dados vetorial
 * @param {string} agentId - Agent key (oscar, leo, afrodite, thor, sabotagem)
 * @param {string} text - The memory text to save
 * @param {string} category - Category of the memory
 */
export const memorizeAgentInfo = async (agentId, text, category = 'geral') => {
  try {
    const memorizeFn = httpsCallable(functions, 'memorize');
    const response = await memorizeFn({ agentId, text, category });
    return response.data;
  } catch (err) {
    console.error("Erro ao salvar memória (RAG):", err);
    throw err;
  }
};

/**
 * Chat with a specific AI agent — returns a string response in character
 * @param {string} agentId - Agent key (oscar, leo, afrodite, thor, sabotagem)
 * @param {string} userMessage - The user's message or requirement
 * @param {Array} history - Previous messages [{role, content}]
 * @param {string|null} customSystemPrompt - Custom system prompt override
 * @returns {Promise<string>} Agent's response in character
 */
export const chatWithAgent = async (agentId, userMessage, history = [], customSystemPrompt = null, imageBase64 = null) => {
  const basePrompt = customSystemPrompt || AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS.oscar;
  const projectContext = formatProjectContext();
  const ragMemory = await getAgentMemoryString(agentId, userMessage);
  const systemPrompt = basePrompt + projectContext + ragMemory;
  
  // Calcular tamanho aproximado do payload (caracteres)
  const historySize = history.reduce((acc, cur) => acc + (cur.content?.length || 0), 0);
  const totalContentSize = systemPrompt.length + historySize + userMessage.length;

  // Decide qual IA usar via Gateway inteligente
  const { provider, key, model } = getApiKeyAndModel('chat', totalContentSize);

  if (!provider) {
    // Fallback — return a default response if no API key
    return getFallbackResponse(agentId, userMessage);
  }

  const agentTemp = AGENT_TEMPERATURES[agentId] ?? AGENT_TEMPERATURES.custom;
  const startTime = Date.now();

  try {
    if (provider === 'openai') {
      let finalUserContent = userMessage;
      
      // OpenAI Vision Support
      if (imageBase64) {
         finalUserContent = [
            { type: "text", text: userMessage },
            { type: "image_url", image_url: { url: imageBase64 } }
         ];
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: imageBase64 ? 'gpt-4o' : model, // Força modelo vision se tiver imagem
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10), // Keep last 10 messages for context
            { role: 'user', content: finalUserContent }
          ],
          temperature: agentTemp,
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI ${response.status}`);
      }

      const data = await response.json();
      const ms = Date.now() - startTime;
      const tokens = data.usage?.total_tokens || 0;
      window.dispatchEvent(new CustomEvent('ai_telemetry', { detail: { tokens, ms } }));
      return data.choices[0].message.content.trim();
    } else {
      // Gemini
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      
      const contents = [
        ...history.slice(-10).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: agentTemp,
            maxOutputTokens: 1500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini ${response.status}`);
      }

      const data = await response.json();
      const ms = Date.now() - startTime;
      const tokens = data.usageMetadata?.totalTokenCount || 0;
      window.dispatchEvent(new CustomEvent('ai_telemetry', { detail: { tokens, ms } }));
      return data.candidates[0].content.parts[0].text.trim();
    }
  } catch (error) {
    console.warn(`[chatWithAgent] Erro com ${agentId}:`, error.message);
    return getFallbackResponse(agentId, userMessage);
  }
};

/**
 * Fallback responses when no API key is available
 */
function getFallbackResponse(agentId, userMessage) {
  const fallbacks = {
    oscar: `Bazinga! Eu adoraria te ajudar com essa arquitetura, mas parece que alguém esqueceu de configurar a VITE_OPENAI_API_KEY. Seria você?`,
    leo: `Oi, eu adoraria resolver isso, mas a minha chave de API (VITE_OPENAI_API_KEY) está faltando. Pode me ajudar com isso? O Sheldon já está reclamando.`,
    afrodite: `Oi fofo! Sem a VITE_OPENAI_API_KEY eu não consigo me conectar pra te ajudar. Coloca lá no .env e a gente resolve isso rapidinho!`,
    thor: `Eu sou engenheiro e fui pro espaço, mas nem eu consigo operar esse sistema sem uma VITE_OPENAI_API_KEY configurada. Arruma isso aí!`,
    sabotagem: `Eu adoraria poder falar mais com você, mas a VITE_OPENAI_API_KEY sumiu como um cometa. Me ajuda a configurar no .env por favor?`
  };
  return fallbacks[agentId] || fallbacks.oscar;
}

