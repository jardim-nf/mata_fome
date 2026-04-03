import React, { useState, useEffect } from 'react';
import { IoClose } from 'react-icons/io5';

const PlatformConfigModal = ({ platform, onClose, onSave, initialConfig }) => {
    const [configData, setConfigData] = useState({
        apiKey: '',
        storeId: '',
        autoSync: false
    });

    useEffect(() => {
        if (initialConfig) {
            setConfigData(prev => ({
                ...prev,
                ...initialConfig
            }));
        }
    }, [initialConfig]);

    if (!platform) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <h3 className="text-xl font-bold text-gray-900">
                        Configurar {platform.name}
                    </h3>
                    <button 
                        onClick={onClose}
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
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => onSave(platform.id, configData)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Salvar e Conectar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlatformConfigModal;
