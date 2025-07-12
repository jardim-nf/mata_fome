// src/firebase.js
import { initializeApp } from 'firebase/app'; // Importação correta
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDC1qtoweF5dlV_nx1PSLCK291Pv9KNGkg",
  authDomain: "matafome-9413b.firebaseapp.com",
  // databaseURL não é estritamente necessário para Firestore, mas não atrapalha
  databaseURL: "https://matafome-9413b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "matafome-9413b",
  storageBucket: "matafome-9413b.firebasestorage.app",
  messagingSenderId: "315880064175",
  appId: "1:315880064175:web:22f3c0b9714b7b1ca5c05a",
  measurementId: "G-SKXD29NM1J"
};

// VOCCÊ PRECISA DESSA LINHA AQUI!
const app = initializeApp(firebaseConfig); // Inicializa o aplicativo Firebase e atribui à variável 'app'

// Agora 'app' está definido e pode ser usado para inicializar os serviços
const auth = getAuth(app); // Para autenticação
const db = getFirestore(app); // Para o Firestore Database

export { auth, db };