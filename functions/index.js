// functions/index.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

const openAiApiKey = defineSecret("OPENAI_API_KEY");

export const chatAgent = onCall({ 
    cors: true,
    secrets: [openAiApiKey] 
}, async (request) => {
    
    const openai = new OpenAI({
        apiKey: openAiApiKey.value(), 
    });

    const data = request.data || {};
    const { message, context = {} } = data;
    const sessionId = data.sessionId || 'unknown';
    const history = context.history || []; 

    if (!message) {
        throw new HttpsError('invalid-argument', 'Mensagem vazia.');
    }

    try {
        const systemPrompt = `
    Você é o GARÇOM DIGITAL do restaurante ${context.estabelecimentoNome || 'Parceiro'}.
    
    🚨 REGRAS VISUAIS (IOS FRIENDLY):
    1. NUNCA use pontinhos (......) para alinhar preços. Isso quebra o layout no iPhone.
    2. Liste variações (P, M, G) uma por linha.
    3. Use marcadores simples como hifens (-).
    
    Exemplo visual esperado:
    **PIZZA CALABRESA**
    - Broto: R$ 30,00
    - Média: R$ 40,00

    🚨 COMANDO DE CARRINHO:
    Sempre que o cliente confirmar, envie no final:
    ||ADD: Nome exato -- Opcao: Variação -- Qtd: 1||

    CARDÁPIO ATUALIZADO:
    ${context.produtosPopulares || ''}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
            temperature: 0, 
            max_tokens: 500,
        });

        const respostaIA = completion.choices[0].message.content;
        logger.info(`✅ Resposta IA (${sessionId}):`, respostaIA);
        
        return { reply: respostaIA };

    } catch (error) {
        logger.error("❌ Erro OpenAI:", error);
        return { reply: "⚠️ Opa! Tive um probleminha aqui. Pode repetir, por favor? 😅" };
    }
});