// functions/index.js - VERSÃO COMPLETA MULTI-CLIENTES
import { onRequest, onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Inicializa app admin apenas uma vez
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// ==============================================================================
// 🛠️ FUNÇÕES AUXILIARES
// ==============================================================================

/**
 * Limpa e formata número de telefone
 */
const cleanPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove tudo que não é dígito
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // Se começar com 55 (Brasil), mantém, senão adiciona
  if (cleaned.startsWith('55') && cleaned.length === 12) {
    return cleaned; // +55 11 99999-9999 -> 5511999999999
  } else if (cleaned.length === 11) {
    return '55' + cleaned; // 11 99999-9999 -> 5511999999999
  } else if (cleaned.length === 13 && cleaned.startsWith('55')) {
    return cleaned; // Já está no formato correto
  }
  
  return null;
};

/**
 * Valida se o telefone é válido
 */
const isValidPhone = (phone) => {
  if (!phone) return false;
  // Formato: 5511999999999 (13 dígitos com DDD)
  return phone.length === 13 && phone.startsWith('55');
};

/**
 * Personaliza mensagem com nome do cliente
 */
const personalizeMessage = (message, clienteNome, clienteInfo = null) => {
  let personalized = message
    .replace(/{nome}/gi, clienteNome)
    .replace(/{cliente}/gi, clienteNome);
  
  if (clienteInfo) {
    personalized = personalized
      .replace(/{total_pedidos}/gi, clienteInfo.totalPedidos.toString())
      .replace(/{pedidos}/gi, clienteInfo.totalPedidos.toString());
  }
  
  return personalized;
};

/**
 * Mascara telefone para logs
 */
const maskPhone = (phone) => {
  if (!phone) return 'N/A';
  return `${phone.substring(0, 4)}*****${phone.substring(9)}`;
};

/**
 * Salva histórico de mensagens
 */
const saveMessageHistory = async (historyData) => {
  try {
    const historyRef = db.collection('message_history').doc();
    await historyRef.set({
      ...historyData,
      id: historyRef.id
    });
    console.log('📝 Histórico salvo:', historyRef.id);
  } catch (error) {
    console.error('❌ Erro ao salvar histórico:', error);
  }
};

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
// 👤 FUNÇÕES DE USUÁRIO E AUTENTICAÇÃO
// ==============================================================================

/**
 * ✅ CRIAR USUÁRIO POR MASTER ADMIN (COLEÇÃO CORRIGIDA)
 */
export const createUserByMasterAdminHttp = onRequest({ 
  cors: ['https://appdeufome.netlify.app', 'http://localhost:5173'] 
}, async (req, res) => {
  
  console.log('📥 Recebida requisição para criar usuário');
  console.log('📧 Email:', req.body?.email);
  console.log('🔧 Método:', req.method);
  console.log('🌐 Origin:', req.headers.origin);

  try {
    // Verificar método
    if (req.method === 'OPTIONS') {
      console.log('🔄 Preflight request recebido');
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Verificar método POST
    if (req.method !== 'POST') {
      console.log('❌ Método não permitido:', req.method);
      res.status(405).json({
        success: false,
        error: 'Método não permitido. Use POST.'
      });
      return;
    }

    const { 
      nome, 
      email, 
      senha, 
      estabelecimentos = [], 
      isAdmin = false, 
      isMasterAdmin = false,
      ativo = true 
    } = req.body;

    console.log('📋 Dados recebidos:', { nome, email, isAdmin, isMasterAdmin });

    // Validações
    if (!nome || !email || !senha) {
      console.log('❌ Dados obrigatórios faltando');
      res.status(400).json({
        success: false,
        error: 'Nome, email e senha são obrigatórios'
      });
      return;
    }

    if (senha.length < 6) {
      console.log('❌ Senha muito curta');
      res.status(400).json({
        success: false,
        error: 'A senha deve ter pelo menos 6 caracteres'
      });
      return;
    }

    // Verificar se email já existe
    try {
      await auth.getUserByEmail(email.toLowerCase().trim());
      console.log('❌ Email já existe:', email);
      res.status(400).json({
        success: false,
        error: 'Este email já está em uso'
      });
      return;
    } catch (error) {
      // Usuário não existe, podemos continuar
      console.log('✅ Email disponível:', email);
    }

    // Criar usuário no Firebase Auth
    console.log('👤 Criando usuário no Firebase Auth...');
    const userRecord = await auth.createUser({
      email: email.toLowerCase().trim(),
      password: senha,
      displayName: nome.trim(),
      disabled: !ativo
    });

    console.log('✅ Usuário criado no Auth:', userRecord.uid);

    // Configurar custom claims
    const customClaims = {
      isAdmin: Boolean(isAdmin),
      isMasterAdmin: Boolean(isMasterAdmin),
      estabelecimentosGerenciados: Array.isArray(estabelecimentos) ? estabelecimentos : []
    };
    
    await auth.setCustomUserClaims(userRecord.uid, customClaims);
    console.log('✅ Custom claims configuradas');

    // Preparar dados para Firestore
    const userData = {
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      isAdmin: Boolean(isAdmin),
      isMasterAdmin: Boolean(isMasterAdmin),
      ativo: Boolean(ativo),
      estabelecimentosGerenciados: Array.isArray(estabelecimentos) ? estabelecimentos : [],
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
      criadoPor: req.headers['x-user-id'] || 'master-admin-system'
    };

    // ✅ CORREÇÃO: Salvar na coleção 'usuarios' (minúsculo)
    console.log('💾 Salvando dados no Firestore (coleção usuarios)...');
    await db.collection('usuarios')  // ✅ COLETION CORRIGIDA: 'usuarios'
      .doc(userRecord.uid)
      .set(userData);

    console.log(`✅ Usuário criado com sucesso: ${userRecord.uid} (${email})`);

    // Response com CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.status(200).json({
      success: true,
      userId: userRecord.uid,
      userData: {
        ...userData,
        id: userRecord.uid
      },
      message: 'Usuário criado com sucesso!'
    });

  } catch (error) {
    console.error('💥 ERRO CRÍTICO ao criar usuário:', error);
    
    let errorMessage = 'Erro interno do servidor';
    let statusCode = 500;

    switch (error.code) {
      case 'auth/email-already-exists':
        errorMessage = 'Este email já está em uso';
        statusCode = 400;
        break;
      case 'auth/invalid-email':
        errorMessage = 'Email inválido';
        statusCode = 400;
        break;
      case 'auth/weak-password':
        errorMessage = 'Senha muito fraca';
        statusCode = 400;
        break;
      case 'auth/operation-not-allowed':
        errorMessage = 'Operação não permitida';
        statusCode = 403;
        break;
    }

    // Response de erro com CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 🔄 SINCRONIZAR CLAIMS DO USUÁRIO
 */
export const syncUserClaims = onCall(async (event) => {
  if (!event.auth) {
    throw new Error('Não autorizado.');
  }

  const { userId } = event.data;

  if (!userId) {
    throw new Error('ID do usuário é obrigatório.');
  }

  try {
    // ✅ CORREÇÃO: Buscar na coleção 'usuarios'
    const userDoc = await db.collection('usuarios').doc(userId).get();  // ✅ 'usuarios'
    
    if (!userDoc.exists) {
      throw new Error('Usuário não encontrado no Firestore.');
    }

    const userData = userDoc.data();
    
    // Atualizar custom claims
    const customClaims = {
      isAdmin: Boolean(userData.isAdmin),
      isMasterAdmin: Boolean(userData.isMasterAdmin),
      estabelecimentosGerenciados: Array.isArray(userData.estabelecimentosGerenciados) 
        ? userData.estabelecimentosGerenciados 
        : []
    };

    await auth.setCustomUserClaims(userId, customClaims);
    
    console.log(`✅ Claims sincronizadas para usuário: ${userId}`);
    
    return {
      success: true,
      message: 'Claims sincronizadas com sucesso!',
      claims: customClaims
    };

  } catch (error) {
    console.error('❌ Erro ao sincronizar claims:', error);
    throw new Error('Falha ao sincronizar claims: ' + error.message);
  }
});

/**
 * 🔄 LISTENER: Atualizar claims quando usuário for atualizado no Firestore
 */
export const onUserUpdateSyncClaims = onDocumentWritten('usuarios/{userId}', async (event) => {  // ✅ 'usuarios'
  try {
    const userId = event.params.userId;
    const afterData = event.data.after.data();

    if (!afterData) {
      console.log('📝 Usuário deletado, ignorando...');
      return;
    }

    console.log(`🔄 Sincronizando claims para usuário: ${userId}`);

    // Atualizar custom claims
    const customClaims = {
      isAdmin: Boolean(afterData.isAdmin),
      isMasterAdmin: Boolean(afterData.isMasterAdmin),
      estabelecimentosGerenciados: Array.isArray(afterData.estabelecimentosGerenciados) 
        ? afterData.estabelecimentosGerenciados 
        : []
    };

    await auth.setCustomUserClaims(userId, customClaims);
    
    console.log(`✅ Claims atualizadas automaticamente para: ${userId}`);

  } catch (error) {
    console.error('❌ Erro no listener de atualização de claims:', error);
  }
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
 * ENVIO COM WHATSAPP BUSINESS (USA CONFIG DO CLIENTE)
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
// 🖼️ FUNÇÕES DE STORAGE E UPLOAD
// ==============================================================================

/**
 * ✅ UPLOAD DE IMAGEM BASE64 PARA FIREBASE STORAGE
 */
export const uploadBase64Image = onCall(async (event) => {
  if (!event.auth) {
    throw new Error('Não autorizado.');
  }

  const { base64String, fileName, folder = 'images' } = event.data;

  if (!base64String || !fileName) {
    throw new Error('Base64 string e nome do arquivo são obrigatórios.');
  }

  try {
    // Extrair o conteúdo base64 (remover data:image/... prefixo)
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    // Criar buffer from base64
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Definir caminho no storage
    const filePath = `${folder}/${Date.now()}_${fileName}`;
    const file = storage.bucket().file(filePath);
    
    // Detectar content type
    const contentType = base64String.includes('image/png') ? 'image/png' : 
                       base64String.includes('image/jpeg') ? 'image/jpeg' : 
                       base64String.includes('image/gif') ? 'image/gif' : 
                       'image/jpeg';
    
    // Fazer upload
    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType,
        metadata: {
          firebaseStorageDownloadTokens: Math.random().toString(36).substring(2)
        }
      }
    });
    
    // Tornar o arquivo público
    await file.makePublic();
    
    // Obter URL pública
    const publicUrl = `https://storage.googleapis.com/${storage.bucket().name}/${filePath}`;
    
    console.log('✅ Imagem uploadada com sucesso:', publicUrl);
    
    return {
      success: true,
      url: publicUrl,
      filePath: filePath
    };

  } catch (error) {
    console.error('❌ Erro no upload da imagem:', error);
    throw new Error('Falha no upload da imagem: ' + error.message);
  }
});

// ==============================================================================
// 🔄 FUNÇÕES EXISTENTES DE ESTABELECIMENTO
// ==============================================================================

/**
 * 🔧 CORRIGIR ESTABELECIMENTO DO USUÁRIO
 */
export const fixUserEstablishment = onCall(async (event) => {
  if (!event.auth) {
    throw new Error('Não autorizado.');
  }

  const { userId, estabelecimentoId } = event.data;

  if (!userId || !estabelecimentoId) {
    throw new Error('ID do usuário e estabelecimento são obrigatórios.');
  }

  try {
    // ✅ JÁ ESTÁ CORRETO: Atualizar Firestore na coleção 'usuarios'
    await db.collection('usuarios').doc(userId).update({
      estabelecimentosGerenciados: [estabelecimentoId]
    });

    // Atualizar Custom Claims
    await auth.setCustomUserClaims(userId, {
      estabelecimentosGerenciados: [estabelecimentoId]
    });

    console.log(`✅ Estabelecimento corrigido para usuário: ${userId}`);

    return {
      success: true,
      message: 'Estabelecimento corrigido com sucesso!'
    };

  } catch (error) {
    console.error('❌ Erro ao corrigir estabelecimento:', error);
    throw new Error('Falha ao corrigir estabelecimento: ' + error.message);
  }
});

/**
 * 🐛 DEBUG: VERIFICAR PEDIDOS DO ESTABELECIMENTO
 */
export const debugEstabelecimentoPedidos = onCall(async (event) => {
  if (!event.auth) {
    throw new Error('Não autorizado.');
  }

  const { token } = event.auth;
  const estabelecimentoId = token.estabelecimentosGerenciados?.[0];
  
  if (!estabelecimentoId) {
    throw new Error('Usuário não gerencia nenhum estabelecimento.');
  }

  try {
    const pedidosRef = db.collection('pedidos');
    const pedidosSnapshot = await pedidosRef
      .where('estabelecimentoId', '==', estabelecimentoId)
      .get();

    const pedidosData = [];
    const telefonesUnicos = new Set();

    pedidosSnapshot.forEach(doc => {
      const pedido = doc.data();
      pedidosData.push({
        id: doc.id,
        ...pedido
      });

      // Coletar telefones
      if (pedido.telefone) telefonesUnicos.add(pedido.telefone);
      if (pedido.clienteTelefone) telefonesUnicos.add(pedido.clienteTelefone);
      if (pedido.phone) telefonesUnicos.add(pedido.phone);
      if (pedido.userPhone) telefonesUnicos.add(pedido.userPhone);
      if (pedido.cliente?.telefone) telefonesUnicos.add(pedido.cliente.telefone);
    });

    return {
      success: true,
      estabelecimentoId: estabelecimentoId,
      totalPedidos: pedidosSnapshot.size,
      telefonesUnicos: Array.from(telefonesUnicos),
      pedidos: pedidosData.slice(0, 10) // Limitar para não sobrecarregar
    };

  } catch (error) {
    console.error('❌ Erro no debug:', error);
    throw new Error('Falha no debug: ' + error.message);
  }
});

/**
 * 📊 CONTAR CLIENTES DO ESTABELECIMENTO
 */
export const countEstablishmentClientsCallable = onCall(async (event) => {
  if (!event.auth) {
    throw new Error('Não autorizado.');
  }

  const { token } = event.auth;
  const estabelecimentoId = token.estabelecimentosGerenciados?.[0];
  
  if (!estabelecimentoId) {
    throw new Error('Usuário não gerencia nenhum estabelecimento.');
  }

  try {
    const pedidosRef = db.collection('pedidos');
    const pedidosSnapshot = await pedidosRef
      .where('estabelecimentoId', '==', estabelecimentoId)
      .get();

    const uniquePhones = new Set();

    pedidosSnapshot.forEach(doc => {
      const pedido = doc.data();
      
      let phone = null;

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

      if (phone && isValidPhone(phone)) {
        uniquePhones.add(phone);
      }
    });

    return {
      success: true,
      estabelecimentoId: estabelecimentoId,
      uniqueClientCount: uniquePhones.size,
      message: `Encontrados ${uniquePhones.size} clientes únicos`
    };

  } catch (error) {
    console.error('❌ Erro ao contar clientes:', error);
    throw new Error('Falha ao contar clientes: ' + error.message);
  }
});

/**
 * 🔄 VERIFICAR CONFIGURAÇÃO WHATSAPP (COMPATIBILIDADE)
 */
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
// 🚀 INICIALIZAÇÃO E LOGS
// ==============================================================================

console.log('✅ Todas as Cloud Functions carregadas com sucesso!');
console.log('🚀 SISTEMA MULTI-CLIENTES WHATSAPP BUSINESS - PRONTO!');
console.log('📞 Funções WhatsApp Business disponíveis');
console.log('👤 Funções de usuário e autenticação disponíveis');
console.log('🖼️ Funções de upload de imagens disponíveis');