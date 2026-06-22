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
  const start = new Date('2026-06-20T19:56:57.275Z');
  const end = new Date('2026-06-21T19:46:00.000Z');
  
  console.log(`Analyzing ALL sales in Firestore from ${start.toISOString()} to ${end.toISOString()}...`);
  
  const salesRef = db.collection('vendas');
  const snapshot = await salesRef.get();
  
  const estabSummary = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= start.getTime() && time <= end.getTime()) {
      const estId = data.estabelecimentoId || 'undefined';
      const val = parseFloat(data.total || data.totalFinal || 0);
      
      if (!estabSummary[estId]) {
        estabSummary[estId] = {
          total: 0,
          count: 0,
          payments: {}
        };
      }
      
      estabSummary[estId].total += val;
      estabSummary[estId].count += 1;
    }
  });
  
  console.log("\nSummary by Establishment:");
  for (const [estId, summary] of Object.entries(estabSummary)) {
    let estName = 'Unknown';
    if (estId !== 'undefined') {
      const estDoc = await db.collection('estabelecimentos').doc(estId).get();
      estName = estDoc.exists ? estDoc.data().nome : 'Not Found';
    }
    console.log(`Establishment ID: ${estId} (${estName}) => Total Sales: R$ ${summary.total.toFixed(2)} | Count: ${summary.count}`);
  }
}

run().catch(console.error);
