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

const isMesaDoc = (data) => data.tipo === 'mesa' || data.origem === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;
const safeNum = (val) => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

async function run() {
  const estabId = 'u9VAwlHNqy1Q3WINAcQG'; // Mata Fome Burguer
  const startDate = '2026-06-20';
  const endDate = '2026-06-20';
  
  const [yS, mS, dS] = startDate.split('-').map(Number);
  const startTs = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(yS, mS - 1, dS, 9, 0, 0, 0)));

  const [yE, mE, dE] = endDate.split('-').map(Number);
  const endTs = admin.firestore.Timestamp.fromDate(new Date(Date.UTC(yE, mE - 1, dE, 32, 59, 59, 999)));
  
  console.log(`Checking Mata Fome Burguer (u9VAwlHNqy1Q3WINAcQG) sales...`);
  
  const pedidosRef = db.collection('estabelecimentos').doc(estabId).collection('pedidos');
  const vendasRef = db.collection('vendas');
  const pedidosGlobalRef = db.collection('pedidos');
  
  const [snapSub, snapGlob, snapMesa] = await Promise.all([
    pedidosRef.where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get(),
    pedidosGlobalRef.where('estabelecimentoId', '==', estabId).where('createdAt', '>=', startTs).where('createdAt', '<=', endTs).get(),
    vendasRef.where('estabelecimentoId', '==', estabId).where('criadoEm', '>=', startTs).where('criadoEm', '<=', endTs).get()
  ]);
  
  console.log(`Subcollection 'pedidos': ${snapSub.size}`);
  console.log(`Global 'pedidos': ${snapGlob.size}`);
  console.log(`Global 'vendas': ${snapMesa.size}`);
  
  let allDataMap = new Map();
  
  const extractData = (doc, origem) => {
      const data = doc.data();
      const dateVal = data.createdAt || data.criadoEm || data.data;
      const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : new Date());
      const isMesa = isMesaDoc(data) || origem === 'mesa';
      
      const base = {
          id: doc.id,
          origem,
          totalFinal: safeNum(data.totalFinal !== undefined ? data.totalFinal : data.total),
          taxaEntrega: safeNum(data.taxaEntrega),
          status: data.status || (isMesa ? 'finalizada' : ''),
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
  
  let totalVendas = 0;
  let totalTaxas = 0;
  let countValidos = 0;
  
  dedup.forEach(p => {
    const isCancelado = String(p.status).toLowerCase().trim() === 'cancelado';
    if (!isCancelado) {
      countValidos++;
      totalVendas += p.totalFinal;
      totalTaxas += p.taxaEntrega;
    }
  });
  
  console.log(`\n=== MATA FOME BURGUER SUMMARY ===`);
  console.log(`Valid Orders: ${countValidos}`);
  console.log(`Total: R$ ${totalVendas.toFixed(2)}`);
  console.log(`Delivery: R$ ${totalTaxas.toFixed(2)}`);
}

run().catch(console.error);
