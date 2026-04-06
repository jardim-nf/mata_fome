import React, { useState, useMemo } from 'react';
import BackButton from '../components/BackButton';

import { Link } from 'react-router-dom';
import { usePlatforms } from '../hooks/usePlatforms';
import { useNotifications } from "../hooks/useNotifications";
import NotificationContainer from '../components/common/NotificationContainer';
import PlatformCard, { getSyncStatusIcon, formatRelativeTime } from '../components/admin/multi-platform/PlatformCard';
import PlatformConfigModal from '../components/admin/multi-platform/PlatformConfigModal';
import { 
    IoArrowBack, IoLink, IoStatsChart, IoCard, IoDownload, 
    IoTime, IoWarning, IoInformationCircle, IoCloudOffline, 
    IoBarChart, IoDocumentText, IoShareSocial, IoRefresh, IoCheckmarkCircle
} from 'react-icons/io5';

function AdminMultiPlatform() {
    const [establishmentName] = useState('Meu Restaurante');
    const [selectedPlatform, setSelectedPlatform] = useState(null);
    const [showConfigModal, setShowConfigModal] = useState(false);

    const { notifications, addNotification, removeNotification } = useNotifications();

    const {
        loading,
        initializing,
        platforms,
        availablePlatforms,
        syncStatus,
        syncLogs,
        setSyncLogs,
        initializePlatforms,
        testConnection,
        syncPlatformOrders,
        syncAllPlatforms,
        handleToggleConnection,
        handleConfigurePlatform,
        setupIfoodWebhook
    } = usePlatforms(addNotification);

    const metrics = useMemo(() => {
        const connectedPlatforms = availablePlatforms.filter(p => p.status === 'connected').length;
        const totalOrders = availablePlatforms.reduce((sum, p) => sum + p.orders, 0);
        const totalRevenue = availablePlatforms.reduce((sum, p) => sum + p.revenue, 0);
        return { connectedPlatforms, totalOrders, totalRevenue };
    }, [availablePlatforms]);

    const getSyncStatusColor = (status) => {
        switch (status) {
            case 'connected':
            case 'synced': return 'green';
            case 'syncing':
            case 'testing': return 'blue';
            case 'error': return 'red';
            default: return 'gray';
        }
    };

    const exportReport = () => {
        const report = {
            generatedAt: new Date().toISOString(),
            establishment: establishmentName,
            metrics,
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
    };

    const handleSaveConfig = async (platformId, configData) => {
        await handleConfigurePlatform(platformId, configData);
        setShowConfigModal(false);
    };

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
            <NotificationContainer notifications={notifications} onRemove={removeNotification} />
            
            <div className="max-w-7xl mx-auto">
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
                        <BackButton to="/dashboard" />
                        
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
                                    <PlatformCard
                                        key={platform.id}
                                        platform={platform}
                                        syncStatus={syncStatus}
                                        testConnection={testConnection}
                                        syncPlatformOrders={syncPlatformOrders}
                                        handleToggleConnection={handleToggleConnection}
                                        setSelectedPlatform={setSelectedPlatform}
                                        setShowConfigModal={setShowConfigModal}
                                        setupIfoodWebhook={setupIfoodWebhook}
                                    />
                                ))}
                            </div>
                        </div>

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

                    <div className="space-y-6">
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

                {showConfigModal && selectedPlatform && (
                    <PlatformConfigModal 
                        platform={selectedPlatform} 
                        initialConfig={selectedPlatform.config}
                        onClose={() => {
                            setShowConfigModal(false);
                        }} 
                        onSave={handleSaveConfig} 
                    />
                )}
            </div>
        </div>
    );
}

export default AdminMultiPlatform;