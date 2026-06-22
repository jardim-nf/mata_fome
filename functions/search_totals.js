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
  console.log("Searching caixas for totals around 4570 or 5420...");
  const caixasRef = db.collection('caixas');
  const caixasSnap = await caixasRef.get();
  
  console.log(`Total caixas in DB: ${caixasSnap.size}`);
  caixasSnap.forEach(doc => {
    const data = doc.data();
    const dataAbertura = data.dataAbertura?.toDate ? data.dataAbertura.toDate().toISOString() : 'N/A';
    
    // Check inside resumoVendas
    if (data.resumoVendas) {
      const rv = data.resumoVendas;
      if (rv.total > 4000 && rv.total < 6000) {
        console.log(`Matched Caixa ID: ${doc.id} | Status: ${data.status} | Aberto: ${dataAbertura} | Total: ${rv.total}`);
        console.log(`  Resumo:`, rv);
      }
    }
  });

  console.log("\nSearching for sales on 2026-06-21 to sum up and check against 4570.69 or 5420.96...");
  
  // Let's get all sales in the DB and analyze their totals and dates.
  const salesRef = db.collection('vendas');
  const salesSnap = await salesRef.get();
  console.log(`Total sales in DB: ${salesSnap.size}`);
  
  // Group by establishmentId and check totals
  const estabSales = {};
  
  salesSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const estabId = data.estabelecimentoId || 'unknown';
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (!parsedDate) return;
    
    const dateStr = parsedDate.toISOString();
    
    // We want to analyze sales around 2026-06-20 and 2026-06-21
    if (dateStr.startsWith("2026-06-20") || dateStr.startsWith("2026-06-21")) {
      if (!estabSales[estabId]) {
        estabSales[estabId] = [];
      }
      estabSales[estabId].push({
        id: doc.id,
        createdAt: dateStr,
        total: parseFloat(data.total || 0),
        totalFinal: parseFloat(data.totalFinal || 0),
        pagamentos: data.pagamentos || {},
        formaPagamento: data.formaPagamento
      });
    }
  });
  
  Object.keys(estabSales).forEach(estabId => {
    const sales = estabSales[estabId];
    console.log(`\nEstablishment ID: ${estabId} | Sales count: ${sales.length}`);
    
    // Let's calculate total and totalFinal for different date intervals
    // 1. All sales on 2026-06-21 UTC
    const sales21 = sales.filter(s => s.createdAt.startsWith("2026-06-21"));
    const sum21_total = sales21.reduce((sum, s) => sum + s.total, 0);
    const sum21_totalFinal = sales21.reduce((sum, s) => sum + s.totalFinal, 0);
    console.log(`  2026-06-21 (All UTC):`);
    console.log(`    Sum of total: ${sum21_total}`);
    console.log(`    Sum of totalFinal: ${sum21_totalFinal}`);
    
    // 2. All sales on 2026-06-21 in BRT (UTC-3)
    // Financial day for 2026-06-21 in BRT starts at 2026-06-21T09:00:00Z and ends at 2026-06-22T08:59:59.999Z
    const sales21_BRT = sales.filter(s => {
      const t = new Date(s.createdAt).getTime();
      const start = new Date("2026-06-21T09:00:00Z").getTime();
      const end = new Date("2026-06-22T09:00:00Z").getTime();
      return t >= start && t < end;
    });
    const sum21_BRT_total = sales21_BRT.reduce((sum, s) => sum + s.total, 0);
    const sum21_BRT_totalFinal = sales21_BRT.reduce((sum, s) => sum + s.totalFinal, 0);
    console.log(`  2026-06-21 (Financial BRT: 06:00 AM 21st to 06:00 AM 22nd):`);
    console.log(`    Sum of total: ${sum21_BRT_total}`);
    console.log(`    Sum of totalFinal: ${sum21_BRT_totalFinal}`);
    
    // 3. All sales on 2026-06-20 in BRT (UTC-3)
    // Financial day for 2026-06-20 in BRT starts at 2026-06-20T09:00:00Z and ends at 2026-06-21T08:59:59.999Z
    const sales20_BRT = sales.filter(s => {
      const t = new Date(s.createdAt).getTime();
      const start = new Date("2026-06-20T09:00:00Z").getTime();
      const end = new Date("2026-06-21T08:59:59.999Z").getTime();
      return t >= start && t < end;
    });
    const sum20_BRT_total = sales20_BRT.reduce((sum, s) => sum + s.total, 0);
    const sum20_BRT_totalFinal = sales20_BRT.reduce((sum, s) => sum + s.totalFinal, 0);
    console.log(`  2026-06-20 (Financial BRT):`);
    console.log(`    Sum of total: ${sum20_BRT_total}`);
    console.log(`    Sum of totalFinal: ${sum20_BRT_totalFinal}`);
  });
}

run().catch(console.error);
