
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDC1qtoweF5dlV_nx1PSLCK291Pv9KNGkg",
  authDomain: "matafome-9413b.firebaseapp.com",
  databaseURL: "https://matafome-9413b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "matafome-9413b",
  storageBucket: "matafome-9413b.firebasestorage.app",
  messagingSenderId: "315880064175",
  appId: "1:315880064175:web:22f3c0b9714b7b1ca5c05a",
  measurementId: "G-SKXD29NM1J"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
