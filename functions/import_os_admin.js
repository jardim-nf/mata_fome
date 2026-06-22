import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../keys/serviceAccountKey.json'), 'utf8')
);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// 2. Target establishment ID
// Based on check_os_collections.js, tOZZz6M3NKZUWe1X50Qj (PUB DANITATO) is the establishment
// that has the ultimoNumeroOS config set, indicating it was the target of the failed UI import.
const ESTABELECIMENTO_ID = 'tOZZz6M3NKZUWe1X50Qj';
const JSON_PATH = '/Users/matheusjardim/Downloads/ordens_servico_prontas.json';

async function run() {
  console.log(`Starting OS migration for establishment: ${ESTABELECIMENTO_ID}...`);
  
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Error: JSON file not found at ${JSON_PATH}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(JSON_PATH, 'utf8');
  const ordens = JSON.parse(rawData);
  console.log(`Loaded ${ordens.length} OS records from JSON.`);

  // Find max OS number
  let maxOS = 0;
  ordens.forEach(o => {
    const num = Number(o.numeroOS) || 0;
    if (num > maxOS) maxOS = num;
  });
  console.log(`Max OS number found: ${maxOS}`);

  const colRef = db.collection('estabelecimentos').doc(ESTABELECIMENTO_ID).collection('ordensServico');

  let operations = 0;
  let batch = db.batch();
  const batchPromises = [];
  const BATCH_LIMIT = 400; // Firestore limit is 500, we use 400 for safety

  for (const os of ordens) {
    // Structure the document data converting date strings to JS Date objects
    const docData = {
      ...os,
      createdAt: os.createdAt ? new Date(os.createdAt) : new Date(),
      updatedAt: os.updatedAt ? new Date(os.updatedAt) : new Date(),
    };

    if (docData.timeline) {
      docData.timeline = docData.timeline.map(t => ({
        ...t,
        data: t.data ? new Date(t.data) : new Date()
      }));
    }

    const newDocRef = colRef.doc(); // Auto-generate ID
    batch.set(newDocRef, docData);
    operations++;

    if (operations % BATCH_LIMIT === 0) {
      console.log(`Committing batch of ${BATCH_LIMIT} records (${operations}/${ordens.length})...`);
      batchPromises.push(batch.commit());
      batch = db.batch();
    }
  }

  // Commit any leftover records
  if (operations % BATCH_LIMIT !== 0) {
    console.log(`Committing final batch of ${operations % BATCH_LIMIT} records (${operations}/${ordens.length})...`);
    batchPromises.push(batch.commit());
  }

  await Promise.all(batchPromises);
  console.log(`Successfully imported ${operations} OS documents.`);

  // Update configuration
  if (maxOS > 0) {
    const configOSRef = db.collection('estabelecimentos').doc(ESTABELECIMENTO_ID).collection('config').doc('ordensServico');
    await configOSRef.set({ ultimoNumeroOS: maxOS }, { merge: true });
    console.log(`Updated config/ordensServico with ultimoNumeroOS = ${maxOS}`);
  }

  console.log('Migration finished successfully!');
}

run().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
