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
  const estabId = '2eNNjBwmDHUyLlYVnMSH'; // MeGusta
  const start = new Date('2026-06-20T03:00:00.000Z');
  const end = new Date('2026-06-21T19:46:08.706Z');
  
  console.log(`Checking date field names on MeGusta sales...`);
  
  const salesSnap = await db.collection('vendas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  let countCreatedAt = 0;
  let countCriadoEm = 0;
  let countBoth = 0;
  let countNeither = 0;
  
  salesSnap.forEach(doc => {
    const data = doc.data();
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= start.getTime() && time <= end.getTime()) {
      const hasCreatedAt = data.createdAt !== undefined;
      const hasCriadoEm = data.criadoEm !== undefined;
      
      if (hasCreatedAt && hasCriadoEm) countBoth++;
      else if (hasCreatedAt) countCreatedAt++;
      else if (hasCriadoEm) countCriadoEm++;
      else countNeither++;
    }
  });
  
  console.log(`\nResults for sales in shift timeframe:`);
  console.log(`  - Only has 'createdAt': ${countCreatedAt}`);
  console.log(`  - Only has 'criadoEm': ${countCriadoEm}`);
  console.log(`  - Has BOTH 'createdAt' and 'criadoEm': ${countBoth}`);
  console.log(`  - Has neither: ${countNeither}`);
}

run().catch(console.error);
