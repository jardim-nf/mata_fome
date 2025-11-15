// functions/index.js - VERSÃO MULTI-CLIENTES COM WHATSAPP BUSINESS
import { onRequest, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import cors from 'cors';

// Inicializa app admin apenas uma vez
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

const corsHandler = cors({
  origin: ['https://appdeufome.netlify.app', 'http://localhost:5173'],
  methods: ['POST', 'OPTIONS', 'GET'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// ==============================================================================
// 🆕 FUNÇÕES WHATSAPP BUSINESS MULTI-CLIENTES
// ==============================================================================

/**
 * 🆕 CONFIGURAR WHATSAPP BUSINESS DO CLIENTE
 */
export const configurarWhatsAppBusiness = onCall(async (event) => {
    if (!event.auth) {
        throw new Error('Não autorizado.');
    }

    const { token } = event.auth;
    const estabelecimentoId = token.estabelecimentosGerenciados?.[0];
    
    if (!estabelecimentoId) {
        throw new Error('Usuário não gerencia nenhum estabelecimento.');
    }

    const { access_token, phone_id, business_id, numero_whatsapp } = event.data;

    if (!access_token || !phone_id) {
        throw new Error('Access Token e Phone ID são obrigatórios.');
    }

    try {
        console.log(`🔧 Configurando WhatsApp Business para: ${estabelecimentoId}`);
        
        // Testar a configuração antes de salvar
        const testResult = await testWhatsAppConfig(access_token, phone_id);
        
        if (!testResult.success) {
            throw new Error(`Configuração inválida: ${testResult.error}`);
        }

        // 🆕 SALVAR CONFIGURAÇÃO WHATSAPP BUSINESS
        await db.collection('estabelecimentos').doc(estabelecimentoId).update({
            whatsapp_business: {
                access_token: access_token,
                phone_id: phone_id,
                business_id: business_id || '',
                numero_whatsapp: numero_whatsapp || '',
                configured_at: new Date(),
                status: 'ativo'
            }
        });

        console.log(`✅ WhatsApp Business configurado para: ${estabelecimentoId}`);

        return {
            success: true,
            message: 'WhatsApp Business configurado com sucesso!',
            estabelecimentoId: estabelecimentoId
        };

    } catch (error) {
        console.error('❌ Erro ao configurar WhatsApp:', error);
        throw new Error('Falha na configuração: ' + error.message);
    }
});

/**
 * 🆕 TESTAR CONFIGURAÇÃO WHATSAPP BUSINESS
 */
export const testarConfiguracaoWhatsApp = onCall(async (event) => {
    if (!event.auth) {
        throw new Error('Não autorizado.');
    }

    const { access_token, phone_id } = event.data;

    if (!access_token || !phone_id) {
        throw new Error('Access Token e Phone ID são obrigatórios.');
    }

    try {
        const testResult = await testWhatsAppConfig(access_token, phone_id);
        
        return {
            success: testResult.success,
            message: testResult.success ? 
                '✅ Configuração testada com sucesso!' : 
                `❌ Erro: ${testResult.error}`,
            debug: testResult.debug
        };

    } catch (error) {
        console.error('❌ Erro no teste:', error);
        throw new Error('Falha no teste: ' + error.message);
    }
});

/**
 * 🆕 VERIFICAR CONFIGURAÇÃO WHATSAPP BUSINESS
 */
export const verificarConfiguracaoWhatsApp = onCall(async (event) => {
    if (!event.auth) {
        throw new Error('Não autorizado.');
    }

    const { token } = event.auth;
    const estabelecimentoId = token.estabelecimentosGerenciados?.[0];
    
    if (!estabelecimentoId) {
        throw new Error('Usuário não gerencia nenhum estabelecimento.');
    }

    try {
        const estabelecimentoDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
        
        if (!estabelecimentoDoc.exists) {
            throw new Error('Estabelecimento não encontrado.');
        }

        const estabelecimentoData = estabelecimentoDoc.data();
        const whatsappConfig = estabelecimentoData.whatsapp_business;
        const nomeEstabelecimento = estabelecimentoData.nome || 'Estabelecimento';

        return {
            success: true,
            configurado: !!whatsappConfig,
            estabelecimento: {
                id: estabelecimentoId,
                nome: nomeEstabelecimento,
                whatsapp_config: whatsappConfig
            },
            message: whatsappConfig ? 
                `✅ WhatsApp Business configurado` : 
                `❌ WhatsApp Business não configurado`
        };

    } catch (error) {
        console.error('❌ Erro ao verificar configuração:', error);
        throw new Error('Falha ao verificar: ' + error.message);
    }
});

/**
 * 🆕 ENVIO COM WHATSAPP BUSINESS (USA CONFIG DO CLIENTE)
 */
export const enviarMensagemWhatsAppBusiness = onCall(async (event) => {
    if (!event.auth) {
        throw new Error('Não autorizado. Faça login para acessar esta função.');
    }

    const { token } = event.auth;
    const { message } = event.data;

    const estabelecimentoId = token.estabelecimentosGerenciados?.[0];
    
    if (!estabelecimentoId) {
        throw new Error('Usuário não gerencia nenhum estabelecimento.');
    }

    if (!message?.trim()) {
        throw new Error('A mensagem não pode ser vazia.');
    }

    try {
        console.log(`🚀 Iniciando envio WhatsApp Business para: ${estabelecimentoId}`);
        
        // 🔥 BUSCAR CONFIGURAÇÃO DO ESTABELECIMENTO
        const estabelecimentoDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
        
        if (!estabelecimentoDoc.exists) {
            throw new Error('Estabelecimento não encontrado.');
        }

        const estabelecimentoData = estabelecimentoDoc.data();
        const whatsappConfig = estabelecimentoData.whatsapp_business;
        const nomeEstabelecimento = estabelecimentoData.nome || 'Estabelecimento';

        // 🔥 VERIFICAR SE TEM WHATSAPP BUSINESS CONFIGURADO
        if (!whatsappConfig) {
            throw new Error(`❌ ${nomeEstabelecimento} não possui WhatsApp Business configurado.`);
        }

        console.log(`🏪 Estabelecimento: ${nomeEstabelecimento}`);
        console.log(`📞 Phone ID: ${whatsappConfig.phone_id}`);

        // BUSCAR PEDIDOS DO ESTABELECIMENTO
        const pedidosRef = db.collection('pedidos');
        const pedidosSnapshot = await pedidosRef
            .where('estabelecimentoId', '==', estabelecimentoId)
            .get();

        if (pedidosSnapshot.empty) {
            return { 
                success: true, 
                uniqueClientCount: 0,
                message: 'Nenhum pedido encontrado para este estabelecimento.' 
            };
        }

        const uniquePhones = new Set();
        const clientesInfo = new Map();

        pedidosSnapshot.forEach(doc => {
            const pedido = doc.data();
            const pedidoId = doc.id;
            
            let phone = null;
            let nomeCliente = 'Cliente';

            if (pedido.telefone) {
                phone = cleanPhoneNumber(pedido.telefone);
            } else if (pedido.clienteTelefone) {
                phone = cleanPhoneNumber(pedido.clienteTelefone);
            } else if (pedido.phone) {
                phone = cleanPhoneNumber(pedido.phone);
            } else if (pedido.userPhone) {
                phone = cleanPhoneNumber(pedido.userPhone);
            } else if (pedido.cliente?.telefone) {
                phone = cleanPhoneNumber(pedido.cliente.telefone);
            }

            if (pedido.clienteNome) {
                nomeCliente = pedido.clienteNome;
            } else if (pedido.userName) {
                nomeCliente = pedido.userName;
            } else if (pedido.nome) {
                nomeCliente = pedido.nome;
            } else if (pedido.cliente?.nome) {
                nomeCliente = pedido.cliente.nome;
            }
            
            if (phone && isValidPhone(phone)) {
                uniquePhones.add(phone);
                
                if (!clientesInfo.has(phone)) {
                    clientesInfo.set(phone, {
                        nome: nomeCliente,
                        totalPedidos: 0,
                        pedidosIds: []
                    });
                }
                
                const cliente = clientesInfo.get(phone);
                cliente.totalPedidos++;
                cliente.pedidosIds.push(pedidoId);
            }
        });

        const uniquePhonesArray = Array.from(uniquePhones);
        
        if (uniquePhonesArray.length === 0) {
            return { 
                success: true, 
                uniqueClientCount: 0,
                message: 'Nenhum número de telefone válido encontrado nos pedidos.' 
            };
        }

        console.log(`📞 Preparando envio para ${uniquePhonesArray.length} clientes únicos`);

        let successCount = 0;
        let failedCount = 0;
        const failedNumbers = [];

        for (const phone of uniquePhonesArray) {
            try {
                const clienteInfo = clientesInfo.get(phone);
                const nomeCliente = clienteInfo?.nome || 'Cliente';
                
                const mensagemPersonalizada = personalizeMessage(message, nomeCliente, clienteInfo);
                
                console.log(`📤 [${successCount + failedCount + 1}/${uniquePhonesArray.length}] Enviando para ${phone} (${nomeCliente})`);
                
                // 🔥 USA A CONFIGURAÇÃO WHATSAPP BUSINESS DO CLIENTE
                const result = await sendWhatsAppBusinessMessage(
                    phone, 
                    mensagemPersonalizada, 
                    whatsappConfig.access_token,
                    whatsappConfig.phone_id,
                    nomeEstabelecimento
                );
                
                if (result.success) {
                    successCount++;
                } else {
                    failedCount++;
                    failedNumbers.push({
                        phone: maskPhone(phone),
                        nome: nomeCliente,
                        error: result.error
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                failedCount++;
                failedNumbers.push({
                    phone: maskPhone(phone),
                    nome: clientesInfo.get(phone)?.nome || 'Cliente',
                    error: error.message
                });
            }
        }

        const historyData = {
            message,
            totalClients: uniquePhonesArray.length,
            successCount,
            failedCount,
            sentAt: new Date(),
            estabelecimentoId,
            estabelecimentoNome: nomeEstabelecimento,
            sentBy: token.uid,
            tipo: 'whatsapp_business'
        };

        await saveMessageHistory(historyData);

        console.log(`🎯 ENVIO CONCLUÍDO: ${successCount} sucessos, ${failedCount} falhas`);

        return {
            success: true,
            uniqueClientCount: uniquePhonesArray.length,
            successCount,
            failedCount,
            estabelecimentoId: estabelecimentoId,
            estabelecimentoNome: nomeEstabelecimento,
            message: `✅ Mensagem enviada via WhatsApp Business de ${nomeEstabelecimento} para ${successCount} de ${uniquePhonesArray.length} clientes.`,
            summary: {
                total: uniquePhonesArray.length,
                success: successCount,
                failed: failedCount
            }
        };

    } catch (error) {
        console.error('💥 ERRO CRÍTICO:', error);
        throw new Error('Falha ao processar envio: ' + error.message);
    }
});

// ==============================================================================
// 🆕 FUNÇÕES AUXILIARES WHATSAPP BUSINESS
// ==============================================================================

/**
 * Testa a configuração do WhatsApp Business
 */
const testWhatsAppConfig = async (accessToken, phoneId) => {
    try {
        const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        const data = await response.json();
        
        if (data.error) {
            return { 
                success: false, 
                error: data.error.message,
                debug: data
            };
        }
        
        return { 
            success: true,
            debug: data
        };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
};

/**
 * Envia mensagem usando WhatsApp Business API
 */
const sendWhatsAppBusinessMessage = async (phoneNumber, message, accessToken, phoneId, nomeEstabelecimento) => {
    try {
        console.log(`📱 ENVIANDO de ${nomeEstabelecimento} (${phoneId}) para +${phoneNumber}`);
        
        const response = await fetch(`https://graph.facebook.com/v17.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "text",
                text: { 
                    body: `💬 ${nomeEstabelecimento}: ${message}` 
                }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            console.error('❌ Erro WhatsApp Business:', data.error);
            return { 
                success: false, 
                error: data.error.message 
            };
        }
        
        console.log(`✅ WhatsApp Business enviado: ${data.messages?.[0]?.id}`);
        return { 
            success: true, 
            messageId: data.messages?.[0]?.id 
        };
        
    } catch (error) {
        console.error('💥 Erro no envio WhatsApp Business:', error);
        return { success: false, error: error.message };
    }
};

// ==============================================================================
// 🔄 MANTENDO SUAS FUNÇÕES EXISTENTES (COM CORREÇÕES)
// ==============================================================================

// SUAS FUNÇÕES EXISTENTES AQUI (fixUserEstablishment, debugEstabelecimentoPedidos, checkWhatsAppConfig, etc.)
// ... [TODO SEU CÓDIGO ATUAL AQUI] ...

// ==============================================================================
// 🛠️ ATUALIZANDO A FUNÇÃO checkWhatsAppConfig EXISTENTE
// ==============================================================================

// 🔄 SUBSTITUA sua função checkWhatsAppConfig por esta versão atualizada:
export const checkWhatsAppConfig = onCall(async (event) => {
    if (!event.auth) {
        throw new Error('Não autorizado.');
    }

    const { token } = event.auth;
    const estabelecimentoId = token.estabelecimentosGerenciados?.[0];
    
    if (!estabelecimentoId) {
        throw new Error('Usuário não gerencia nenhum estabelecimento.');
    }

    try {
        const estabelecimentoDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
        
        if (!estabelecimentoDoc.exists) {
            throw new Error('Estabelecimento não encontrado.');
        }

        const estabelecimentoData = estabelecimentoDoc.data();
        
        // 🆕 VERIFICA AMBAS AS CONFIGURAÇÕES
        const telefoneWhatsapp = estabelecimentoData.informacoes_contato?.telefone_whatsapp; 
        const whatsappBusiness = estabelecimentoData.whatsapp_business;
        const nomeEstabelecimento = estabelecimentoData.nome;

        const configurado = !!telefoneWhatsapp || !!whatsappBusiness;
        
        return {
            success: true,
            configurado: configurado,
            tipo: whatsappBusiness ? 'business' : (telefoneWhatsapp ? 'simples' : 'nenhum'),
            estabelecimento: {
                id: estabelecimentoId,
                nome: nomeEstabelecimento,
                telefoneWhatsapp: telefoneWhatsapp,
                whatsapp_business: whatsappBusiness
            },
            message: configurado ? 
                `✅ WhatsApp ${whatsappBusiness ? 'Business' : 'Simples'} configurado` : 
                `❌ WhatsApp não configurado para ${nomeEstabelecimento}`
        };

    } catch (error) {
        console.error('❌ Erro ao verificar configuração:', error);
        throw new Error('Falha ao verificar configuração: ' + error.message);
    }
});

// ==============================================================================
// 🔄 MANTENDO SUAS FUNÇÕES ORIGINAIS
// ==============================================================================

// ... [COLE AQUI TODAS AS SUAS OUTRAS FUNÇÕES EXISTENTES] ...
// fixUserEstablishment, debugEstabelecimentoPedidos, countEstablishmentClientsCallable, 
// sendEstablishmentMessageCallable, testWhatsAppEnvioReal, createUserByMasterAdminHttp, 
// syncUserClaims, onUserUpdateSyncClaims, refreshUserToken

// ==============================================================================
// 🔄 MANTENDO SUAS FUNÇÕES AUXILIARES EXISTENTES
// ==============================================================================

// ... [COLE AQUI SUAS FUNÇÕES cleanPhoneNumber, isValidPhone, personalizeMessage, maskPhone, etc.] ...

console.log('✅ Todas as Cloud Functions carregadas com sucesso!');
console.log('🚀 SISTEMA MULTI-CLIENTES WHATSAPP BUSINESS - PRONTO!');