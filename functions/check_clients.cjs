const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require('../keys/serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {}

const db = admin.firestore();

async function run() {
  const estabsSnap = await db.collection('estabelecimentos').get();
  console.log(`Found ${estabsSnap.size} establishments.`);
  
  for (const estabDoc of estabsSnap.docs) {
    const estabId = estabDoc.id;
    const dataEstab = estabDoc.data();
    console.log(`\n========================================`);
    console.log(`Establishment ID: ${estabId} (${dataEstab.nome || 'No Name'})`);
    
    console.log("Checking last 3 pedidos...");
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabId).collection('pedidos')
      .orderBy('createdAt', 'desc').limit(3).get();
    
    pedidosSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  Pedido ID: ${doc.id}`);
      console.log(`    clienteNome: ${data.clienteNome}`);
      console.log(`    clienteTelefone: ${data.clienteTelefone}`);
      console.log(`    cliente:`, data.cliente);
    });

    console.log("Checking last 3 clients in subcollection...");
    const clientsSnap = await db.collection('estabelecimentos').doc(estabId).collection('clientes')
      .limit(3).get();
    
    clientsSnap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`  Client ID: ${doc.id}`);
      console.log(`    nome: ${data.nome}`);
      console.log(`    telefone: ${data.telefone}`);
    });
  }
}

run().catch(console.error);
