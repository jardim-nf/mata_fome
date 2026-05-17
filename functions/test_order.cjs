const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function run() {
    try {
        const orderId = 'AI2af4Ih49tyIrrPvLH2';
        let docRef = db.collection('pedidos').doc(orderId);
        let docSnap = await docRef.get();
        if (!docSnap.exists) {
            console.log('Not in global pedidos. Trying estabelecimento...');
            const estabId = '2eNNjBwmDHUyLlYVnMSH'; // from the URL
            docRef = db.collection('estabelecimentos').doc(estabId).collection('pedidos').doc(orderId);
            docSnap = await docRef.get();
        }
        
        if (docSnap.exists) {
            const data = docSnap.data();
            console.log("=== PEDIDO ENCONTRADO ===");
            console.log("Itens do pedido:");
            console.log(JSON.stringify(data.itens || data.carrinho || data.produtos, null, 2));
        } else {
            console.log('Pedido não encontrado!');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

run();
