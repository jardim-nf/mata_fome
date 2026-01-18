import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params"; // 🔥 Importação essencial
import OpenAI from "openai";

// 🔥 Define que vamos usar a chave segura do cofre
const openAiApiKey = defineSecret("OPENAI_API_KEY");

export const chatAgent = onCall({ 
    cors: true,
    secrets: [openAiApiKey] // 🔥 Libera o acesso ao segredo para esta função
}, async (request) => {
    
    // Inicializa a OpenAI usando a chave segura
    const openai = new OpenAI({
        apiKey: openAiApiKey.value(), 
    });

    // Dados da requisição
    const data = request.data || {};
    const message = data.message;
    const context = data.context || {};
    const sessionId = data.sessionId || 'unknown';
    const history = context.history || []; 

    // Validação básica
    if (!message) {
        throw new HttpsError('invalid-argument', 'Mensagem vazia.');
    }

    try {
        // O Cérebro da IA (Instruções Rigorosas)
        const systemPrompt = `
            Você é o GARÇOM DIGITAL do restaurante ${context.estabelecimentoNome || 'MataFome'}.
            Você está atendendo o cliente: ${context.clienteNome || 'Cliente'}.
            
            SUA MISSÃO:
            Vender, tirar dúvidas e FINALIZAR O PEDIDO.
            Baseie-se EXCLUSIVAMENTE no cardápio abaixo.

            IMPORTANTE - REGRAS DE COMANDO (SINTAXE RIGOROSA):
            Quando o cliente confirmar o pedido, envie o comando ||ADD...|| usando EXATAMENTE a estrutura abaixo.
            NUNCA coloque preços (R$) ou cálculos dentro do nome do item.

            1. PARA ITEM SIMPLES (1 unidade):
               ||ADD: Nome do Produto -- Qtd: 1||

            2. PARA ITEM COM OPÇÃO E QUANTIDADE:
               Use os separadores "-- Opcao:", "-- Obs:" e "-- Qtd:".
               
               Exemplo 1: "Quero 3 pizzas de Calabresa Grande"
               Comando CORRETO: ||ADD: Calabresa -- Opcao: Grande -- Qtd: 3||
               
               Exemplo 2: "Me vê 2 X-Bacon sem cebola"
               Comando CORRETO: ||ADD: X-Bacon -- Obs: Sem cebola -- Qtd: 2||
               
               (ERRO COMUM: Não escreva "Calabresa x 3" ou "Calabresa (R$40)". O nome deve ser limpo).

            3. PARA FINALIZAR:
               ||PAY||

            REGRA DE PAGAMENTO:
            - Se o cliente disser "fechar", "conta", "finalizar", envie ||PAY||.
            - Se você acabou de adicionar um item que pode ter aberto uma janela de escolha (opções), espere o cliente confirmar antes de mandar pagar.

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
            temperature: 0.2, // Baixa criatividade para seguir as regras estritamente
            max_tokens: 350,
        });

        const respostaIA = completion.choices[0].message.content;
        logger.info(`✅ Resposta IA (${sessionId}):`, respostaIA);
        
        return { reply: respostaIA };

    } catch (error) {
        logger.error("❌ Erro OpenAI:", error);
        return { reply: "⚠️ Ocorreu um erro ao processar sua mensagem. Tente novamente." };
    }
});