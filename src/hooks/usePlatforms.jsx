import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db, auth, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { initializeUserPlatforms } from '../services/userService';
import { IoRestaurant, IoChatbubble, IoPhonePortrait, IoGlobe, IoStorefront } from 'react-icons/io5';

const FIXED_PLATFORMS = [
    { id: 'ifood', name: 'iFood', icon: <IoRestaurant className="text-red-500" />, color: 'red', description: 'Integração com iFood Partner', setupRequired: true, docsUrl: 'https://developer.ifood.com.br' },
    { id: 'whatsapp', name: 'WhatsApp Business', icon: <IoChatbubble className="text-green-500" />, color: 'green', description: 'Pedidos via WhatsApp', setupRequired: true, docsUrl: 'https://developers.facebook.com/docs/whatsapp/business-management-api/' },
    { id: 'rappi', name: 'Rappi', icon: <IoPhonePortrait className="text-blue-500" />, color: 'blue', description: 'Integração com Rappi Partner', setupRequired: true, docsUrl: 'https://developer.rappi.com' },
    { id: 'uberEats', name: 'Uber Eats', icon: <IoGlobe className="text-green-600" />, color: 'green', description: 'Integração com Uber Eats', setupRequired: true, docsUrl: 'https://developer.uber.com/docs/eats' },
    { id: 'website', name: 'Site Próprio', icon: <IoStorefront className="text-purple-500" />, color: 'purple', description: 'Sistema NaMão', setupRequired: false, docsUrl: null },
];

export const usePlatforms = (addNotification) => {
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);
    const [platforms, setPlatforms] = useState({});
    const [syncStatus, setSyncStatus] = useState('idle');
    const [syncLogs, setSyncLogs] = useState([]);

    const getPlatformName = useCallback((platformId) => {
        const platform = FIXED_PLATFORMS.find(p => p.id === platformId);
        return platform?.name || platformId;
    }, []);

    const addSyncLog = useCallback((type, message, platformId = 'system') => {
        const timestamp = new Date().toISOString();
        const newLog = {
            id: `${timestamp}-${platformId}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            platformId,
            timestamp
        };
        
        setSyncLogs(prev => [newLog, ...prev.slice(0, 49)]);
    }, []);

    const fetchPlatforms = useCallback(async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            
            if (!user) {
                if (addNotification) addNotification('error', 'Erro', 'Usuário não autenticado. Faça login novamente.');
                return;
            }

            const platformsRef = collection(db, 'platforms');
            const q = query(platformsRef, where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                if (addNotification) addNotification('info', 'Configuração', 'Nenhuma plataforma encontrada. Clique em "Inicializar Plataformas" para começar.');
            }
            
            const platformsData = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const type = data.type || doc.id;
                platformsData[type] = { id: doc.id, ...data };
            });
            
            setPlatforms(platformsData);
            addSyncLog('success', 'Plataformas carregadas com sucesso');
        } catch (error) {
            console.error('Erro ao buscar plataformas:', error);
            if (addNotification) addNotification('error', 'Erro', `Erro ao carregar plataformas: ${error.message}`);
            addSyncLog('error', `Erro ao carregar plataformas: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [addNotification, addSyncLog]);

    const initializePlatforms = useCallback(async () => {
        try {
            setInitializing(true);
            const user = auth.currentUser;
            
            if (!user) {
                if (addNotification) addNotification('error', 'Erro', 'Usuário não autenticado');
                return false;
            }

            if (addNotification) addNotification('info', 'Inicialização', 'Criando configurações iniciais das plataformas...');
            
            const success = await initializeUserPlatforms(user.uid, user.email || '');
            
            if (success) {
                if (addNotification) addNotification('success', 'Sucesso', 'Plataformas inicializadas com sucesso!');
                await fetchPlatforms();
            } else {
                if (addNotification) addNotification('error', 'Erro', 'Falha ao inicializar plataformas');
            }
            
            return success;
        } catch (error) {
            console.error('Erro na inicialização:', error);
            if (addNotification) addNotification('error', 'Erro', 'Erro ao inicializar plataformas');
            return false;
        } finally {
            setInitializing(false);
        }
    }, [addNotification, fetchPlatforms]);

    const updatePlatformConfig = useCallback(async (platformId, config) => {
        try {
            const user = auth.currentUser;
            const docId = `${platformId}_${user.uid}`;
            const platformRef = doc(db, 'platforms', docId);
            
            const platformDoc = await getDoc(platformRef);
            
            const baseData = {
                name: getPlatformName(platformId),
                type: platformId,
                userId: user.uid,
                orders: 0,
                revenue: 0,
                createdAt: new Date().toISOString(),
            };

            if (!platformDoc.exists()) {
                await setDoc(platformRef, {
                    ...baseData,
                    connected: false,
                    syncStatus: 'disconnected',
                    config: {},
                    updatedAt: new Date().toISOString(),
                    ...config
                });
            } else {
                await updateDoc(platformRef, {
                    ...config,
                    updatedAt: new Date().toISOString()
                });
            }
            
            setPlatforms(prev => ({
                ...prev,
                [platformId]: { ...prev[platformId], ...config }
            }));
            
            if (addNotification) addNotification('success', 'Configuração', `${getPlatformName(platformId)} configurado com sucesso`);
            addSyncLog('success', `${platformId} configurado com sucesso`);
            return true;
        } catch (error) {
            console.error('Erro ao atualizar plataforma:', error);
            if (addNotification) addNotification('error', 'Erro', `Erro ao configurar ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro ao configurar ${platformId}: ${error.message}`);
            return false;
        }
    }, [addNotification, addSyncLog, getPlatformName]);

    const testConnection = useCallback(async (platformId) => {
        try {
            setSyncStatus('testing');
            if (addNotification) addNotification('info', 'Teste de Conexão', `Testando conexão com ${getPlatformName(platformId)}...`);
            addSyncLog('info', `Testando conexão com ${platformId}`);
            
            const user = auth.currentUser;
            if (!user) throw new Error("Usuário não autenticado.");

            // Buscar os dados do estabelecimento do usuário para pegar o estabelecimentoId
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : null;
            const estabelecimentoIdPrincipal = userData?.estabelecimentoIdPrincipal || 
                                               (userData?.estabelecimentosGerenciados?.length > 0 ? userData.estabelecimentosGerenciados[0] : user.uid);

            if (platformId === 'ifood') {
                if (!estabelecimentoIdPrincipal) throw new Error("Estabelecimento principal não encontrado.");
                
                const ifoodTestarConexao = httpsCallable(functions, 'ifoodTestarConexao');
                const response = await ifoodTestarConexao({ estabelecimentoId: estabelecimentoIdPrincipal });
                
                if (response.data.sucesso) {
                    await updatePlatformConfig(platformId, {
                        lastTest: new Date().toISOString(),
                        connectionStatus: 'connected',
                        syncStatus: 'connected',
                        merchantId: response.data.merchants?.length > 0 ? response.data.merchants[0].id : null
                    });
                    if (addNotification) addNotification('success', 'Conexão', response.data.mensagem || `Conexão com ${getPlatformName(platformId)} testada com sucesso`);
                    addSyncLog('success', response.data.mensagem || `Conexão com ${platformId} testada com sucesso`);
                } else {
                    throw new Error(response.data.mensagem || "Falha na conexão.");
                }
            } else {
                // Mock para outras plataformas
                await new Promise(resolve => setTimeout(resolve, 2000));
                await updatePlatformConfig(platformId, {
                    lastTest: new Date().toISOString(),
                    connectionStatus: 'connected',
                    syncStatus: 'connected'
                });
                if (addNotification) addNotification('success', 'Conexão', `Conexão com ${getPlatformName(platformId)} testada com sucesso`);
                addSyncLog('success', `Conexão com ${platformId} testada com sucesso`);
            }
        } catch (error) {
            console.error('Erro no teste de conexão:', error);
            if (addNotification) addNotification('error', 'Erro', `Falha no teste de conexão com ${getPlatformName(platformId)}`);
            addSyncLog('error', `Falha no teste de conexão com ${platformId}: ${error.message}`);
        } finally {
            setSyncStatus('idle');
        }
    }, [addNotification, addSyncLog, getPlatformName, updatePlatformConfig]);

    const syncPlatformOrders = useCallback(async (platformId) => {
        try {
            setSyncStatus('syncing');
            if (addNotification) addNotification('info', 'Sincronização', `Iniciando sincronização com ${getPlatformName(platformId)}`);
            addSyncLog('info', `Iniciando sincronização com ${platformId}`);
            
            const user = auth.currentUser;
            const currentPlatform = platforms[platformId] || {};
            const currentOrders = currentPlatform.orders || 0;
            const currentRevenue = currentPlatform.revenue || 0;
            
            if (platformId === 'ifood') {
                 // Buscar os dados do estabelecimento do usuário para pegar o estabelecimentoId
                const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
                const userData = userDoc.exists() ? userDoc.data() : null;
                const estabelecimentoIdPrincipal = userData?.estabelecimentoIdPrincipal || 
                                                   (userData?.estabelecimentosGerenciados?.length > 0 ? userData.estabelecimentosGerenciados[0] : user.uid);
                if (!estabelecimentoIdPrincipal) throw new Error("Estabelecimento principal não encontrado.");
                
                const ifoodPolling = httpsCallable(functions, 'ifoodPolling');
                const response = await ifoodPolling({ estabelecimentoId: estabelecimentoIdPrincipal });
                
                if (response.data.sucesso) {
                    const newOrders = response.data.pedidosNovos || 0;
                    
                    await updatePlatformConfig(platformId, {
                        lastSync: new Date().toISOString(),
                        syncStatus: 'synced',
                        orders: currentOrders + newOrders,
                        // revenue não conseguimos mensurar certinho sem somar no backend por enquanto, vamos manter
                    });

                    if (addNotification) addNotification('success', 'Sincronização', response.data.mensagem || `${getPlatformName(platformId)} sincronizado: ${newOrders} novos pedidos`);
                    addSyncLog('success', response.data.mensagem || `Sincronização com ${platformId} concluída: ${newOrders} novos pedidos`);
                } else {
                    throw new Error("Falha na sincronização");
                }
            } else {
                // Mock para as demais
                const newOrders = Math.floor(Math.random() * 10) + 1;
                const newRevenue = Math.random() * 500 + 50;
                
                await updatePlatformConfig(platformId, {
                    lastSync: new Date().toISOString(),
                    syncStatus: 'synced',
                    orders: currentOrders + newOrders,
                    revenue: currentRevenue + newRevenue
                });
                
                if (addNotification) addNotification('success', 'Sincronização', `${getPlatformName(platformId)} sincronizado: ${newOrders} novos pedidos`);
                addSyncLog('success', `Sincronização com ${platformId} concluída: ${newOrders} novos pedidos`);
            }
        } catch (error) {
            console.error('Erro na sincronização:', error);
            if (addNotification) addNotification('error', 'Erro', `Erro na sincronização com ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro na sincronização com ${platformId}: ${error.message}`);
        } finally {
            setSyncStatus('idle');
        }
    }, [addNotification, addSyncLog, getPlatformName, platforms, updatePlatformConfig]);

    const availablePlatforms = useMemo(() => {
        return FIXED_PLATFORMS.map(p => {
            const data = platforms[p.id] || {};
            return {
                ...p,
                status: data.connected ? 'connected' : 'disconnected',
                syncStatus: data.syncStatus || 'disconnected',
                orders: data.orders || 0,
                revenue: data.revenue || 0,
                lastSync: data.lastSync,
                merchantId: data.merchantId || null,
                config: data.config || {},
            };
        });
    }, [platforms]);

    const syncAllPlatforms = useCallback(async () => {
        try {
            setSyncStatus('syncing');
            if (addNotification) addNotification('info', 'Sincronização', 'Iniciando sincronização de todas as plataformas');
            addSyncLog('info', 'Iniciando sincronização de todas as plataformas');
            
            const platformsToSync = availablePlatforms.filter(p => p.status === 'connected' && p.id !== 'website');
            
            if (platformsToSync.length === 0) {
                if (addNotification) addNotification('warning', 'Aviso', 'Nenhuma plataforma externa conectada para sincronizar');
                addSyncLog('warning', 'Nenhuma plataforma externa conectada para sincronizar');
                return;
            }
            
            for (const platform of platformsToSync) {
                await syncPlatformOrders(platform.id);
            }
            
            if (addNotification) addNotification('success', 'Sincronização', 'Sincronização completa de todas as plataformas');
            addSyncLog('success', 'Sincronização completa de todas as plataformas');
        } catch (error) {
            console.error('Erro na sincronização geral:', error);
            if (addNotification) addNotification('error', 'Erro', 'Erro na sincronização geral');
            addSyncLog('error', 'Erro na sincronização geral');
        } finally {
            setSyncStatus('idle');
        }
    }, [addNotification, addSyncLog, availablePlatforms, syncPlatformOrders]);

    const handleToggleConnection = useCallback(async (platformId, connected) => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            if (connected) {
                await updatePlatformConfig(platformId, {
                    connected: true,
                    syncStatus: 'disconnected',
                    orders: 0,
                    revenue: 0,
                    config: platforms[platformId]?.config || {},
                });
                
                if (addNotification) addNotification('success', 'Conexão', `${getPlatformName(platformId)} conectado com sucesso`);
                addSyncLog('success', `${platformId} conectado com sucesso`);
            } else {
                await updatePlatformConfig(platformId, { 
                    connected: false,
                    syncStatus: 'disconnected'
                });
                if (addNotification) addNotification('info', 'Conexão', `${getPlatformName(platformId)} desconectado`);
                addSyncLog('info', `${platformId} desconectado`);
            }
            
            await fetchPlatforms();
            
        } catch (error) {
            console.error('Erro ao alterar conexão:', error);
            if (addNotification) addNotification('error', 'Erro', `Erro ao ${connected ? 'conectar' : 'desconectar'} ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro ao ${connected ? 'conectar' : 'desconectar'} ${platformId}`);
        }
    }, [addNotification, addSyncLog, fetchPlatforms, getPlatformName, platforms, updatePlatformConfig]);

    const handleConfigurePlatform = useCallback(async (platformId, configData) => {
        try {
            await updatePlatformConfig(platformId, {
                connected: true,
                syncStatus: 'connected',
                config: configData,
                lastSync: new Date().toISOString(),
            });
            
            if (addNotification) addNotification('success', 'Configuração', `${getPlatformName(platformId)} configurado e conectado com sucesso`);
            addSyncLog('success', `${platformId} configurado e conectado com sucesso`);
            
            await fetchPlatforms();
        } catch (error) {
            console.error('Erro ao configurar plataforma:', error);
            if (addNotification) addNotification('error', 'Erro', `Erro ao configurar ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro ao configurar ${platformId}`);
        }
    }, [addNotification, addSyncLog, fetchPlatforms, getPlatformName, updatePlatformConfig]);

    const setupIfoodWebhook = useCallback(async (merchantId) => {
        const user = auth.currentUser;
        if (!user) return false;

        try {
            setSyncStatus('testing');
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            const userData = userDoc.exists() ? userDoc.data() : null;
            const estabelecimentoIdPrincipal = userData?.estabelecimentoIdPrincipal || 
                                               (userData?.estabelecimentosGerenciados?.length > 0 ? userData.estabelecimentosGerenciados[0] : user.uid);
            if (!estabelecimentoIdPrincipal) throw new Error("Estabelecimento principal não encontrado.");

            const ifoodConfigurarWebhook = httpsCallable(functions, 'ifoodConfigurarWebhook');
            const response = await ifoodConfigurarWebhook({ estabelecimentoId: estabelecimentoIdPrincipal, merchantId });
            
            if (response.data.sucesso) {
                if (addNotification) addNotification('success', 'Webhook', response.data.mensagem || 'Webhook configurado!');
                addSyncLog('success', response.data.mensagem || 'Webhook do iFood configurado com sucesso');
                return true;
            } else {
                throw new Error("Falha ao configurar webhook.");
            }
        } catch (e) {
            console.error('Erro configurando webhook:', e);
            if (addNotification) addNotification('error', 'Erro', 'Erro ao configurar webhook no iFood.');
            addSyncLog('error', `Erro ao configurar webhook do iFood: ${e.message}`);
            return false;
        } finally {
            setSyncStatus('idle');
        }
    }, [addNotification, addSyncLog]);

    // Initial load
    useEffect(() => {
        fetchPlatforms();
        addSyncLog('info', 'Sistema de multi-plataforma inicializado');
    }, [fetchPlatforms, addSyncLog]);

    return {
        loading,
        initializing,
        platforms,
        availablePlatforms,
        syncStatus,
        syncLogs,
        setSyncLogs,
        fetchPlatforms,
        initializePlatforms,
        updatePlatformConfig,
        testConnection,
        syncPlatformOrders,
        syncAllPlatforms,
        handleToggleConnection,
        handleConfigurePlatform,
        setupIfoodWebhook
    };
};
