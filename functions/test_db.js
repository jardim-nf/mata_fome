import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase-admin/app';

initializeApp();
const db = getFirestore();

async function check() {
    const estabs = await db.collection('estabelecimentos').get();
    for (const estab of estabs.docs) {
        const pedidos = await db.collection(`estabelecimentos/${estab.id}/pedidos`).where('id', '==', 'INIP5A').get();
        for (const doc of pedidos.docs) {
            console.log("Found in estab:", estab.id);
            const data = doc.data();
            console.log("createdAt:", data.createdAt);
            console.log("dataEnvio:", data.fiscal?.dataEnvio);
            return;
        }
        
        const docSnap = await db.collection(`estabelecimentos/${estab.id}/pedidos`).doc('INIP5A').get();
        if (docSnap.exists) {
            console.log("Found as Doc ID in estab:", estab.id);
            const data = docSnap.data();
            console.log("createdAt:", data.createdAt);
            console.log("dataEnvio:", data.fiscal?.dataEnvio);
            return;
        }
    }
}
check().catch(console.error);
