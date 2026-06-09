const admin = require('firebase-admin');
const serviceAccount = require('../keys/serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {}

const db = admin.firestore();
const estabId = "AqBPa0m18wbVMrdvpxKA";

async function run() {
  const cardapioRef = db.collection('estabelecimentos').doc(estabId).collection('cardapio');
  const cardapioSnap = await cardapioRef.get();
  
  for (const catDoc of cardapioSnap.docs) {
    const itensSnap = await catDoc.ref.collection('itens').get();
    for (const itemDoc of itensSnap.docs) {
      const data = itemDoc.data();
      console.log(`ITEM [${itemDoc.id}] in category [${catDoc.id}]:`, data.nome, "Preco:", data.preco, "Variacoes:", data.variacoes ? data.variacoes.length : 0);
      if (data.variacoes) {
        console.log("Variations data:", JSON.stringify(data.variacoes, null, 2));
      }
    }
    const prodSnap = await catDoc.ref.collection('produtos').get();
    for (const itemDoc of prodSnap.docs) {
      const data = itemDoc.data();
      console.log(`PRODUTO [${itemDoc.id}] in category [${catDoc.id}]:`, data.nome, "Preco:", data.preco, "Variacoes:", data.variacoes ? data.variacoes.length : 0);
      if (data.variacoes) {
        console.log("Variations data:", JSON.stringify(data.variacoes, null, 2));
      }
    }
  }
}

run().catch(console.error);
