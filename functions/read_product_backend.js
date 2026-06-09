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
      if (data.nome === "Batata Frita 250g") {
        console.log("FOUND ITEM IN ITENS:", itemDoc.id);
        console.log(JSON.stringify(data, null, 2));
      }
      if (data.nome && data.nome.includes("Queijo")) {
        console.log("FOUND ITEM IN ITENS (QUEIJO):", data.nome);
        console.log(JSON.stringify(data, null, 2));
      }
      if (data.nome && data.nome.includes("X-Egg")) {
        console.log("FOUND ITEM IN ITENS (X-EGG):", data.nome);
        console.log(JSON.stringify(data, null, 2));
      }
    }
    const prodSnap = await catDoc.ref.collection('produtos').get();
    for (const itemDoc of prodSnap.docs) {
      const data = itemDoc.data();
      if (data.nome === "Batata Frita 250g") {
        console.log("FOUND ITEM IN PRODUTOS:", itemDoc.id);
        console.log(JSON.stringify(data, null, 2));
      }
      if (data.nome && data.nome.includes("Queijo")) {
        console.log("FOUND ITEM IN PRODUTOS (QUEIJO):", data.nome);
        console.log(JSON.stringify(data, null, 2));
      }
      if (data.nome && data.nome.includes("X-Egg")) {
        console.log("FOUND ITEM IN PRODUTOS (X-EGG):", data.nome);
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }
}

run().catch(console.error);
