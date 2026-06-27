// functions/check_whatsapp_configs.js
import admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: 'matafome-98455'
  });
}

const db = admin.firestore();

async function checkConfigs() {
  try {
    const snap = await db.collection('estabelecimentos').get();
    console.log(`Found ${snap.size} establishments:`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log(`\nID: ${doc.id}`);
      console.log(`Nome: ${data.nome}`);
      console.log(`WhatsApp Config:`, JSON.stringify(data.whatsapp || {}, null, 2));
    });
  } catch (error) {
    console.error('Error checking configs:', error);
  }
}

checkConfigs();
