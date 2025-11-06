// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const functions = getFunctions(app);

// Funções de autenticação
export const doCreateUserWithEmailAndPassword = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const doSignInWithEmailAndPassword = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const doSignOut = () => {
  return signOut(auth);
};

// Função para inicializar plataformas para um usuário
export const initializeUserPlatforms = async (userId) => {
  try {
    const platforms = [
      {
        id: 'ifood',
        name: 'iFood',
        type: 'ifood',
        userId: userId,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp Business', 
        type: 'whatsapp',
        userId: userId,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'rappi',
        name: 'Rappi',
        type: 'rappi',
        userId: userId,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'uberEats',
        name: 'Uber Eats',
        type: 'uberEats',
        userId: userId,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'website',
        name: 'Site Próprio',
        type: 'website',
        userId: userId,
        connected: true,
        syncStatus: 'connected',
        orders: 125,
        revenue: 12500,
        config: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const platform of platforms) {
      const platformRef = doc(db, 'platforms', platform.id);
      const platformDoc = await getDoc(platformRef);
      
      // Só cria se não existir
      if (!platformDoc.exists()) {
        await setDoc(platformRef, platform);
      }
    }

    return true;
  } catch (error) {
    console.error('Erro ao inicializar plataformas:', error);
    return false;
  }
};

export { app };