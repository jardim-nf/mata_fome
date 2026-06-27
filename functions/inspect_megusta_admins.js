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
  console.log("Searching for admins of MeGusta...");
  
  usersSnap.forEach(doc => {
    const data = doc.data();
    const isMegustaAdmin = Array.isArray(data.estabelecimentosGerenciados) && data.estabelecimentosGerenciados.includes('2eNNjBwmDHUyLlYVnMSH');
    if (isMegustaAdmin) {
      console.log(`\nUser ID: ${doc.id}`);
      console.log(JSON.stringify(data, null, 2));
    }
  });
}

run().catch(console.error);
