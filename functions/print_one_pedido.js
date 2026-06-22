import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../keys/serviceAccountKey.json'), 'utf8')
);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  const estabId = '2eNNjBwmDHUyLlYVnMSH'; // MeGusta
  const orderId = 'RHagsxOUUgS5tpcEPyGG';
  
  const doc = await db.collection('estabelecimentos').doc(estabId).collection('pedidos').doc(orderId).get();
  if (doc.exists) {
    console.log("Order Data:", JSON.stringify(doc.data(), null, 2));
  } else {
    console.log("Order not found!");
  }
}

run().catch(console.error);
