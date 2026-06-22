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
  const estabId = '2eNNjBwmDHUyLlYVnMSH';
  const start = new Date('2026-06-20T19:56:57.275Z');
  const end = new Date('2026-06-21T19:46:08.706Z');
  const userId = 'qPTo7FfB5ZPLzKrPVPgImTBJ0Oj1';
  
  console.log(`Analyzing sales for establishment: ${estabId}`);
  console.log(`Between ${start.toISOString()} and ${end.toISOString()}`);
  
  const salesRef = db.collection('vendas');
  const snapshot = await salesRef
    .where('estabelecimentoId', '==', estabId)
    .get();
  
  console.log(`Total sales found for establishment: ${snapshot.size}`);
  
  const allSales = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status === 'cancelado') return;
    
    const dateVal = data.createdAt || data.criadoEm || data.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (parsedDate && parsedDate.getTime() >= (start.getTime() - 60000) && parsedDate.getTime() <= end.getTime()) {
      allSales.push({
        id: doc.id,
        createdAt: parsedDate.toISOString(),
        total: parseFloat(data.total || data.totalFinal || 0),
        totalFinal: parseFloat(data.totalFinal || 0),
        usuarioId: data.usuarioId,
        funcionarioId: data.funcionarioId,
        pagamentos: data.pagamentos || {},
        formaPagamento: data.formaPagamento
      });
    }
  });
  
  console.log(`\nMatching sales in timeframe: ${allSales.length}`);
  
  // Group by:
  // 1. All sales
  // 2. Sales by userId
  
  const sumAll = { dinheiro: 0, pix: 0, debito: 0, credito: 0, total: 0, formasPagamento: {}, count: 0 };
  const sumUser = { dinheiro: 0, pix: 0, debito: 0, credito: 0, total: 0, formasPagamento: {}, count: 0 };
  
  allSales.forEach(s => {
    const val = s.total;
    const isUser = s.usuarioId === userId || s.funcionarioId === userId || !s.usuarioId;
    
    // Add to all
    sumAll.total += val;
    sumAll.count++;
    
    // Add to user
    if (isUser) {
      sumUser.total += val;
      sumUser.count++;
    }
    
    const pagList = Array.isArray(s.pagamentos) ? s.pagamentos : Object.values(s.pagamentos);
    if (pagList.length > 0) {
      pagList.forEach(p => {
        const f = traduzirForma(p.forma || p.formaPagamento);
        const valorPag = parseFloat(p.valor || 0);
        
        sumAll.formasPagamento[f] = (sumAll.formasPagamento[f] || 0) + valorPag;
        if (isUser) {
          sumUser.formasPagamento[f] = (sumUser.formasPagamento[f] || 0) + valorPag;
        }
      });
    } else {
      const f = traduzirForma(s.formaPagamento);
      sumAll.formasPagamento[f] = (sumAll.formasPagamento[f] || 0) + val;
      if (isUser) {
        sumUser.formasPagamento[f] = (sumUser.formasPagamento[f] || 0) + val;
      }
    }
  });
  
  console.log("\n==================================================");
  console.log("ALL USERS SALES SUMMARY");
  console.log("==================================================");
  console.log(`Count: ${sumAll.count}`);
  console.log(`Total: R$ ${sumAll.total.toFixed(2)}`);
  console.log(`Formas de Pagamento:`, sumAll.formasPagamento);
  
  console.log("\n==================================================");
  console.log(`USER ${userId} SALES SUMMARY`);
  console.log("==================================================");
  console.log(`Count: ${sumUser.count}`);
  console.log(`Total: R$ ${sumUser.total.toFixed(2)}`);
  console.log(`Formas de Pagamento:`, sumUser.formasPagamento);
}

run().catch(console.error);
