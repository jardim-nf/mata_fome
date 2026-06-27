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
  console.log("Checking sales (vendas) collection for NaN values...");
  const snap = await db.collection('vendas').get();
  console.log(`Found ${snap.size} total sales.`);
  
  let count = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (hasNaN(data)) {
      count++;
      console.log(`\nSale ID: ${doc.id}`);
      console.log(`  estabelecimentoId: ${data.estabelecimentoId}`);
      console.log(`  createdAt: ${data.createdAt ? data.createdAt.toDate() : 'no date'}`);
      console.log(`  NaN keys:`, findNaNKeys(data));
    }
  });
  console.log(`\nDone. Found ${count} sales with NaN values.`);
}

run().catch(console.error);
