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
        'crediário': 'Crediário',
        'credito': 'Cartão de Crédito',
        'crédito': 'Cartão de Crédito',
        'debito': 'Cartão de Débito',
        'débito': 'Cartão de Débito'
    };
    return mapa[m] || metodo.charAt(0).toUpperCase() + metodo.slice(1);
};

async function run() {
  const estabId = '2eNNjBwmDHUyLlYVnMSH'; // MeGusta
  const shiftId = 'oz9w0MPIUbqOpphYg7ux';
  
  const shiftDoc = await db.collection('caixas').doc(shiftId).get();
  const shift = shiftDoc.data();
  
  // Let's assume we change start date to June 20 at 00:00 local time (2026-06-20T03:00:00Z)
  const start = new Date('2026-06-20T03:00:00Z');
  const end = shift.dataFechamento.toDate();
  
  console.log(`Analyzing sales for potential shift extension:`);
  console.log(`New Start: ${start.toISOString()}`);
  console.log(`End: ${end.toISOString()}`);
  
  const salesSnap = await db.collection('vendas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  let count = 0;
  let total = 0;
  const paymentMethodsTotal = {};
  
  salesSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    if (!parsedDate) return;
    
    const time = parsedDate.getTime();
    if (time >= start.getTime() && time <= end.getTime()) {
      count++;
      const valVendaFinal = parseFloat(data.total || data.totalFinal || 0);
      total += valVendaFinal;
      
      const pagList = Array.isArray(data.pagamentos) ? data.pagamentos : Object.values(data.pagamentos || {});
      if (pagList.length > 0) {
        const totalPagos = pagList.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
        let trocoDisponivel = totalPagos > valVendaFinal ? parseFloat(data.troco || 0) : 0;
        
        pagList.forEach(p => {
          const fOriginal = p.forma || p.formaPagamento || '';
          const fTraduzida = traduzirForma(fOriginal);
          let val = parseFloat(p.valor || 0);
          
          if (fTraduzida === 'Dinheiro') {
            const valorEfetivo = Math.max(0, val - trocoDisponivel);
            paymentMethodsTotal[fTraduzida] = (paymentMethodsTotal[fTraduzida] || 0) + valorEfetivo;
            trocoDisponivel = Math.max(0, trocoDisponivel - val);
          } else {
            paymentMethodsTotal[fTraduzida] = (paymentMethodsTotal[fTraduzida] || 0) + val;
          }
        });
      } else {
        const fOriginal = data.formaPagamento || '';
        const fTraduzida = traduzirForma(fOriginal);
        paymentMethodsTotal[fTraduzida] = (paymentMethodsTotal[fTraduzida] || 0) + valVendaFinal;
      }
    }
  });
  
  console.log(`\n=== EXTENDED SHIFT TOTALS ===`);
  console.log(`Sales count: ${count}`);
  console.log(`Total faturado: R$ ${total.toFixed(2)}`);
  console.log(`Payment methods distribution:`, paymentMethodsTotal);
}

run().catch(console.error);
