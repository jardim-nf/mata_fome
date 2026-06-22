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
  console.log("Analyzing Firestore sales for June 21, 2026...");
  
  const salesRef = db.collection('vendas');
  
  const start = new Date("2026-06-21T00:00:00Z");
  const end = new Date("2026-06-21T23:59:59Z");
  
  const snapshot = await salesRef
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(end))
    .get();
    
  console.log(`Total sales on 2026-06-21: ${snapshot.size}`);
  
  let totalBefore9 = 0;
  let totalAfter9 = 0;
  
  const paymentsBefore9 = {};
  const paymentsAfter9 = {};
  const paymentsTotalDay = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return; // Ignore cancelled
    
    const created = data.createdAt.toDate();
    const isBefore9 = created.getUTCHours() < 9;
    
    const valVendaFinal = parseFloat(data.total || data.totalFinal || 0);
    
    if (isBefore9) {
      totalBefore9 += valVendaFinal;
    } else {
      totalAfter9 += valVendaFinal;
    }
    
    // Parse payments list
    const pagamentosLista = Array.isArray(data.pagamentos)
        ? data.pagamentos
        : (data.pagamentos && typeof data.pagamentos === 'object' ? Object.values(data.pagamentos) : []);
        
    if (pagamentosLista.length > 0) {
        const totalPagos = pagamentosLista.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
        let trocoDisponivel = totalPagos > valVendaFinal ? parseFloat(data.troco || 0) : 0;
        
        pagamentosLista.forEach(p => {
            const fOriginal = p.forma || p.formaPagamento || '';
            const fTraduzida = traduzirForma(fOriginal);
            let val = parseFloat(p.valor || 0);
            
            if (fTraduzida === 'Dinheiro') {
                val = Math.max(0, val - trocoDisponivel);
                trocoDisponivel = Math.max(0, trocoDisponivel - p.valor);
            }
            
            // Add to maps
            if (isBefore9) {
                paymentsBefore9[fTraduzida] = (paymentsBefore9[fTraduzida] || 0) + val;
            } else {
                paymentsAfter9[fTraduzida] = (paymentsAfter9[fTraduzida] || 0) + val;
            }
            paymentsTotalDay[fTraduzida] = (paymentsTotalDay[fTraduzida] || 0) + val;
        });
    } else {
        const fOriginal = data.formaPagamento || '';
        const fTraduzida = traduzirForma(fOriginal);
        
        if (isBefore9) {
            paymentsBefore9[fTraduzida] = (paymentsBefore9[fTraduzida] || 0) + valVendaFinal;
        } else {
            paymentsAfter9[fTraduzida] = (paymentsAfter9[fTraduzida] || 0) + valVendaFinal;
        }
        paymentsTotalDay[fTraduzida] = (paymentsTotalDay[fTraduzida] || 0) + valVendaFinal;
    }
  });
  
  console.log("\n--- FINANCIAL DAY SUMMARY (June 21 after 09:00 UTC) ---");
  console.log(`Total sales: R$ ${totalAfter9.toFixed(2)}`);
  console.log("Payments detail:", paymentsAfter9);
  
  console.log("\n--- BEFORE 09:00 UTC SUMMARY (Financial June 20) ---");
  console.log(`Total sales: R$ ${totalBefore9.toFixed(2)}`);
  console.log("Payments detail:", paymentsBefore9);
  
  console.log("\n--- FULL CALENDAR DAY SUMMARY (All of June 21) ---");
  console.log(`Total sales: R$ ${(totalBefore9 + totalAfter9).toFixed(2)}`);
  console.log("Payments detail:", paymentsTotalDay);
}

run().catch(console.error);
