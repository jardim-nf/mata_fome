const admin = require('firebase-admin');
const serviceAccount = require('../keys/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  try {
    const docRef = db.collection('caixas').doc('AJlpwDiHaHJUMug6LNa3');
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.log("Error: Document AJlpwDiHaHJUMug6LNa3 does not exist.");
      return;
    }
    
    console.log("Current document data:");
    console.log(JSON.stringify(docSnap.data(), null, 2));

    const total = 8958.60;
    const dinheiro = 4489.80;
    const pix = 488.40;
    const debito = 1432.20;
    const credito = 2548.20;
    const outros = pix + debito + credito; // 4468.80
    const qtd = 31;

    console.log("\nUpdating fields to match 12/06/2026 totals:");
    console.log(`Total: R$ ${total}`);
    console.log(`Dinheiro: R$ ${dinheiro}`);
    console.log(`Pix: R$ ${pix}`);
    console.log(`Debito: R$ ${debito}`);
    console.log(`Credito: R$ ${credito}`);
    console.log(`Outros: R$ ${outros}`);
    console.log(`Qtd: ${qtd}`);

    const currentData = docSnap.data();
    const saldoInicial = Number(currentData.saldoInicial || 0);
    const suprimento = Number(currentData.resumoVendas?.suprimento || 0);
    const sangria = Number(currentData.resumoVendas?.sangria || 0);
    
    const saldoEsperado = saldoInicial + dinheiro + suprimento - sangria;
    const saldoFinalInformado = saldoEsperado;

    await docRef.update({
      resumoVendas: {
        total,
        dinheiro,
        pix,
        debito,
        credito,
        outros,
        qtd,
        suprimento,
        sangria,
        detalhesMov: currentData.resumoVendas?.detalhesMov || []
      },
      saldoFinalInformado: saldoEsperado,
      diferenca: 0
    });

    console.log("Update completed successfully!");

    // Print updated data
    const updatedSnap = await docRef.get();
    console.log("\nUpdated document data:");
    console.log(JSON.stringify(updatedSnap.data(), null, 2));

  } catch (error) {
    console.error("Error updating document:", error);
  }
}

run();
