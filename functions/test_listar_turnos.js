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
  const usuarioId = 'ESfJhNd6b8e9ZNYaDlZPVZFjHSQ2'; //Thiaggo from earlier caixas
  const estabelecimentoId = 'mMoHI20u6TmNciAjmbEl';
  
  console.log(`Testing query for caixas with usuarioId: ${usuarioId} and estabelecimentoId: ${estabelecimentoId}`);
  
  try {
    const q = db.collection('caixas')
      .where('usuarioId', '==', usuarioId)
      .where('estabelecimentoId', '==', estabelecimentoId)
      .orderBy('dataAbertura', 'desc')
      .limit(10);
      
    const snapshot = await q.get();
    console.log(`Success! Found ${snapshot.size} caixas.`);
  } catch (error) {
    console.error("Query failed with error:", error);
  }
}

run().catch(console.error);
