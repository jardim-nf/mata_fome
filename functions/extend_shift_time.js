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

const isMesaDoc = (data) => data.tipo === 'mesa' || data.origem === 'mesa' || data.source === 'salao' || !!data.mesaNumero || !!data.numeroMesa;

async function run() {
  const shiftId = 'oz9w0MPIUbqOpphYg7ux';
  const newAbertura = new Date('2026-06-20T03:00:00.000Z'); // June 20, 00:00 local time
  
  console.log(`Updating shift ${shiftId} opening time to ${newAbertura.toISOString()} (exact match)...`);
  
  const shiftRef = db.collection('caixas').doc(shiftId);
  const shiftDoc = await shiftRef.get();
  
  if (!shiftDoc.exists) {
    console.log("Shift not found!");
    return;
  }
  
  const shiftData = shiftDoc.data();
  const estabId = shiftData.estabelecimentoId;
  const end = shiftData.dataFechamento.toDate();
  
  // 1. Query vendas in timeframe
  const vendasSnap = await db.collection('vendas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  const salesMap = new Map();
  
  vendasSnap.forEach(doc => {
    const sData = doc.data();
    if (sData.status === 'cancelado') return;
    
    const dateVal = sData.createdAt || sData.criadoEm || sData.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (parsedDate && parsedDate.getTime() >= newAbertura.getTime() && parsedDate.getTime() <= end.getTime()) {
      salesMap.set(doc.id, {
        id: doc.id,
        total: parseFloat(sData.total || sData.totalFinal || 0),
        troco: parseFloat(sData.troco || 0),
        pagamentos: sData.pagamentos || {},
        formaPagamento: sData.formaPagamento
      });
    }
  });
  
  // 2. Query delivery/balcão orders in subcollection in timeframe
  const pedidosRef = db.collection('estabelecimentos').doc(estabId).collection('pedidos');
  const pedidosSnap = await pedidosRef.get();
  
  pedidosSnap.forEach(doc => {
    const sData = doc.data();
    if (sData.status === 'cancelado') return;
    
    const dateVal = sData.createdAt || sData.criadoEm || sData.data;
    const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
    
    if (parsedDate && parsedDate.getTime() >= newAbertura.getTime() && parsedDate.getTime() <= end.getTime()) {
      if (!isMesaDoc(sData)) {
        if (!salesMap.has(doc.id)) {
          salesMap.set(doc.id, {
            id: doc.id,
            total: parseFloat(sData.total || sData.totalFinal || 0),
            troco: parseFloat(sData.troco || 0),
            pagamentos: sData.pagamentos || {},
            formaPagamento: sData.formaPagamento
          });
        }
      }
    }
  });
  
  const matchingSales = Array.from(salesMap.values());
  console.log(`Found ${matchingSales.length} sales (vendas + pedidos) in the updated shift interval.`);
  
  // Recalculate resumoVendas
  const resumoVendas = {
    dinheiro: 0,
    pix: 0,
    debito: 0,
    credito: 0,
    total: 0,
    formasPagamento: {},
    qtd: matchingSales.length,
    outros: 0,
    suprimento: parseFloat(shiftData.resumoVendas?.suprimento || 0),
    sangria: parseFloat(shiftData.resumoVendas?.sangria || 0),
    detalhesMov: shiftData.resumoVendas?.detalhesMov || []
  };
  
  matchingSales.forEach(v => {
    const valVendaFinal = v.total;
    resumoVendas.total += valVendaFinal;
    
    const pagList = Array.isArray(v.pagamentos) ? v.pagamentos : Object.values(v.pagamentos);
    if (pagList.length > 0) {
      const totalPagos = pagList.reduce((acc, curr) => acc + parseFloat(curr.valor || 0), 0);
      let trocoDisponivel = totalPagos > valVendaFinal ? v.troco : 0;
      
      pagList.forEach(p => {
        const fOriginal = p.forma || p.formaPagamento || '';
        const fTraduzida = traduzirForma(fOriginal);
        let val = parseFloat(p.valor || 0);
        
        if (fTraduzida === 'Dinheiro') {
          const valorEfetivo = Math.max(0, val - trocoDisponivel);
          resumoVendas.dinheiro += valorEfetivo;
          resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + valorEfetivo;
          trocoDisponivel = Math.max(0, trocoDisponivel - val);
        } else {
          if (fTraduzida === 'PIX' || fTraduzida === 'PIX Manual') {
            resumoVendas.pix += val;
          } else if (fTraduzida === 'Cartão de Crédito') {
            resumoVendas.credito += val;
          } else if (fTraduzida === 'Cartão de Débito' || fTraduzida === 'Cartão') {
            resumoVendas.debito += val;
          }
          resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + val;
        }
      });
    } else {
      const fOriginal = v.formaPagamento || '';
      const fTraduzida = traduzirForma(fOriginal);
      resumoVendas.formasPagamento[fTraduzida] = (resumoVendas.formasPagamento[fTraduzida] || 0) + valVendaFinal;
      
      if (fTraduzida === 'Dinheiro') {
        resumoVendas.dinheiro += valVendaFinal;
      } else if (fTraduzida === 'PIX' || fTraduzida === 'PIX Manual') {
        resumoVendas.pix += valVendaFinal;
      } else if (fTraduzida === 'Cartão de Crédito') {
        resumoVendas.credito += valVendaFinal;
      } else if (fTraduzida === 'Cartão de Débito' || fTraduzida === 'Cartão') {
        resumoVendas.debito += valVendaFinal;
      }
    }
  });
  
  resumoVendas.outros = resumoVendas.pix + resumoVendas.debito + resumoVendas.credito;
  
  // Round to 2 decimals
  resumoVendas.dinheiro = Math.round(resumoVendas.dinheiro * 100) / 100;
  resumoVendas.pix = Math.round(resumoVendas.pix * 100) / 100;
  resumoVendas.debito = Math.round(resumoVendas.debito * 100) / 100;
  resumoVendas.credito = Math.round(resumoVendas.credito * 100) / 100;
  resumoVendas.total = Math.round(resumoVendas.total * 100) / 100;
  resumoVendas.outros = Math.round(resumoVendas.outros * 100) / 100;
  
  Object.keys(resumoVendas.formasPagamento).forEach(k => {
    resumoVendas.formasPagamento[k] = Math.round(resumoVendas.formasPagamento[k] * 100) / 100;
  });
  
  const saldoInicial = parseFloat(shiftData.saldoInicial || 0);
  const saldoFinalInformado = parseFloat(shiftData.saldoFinalInformado || 0);
  const saldoIdealGaveta = saldoInicial + resumoVendas.suprimento + resumoVendas.dinheiro - resumoVendas.sangria;
  const diferenca = saldoFinalInformado - saldoIdealGaveta;
  
  console.log("New Resumo:", resumoVendas);
  console.log(`Expected drawer: R$ ${saldoIdealGaveta.toFixed(2)} | Informado: R$ ${saldoFinalInformado.toFixed(2)} | Diff: R$ ${diferenca.toFixed(2)}`);
  
  console.log("Updating Firestore document...");
  await shiftRef.update({
    dataAbertura: admin.firestore.Timestamp.fromDate(newAbertura),
    resumoVendas,
    diferenca: Math.round(diferenca * 100) / 100
  });
  
  console.log("Successfully updated shift and recalculated all values!");
}

run().catch(console.error);
