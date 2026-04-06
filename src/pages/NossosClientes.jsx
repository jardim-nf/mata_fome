// src/pages/ClientManagement.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { FaArrowLeft, FaWhatsapp, FaEnvelopeOpenText, FaUsers, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import BackButton from '../components/BackButton';

/**
 * Componente para o administrador de um estabelecimento enviar mensagens em massa
 * APENAS para os clientes que já fizeram pedidos nesse estabelecimento.
 */
function ClientManagement({ estabelecimentoPrincipal }) {
    const { currentUser, userData } = useAuth();
    const navigate = useNavigate();

    // Pega o ID do estabelecimento que o usuário está gerenciando
    const estabelecimentoId = estabelecimentoPrincipal;
    const [estabelecimentoNome, setEstabelecimentoNome] = useState('Carregando...');

    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);
    const [clientCount, setClientCount] = useState(null); 
    const [loadingCount, setLoadingCount] = useState(true);
    const [messageHistory, setMessageHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Busca o nome real do estabelecimento no Firestore
    useEffect(() => {
        const fetchNomeEstabelecimento = async () => {
            if (estabelecimentoId) {
                try {
                    const docRef = doc(db, "estabelecimentos", estabelecimentoId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setEstabelecimentoNome(docSnap.data().nome || 'Seu Estabelecimento');
                    } else {
                        setEstabelecimentoNome('Seu Estabelecimento');
                    }
                } catch (error) {
                    console.error("Erro ao buscar nome do estabelecimento:", error);
                    setEstabelecimentoNome('Seu Estabelecimento');
                }
            }
        };
        fetchNomeEstabelecimento();
    }, [estabelecimentoId]);

    // FUNÇÃO: BUSCA A CONTAGEM REAL NO BACKEND
    const fetchClientCount = useCallback(async () => {
        if (!estabelecimentoId) return;

        setLoadingCount(true);
        try {
            const pedidosRef = collection(db, 'estabelecimentos', estabelecimentoId, 'pedidos');
            const snap = await getDocs(pedidosRef);
            
            // Usamos um Set para guardar telefones únicos
            const uniquePhones = new Set();
            
            snap.forEach(docSnap => {
                const data = docSnap.data();
                const phone = data?.cliente?.telefone;
                if (phone && phone.trim() !== '') {
                    // Normaliza o telefone removendo caracteres não numéricos
                    const cleanPhone = phone.replace(/\D/g, '');
                    if (cleanPhone.length >= 10) {
                        uniquePhones.add(cleanPhone);
                    }
                }
            });
            
            setClientCount(uniquePhones.size);
        } catch (error) {
            console.error("Erro ao buscar contagem de clientes:", error);
            toast.error("Erro ao carregar o número de clientes.");
            setClientCount(0); 
        } finally {
            setLoadingCount(false);
        }
    }, [estabelecimentoId]);

    // FUNÇÃO: CARREGAR HISTÓRICO DE MENSAGENS
    const fetchMessageHistory = useCallback(async () => {
        if (!estabelecimentoId) return;

        setLoadingHistory(true);
        try {
            const campSnap = await getDocs(
                query(
                    collection(db, 'estabelecimentos', estabelecimentoId, 'campanhas'),
                    where('tipo', '==', 'envio_massa'),
                    orderBy('enviadoEm', 'desc'),
                    limit(50)
                )
            );
            setMessageHistory(campSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            setMessageHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }, [estabelecimentoId]);

    // useEffect para buscar dados na montagem
    useEffect(() => {
        if (estabelecimentoId) {
            fetchClientCount();
            fetchMessageHistory();
        }
    }, [estabelecimentoId, fetchClientCount, fetchMessageHistory]);

    // Função para disparar o envio em massa para a Cloud Function
    const handleSendEstablishmentMessage = useCallback(async () => {
        if (isSending || !message.trim()) {
            toast.warn('A mensagem não pode ser vazia.');
            return;
        }

        if (clientCount === 0) {
            toast.info('Não há clientes com histórico de pedidos para enviar a mensagem.');
            return;
        }

        if (!window.confirm(`Tem certeza que deseja enviar esta mensagem via WhatsApp para ${clientCount} clientes que já fizeram pedidos em ${estabelecimentoNome}?`)) {
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            // Chama a Cloud Function de envio REAL
            const sendFunction = httpsCallable(functions, 'sendEstablishmentMessageCallable');
            
            const result = await sendFunction({ 
                estabelecimentoId, 
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
            fetchMessageHistory();

        } catch (err) {
            console.error("Erro ao enviar mensagem do estabelecimento:", err);
            setSendResult({ 
                status: 'error', 
                details: `Falha: ${err.message}`
            });
            toast.error(`❌ Erro: ${err.message}`);

        } finally {
            setIsSending(false);
            // Não limpa a mensagem automaticamente para permitir reenvio
        }
    }, [isSending, message, estabelecimentoId, estabelecimentoNome, clientCount, fetchClientCount, fetchMessageHistory]);

    // Template de mensagens pré-definidas
    const messageTemplates = [
        {
            title: "🔥 Promoção Relâmpago",
            message: `🔥 *PROMOÇÃO RELÂMPAGO* 🔥\n\nOi! Aqui é o *${estabelecimentoNome}*! 😋\n\nSó HOJE: *20% OFF* em todo o cardápio! 🎉\n\nÉ por tempo limitado, não perca! Peça agora pelo nosso delivery 👇\n\n📲 Faça seu pedido e mate essa fome com desconto!`
        },
        {
            title: "🍔 Novidade no Cardápio",
            message: `🍔 *NOVIDADE QUENTINHA!* 🍔\n\nE aí, tudo bem? Aqui é o *${estabelecimentoNome}*!\n\nTemos novidades incríveis no cardápio que você precisa experimentar! 🤤\n\nVem conferir e nos conta o que achou! Peça pelo delivery 🛵💨`
        },
        {
            title: "🎁 Cupom de Fidelidade",
            message: `🎁 *PRESENTE PRA VOCÊ!*\n\nOi! Você é cliente especial do *${estabelecimentoNome}* e queremos te agradecer! ❤️\n\nUse o cupom *FIDEL10* e ganhe *10% OFF* no próximo pedido!\n\n⏰ Válido por 7 dias\n\n📲 Peça agora e aproveite!`
        },
        {
            title: "🚚 Frete Grátis",
            message: `🚚 *FRETE GRÁTIS!* 🎉\n\nOi! O *${estabelecimentoNome}* tá com *entrega GRÁTIS* hoje!\n\nAproveita pra pedir aquele prato que você ama sem pagar nada de taxa! 😍\n\n📲 Corre que é só hoje!`
        },
        {
            title: "⭐ Peça sua Avaliação",
            message: `Oi! Aqui é o *${estabelecimentoNome}*! 😊\n\nVocê pediu com a gente recentemente e queremos saber: *gostou?*\n\n⭐ Sua opinião é super importante pra gente melhorar cada vez mais!\n\nNos conte o que achou, estamos ouvindo! 🙏`
        },
        {
            title: "🍽️ Combo Especial",
            message: `🍽️ *COMBO IMPERDÍVEL!* 🍽️\n\nOi! O *${estabelecimentoNome}* preparou um combo especial pra você!\n\n✅ Prato + Bebida + Sobremesa com preço único!\n\n😋 Só pedir e aproveitar! Válido enquanto durar o estoque.\n\n📲 Peça agora pelo delivery!`
        },
        {
            title: "📅 Horário Especial / Feriado",
            message: `📢 *AVISO IMPORTANTE*\n\nOi! Aqui é o *${estabelecimentoNome}*!\n\nInformamos que nosso horário será diferenciado:\n\n📅 Funcionamento especial neste feriado\n🕐 Das 11h às 22h\n\nPrograme seu pedido! 😉\nEstamos te esperando! 🛵`
        },
        {
            title: "❤️ Agradecimento",
            message: `❤️ *MUITO OBRIGADO!*\n\nOi! Aqui é o *${estabelecimentoNome}*!\n\nPassando pra agradecer por ser nosso cliente! Cada pedido seu faz a diferença pra gente. 🙏\n\nConte sempre com a gente quando bater aquela fome! 😋🛵\n\nAbraço da equipe *${estabelecimentoNome}*! 💚`
        }
    ];

    // Exibição de carregamento
    const displayClientCount = loadingCount ? (
        <span className="text-gray-400">
            <svg className="animate-spin inline-block mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Contando clientes...
        </span>
    ) : (
        <strong className="text-red-600">{clientCount}</strong>
    );

    return (
        <div className="min-h-screen bg-gray-50 py-8 text-sm sm:text-base lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <BackButton className="mb-6" onClick={() => navigate('/dashboard')} />

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center">
                        <FaEnvelopeOpenText className="mr-3 text-red-600" />
                        Comunicação com Clientes
                    </h1>
                    <p className="text-lg text-gray-600">
                        Envie mensagens via WhatsApp para clientes de <strong>{estabelecimentoNome}</strong>
                    </p>
                </div>

                {/* Estatísticas Rápidas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 text-center">
                        <FaUsers className="text-blue-500 text-2xl mx-auto mb-2" />
                        <div className="text-2xl font-bold text-gray-800">{displayClientCount}</div>
                        <div className="text-sm text-gray-600">Clientes Únicos</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 text-center">
                        <FaWhatsapp className="text-green-500 text-2xl mx-auto mb-2" />
                        <div className="text-2xl font-bold text-gray-800">WhatsApp</div>
                        <div className="text-sm text-gray-600">Integração Ativa</div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 text-center">
                        <FaCheckCircle className="text-green-500 text-2xl mx-auto mb-2" />
                        <div className="text-2xl font-bold text-gray-800">Pronto</div>
                        <div className="text-sm text-gray-600">Para Enviar</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Painel Principal de Envio */}
                    <div className="lg:col-span-2">
                        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-red-200">
                            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                                <FaWhatsapp className="mr-2 text-green-500" />
                                Mensagem via WhatsApp
                            </h2>

                            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-800">
                                    <strong>📊 Base de clientes:</strong> {displayClientCount} clientes únicos que já fizeram pedidos no seu estabelecimento.
                                </p>
                            </div>

                            <textarea
                                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4 resize-none transition duration-150"
                                rows="6"
                                placeholder={`Digite a mensagem que será enviada para todos os clientes via WhatsApp. Ex: "Prezado cliente, informamos que ${estabelecimentoNome} terá horário especial neste feriado..."`}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                disabled={isSending || loadingCount}
                            />
                            
                            <div className="flex w-full gap-3">
                                <button
                                    onClick={handleSendEstablishmentMessage}
                                    disabled={isSending || loadingCount || !message.trim() || clientCount === 0}
                                    className={`flex-1 inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                                        isSending || loadingCount || !message.trim() || clientCount === 0
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transform hover:scale-105 transition duration-200'
                                    }`}
                                >
                                    {isSending ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Enviando WhatsApp...
                                        </>
                                    ) : (
                                        `📤 Enviar para ${clientCount !== null ? clientCount : '...'} Clientes`
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
                                    {sendResult.data && (
                                        <div className="text-xs mt-2 p-2 bg-white rounded border">
                                            <pre>{JSON.stringify(sendResult.data, null, 2)}</pre>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Templates e Informações */}
                    <div className="space-y-6">
                        {/* Templates Rápidos */}
                        <div className="bg-white p-6 rounded-2xl shadow border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">
                                💡 Templates Prontos
                            </h3>
                            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                                {messageTemplates.map((template, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setMessage(template.message)}
                                        disabled={isSending}
                                        className="w-full text-left p-3 text-sm bg-gray-50 hover:bg-green-50 rounded-lg border border-gray-200 transition duration-200 hover:border-green-400 hover:shadow-sm"
                                    >
                                        <div className="font-medium text-gray-800">{template.title}</div>
                                        <div className="text-gray-500 text-xs mt-1 truncate">
                                            {template.message.replace(/\\n/g, ' ').replace(/\*/g, '').substring(0, 55)}...
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Informações Importantes */}
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                            <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Importante</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                <li>• Mensagens são enviadas via WhatsApp</li>
                                <li>• Aprox. 1 segundo entre cada envio</li>
                                <li>• Não spam - apenas comunicações importantes</li>
                                <li>• Client base: quem já fez pedidos conosco</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withEstablishmentAuth(ClientManagement);