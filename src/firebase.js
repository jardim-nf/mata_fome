// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
  measurementId: import.meta.env.VITE_MEASUREMENT_ID
};

// Inicialização do Firebase
const app = initializeApp(firebaseConfig);

// Serviços do Firebase
export const auth = getAuth(app);

// Usando cache em memória para evitar erro de corrupção do IndexedDB
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
});

export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const functions = getFunctions(app, 'us-central1');

// Configuração para desenvolvimento (emulator)
if (import.meta.env.DEV) {
  console.log('🔥 Firebase running in development mode');
}

export default app;