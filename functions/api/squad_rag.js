import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { db } from "../firebaseCore.js";
import { FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";

const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Memorize: Salva uma nova memória com VectorValue
export const memorize = onCall({
    cors: true,
    secrets: [openaiApiKey],
    timeoutSeconds: 30
}, async (request) => {
    const { agentId, text, category = 'geral' } = request.data;
    const uid = request.auth?.uid;

    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    if (!agentId || !text) throw new HttpsError('invalid-argument', 'agentId e text são obrigatórios.');

    try {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        
        // Gera o embedding (vetor) da frase
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
        });

        const vector = embeddingResponse.data[0].embedding;

        // Salva no Firestore usando FieldValue.vector (exige firebase-admin 12+)
        await db.collection('squad_memories').add({
            agentId,
            text,
            category,
            embedding: FieldValue.vector(vector),
            timestamp: FieldValue.serverTimestamp(),
            uid // Armazenamos o criador caso tenhamos múltiplos usuários/projetos no futuro
        });

        return { success: true, message: 'Memória salva com sucesso!' };
    } catch (error) {
        console.error("Erro no memorize:", error);
        throw new HttpsError('internal', 'Falha ao salvar memória no banco de dados vetorial.');
    }
});

// Recall: Busca semântica nas memórias antigas
export const recall = onCall({
    cors: true,
    secrets: [openaiApiKey],
    timeoutSeconds: 30
}, async (request) => {
    const { agentId, queryText } = request.data;
    const uid = request.auth?.uid;

    if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    if (!agentId || !queryText) return { memories: [] };

    try {
        const openai = new OpenAI({ apiKey: openaiApiKey.value() });
        
        // Converte a pergunta do usuário para um vetor
        const embeddingResponse = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: queryText,
        });

        const queryVector = embeddingResponse.data[0].embedding;

        // Firestore Vector Search: findNearest
        // Precisará de um índice composto no GCP: agentId (ASC) + embedding (VECTOR)
        const coll = db.collection('squad_memories');
        const vectorQuery = coll
            .where('agentId', '==', agentId)
            .findNearest('embedding', FieldValue.vector(queryVector), {
                limit: 5,
                distanceMeasure: 'COSINE'
            });

        const snapshot = await vectorQuery.get();
        
        const memories = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            memories.push({
                text: data.text,
                category: data.category
            });
        });

        return { memories };
    } catch (error) {
        console.error("Erro no recall:", error);
        // Se der erro (ex: Missing Index), não quebramos a conversa, apenas retornamos vazio ou logamos
        if (error.message && error.message.includes('FAILED_PRECONDITION')) {
            console.error("AVISO: Falta índice vetorial. Siga o link gerado no log do Firebase para criar.");
        }
        return { memories: [] };
    }
});
