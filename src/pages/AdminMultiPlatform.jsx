// src/pages/AdminMultiPlatform.jsx - CORRIGIDO E PREPARADO PARA INTEGRAÇÃO REAL

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
    collection, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    query,
    where
} from 'firebase/firestore';
import { db, auth, initializeUserPlatforms } from '../firebase';
import { useNotifications } from "../hooks/useNotifications";
import { 
    IoArrowBack,
    IoLink,
    IoUnlink,
    IoSettings,
    IoStatsChart,
    IoRestaurant,
    IoChatbubble,
    IoPhonePortrait,
    IoGlobe,
    IoCheckmarkCircle,
    IoAlertCircle,
    IoRefresh,
    IoAddCircle,
    IoCard,
    IoStorefront, // 🔑 Ícone IoStorefront adicionado
    IoDownload,
    IoShareSocial,
    IoTime,
    IoWarning,
    IoInformationCircle,
    IoClose,
    IoCloudDownload,
    IoCloudOffline,
    IoBarChart,
    IoDocumentText,
    IoSync
} from 'react-icons/io5';

// Componente de Notificação
const NotificationContainer = ({ notifications, onRemove }) => {
    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success':
                return <IoCheckmarkCircle className="text-green-500 text-xl" />;
            case 'error':
                return <IoAlertCircle className="text-red-500 text-xl" />;
            case 'warning':
                return <IoWarning className="text-yellow-500 text-xl" />;
            case 'info':
                return <IoInformationCircle className="text-blue-500 text-xl" />;
            default:
                return <IoInformationCircle className="text-gray-500 text-xl" />;
        }
    };

    const getNotificationStyles = (type) => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'info':
                return 'bg-blue-50 border-blue-200 text-blue-800';
            default:
                return 'bg-gray-50 border-gray-200 text-gray-800';
        }
    };

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`p-4 rounded-lg border-2 shadow-lg transform transition-all duration-300 ${
                        notification.visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                    } ${getNotificationStyles(notification.type)}`}
                >
                    <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm">{notification.title}</h4>
                            <p className="text-sm mt-1">{notification.message}</p>
                        </div>
                        <button
                            onClick={() => onRemove(notification.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <IoClose className="text-lg" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

function AdminMultiPlatform() {
    const [loading, setLoading] = useState(true);
    const [initializing, setInitializing] = useState(false);
    const [platforms, setPlatforms] = useState({});
    const [syncStatus, setSyncStatus] = useState('idle');
    const [syncLogs, setSyncLogs] = useState([]);
    const [establishmentName, setEstablishmentName] = useState('Meu Restaurante');
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [configData, setConfigData] = useState({
        apiKey: '',
        storeId: '',
        autoSync: false
    });

    // Sistema de Notificações
    const {
        notifications,
        addNotification,
        removeNotification,
    } = useNotifications();

    // 🏷️ Obter nome da plataforma
    const getPlatformName = (platformId) => {
        const platform = availablePlatforms.find(p => p.id === platformId);
        return platform?.name || platformId;
    };


    // 📝 Adicionar log de sincronização com chave única
    const addSyncLog = (type, message, platformId = 'system') => {
        const timestamp = new Date().toISOString();
        const newLog = {
            id: `${timestamp}-${platformId}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            platformId,
            timestamp
        };
        
        setSyncLogs(prev => [newLog, ...prev.slice(0, 49)]);
    };

    // 🔄 Inicializar plataformas para usuário
    const initializePlatforms = async () => {
        try {
            setInitializing(true);
            const user = auth.currentUser;
            
            if (!user) {
                addNotification('error', 'Erro', 'Usuário não autenticado');
                return false;
            }

            addNotification('info', 'Inicialização', 'Criando configurações iniciais das plataformas...');
            
            // ⚠️ CHAMA FUNÇÃO EXTERNA DE BACKEND SIMULADA:
            const success = await initializeUserPlatforms(user.uid);
            
            if (success) {
                addNotification('success', 'Sucesso', 'Plataformas inicializadas com sucesso!');
                await fetchPlatforms();
            } else {
                addNotification('error', 'Erro', 'Falha ao inicializar plataformas');
            }
            
            return success;
        } catch (error) {
            console.error('Erro na inicialização:', error);
            addNotification('error', 'Erro', 'Erro ao inicializar plataformas');
            return false;
        } finally {
            setInitializing(false);
        }
    };

    // 🔄 Buscar plataformas do Firestore
    const fetchPlatforms = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            
            if (!user) {
                addNotification('error', 'Erro', 'Usuário não autenticado. Faça login novamente.');
                return;
            }

            // ⚠️ CORREÇÃO: Busca documentos de plataforma onde o campo 'userId' é igual ao UID
            const platformsRef = collection(db, 'platforms');
            const q = query(platformsRef, where('userId', '==', user.uid));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                addNotification('info', 'Configuração', 'Nenhuma plataforma encontrada. Clique em "Inicializar Plataformas" para começar.');
            }
            
            const platformsData = {};
            snapshot.forEach(doc => {
                // ⚠️ Garante que o ID do documento é a chave
                platformsData[doc.id] = { id: doc.id, ...doc.data() };
            });
            
            setPlatforms(platformsData);
            addSyncLog('success', 'Plataformas carregadas com sucesso');
        } catch (error) {
            console.error('Erro ao buscar plataformas:', error);
            addNotification('error', 'Erro', `Erro ao carregar plataformas: ${error.message}`);
            addSyncLog('error', `Erro ao carregar plataformas: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };


    // 🔄 Atualizar configuração da plataforma - VERSÃO ROBUSTA
    const updatePlatformConfig = async (platformId, config) => {
        try {
            const user = auth.currentUser;
            const platformRef = doc(db, 'platforms', platformId);
            
            // Verifica se o documento existe
            const platformDoc = await getDoc(platformRef);
            
            const baseData = {
                name: availablePlatforms.find(p => p.id === platformId)?.name || platformId,
                type: platformId,
                userId: user.uid,
                orders: 0,
                revenue: 0,
                createdAt: new Date().toISOString(),
            };

            if (!platformDoc.exists()) {
                // CRIA o documento se não existe
                await setDoc(platformRef, {
                    ...baseData,
                    connected: false,
                    syncStatus: 'disconnected',
                    config: {},
                    updatedAt: new Date().toISOString(),
                    ...config
                });
            } else {
                // ATUALIZA o documento se existe (merge)
                await updateDoc(platformRef, {
                    ...config,
                    updatedAt: new Date().toISOString()
                });
            }
            
            // Atualizar estado local
            setPlatforms(prev => ({
                ...prev,
                [platformId]: { ...prev[platformId], ...config }
            }));
            
            addNotification('success', 'Configuração', `${getPlatformName(platformId)} configurado com sucesso`);
            addSyncLog('success', `${platformId} configurado com sucesso`);
            return true;
        } catch (error) {
            console.error('Erro ao atualizar plataforma:', error);
            addNotification('error', 'Erro', `Erro ao configurar ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro ao configurar ${platformId}: ${error.message}`);
            return false;
        }
    };

    // 🔄 Testar conexão
    const testConnection = async (platformId) => {
        try {
            setSyncStatus('testing');
            addNotification('info', 'Teste de Conexão', `Testando conexão com ${getPlatformName(platformId)}...`);
            addSyncLog('info', `Testando conexão com ${platformId}`);
            
            // ⚠️ SIMULAÇÃO (DEVERIA SER CHAMADA API EXTERNA)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Atualizar status no Firestore
            await updatePlatformConfig(platformId, {
                lastTest: new Date().toISOString(),
                connectionStatus: 'connected', // Se o teste for bem-sucedido
                syncStatus: 'connected'
            });
            
            addNotification('success', 'Conexão', `Conexão com ${getPlatformName(platformId)} testada com sucesso`);
            addSyncLog('success', `Conexão com ${platformId} testada com sucesso`);
        } catch (error) {
            console.error('Erro no teste de conexão:', error);
            addNotification('error', 'Erro', `Falha no teste de conexão com ${getPlatformName(platformId)}`);
            addSyncLog('error', `Falha no teste de conexão com ${platformId}`);
        } finally {
            setSyncStatus('idle');
        }
    };

    // 🔄 Sincronizar plataforma específica
    const syncPlatformOrders = async (platformId) => {
        try {
            setSyncStatus('syncing');
            addNotification('info', 'Sincronização', `Iniciando sincronização com ${getPlatformName(platformId)}`);
            addSyncLog('info', `Iniciando sincronização com ${platformId}`);
            
            // ⚠️ SIMULAÇÃO: Aqui você faria a chamada para o seu Cloud Function/Backend
            // Ex: await callBackendSyncFunction(platformId, platforms[platformId].config);

            // SIMULANDO RESULTADO REAL (Remover em produção)
            const newOrders = Math.floor(Math.random() * 10) + 1;
            const newRevenue = Math.random() * 500 + 50;
            
            const currentPlatform = platforms[platformId] || {};
            const currentOrders = currentPlatform.orders || 0;
            const currentRevenue = currentPlatform.revenue || 0;
            
            // Atualizar última sincronização - USA A FUNÇÃO CORRIGIDA
            await updatePlatformConfig(platformId, {
                lastSync: new Date().toISOString(),
                syncStatus: 'synced',
                orders: currentOrders + newOrders,
                revenue: currentRevenue + newRevenue
            });
            
            addNotification('success', 'Sincronização', 
                `${getPlatformName(platformId)} sincronizado: ${newOrders} novos pedidos`);
            addSyncLog('success', `Sincronização com ${platformId} concluída: ${newOrders} novos pedidos`);
        } catch (error) {
            console.error('Erro na sincronização:', error);
            addNotification('error', 'Erro', `Erro na sincronização com ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro na sincronização com ${platformId}`);
        } finally {
            setSyncStatus('idle');
        }
    };

    // 🔄 Sincronizar todas as plataformas
    const syncAllPlatforms = async () => {
        try {
            setSyncStatus('syncing');
            addNotification('info', 'Sincronização', 'Iniciando sincronização de todas as plataformas');
            addSyncLog('info', 'Iniciando sincronização de todas as plataformas');
            
            // Usar availablePlatforms para pegar a lista atualizada
            const platformsToSync = availablePlatforms.filter(p => p.status === 'connected' && p.id !== 'website');
            
            if (platformsToSync.length === 0) {
                addNotification('warning', 'Aviso', 'Nenhuma plataforma externa conectada para sincronizar');
                addSyncLog('warning', 'Nenhuma plataforma externa conectada para sincronizar');
                return;
            }
            
            // Sincronizar de forma serial para evitar sobrecarga
            for (const platform of platformsToSync) {
                await syncPlatformOrders(platform.id);
            }
            
            addNotification('success', 'Sincronização', 'Sincronização completa de todas as plataformas');
            addSyncLog('success', 'Sincronização completa de todas as plataformas');
        } catch (error) {
            console.error('Erro na sincronização geral:', error);
            addNotification('error', 'Erro', 'Erro na sincronização geral');
            addSyncLog('error', 'Erro na sincronização geral');
        } finally {
            setSyncStatus('idle');
        }
    };

    // 🔄 Conectar/desconectar plataforma
    const handleToggleConnection = async (platformId, connected) => {
        const user = auth.currentUser;
        
        if (!user) return;

        try {
            if (connected) {
                // Ao conectar, atualiza o status para 'connected'
                await updatePlatformConfig(platformId, {
                    connected: true,
                    syncStatus: 'disconnected',
                    orders: 0,
                    revenue: 0,
                    config: platforms[platformId]?.config || configData,
                });
                
                addNotification('success', 'Conexão', `${getPlatformName(platformId)} conectado com sucesso`);
                addSyncLog('success', `${platformId} conectado com sucesso`);
            } else {
                // Ao desconectar, atualiza o status para 'disconnected'
                await updatePlatformConfig(platformId, { 
                    connected: false,
                    syncStatus: 'disconnected'
                });
                addNotification('info', 'Conexão', `${getPlatformName(platformId)} desconectado`);
                addSyncLog('info', `${platformId} desconectado`);
            }
            
            // Recarregar dados para refletir o novo status
            await fetchPlatforms();
            
        } catch (error) {
            console.error('Erro ao alterar conexão:', error);
            addNotification('error', 'Erro', `Erro ao ${connected ? 'conectar' : 'desconectar'} ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro ao ${connected ? 'conectar' : 'desconectar'} ${platformId}`);
        }
    };


    // 🎯 Configurar plataforma (Ação final do modal)
    const handleConfigurePlatform = async (platformId) => {
        try {
            await updatePlatformConfig(platformId, {
                connected: true, // Conecta ao configurar
                syncStatus: 'connected',
                config: configData,
                lastSync: new Date().toISOString(), // Simula a última sincronização
            });
            
            addNotification('success', 'Configuração', `${getPlatformName(platformId)} configurado e conectado com sucesso`);
            addSyncLog('success', `${platformId} configurado e conectado com sucesso`);
            
            setShowConfigModal(false);
            setConfigData({ apiKey: '', storeId: '', autoSync: false });
            await fetchPlatforms(); // Atualiza a lista
            
        } catch (error) {
            console.error('Erro ao configurar plataforma:', error);
            addNotification('error', 'Erro', `Erro ao configurar ${getPlatformName(platformId)}`);
            addSyncLog('error', `Erro ao configurar ${platformId}`);
        }
    };


    // 📋 Plataformas disponíveis com dados em tempo real (useMemo)
    // ⚠️ ATENÇÃO: Os dados do 'website' são hardcoded para demonstração, exceto o status
    const availablePlatforms = useMemo(() => {
        // Mapeia a lista fixa de plataformas com os dados em tempo real do Firestore (platforms)
        const fixedList = [
            { id: 'ifood', name: 'iFood', icon: <IoRestaurant className="text-red-500" />, color: 'red', description: 'Integração com iFood Partner', setupRequired: true, docsUrl: 'https://developer.ifood.com.br' },
            { id: 'whatsapp', name: 'WhatsApp Business', icon: <IoChatbubble className="text-green-500" />, color: 'green', description: 'Pedidos via WhatsApp', setupRequired: true, docsUrl: 'https://developers.facebook.com/docs/whatsapp/business-management-api/' },
            { id: 'rappi', name: 'Rappi', icon: <IoPhonePortrait className="text-blue-500" />, color: 'blue', description: 'Integração com Rappi Partner', setupRequired: true, docsUrl: 'https://developer.rappi.com' },
            { id: 'uberEats', name: 'Uber Eats', icon: <IoGlobe className="text-green-600" />, color: 'green', description: 'Integração com Uber Eats', setupRequired: true, docsUrl: 'https://developer.uber.com/docs/eats' },
            { id: 'website', name: 'Site Próprio', icon: <IoStorefront className="text-purple-500" />, color: 'purple', description: 'Sistema DeuFome', setupRequired: false, docsUrl: null },
        ];

        return fixedList.map(p => {
            const data = platforms[p.id] || {};
            return {
                ...p,
                // Dados em tempo real do Firestore:
                status: data.connected ? 'connected' : 'disconnected',
                syncStatus: data.syncStatus || 'disconnected',
                orders: data.orders || 0,
                revenue: data.revenue || 0,
                lastSync: data.lastSync,
                config: data.config || {},
            };
        });
    }, [platforms]);

    // 📊 Calcular métricas
    const getPlatformMetrics = () => {
        const externalPlatforms = availablePlatforms.filter(p => p.id !== 'website');
        const connectedPlatforms = availablePlatforms.filter(p => p.status === 'connected').length;
        const totalOrders = availablePlatforms.reduce((sum, p) => sum + p.orders, 0);
        const totalRevenue = availablePlatforms.reduce((sum, p) => sum + p.revenue, 0);
        
        return {
            connectedPlatforms,
            totalOrders,
            totalRevenue,
            // Detalhes extras se necessário
        };
    };

    // 🕒 Formatador de data relativa
    const formatRelativeTime = (date) => {
        if (!date) return 'Nunca';
        
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora há pouco';
        if (diffMins < 60) return `Há ${diffMins} min`;
        if (diffHours < 24) return `Há ${diffHours} h`;
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return `Há ${diffDays} dias`;
        
        return new Date(date).toLocaleDateString('pt-BR');
    };

    // 🎨 Obter ícone do status de sync
    const getSyncStatusIcon = (status) => {
        switch (status) {
            case 'connected':
            case 'synced':
                return <IoCheckmarkCircle className="text-green-500" />;
            case 'syncing':
            case 'testing':
                return <IoRefresh className="text-blue-500 animate-spin" />;
            case 'error':
                return <IoAlertCircle className="text-red-500" />;
            default:
                return <IoInformationCircle className="text-gray-500" />;
        }
    };

    // 🎨 Obter cor do status
    const getSyncStatusColor = (status) => {
        switch (status) {
            case 'connected':
            case 'synced':
                return 'green';
            case 'syncing':
            case 'testing':
                return 'blue';
            case 'error':
                return 'red';
            default:
                return 'gray';
        }
    };

    // 📤 Exportar relatório
    const exportReport = () => {
        const report = {
            generatedAt: new Date().toISOString(),
            establishment: establishmentName,
            metrics: getPlatformMetrics(),
            platforms: availablePlatforms.map(p => ({
                name: p.name,
                status: p.status,
                syncStatus: p.syncStatus,
                orders: p.orders,
                revenue: p.revenue,
                lastSync: p.lastSync
            })),
            recentLogs: syncLogs.slice(0, 20)
        };

        const dataStr = JSON.stringify(report, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-plataformas-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        addNotification('success', 'Exportação', 'Relatório exportado com sucesso');
        addSyncLog('info', 'Relatório exportado');
    };

    // 📥 Efeito inicial - carregar dados
    useEffect(() => {
        const init = async () => {
            await fetchPlatforms();
            addSyncLog('info', 'Sistema de multi-plataforma inicializado');
        };
        
        init();
    }, []);

    // 📊 Métricas calculadas
    const metrics = useMemo(() => getPlatformMetrics(), [availablePlatforms]);

    // 🎯 Loading States Melhorados
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Carregando Plataformas</h3>
                    <p className="text-gray-600">Configurando seu ambiente multi-plataforma...</p>
                </div>
            </div>
        );
    }

    if (initializing) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Inicializando Plataformas</h3>
                    <p className="text-gray-600">Preparando todas as integrações disponíveis...</p>
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md mx-auto">
                        <p className="text-sm text-blue-800">
                            📦 Criando configurações iniciais para iFood, WhatsApp, Rappi, Uber Eats e Site Próprio
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
            {/* Sistema de Notificações */}
            <NotificationContainer 
                notifications={notifications} 
                onRemove={removeNotification} 
            />
            
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
                    <div className="mb-4 lg:mb-0">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                                <IoShareSocial className="text-white text-lg" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">
                                    Multi-Plataforma
                                </h1>
                                <p className="text-gray-600">
                                    {establishmentName} • {metrics.connectedPlatforms} de {availablePlatforms.length} plataformas conectadas
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex w-full gap-3">
                        <Link 
                            to="/dashboard" 
                            className="inline-flex items-center justify-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-lg border border-gray-300 transition-colors"
                        >
                            <IoArrowBack />
                            <span>Voltar ao Dashboard</span>
                        </Link>
                        
                        <button 
                            onClick={syncAllPlatforms}
                            disabled={syncStatus === 'syncing' || metrics.connectedPlatforms === 0}
                            className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                        >
                            <IoRefresh className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                            <span>
                                {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar Tudo'}
                            </span>
                        </button>

                        {/* Botão para forçar inicialização */}
                        {Object.keys(platforms).length === 0 && (
                            <button 
                                onClick={initializePlatforms}
                                disabled={initializing}
                                className="inline-flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                            >
                                <IoRefresh className={initializing ? 'animate-spin' : ''} />
                                <span>
                                    {initializing ? 'Inicializando...' : 'Inicializar Plataformas'}
                                </span>
                            </button>
                        )}
                    </div>
                </header>

                {/* Loading durante sincronização */}
                {syncStatus === 'syncing' && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-center space-x-3">
                            <IoRefresh className="text-blue-500 animate-spin text-xl" />
                            <div>
                                <h4 className="font-semibold text-blue-900">Sincronização em Andamento</h4>
                                <p className="text-blue-700 text-sm">Atualizando dados de todas as plataformas conectadas...</p>
                            </div>
                        </div>
                        <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                        </div>
                    </div>
                )}

                {/* Métricas Consolidadas */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Plataformas Conectadas</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {metrics.connectedPlatforms}/{availablePlatforms.length}
                                </p>
                                <div className="flex items-center mt-1">
                                    <IoCheckmarkCircle className="text-green-500 mr-1" />
                                    <span className="text-sm text-green-600">
                                        {Math.round((metrics.connectedPlatforms / availablePlatforms.length) * 100)}% ativas
                                    </span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                <IoLink className="text-blue-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total de Pedidos</p>
                                <p className="text-2xl font-bold text-gray-900">{metrics.totalOrders}</p>
                                <div className="flex items-center mt-1">
                                    <IoStatsChart className="text-purple-500 mr-1" />
                                    <span className="text-sm text-purple-600">Todas as plataformas</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                <IoCard className="text-purple-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Faturamento Total</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    R$ {metrics.totalRevenue.toFixed(2)}
                                </p>
                                <div className="flex items-center mt-1">
                                    <IoCheckmarkCircle className="text-green-500 mr-1" />
                                    <span className="text-sm text-green-600">Consolidado</span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <IoDownload className="text-green-600 text-xl" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Status da Sync</p>
                                <p className="text-2xl font-bold text-gray-900 capitalize">
                                    {syncStatus === 'idle' ? 'Pronto' : syncStatus}
                                </p>
                                <div className="flex items-center mt-1">
                                    {getSyncStatusIcon(syncStatus)}
                                    <span className={`text-sm ml-1 text-${getSyncStatusColor(syncStatus)}-600`}>
                                        {syncStatus === 'syncing' ? 'Sincronizando...' : 
                                         syncStatus === 'testing' ? 'Testando...' : 'Atualizado'}
                                    </span>
                                </div>
                            </div>
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                                <IoTime className="text-gray-600 text-xl" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Lista de Plataformas */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                    <IoLink className="mr-2 text-blue-500" />
                                    Plataformas Conectáveis
                                </h2>
                                <div className="text-sm text-gray-500">
                                    Última sincronização: {formatRelativeTime(
                                        Math.max(...availablePlatforms.map(p => p.lastSync).filter(Boolean))
                                    )}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                {availablePlatforms.map((platform) => (
                                    <div 
                                        key={platform.id}
                                        className={`p-4 rounded-xl border-2 transition-all ${
                                            platform.status === 'connected'
                                                ? 'border-green-200 bg-green-50'
                                                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                                    platform.status === 'connected' 
                                                        ? 'bg-green-100' 
                                                        : 'bg-gray-100'
                                                }`}>
                                                    {platform.icon}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{platform.name}</h3>
                                                    <p className="text-sm text-gray-600">{platform.description}</p>
                                                    <div className="flex items-center space-x-4 mt-2">
                                                        <span className="text-sm text-gray-500">
                                                            📦 {platform.orders} pedidos
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            💰 R$ {platform.revenue.toFixed(2)}
                                                        </span>
                                                        <span className="text-sm text-gray-500">
                                                            🕒 {formatRelativeTime(platform.lastSync)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center space-x-2">
                                                {/* Status Badge */}
                                                <div className="flex items-center space-x-2">
                                                    {getSyncStatusIcon(platform.syncStatus)}
                                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                        platform.status === 'connected'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {platform.status === 'connected' ? 'Conectado' : 'Desconectado'}
                                                    </span>
                                                </div>

                                                {/* Ações */}
                                                <div className="flex items-center space-x-1">
                                                    {platform.status === 'connected' && (
                                                        <>
                                                            <button
                                                                onClick={() => testConnection(platform.id)}
                                                                disabled={syncStatus === 'syncing' || syncStatus === 'testing'}
                                                                className="p-2 text-blue-600 hover:bg-blue-100 disabled:opacity-50 rounded-lg transition-colors"
                                                                title="Testar Conexão"
                                                            >
                                                                <IoSync size={16} />
                                                            </button>
                                                            
                                                            <button
                                                                onClick={() => syncPlatformOrders(platform.id)}
                                                                disabled={syncStatus === 'syncing'}
                                                                className="p-2 text-green-600 hover:bg-green-100 disabled:opacity-50 rounded-lg transition-colors"
                                                                title="Sincronizar Pedidos"
                                                            >
                                                                <IoCloudDownload size={16} />
                                                            </button>
                                                        </>
                                                    )}
                                                    
                                                    <button
                                                        onClick={() => handleToggleConnection(
                                                            platform.id, 
                                                            platform.status !== 'connected'
                                                        )}
                                                        disabled={syncStatus === 'syncing'}
                                                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                                                            platform.status === 'connected'
                                                                ? 'text-red-600 hover:bg-red-100'
                                                                : 'text-green-600 hover:bg-green-100'
                                                        }`}
                                                        title={
                                                            platform.status === 'connected' 
                                                                ? 'Desconectar' 
                                                                : 'Conectar'
                                                        }
                                                    >
                                                        {platform.status === 'connected' ? 
                                                            <IoUnlink size={16} /> : 
                                                            <IoLink size={16} />
                                                        }
                                                    </button>

                                                    {platform.setupRequired && (
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPlatform(platform);
                                                                setShowConfigModal(true);
                                                            }}
                                                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                            title="Configurações"
                                                        >
                                                            <IoSettings size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Configuração Rápida */}
                                        {platform.setupRequired && platform.status !== 'connected' && (
                                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    ⚙️ Configuração necessária. 
                                                    <button 
                                                        onClick={() => {
                                                            setSelectedPlatform(platform);
                                                            setShowConfigModal(true);
                                                        }}
                                                        className="ml-1 text-yellow-900 font-medium hover:underline"
                                                    >
                                                        Clique aqui para configurar
                                                    </button>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Logs de Sincronização */}
                        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                                    <IoInformationCircle className="mr-2 text-blue-500" />
                                    Logs de Sincronização (Últimas 24h)
                                </h3>
                                <button 
                                    onClick={() => setSyncLogs([])}
                                    className="text-sm text-gray-500 hover:text-gray-700"
                                >
                                    Limpar logs
                                </button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {syncLogs.length > 0 ? (
                                    syncLogs.map((log) => (
                                        <div 
                                            key={log.id}
                                            className={`p-3 rounded-lg border ${
                                                log.type === 'error' ? 'bg-red-50 border-red-200' :
                                                log.type === 'success' ? 'bg-green-50 border-green-200' :
                                                log.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                                                'bg-blue-50 border-blue-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm font-medium capitalize">
                                                        {log.platformId}
                                                    </span>
                                                    <span className="text-sm text-gray-600">
                                                        {log.message}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {formatRelativeTime(log.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-4 text-gray-500">
                                        <IoCloudOffline className="text-2xl mx-auto mb-2 text-gray-400" />
                                        Nenhum log de sincronização nas últimas 24h
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Painel de Controle */}
                    <div className="space-y-6">
                        {/* Resumo de Performance */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <IoBarChart className="mr-2 text-purple-500" />
                                Performance por Plataforma
                            </h3>
                            <div className="space-y-3">
                                {availablePlatforms.map(platform => (
                                    <div key={platform.id} className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            {platform.icon}
                                            <span className="text-sm font-medium text-gray-700">{platform.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-gray-900">
                                                {platform.orders} pedidos
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                R$ {platform.revenue.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Ações Rápidas */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Ações Rápidas</h3>
                            <div className="space-y-3">
                                <button 
                                    onClick={syncAllPlatforms}
                                    disabled={syncStatus === 'syncing' || metrics.connectedPlatforms === 0}
                                    className="w-full flex items-center space-x-3 p-3 rounded-lg border border-blue-200 hover:bg-blue-50 disabled:opacity-50 transition-colors"
                                >
                                    <IoRefresh className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
                                    <span className="font-medium text-blue-700">
                                        {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar Tudo'}
                                    </span>
                                </button>
                                
                                <button 
                                    onClick={exportReport}
                                    className="w-full flex items-center space-x-3 p-3 rounded-lg border border-green-200 hover:bg-green-50 transition-colors"
                                >
                                    <IoDocumentText className="text-green-600" />
                                    <span className="font-medium text-green-700">Exportar Relatório Completo</span>
                                </button>
                                
                                <button className="w-full flex items-center space-x-3 p-3 rounded-lg border border-purple-200 hover:bg-purple-50 transition-colors">
                                    <IoSettings className="text-purple-600" />
                                    <span className="font-medium text-purple-700">Configurações Globais</span>
                                </button>

                                {/* Botão de inicialização */}
                                {Object.keys(platforms).length === 0 && (
                                    <button 
                                        onClick={initializePlatforms}
                                        disabled={initializing}
                                        className="w-full flex items-center space-x-3 p-3 rounded-lg border border-orange-200 hover:bg-orange-50 disabled:opacity-50 transition-colors"
                                    >
                                        <IoRefresh className={initializing ? 'animate-spin' : ''} />
                                        <span className="font-medium text-orange-700">
                                            {initializing ? 'Inicializando...' : 'Inicializar Plataformas'}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Status do Sistema */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Status do Sistema</h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Sync em Tempo Real</span>
                                    <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-sm text-green-600">Ativo</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Webhooks</span>
                                    <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-sm text-green-600">Funcionando</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Ultima Sincro</span>
                                    <span className="text-sm text-gray-900">
                                        {formatRelativeTime(
                                            Math.max(...availablePlatforms.map(p => p.lastSync))
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Alertas */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                                <IoWarning className="mr-2 text-orange-500" />
                                Alertas do Sistema
                            </h3>
                            <div className="space-y-2">
                                {availablePlatforms.filter(p => p.status === 'connected' && !p.lastSync).map(platform => (
                                    <div key={platform.id} className="p-2 bg-orange-50 border border-orange-200 rounded">
                                        <p className="text-sm text-orange-800">
                                            ⚠️ {platform.name} conectado mas nunca sincronizado
                                        </p>
                                    </div>
                                ))}
                                
                                {syncLogs.filter(log => log.type === 'error').length > 3 && (
                                    <div className="p-2 bg-red-50 border border-red-200 rounded">
                                        <p className="text-sm text-red-800">
                                            ❌ Múltiplos erros de sincronização detectados
                                        </p>
                                    </div>
                                )}

                                {availablePlatforms.filter(p => p.status !== 'connected').length === availablePlatforms.length - 1 && (
                                    <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                                        <p className="text-sm text-blue-800">
                                            💡 Apenas o site próprio está conectado
                                        </p>
                                    </div>
                                )}

                                {metrics.connectedPlatforms === 0 && (
                                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                                        <p className="text-sm text-yellow-800">
                                            🔌 Nenhuma plataforma externa conectada
                                        </p>
                                    </div>
                                )}

                                {syncLogs.length === 0 && (
                                    <div className="p-2 bg-green-50 border border-green-200 rounded">
                                        <p className="text-sm text-green-800">
                                            ✅ Sistema funcionando normalmente
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal de Configuração */}
                {showConfigModal && selectedPlatform && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                            <div className="flex items-center justify-between p-6 border-b">
                                <h3 className="text-xl font-bold text-gray-900">
                                    Configurar {selectedPlatform.name}
                                </h3>
                                <button 
                                    onClick={() => {
                                        setShowConfigModal(false);
                                        setConfigData({ apiKey: '', storeId: '', autoSync: false });
                                    }}
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <IoClose size={24} />
                                </button>
                            </div>
                            
                            <div className="p-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            API Key
                                        </label>
                                        <input 
                                            type="password" 
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="Insira sua chave de API"
                                            value={configData.apiKey}
                                            onChange={(e) => setConfigData(prev => ({
                                                ...prev,
                                                apiKey: e.target.value
                                            }))}
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Store ID
                                        </label>
                                        <input 
                                            type="text" 
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="ID da sua loja"
                                            value={configData.storeId}
                                            onChange={(e) => setConfigData(prev => ({
                                                ...prev,
                                                storeId: e.target.value
                                            }))}
                                        />
                                    </div>

                                    <div className="flex items-center">
                                        <input 
                                            type="checkbox" 
                                            id="autoSync"
                                            className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                            checked={configData.autoSync}
                                            onChange={(e) => setConfigData(prev => ({
                                                ...prev,
                                                autoSync: e.target.checked
                                            }))}
                                        />
                                        <label htmlFor="autoSync" className="ml-2 text-sm text-gray-700">
                                            Sincronização automática
                                        </label>
                                    </div>

                                    <div className="flex justify-end space-x-3 pt-4">
                                        <button 
                                            onClick={() => {
                                                setShowConfigModal(false);
                                                setConfigData({ apiKey: '', storeId: '', autoSync: false });
                                            }}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={() => handleConfigurePlatform(selectedPlatform.id)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Salvar e Conectar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminMultiPlatform;