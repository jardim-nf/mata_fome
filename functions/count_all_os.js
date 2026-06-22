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
  console.log("Analyzing OS counts for all establishments...");
  for (const doc of establishmentsSnap.docs) {
    const collRef = db.collection('estabelecimentos').doc(doc.id).collection('ordensServico');
    const countSnap = await collRef.count().get();
    const count = countSnap.data().count;
    
    const configSnap = await db.collection('estabelecimentos').doc(doc.id).collection('config').doc('ordensServico').get();
    
    if (count > 0 || configSnap.exists) {
      console.log(`Establishment: ${doc.id} (${doc.data().nome})`);
      console.log(`  - Total OS in Firestore: ${count}`);
      if (configSnap.exists) {
        console.log(`  - Config details:`, configSnap.data());
      }
    }
  }
}

run().catch(console.error);
