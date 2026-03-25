// src/services/userService.js
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { logEvent } from 'firebase/analytics';
import { db, analytics } from '../firebase';

/**
 * Busca dados de um usuário no Firestore
 */
export const getUserData = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'usuarios', userId));
    return userDoc.exists() ? userDoc.data() : null;
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error);
    return null;
  }
};

/**
 * Inicializa plataformas padrão para um novo usuário
 */
export const initializeUserPlatforms = async (userId, userEmail) => {
  try {
    const platformTypes = [
      { type: 'ifood', name: 'iFood', connected: false, syncStatus: 'disconnected' },
      { type: 'whatsapp', name: 'WhatsApp Business', connected: false, syncStatus: 'disconnected' },
      { type: 'rappi', name: 'Rappi', connected: false, syncStatus: 'disconnected' },
      { type: 'uberEats', name: 'Uber Eats', connected: false, syncStatus: 'disconnected' },
      { type: 'website', name: 'Site Próprio', connected: true, syncStatus: 'connected', config: { url: '', integrationType: 'manual' } },
    ];

    const now = new Date().toISOString();

    const creationPromises = platformTypes.map(async (pt) => {
      const platform = {
        id: `${pt.type}_${userId}`,
        name: pt.name,
        type: pt.type,
        userId,
        userEmail,
        connected: pt.connected,
        syncStatus: pt.syncStatus,
        orders: 0,
        revenue: 0,
        config: pt.config || {},
        credentials: {},
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(doc(db, 'platforms', platform.id), platform);
        return { success: true, platform: platform.name };
      } catch (error) {
        console.error(`❌ Erro ao criar plataforma ${platform.name}:`, error);
        return { success: false, platform: platform.name, error };
      }
    });

    const results = await Promise.all(creationPromises);
    const successful = results.filter(r => r.success).length;

    return {
      success: successful === platformTypes.length,
      total: platformTypes.length,
      created: successful,
      details: results
    };
  } catch (error) {
    console.error('❌ Erro crítico ao inicializar plataformas:', error);
    logEvent(analytics, 'platform_initialization_error', { userId, error: error.message });
    return { success: false, error: error.message };
  }
};

/**
 * Inicializa dados do usuário no Firestore (cria se não existir)
 */
export const initializeUserData = async (userId, userData) => {
  try {
    const userRef = doc(db, 'usuarios', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const defaultUserData = {
        email: userData.email,
        displayName: userData.displayName || '',
        isAdmin: false,
        isMasterAdmin: false,
        estabelecimentosGerenciados: userData.estabelecimentosGerenciados || [],
        ativo: true,
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString(),
        preferences: { notifications: true, emailUpdates: true, theme: 'light' },
        stats: { totalOrders: 0, totalRevenue: 0, activePlatforms: 1 }
      };

      await setDoc(userRef, defaultUserData);
      await initializeUserPlatforms(userId, userData.email);
      return defaultUserData;
    }

    return userDoc.data();
  } catch (error) {
    console.error('❌ Erro ao inicializar dados do usuário:', error);
    throw error;
  }
};

/**
 * Log de eventos no Analytics
 */
export const logAnalyticsEvent = (eventName, eventParams = {}) => {
  if (typeof window !== 'undefined') {
    logEvent(analytics, eventName, eventParams);
  }
};
