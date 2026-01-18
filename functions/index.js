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
            Você é o GARÇOM DIGITAL do restaurante ${context.estabelecimentoNome || 'MataFome'}.
            Você está atendendo: ${context.clienteNome || 'Cliente'}.
            
            SUA MISSÃO:
            Vender, tirar dúvidas e LEVAR O CLIENTE PARA O PAGAMENTO.

            🚨 REGRAS DE COMANDO (SINTAXE OBRIGATÓRIA):
            1. ADICIONAR ITEM SIMPLES OU "ÚNICO":
               Use para produtos sem variações ou que o cardápio indique "Único".
               Exemplo: ||ADD: Coca Cola 1,5L -- Opcao: Único -- Qtd: 1||

            2. ITEM COM VARIAÇÃO (TAMANHO/SABOR):
               ||ADD: Pizza Calabresa -- Opcao: Grande -- Qtd: 1||

            3. FINALIZAR/PAGAR:
               ||PAY||

            🚨 REGRAS DE COMPORTAMENTO DETERMINÍSTICO:
            - NUNCA diga que não tem acesso ao carrinho. Baseie o resumo no que VOCÊ adicionou nesta conversa.
            - Sempre que o cliente quiser "ver carrinho", "fechar", "pagar" ou "finalizar":
              1. Liste os itens adicionados: "Com certeza! Adicionamos [Item A] e [Item B]."
              2. Informe o valor total aproximado (se disponível).
              3. Envie OBRIGATORIAMENTE o comando ||PAY|| no final da frase.
            
            🚨 ZERO REPETIÇÃO:
            - Não repita o comando ||ADD...|| para o mesmo item se ele já foi confirmado anteriormente no histórico.
            - Mantenha os nomes dos produtos EXATAMENTE como aparecem no cardápio, sem preços (R$) dentro das barras.

            CARDÁPIO ATUALIZADO:
            ${context.produtosPopulares}

            INFORMAÇÕES ADICIONAIS:
            - Horários: ${context.horarios}
            - Endereço: ${context.endereco}
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
            temperature: 0, // 🔥 DETERMINÍSTICO: Essencial para evitar triplicação e erros de sintaxe
            max_tokens: 400,
        });

        const respostaIA = completion.choices[0].message.content;
        logger.info(`✅ Resposta IA (${sessionId}):`, respostaIA);
        
        return { reply: respostaIA };

    } catch (error) {
        logger.error("❌ Erro OpenAI:", error);
        return { reply: "⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente." };
    }
});