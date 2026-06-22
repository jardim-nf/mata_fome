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
  
  console.log("Fetching all OS records to identify duplicates...");
  const snapshot = await collRef.get();
  console.log(`Found ${snapshot.size} total OS records in database.`);

  const seen = new Set();
  const duplicates = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const osNumber = data.numeroOS;
    
    if (seen.has(osNumber)) {
      duplicates.push(doc.ref);
    } else {
      seen.add(osNumber);
    }
  });

  console.log(`Found ${duplicates.length} duplicate records. Unique records: ${seen.size}`);

  if (duplicates.length === 0) {
    console.log("No duplicates found. Database is clean.");
    return;
  }

  console.log("Deleting duplicates in batches...");
  let batch = db.batch();
  let count = 0;
  const batchPromises = [];
  const BATCH_LIMIT = 400;

  for (const docRef of duplicates) {
    batch.delete(docRef);
    count++;

    if (count % BATCH_LIMIT === 0) {
      console.log(`Committing delete batch (${count}/${duplicates.length})...`);
      batchPromises.push(batch.commit());
      batch = db.batch();
    }
  }

  if (count % BATCH_LIMIT !== 0) {
    console.log(`Committing final delete batch (${count}/${duplicates.length})...`);
    batchPromises.push(batch.commit());
  }

  await Promise.all(batchPromises);
  console.log(`Successfully deleted ${count} duplicate OS records.`);
  
  // Verify final count
  const finalCountSnap = await collRef.count().get();
  console.log(`Verification: Total OS in database now: ${finalCountSnap.data().count}`);
}

run().catch(console.error);
