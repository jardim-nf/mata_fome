const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
async function run() {
    await db.doc('estabelecimentos/u9VAwlHNqy1Q3WINAcQG/pedidos/laWP1O4pMQtB0GZ06AzH').update({
        statusLogistica: 'pronto'
    });
    console.log("Status revertido para 'pronto'");
}
run().then(() => process.exit(0)).catch(console.error);
