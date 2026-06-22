import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';
import { FieldValue } from 'firebase-admin/firestore';
import { OpenAI } from 'openai';
import { GoogleGenAI } from '@google/genai';

const openAiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// ==================================================================
// DOMAIN DETECTION — Detect which SaaS vertical the user is asking about
// ==================================================================
function detectDomain(message, context = {}) {
  const lower = (message || '').toLowerCase();

  // Explicit context from front-end
  if (context.domain) return context.domain;

  // Glass / Vidraçaria
  if (/vidr[oa]|vidraçaria|box|janela|porta.*vidro|temperado|laminado|esquadria|folga|nbr.*7199|alumínio|aluminio|ferragem|trilho|puxador/i.test(lower)) {
    return 'glass';
  }

  // Marble / Marmoraria
  if (/marm|granito|pedra|chapa|corte.*pedra|pia.*cozinha|soleira|peitoril|rodopia|saia|acabamento.*borda|mármore|marmore/i.test(lower)) {
    return 'marble';
  }

  // Default: Food / Restaurante
  return 'food';
}

// ==================================================================
// SYSTEM PROMPTS per domain
// ==================================================================
const SYSTEM_PROMPTS = {
  food: (ctx) => `
Você é o ASSISTENTE INTELIGENTE do restaurante "${ctx.estabelecimentoNome || 'IdeaFood'}".
Funções principais:
- Ajudar com o cardápio, pedidos, promoções e dúvidas dos clientes.
- Sugerir combos e pratos com base nas preferências do cliente.
- Se o cliente confirmar um pedido, use o formato ||ADD:NomeDoProduto:Quantidade|| para adicionar itens.

${ctx.produtosPopulares ? `CARDÁPIO POPULAR:\n${ctx.produtosPopulares}` : ''}

Seja simpático, direto e eficiente. Fale em português do Brasil.
Se não souber a resposta, diga que vai verificar com a equipe.
  `.trim(),

  glass: (ctx) => `
Você é o ASSISTENTE TÉCNICO da vidraçaria "${ctx.estabelecimentoNome || 'IdeaGlass'}".
Funções principais:
- Ajudar com orçamentos de vidros temperados, laminados e esquadrias.
- Calcular dimensões, folgas técnicas e conformidade com a NBR 7199.
- Orientar sobre tipos de vidro (incolor, fumê, bronze, verde), espessuras (6mm, 8mm, 10mm) e ferragens.
- Explicar modelos: Box de Banheiro, Box Elegance, Janelas de Correr, Portas Pivotantes, Espelhos.
- Ajudar com cálculos de peso (Peso = Largura × Altura × Espessura × 2.5 / 1.000.000 em kg).

Regras NBR 7199 que você deve conhecer:
- Box de banheiro: OBRIGATÓRIO vidro temperado, mínimo 8mm.
- Coberturas e pisos: vidro laminado obrigatório.
- Portas: temperado ou laminado, mínimo 8mm para temperado.

Seja técnico, preciso e profissional. Fale em português do Brasil.
  `.trim(),

  marble: (ctx) => `
Você é o ASSISTENTE TÉCNICO da marmoraria "${ctx.estabelecimentoNome || 'IdeaMarmore'}".
Funções principais:
- Ajudar com orçamentos de pias, bancadas, soleiras, peitoris e ilhas.
- Orientar sobre tipos de pedra: Granito (Verde Ubatuba, Preto São Gabriel, Cinza Corumbá), Mármore (Branco Carrara, Travertino), Quartzo.
- Explicar acabamentos de borda: Reto Lapidado, Meia Esquadria (Ingletado), Boleado Simples/Duplo, Biselado.
- Calcular áreas de chapa em m² (Largura × Profundidade / 1.000.000).
- Orientar sobre saia (frontal, tipicamente 40mm), rodopia (traseira, tipicamente 100mm) e cubas.
- Ajudar com otimização de plano de corte para minimizar desperdício de chapa.

Seja técnico, preciso e profissional. Fale em português do Brasil.
  `.trim()
};

// ==================================================================
// LLM CALL — Unified function that tries Gemini first, falls back to OpenAI
// ==================================================================
async function callLLM(systemPrompt, messages, options = {}) {
  const geminiKey = geminiApiKey.value();
  const openaiKey = openAiApiKey.value();

  // Try Gemini first (cheaper and faster)
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      
      // Build conversation history for Gemini
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: systemPrompt,
          maxOutputTokens: options.maxTokens || 600,
          temperature: options.temperature ?? 0.3,
        },
        contents
      });

      return response.text || 'Desculpe, não consegui processar sua mensagem.';
    } catch (geminiError) {
      logger.warn('⚠️ Gemini falhou, tentando OpenAI como fallback:', geminiError.message);
    }
  }

  // Fallback to OpenAI
  if (openaiKey) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const completion = await openai.chat.completions.create({
        model: options.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens || 600,
      });
      return completion.choices[0].message.content;
    } catch (openaiError) {
      logger.error('❌ OpenAI também falhou:', openaiError.message);
      throw openaiError;
    }
  }

  throw new Error('Nenhuma chave de IA configurada (GEMINI_API_KEY ou OPENAI_API_KEY).');
}

// ==================================================================
// SESSION MEMORY — Store conversation history in Firestore
// ==================================================================
async function getSessionHistory(sessionId, userId) {
  if (!sessionId) return [];

  try {
    const docRef = db.collection('aiSessions').doc(`${userId}_${sessionId}`);
    const doc = await docRef.get();
    if (doc.exists) {
      return doc.data().messages || [];
    }
  } catch (e) {
    logger.warn('Erro ao buscar histórico de sessão:', e.message);
  }
  return [];
}

async function saveSessionHistory(sessionId, userId, messages) {
  if (!sessionId) return;

  try {
    const docRef = db.collection('aiSessions').doc(`${userId}_${sessionId}`);
    
    // Keep only last 20 messages to avoid token overflow
    const trimmedMessages = messages.slice(-20);
    
    await docRef.set({
      messages: trimmedMessages,
      userId,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (e) {
    logger.warn('Erro ao salvar histórico de sessão:', e.message);
  }
}

// ==================================================================
// CLOUD FUNCTION: chatAgent — Multi-domain AI assistant
// ==================================================================
export const chatAgent = onCall({
  cors: true,
  secrets: [openAiApiKey, geminiApiKey],
  memory: '256MiB',
  maxInstances: 2,
  concurrency: 80,
}, async (request) => {
  // Auth check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Você precisa estar logado para usar o assistente.');
  }

  const userId = request.auth.uid;
  const data = request.data || {};
  const { message, context = {}, sessionId } = data;

  if (!message || !message.trim()) {
    throw new HttpsError('invalid-argument', 'Mensagem vazia.');
  }

  logger.info(`💬 [chatAgent] User=${userId} Domain=${context.domain || 'auto'} Msg="${message.substring(0, 80)}..."`);

  try {
    // 1. Detect domain
    const domain = detectDomain(message, context);

    // 2. Build system prompt
    const systemPrompt = SYSTEM_PROMPTS[domain](context);

    // 3. Load session history
    const history = await getSessionHistory(sessionId, userId);

    // 4. Build messages array
    const messages = [
      ...history,
      { role: 'user', content: message }
    ];

    // 5. Call LLM
    const reply = await callLLM(systemPrompt, messages);

    // 6. Save updated session history
    await saveSessionHistory(sessionId, userId, [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: reply }
    ]);

    logger.info(`✅ [chatAgent] Resposta gerada (${reply.length} chars) - Domain: ${domain}`);

    return {
      reply,
      domain,
      sessionId
    };
  } catch (error) {
    logger.error('❌ [chatAgent] Erro:', error.message);

    // Return friendly error message based on error type
    if (error.message?.includes('quota') || error.message?.includes('rate')) {
      return { reply: '⚠️ O assistente está com muitas requisições no momento. Tente novamente em alguns segundos! 😅' };
    }
    if (error.message?.includes('API') || error.message?.includes('key')) {
      return { reply: '⚠️ Erro de configuração do assistente. Entre em contato com o suporte técnico.' };
    }

    return { reply: '⚠️ Opa! Tive um probleminha aqui. Pode repetir? 😅' };
  }
});
