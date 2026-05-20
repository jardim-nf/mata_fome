import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';
import { verifyAdminAccess } from '../authUtils.js';

const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
const whatsappApiToken = defineSecret('WHATSAPP_API_TOKEN');
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const metaApiTokenSecret = defineSecret('META_API_TOKEN');
const metaVerifyTokenSecret = defineSecret('META_VERIFY_TOKEN');

// ==================================================================
// 14. WHATSAPP BUSINESS API & UAZAPI E MOTOR FLUXO (HÍBRIDO)
// ==================================================================
// Nota: estado das conversas migrado para Firestore (suporta múltiplas instâncias Cloud Run)
// A variável `conversas` em RAM foi removida para evitar perda de contexto entre instâncias.

// Cache de produtos por estabelecimento (TTL: 5 minutos)
// Evita N+1 queries ao Firestore a cada mensagem recebida no bot
const _produtosCache = new Map();

async function buscarProdutosRobo(estabId) {
    const cached = _produtosCache.get(estabId);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
    }
    const produtos = [];
    const categoriasSnap = await db.collection(`estabelecimentos/${estabId}/cardapio`).get();
    for (const catDoc of categoriasSnap.docs) {
        const itensSnap = await db.collection(`estabelecimentos/${estabId}/cardapio/${catDoc.id}/itens`).where('ativo', '==', true).get();
        itensSnap.forEach(d => {
            const data = d.data();
            produtos.push({ id: d.id, ...data, categoria: data.categoriaNome || catDoc.data().nome || 'Outros' });
        });
    }
    _produtosCache.set(estabId, { data: produtos, timestamp: Date.now() });
    return produtos;
}

// Função centralizada para atender requisições de WhatsApp, Messenger e Instagram
async function processarFluxoRobo(chatKey, estabId, estab, produtos, messageText, from, origem) {
    const agora = Date.now();

    // ── Estado persistido no Firestore (suporta múltiplas instâncias Cloud Run) ──
    // conversas em RAM causavam bug: com maxInstances:10, cada mensagem podia
    // cair em instâncias diferentes e o bot perdia o contexto do pedido.
    const chatRef = db.doc(`conversasBot/${chatKey}`);
    const chatSnap = await chatRef.get();
    let chat;

    if (chatSnap.exists()) {
        chat = chatSnap.data();
        // FIX: reset aumentado para 20 min (antes 3 min causava perda de pedido em celulares lentos)
        if (chat.ultimaMensagem && (agora - chat.ultimaMensagem) > 20 * 60 * 1000) {
            chat = { etapa: 'inicio', itens: [], nome: '', enderecoEntrega: '', bairro: '', taxaEntrega: 0 };
        }
    } else {
        chat = { etapa: 'inicio', itens: [], nome: '', enderecoEntrega: '', bairro: '', taxaEntrega: 0 };
    }
    chat.ultimaMensagem = agora;

    let resposta = '';
    let finalizarConversa = false; // true = deletar doc do Firestore ao final;
    const msgLower = (messageText || '').toLowerCase().trim();

    const frasesCancelamento = ['cancelar', 'sair', 'reiniciar', 'não quero', 'nao quero', 'deixa pra la', 'deixa pra lá', 'obrigado', 'obrigada', 'encerrar', 'pare', 'parar', 'desisto'];

    // ——— REINICIAR / CANCELAR ———
    if (frasesCancelamento.some(f => msgLower.includes(f)) || msgLower === 'nao' || msgLower === 'não') {
      finalizarConversa = true;
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
        await db.doc(`estabelecimentos/${estabId}/clientes/${formatTel}`).update({
          saldoCashback: FieldValue.increment(-descontoAplicado),
          updatedAt: FieldValue.serverTimestamp()
        });
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
      finalizarConversa = true;

    } else if (!['inicio', 'pedindo', 'bairro', 'endereco', 'nome', 'telefone_contato', 'verificador_saldo', 'pergunta_cashback', 'salvar_pedido'].includes(chat.etapa)) {
      resposta = 'Olá! 👋 Digite *"oi"* ou *"menu"* para começar seu pedido!';
    }

    // ── Persistir estado no Firestore ────────────────────────────────────────
    if (finalizarConversa) {
        await chatRef.delete();
    } else {
        await chatRef.set(chat);
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

      // FIX: Não retornar 200 ainda se from existir mas messageText vazio (sticker/imagem/áudio)
      // Vamos verificar se há conversa ativa e avisar o cliente
      if (!from) return res.status(200).send('OK');

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

      // FIX: Mensagem sem texto (sticker, imagem, áudio) — avisa cliente se houver conversa ativa
      if (!messageText) {
        const chatKey = `${estabId}_${from}`;
        const chatSnap = await db.doc(`conversasBot/${chatKey}`).get();
        if (chatSnap.exists && chatSnap.data()?.etapa && chatSnap.data().etapa !== 'inicio') {
          const aviso = '⚠️ Só consigo processar *mensagens de texto*. Por favor, responda com texto para continuar seu pedido! 😊';
          if (wConfig.serverUrl && wConfig.apiKey && wConfig.instanceName) {
            const urlFormatada = wConfig.serverUrl.endsWith('/') ? wConfig.serverUrl.slice(0, -1) : wConfig.serverUrl;
            const telFinal = from.replace(/\D/g, '').startsWith('55') ? from.replace(/\D/g, '') : `55${from.replace(/\D/g, '')}`;
            await fetch(`${urlFormatada}/send/text`, {
              method: 'POST',
              headers: { 'token': wConfig.apiKey, 'Content-Type': 'application/json' },
              body: JSON.stringify({ number: telFinal, text: aviso })
            });
          }
        }
        return res.status(200).send('OK');
      }

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

    const token = request.auth.token;
    if (token.isMasterAdmin !== true && token.role !== 'master' && !(token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId))) {
      throw new HttpsError('permission-denied', 'Sem permissão para este estabelecimento.');
    }

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
export const webhookMetaChat = onRequest({ secrets: [metaApiTokenSecret, metaVerifyTokenSecret], maxInstances: 5 }, async (req, res) => {
    
    const verifyTokenReal = metaVerifyTokenSecret.value();
    const apiTokenReal = metaApiTokenSecret.value();

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

      // 2. Buscar todos os pedidos para mapear clientes (otimizado com select)
      const pedidosSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('pedidos')
        .select('cliente', 'clienteTelefone', 'clienteNome', 'criadoEm', 'createdAt', 'data')
        .get();

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

      // FIX: Carregar campanhas já enviadas HOJE para evitar duplicatas em caso de reexecução
      const inicioHoje = new Date(hoje);
      const campanhasHojeSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('campanhas')
        .where('tipo', '==', 'reengajamento')
        .where('sucesso', '==', true)
        .where('enviadoEm', '>=', inicioHoje)
        .get();
      const telJaEnviadosHoje = new Set(campanhasHojeSnap.docs.map(d => d.data().clienteTelefone));

      // ✅ FIX: Carregar opt-outs ANTES do loop para que a verificação de
      // aniversariantes funcione corretamente (antes estava declarado depois do uso)
      const optoutsSnap = await db.collection('estabelecimentos').doc(estabDoc.id)
        .collection('optout').get();
      const telOptouts = new Set(optoutsSnap.docs.map(d => d.id));

      const clientesInativos = [];
      const aniversariantes = [];

      for (const [tel, cliente] of clientesMap) {
        // Cliente inativo = último pedido antes do limite
        if (cliente.ultimoPedido && cliente.ultimoPedido < limiteData) {
          clientesInativos.push(cliente);
        }

        // Aniversário hoje — verifica opt-out (telOptouts já disponível)
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

        // 📅 FIX: Pular clientes que já receberam mensagem de reengajamento hoje
        if (telJaEnviadosHoje.has(cliente.telefone)) {
          logger.info(`📅 Já enviado hoje: pulando ${cliente.telefone}`);
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

  const token = request.auth.token;
  if (token.isMasterAdmin !== true && token.role !== 'master' && !(token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId))) {
    throw new HttpsError('permission-denied', 'Sem permissão para configurar marketing deste estabelecimento.');
  }

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

  const token = request.auth.token;
  if (token.isMasterAdmin !== true && token.role !== 'master' && !(token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId))) {
    throw new HttpsError('permission-denied', 'Sem permissão para contar clientes deste estabelecimento.');
  }

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

  const token = request.auth.token;
  if (token.isMasterAdmin !== true && token.role !== 'master' && !(token.estabelecimentos && token.estabelecimentos.includes(estabelecimentoId))) {
    throw new HttpsError('permission-denied', 'Sem permissão para enviar mensagens por este estabelecimento.');
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

    // 2. Buscar todos os pedidos e extrair telefones únicos com nomes (otimizado com select)
    const pedidosSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('pedidos')
      .select('cliente', 'clienteTelefone', 'clienteNome')
      .get();

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
              await telDocRef.set({
                nome: nomeCliente,
                telefone: formatTel,
                saldoCashback: FieldValue.increment(valorCashback),
                updatedAt: FieldValue.serverTimestamp()
              }, { merge: true });

              // Read back updated saldo for the notification message
              const telDocUpdated = await telDocRef.get();
              const novoSaldo = Number(telDocUpdated.data()?.saldoCashback) || valorCashback;
              
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
// 20. OPT-OUT DE MARKETING
// ==================================================================

/**
 * Registra opt-out de um cliente (via chamada direta ou webhook WhatsApp).
 * Salva em estabelecimentos/{estabId}/optout/{telefone}
 */
export const registrarOptout = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Usuário não autenticado.');

  const { estabelecimentoId, telefone, motivo } = request.data || {};
  if (!estabelecimentoId || !telefone) {
    throw new HttpsError('invalid-argument', 'estabelecimentoId e telefone são obrigatórios.');
  }

  await verifyAdminAccess(request, estabelecimentoId);

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

