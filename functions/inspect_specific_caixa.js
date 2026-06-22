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
  console.log("Listing all documents in 'caixas' collection...");
  const caixasSnap = await db.collection('caixas').get();
  console.log(`Found ${caixasSnap.size} caixas in total.`);
  
  caixasSnap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | status: ${data.status} | estabelecimentoId: ${data.estabelecimentoId} | Abertura: ${data.dataAbertura?.toDate().toISOString()}`);
  });
}

run().catch(console.error);
