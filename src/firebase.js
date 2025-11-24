// src/firebase.js
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile 
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAnalytics, logEvent } from 'firebase/analytics';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
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
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);
export const functions = getFunctions(app);

// Configuração para desenvolvimento (emulator)
if (import.meta.env.DEV) {
  console.log('🔥 Firebase running in development mode');
  // Descomente se estiver usando emuladores
  // connectFunctionsEmulator(functions, 'localhost', 5001);
  // connectFirestoreEmulator(db, 'localhost', 8080);
  // connectAuthEmulator(auth, 'http://localhost:9099');
}

// Funções de autenticação
export const doCreateUserWithEmailAndPassword = async (email, password, displayName = '') => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  // Atualizar perfil com displayName se fornecido
  if (displayName) {
    await updateProfile(userCredential.user, {
      displayName: displayName
    });
  }
  
  return userCredential;
};

export const doSignInWithEmailAndPassword = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const doSignOut = () => {
  return signOut(auth);
};

// Função para obter dados do usuário do Firestore
export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', userId));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    return null;
  }
};

// Função para inicializar plataformas para um usuário (melhorada)
export const initializeUserPlatforms = async (userId, userEmail) => {
  try {
    const platforms = [
      {
        id: `ifood_${userId}`,
        name: 'iFood',
        type: 'ifood',
        userId: userId,
        userEmail: userEmail,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        credentials: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `whatsapp_${userId}`,
        name: 'WhatsApp Business', 
        type: 'whatsapp',
        userId: userId,
        userEmail: userEmail,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        credentials: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `rappi_${userId}`,
        name: 'Rappi',
        type: 'rappi',
        userId: userId,
        userEmail: userEmail,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        credentials: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `uberEats_${userId}`,
        name: 'Uber Eats',
        type: 'uberEats',
        userId: userId,
        userEmail: userEmail,
        connected: false,
        syncStatus: 'disconnected',
        orders: 0,
        revenue: 0,
        config: {},
        credentials: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: `website_${userId}`,
        name: 'Site Próprio',
        type: 'website',
        userId: userId,
        userEmail: userEmail,
        connected: true,
        syncStatus: 'connected',
        orders: 125,
        revenue: 12500,
        config: {
          url: '',
          integrationType: 'manual'
        },
        credentials: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const creationPromises = platforms.map(async (platform) => {
      try {
        const platformRef = doc(db, 'platforms', platform.id);
        await setDoc(platformRef, platform);
        console.log(`✅ Plataforma ${platform.name} inicializada para usuário ${userId}`);
        return { success: true, platform: platform.name };
      } catch (error) {
        console.error(`❌ Erro ao criar plataforma ${platform.name}:`, error);
        return { success: false, platform: platform.name, error };
      }
    });

    const results = await Promise.all(creationPromises);
    const successful = results.filter(result => result.success).length;
    
    console.log(`📊 Plataformas inicializadas: ${successful}/${platforms.length} para usuário ${userId}`);
    
    return {
      success: successful === platforms.length,
      total: platforms.length,
      created: successful,
      details: results
    };

  } catch (error) {
    console.error('❌ Erro crítico ao inicializar plataformas:', error);
    
    // Log do erro no Analytics
    logEvent(analytics, 'platform_initialization_error', {
      userId: userId,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
};

// Função para inicializar dados do usuário no Firestore
export const initializeUserData = async (userId, userData) => {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      const defaultUserData = {
        email: userData.email,
        displayName: userData.displayName || '',
        isAdmin: userData.isAdmin || false,
        isMasterAdmin: userData.isMasterAdmin || false,
        estabelecimentosGerenciados: userData.estabelecimentosGerenciados || [],
        ativo: true,
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString(),
        preferences: {
          notifications: true,
          emailUpdates: true,
          theme: 'light'
        },
        stats: {
          totalOrders: 0,
          totalRevenue: 0,
          activePlatforms: 1 // Site próprio vem ativo por padrão
        }
      };
      
      await setDoc(userRef, defaultUserData);
      console.log('✅ Dados do usuário inicializados no Firestore');
      
      // Inicializar plataformas
      await initializeUserPlatforms(userId, userData.email);
      
      return defaultUserData;
    }
    
    return userDoc.data();
  } catch (error) {
    console.error('❌ Erro ao inicializar dados do usuário:', error);
    throw error;
  }
};

// Função utilitária para logging de eventos
export const logAnalyticsEvent = (eventName, eventParams = {}) => {
  if (typeof window !== 'undefined') {
    logEvent(analytics, eventName, eventParams);
  }
};

// Exportação padrão
export default app;