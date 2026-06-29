const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // Assuming it exists, or just use default

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function run() {
  const pedidoRef = db.doc('estabelecimentos/u9VAwlHNqy1Q3WINAcQG/pedidos/WwZPiR49xgMb4SlMhWDJ');
  await pedidoRef.update({
    fiscal: admin.firestore.FieldValue.delete()
  });
  console.log("Pedido WwZPiR49xgMb4SlMhWDJ resetado!");
}
run().catch(console.error);
