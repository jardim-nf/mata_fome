const admin = require('firebase-admin');
const serviceAccount = require('../keys/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  try {
    console.log("Listing documents in caixas collection...");
    const snap = await db.collection('caixas').get();
    console.log(`Total documents found: ${snap.size}`);
    
    snap.docs.forEach(doc => {
      const d = doc.data();
      const openTime = d.dataAbertura?.toDate ? d.dataAbertura.toDate() : (d.dataAbertura ? new Date(d.dataAbertura) : null);
      console.log(`Doc ID: ${doc.id} | Status: ${d.status} | Aberto: ${openTime?.toLocaleString('pt-BR')} | Total: ${d.resumoVendas?.total}`);
    });
  } catch (error) {
    console.error("Error listing caixas:", error);
  }
}

run();
