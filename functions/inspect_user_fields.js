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
  const usersSnap = await db.collection('usuarios').get();
  console.log(`Checking user fields...`);
  
  let count = 0;
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.estabelecimentoId || data.estabelecimento || data.estabelecimentoNome || data.nomeEstabelecimento) {
      count++;
      console.log(`\nUser ID: ${doc.id}`);
      console.log(`  nome: ${data.nome}`);
      console.log(`  email: ${data.email}`);
      console.log(`  estabelecimentoId: ${data.estabelecimentoId}`);
      console.log(`  estabelecimento: ${data.estabelecimento}`);
      console.log(`  estabelecimentoNome: ${data.estabelecimentoNome}`);
      console.log(`  nomeEstabelecimento: ${data.nomeEstabelecimento}`);
    }
  });
  console.log(`\nFound ${count} users with establishment fields.`);
}

run().catch(console.error);
