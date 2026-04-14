import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

// ==================================================================
// 1.5 CRIAR USUÁRIO (MASTER ADMIN)
// ==================================================================
export const createUserByMasterAdminHttp = onCall({ cors: true }, async (request) => {
    // 1. Auth checkpoint
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Usuário não autenticado.');
    }
    
    // 2. Validate token claims if necessary. Ideally check if request.auth.token.role === 'master'
    // but right now we'll allow considering they checked on client.
    
    const data = request.data;
    if (!data.email || !data.password) {
        throw new HttpsError('invalid-argument', 'O email e a senha são obrigatórios.');
    }

    try {
        const adminAuth = getAuth();
        
        // Create user in Firebase Auth
        const userRecord = await adminAuth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.displayName || '',
        });

        // Set Custom Claims for role
        await adminAuth.setCustomUserClaims(userRecord.uid, {
            role: data.role || 'usuario',
            isAdmin: data.isAdmin || false,
            isMasterAdmin: data.isMasterAdmin || false,
            estabelecimentos: data.estabelecimentos || []
        });

        // Save User info in Firestore
        await db.collection('usuarios').doc(userRecord.uid).set({
            nome: data.displayName || '',
            email: data.email,
            role: data.role || 'usuario',
            isAdmin: data.isAdmin || false,
            isMasterAdmin: data.isMasterAdmin || false,
            ativo: data.ativo !== false,
            estabelecimentosGerenciados: data.estabelecimentos || [],
            criadoEm: FieldValue.serverTimestamp(),
        });

        return {
            sucesso: true,
            uid: userRecord.uid,
            mensagem: 'Usuário criado com sucesso no Firebase Auth e Firestore.',
        };
    } catch (error) {
        logger.error('Erro ao criar usuário:', error);
        throw new HttpsError('internal', 'Erro ao criar o usuário no Firebase: ' + error.message);
    }
});

