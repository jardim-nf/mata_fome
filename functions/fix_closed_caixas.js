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
  console.log("Starting correction of closed caixas...");
  
  const caixasRef = db.collection('caixas');
  const caixasSnap = await caixasRef.where('status', '==', 'fechado').get();
  
  console.log(`Found ${caixasSnap.size} closed caixas.`);
  
  for (const doc of caixasSnap.docs) {
    const caixaId = doc.id;
    const caixaData = doc.data();
    const estabId = caixaData.estabelecimentoId;
    
    if (!estabId) {
      console.log(`Skipping caixa ${caixaId} - no establishmentId`);
      continue;
    }
    
    const dataAbertura = caixaData.dataAbertura?.toDate ? caixaData.dataAbertura.toDate() : null;
    const dataFechamento = caixaData.dataFechamento?.toDate ? caixaData.dataFechamento.toDate() : null;
    
    if (!dataAbertura || !dataFechamento) {
      console.log(`Skipping caixa ${caixaId} - missing dates`);
      continue;
    }
    
    // We only recalculate caixas closed recently (e.g. June 2026 onwards) to avoid altering ancient history unnecessarily
    if (dataFechamento.getFullYear() < 2026) {
      console.log(`Skipping caixa ${caixaId} - ancient history (${dataFechamento.getFullYear()})`);
      continue;
    }
    
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing Caixa ID: ${caixaId} | Estab: ${estabId}`);
    console.log(`Abertura: ${dataAbertura.toISOString()} | Fechamento: ${dataFechamento.toISOString()}`);
    
    // 1. Fetch vendas in the interval
    const salesRef = db.collection('vendas');
    const salesSnap = await salesRef
      .where('estabelecimentoId', '==', estabId)
      .get();
      
    const salesMap = new Map();
    
    salesSnap.forEach(sDoc => {
      const sData = sDoc.data();
      if (sData.status === 'cancelado') return;
      
      const dateVal = sData.createdAt || sData.criadoEm || sData.data;
      const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
      
      if (parsedDate && parsedDate.getTime() >= (dataAbertura.getTime() - 60000) && parsedDate.getTime() <= dataFechamento.getTime()) {
        salesMap.set(sDoc.id, {
          id: sDoc.id,
          total: parseFloat(sData.total || sData.totalFinal || 0),
          troco: parseFloat(sData.troco || 0),
          pagamentos: sData.pagamentos || {},
          formaPagamento: sData.formaPagamento
        });
      }
    });
    
    // 2. Fetch delivery/balcão orders in subcollection in the interval
    const pedidosRef = db.collection('estabelecimentos').doc(estabId).collection('pedidos');
    const pedidosSnap = await pedidosRef.get();
    
    pedidosSnap.forEach(pDoc => {
      const sData = pDoc.data();
      if (sData.status === 'cancelado') return;
      
      const dateVal = sData.createdAt || sData.criadoEm || sData.data;
      const parsedDate = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
      
      if (parsedDate && parsedDate.getTime() >= (dataAbertura.getTime() - 60000) && parsedDate.getTime() <= dataFechamento.getTime()) {
        if (!isMesaDoc(sData)) {
          if (!salesMap.has(pDoc.id)) {
            salesMap.set(pDoc.id, {
              id: pDoc.id,
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
    console.log(`Found ${matchingSales.length} matching sales (vendas + pedidos) for this shift.`);
    
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
      suprimento: parseFloat(caixaData.resumoVendas?.suprimento || 0),
      sangria: parseFloat(caixaData.resumoVendas?.sangria || 0),
      detalhesMov: caixaData.resumoVendas?.detalhesMov || []
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
    
    // Recalculate drawer balance and diff
    const saldoInicial = parseFloat(caixaData.saldoInicial || 0);
    const saldoFinalInformado = parseFloat(caixaData.saldoFinalInformado || 0);
    
    const saldoIdealGaveta = saldoInicial + resumoVendas.suprimento + resumoVendas.dinheiro - resumoVendas.sangria;
    const diferenca = saldoFinalInformado - saldoIdealGaveta;
    
    console.log("OLD Resumo:", caixaData.resumoVendas);
    console.log("NEW Resumo:", resumoVendas);
    console.log(`Expected drawer: R$ ${saldoIdealGaveta.toFixed(2)} | Informado: R$ ${saldoFinalInformado.toFixed(2)} | Diff: R$ ${diferenca.toFixed(2)}`);
    
    // Update doc
    await doc.ref.update({
      resumoVendas,
      diferenca: Math.round(diferenca * 100) / 100
    });
    
    console.log("Updated successfully!");
  }
}

run().catch(console.error);
