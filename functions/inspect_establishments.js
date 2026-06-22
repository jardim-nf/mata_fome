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
  console.log("Listing establishments...");
  const snap = await db.collection('estabelecimentos').get();
  snap.forEach(doc => {
    console.log(`ID: ${doc.id} => Name: ${doc.data().nome} / ${doc.data().razaoSocial}`);
  });
}

run().catch(console.error);
