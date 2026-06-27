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
const pontoCertoId = 'Ee89E1HlsA6QR9C8uuBC';
const targetId = '605jov2Lo1aQg1Tc2miL';

async function run() {
  console.log(`=== Searching in root caixas for ID: ${targetId} ===`);

  const caixasSnap = await db.collection('caixas')
    .where('estabelecimentoId', '==', pontoCertoId)
    .get();

  console.log(`Found ${caixasSnap.size} caixas for Ponto Certo.`);

  for (const caixaDoc of caixasSnap.docs) {
    const movDoc = await db.collection(`caixas/${caixaDoc.id}/movimentacoes`).doc(targetId).get();
    if (movDoc.exists) {
      console.log(`🎉 FOUND! Path: caixas/${caixaDoc.id}/movimentacoes/${targetId}`);
      console.log(`Data:`, movDoc.data());
      return;
    }
  }

  console.log("Not found in Ponto Certo caixas/movimentacoes.");
}

run().catch(console.error);
