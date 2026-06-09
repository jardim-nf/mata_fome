// ARQUIVO: verificarItens.js

const admin = require('firebase-admin');

// ▼▼▼ COLOQUE O CAMINHO PARA SEU ARQUIVO DE CHAVE AQUI ▼▼▼
const serviceAccount = require('./src/chave-firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verificarItens() {
  console.log('Iniciando o script "detetive"...');
  console.log('Buscando todos os itens para verificação...');

  const itensSnapshot = await db.collectionGroup('itens').get();

  if (itensSnapshot.empty) {
    console.log('Nenhum item encontrado no banco de dados.');
    return;
  }

  const itensComProblema = [];

  // Loop para verificar cada item
  for (const doc of itensSnapshot.docs) {
    const itemData = doc.data();

    // Se o campo 'estabelecimentoId' NÃO EXISTIR, adiciona à lista de problemas.
    if (!itemData.estabelecimentoId) {
      itensComProblema.push(doc.ref.path);
    }
  }

  // Mostra o resultado final
  if (itensComProblema.length > 0) {
    console.error(`\n🚨 ATENÇÃO: Foram encontrados ${itensComProblema.length} itens com problema! 🚨`);
    console.error('Os seguintes itens estão sem o campo "estabelecimentoId":');
    itensComProblema.forEach(path => {
      console.warn(`  - ${path}`);
    });
    console.error('\nPor favor, vá até esses documentos no Firestore e adicione o campo "estabelecimentoId" manualmente.');
  } else {
    console.log(`\n🎉 Verificação concluída! Todos os ${itensSnapshot.size} itens estão corretos e possuem o campo "estabelecimentoId".`);
  }
}

verificarItens().catch(console.error);