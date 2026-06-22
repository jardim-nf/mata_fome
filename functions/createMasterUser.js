import * as admin from 'firebase-admin';
import { db } from './firebaseCore.js';

export const createMasterUser = async (email, password) => {
    try {
        // Verify if the user already exists
        let userRecord;
        try {
            userRecord = await admin.auth().getUserByEmail(email);
            // If found, update the password
            await admin.auth().updateUser(userRecord.uid, { password });
            console.info(`Updated password for existing user: ${email}`);
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
            // If not found, create the user
            userRecord = await admin.auth().createUser({
                email,
                password,
                displayName: 'Master User'
            });
            console.info(`Created new master user: ${email}`);
        }
        
        // Set custom claims
        await admin.auth().setCustomUserClaims(userRecord.uid, {
            isMasterAdmin: true,
            role: 'master'
        });

        // Add user info to Firestore
        await db.collection('usuarios').doc(userRecord.uid).set({
            email,
            nome: 'Master User',
            isAdmin: true,
            isMasterAdmin: true,
            ativo: true,
            criadoEm: admin.firestore.FieldValue.serverTimestamp(),
            estabelecimentosGerenciados: []
        }, { merge: true });

        return {
            success: true,
            uid: userRecord.uid,
            message: 'Master user created or updated successfully.'
        };

    } catch (error) {
        console.error('Error creating/updating master user:', error);
        return {
            success: false,
            message: error.message
        };
    }
};
