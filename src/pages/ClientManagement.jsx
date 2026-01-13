// src/pages/ClientManagement.jsx - VERSÃO COMPLETA COM WHATSAPP DINÂMICO
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { FaArrowLeft, FaWhatsapp, FaEnvelopeOpenText, FaUsers, FaCheckCircle, FaSync, FaBug, FaCog } from 'react-icons/fa';
import { toast } from 'react-toastify';

function ClientManagement() {
    const { currentUser, userClaims } = useAuth();
    const navigate = useNavigate();

    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [clientCount, setClientCount] = useState(0);
    const [loadingCount, setLoadingCount] = useState(true);
    const [estabelecimentoId, setEstabelecimentoId] = useState(null);
    const [estabelecimentoNome, setEstabelecimentoNome] = useState('Seu Estabelecimento');
    const [estabelecimentoWhatsApp, setEstabelecimentoWhatsApp] = useState(null);
    const [debugInfo, setDebugInfo] = useState(null);
    const [whatsappConfig, setWhatsappConfig] = useState(null);

    // 🔍 FUNÇÃO DE DEBUG
    const fetchDebugInfo = useCallback(async () => {
        if (!estabelecimentoId) return;

        try {
            console.log('🔍 Iniciando debug...');
            const debugFunction = httpsCallable(functions, 'debugEstabelecimentoPedidos');
            const result = await debugFunction({});
            setDebugInfo(result.data);
            console.log('📊 Debug info:', result.data);
        } catch (error) {
            console.error('❌ Erro no debug:', error);
        }
    }, [estabelecimentoId]);

    // 🔧 VERIFICAR CONFIGURAÇÃO DO WHATSAPP
    const checkWhatsAppConfig = useCallback(async () => {
        if (!estabelecimentoId) return;

        try {
            const checkFunction = httpsCallable(functions, 'checkWhatsAppConfig');
            const result = await checkFunction({});
            
            setWhatsappConfig(result.data);
            setEstabelecimentoWhatsApp(result.data.estabelecimento?.telefoneWhatsapp);
            
            if (!result.data.configurado) {
                toast.warning(`⚠️ ${result.data.message}`, { 
                    autoClose: 8000,
                    position: "top-center" 
                });
            } else {
                console.log('✅ WhatsApp configurado:', result.data.estabelecimento.telefoneWhatsapp);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar WhatsApp:', error);
        }
    }, [estabelecimentoId]);

    // 🔧 EXTRAIR ESTABELECIMENTO DO TOKEN
    const extractEstabelecimentoFromToken = useCallback(async () => {
        if (!currentUser) return null;

        try {
            const tokenResult = await currentUser.getIdTokenResult(true);
            const claims = tokenResult.claims;
            
            const estabelecimentoId = claims.estabelecimentosGerenciados?.[0];
            const estabelecimentoNome = currentUser?.estabelecimentoNome || 'Seu Estabelecimento';
            
            console.log('🏪 Estabelecimento extraído:', estabelecimentoId);
            return { estabelecimentoId, estabelecimentoNome };
            
        } catch (error) {
            console.error('❌ Erro ao extrair token:', error);
            return null;
        }
    }, [currentUser]);

    // 🎯 INICIALIZAR ESTABELECIMENTO
    const initializeEstabelecimento = useCallback(async () => {
        if (!currentUser) return;

        const estabelecimentoData = await extractEstabelecimentoFromToken();
        if (estabelecimentoData) {
            setEstabelecimentoId(estabelecimentoData.estabelecimentoId);
            setEstabelecimentoNome(estabelecimentoData.estabelecimentoNome);
        }
    }, [currentUser, extractEstabelecimentoFromToken]);

    // 👥 BUSCAR CONTAGEM DE CLIENTES
    const fetchClientCount = useCallback(async () => {
        if (!estabelecimentoId) return;

        setLoadingCount(true);
        try {
            const countFunction = httpsCallable(functions, 'countEstablishmentClientsCallable');
            const result = await countFunction({});
            setClientCount(result.data.uniqueClientCount || 0);
        } catch (error) {
            console.error('❌ Erro na contagem:', error);
            setClientCount(0);
            toast.error('Erro ao carregar contagem de clientes');
        } finally {
            setLoadingCount(false);
        }
    }, [estabelecimentoId]);

    // 📤 FUNÇÃO PRINCIPAL DE ENVIO
    const handleSendEstablishmentMessage = useCallback(async () => {
        if (isSending || !message.trim()) {
            toast.warn('A mensagem não pode ser vazia.');
            return;
        }

        if (clientCount === 0) {
            toast.info('Não há clientes para enviar a mensagem.');
            return;
        }

        if (!estabelecimentoWhatsApp) {
            toast.error('❌ WhatsApp não configurado para este estabelecimento.');
            return;
        }

        if (!window.confirm(`Tem certeza que deseja enviar esta mensagem via WhatsApp para ${clientCount} clientes de ${estabelecimentoNome}? \n\n📞 Enviando de: ${estabelecimentoWhatsApp}`)) {
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            const sendFunction = httpsCallable(functions, 'sendEstablishmentMessageCallable');
            const result = await sendFunction({ 
                message: message.trim() 
            });

            setSendResult({ 
                status: 'success', 
                details: result.data.message,
                data: result.data
            });
            
            toast.success(`✅ ${result.data.message}`);
            
            // Atualiza a contagem após o envio
            fetchClientCount();

        } catch (err) {
            console.error("❌ Erro ao enviar mensagem:", err);
            setSendResult({ 
                status: 'error', 
                details: `Falha: ${err.message}`
            });
            toast.error(`❌ Erro: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    }, [isSending, message, estabelecimentoNome, clientCount, estabelecimentoWhatsApp, fetchClientCount]);

    // 🔄 RECARREGAR DADOS
    const handleRefresh = useCallback(() => {
        fetchClientCount();
        fetchDebugInfo();
        checkWhatsAppConfig();
        toast.info('Dados atualizados!');
    }, [fetchClientCount, fetchDebugInfo, checkWhatsAppConfig]);

    // 📝 TEMPLATES DE MENSAGEM
    const messageTemplates = [
        {
            title: "Horário de Funcionamento",
            message: `Prezado cliente, informamos que ${estabelecimentoNome} funciona de segunda a sábado, das 11h às 23h. Aos domingos, das 12h às 22h. Agradecemos sua preferência!`
        },
        {
            title: "Promoção Especial",
            message: `Olá! ${estabelecimentoNome} tem uma promoção especial para você: 20% de desconto no seu próximo pedido! Use o código: CLIENTE20. Válido por 7 dias.`
        },
        {
            title: "Novo no Cardápio",
            message: `Grande novidade! ${estabelecimentoNome} acaba de lançar novos pratos exclusivos. Venha experimentar! Faça seu pedido agora mesmo.`
        }
    ];

    // 🎯 USE EFFECTS
    useEffect(() => {
        initializeEstabelecimento();
    }, [initializeEstabelecimento]);

    useEffect(() => {
        if (estabelecimentoId) {
            fetchClientCount();
            fetchDebugInfo();
            checkWhatsAppConfig();
        }
    }, [estabelecimentoId, fetchClientCount, fetchDebugInfo, checkWhatsAppConfig]);

    return (
        <div className="min-h-screen bg-gray-50 py-8 text-sm sm:text-base lg:px-8">
<div className="w-full text-sm sm:text-base lg:max-w-6xl lg:mx-auto">
                
                {/* HEADER */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => navigate('/admin')}
                        className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 bg-white rounded-lg border border-gray-200 hover:shadow-md transition duration-200"
                    >
                        <FaArrowLeft />
                        Voltar
                    </button>
                    
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-3">
                            <FaEnvelopeOpenText className="text-red-500" />
                            Comunicação com Clientes
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Estabelecimento: <strong>{estabelecimentoNome}</strong>
                            {estabelecimentoWhatsApp && (
                                <span className="ml-4 text-green-600">
                                    📞 {estabelecimentoWhatsApp}
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            className="flex items-center gap-2 px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition duration-200"
                        >
                            <FaSync />
                            Atualizar
                        </button>
                        <button
                            onClick={fetchDebugInfo}
                            className="flex items-center gap-2 px-4 py-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition duration-200"
                        >
                            <FaBug />
                            Debug
                        </button>
                    </div>
                </div>

                {/* ALERTA WHATSAPP NÃO CONFIGURADO */}
                {!estabelecimentoWhatsApp && (
                    <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg">
                        <div className="flex items-center gap-3">
                            <FaCog className="text-red-500 text-xl" />
                            <div>
                                <h3 className="font-bold text-red-800">⚠️ WhatsApp Não Configurado</h3>
                                <p className="text-red-700 text-sm">
                                    Configure o número do WhatsApp do estabelecimento para enviar mensagens.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* CARDS DE ESTATÍSTICAS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 text-center">
                        <FaUsers className="text-blue-500 text-3xl mx-auto mb-3" />
                        <div className="text-2xl font-bold text-gray-800">
                            {loadingCount ? (
                                <div className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Carregando...
                                </div>
                            ) : (
                                clientCount
                            )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Clientes Únicos</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 text-center">
                        <FaWhatsapp className="text-green-500 text-3xl mx-auto mb-3" />
                        <div className="text-2xl font-bold text-gray-800">
                            {estabelecimentoWhatsApp ? '✅' : '❌'}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">WhatsApp {estabelecimentoWhatsApp ? 'Configurado' : 'Pendente'}</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 text-center">
                        <FaCheckCircle className="text-green-500 text-3xl mx-auto mb-3" />
                        <div className="text-2xl font-bold text-gray-800">Pronto</div>
                        <div className="text-sm text-gray-600 mt-1">Para Enviar</div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow border border-gray-200 text-center">
                        <FaEnvelopeOpenText className="text-purple-500 text-3xl mx-auto mb-3" />
                        <div className="text-2xl font-bold text-gray-800">{estabelecimentoNome.split(' ')[0]}</div>
                        <div className="text-sm text-gray-600 mt-1">Remetente</div>
                    </div>
                </div>

                {/* ÁREA PRINCIPAL */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* PAINEL DE ENVIO */}
                    <div className="lg:col-span-2">
                        <div className={`bg-white p-6 rounded-2xl shadow-xl border ${
                            estabelecimentoWhatsApp ? 'border-green-200' : 'border-gray-300'
                        }`}>
                            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FaWhatsapp className={estabelecimentoWhatsApp ? "text-green-500" : "text-gray-400"} />
                                Envio de Mensagem via WhatsApp
                                {estabelecimentoWhatsApp && (
                                    <span className="text-sm font-normal text-green-600 ml-2">
                                        (de: {estabelecimentoWhatsApp})
                                    </span>
                                )}
                            </h2>

                            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-800">
                                    <strong>📊 Base de clientes:</strong> {clientCount} clientes únicos que já fizeram pedidos no seu estabelecimento.
                                </p>
                                {estabelecimentoWhatsApp && (
                                    <p className="text-sm text-green-700 mt-1">
                                        <strong>📞 Remetente:</strong> {estabelecimentoWhatsApp} ({estabelecimentoNome})
                                    </p>
                                )}
                            </div>

                            <textarea
                                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-4 resize-none transition duration-150"
                                rows="6"
                                placeholder={`Digite a mensagem que será enviada para todos os clientes via WhatsApp...`}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={isSending || !estabelecimentoWhatsApp}
                            />
                            
                            <div className="flex w-full gap-3">
                                <button
                                    onClick={handleSendEstablishmentMessage}
                                    disabled={isSending || !message.trim() || clientCount === 0 || !estabelecimentoWhatsApp}
                                    className={`flex-1 inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                                        isSending || !message.trim() || clientCount === 0 || !estabelecimentoWhatsApp
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform hover:scale-105 transition duration-200'
                                    }`}
                                >
                                    {isSending ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Enviando...
                                        </>
                                    ) : !estabelecimentoWhatsApp ? (
                                        "❌ WhatsApp Não Configurado"
                                    ) : (
                                        `📤 Enviar para ${clientCount} Clientes`
                                    )}
                                </button>

                                <button
                                    onClick={() => setMessage('')}
                                    disabled={isSending || !message.trim()}
                                    className="px-4 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition duration-200"
                                >
                                    Limpar
                                </button>
                            </div>

                            {sendResult && (
                                <div className={`mt-4 p-4 rounded-lg border ${
                                    sendResult.status === 'success' 
                                        ? 'bg-green-100 text-green-800 border-green-300' 
                                        : 'bg-red-100 text-red-800 border-red-300'
                                }`}>
                                    <div className="font-semibold">
                                        {sendResult.status === 'success' ? '✅ Sucesso!' : '❌ Erro'}
                                    </div>
                                    <div className="text-sm mt-1">{sendResult.details}</div>
                                    {sendResult.data && sendResult.data.whatsappEstabelecimento && (
                                        <div className="text-xs mt-2 text-green-700">
                                            <strong>WhatsApp:</strong> {sendResult.data.whatsappEstabelecimento}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SIDEBAR */}
                    <div className="space-y-6">
                        {/* TEMPLATES */}
                        <div className="bg-white p-6 rounded-2xl shadow border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                💡 Templates Prontos
                            </h3>
                            <div className="space-y-2">
                                {messageTemplates.map((template, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setMessage(template.message)}
                                        disabled={isSending || !estabelecimentoWhatsApp}
                                        className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 transition duration-200 hover:border-blue-300"
                                    >
                                        <div className="font-medium text-gray-800">{template.title}</div>
                                        <div className="text-gray-600 text-xs mt-1 truncate">
                                            {template.message.substring(0, 60)}...
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* INFO WHATSAPP */}
                        <div className="bg-white p-4 rounded-2xl shadow border border-blue-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                <FaWhatsapp className="text-blue-500" />
                                Info WhatsApp
                            </h3>
                            <div className="text-sm text-gray-600 space-y-2">
                                {estabelecimentoWhatsApp ? (
                                    <>
                                        <p><strong>Estabelecimento:</strong> {estabelecimentoNome}</p>
                                        <p><strong>Número WhatsApp:</strong> {estabelecimentoWhatsApp}</p>
                                        <p className="text-green-600">✅ Configurado e pronto para envio</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-red-600"><strong>Status:</strong> Não configurado</p>
                                        <p className="text-sm">Configure o WhatsApp do estabelecimento para enviar mensagens.</p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* DEBUG INFO */}
                        {debugInfo && (
                            <div className="bg-white p-4 rounded-2xl shadow border border-yellow-200">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                    <FaBug className="text-yellow-500" />
                                    Debug Info
                                </h3>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p><strong>Pedidos:</strong> {debugInfo.totalPedidos}</p>
                                    <p><strong>Estabelecimento:</strong> {debugInfo.estabelecimentoId}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withEstablishmentAuth(ClientManagement);