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
  const shiftId = 'oz9w0MPIUbqOpphYg7ux';
  
  const shiftDoc = await db.collection('caixas').doc(shiftId).get();
  const shift = shiftDoc.data();
  const start = shift.dataAbertura.toDate();
  const end = shift.dataFechamento.toDate();
  
  console.log(`=== SHIFT INFO ===`);
  console.log(`Shift ID: ${shiftId}`);
  console.log(`Abertura (UTC): ${start.toISOString()} | Local: ${new Date(start.getTime() - 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19)}`);
  console.log(`Fechamento (UTC): ${end.toISOString()} | Local: ${new Date(end.getTime() - 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19)}`);
  
  // Let's get all sales in MeGusta on June 20 (local) and June 21 (local)
  // June 20 local starts at 2026-06-20T03:00:00Z and June 21 local ends at 2026-06-22T03:00:00Z
  const minDate = new Date('2026-06-20T03:00:00Z');
  const maxDate = new Date('2026-06-22T03:00:00Z');
  
  const salesSnap = await db.collection('vendas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  let countInShift = 0;
  let totalInShift = 0;
  let countBeforeShift = 0;
  let totalBeforeShift = 0;
  let countAfterShift = 0;
  let totalAfterShift = 0;
  
  salesSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= minDate.getTime() && time < maxDate.getTime()) {
      const val = parseFloat(data.total || data.totalFinal || 0);
      const isInside = time >= (start.getTime() - 60000) && time <= end.getTime();
      
      const localStr = new Date(time - 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      
      if (isInside) {
        countInShift++;
        totalInShift += val;
      } else if (time < start.getTime()) {
        countBeforeShift++;
        totalBeforeShift += val;
        console.log(`BEFORE SHIFT: Sale ${doc.id} | Local Time: ${localStr} | Total: R$ ${val.toFixed(2)} | Status: ${data.status}`);
      } else {
        countAfterShift++;
        totalAfterShift += val;
        console.log(`AFTER SHIFT: Sale ${doc.id} | Local Time: ${localStr} | Total: R$ ${val.toFixed(2)} | Status: ${data.status}`);
      }
    }
  });
  
  console.log(`\n=== SUMMARY OF ACTIVE SALES (June 20 - 21 Local Time) ===`);
  console.log(`Before Shift (June 20 early hours): ${countBeforeShift} sales | Total: R$ ${totalBeforeShift.toFixed(2)}`);
  console.log(`Inside Shift: ${countInShift} sales | Total: R$ ${totalInShift.toFixed(2)}`);
  console.log(`After Shift (if any): ${countAfterShift} sales | Total: R$ ${totalAfterShift.toFixed(2)}`);
  console.log(`Sum of all: ${countBeforeShift + countInShift + countAfterShift} sales | Total: R$ ${(totalBeforeShift + totalInShift + totalAfterShift).toFixed(2)}`);
}

run().catch(console.error);
