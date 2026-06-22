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
  const start = new Date('2026-06-20T00:00:00.000Z');
  const end = new Date('2026-06-21T23:59:59.999Z');
  
  console.log(`Analyzing MeGusta sales from ${start.toISOString()} to ${end.toISOString()}...`);
  
  const salesSnap = await db.collection('vendas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  console.log(`Total MeGusta sales in collection: ${salesSnap.size}`);
  
  let totalAll = 0;
  let countAll = 0;
  let totalActive = 0;
  let countActive = 0;
  
  salesSnap.forEach(doc => {
    const data = doc.data();
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= start.getTime() && time <= end.getTime()) {
      const val = parseFloat(data.total || data.totalFinal || 0);
      countAll++;
      totalAll += val;
      
      if (data.status !== 'cancelado') {
        countActive++;
        totalActive += val;
        console.log(`Sale ID: ${doc.id} | Date: ${parsedDate.toISOString()} | Status: ${data.status} | Total: R$ ${val.toFixed(2)} | Payments: ${JSON.stringify(data.pagamentos || data.formaPagamento)}`);
      } else {
        console.log(`CANCELLED Sale ID: ${doc.id} | Date: ${parsedDate.toISOString()} | Total: R$ ${val.toFixed(2)}`);
      }
    }
  });
  
  console.log(`\nResults for MeGusta (20-21 June):`);
  console.log(`Total sales (incl. cancelled): ${countAll} | Sum: R$ ${totalAll.toFixed(2)}`);
  console.log(`Total active sales: ${countActive} | Sum: R$ ${totalActive.toFixed(2)}`);
}

run().catch(console.error);
