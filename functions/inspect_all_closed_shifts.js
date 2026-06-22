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
  console.log("Analyzing all closed shifts between June 19 and June 22, 2026...");
  
  const caixasRef = db.collection('caixas');
  const snap = await caixasRef.where('status', '==', 'fechado').get();
  
  const results = [];
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const fechTimestamp = data.dataFechamento;
    if (!fechTimestamp) continue;
    
    const fechDate = fechTimestamp.toDate();
    
    // Check if closed between June 19 and June 22
    const minDate = new Date('2026-06-19T00:00:00Z');
    const maxDate = new Date('2026-06-22T23:59:59Z');
    
    if (fechDate.getTime() >= minDate.getTime() && fechDate.getTime() <= maxDate.getTime()) {
      const estId = data.estabelecimentoId;
      let estName = 'Unknown';
      if (estId) {
        const estDoc = await db.collection('estabelecimentos').doc(estId).get();
        if (estDoc.exists) {
          estName = estDoc.data().nome;
        }
      }
      
      results.push({
        id: doc.id,
        establishmentId: estId,
        establishmentName: estName,
        abertura: data.dataAbertura?.toDate().toISOString(),
        fechamento: fechDate.toISOString(),
        totalFaturado: data.resumoVendas?.total || 0,
        qtdPedidos: data.resumoVendas?.qtd || 0,
        saldoInicial: data.saldoInicial || 0,
        saldoFinalInformado: data.saldoFinalInformado || 0,
        resumoVendas: data.resumoVendas
      });
    }
  }
  
  results.sort((a, b) => new Date(a.fechamento).getTime() - new Date(b.fechamento).getTime());
  
  console.log(`\nFound ${results.length} shifts closed in the date range:`);
  results.forEach(r => {
    console.log(`\n---------------------------------------------`);
    console.log(`Shift ID: ${r.id} (${r.id.toUpperCase()})`);
    console.log(`Establishment: ${r.establishmentName} (${r.establishmentId})`);
    console.log(`Abertura: ${r.abertura}`);
    console.log(`Fechamento: ${r.fechamento}`);
    console.log(`Total Faturado: R$ ${r.totalFaturado} (${r.qtdPedidos} orders)`);
    console.log(`Initial Drawer: R$ ${r.saldoInicial} | Closed Drawer: R$ ${r.saldoFinalInformado}`);
    console.log(`Payment Details:`, r.resumoVendas);
  });
}

run().catch(console.error);
