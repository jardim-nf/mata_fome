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
  console.log("Fetching caixas via Admin SDK...");
  const caixasRef = db.collection('caixas');
  const snapshot = await caixasRef.orderBy('dataAbertura', 'desc').limit(5).get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const dataAbertura = data.dataAbertura?.toDate ? data.dataAbertura.toDate() : null;
    const dataFechamento = data.dataFechamento?.toDate ? data.dataFechamento.toDate() : null;
    console.log(`Caixa ID: ${doc.id}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  EstabelecimentoId: ${data.estabelecimentoId}`);
    console.log(`  UsuarioId: ${data.usuarioId}`);
    console.log(`  Abertura: ${dataAbertura ? dataAbertura.toISOString() : 'N/A'}`);
    console.log(`  Fechamento: ${dataFechamento ? dataFechamento.toISOString() : 'N/A'}`);
    console.log(`  Saldo Inicial: ${data.saldoInicial}`);
    console.log(`  Resumo:`, data.resumoVendas);
  });
}

run().catch(console.error);
