const admin = require('firebase-admin');
const serviceAccount = require('../keys/serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {}

const db = admin.firestore();

function formatarTelefoneBR(digitos) {
  const clean = digitos.replace(/\D/g, '');
  const sem55 = clean.startsWith('55') && clean.length > 10 ? clean.slice(2) : clean;
  if (sem55.length === 11) {
    return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 7)}-${sem55.slice(7)}`;
  } else if (sem55.length === 10) {
    return `(${sem55.slice(0, 2)}) ${sem55.slice(2, 6)}-${sem55.slice(6)}`;
  }
  return sem55;
}

async function buscarNomeCliente(estabelecimentoId, telefone) {
  try {
    const digitos = telefone.replace(/\D/g, '').replace('cus', '').replace('swhatsappnet', '');
    const sem55 = digitos.startsWith('55') && digitos.length > 10 ? digitos.slice(2) : digitos;
    const com55 = digitos.startsWith('55') ? digitos : `55${digitos}`;
    
    const formats = [
      telefone,
      digitos,
      sem55,
      com55,
      formatarTelefoneBR(sem55),
      formatarTelefoneBR(digitos),
      formatarTelefoneBR(sem55).replace('-', ' '),
      formatarTelefoneBR(sem55).replace('-', ''),
      formatarTelefoneBR(sem55).replace('(', '').replace(')', '').trim(),
    ];
    const uniqueFormats = [...new Set(formats.filter(f => f))];
    console.log("Searching formats:", uniqueFormats);

    // 1. Tentar na subcoleção clientes por ID
    for (const fmt of [digitos, sem55, com55]) {
      const docRef = db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('clientes').doc(fmt);
      const docSnap = await docRef.get();
      if (docSnap.exists && docSnap.data().nome) {
        console.log(`FOUND in subcollection by ID (${fmt}):`, docSnap.data().nome);
        return docSnap.data().nome;
      }
    }

    // 2. Tentar na subcoleção clientes por query
    const subQuery = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes')
      .where('telefone', 'in', uniqueFormats)
      .limit(1)
      .get();
    if (!subQuery.empty) {
      const data = subQuery.docs[0].data();
      console.log("FOUND in subcollection by query:", data.nome);
      return data.nome;
    }

    // 3. Tentar na coleção raiz clientes por query
    const rootQuery = await db.collection('clientes')
      .where('telefone', 'in', uniqueFormats)
      .limit(1)
      .get();
    if (!rootQuery.empty) {
      const data = rootQuery.docs[0].data();
      console.log("FOUND in root collection by query:", data.nome);
      return data.nome;
    }

    // 4. Fallback para pedidos anteriores
    const pedidosQuery = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos')
      .where('clienteTelefone', 'in', uniqueFormats)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (!pedidosQuery.empty) {
      const data = pedidosQuery.docs[0].data();
      console.log("FOUND in pedidos fallback:", data.clienteNome);
      return data.clienteNome;
    }

    console.log("NOT FOUND ANYWHERE");
    return null;
  } catch (e) {
    console.error("Error lookup:", e);
    return null;
  }
}

async function run() {
  const estabId = "u9VAwlHNqy1Q3WINAcQG"; // Mata Fome
  // Test with Matheus phone
  await buscarNomeCliente(estabId, "5522998102575");
  // Test with formatting
  await buscarNomeCliente(estabId, "22998102575");
}

run();
