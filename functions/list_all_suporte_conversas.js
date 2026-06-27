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
  console.log("Listing all support conversations...");
  const snap = await db.collection('suporte_conversas').get();
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`\nDoc ID: ${doc.id}`);
    console.log(`  userName: ${data.userName}`);
    console.log(`  establishmentName: ${data.establishmentName}`);
    console.log(`  establishmentId: ${data.establishmentId}`);
    console.log(`  shortId: ${data.shortId}`);
    console.log(`  status: ${data.status}`);
    console.log(`  last message count: ${data.mensagens ? data.mensagens.length : 0}`);
    if (data.mensagens && data.mensagens.length > 0) {
      console.log(`  Last message:`, data.mensagens[data.mensagens.length - 1]);
    }
  });
}

run().catch(console.error);
