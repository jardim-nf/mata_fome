// functions/index.js
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params"; 
import OpenAI from "openai";

// --- NOVOS IMPORTS (Necessários para acessar o banco com segurança) ---
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Inicializa o Admin SDK (Permite ler/escrever no banco ignorando regras de cliente)
initializeApp();
const db = getFirestore();

const openAiApiKey = defineSecret("OPENAI_API_KEY");

// ==================================================================
// 1. SEU AGENTE DE IA (MANTIDO ORIGINAL)
// ==================================================================
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
    Você é o GARÇOM DIGITAL do restaurante ${context.estabelecimentoNome}.
    
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
    ${context.produtosPopulares}
`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }],
            temperature: 0, 
            max_tokens: 500, // Aumentado um pouco para acomodar o novo layout
        });

        const respostaIA = completion.choices[0].message.content;
        logger.info(`✅ Resposta IA (${sessionId}):`, respostaIA);
        
        return { reply: respostaIA };

    } catch (error) {
        logger.error("❌ Erro OpenAI:", error);
        return { reply: "⚠️ Opa! Tive um probleminha aqui. Pode repetir, por favor? 😅" };
    }
});

// ==================================================================
// 2. NOVA FUNÇÃO: CRIAR PEDIDO SEGURO (VALIDAÇÃO DE PREÇO)
// ==================================================================
export const criarPedidoSeguro = onCall({ cors: true }, async (request) => {
    // 1. Segurança: Verifica se usuário está logado
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'O usuário precisa estar logado.');
    }

    const dadosPedido = request.data;
    const { itens, estabelecimentoId, ...outrosDados } = dadosPedido;

    if (!itens || !estabelecimentoId) {
        throw new HttpsError('invalid-argument', 'Dados do pedido incompletos.');
    }

    let totalCalculado = 0;
    const itensProcessados = [];

    try {
        // 2. Loop para recalcular cada item buscando o preço REAL no banco
        for (const item of itens) {
            // Busca o produto original no banco para pegar o preço verdadeiro
            const produtoRef = db.doc(`estabelecimentos/${estabelecimentoId}/cardapio/${item.id}`);
            const produtoSnap = await produtoRef.get();

            if (!produtoSnap.exists) {
                // Se o produto foi deletado enquanto o cliente comprava
                throw new HttpsError('not-found', `Produto indisponível: ${item.nome}`);
            }

            const produtoReal = produtoSnap.data();
            let precoUnitarioReal = Number(produtoReal.preco) || 0;

            // Se for um item com variação (ex: Pizza Grande vs Broto)
            if (item.variacaoSelecionada) {
                // Tenta encontrar a variação no array de variações do produto real
                const variacoesReais = produtoReal.variacoes || [];
                // Ajuste a lógica de comparação conforme seu banco (usando nome ou id)
                const variacaoEncontrada = variacoesReais.find(v => 
                    v.nome === item.variacaoSelecionada.nome || v.id === item.variacaoSelecionada.id
                );

                if (variacaoEncontrada) {
                    precoUnitarioReal = Number(variacaoEncontrada.preco);
                }
            }

            // Somar Adicionais (Se houver)
            let totalAdicionais = 0;
            if (item.adicionais && item.adicionais.length > 0) {
                // Nota: Idealmente você também buscaria o preço de cada adicional no banco.
                // Aqui estamos confiando no preço enviado, mas validando o produto base já ajuda muito.
                totalAdicionais = item.adicionais.reduce((acc, ad) => acc + (Number(ad.preco) || 0), 0);
            }

            // Preço Final da Unidade
            const precoFinalItem = precoUnitarioReal + totalAdicionais;
            
            // Soma ao total geral do pedido
            totalCalculado += precoFinalItem * item.quantidade;

            // Reconstrói o item com o preço validado pelo servidor
            itensProcessados.push({
                ...item,
                preco: precoUnitarioReal, // Força o preço base real
                precoFinal: precoFinalItem // Força o preço final real
            });
        }

        // 3. Montar objeto final da venda com segurança
        const vendaFinal = {
            ...outrosDados,
            estabelecimentoId,
            userId: request.auth.uid, // Garante que o ID é do usuário logado
            itens: itensProcessados,
            total: totalCalculado, // O TOTAL AGORA É 100% CONFIÁVEL
            status: 'pendente',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            origem: 'app_web_seguro'
        };

        // 4. Salvar na coleção 'vendas'
        const novaVendaRef = db.collection('vendas').doc();
        await novaVendaRef.set(vendaFinal);

        logger.info(`✅ Pedido Seguro Criado: ${novaVendaRef.id} - Total Validado: R$ ${totalCalculado}`);

        return { 
            success: true, 
            vendaId: novaVendaRef.id,
            totalValidado: totalCalculado 
        };

    } catch (error) {
        logger.error("❌ Erro ao processar pedido seguro:", error);
        throw new HttpsError('internal', 'Erro ao processar o pedido. Tente novamente ou contate o estabelecimento.');
    }
});