import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
const whatsappApiToken = defineSecret('WHATSAPP_API_TOKEN');
const openAiApiKey = defineSecret("OPENAI_API_KEY");

// ==================================================================
// 14. WHATSAPP BUSINESS API & UAZAPI E MOTOR FLUXO (HÍBRIDO)
// ==================================================================
const conversas = {};

async function buscarProdutosRobo(estabId) {
    const produtos = [];
    const categoriasSnap = await db.collection(`estabelecimentos/${estabId}/cardapio`).get();
    for (const catDoc of categoriasSnap.docs) {
        const itensSnap = await db.collection(`estabelecimentos/${estabId}/cardapio/${catDoc.id}/itens`).where('ativo', '==', true).get();
        itensSnap.forEach(d => {
            const data = d.data();
            produtos.push({ id: d.id, ...data, categoria: data.categoriaNome || catDoc.data().nome || 'Outros' });
        });
    }
    return produtos;
}

// Função centralizada para atender requisições de WhatsApp, Messenger e Instagram
async function processarFluxoRobo(chatKey, estabId, estab, produtos, messageText, from, origem) {
    const agora = Date.now();
    // Se a última mensagem foi há mais de 3 minutos, reseta a conversa para não ficar insistindo no erro
    if (conversas[chatKey] && conversas[chatKey].ultimaMensagem && (agora - conversas[chatKey].ultimaMensagem) > 3 * 60 * 1000) {
        delete conversas[chatKey];
    }

    if (!conversas[chatKey]) conversas[chatKey] = { etapa: 'inicio', itens: [], nome: '', enderecoEntrega: '', bairro: '', taxaEntrega: 0 };
    const chat = conversas[chatKey];
    chat.ultimaMensagem = agora;

    let resposta = '';
    const msgLower = (messageText || '').toLowerCase().trim();

    const frasesCancelamento = ['cancelar', 'sair', 'reiniciar', 'não quero', 'nao quero', 'deixa pra la', 'deixa pra lá', 'obrigado', 'obrigada', 'encerrar', 'pare', 'parar', 'desisto'];

    // ——— REINICIAR / CANCELAR ———
    if (frasesCancelamento.some(f => msgLower.includes(f)) || msgLower === 'nao' || msgLower === 'não') {
      delete conversas[chatKey];
      resposta = '✅ Atendimento encerrado! Qualquer coisa é só mandar um *"oi"*. 😉';

    // ——— CARDÁPIO / INÍCIO ———
    } else if (chat.etapa === 'inicio' || ['oi', 'olá', 'boa noite', 'bom dia', 'boa tarde', 'menu', 'cardápio', 'cardapio'].includes(msgLower)) {
      const categorias = {};
      produtos.forEach(p => {
        const cat = p.categoria || 'Outros';
        if (!categorias[cat]) categorias[cat] = [];
        categorias[cat].push(p);
      });
      let cardapioTexto = `🍔 *${estab.nome || 'Nosso Cardápio'}*\n\n`;
      Object.entries(categorias).forEach(([cat, items]) => {
        cardapioTexto += `*📌 ${cat}*\n`;
        items.forEach((p, i) => {
          const preco = Number(String(p.preco).replace(',', '.')) || 0;
          cardapioTexto += `${i + 1}. ${p.nome} — R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        });
        cardapioTexto += '\n';
      });
      cardapioTexto += `_Digite o nome do item e quantidade. Ex: *2 X-Bacon*_\n\nDigite *"finalizar"* para concluir o pedido.`;
      resposta = cardapioTexto;
      chat.etapa = 'pedindo';
      chat.itens = [];

    // ——— ADICIONANDO ITENS ———
    } else if (chat.etapa === 'pedindo') {
      if (msgLower === 'finalizar') {
        if (chat.itens.length === 0) {
          resposta = '⚠️ Seu pedido está vazio! Adicione itens primeiro.';
        } else {
          // Buscar bairros cadastrados no Firestore
          const taxasSnap = await db.collection(`estabelecimentos/${estabId}/taxasDeEntrega`).orderBy('nomeBairro').get();
          chat.bairrosLista = taxasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

          let subtotal = 0;
          let resumo = '📋 *Resumo do Pedido:*\n\n';
          chat.itens.forEach(item => {
            const sub = item.preco * item.qtd;
            subtotal += sub;
            resumo += `• ${item.qtd}x ${item.nome} — R$ ${sub.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
          });
          resumo += `\n💰 *Subtotal: R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;

          if (chat.bairrosLista.length > 0) {
            resumo += `🛵 *Selecione seu bairro de entrega:*\n`;
            chat.bairrosLista.forEach((b, i) => {
              const taxa = Number(b.valorTaxa) || 0;
              resumo += `*${i + 1}.* ${b.nomeBairro} — Taxa: R$ ${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
            });
            resumo += `\nDigite o *número* do seu bairro:`;
            chat.etapa = 'bairro';
          } else {
            chat.bairro = '';
            chat.taxaEntrega = 0;
            resumo += `📍 *Digite seu endereço de entrega:*\n_Ex: Rua das Flores, 123_`;
            chat.etapa = 'endereco';
          }
          resposta = resumo;
        }
      } else {
        // Adicionar item ao pedido
        const match = messageText.match(/^(\d+)\s*[xX]?\s*(.+)$/) || messageText.match(/^(.+?)\s+(\d+)$/);
        let qtd = 1; let nomeProduto = messageText;
        if (match) {
          if (/^\d+$/.test(match[1])) { qtd = parseInt(match[1]); nomeProduto = match[2].trim(); }
          else { nomeProduto = match[1].trim(); qtd = parseInt(match[2]); }
        }
        const prod = produtos.find(p => p.nome.toLowerCase().includes(nomeProduto.toLowerCase()) || nomeProduto.toLowerCase().includes(p.nome.toLowerCase()));
        if (prod) {
          const preco = Number(String(prod.preco).replace(',', '.')) || 0;
          chat.itens.push({ nome: prod.nome, preco, qtd, id: prod.id });
          resposta = `✅ *${qtd}x ${prod.nome}* adicionado! (R$ ${(preco * qtd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})\n\nContinue adicionando ou digite *"finalizar"*.`;
        } else {
          resposta = `❌ Não encontrei "${nomeProduto}" no cardápio.\nDigite *"menu"* para ver os itens.`;
        }
      }

    // ——— SELEÇÃO DE BAIRRO ———
    } else if (chat.etapa === 'bairro') {
      const idx = parseInt(msgLower) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < (chat.bairrosLista || []).length) {
        const bairroSel = chat.bairrosLista[idx];
        chat.bairro = bairroSel.nomeBairro;
        chat.taxaEntrega = Number(bairroSel.valorTaxa) || 0;
        const subtotal = chat.itens.reduce((acc, i) => acc + i.preco * i.qtd, 0);
        const totalComTaxa = subtotal + chat.taxaEntrega;
        resposta = `✅ *Bairro:* ${chat.bairro}\n🛵 *Taxa:* R$ ${chat.taxaEntrega.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n💰 *Total c/ taxa: R$ ${totalComTaxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n📍 *Agora, informe seu endereço de entrega:*\n_Ex: Rua das Flores, 123 — Apto 4_`;
        chat.etapa = 'endereco';
      } else {
        resposta = `❌ Opção inválida. Digite o *número* do bairro:\n`;
        (chat.bairrosLista || []).forEach((b, i) => {
          resposta += `*${i + 1}.* ${b.nomeBairro} — R$ ${Number(b.valorTaxa).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        });
      }

    // ——— ENDEREÇO ———
    } else if (chat.etapa === 'endereco') {
      if (messageText.trim().length < 5) {
        resposta = '⚠️ Informe um endereço válido.\n_Ex: Rua das Flores, 123_';
      } else {
        chat.enderecoEntrega = messageText.trim();
        chat.etapa = 'nome';
        resposta = `✅ *Endereço:* ${chat.enderecoEntrega}\n\n*Qual é o seu nome?*`;
      }

    // ——— NOME ———
    } else if (chat.etapa === 'nome') {
      chat.nome = messageText.trim();
      
      if (origem !== 'whatsapp') {
          chat.etapa = 'telefone_contato';
          resposta = `✅ Prazer, ${chat.nome}!\n\n📱 *Para facilitar ou caso o entregador precise, qual o seu número de WhatsApp/Telefone para contato?*\n_Ex: (21) 99999-9999_`;
      } else {
          chat.telefoneContato = from;
          chat.etapa = 'verificador_saldo';
      }
    } else if (chat.etapa === 'telefone_contato') {
      chat.telefoneContato = messageText.trim();
      chat.etapa = 'verificador_saldo';
    } 

    if (chat.etapa === 'verificador_saldo') {
      const cashbackConfig = estab.cashback || {};
      if (cashbackConfig.ativo) {
        const formatTel = chat.telefoneContato.replace(/\D/g, '');
        const telDoc = await db.doc(`estabelecimentos/${estabId}/clientes/${formatTel}`).get();
        const saldo = telDoc.exists ? Number(telDoc.data().saldoCashback) || 0 : 0;
        
        if (saldo > 0) {
          chat.saldoDisponivel = saldo;
          chat.etapa = 'pergunta_cashback';
          resposta = `💰 *Você tem R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de Cashback disponíveis na sua carteira virtual!*\n\nDeseja utilizar este saldo como desconto neste pedido?\n\n*1.* Sim, quero usar!\n*2.* Não, vou guardar!`;
        } else {
          chat.etapa = 'salvar_pedido';
        }
      } else {
        chat.etapa = 'salvar_pedido';
      }
    } else if (chat.etapa === 'pergunta_cashback') {
      const respValida = messageText.trim().toLowerCase();
      if (respValida === '1' || respValida === 'sim' || respValida === 's') {
        chat.usarCashback = true;
      } else {
        chat.usarCashback = false;
      }
      chat.etapa = 'salvar_pedido';
    }

    // O pulo direto para salvar o pedido
    if (chat.etapa === 'salvar_pedido') {
      let subtotal = 0;
      const itensFormatados = chat.itens.map(item => {
        subtotal += item.preco * item.qtd;
        return { nome: item.nome, quantidade: item.qtd, preco: item.preco, id: item.id };
      });
      const taxaEntrega = chat.taxaEntrega || 0;
      let totalFinal = subtotal + taxaEntrega;
      
      let descontoAplicado = 0;
      if (chat.usarCashback && chat.saldoDisponivel > 0) {
        if (chat.saldoDisponivel >= totalFinal) {
          descontoAplicado = totalFinal;
        } else {
          descontoAplicado = chat.saldoDisponivel;
        }
        totalFinal = totalFinal - descontoAplicado;
        
        const formatTel = chat.telefoneContato.replace(/\D/g, '');
        await db.doc(`estabelecimentos/${estabId}/clientes/${formatTel}`).set({
          saldoCashback: chat.saldoDisponivel - descontoAplicado,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const pedidoRef = await db.collection(`estabelecimentos/${estabId}/pedidos`).add({
        itens: itensFormatados,
        cliente: { nome: chat.nome, telefone: chat.telefoneContato },
        status: 'recebido',
        subtotal,
        taxaEntrega,
        cashbackUsado: descontoAplicado || 0,
        totalFinal,
        bairro: chat.bairro || '',
        enderecoEntrega: chat.enderecoEntrega || '',
        source: origem,
        tipo: 'delivery',
        createdAt: FieldValue.serverTimestamp(),
        observacao: `Pedido via ${origem.toUpperCase()}${descontoAplicado > 0 ? ` (Usou R$ ${descontoAplicado} de Cashback)` : ''} — Posição Pessoal (Meta ID: ${from})`
      });

      const descTexto = descontoAplicado > 0 ? `\n🎁 Cashback Usado: -R$ ${descontoAplicado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
      const taxaTexto = taxaEntrega > 0 ? `\n🛵 Taxa: R$ ${taxaEntrega.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
      resposta = `✅ *Pedido confirmado!*\n\n🆔 #${pedidoRef.id.slice(-6).toUpperCase()}\n👤 ${chat.nome}\n📞 Tel: ${chat.telefoneContato}\n📍 ${chat.enderecoEntrega}${chat.bairro ? ` — ${chat.bairro}` : ''}${taxaTexto}${descTexto}\n💰 *Total: R$ ${totalFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\nSeu pedido está sendo preparado! 🎉\nPedido ficará pronto entre 45 a 60 minutos ok?\nDigite *"oi"* para novo pedido.`;
      delete conversas[chatKey];

    } else if (!['inicio', 'pedindo', 'bairro', 'endereco', 'nome', 'telefone_contato', 'verificador_saldo', 'pergunta_cashback', 'salvar_pedido'].includes(chat.etapa)) {
      resposta = 'Olá! 👋 Digite *"oi"* ou *"menu"* para começar seu pedido!';
    }

    return resposta;
}

export const webhookWhatsApp = onRequest({ secrets: [whatsappVerifyToken, whatsappApiToken], maxInstances: 5 }, async (req, res) => {

    if (req.method === 'GET') {
      if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === whatsappVerifyToken.value()) {
        return res.status(200).send(req.query['hub.challenge']);
      }
      return res.status(403).send('Token inválido');
    }
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
      const body = req.body;
      let from = '';
      let messageText = '';
      let instanceId = '';
      let isUazapi = false;

      if (body?.event === 'messages.upsert' || body?.data?.key) {
        isUazapi = true;
        const msgData = body.data || body.data?.[0];
        if (!msgData || msgData.key?.fromMe) return res.status(200).send('OK'); 
        from = msgData.key.remoteJid.split('@')[0];
        messageText = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || '';
        instanceId = body.instance;
      } else if (body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        const msg = body.entry[0].changes[0].value.messages[0];
        from = msg.from;
        messageText = msg.text?.body?.trim() || '';
        instanceId = body.entry[0].changes[0].value.metadata?.phone_number_id;
      } else {
        return res.status(200).send('OK');
      }

      if (!from || !messageText) return res.status(200).send('OK');

      let estabQuery;
      if (isUazapi) {
         estabQuery = await db.collection('estabelecimentos').where('whatsapp.instanceName', '==', instanceId).limit(1).get();
      } else {
         estabQuery = await db.collection('estabelecimentos').where('whatsapp.phoneNumberId', '==', instanceId).limit(1).get();
      }

      if (estabQuery.empty) return res.status(200).send('OK');

      const estabDoc = estabQuery.docs[0];
      const estabId = estabDoc.id;
      const estab = estabDoc.data();
      const wConfig = estab.whatsapp || {};

      const produtos = await buscarProdutosRobo(estabId);

      const chatKey = `${estabId}_${from}`;
      // Chama o robô genérico unificado, que foi isolado acima
      const resposta = await processarFluxoRobo(chatKey, estabId, estab, produtos, messageText, from, 'whatsapp');

      // ─── RESPONDER (UAZAPI OU META) ───
      if (wConfig.serverUrl && wConfig.apiKey && wConfig.instanceName) {
         const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
         const numeroLimpo = from.replace(/\D/g, '');
         const telFinal = numeroLimpo.startsWith('55') ? numeroLimpo : `55${numeroLimpo}`;
         await fetch(`${urlFormatada}/send/text`, {
            method: 'POST',
            headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: telFinal, text: resposta })
         });
      } else if (wConfig.phoneNumberId) {
         await fetch(`https://graph.facebook.com/v18.0/${wConfig.phoneNumberId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${whatsappApiToken.value()}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: resposta } })
         });
      }

      res.status(200).send('OK');
    } catch (error) {
      logger.error('❌ Erro WhatsApp Webhook:', error);
      res.status(200).send('OK'); 
    }
});

// ==================================================================
// 15. ENVIAR MENSAGEM WHATSAPP (Do admin para o cliente)
// ==================================================================
export const enviarMensagemWhatsApp = onCall(async (request) => {

    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
    const { telefone, mensagem, estabelecimentoId } = request.data;
    if (!telefone || !mensagem || !estabelecimentoId) throw new HttpsError('invalid-argument', 'Dados obrigatórios.');

    try {
      const estabDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
      const wConfig = estabDoc.data()?.whatsapp || {};

      if (!wConfig.instanceName || !wConfig.apiKey || !wConfig.serverUrl) throw new HttpsError('failed-precondition', 'WhatsApp Uazapi não configurado.');

      const tel = telefone.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;

      const payloadEnvio = {
        number: telFinal,
        text: mensagem
      };

      await fetch(`${urlFormatada}/send/text`, {
        method: 'POST',
        headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadEnvio)
      });
      return { sucesso: true };
    } catch (error) {
      throw new HttpsError('internal', error.message);
    }
});

// ==================================================================
// 15B. WEBHOOK META (INSTAGRAM E MESSENGER)
// ==================================================================
export const webhookMetaChat = onRequest({ maxInstances: 5 }, async (req, res) => {
    
    const verifyTokenReal = 'MataFomeMetaToken2026';
    const apiTokenReal = 'EAAZAURhftZA9cBRJeGSJXlZBy4bkdWgYAKM3wmXMlH8RnKx9at6wOcVJdRBze0kVrn7N3kHhTSoQ7VA5r98uXQkTTsIY5zM34S8iO0r5VLm84cbPYA3OuGil6TRugY0KxVsgdOfKNCgs2ZBE85XrLpnLHkMwaZB7FkvduqTTvTV3wqUD8Cu1H8h2jxVB0KJPlM03x6wZDZD';

    // Verificação oficial exigida pela Meta na configuração do Webhook
    if (req.method === 'GET') {
      if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyTokenReal) {
        return res.status(200).send(req.query['hub.challenge']);
      }
      return res.status(403).send('Token inválido');
    }
    
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const body = req.body;
        // Identifica se é Instagram ou Página do Facebook (Messenger)
        if (body.object === 'instagram' || body.object === 'page') {
            const entry = body.entry?.[0];
            const messaging = entry?.messaging?.[0];
            
            if (messaging && messaging.message && !messaging.message.is_echo) {
                const senderId = messaging.sender.id;
                const messageText = messaging.message.text || '';
                const source = body.object === 'instagram' ? 'instagram' : 'messenger';
                
                logger.info(`[META WEBHOOK] Recebido de ${source} - Sender: ${senderId} - Texto: ${messageText}`);
                
                // Busca o ID do estabelecimento baseado no ID da Página/Perfil
                const entryId = body.entry?.[0]?.id;
                let respostaFinal = 'Olá! Nosso sistema automatizado está operando. Logo você poderá fazer seu pedido por aqui.\n\n⚠️ Lojista: Configure o campo "metaPageId" na engrenagem principal do painel.';

                if (entryId) {
                    const estabQuery = await db.collection('estabelecimentos').where('metaPageId', '==', entryId).limit(1).get();
                    if (!estabQuery.empty) {
                        const estabDoc = estabQuery.docs[0];
                        const estabId = estabDoc.id;
                        const estab = estabDoc.data();
                        
                        const produtos = await buscarProdutosRobo(estabId);

                        const chatKey = `${estabId}_${senderId}`; // Permite sessões de conversas isoladas
                        // MOTOR DO CARDÁPIO DIGITAL UNIFICADO
                        respostaFinal = await processarFluxoRobo(chatKey, estabId, estab, produtos, messageText, senderId, source);
                    } else {
                        logger.warn(`META WEBHOOK: Page ID ${entryId} não cadastrado em nenhum estabelecimento.`);
                    }
                }

                if (apiTokenReal && apiTokenReal.length > 10) {
                    await fetch(`https://graph.facebook.com/v19.0/me/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiTokenReal}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            recipient: { id: senderId },
                            message: { text: respostaFinal }
                        })
                    });
                }
            }
        }
        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        logger.error('❌ Erro Meta Webhook:', error);
        res.status(200).send('EVENT_RECEIVED'); // Requisito da Meta para não reenviar eventos fracassados loop infinito
    }
});

// ==================================================================
// 16. MARKETING AUTOMÁTICO
// ==================================================================
import { onSchedule } from "firebase-functions/v2/scheduler";

// Helper: envia texto via UAZAPI (mesmo padrão da notificarClienteWhatsApp)
async function enviarWhatsAppUAZAPI(wConfig, telefone, texto) {
  const tel = telefone.replace(/\D/g, '');
  const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
  const urlBase = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
  const fullUrl = `${urlBase}/send/text`;

  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: telFinal, text: texto })
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body, telefone: telFinal };
}

export const marketingAutomatico = onSchedule({ schedule: "every day 10:00", timeZone: "America/Sao_Paulo" }, async () => {
  logger.info('🚀 Marketing automático iniciado');

  try {
    // 1. Buscar todos os estabelecimentos
    const estabsSnap = await db.collection('estabelecimentos').get();
    
    for (const estabDoc of estabsSnap.docs) {
      const estab = estabDoc.data();
      const mktConfig = estab.marketing || {};
      const wConfig = estab.whatsapp || {};
      const nomeEstab = estab.nome || 'Restaurante';

      // Pula se marketing desativado ou WhatsApp não configurado
      if (!mktConfig.ativo) continue;
      if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl || !wConfig.apiKey) {
        logger.warn(`⚠️ ${nomeEstab} (${estabDoc.id}): marketing ativo mas WhatsApp não configurado`);
        continue;
      }

      const diasInativo = mktConfig.diasInativo || 7;
      const limiteDiario = mktConfig.limiteDiario || 20;
      const mensagemBase = mktConfig.mensagem || 'Ei! Faz tempo que você não pede! 🍔 Que tal pedir hoje?';

      logger.info(`📊 Processando ${nomeEstab} (${estabDoc.id}) | diasInativo=${diasInativo} | limite=${limiteDiario}`);

      // 2. Buscar todos os pedidos para mapear clientes
      const pedidosSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('pedidos').get();

      if (pedidosSnap.empty) {
        logger.info(`📭 ${nomeEstab}: nenhum pedido encontrado`);
        continue;
      }

      // 3. Montar mapa de clientes com último pedido
      const clientesMap = new Map(); // telefone -> { nome, ultimoPedido, dataNascimento }
      const agora = new Date();
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

      pedidosSnap.forEach(pedidoDoc => {
        const p = pedidoDoc.data();
        const tel = p.cliente?.telefone || p.clienteTelefone || '';
        if (!tel || tel.replace(/\D/g, '').length < 10) return;

        const telLimpo = tel.replace(/\D/g, '');
        const nome = p.cliente?.nome || p.clienteNome || 'Cliente';
        
        // Data do pedido (Firestore Timestamp ou Date)
        let dataPedido = null;
        if (p.criadoEm?.toDate) dataPedido = p.criadoEm.toDate();
        else if (p.criadoEm) dataPedido = new Date(p.criadoEm);
        else if (p.data?.toDate) dataPedido = p.data.toDate();
        else if (p.data) dataPedido = new Date(p.data);

        const existente = clientesMap.get(telLimpo);
        if (!existente || (dataPedido && (!existente.ultimoPedido || dataPedido > existente.ultimoPedido))) {
          clientesMap.set(telLimpo, {
            nome,
            telefone: telLimpo,
            ultimoPedido: dataPedido,
            dataNascimento: p.cliente?.dataNascimento || existente?.dataNascimento || null
          });
        }
      });

      logger.info(`👥 ${nomeEstab}: ${clientesMap.size} clientes mapeados`);

      // 4. Filtrar clientes inativos
      const limiteData = new Date(hoje);
      limiteData.setDate(limiteData.getDate() - diasInativo);

      const clientesInativos = [];
      const aniversariantes = [];

      for (const [tel, cliente] of clientesMap) {
        // Cliente inativo = último pedido antes do limite
        if (cliente.ultimoPedido && cliente.ultimoPedido < limiteData) {
          clientesInativos.push(cliente);
        }

        // Aniversário hoje — também verifica opt-out
        if (mktConfig.aniversario && cliente.dataNascimento && !telOptouts.has(cliente.telefone)) {
          let nascimento = null;
          if (cliente.dataNascimento?.toDate) nascimento = cliente.dataNascimento.toDate();
          else if (typeof cliente.dataNascimento === 'string') nascimento = new Date(cliente.dataNascimento);
          
          if (nascimento && nascimento.getDate() === hoje.getDate() && nascimento.getMonth() === hoje.getMonth()) {
            aniversariantes.push(cliente);
          }
        }
      }

      logger.info(`📤 ${nomeEstab}: ${clientesInativos.length} inativos | ${aniversariantes.length} aniversariantes`);

        // 👇 Pré-carregar lista de optouts para não fazer query por cliente
      const optoutsSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('optout').get();
      const telOptouts = new Set(optoutsSnap.docs.map(d => d.id));

      // 5. Enviar mensagens para inativos (até o limite diário)
      let enviadosHoje = 0;

      for (const cliente of clientesInativos) {
        if (enviadosHoje >= limiteDiario) {
          logger.info(`⏸️ ${nomeEstab}: limite diário atingido (${limiteDiario})`);
          break;
        }

        // 🚫 Pular clientes que fizeram opt-out
        if (telOptouts.has(cliente.telefone)) {
          logger.info(`🚫 Opt-out: pulando ${cliente.telefone}`);
          continue;
        }

        try {
          // Personalizar mensagem com nome do cliente e do estabelecimento
          const mensagemFinal = `*${nomeEstab}*\n\nOlá, ${cliente.nome}! ${mensagemBase}`;
          
          const result = await enviarWhatsAppUAZAPI(wConfig, cliente.telefone, mensagemFinal);
          
          if (result.ok) {
            enviadosHoje++;
            logger.info(`✅ Marketing enviado para ${result.telefone} (${cliente.nome})`);
          } else {
            logger.warn(`❌ Falha marketing para ${result.telefone}: HTTP ${result.status} | ${result.body}`);
          }

          // Registrar campanha no Firestore
          await db.collection('estabelecimentos').doc(estabDoc.id)
            .collection('campanhas').add({
              tipo: 'reengajamento',
              clienteNome: cliente.nome,
              clienteTelefone: cliente.telefone,
              mensagem: mensagemFinal,
              sucesso: result.ok,
              erro: result.ok ? null : `HTTP ${result.status}`,
              enviadoEm: FieldValue.serverTimestamp(),
              diasInativo
            });

          // Delay entre envios para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
          logger.error(`❌ Erro ao enviar para ${cliente.telefone}:`, err);
        }
      }

      // 6. Enviar mensagens de aniversário (não conta no limite diário)
      if (mktConfig.aniversario) {
        const descontoAniv = mktConfig.aniversarioDesconto || 15;
        const msgAnivBase = mktConfig.aniversarioMsg || '🎂 Feliz aniversário! Toma um desconto especial pra comemorar!';

        for (const cliente of aniversariantes) {
          try {
            const msgAniv = `*${nomeEstab}*\n\n${cliente.nome}, ${msgAnivBase}\n\n🎁 Use o cupom *ANIVER${descontoAniv}* e ganhe *${descontoAniv}% OFF* no seu pedido de hoje!`;

            const result = await enviarWhatsAppUAZAPI(wConfig, cliente.telefone, msgAniv);

            if (result.ok) {
              logger.info(`🎂 Aniversário enviado para ${result.telefone} (${cliente.nome})`);
            } else {
              logger.warn(`❌ Falha aniversário para ${result.telefone}: HTTP ${result.status}`);
            }

            await db.collection('estabelecimentos').doc(estabDoc.id)
              .collection('campanhas').add({
                tipo: 'aniversario',
                clienteNome: cliente.nome,
                clienteTelefone: cliente.telefone,
                mensagem: msgAniv,
                sucesso: result.ok,
                erro: result.ok ? null : `HTTP ${result.status}`,
                enviadoEm: FieldValue.serverTimestamp(),
                desconto: descontoAniv
              });

            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (err) {
            logger.error(`❌ Erro aniversário para ${cliente.telefone}:`, err);
          }
        }
      }

      logger.info(`✅ ${nomeEstab}: marketing concluído | ${enviadosHoje} reengajamentos enviados`);
    }

    logger.info('🏁 Marketing automático finalizado');

  } catch (error) {
    logger.error('❌ Erro fatal no marketing automático:', error);
  }
});

// ==================================================================
// 17. CONFIGURAR MARKETING
// ==================================================================
export const configurarMarketing = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const { estabelecimentoId, config } = request.data || {};
  if (!estabelecimentoId || !config) throw new HttpsError('invalid-argument', 'Dados incompletos');

  try {
    // Validar campos
    const configLimpa = {
      ativo: !!config.ativo,
      diasInativo: Math.max(1, Math.min(90, Number(config.diasInativo) || 7)),
      mensagem: (config.mensagem || '').substring(0, 500),
      limiteDiario: Math.max(1, Math.min(100, Number(config.limiteDiario) || 20)),
      aniversario: !!config.aniversario,
      aniversarioDesconto: Math.max(5, Math.min(50, Number(config.aniversarioDesconto) || 15)),
      aniversarioMsg: (config.aniversarioMsg || '').substring(0, 500),
      atualizadoEm: FieldValue.serverTimestamp(),
      atualizadoPor: uid
    };

    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      marketing: configLimpa
    });

    logger.info(`✅ Marketing configurado para ${estabelecimentoId} por ${uid}`);
    return { sucesso: true, config: configLimpa };

  } catch (error) {
    logger.error('❌ Erro ao configurar marketing:', error);
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 17.5 CONTAR CLIENTES DO ESTABELECIMENTO
// ==================================================================
export const countEstablishmentClientsCallable = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório');

  try {
    // Usa select() para trazer APENAS os campos de telefone — muito mais rápido
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos')
      .select('cliente.telefone', 'clienteTelefone')
      .get();

    const telefonesUnicos = new Set();

    pedidosSnap.forEach(pedidoDoc => {
      const p = pedidoDoc.data();
      const tel = p.cliente?.telefone || p.clienteTelefone || '';
      const telLimpo = tel.replace(/\D/g, '');
      if (telLimpo.length >= 10) {
        telefonesUnicos.add(telLimpo);
      }
    });

    logger.info(`📊 Contagem de clientes para ${estabelecimentoId}: ${telefonesUnicos.size}`);
    return { uniqueClientCount: telefonesUnicos.size };

  } catch (error) {
    logger.error('❌ Erro ao contar clientes:', error);
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 17.6 ENVIAR MENSAGEM EM MASSA PARA CLIENTES DO ESTABELECIMENTO
// ==================================================================
export const sendEstablishmentMessageCallable = onCall({ cors: true, timeoutSeconds: 540 }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Usuário não autenticado');

  const { estabelecimentoId, message } = request.data || {};
  if (!estabelecimentoId || !message?.trim()) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e message são obrigatórios');
  }

  try {
    // 1. Buscar config do WhatsApp do estabelecimento
    const estabDoc = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
    if (!estabDoc.exists) throw new HttpsError('not-found', 'Estabelecimento não encontrado');

    const estab = estabDoc.data();
    const wConfig = estab.whatsapp || {};
    const nomeEstab = estab.nome || 'Restaurante';

    if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl || !wConfig.apiKey) {
      throw new HttpsError('failed-precondition', 'WhatsApp Bot não está configurado. Configure em Configurações > WhatsApp Bot.');
    }

    // 2. Buscar todos os pedidos e extrair telefones únicos com nomes
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos').get();

    const clientesMap = new Map(); // telefone -> nome
    pedidosSnap.forEach(pedidoDoc => {
      const p = pedidoDoc.data();
      const tel = p.cliente?.telefone || p.clienteTelefone || '';
      const telLimpo = tel.replace(/\D/g, '');
      if (telLimpo.length >= 10) {
        const nome = p.cliente?.nome || p.clienteNome || 'Cliente';
        if (!clientesMap.has(telLimpo)) {
          clientesMap.set(telLimpo, nome);
        }
      }
    });

    if (clientesMap.size === 0) {
      return { message: 'Nenhum cliente encontrado com telefone válido', total: 0, enviados: 0, falhas: 0 };
    }

    // 🚫 Carregar opt-outs e filtrar
    const optoutsSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').get();
    const telOptouts = new Set(optoutsSnap.docs.map(d => d.id));
    for (const tel of telOptouts) clientesMap.delete(tel);

    logger.info(`📤 Envio em massa para ${estabelecimentoId}: ${clientesMap.size} clientes (${telOptouts.size} opt-outs removidos) | por ${uid}`);

    if (clientesMap.size === 0) {
      return { message: 'Todos os clientes fizeram opt-out', total: 0, enviados: 0, falhas: 0 };
    }
    // 3. Enviar mensagem para cada cliente
    let enviados = 0;
    let falhas = 0;

    for (const [telefone, nome] of clientesMap) {
      try {
        const mensagemFinal = `*${nomeEstab}*\n\nOlá, ${nome}! ${message.trim()}`;
        const result = await enviarWhatsAppUAZAPI(wConfig, telefone, mensagemFinal);

        if (result.ok) {
          enviados++;
          logger.info(`✅ Mensagem enviada para ${result.telefone} (${nome})`);
        } else {
          falhas++;
          logger.warn(`❌ Falha para ${result.telefone}: HTTP ${result.status} | ${result.body}`);
        }

        // Registrar no Firestore
        await db.collection('estabelecimentos').doc(estabelecimentoId)
          .collection('campanhas').add({
            tipo: 'envio_massa',
            clienteNome: nome,
            clienteTelefone: telefone,
            mensagem: mensagemFinal,
            sucesso: result.ok,
            erro: result.ok ? null : `HTTP ${result.status}`,
            enviadoEm: FieldValue.serverTimestamp(),
            enviadoPor: uid
          });

        // Delay de 2s entre envios para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        falhas++;
        logger.error(`❌ Erro ao enviar para ${telefone}:`, err);
      }
    }

    const resumo = `${enviados} mensagens enviadas com sucesso (${falhas} falhas) de ${clientesMap.size} clientes`;
    logger.info(`🏁 ${nomeEstab}: ${resumo}`);

    return {
      message: resumo,
      total: clientesMap.size,
      enviados,
      falhas
    };

  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('❌ Erro fatal no envio em massa:', error);
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 18. NOTIFICAÇÃO AUTOMÁTICA WHATSAPP (Trigger de status UAZAPI)
// ==================================================================
function formatarValor(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00';
  return `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
}

const MENSAGENS_STATUS = {
  recebido: (p) => `🔥 *${p.nomeEstab}*\n\nOlá, ${p.nome}! Seu pedido no valor de *${p.valor}* foi recebido! ✅${p.pixManual ? `\n\n🧾 *Seu pagamento foi no PIX via chave* — por favor, envie o comprovante por aqui para confirmarmos.` : `\n\nEm instantes você receberá atualizações sobre o preparo. 🍔`}`,
  preparo: (p) => `🔥 *${p.nomeEstab}*\n\nOlá, ${p.nome}! Seu pedido no valor de *${p.valor}* já está sendo preparado! 👨‍🍳\nTempo de espera de 40 a 60 minutos, ok?${p.pixManual ? `\n\n💳 *Pagamento via PIX* — Por favor, envie o comprovante de pagamento.` : ''}`,
  em_entrega: (p) => `🛵 *${p.nomeEstab}*\n\nÓtima notícia, ${p.nome}! Seu pedido no valor de *${p.valor}* saiu para entrega!${p.motoboy ? `\n🏍️ Entregador: *${p.motoboy}*` : ''}`,
  pronto_para_servir: (p) => `✅ *${p.nomeEstab}*\n\n${p.nome}, seu pedido no valor de *${p.valor}* está *pronto*! Pode retirar. 🎉`,
  finalizado: (p) => `✅ *${p.nomeEstab}*\n\nPedido entregue! Obrigado pela preferência, ${p.nome}! 😊\nValor: *${p.valor}*\n\nVolte sempre! 💛`
};

export const notificarClienteWhatsApp = onDocumentUpdated(
  { document: 'estabelecimentos/{estabId}/pedidos/{pedidoId}' },
  async (event) => {
    try {
      const antes = event.data?.before?.data();
      const depois = event.data?.after?.data();

      if (!antes || !depois) {
        logger.info('📱 ⏭️ Sem dados antes/depois — ignorando');
        return;
      }
      if (antes.status === depois.status) {
        return; // Status não mudou, silencioso é OK aqui
      }

      logger.info(`📱 🔄 Status mudou: ${antes.status} → ${depois.status} | pedido=${event.params.pedidoId}`);

      const gerarMensagem = MENSAGENS_STATUS[depois.status];
      if (!gerarMensagem) {
        logger.info(`📱 ⏭️ Sem template para status "${depois.status}" — ignorando`);
        return;
      }

      const telefoneCliente = depois.cliente?.telefone || depois.clienteTelefone || '';
      if (!telefoneCliente) {
        logger.warn(`📱 ⚠️ Pedido ${event.params.pedidoId} sem telefone do cliente — não enviando WhatsApp`);
        return;
      }

      const estabSnap = await db.collection('estabelecimentos').doc(event.params.estabId).get();
      if (!estabSnap.exists) {
        logger.warn(`📱 ⚠️ Estabelecimento ${event.params.estabId} não encontrado`);
        return;
      }

      const estab = estabSnap.data();
      const wConfig = estab.whatsapp || {};

      logger.info(`📱 🔧 Config WhatsApp: ativo=${wConfig.ativo} | instanceName=${wConfig.instanceName || 'VAZIO'} | serverUrl=${wConfig.serverUrl || 'VAZIO'} | apiKeyLen=${(wConfig.apiKey || '').length}`);

      if (!wConfig.ativo) {
        logger.info(`📱 ⏭️ WhatsApp DESATIVADO para estab ${event.params.estabId}`);
        return;
      }
      if (!wConfig.instanceName) {
        logger.warn(`📱 ⚠️ instanceName VAZIO — não enviando`);
        return;
      }
      if (!wConfig.serverUrl) {
        logger.warn(`📱 ⚠️ serverUrl VAZIO — não enviando`);
        return;
      }

      const nomeEstab = estab.nome || 'Restaurante';
      const nomeCliente = depois.cliente?.nome || depois.clienteNome || 'Cliente';
      const totalPedido = depois.totalFinal || depois.total || depois.valorTotal || 0;
      const formaPagamento = depois.formaPagamento || depois.pagamento || '';
      const isPixManual = formaPagamento === 'PIX_MANUAL' || formaPagamento === 'pix_manual';

      let mensagem = gerarMensagem({
        nome: nomeCliente,
        nomeEstab,
        valor: formatarValor(totalPedido),
        motoboy: depois.motoboyNome || '',
        pixManual: isPixManual
      });

      // 💳 Geração de Cashback no fechamento do pedido
      if (depois.status === 'finalizado') {
        const cashbackConfig = estab.cashback || {};
        if (cashbackConfig.ativo) {
          const porcentagem = Number(cashbackConfig.porcentagem) || 5;
          const valorCashback = (totalPedido * porcentagem) / 100;
          
          if (valorCashback > 0) {
            const formatTel = telefoneCliente.replace(/\D/g, '');
            const telDocRef = db.doc(`estabelecimentos/${event.params.estabId}/clientes/${formatTel}`);
            
            try {
              const telDoc = await telDocRef.get();
              let saldoAtual = 0;
              if (telDoc.exists) {
                saldoAtual = Number(telDoc.data().saldoCashback) || 0;
              }
              const novoSaldo = saldoAtual + valorCashback;
              
              await telDocRef.set({
                nome: nomeCliente,
                telefone: formatTel,
                saldoCashback: novoSaldo,
                updatedAt: FieldValue.serverTimestamp()
              }, { merge: true });
              
              const pedidoDocRef = db.doc(`estabelecimentos/${event.params.estabId}/pedidos/${event.params.pedidoId}`);
              await pedidoDocRef.update({
                cashbackGanho: valorCashback
              });

              mensagem += `\n\n🎉 *UHU! Você ganhou Cashback!* 🎉\nFinalizamos sua compra e guardamos *R$ ${valorCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}* de volta na sua carteira digital!\n\nSeu saldo atual para descontar na próxima compra é de: *R$ ${novoSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*.`;
            } catch (err) {
              logger.error(`📱 ❌ Erro ao adicionar cashback: ${err.message}`);
            }
          }
        }
      }
      
      const tel = telefoneCliente.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;

      // 🔥 PAYLOAD UAZAPI — endpoint /send/text com token da instância
      const payloadEnvio = {
        number: telFinal,
        text: mensagem
      };

      const fullUrl = `${urlFormatada}/send/text`;
      logger.info(`📱 📤 Enviando para ${telFinal} | Status: ${depois.status} | URL: ${fullUrl}`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadEnvio)
      });

      const responseBody = await response.text();
      if (response.ok) {
        logger.info(`📱 ✅ UAZAPI enviou para ${telFinal} | Status: ${depois.status} | Response: ${responseBody}`);
      } else {
        logger.warn(`⚠️ ❌ Falha UAZAPI para ${telFinal} | HTTP ${response.status} | URL: ${fullUrl} | Response: ${responseBody}`);
      }
    } catch (error) {
      logger.error('❌ Erro no trigger de notificação WhatsApp:', error);
    }
  }
);

// ==================================================================
// 🧊 GERAR MODELO 3D VIA MESHY (IMAGE-TO-3D) — DESATIVADO (3D feito manual)
// ==================================================================
// export const generateModel3D = onCall({ ... }); // desativado - sem MESHY_API_KEY

// ==================================================================
// 19. NOTIFICAÇÃO AUTOMÁTICA WHATSAPP — PEDIDO NOVO (onCreate)
// ==================================================================
export const notificarPedidoNovo = onDocumentCreated(
  { document: 'estabelecimentos/{estabId}/pedidos/{pedidoId}' },
  async (event) => {
    try {
      const pedido = event.data?.data();
      if (!pedido) return;

      // Só notifica pedidos delivery (não mesa/salão)
      if (pedido.source === 'salao' || pedido.tipo === 'mesa') return;

      const telefoneCliente = pedido.cliente?.telefone || pedido.clienteTelefone || '';
      if (!telefoneCliente) return;

      const estabSnap = await db.collection('estabelecimentos').doc(event.params.estabId).get();
      if (!estabSnap.exists) return;

      const estab = estabSnap.data();
      const wConfig = estab.whatsapp || {};

      if (!wConfig.ativo || !wConfig.instanceName || !wConfig.serverUrl) return;

      const nomeEstab = estab.nome || 'Restaurante';
      const nomeCliente = pedido.cliente?.nome || pedido.clienteNome || 'Cliente';
      const totalPedido = pedido.totalFinal || pedido.total || pedido.valorTotal || 0;
      const formaPagamento = pedido.formaPagamento || pedido.pagamento || '';
      const isPixManual = formaPagamento === 'PIX_MANUAL' || formaPagamento === 'pix_manual' || formaPagamento.toLowerCase() === 'pix';

      const gerarMensagem = MENSAGENS_STATUS['recebido'];
      const mensagem = gerarMensagem({
        nome: nomeCliente,
        nomeEstab,
        valor: formatarValor(totalPedido),
        motoboy: '',
        pixManual: isPixManual
      });

      const tel = telefoneCliente.replace(/\D/g, '');
      const telFinal = tel.startsWith('55') ? tel : `55${tel}`;
      const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
      const fullUrl = `${urlFormatada}/send/text`;

      logger.info(`📱 Enviando notificação de NOVO PEDIDO para ${telFinal} via UAZAPI`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: telFinal, text: mensagem })
      });

      const responseBody = await response.text();
      if (response.ok) {
        logger.info(`📱 ✅ Pedido novo notificado! ${telFinal} | Response: ${responseBody}`);
      } else {
        logger.warn(`⚠️ ❌ Falha ao notificar pedido novo ${telFinal} | HTTP ${response.status} | Response: ${responseBody}`);
      }
    } catch (error) {
      logger.error('❌ Erro no trigger de notificação pedido novo:', error);
    }
  }
);

// ==================================================================
// iFood PARTNER API — INTEGRAÇÃO REAL
// ==================================================================

const IFOOD_BASE_URL = 'https://merchant-api.ifood.com.br';

// ------------------------------------------------------------------
// HELPER: Obter (ou renovar) token OAuth2 do iFood por estabelecimento
// ------------------------------------------------------------------
async function getIfoodToken(estabelecimentoId) {
    const tokenRef = db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('integracoes').doc('ifood_token');
    const tokenSnap = await tokenRef.get();

    if (tokenSnap.exists) {
        const t = tokenSnap.data();
        // Usa token em cache se ainda válido (com 60s de margem)
        if (t.expiresAt && t.expiresAt.toMillis() > Date.now() + 60000) {
            return t.accessToken;
        }
        // Tenta renovar com refresh_token
        if (t.refreshToken) {
            try {
                const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grantType: 'refresh_token',
                        clientId: process.env.IFOOD_CLIENT_ID,
                        clientSecret: process.env.IFOOD_CLIENT_SECRET,
                        refreshToken: t.refreshToken
                    }).toString()
                });
                if (res.ok) {
                    const data = await res.json();
                    const expiresAt = new Date(Date.now() + (data.expiresIn || 3600) * 1000);
                    await tokenRef.set({
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken || t.refreshToken,
                        expiresAt: FieldValue.serverTimestamp(),
                        atualizadoEm: FieldValue.serverTimestamp()
                    }, { merge: true });
                    return data.accessToken;
                }
            } catch(e) {
                logger.warn('iFood: falha ao renovar refresh_token, tentando client_credentials...', e.message);
            }
        }
    }

    // Fallback: client_credentials (acesso somente leitura/sandbox)
    const res = await fetch(`${IFOOD_BASE_URL}/authentication/v1.0/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grantType: 'client_credentials',
            clientId: process.env.IFOOD_CLIENT_ID,
            clientSecret: process.env.IFOOD_CLIENT_SECRET
        }).toString()
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`iFood auth falhou: ${res.status} - ${err}`);
    }

    const data = await res.json();
    await tokenRef.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        expiresAt: new Date(Date.now() + (data.expiresIn || 3600) * 1000),
        atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    return data.accessToken;
}

// ------------------------------------------------------------------
// HELPER: Mapear pedido iFood → modelo interno Mata Fome
// ------------------------------------------------------------------
function mapearPedidoIfood(ifoodOrder, estabelecimentoId) {
    const mapStatus = {
        'PLACED': 'recebido',
        'CONFIRMED': 'preparo',
        'READY_TO_PICKUP': 'pronto_para_servir',
        'DISPATCHED': 'em_entrega',
        'CONCLUDED': 'finalizado',
        'CANCELLED': 'cancelado'
    };

    const mapPagamento = {
        'CREDIT': 'cartao_credito',
        'DEBIT': 'cartao_debito',
        'MEAL_VOUCHER': 'voucher',
        'DIGITAL_WALLET': 'carteira_digital',
        'PIX': 'pix',
        'CASH': 'dinheiro'
    };

    const itens = (ifoodOrder.items || []).map(item => ({
        id: item.externalCode || item.id,
        nome: item.name,
        quantidade: item.quantity,
        preco: (item.unitPrice || 0) / 100,
        precoFinal: (item.totalPrice || 0) / 100,
        categoria: item.externalCode ? 'ifood' : 'outros',
        observacao: item.observations || '',
        adicionais: (item.subItems || []).map(sub => ({
            nome: sub.name,
            quantidade: sub.quantity,
            preco: (sub.unitPrice || 0) / 100
        }))
    }));

    const pagamento = ifoodOrder.payments?.methods?.[0];
    const formaPagamento = pagamento ? (mapPagamento[pagamento.method] || pagamento.method.toLowerCase()) : 'outros';

    const endereco = ifoodOrder.deliveryAddress ? {
        rua: ifoodOrder.deliveryAddress.streetName || '',
        numero: ifoodOrder.deliveryAddress.streetNumber || '',
        bairro: ifoodOrder.deliveryAddress.neighborhood || '',
        cidade: ifoodOrder.deliveryAddress.city || '',
        estado: ifoodOrder.deliveryAddress.state || '',
        cep: ifoodOrder.deliveryAddress.postalCode || '',
        complemento: ifoodOrder.deliveryAddress.complement || '',
        referencia: ifoodOrder.deliveryAddress.reference || ''
    } : null;

    return {
        vendaId: `ifood_${ifoodOrder.id}`,
        ifoodOrderId: ifoodOrder.id,
        source: 'ifood',
        tipo: ifoodOrder.orderType === 'TAKEOUT' ? 'retirada' : 'delivery',
        tipoEntrega: ifoodOrder.orderType === 'TAKEOUT' ? 'retirada' : 'delivery',
        status: mapStatus[ifoodOrder.status] || 'recebido',
        estabelecimentoId,
        cliente: {
            nome: ifoodOrder.customer?.name || 'Cliente iFood',
            telefone: ifoodOrder.customer?.phone || '',
            userId: null
        },
        endereco,
        itens,
        totalFinal: (ifoodOrder.displayTotalPrice || ifoodOrder.totalPrice || 0) / 100,
        taxaEntrega: (ifoodOrder.deliveryFee || 0) / 100,
        formaPagamento,
        metodoPagamento: formaPagamento,
        observacoes: ifoodOrder.observations || '',
        createdAt: FieldValue.serverTimestamp(),
        atualizadoEm: FieldValue.serverTimestamp(),
        dataPedido: FieldValue.serverTimestamp()
    };
}

// ==================================================================
// FUNÇÃO 1: Webhook — iFood envia pedidos em tempo real
// ==================================================================
export const ifoodWebhook = onRequest({
    cors: false
}, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const eventos = req.body;
        logger.info('📦 iFood Webhook recebido:', JSON.stringify(eventos).slice(0, 500));

        if (!Array.isArray(eventos) || eventos.length === 0) {
            return res.status(200).send('OK');
        }

        for (const evento of eventos) {
            const { code, orderId, merchantId, fullCode } = evento;

            if (!orderId || !merchantId) continue;

            // Buscar o estabelecimentoId no Firestore pelo merchantId do iFood
            const estabSnap = await db.collection('estabelecimentos')
                .where('ifoodMerchantId', '==', merchantId)
                .limit(1).get();

            if (estabSnap.empty) {
                logger.warn(`iFood: merchantId ${merchantId} não encontrado no Firestore.`);
                continue;
            }

            const estabelecimentoId = estabSnap.docs[0].id;

            // Buscar detalhes do pedido na API
            try {
                const token = await getIfoodToken(estabelecimentoId);
                const orderRes = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!orderRes.ok) {
                    logger.error(`iFood: falha ao buscar pedido ${orderId}: ${orderRes.status}`);
                    continue;
                }

                const ifoodOrder = await orderRes.json();
                const pedidoMapeado = mapearPedidoIfood(ifoodOrder, estabelecimentoId);

                // Salvar/atualizar no Firestore
                const pedidoRef = db.collection('estabelecimentos')
                    .doc(estabelecimentoId)
                    .collection('pedidos')
                    .doc(pedidoMapeado.vendaId);

                await pedidoRef.set(pedidoMapeado, { merge: true });

                // Dar ACK para o iFood (confirmar recebimento do evento)
                await fetch(`${IFOOD_BASE_URL}/order/v1.0/events/acknowledgment`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify([{ id: evento.id }])
                });

                logger.info(`✅ iFood: pedido ${orderId} salvo como ${pedidoMapeado.vendaId}`);

            } catch (e) {
                logger.error(`❌ iFood: erro ao processar evento ${orderId}:`, e.message);
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('❌ iFood Webhook erro geral:', error);
        res.status(200).send('OK'); // Sempre 200 para o iFood não retentar em loop
    }
});

// ==================================================================
// FUNÇÃO 2: Polling — buscar pedidos pendentes periodicamente
// ==================================================================
export const ifoodPolling = onCall({
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId } = request.data || {};
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

    try {
        const token = await getIfoodToken(estabelecimentoId);

        // Buscar eventos pendentes (pedidos não confirmados)
        const eventsRes = await fetch(`${IFOOD_BASE_URL}/order/v1.0/events:polling`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!eventsRes.ok) {
            const err = await eventsRes.text();
            throw new HttpsError('internal', `iFood API erro: ${eventsRes.status} - ${err}`);
        }

        const eventos = await eventsRes.json();
        logger.info(`📡 iFood Polling: ${eventos?.length || 0} eventos encontrados`);

        if (!eventos || eventos.length === 0) {
            return { sucesso: true, pedidosNovos: 0, mensagem: 'Nenhum pedido novo.' };
        }

        let pedidosNovos = 0;
        const idsParaACK = [];

        for (const evento of eventos) {
            const { orderId } = evento;
            if (!orderId) continue;

            const orderRes = await fetch(`${IFOOD_BASE_URL}/order/v1.0/orders/${orderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!orderRes.ok) continue;

            const ifoodOrder = await orderRes.json();
            const pedidoMapeado = mapearPedidoIfood(ifoodOrder, estabelecimentoId);

            const pedidoRef = db.collection('estabelecimentos')
                .doc(estabelecimentoId)
                .collection('pedidos')
                .doc(pedidoMapeado.vendaId);

            const existe = await pedidoRef.get();
            if (!existe.exists) {
                await pedidoRef.set(pedidoMapeado);
                pedidosNovos++;
            }

            if (evento.id) idsParaACK.push({ id: evento.id });
        }

        // Confirmar recebimento de todos os eventos
        if (idsParaACK.length > 0) {
            await fetch(`${IFOOD_BASE_URL}/order/v1.0/events/acknowledgment`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(idsParaACK)
            });
        }

        return {
            sucesso: true,
            pedidosNovos,
            mensagem: `${pedidosNovos} pedido(s) novos sincronizados do iFood.`
        };

    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('❌ ifoodPolling erro:', error);
        throw new HttpsError('internal', `Erro no polling iFood: ${error.message}`);
    }
});

// ==================================================================
// FUNÇÃO 3: Atualizar status do pedido no iFood
// ==================================================================
export const ifoodAtualizarStatus = onCall({
    cors: true
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId, ifoodOrderId, novoStatus } = request.data || {};
    if (!estabelecimentoId || !ifoodOrderId || !novoStatus) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId, ifoodOrderId e novoStatus são obrigatórios.');
    }

    // Mapa de status interno → endpoint iFood
    const endpointMap = {
        'preparo':          `/order/v1.0/orders/${ifoodOrderId}/startPreparation`,
        'pronto_para_servir': `/order/v1.0/orders/${ifoodOrderId}/readyToPickup`,
        'em_entrega':       `/order/v1.0/orders/${ifoodOrderId}/dispatch`,
        'finalizado':       `/order/v1.0/orders/${ifoodOrderId}/conclude`,
        'cancelado':        `/order/v1.0/orders/${ifoodOrderId}/requestCancellation`
    };

    const endpoint = endpointMap[novoStatus];
    if (!endpoint) {
        return { sucesso: true, mensagem: 'Status não precisa ser sincronizado com o iFood.' };
    }

    try {
        const token = await getIfoodToken(estabelecimentoId);

        const res = await fetch(`${IFOOD_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const errBody = await res.text();
            logger.warn(`iFood status update falhou: ${res.status} - ${errBody}`);
            // Não lança erro — o painel interno já atualizou, iFood é best-effort
            return { sucesso: false, mensagem: `iFood retornou ${res.status}: ${errBody}` };
        }

        logger.info(`✅ iFood: pedido ${ifoodOrderId} → status "${novoStatus}" sincronizado.`);
        return { sucesso: true, mensagem: `Status "${novoStatus}" enviado ao iFood com sucesso.` };

    } catch (error) {
        logger.error('❌ ifoodAtualizarStatus erro:', error);
        throw new HttpsError('internal', `Erro ao atualizar status iFood: ${error.message}`);
    }
});

// ==================================================================
// FUNÇÃO 4: Testar autenticação OAuth2 do iFood (para a tela de config)
// ==================================================================
export const ifoodTestarConexao = onCall({
    cors: true,
    invoker: 'public'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId } = request.data || {};
    if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

    try {
        const token = await getIfoodToken(estabelecimentoId);

        // Tentar buscar merchants vinculados para confirmar que o token funciona
        const res = await fetch(`${IFOOD_BASE_URL}/merchant/v1.0/merchants`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        let merchants = [];
        if (res.ok) {
            const data = await res.json();
            merchants = Array.isArray(data) ? data : (data.merchants || []);
        }

        // Salvar merchantId no estabelecimento (se encontrado)
        if (merchants.length > 0) {
            await db.collection('estabelecimentos').doc(estabelecimentoId).update({
                ifoodMerchantId: merchants[0].id,
                ifoodMerchantName: merchants[0].name,
                ifoodConectado: true,
                ifoodTestadoEm: FieldValue.serverTimestamp()
            });
        }

        logger.info(`✅ iFood conexão testada com sucesso para ${estabelecimentoId}`);
        return {
            sucesso: true,
            merchants,
            mensagem: merchants.length > 0
                ? `Conectado! ${merchants.length} restaurante(s) encontrado(s).`
                : 'Token válido. Nenhum merchant vinculado ainda (aguardando aprovação iFood).'
        };

    } catch (error) {
        logger.error('❌ ifoodTestarConexao erro:', error);
        throw new HttpsError('internal', `Falha na conexão com iFood: ${error.message}`);
    }
});

// ==================================================================
// FUNÇÃO 5: Configurar URL do webhook no iFood
// ==================================================================
export const ifoodConfigurarWebhook = onCall({
    cors: true,
    invoker: 'public'
}, async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

    const { estabelecimentoId, merchantId } = request.data || {};
    if (!estabelecimentoId || !merchantId) {
        throw new HttpsError('invalid-argument', 'estabelecimentoId e merchantId são obrigatórios.');
    }

    try {
        const token = await getIfoodToken(estabelecimentoId);
        const webhookUrl = `https://us-central1-matafome-98455.cloudfunctions.net/ifoodWebhook`;

        // The webhook URL must be pasted manually into the iFood dev portal.
        // There is no API route to set it automatically for Partner/Merchant API v1.0.

        await db.collection('estabelecimentos').doc(estabelecimentoId).update({
            ifoodWebhookConfigurado: true,
            ifoodWebhookUrl: webhookUrl,
            ifoodWebhookConfigEm: FieldValue.serverTimestamp()
        });

        logger.info(`✅ iFood webhook configurado para ${merchantId}: ${webhookUrl}`);
        return { sucesso: true, webhookUrl, mensagem: 'Webhook configurado com sucesso no iFood!' };

    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('❌ ifoodConfigurarWebhook erro:', error);
        throw new HttpsError('internal', `Erro ao configurar webhook: ${error.message}`);
    }
});

// ==================================================================
// 20. OPT-OUT DE MARKETING
// ==================================================================

/**
 * Registra opt-out de um cliente (via chamada direta ou webhook WhatsApp).
 * Salva em estabelecimentos/{estabId}/optout/{telefone}
 */
export const registrarOptout = onCall({ cors: true }, async (request) => {
  const { estabelecimentoId, telefone, motivo } = request.data || {};
  if (!estabelecimentoId || !telefone) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e telefone são obrigatórios.');
  }

  const telLimpo = String(telefone).replace(/\D/g, '');
  if (telLimpo.length < 10) throw new HttpsError('invalid-argument', 'Telefone inválido.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').doc(telLimpo).set({
        telefone: telLimpo,
        motivo: motivo || 'solicitado pelo cliente',
        criadoEm: FieldValue.serverTimestamp()
      });

    logger.info(`✅ Opt-out registrado: ${telLimpo} para ${estabelecimentoId}`);
    return { sucesso: true, mensagem: 'Descadastro realizado com sucesso.' };
  } catch (error) {
    logger.error('❌ Erro ao registrar opt-out:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Remove opt-out de um cliente (admin reativa o cliente)
 */
export const removerOptout = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, telefone } = request.data || {};
  if (!estabelecimentoId || !telefone) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  const telLimpo = String(telefone).replace(/\D/g, '');
  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').doc(telLimpo).delete();
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Lista todos os opt-outs de um estabelecimento
 */
export const listarOptouts = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').orderBy('criadoEm', 'desc').limit(200).get();
    const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { sucesso: true, lista };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Webhook HTTP para receber mensagens do WhatsApp (UAZAPI).
 * Detecta "SAIR", "PARAR", "STOP", "CANCELAR" e registra opt-out automaticamente.
 */
export const webhookWhatsAppOptout = onRequest({ cors: false }, async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const body = req.body;
    // UAZAPI envia: { phone, message: { text }, ... }
    const telefone = body?.phone || body?.from || body?.numero || '';
    const texto = String(body?.message?.text || body?.text || body?.mensagem || '').trim().toUpperCase();
    const estabId = req.query.estabId || body?.estabId || '';

    logger.info(`📨 WebhookOptout: from=${telefone} | texto="${texto}" | estabId=${estabId}`);

    const palavrasOptout = ['SAIR', 'PARAR', 'STOP', 'PARE', 'CANCELAR', 'DESCADASTRAR', 'NAO QUERO', 'NÃO QUERO', 'REMOVER'];
    const isOptout = palavrasOptout.some(p => texto === p || texto.startsWith(p + ' '));

    if (isOptout && estabId && telefone) {
      const telLimpo = String(telefone).replace(/\D/g, '');
      await db.collection('estabelecimentos').doc(estabId)
        .collection('optout').doc(telLimpo).set({
          telefone: telLimpo,
          motivo: `cliente enviou: "${body?.message?.text || texto}"`,
          criadoEm: FieldValue.serverTimestamp(),
          viaWhatsapp: true
        });

      // Responder automaticamente confirmando o descadastro
      const estabSnap = await db.collection('estabelecimentos').doc(estabId).get();
      if (estabSnap.exists()) {
        const estab = estabSnap.data();
        const wConfig = estab.whatsapp || {};
        if (wConfig.ativo && wConfig.serverUrl && wConfig.apiKey) {
          const nomeEstab = estab.nome || 'o estabelecimento';
          try {
            await enviarWhatsAppUAZAPI(wConfig, telLimpo,
              `✅ Você foi descadastrado das mensagens automáticas de *${nomeEstab}*.\n\nVocê não receberá mais nossas promoções automáticas. Obrigado!`
            );
          } catch (e) {
            logger.warn('Falha ao enviar confirmação de optout:', e.message);
          }
        }
      }

      logger.info(`✅ Opt-out automático registrado: ${telLimpo} para ${estabId}`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('❌ Erro webhookWhatsAppOptout:', error);
    res.status(200).json({ ok: false }); // Sempre 200 para webhook
  }
});

