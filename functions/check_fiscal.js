import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('/Users/matheusjardim/Documents/Documentos - MacBook Pro de Matheus/matafome-landing-atualizado/functions/matafome-98455-firebase-adminsdk-hskle-7917228800.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkFiscalData() {
  const estabRef = db.collection('estabelecimentos');
  const snap = await estabRef.get();
  
  snap.forEach(doc => {
      const data = doc.data();
      console.log(`Estabelecimento: ${doc.id}`);
      console.log('Fiscal Data:', data.fiscal);
      console.log('CNPJ no objeto raiz?', data.cnpj);
      console.log('IE no objeto raiz?', data.ie || data.inscricaoEstadual);
      console.log('-------------------');
  });
}

checkFiscalData().then(() => process.exit(0)).catch(console.error);
