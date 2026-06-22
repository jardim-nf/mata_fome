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
const ESTABELECIMENTO_ID = 'tOZZz6M3NKZUWe1X50Qj';

async function run() {
  const collRef = db.collection('estabelecimentos').doc(ESTABELECIMENTO_ID).collection('ordensServico');
  const countSnap = await collRef.count().get();
  console.log(`Establishment ID: ${ESTABELECIMENTO_ID}`);
  console.log(`Total Ordens de Serviço (OS) in Firestore: ${countSnap.data().count}`);
}

run().catch(console.error);
