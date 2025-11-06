// src/hooks/usePlatformSync.js
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

// 📦 Configurações padrão para cada plataforma
const DEFAULT_PLATFORM_CONFIG = {
  ifood: {
    connected: false,
    apiKey: '',
    storeId: '',
    webhookUrl: '',
    autoAccept: true,
    syncMenu: true,
    lastSync: null,
    syncStatus: 'disconnected'
  },
  whatsapp: {
    connected: false,
    phoneNumber: '',
    businessName: '',
    autoReply: true,
    sendUpdates: true,
    lastSync: null,
    syncStatus: 'disconnected'
  },
  rappi: {
    connected: false,
    apiKey: '',
    storeCode: '',
    syncEnabled: false,
    lastSync: null,
    syncStatus: 'disconnected'
  },
  uberEats: {
    connected: false,
    clientId: '',
    storeId: '',
    syncEnabled: false,
    lastSync: null,
    syncStatus: 'disconnected'
  },
  website: {
    connected: true,
    customDomain: '',
    qrCodeEnabled: true,
    lastSync: null,
    syncStatus: 'connected'
  }
};

export const usePlatformSync = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORM_CONFIG);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error, success
  const [orders, setOrders] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);

  // 🔄 Carregar configurações das plataformas
  const loadPlatformConfig = useCallback(async () => {
    if (!estabelecimentoIdPrincipal) return;

    try {
      setLoading(true);
      const platformRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'config', 'platforms');
      const platformDoc = await getDoc(platformRef);

      if (platformDoc.exists()) {
        const configData = platformDoc.data();
        setPlatforms(prev => ({
          ...DEFAULT_PLATFORM_CONFIG,
          ...configData
        }));
      } else {
        // Criar configuração padrão se não existir
        await setDoc(platformRef, DEFAULT_PLATFORM_CONFIG);
        setPlatforms(DEFAULT_PLATFORM_CONFIG);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações das plataformas');
    } finally {
      setLoading(false);
    }
  }, [estabelecimentoIdPrincipal]);

  // 🔄 Atualizar configuração de uma plataforma
  const updatePlatformConfig = useCallback(async (platformId, updates) => {
    if (!estabelecimentoIdPrincipal) return;

    try {
      const platformRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'config', 'platforms');
      
      await setDoc(platformRef, {
        ...platforms,
        [platformId]: {
          ...platforms[platformId],
          ...updates,
          lastSync: updates.connected ? new Date() : platforms[platformId].lastSync
        }
      }, { merge: true });

      setPlatforms(prev => ({
        ...prev,
        [platformId]: {
          ...prev[platformId],
          ...updates,
          lastSync: updates.connected ? new Date() : prev[platformId].lastSync
        }
      }));

      toast.success(`✅ ${platformId} atualizado com sucesso!`);
      return true;
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${platformId}:`, error);
      toast.error(`Erro ao atualizar ${platformId}`);
      return false;
    }
  }, [estabelecimentoIdPrincipal, platforms]);

  // 🔄 Testar conexão com uma plataforma
  const testConnection = useCallback(async (platformId) => {
    setSyncStatus('syncing');
    
    try {
      // Simular teste de conexão
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Aqui viria a lógica real de teste para cada plataforma
      const isConnected = await testPlatformConnection(platformId, platforms[platformId]);
      
      if (isConnected) {
        await updatePlatformConfig(platformId, { 
          syncStatus: 'connected',
          lastSync: new Date()
        });
        setSyncStatus('success');
        toast.success(`✅ Conexão com ${platformId} está funcionando!`);
      } else {
        setSyncStatus('error');
        toast.error(`❌ Falha na conexão com ${platformId}`);
      }
      
      return isConnected;
    } catch (error) {
      console.error(`❌ Erro ao testar conexão com ${platformId}:`, error);
      setSyncStatus('error');
      toast.error(`Erro ao testar conexão com ${platformId}`);
      return false;
    }
  }, [platforms, updatePlatformConfig]);

  // 🔄 Sincronizar pedidos de uma plataforma
  const syncPlatformOrders = useCallback(async (platformId) => {
    if (!platforms[platformId]?.connected) {
      toast.error(`${platformId} não está conectado`);
      return;
    }

    setSyncStatus('syncing');
    
    try {
      // Aqui viria a lógica real de sincronização para cada plataforma
      const newOrders = await fetchPlatformOrders(platformId, platforms[platformId]);
      
      if (newOrders && newOrders.length > 0) {
        await saveOrdersToFirestore(newOrders, platformId);
        await updatePlatformConfig(platformId, { 
          lastSync: new Date(),
          syncStatus: 'synced'
        });
        
        setSyncStatus('success');
        toast.success(`✅ ${newOrders.length} pedidos sincronizados do ${platformId}`);
        
        // Adicionar ao log de sincronização
        addSyncLog(platformId, 'success', `Sincronizados ${newOrders.length} pedidos`);
      } else {
        setSyncStatus('success');
        toast.info(`ℹ️ Nenhum novo pedido no ${platformId}`);
        
        addSyncLog(platformId, 'info', 'Nenhum novo pedido para sincronizar');
      }
      
      return newOrders;
    } catch (error) {
      console.error(`❌ Erro ao sincronizar ${platformId}:`, error);
      setSyncStatus('error');
      toast.error(`Erro ao sincronizar ${platformId}`);
      
      addSyncLog(platformId, 'error', `Erro na sincronização: ${error.message}`);
      return null;
    }
  }, [platforms, updatePlatformConfig]);

  // 🔄 Sincronizar todas as plataformas conectadas
  const syncAllPlatforms = useCallback(async () => {
    setSyncStatus('syncing');
    
    try {
      const connectedPlatforms = Object.keys(platforms).filter(
        platformId => platforms[platformId]?.connected && platformId !== 'website'
      );

      let totalSynced = 0;
      
      for (const platformId of connectedPlatforms) {
        const result = await syncPlatformOrders(platformId);
        if (result && result.length > 0) {
          totalSynced += result.length;
        }
        
        // Pequeno delay entre sincronizações
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (totalSynced > 0) {
        toast.success(`✅ Sincronização completa! ${totalSynced} pedidos de ${connectedPlatforms.length} plataformas`);
      } else {
        toast.info('ℹ️ Sincronização completa - nenhum novo pedido');
      }
      
      setSyncStatus('success');
      return totalSynced;
    } catch (error) {
      console.error('❌ Erro na sincronização geral:', error);
      setSyncStatus('error');
      toast.error('Erro na sincronização geral');
      return 0;
    }
  }, [platforms, syncPlatformOrders]);

  // 🔄 Ouvir pedidos em tempo real
  useEffect(() => {
    if (!estabelecimentoIdPrincipal) return;

    const ordersRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'pedidos');
    const q = query(ordersRef, orderBy('criadoEm', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        criadoEm: doc.data().criadoEm?.toDate?.(),
        atualizadoEm: doc.data().atualizadoEm?.toDate?.()
      }));
      
      setOrders(ordersData);
    });

    return () => unsubscribe();
  }, [estabelecimentoIdPrincipal]);

  // 🔄 Carregar logs de sincronização
  useEffect(() => {
    if (!estabelecimentoIdPrincipal) return;

    const logsRef = collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'syncLogs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), where('timestamp', '>', Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)))); // Últimas 24h

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.()
      }));
      
      setSyncLogs(logsData);
    });

    return () => unsubscribe();
  }, [estabelecimentoIdPrincipal]);

  // 🔄 Inicializar
  useEffect(() => {
    loadPlatformConfig();
  }, [loadPlatformConfig]);

  // 📊 Métricas e utilitários
  const getPlatformMetrics = useCallback(() => {
    const platformMetrics = {};
    let totalOrders = 0;
    let totalRevenue = 0;

    Object.keys(platforms).forEach(platformId => {
      const platformOrders = orders.filter(order => order.platform === platformId);
      const platformRevenue = platformOrders
        .filter(order => order.status === 'entregue')
        .reduce((sum, order) => sum + (order.total || 0), 0);

      platformMetrics[platformId] = {
        orders: platformOrders.length,
        revenue: platformRevenue,
        connected: platforms[platformId]?.connected || false,
        lastSync: platforms[platformId]?.lastSync
      };

      totalOrders += platformOrders.length;
      totalRevenue += platformRevenue;
    });

    return {
      platformMetrics,
      totalOrders,
      totalRevenue,
      connectedPlatforms: Object.keys(platforms).filter(p => platforms[p]?.connected).length
    };
  }, [platforms, orders]);

  // 📝 Adicionar log de sincronização
  const addSyncLog = useCallback(async (platformId, type, message) => {
    if (!estabelecimentoIdPrincipal) return;

    try {
      const logRef = doc(collection(db, 'estabelecimentos', estabelecimentoIdPrincipal, 'syncLogs'));
      await setDoc(logRef, {
        platformId,
        type,
        message,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('❌ Erro ao salvar log:', error);
    }
  }, [estabelecimentoIdPrincipal]);

  return {
    // Estado
    loading,
    platforms,
    syncStatus,
    orders,
    syncLogs,
    
    // Ações
    updatePlatformConfig,
    testConnection,
    syncPlatformOrders,
    syncAllPlatforms,
    loadPlatformConfig,
    
    // Métricas
    getPlatformMetrics,
    
    // Utilitários
    addSyncLog
  };
};

// 🛠️ FUNÇÕES AUXILIARES (serão implementadas para cada plataforma)

// Simular teste de conexão - implementação real viria depois
const testPlatformConnection = async (platformId, config) => {
  switch (platformId) {
    case 'ifood':
      // Lógica real de teste do iFood
      return await testIfoodConnection(config);
    case 'whatsapp':
      // Lógica real de teste do WhatsApp
      return await testWhatsAppConnection(config);
    case 'rappi':
      // Lógica real de teste do Rappi
      return await testRappiConnection(config);
    case 'uberEats':
      // Lógica real de teste do Uber Eats
      return await testUberEatsConnection(config);
    default:
      return true; // Website sempre conectado
  }
};

// Simular busca de pedidos - implementação real viria depois
const fetchPlatformOrders = async (platformId, config) => {
  switch (platformId) {
    case 'ifood':
      return await fetchIfoodOrders(config);
    case 'whatsapp':
      return await fetchWhatsAppOrders(config);
    case 'rappi':
      return await fetchRappiOrders(config);
    case 'uberEats':
      return await fetchUberEatsOrders(config);
    default:
      return [];
  }
};

// Salvar pedidos no Firestore
const saveOrdersToFirestore = async (orders, platformId) => {
  // Implementação para salvar pedidos no Firestore
  // Garantir que não haja duplicatas
  for (const order of orders) {
    try {
      const orderRef = doc(collection(db, 'estabelecimentos', order.estabelecimentoId, 'pedidos'));
      await setDoc(orderRef, {
        ...order,
        platform: platformId,
        criadoEm: new Date(),
        atualizadoEm: new Date()
      });
    } catch (error) {
      console.error('❌ Erro ao salvar pedido:', error);
    }
  }
};

// 🎯 IMPLEMENTAÇÕES ESPECÍFICAS (placeholders - serão desenvolvidas depois)

const testIfoodConnection = async (config) => {
  // Implementação real da API do iFood
  return Math.random() > 0.2; // 80% de chance de sucesso para demo
};

const testWhatsAppConnection = async (config) => {
  // Implementação real da API do WhatsApp
  return Math.random() > 0.1; // 90% de chance de sucesso para demo
};

const testRappiConnection = async (config) => {
  // Implementação real da API do Rappi
  return Math.random() > 0.3; // 70% de chance de sucesso para demo
};

const testUberEatsConnection = async (config) => {
  // Implementação real da API do Uber Eats
  return Math.random() > 0.25; // 75% de chance de sucesso para demo
};

const fetchIfoodOrders = async (config) => {
  // Implementação real para buscar pedidos do iFood
  return []; // Retornar array de pedidos
};

const fetchWhatsAppOrders = async (config) => {
  // Implementação real para buscar pedidos do WhatsApp
  return [];
};

const fetchRappiOrders = async (config) => {
  // Implementação real para buscar pedidos do Rappi
  return [];
};

const fetchUberEatsOrders = async (config) => {
  // Implementação real para buscar pedidos do Uber Eats
  return [];
};