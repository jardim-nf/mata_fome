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

function hasNaN(obj) {
  if (obj === null || obj === undefined) return false;
  if (typeof obj === 'number' && Number.isNaN(obj)) return true;
  if (Array.isArray(obj)) {
    return obj.some(item => hasNaN(item));
  }
  if (typeof obj === 'object') {
    return Object.values(obj).some(val => hasNaN(val));
  }
  return false;
}

function findNaNKeys(obj, path = '') {
  if (obj === null || obj === undefined) return [];
  if (typeof obj === 'number' && Number.isNaN(obj)) return [path];
  let found = [];
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      found = found.concat(findNaNKeys(item, `${path}[${index}]`));
    });
  } else if (typeof obj === 'object') {
    Object.entries(obj).forEach(([key, val]) => {
      found = found.concat(findNaNKeys(val, path ? `${path}.${key}` : key));
    });
  }
  return found;
}

async function run() {
  const estabId = '2eNNjBwmDHUyLlYVnMSH'; // MeGusta
  console.log(`Checking establishment ${estabId} for NaN values...`);

  // Check mesa document
  const mesaId = 'ftneGxz6sRKQ9XBjsTx';
  const mesaDoc = await db.collection('estabelecimentos').doc(estabId).collection('mesas').doc(mesaId).get();
  if (mesaDoc.exists) {
    const data = mesaDoc.data();
    if (hasNaN(data)) {
      console.log(`Mesa ${mesaId} has NaN values in keys:`, findNaNKeys(data));
    } else {
      console.log(`Mesa ${mesaId} has NO NaN values.`);
    }
  } else {
    console.log(`Mesa ${mesaId} not found`);
  }

  // Check all items in cardapio (nested under categories)
  console.log(`Checking cardapio subcollections...`);
  const catSnap = await db.collection('estabelecimentos').doc(estabId).collection('cardapio').get();
  for (const catDoc of catSnap.docs) {
    const itemsSnap = await catDoc.ref.collection('itens').get();
    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      if (hasNaN(data)) {
        console.log(`Product "${data.nome}" (ID: ${itemDoc.id}) in Category "${catDoc.id}" has NaN values in keys:`, findNaNKeys(data));
      }
    }
  }
  console.log("Done checking.");
}

run().catch(console.error);
