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
  const establishmentsSnap = await db.collection('estabelecimentos').get();
  for (const doc of establishmentsSnap.docs) {
    const osSnap = await db.collection('estabelecimentos').doc(doc.id).collection('ordensServico').limit(1).get();
    const configSnap = await db.collection('estabelecimentos').doc(doc.id).collection('config').doc('ordensServico').get();
    
    if (!osSnap.empty || configSnap.exists) {
      console.log(`Establishment: ${doc.id} (${doc.data().nome})`);
      console.log(`  - OS collection count: ${osSnap.size}`);
      console.log(`  - config/ordensServico exists: ${configSnap.exists}`);
      if (configSnap.exists) {
        console.log(`  - config details:`, configSnap.data());
      }
    }
  }
}

run().catch(console.error);
