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

const traduzirForma = (metodo) => {
    if (!metodo || metodo === 'N/A') return 'Não Informado';
    const m = metodo.toLowerCase().trim();
    const mapa = {
        'credit_card': 'Cartão de Crédito',
        'debit_card': 'Cartão de Débito',
        'money': 'Dinheiro',
        'cash': 'Dinheiro',
        'dinheiro': 'Dinheiro',
        'pix': 'PIX',
        'pix_manual': 'PIX Manual',
        'pix manual': 'PIX Manual',
        'wallet': 'Carteira Digital',
        'card': 'Cartão',
        'cartao': 'Cartão',
        'cartão': 'Cartão',
        'online': 'Online',
        'crediario': 'Crediário',
        'crediário': 'Crediário'
    };
    return mapa[m] || metodo.charAt(0).toUpperCase() + metodo.slice(1);
};

async function run() {
  const estabId = 'mMoHI20u6TmNciAjmbEl';
  const shiftOpenTime = new Date('2026-06-21T18:07:48.781Z');
  
  console.log(`Analyzing sales for establishment: ${estabId}`);
  console.log(`Shift open time: ${shiftOpenTime.toISOString()}`);
  
  const salesRef = db.collection('vendas');
  const snapshot = await salesRef
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  console.log(`Total sales for this establishment in collection: ${snapshot.size}`);
  
  let totalCalculatedTotal = 0;
  let totalCalculatedTotalFinal = 0;
  const paymentMethodsTotal = {};
  const paymentsDetails = [];
  
  let salesAfterShiftOpenCount = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (!parsedDate) return;
    
    // Check if the sale was made during the shift
    if (parsedDate.getTime() >= (shiftOpenTime.getTime() - 60000)) {
      salesAfterShiftOpenCount++;
      
      const valTotal = parseFloat(data.total || 0);
      const valTotalFinal = parseFloat(data.totalFinal || 0);
      totalCalculatedTotal += valTotal;
      totalCalculatedTotalFinal += valTotalFinal;
      
      const pagMap = data.pagamentos || {};
      const pagList = Array.isArray(data.pagamentos) ? data.pagamentos : Object.values(pagMap);
      
      paymentsDetails.push({
        id: doc.id,
        mesa: data.mesaNumero || data.numeroMesa,
        total: valTotal,
        totalFinal: valTotalFinal,
        pagamentos: pagList,
        formaPagamento: data.formaPagamento,
        createdAt: parsedDate.toISOString(),
        usuarioId: data.usuarioId,
        funcionarioId: data.funcionarioId
      });
      
      if (pagList.length > 0) {
        pagList.forEach(p => {
          const f = traduzirForma(p.forma || p.formaPagamento);
          paymentMethodsTotal[f] = (paymentMethodsTotal[f] || 0) + parseFloat(p.valor || 0);
        });
      } else {
        const f = traduzirForma(data.formaPagamento);
        paymentMethodsTotal[f] = (paymentMethodsTotal[f] || 0) + (valTotal || valTotalFinal);
      }
    }
  });
  
  console.log(`\nTotal sales since shift open (-1min): ${salesAfterShiftOpenCount}`);
  console.log("\n--- AGGREGATED TOTALS ---");
  console.log(`Sum of total: R$ ${totalCalculatedTotal.toFixed(2)}`);
  console.log(`Sum of totalFinal: R$ ${totalCalculatedTotalFinal.toFixed(2)}`);
  console.log("Aggregated payment methods:", paymentMethodsTotal);
  
  console.log("\n--- DETAILED SALES ---");
  console.log(JSON.stringify(paymentsDetails, null, 2));
}

run().catch(console.error);
