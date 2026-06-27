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
  const usersSnap = await db.collection('usuarios').get();
  console.log(`Found ${usersSnap.size} total users. Searching for Matafome related users...`);
  
  usersSnap.forEach(doc => {
    const data = doc.data();
    const email = (data.email || '').toLowerCase();
    const nome = (data.nome || '').toLowerCase();
    
    const matchesEmail = email.includes('matafome') || email.includes('burguer') || email.includes('admin');
    const matchesNome = nome.includes('matafome') || nome.includes('burguer');
    
    // Check if user manages matafome establishment
    const managesMatafome = Array.isArray(data.estabelecimentosGerenciados) && data.estabelecimentosGerenciados.includes('u9VAwlHNqy1Q3WINAcQG');
    
    if (matchesEmail || matchesNome || managesMatafome) {
      console.log(`\nUser ID: ${doc.id}`);
      console.log(`  nome: ${data.nome}`);
      console.log(`  email: ${data.email}`);
      console.log(`  cargo: ${data.cargo}`);
      console.log(`  isAdmin: ${data.isAdmin}`);
      console.log(`  isMasterAdmin: ${data.isMasterAdmin}`);
      console.log(`  estabelecimentosGerenciados:`, data.estabelecimentosGerenciados);
    }
  });
}

run().catch(console.error);
