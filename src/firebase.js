// src/firebase.js
// Importe as funções necessárias do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Para autenticação
import { getFirestore } from 'firebase/firestore'; // Para o Firestore Database


const firebaseConfig = {
  apiKey: 'AIzaSyDC1qtoweF5dlV_nx1PSLCK291Pv9KNGkg',
  authDomain: 'matafome-9413b.firebaseapp.com',
  databaseURL: 'https://matafome-9413b-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'matafome-9413b',
  storageBucket: 'matafome-9413b.appspot.com',
  messagingSenderId: '315880064175',
  appId: '1:315880064175:web:22f3c0b9714b7b1ca5c05a'
};
// Inicialize o aplicativo Firebase
const app = initializeApp(firebaseConfig);

// Obtenha e exporte as instâncias dos serviços que você vai usar
// <<-- EXPORTAÇÕES NOMEADAS PARA AUTH E DB SÃO CRUCIAIS AQUI -->>
export const auth = getAuth(app); // Exporta a instância de autenticação
export const db = getFirestore(app)

