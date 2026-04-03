import { 
    IoSync, 
    IoCloudDownload, 
    IoLink, 
    IoUnlink, 
    IoSettings,
    IoCheckmarkCircle,
    IoRefresh,
    IoAlertCircle,
    IoInformationCircle
} from 'react-icons/io5';

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

const PlatformCard = ({ 
    platform, 
    syncStatus, 
    testConnection, 
    syncPlatformOrders, 
    handleToggleConnection, 
    setSelectedPlatform, 
    setShowConfigModal,
    setupIfoodWebhook
}) => {
    return (
        <div 
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

            {/* Configuração do Webhook iFood */}
            {platform.id === 'ifood' && platform.status === 'connected' && platform.merchantId && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                    <p className="text-sm text-blue-800">
                        🔗 Webhook do iFood
                    </p>
                    <button 
                        onClick={() => setupIfoodWebhook(platform.merchantId)}
                        disabled={syncStatus === 'testing' || syncStatus === 'syncing'}
                        className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        Ativar Webhook
                    </button>
                </div>
            )}

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
    );
};

export { formatRelativeTime, getSyncStatusIcon };
export default PlatformCard;
