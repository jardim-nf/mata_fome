// functions/index.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";

export const chatAgent = onCall({ cors: true }, async (request) => {
    
    // 👇 COLE SUA CHAVE 'sk-...' AQUI DENTRO
    const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY, // COLE SUA CHAVE AQUI
    });

    // Segurança para dados opcionais
    const data = request.data || {};
    const message = data.message;
    const context = data.context || {};
    const sessionId = data.sessionId || 'unknown';
    const history = context.history || []; 

    if (!message) {
        throw new HttpsError('invalid-argument', 'Mensagem vazia.');
    }

    try {
        const systemPrompt = `
            Você é o GARÇOM DIGITAL do restaurante ${context.estabelecimentoNome || 'MataFome'}.
            Você está atendendo o cliente: ${context.clienteNome || 'Cliente'}.
            
            SUA MISSÃO:
            Vender, tirar dúvidas e FINALIZAR O PEDIDO.
            Baseie-se EXCLUSIVAMENTE no cardápio abaixo.

            PERSONALIDADE:
            - Chame o cliente pelo nome (${context.clienteNome}) sempre que possível.
            - Seja ágil, educado e vendedor.

            COMANDOS TÉCNICOS:
            1. ||ADD: Nome do Produto|| -> Para adicionar itens (se o cliente confirmar).
            2. ||PAY|| -> Para abrir a tela de pagamento.

            🚨 REGRA SUPREMA DE PAGAMENTO:
            - Se o cliente disser "pagar", "fechar", "finalizar", "conta", envie a tag ||PAY|| IMEDIATAMENTE.
            - NÃO pergunte quais itens ele quer nessa hora. Assuma que ele já adicionou.

            REGRA ANTI-ALUCINAÇÃO:
            - Não invente itens fora do cardápio.

            DADOS:
            - Horários: ${context.horarios}
            - Endereço: ${context.endereco}
            
            CARDÁPIO:
            ${context.produtosPopulares}
        `;

        const messagesToSend = [
            { role: "system", content: systemPrompt },
            ...history, 
            { role: "user", content: message }
        ];

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messagesToSend,
            temperature: 0.3,
            max_tokens: 350,
        });

        const respostaIA = completion.choices[0].message.content;

        logger.info(`✅ Resposta IA (${sessionId}):`, respostaIA);

        return { reply: respostaIA };

    } catch (error) {
        logger.error("❌ Erro OpenAI:", error);
        return { reply: "⚠️ Ocorreu um erro ao processar sua mensagem." };
    }
});