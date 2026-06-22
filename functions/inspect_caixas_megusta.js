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
  const estabId = '2eNNjBwmDHUyLlYVnMSH'; // MeGusta
  console.log(`Listing caixas for MeGusta (${estabId})...`);
  
  const caixasSnap = await db.collection('caixas')
    .where('estabelecimentoId', '==', estabId)
    .get();
    
  console.log(`Found ${caixasSnap.size} caixas.`);
  
  const caixas = [];
  caixasSnap.forEach(doc => {
    caixas.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  // Sort by opening time
  caixas.sort((a, b) => {
    const tA = a.dataAbertura?.toDate ? a.dataAbertura.toDate().getTime() : 0;
    const tB = b.dataAbertura?.toDate ? b.dataAbertura.toDate().getTime() : 0;
    return tA - tB;
  });
  
  caixas.forEach(c => {
    const ab = c.dataAbertura?.toDate ? c.dataAbertura.toDate().toISOString() : 'N/A';
    const fech = c.dataFechamento?.toDate ? c.dataFechamento.toDate().toISOString() : 'N/A';
    console.log(`\nID: ${c.id} | status: ${c.status}`);
    console.log(`  Abertura: ${ab} | Fechamento: ${fech}`);
    console.log(`  Total Faturado: R$ ${c.resumoVendas?.total || 0} | Qtd: ${c.resumoVendas?.qtd || 0}`);
    console.log(`  Expected Drawer: R$ ${c.resumoVendas?.dinheiro || 0} | Informado: R$ ${c.saldoFinalInformado || 0}`);
  });
}

run().catch(console.error);
