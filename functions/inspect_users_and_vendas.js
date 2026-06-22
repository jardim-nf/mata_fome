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
  const start = new Date("2026-06-20T00:00:00Z"); // Let's check both June 20 and 21
  const end = new Date("2026-06-21T23:59:59Z");
  
  console.log("Analyzing all sales in DB between June 20 and June 21, 2026...");
  
  const salesRef = db.collection('vendas');
  const snapshot = await salesRef.get();
  
  const estabSales = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= start.getTime() && time <= end.getTime()) {
      const estabId = data.estabelecimentoId || 'unknown';
      if (!estabSales[estabId]) estabSales[estabId] = [];
      estabSales[estabId].push({
        id: doc.id,
        createdAt: parsedDate.toISOString(),
        total: parseFloat(data.total || 0),
        totalFinal: parseFloat(data.totalFinal || 0),
        usuarioId: data.usuarioId,
        funcionarioId: data.funcionarioId,
        funcionario: data.funcionario,
        pagamentos: data.pagamentos || {},
        formaPagamento: data.formaPagamento
      });
    }
  });
  
  Object.keys(estabSales).forEach(estabId => {
    console.log(`\n==================================================`);
    console.log(`ESTABLISHMENT ID: ${estabId}`);
    console.log(`==================================================`);
    
    const sales = estabSales[estabId];
    console.log(`Total active sales: ${sales.length}`);
    
    // Group sales by calendar day (UTC)
    const groupedByDay = {};
    sales.forEach(s => {
      const day = s.createdAt.substring(0, 10);
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push(s);
    });
    
    Object.keys(groupedByDay).forEach(day => {
      console.log(`\n  Day: ${day}`);
      const daySales = groupedByDay[day];
      console.log(`    Sales count: ${daySales.length}`);
      
      const sumTotal = daySales.reduce((sum, s) => sum + s.total, 0);
      const sumTotalFinal = daySales.reduce((sum, s) => sum + s.totalFinal, 0);
      console.log(`    Sum of total: R$ ${sumTotal.toFixed(2)}`);
      console.log(`    Sum of totalFinal: R$ ${sumTotalFinal.toFixed(2)}`);
      
      // Let's check payments details
      const payMethods = {};
      daySales.forEach(s => {
        const pagList = Array.isArray(s.pagamentos) ? s.pagamentos : Object.values(s.pagamentos);
        if (pagList.length > 0) {
          pagList.forEach(p => {
            const f = p.forma || p.formaPagamento || 'N/A';
            payMethods[f] = (payMethods[f] || 0) + parseFloat(p.valor || 0);
          });
        } else {
          const f = s.formaPagamento || 'N/A';
          payMethods[f] = (payMethods[f] || 0) + s.total;
        }
      });
      console.log(`    Payments:`, payMethods);
    });
  });
}

run().catch(console.error);
