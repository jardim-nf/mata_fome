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
  const uid = 'CZj0aYjCiOYHP1eVDPHIViXSIPP2';
  const doc = await db.collection('usuarios').doc(uid).get();
  if (doc.exists) {
    console.log(`User ID: ${doc.id}`);
    console.log(JSON.stringify(doc.data(), null, 2));
  } else {
    console.log(`User ${uid} not found`);
  }
}

run().catch(console.error);
