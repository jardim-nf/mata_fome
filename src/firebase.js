// src/firebase.js
// Importe as funções necessárias do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Para autenticação
import { getFirestore } from 'firebase/firestore'; // Para o Firestore Database
import { getStorage } from 'firebase/storage'; // Para o Firebase Storage
import { getAnalytics } from 'firebase/analytics'; // Para o Google Analytics


const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Inicialize o aplicativo Firebase
const app = initializeApp(firebaseConfig);

// Obtenha e exporte as instâncias dos serviços que você vai usar
export const auth = getAuth(app); // Exporta a instância de autenticação
export const db = getFirestore(app); // Exporta a instância do Firestore
export const storage = getStorage(app); // Exporta a instância do Storage
export const analytics = getAnalytics(app); // Exporta a instância do Analytics

// EXPORTE 'app' AQUI!
export { app }; // <--- ADICIONADO: Exporta a instância do app Firebase