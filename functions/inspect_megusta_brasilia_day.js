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
  
  // June 20 in Brasília time (UTC-3)
  const start = new Date('2026-06-20T03:00:00.000Z');
  const end = new Date('2026-06-21T02:59:59.999Z');
  
  console.log(`Checking MeGusta sales for June 20 (Local Time)...`);
  console.log(`UTC Range: ${start.toISOString()} to ${end.toISOString()}`);
  
  const salesSnap = await db.collection('vendas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  let count = 0;
  let total = 0;
  let deliveryFees = 0;
  
  const list = [];
  
  salesSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= start.getTime() && time <= end.getTime()) {
      count++;
      const val = parseFloat(data.total || data.totalFinal || 0);
      const delivery = parseFloat(data.taxaEntrega || 0);
      total += val;
      deliveryFees += delivery;
      list.push({
        id: doc.id,
        total: val,
        delivery,
        date: parsedDate.toISOString(),
        tipo: data.tipo || 'mesa'
      });
    }
  });
  
  console.log(`\n=== BRASÍLIA CALENDAR DAY SUMMARY ===`);
  console.log(`Total active sales: ${count}`);
  console.log(`Sum of total/totalFinal: R$ ${total.toFixed(2)}`);
  console.log(`Sum of delivery fees: R$ ${deliveryFees.toFixed(2)}`);
}

run().catch(console.error);
