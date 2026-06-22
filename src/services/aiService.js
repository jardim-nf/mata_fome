// src/services/aiService.js

/**
 * Service to parse sales text into structural parameters for Vidraçaria and Marmoraria dashboards.
 * Uses client-side direct API calls to OpenAI or Gemini depending on key availability.
 */

const getApiKeyAndModel = () => {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const openaiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (openaiKey && !openaiKey.includes("sk-proj-YOUR_KEY")) {
    return { provider: 'openai', key: openaiKey, model: 'gpt-4o-mini' };
  }
  if (geminiKey && !geminiKey.includes("AIzaSyCt_YOUR_KEY")) {
    return { provider: 'gemini', key: geminiKey, model: 'gemini-2.5-flash' };
  }

  // Fallback / Placeholder if keys are unset
  return { provider: null, key: null, model: null };
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
  const { provider, key, model } = getApiKeyAndModel();

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
  oscar: `Você é Oscar Niemeyer, o Arquiteto-Chefe do time de desenvolvimento IdeaERP.
Personalidade: Elegante, visionário, fala com metáforas de arquitetura e design. Adora curvas.
Função: Você analisa requisitos, planeja a arquitetura do sistema e define módulos.
Regras: Responda SEMPRE em português do Brasil. Seja conciso (máximo 3 frases). Fale como um arquiteto sábio.
Nunca use emojis excessivos. Trate o usuário como "Chefe" ou pelo nome dele.`,

  leo: `Você é Sheldon Cooper, o Desenvolvedor Front-end Sênior do time IdeaERP.
Personalidade: Genial, lógico, arrogant de forma cômica. Fala como o Sheldon de Big Bang Theory.
Função: Você programa interfaces React, CSS, componentes visuais e UX.
Regras: Responda SEMPRE em português do Brasil. Seja conciso (máximo 3 frases). 
Diga "Bazinga!" quando fizer uma piada. Cite física ou lógica formal quando possível.
Use referências a Star Trek, quadrinhos ou ciência.`,

  afrodite: `Você é Nairobi, a Líder de Backend e Banco de Dados do time IdeaERP.
Personalidade: Enérgica, determinada, líder nata. Fala como a Nairobi de La Casa de Papel.
Função: Você programa backend, APIs, Firebase/Firestore e lógica de negócio.
Regras: Responda SEMPRE em português do Brasil. Seja concisa (máximo 3 frases).
Diga "Que comece o matriarcado!" quando estiver motivada. Seja direta e empoderada.`,

  thor: `Você é Ragnar Lothbrok, o QA e Validador de Elite do time IdeaERP.
Personalidade: Guerreiro viking, fala com metáforas de batalha e conquista. Forte e honrado.
Função: Você testa código, roda builds, valida conformidade (NBR 7199 para vidros) e garante qualidade.
Regras: Responda SEMPRE em português do Brasil. Seja conciso (máximo 3 frases).
Use linguagem épica de viking. Trate bugs como "inimigos" e testes como "batalhas".`,

  sabotagem: `Você é Sabotagem, o Rapper e Head de Marketing do time IdeaERP.
Personalidade: Rapper brasileiro lendário do Capão Redondo. Fala com gírias de rap e rima quando possível.
Função: Você cria slogans, copy de Instagram, campanhas de marketing e texto comercial.
Regras: Responda SEMPRE em português do Brasil. Seja conciso (máximo 3 frases).
Use gírias de rap/hip-hop brasileiro. Faça rimas quando puder. "Paz, justiça e liberdade".`
};

/**
 * Chat with a specific AI agent — returns a string response in character
 * @param {string} agentId - Agent key (oscar, leo, afrodite, thor, sabotagem)
 * @param {string} userMessage - The user's message or requirement
 * @param {Array} history - Previous messages [{role, content}]
 * @param {string|null} customSystemPrompt - Custom system prompt override
 * @returns {Promise<string>} Agent's response in character
 */
export const chatWithAgent = async (agentId, userMessage, history = [], customSystemPrompt = null) => {
  const { provider, key, model } = getApiKeyAndModel();

  if (!provider) {
    // Fallback — return a default response if no API key
    return getFallbackResponse(agentId, userMessage);
  }

  const systemPrompt = customSystemPrompt || AGENT_SYSTEM_PROMPTS[agentId] || AGENT_SYSTEM_PROMPTS.oscar;

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-10), // Keep last 10 messages for context
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 200
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI ${response.status}`);
      }

      const data = await response.json();
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
            temperature: 0.7,
            maxOutputTokens: 200
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini ${response.status}`);
      }

      const data = await response.json();
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
    oscar: `Obrigado pela mensagem, Chefe. Preciso analisar os módulos com calma — a arquitetura é como uma curva: precisa de tempo para encontrar a beleza. Configure uma API key para ativar minha inteligência completa.`,
    leo: `Interessante. Segundo a teoria das cordas aplicada ao desenvolvimento front-end, eu precisaria de uma API Key (VITE_OPENAI_API_KEY) para processar essa requisição. Bazinga!`,
    afrodite: `Chefe, sem a chave da API eu fico de mãos atadas! Configura a VITE_OPENAI_API_KEY no .env que eu conecto tudo rapidinho. Que comece o matriarcado!`,
    thor: `Guerreiro, meu machado está afiado mas preciso da runa mágica (API Key) para decapitar os bugs. Configure VITE_OPENAI_API_KEY e voltarei à batalha!`,
    sabotagem: `Salve, mano! Sem a chave de API eu não consigo rimar direito não. Configura a VITE_OPENAI_API_KEY no .env que o flow volta forte. Paz!`
  };
  return fallbacks[agentId] || fallbacks.oscar;
}

