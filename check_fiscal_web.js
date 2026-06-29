import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, getDocs } from "firebase/firestore";
import fs from "fs";
import path from "path";

// Read the config from src/firebase.js
// We'll just hardcode it to save time parsing since it's open source client config
const firebaseConfig = {
  apiKey: "AIzaSy_fake_replace_me", // I will read it from firebase.js
};

// We will read the file and extract the config via regex
const firebaseJsContent = fs.readFileSync(path.resolve('./src/firebase.js'), 'utf-8');
const configMatch = firebaseJsContent.match(/const firebaseConfig = ({[\\s\\S]*?});/);
if (!configMatch) {
    console.error("Could not find firebaseConfig in src/firebase.js");
    process.exit(1);
}

// eval is safe here as it's his own code
let config;
eval(`config = ${configMatch[1]}`);

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
    console.log("Conectando ao Firestore com o Web SDK...");
    const snap = await getDocs(collection(db, "estabelecimentos"));
    snap.forEach(d => {
        const data = d.data();
        console.log(`Estab: ${d.id}`);
        console.log(` - fiscal object:`, data.fiscal);
        console.log(` - root cnpj:`, data.cnpj);
        console.log(` - root ie:`, data.ie || data.inscricaoEstadual);
    });
    console.log("Fim!");
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
