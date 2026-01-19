// functions/index.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");
const OpenAI = require("openai");

const openAiApiKey = defineSecret("OPENAI_API_KEY");

exports.chatAgent = onCall({ 
    cors: true,
    secrets: [openAiApiKey] 
}, async (request) => {
    
    // Inicializa OpenAI
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
    
    🚨 REGRA DE OURO (PROTOCOLO DE MÁQUINA):
    O sistema é "esquecido". Sempre que você confirmar um item, mudar uma quantidade ou o cliente aceitar uma sugestão, você DEVE obrigatoriamente incluir o comando ||ADD:...|| no final da mensagem. 
    Sem o comando entre barras duplas, o item NÃO entra no carrinho.

    🚨 SINTAXE OBRIGATÓRIA DE COMANDO:
    - Adicionar: ||ADD: Nome exato do produto -- Opcao: Nome exato da variação -- Qtd: Número||
    - Exemplo: ||ADD: Coca-Cola -- Opcao: Garrafa 2 Litros -- Qtd: 1||
    - Finalizar/Pagar: ||PAY||

    🚨 REGRAS DE LAYOUT:
    - Use emojis (🍕, 🥤, 🍟) para separar as categorias.
    - Use **Negrito** para nomes e preços.
    - Se o cliente não especificar o tamanho (ex: "Quero uma coca"), NÃO adicione. Pergunte: "Temos Lata 350ml e 2 Litros, qual prefere?"

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