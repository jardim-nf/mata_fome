const admin = require('firebase-admin');
const serviceAccount = require('../keys/serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {}

const db = admin.firestore();

async function run() {
  const usersSnap = await db.collection('usuarios').get();
  console.log(`Found ${usersSnap.size} users.`);
  
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    console.log(`\nUser ID: ${doc.id}`);
    console.log(`  nome: ${data.nome}`);
    console.log(`  email: ${data.email}`);
    console.log(`  cargo: ${data.cargo}`);
    console.log(`  isMasterAdmin: ${data.isMasterAdmin}`);
    console.log(`  isAdmin: ${data.isAdmin}`);
    console.log(`  estabelecimentos:`, data.estabelecimentos);
    console.log(`  estabelecimentosGerenciados:`, data.estabelecimentosGerenciados);
  }
}

run();
