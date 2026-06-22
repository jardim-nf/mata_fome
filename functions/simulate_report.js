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

// Exact logic from Cloud Function
const isMesaDoc = (data) => data.tipo === 'mesa' || data.origem === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
const safeNum = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

async function run() {
  const estabId = '2eNNjBwmDHUyLlYVnMSH'; // MeGusta
  const startDate = '2026-06-20';
  const endDate = '2026-06-20';
  
  const [yS, mS, dS] = startDate.split('-').map(Number);
  const startTs = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(yS, mS - 1, dS, 9, 0, 0, 0)));

  const [yE, mE, dE] = endDate.split('-').map(Number);
  const endTs = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(yE, mE - 1, dE, 32, 59, 59, 999)));
  
  console.log(`Simulating gerarRelatorioBackend for June 20...`);
  
  const pedidosRef = db.collection('estabelecimentos').doc(estabId).collection('pedidos');
  const vendasRef = db.collection('vendas');
  const pedidosGlobalRef = db.collection('pedidos');
  
  const [snapSub, snapGlob, snapMesa] = await Promise.all([
    pedidosRef.where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get(),
    pedidosGlobalRef.where('estabelecimentoId', '==', estabId).where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get(),
    vendasRef.where('estabelecimentoId', '==', estabId).where('criadoEm', '>=', startTs).where('criadoEm', '<=', endTs).get()
  ]);
  
  let allDataMap = new Map();
  
  const extractData = (doc, origem) => {
      const data = doc.data();
      const dateVal = data.createdAt || data.criadoEm || data.data;
      const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : new Date());
      const isMesa = isMesaDoc(data) || origem === 'mesa';
      
      const base = {
          id: doc.id,
          origem,
          dataStr: parsedDate.toISOString(),
          totalFinal: safeNum(data.totalFinal !== undefined ? data.totalFinal : data.total),
          taxaEntrega: safeNum(data.taxaEntrega),
          tipo: isMesa ? 'mesa' : (data.tipo || 'delivery'),
          status: data.status || (isMesa ? 'finalizada' : ''),
          formaPagamento: data.formaPagamento || '',
          pagamentos: data.pagamentos || {},
          clienteNome: data.clienteNome || data.nomeCliente || data.cliente || '',
          pedidoId: data.pedidoId || null
      };
      
      if (!allDataMap.has(base.id)) {
          allDataMap.set(base.id, base);
      }
  };
  
  snapSub.docs.forEach(d => { if (!isMesaDoc(d.data())) extractData(d, 'delivery'); });
  snapGlob.docs.forEach(d => { if (!isMesaDoc(d.data())) extractData(d, 'delivery'); });
  snapMesa.docs.forEach(d => {
      const data = d.data();
      const origemReal = isMesaDoc(data) ? 'mesa' : (data.origem || 'mesa');
      extractData(d, origemReal);
  });
  
  let dedup = Array.from(allDataMap.values());
  const pedidoIdsComVenda = new Set();
  dedup.forEach(item => {
      if (item.pedidoId && item.pedidoId !== item.id) {
          pedidoIdsComVenda.add(item.pedidoId);
      }
  });
  dedup = dedup.filter(item => !pedidoIdsComVenda.has(item.id));
  
  // Now let's check for each valid order in the report if it exists in the 'vendas' collection
  let inVendasCount = 0;
  let onlyInPedidosCount = 0;
  
  let reportTotal = 0;
  let reportDeliveryFees = 0;
  let reportValidCount = 0;
  
  for (const p of dedup) {
    const isCancelado = String(p.status).toLowerCase().trim() === 'cancelado';
    if (isCancelado) continue;
    
    reportValidCount++;
    reportTotal += p.totalFinal;
    reportDeliveryFees += p.taxaEntrega;
    
    // Check if exists in vendas collection
    const vDoc = await db.collection('vendas').doc(p.id).get();
    if (vDoc.exists) {
      inVendasCount++;
    } else {
      onlyInPedidosCount++;
      console.log(`ONLY IN PEDIDOS: ID: ${p.id} | Origem: ${p.origem} | Tipo: ${p.tipo} | Total: R$ ${p.totalFinal} | Client: ${JSON.stringify(p.clienteNome)} | Date: ${p.dataStr}`);
    }
  }
  
  console.log(`\n=== ANALYSIS RESULTS ===`);
  console.log(`Report Valid Count: ${reportValidCount} (Expected from screen: 79)`);
  console.log(`Report Total Final (Faturamento Líquido): R$ ${reportTotal.toFixed(2)} (Expected from screen: 4570.69)`);
  console.log(`Report Delivery Fees: R$ ${reportDeliveryFees.toFixed(2)} (Expected from screen: 54.00)`);
  console.log(`Of these:`);
  console.log(`  - Also in 'vendas' collection: ${inVendasCount}`);
  console.log(`  - Only in 'pedidos' subcollection (omitted from vendas): ${onlyInPedidosCount}`);
}

run().catch(console.error);
