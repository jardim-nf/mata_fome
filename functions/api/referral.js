import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

const openAiApiKey = defineSecret('OPENAI_API_KEY');

// ==================================================================
// 23. INDICAÇÃO DE CLIENTES (REFERRAL COM CASHBACK)
// ==================================================================

/**
 * Gera ou retorna o código de indicação único de um cliente
 */
export const gerarCodigoIndicacao = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  const uid = request.auth.uid;

  try {
    // Verificar se já tem código
    const clienteRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes').doc(uid);
    const clienteSnap = await clienteRef.get();

    if (clienteSnap.exists() && clienteSnap.data().codigoIndicacao) {
      return { sucesso: true, codigo: clienteSnap.data().codigoIndicacao, geradoAgora: false };
    }

    // Gerar código único de 6 chars (ex: MTF7X2)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const gerarCodigo = () => Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    let codigo = gerarCodigo();
    let tentativas = 0;

    // Garantir que não exista outro com o mesmo código
    while (tentativas < 10) {
      const existeSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('codigos_indicacao').doc(codigo).get();
      if (!existeSnap.exists()) break;
      codigo = gerarCodigo();
      tentativas++;
    }

    // Registrar o código
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('codigos_indicacao').doc(codigo).set({
        uid,
        criadoEm: FieldValue.serverTimestamp(),
        totalIndicados: 0,
        cashbackGerado: 0
      });

    // Salvar no perfil do cliente
    await clienteRef.set({
      codigoIndicacao: codigo,
      uid,
      criadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    logger.info(`🎁 Código de indicação gerado: ${codigo} para ${uid}`);
    return { sucesso: true, codigo, geradoAgora: true };
  } catch (error) {
    logger.error('❌ Erro ao gerar código de indicação:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Valida e processa uma indicação — chamado ao criar pedido com código
 * Credita cashback ao INDICADOR (quem indicou), não a quem foi indicado
 */
export const processarIndicacao = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, codigoIndicacao, pedidoId, valorPedido } = request.data || {};
  if (!estabelecimentoId || !codigoIndicacao) {
    throw new HttpsError('invalid-argument', 'Dados incompletos.');
  }

  const uidIndicado = request.auth.uid; // Quem está fazendo o pedido

  try {
    // 1. Buscar o código de indicação
    const codigoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('codigos_indicacao').doc(codigoIndicacao.toUpperCase());
    const codigoSnap = await codigoRef.get();

    if (!codigoSnap.exists()) {
      return { sucesso: false, mensagem: 'Código de indicação inválido.' };
    }

    const codigoData = codigoSnap.data();
    const uidIndicador = codigoData.uid;

    // Não pode usar o próprio código
    if (uidIndicador === uidIndicado) {
      return { sucesso: false, mensagem: 'Você não pode usar seu próprio código.' };
    }

    // Verificar se esse cliente já usou um código antes (primeira compra apenas)
    const clienteIndicadoRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes').doc(uidIndicado);
    const clienteIndicadoSnap = await clienteIndicadoRef.get();

    if (clienteIndicadoSnap.exists() && clienteIndicadoSnap.data().indicadoPor) {
      return { sucesso: false, mensagem: 'Você já usou um código de indicação anteriormente.' };
    }

    // 2. Buscar configuração de cashback por indicação do estabelecimento
    const estabSnap = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
    const estab = estabSnap.data() || {};
    const configIndicacao = estab.indicacao || {};
    const tipoRecompensa = configIndicacao.tipo || 'fixo'; // 'fixo' ou 'percentual'
    const valorRecompensa = Number(configIndicacao.valor || 5); // R$5 padrão
    const percentualRecompensa = Number(configIndicacao.percentual || 5); // 5% padrão

    // Calcular cashback
    let cashbackValor = 0;
    if (tipoRecompensa === 'fixo') {
      cashbackValor = valorRecompensa;
    } else {
      cashbackValor = ((Number(valorPedido) || 0) * percentualRecompensa) / 100;
    }
    cashbackValor = Math.round(cashbackValor * 100) / 100; // 2 casas decimais

    // 3. Creditar cashback ao INDICADOR
    const clienteIndicadorRef = db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes').doc(uidIndicador);

    await clienteIndicadorRef.set({
      cashbackPendente: FieldValue.increment(cashbackValor),
      cashbackTotal: FieldValue.increment(cashbackValor),
      totalIndicados: FieldValue.increment(1),
      atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    // 4. Registrar que o indicado usou o código (para não usar de novo)
    await clienteIndicadoRef.set({
      indicadoPor: codigoIndicacao.toUpperCase(),
      uidIndicador,
      indicadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp()
    }, { merge: true });

    // 5. Atualizar stats do código
    await codigoRef.update({
      totalIndicados: FieldValue.increment(1),
      cashbackGerado: FieldValue.increment(cashbackValor),
      ultimaIndicacaoEm: FieldValue.serverTimestamp()
    });

    // 6. Registrar indicação no histórico
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('indicacoes').add({
        codigoIndicacao: codigoIndicacao.toUpperCase(),
        uidIndicador,
        uidIndicado,
        pedidoId: pedidoId || null,
        valorPedido: Number(valorPedido) || 0,
        cashbackCreditado: cashbackValor,
        tipoRecompensa,
        criadoEm: FieldValue.serverTimestamp()
      });

    // 7. Notificar indicador via WhatsApp (se configurado)
    try {
      const wConfig = estab.whatsapp || {};
      if (wConfig.ativo && wConfig.serverUrl && wConfig.apiKey) {
        const indicadorSnap = await clienteIndicadorRef.get();
        const indicadorData = indicadorSnap.data() || {};
        const telefoneIndicador = indicadorData.telefone || '';
        if (telefoneIndicador) {
          const nomeEstab = estab.nome || 'Restaurante';
          await enviarWhatsAppUAZAPI(wConfig, telefoneIndicador,
            `🎉 *${nomeEstab}*\n\nParabéns! Um amigo fez o primeiro pedido usando seu código de indicação!\n\n💰 Você ganhou *R$ ${cashbackValor.toFixed(2).replace('.', ',')}* de cashback!\n\nContinue indicando e acumule mais!`
          );
        }
      }
    } catch (e) {
      logger.warn('Falha ao notificar indicador:', e.message);
    }

    logger.info(`🎁 Indicação processada: indicador=${uidIndicador} | cashback=R$${cashbackValor}`);
    return {
      sucesso: true,
      cashbackCreditado: cashbackValor,
      mensagem: `Código válido! O indicador ganhou R$ ${cashbackValor.toFixed(2).replace('.', ',')} de cashback.`
    };
  } catch (error) {
    logger.error('❌ Erro ao processar indicação:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Configura as regras de indicação de um estabelecimento
 */
export const configurarIndicacao = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, config } = request.data || {};
  if (!estabelecimentoId || !config) throw new HttpsError('invalid-argument', 'Dados incompletos.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      indicacao: {
        ativo: !!config.ativo,
        tipo: config.tipo === 'percentual' ? 'percentual' : 'fixo',
        valor: Math.max(0, Math.min(100, Number(config.valor) || 5)),
        percentual: Math.max(0, Math.min(50, Number(config.percentual) || 5)),
        atualizadoEm: FieldValue.serverTimestamp()
      }
    });

    logger.info(`✅ Configuração de indicação atualizada para ${estabelecimentoId}`);
    return { sucesso: true };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Busca ranking de indicadores de um estabelecimento
 */
export const buscarRankingIndicadores = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId } = request.data || {};
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('clientes')
      .where('totalIndicados', '>', 0)
      .orderBy('totalIndicados', 'desc')
      .limit(20)
      .get();

    const ranking = snap.docs.map((d, i) => {
      const data = d.data();
      return {
        posicao: i + 1,
        uid: d.id,
        nome: data.nome || 'Cliente',
        telefone: data.telefone || '',
        totalIndicados: data.totalIndicados || 0,
        cashbackTotal: data.cashbackTotal || 0,
        codigoIndicacao: data.codigoIndicacao || ''
      };
    });

    return { sucesso: true, ranking };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// 🤖 BOT DE PEDIDOS VIA WHATSAPP (OpenAI + UAZAPI)
// ==================================================================

// Helper: busca cardápio formatado do Firestore
async function buscarCardapioFormatado(estabelecimentoId) {
  try {
    // Buscar categorias do cardápio
    const categoriasSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').get();

    if (categoriasSnap.empty) return 'Cardápio não disponível no momento.';

    let texto = '';
    let totalProdutos = 0;

    // Para cada categoria, buscar os itens na subcoleção
    for (const catDoc of categoriasSnap.docs) {
      const catData = catDoc.data();
      const catNome = catData.nome || catDoc.id;

      const itensSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
        .collection('cardapio').doc(catDoc.id)
        .collection('itens').where('ativo', '!=', false).get();

      if (itensSnap.empty) continue;

      texto += `\n*${catNome.toUpperCase()}*\n`;
      itensSnap.docs.forEach(itemDoc => {
        const p = itemDoc.data();
        const preco = Number(p.preco || p.precoFinal || 0).toFixed(2);
        texto += `• ${p.nome} — R$ ${preco}`;
        if (p.descricao) texto += ` (${p.descricao.slice(0, 60)})`;
        texto += ` [ID:${itemDoc.id}]\n`;
        // Variações (só mostrar se tiver mais de 1 ou for diferente do preço base)
        const precoBase = Number(p.preco || p.precoFinal || 0);
        const variacoesFiltradas = (p.variacoes || []).filter(v =>
          v.nome && v.preco > 0 && (
            (p.variacoes.length > 1) || // múltiplas variações
            (Math.abs(Number(v.preco) - precoBase) > 0.01) // preço diferente
          )
        );
        variacoesFiltradas.forEach(v => {
          texto += `  - ${v.nome}: R$ ${Number(v.preco).toFixed(2)}\n`;
        });
        totalProdutos++;
      });
    }

    if (totalProdutos === 0) return 'Cardápio não disponível no momento.';
    return texto;
  } catch (e) {
    logger.error('Erro ao buscar cardápio:', e);
    return 'Cardápio indisponível.';
  }
}

// Helper: busca taxa de entrega por bairro/endereço
async function buscarTaxaEntrega(estabelecimentoId, enderecoTexto) {
  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('taxasDeEntrega').get();
    if (snap.empty) return { taxa: 0, bairro: null };

    // Normalizar o endereço para busca
    const endLower = (enderecoTexto || '').toLowerCase();
    let melhor = null;

    snap.docs.forEach(doc => {
      const t = doc.data();
      const bairroLower = (t.nomeBairro || '').toLowerCase();
      if (bairroLower && endLower.includes(bairroLower)) {
        melhor = { taxa: Number(t.valorTaxa || 0), bairro: t.nomeBairro, id: doc.id };
      }
    });

    // Se não encontrou por bairro, não assume taxa — retorna naoEncontrado
    if (!melhor) {
      return { taxa: null, bairro: null, naoEncontrado: true };
    }
    return melhor;
  } catch (e) {
    return { taxa: 0, bairro: null };
  }
}

// Helper: busca nome do cliente em pedidos anteriores (tenta múltiplos formatos de fone)
async function buscarNomeCliente(estabelecimentoId, telefone) {
  try {
    const digitos = telefone.replace(/\D/g, '').replace('cus', '').replace('swhatsappnet', '');
    const sem55 = digitos.startsWith('55') ? digitos.slice(2) : digitos;
    const com55 = digitos.startsWith('55') ? digitos : `55${digitos}`;
    const formatos = [telefone, digitos, sem55, com55];

    for (const fmt of formatos) {
      try {
        const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
          .collection('pedidos')
          .where('clienteTelefone', '==', fmt)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (!snap.empty) {
          const nome = snap.docs[0].data().clienteNome;
          if (nome && nome !== 'Cliente WhatsApp') {
            logger.info(`👤 Nome encontrado para ${fmt}: ${nome}`);
            return nome;
          }
        }
      } catch (_) { /* continua para próximo formato */ }
    }
    return null;
  } catch (e) {
    logger.warn(`buscarNomeCliente erro: ${e.message}`);
    return null;
  }
}

// Helper: salva/atualiza sessão de conversa
async function getOuCriarSessao(estabelecimentoId, telefone) {
  const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('bot_sessoes').doc(telefone);
  const snap = await ref.get();

  if (snap.exists) {
    const data = snap.data();
    // Sessão expira em 30 minutos de inatividade
    const ultimaMensagem = data.ultimaMensagem?.toDate?.() || new Date(0);
    const minutosPassados = (Date.now() - ultimaMensagem.getTime()) / 60000;
    if (minutosPassados > 30) {
      // Reseta sessão expirada
      await ref.set({ historico: [], estado: 'saudacao', criadoEm: FieldValue.serverTimestamp(), ultimaMensagem: FieldValue.serverTimestamp() });
      return { historico: [], estado: 'saudacao' };
    }
    return { historico: data.historico || [], estado: data.estado || 'saudacao', pedidoAtual: data.pedidoAtual || null };
  }

  await ref.set({ historico: [], estado: 'saudacao', criadoEm: FieldValue.serverTimestamp(), ultimaMensagem: FieldValue.serverTimestamp() });
  return { historico: [], estado: 'saudacao', pedidoAtual: null };
}

// Helper: envia mensagem WhatsApp via UAZAPI (meunumero.uazapi.com)
// Endpoint: POST /send/text | Headers: token | Body: { number, text }
async function enviarMensagemBot(wConfig, telefone, mensagem) {
  try {
    const url = `${wConfig.serverUrl}/send/text`;
    logger.info(`📤 Enviando para ${telefone} via ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': wConfig.apiKey   // UAZAPI usa 'token', não 'apikey'
      },
      body: JSON.stringify({
        number: telefone,         // campo 'number' (não 'phone')
        text: mensagem            // campo 'text'
      })
    });
    const data = await res.json().catch(() => ({}));
    logger.info(`📤 Resposta UAZAPI: status=${res.status} | ${JSON.stringify(data).slice(0, 200)}`);
    return res.ok;
  } catch (e) {
    logger.error('Erro ao enviar mensagem bot:', e.message);
    return false;
  }
}

async function salvarSessao(estabelecimentoId, telefone, historico, estado, pedidoAtual = null) {
  const ref = db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('bot_sessoes').doc(telefone);
  await ref.set({
    historico: historico.slice(-20), // manter últimas 20 mensagens
    estado,
    pedidoAtual,
    ultimaMensagem: FieldValue.serverTimestamp()
  }, { merge: true });
}


async function criarPedidoBot({ estabelecimentoId, itens, clienteNome, clienteTelefone, observacoes, enderecoEntrega, taxaEntrega, bairroEntrega }) {
  let totalCalculado = 0;
  const itensProcessados = [];

  // Buscar TODOS os produtos reais (nas subcoleções itens de cada categoria)
  const categoriasSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('cardapio').get();

  const todosProdutos = [];
  for (const catDoc of categoriasSnap.docs) {
    const itensSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('cardapio').doc(catDoc.id).collection('itens').get();
    itensSnap.docs.forEach(itemDoc => {
      todosProdutos.push({ id: itemDoc.id, catId: catDoc.id, ...itemDoc.data() });
    });
  }

  for (const item of itens) {
    let produtoReal = null;

    if (item.id && !['ID_DO_PRODUTO', 'id', ''].includes(item.id)) {
      produtoReal = todosProdutos.find(p => p.id === item.id);
    }
    if (!produtoReal && item.nome) {
      const nomeQuery = item.nome.toLowerCase().trim();
      produtoReal = todosProdutos.find(p =>
        p.nome && (
          p.nome.toLowerCase() === nomeQuery ||
          p.nome.toLowerCase().includes(nomeQuery) ||
          nomeQuery.includes(p.nome.toLowerCase())
        )
      );
    }
    if (!produtoReal) { logger.warn(`⚠️ Não encontrado: ${item.id}/${item.nome}`); continue; }

    let preco = Number(produtoReal.preco || produtoReal.precoFinal) || 0;
    let nomeItem = produtoReal.nome;
    if (item.observacao && produtoReal.variacoes?.length > 0) {
      const varMatch = produtoReal.variacoes.find(v =>
        v.nome && item.observacao.toLowerCase().includes(v.nome.toLowerCase())
      );
      if (varMatch && varMatch.preco > 0) { preco = Number(varMatch.preco); nomeItem = `${produtoReal.nome} (${varMatch.nome})`; }
    }
    const qtd = Number(item.quantidade) || 1;
    totalCalculado += preco * qtd;
    itensProcessados.push({ id: produtoReal.id, nome: nomeItem, preco, quantidade: qtd, observacao: item.observacao || '' });
  }

  if (itensProcessados.length === 0) return null;

  const taxaFrete = Number(taxaEntrega) || 0;
  const totalComFrete = totalCalculado + taxaFrete;

  const pedido = {
    estabelecimentoId,
    itens: itensProcessados,
    subtotal: totalCalculado,
    taxaEntrega: taxaFrete,
    totalFinal: totalComFrete,
    clienteNome: clienteNome || 'Cliente WhatsApp',
    clienteTelefone,
    // objeto `cliente` para compatibilidade com Painel e ComandaParaImpressao
    cliente: { nome: clienteNome || 'Cliente WhatsApp', telefone: clienteTelefone },
    observacoes: observacoes || '',
    enderecoEntrega: enderecoEntrega || '',
    bairro: bairroEntrega || '',           // campo principal lido pela comanda
    bairroEntrega: bairroEntrega || '',    // retrocompatibilidade
    formaPagamento: 'cobrar_na_entrega',   // exibe "COBRAR NA ENTREGA" na comanda
    status: 'pendente',
    origem: 'whatsapp_bot',
    source: 'whatsapp',
    tipo: 'delivery',
    tipoEntrega: enderecoEntrega?.trim().toUpperCase() === 'RETIRADA' ? 'retirada' : 'delivery',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };

  const ref = await db.collection('estabelecimentos').doc(estabelecimentoId)
    .collection('pedidos').add(pedido);

  logger.info(`🤖 Pedido criado: ${ref.id} | ${clienteTelefone} | subtotal=R$${totalCalculado} frete=R$${taxaFrete} total=R$${totalComFrete}`);
  return { pedidoId: ref.id, subtotal: totalCalculado, taxaEntrega: taxaFrete, totalFinal: totalComFrete, itens: itensProcessados };
}

// ==================================================================
// WEBHOOK PRINCIPAL DO BOT
// POST /webhookBotPedidos?estabId=XXX
// Configurar este URL no UAZAPI como webhook de mensagens recebidas
// ==================================================================
export const webhookBotPedidos = onRequest({ // v4-202603312127

  cors: true,
  secrets: [openAiApiKey]
}, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const estabelecimentoId = req.query.estabId;
  if (!estabelecimentoId) return res.status(400).json({ erro: 'estabId obrigatório' });

  try {
    const body = req.body;
    logger.info('🤖 Webhook recebido:', JSON.stringify(body).slice(0, 800));

    // ================================================================
    // PARSER UNIVERSAL — suporta múltiplos formatos do UAZAPI
    // ================================================================
    let telefone = '';
    let mensagemTexto = '';
    let fromMe = false;

    // Log diagnóstico: ver estrutura completa do payload
    logger.info(`🔍 body keys=${Object.keys(body).join(',')} | chat=${JSON.stringify(body.chat||{})} | messages[0]=${JSON.stringify((body.messages||[])[0]||{}).slice(0,300)}`);

    if (body.BaseUrl) {
      // Formato A — meunumero.uazapi.com
      const msgArr = body.messages || (body.message ? [body.message] : []);
      const msg = msgArr[0] || {};

      // Prioridade: remoteJid no messages[] > phone/sender/from na raiz > chat.phone
      // NAO usar chat.id — é ID interno do UAZAPI, não número WhatsApp
      telefone = msg?.key?.remoteJid
        || msg?.remoteJid
        || body?.phone
        || body?.sender
        || body?.from
        || body?.chat?.phone
        || body?.chat?.number
        || '';

      mensagemTexto = msg?.message?.conversation
        || msg?.message?.extendedTextMessage?.text
        || msg?.text || msg?.body
        || body?.text || body?.body || body?.content || '';
      fromMe = msg?.key?.fromMe ?? msg?.fromMe ?? body?.fromMe ?? false;

    } else if (body?.data?.key?.remoteJid) {
      // Formato B
      telefone      = body.data.key.remoteJid;
      mensagemTexto = body.data?.message?.conversation
        || body.data?.message?.extendedTextMessage?.text || '';
      fromMe        = body.data.key.fromMe || false;
    } else if (body?.key?.remoteJid) {
      // Formato C — legado
      telefone      = body.key.remoteJid;
      mensagemTexto = body.message?.conversation
        || body.message?.extendedTextMessage?.text || '';
      fromMe        = body.key.fromMe || false;
    }

    // Limpar telefone
    telefone = String(telefone).replace(/@[\w.]+/g, '').replace(/[^0-9]/g, '');
    logger.info(`📱 tel=${telefone} fromMe=${fromMe} msg="${String(mensagemTexto).slice(0, 80)}"`);

    // Ignorar: próprio bot, grupos, sem telefone/texto
    if (fromMe || !telefone || !mensagemTexto || telefone.length < 8) {
      return res.status(200).json({ ok: true, ignorado: true, motivo: `fromMe=${fromMe} tel='${telefone}' msg=${!!mensagemTexto}` });
    }

    mensagemTexto = String(mensagemTexto).trim();
    logger.info(`📩 Mensagem de ${telefone}: "${mensagemTexto}"`);

    // Buscar configuração do estabelecimento
    const estabSnap = await db.collection('estabelecimentos').doc(estabelecimentoId).get();
    if (!estabSnap.exists) return res.status(404).json({ erro: 'Estabelecimento não encontrado' });

    const estab = estabSnap.data();
    const wConfig = estab.whatsapp || {};
    const botConfig = estab.botPedidos || {};
    const nomeEstab = estab.nome || 'Restaurante';

    // Verificar se o bot está ativo
    if (!botConfig.ativo) return res.status(200).json({ ok: true, botDesativado: true });

    // Verificar opt-out
    const optoutSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('optout').doc(telefone).get();
    if (optoutSnap.exists) return res.status(200).json({ ok: true, optout: true });

    if (!wConfig.instanceName || !wConfig.serverUrl || !wConfig.apiKey) {
      logger.warn(`Bot: WhatsApp não configurado para ${estabelecimentoId}`);
      return res.status(200).json({ ok: true });
    }

    // Buscar sessão, cardápio, nome do cliente e taxas em paralelo
    const [sessao, cardapioTexto, nomeClienteSalvo, taxasEntregaSnap] = await Promise.all([
      getOuCriarSessao(estabelecimentoId, telefone),
      buscarCardapioFormatado(estabelecimentoId),
      buscarNomeCliente(estabelecimentoId, telefone),
      db.collection('estabelecimentos').doc(estabelecimentoId).collection('taxasDeEntrega').get()
    ]);

    // Formatar taxas: lista interna para o prompt + lista numerada para mostrar ao cliente
    let taxasTexto = '';
    let listaBairrosCliente = '';
    if (!taxasEntregaSnap.empty) {
      const taxasOrdenadas = taxasEntregaSnap.docs
        .map(d => ({ nome: d.data().nomeBairro || '', taxa: Number(d.data().valorTaxa || 0) }))
        .filter(t => t.nome)
        .sort((a, b) => a.nome.localeCompare(b.nome));

      // Lista interna (para o GPT saber os valores)
      const taxasInternas = taxasOrdenadas
        .map(t => `  ${t.nome}: R$ ${t.taxa.toFixed(2).replace('.', ',')}`)
        .join('\n');

      // Lista formatada para ENVIAR ao cliente no WhatsApp
      listaBairrosCliente = taxasOrdenadas
        .map((t, i) => `${i + 1}. *${t.nome}* — R$ ${t.taxa.toFixed(2).replace('.', ',')}`)
        .join('\n');

      taxasTexto = `\n\nBAIRROS ATENDIDOS E TAXAS:\n${taxasInternas}\n\nQUANDO PEDIR O BAIRRO, SEMPRE ENVIE ESTE TEXTO EXATO AO CLIENTE:\n"Qual é o seu bairro? Atendemos os seguintes:\n${listaBairrosCliente}\nDigite o número ou o nome do seu bairro! 📍"`;
    } else {
      taxasTexto = '\n\nENTREGA: Sem bairros cadastrados. Combine a taxa com o cliente.';
    }

    // ================================================================
    // HANDOFF HUMANO: detecta pedido de atendente
    // ================================================================
    const PALAVRAS_HUMANO = [
      'falar com atendente', 'falar com responsavel', 'falar com o responsavel',
      'falar com humano', 'falar com pessoa', 'quero falar com',
      'quero atendente', 'chamar atendente', 'atendimento humano',
      'preciso de ajuda humana', 'me passa pra atendente', 'me passa para atendente',
      'chama o responsavel', 'chama o gerente', 'fala com o dono'
    ];
    const PALAVRAS_RETOMAR = ['quero o bot', 'ativar bot', 'voltar pro bot', 'fazer pedido pelo bot', 'bot ativo'];

    const msgLower = mensagemTexto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se está em atendimento humano, verifica se quer retomar o bot
    if (sessao.estado === 'atendimento_humano') {
      const querRetomar = PALAVRAS_RETOMAR.some(p => msgLower.includes(p));
      if (querRetomar) {
        await salvarSessao(estabelecimentoId, telefone, sessao.historico, 'saudacao');
        const msgRetomada = `🤖 Bot reativado! Olá${nomeClienteSalvo ? `, ${nomeClienteSalvo}` : ''}! Como posso ajudar? 😊`;
        await enviarMensagemBot(wConfig, telefone, msgRetomada);
        return res.status(200).json({ ok: true, retomouBot: true });
      }
      // Bot está pausado — não responde automaticamente
      logger.info(`🙋 ${telefone} em atendimento_humano — bot pausado`);
      return res.status(200).json({ ok: true, pause: true });
    }

    // Detecta pedido de atendente humano
    const querHumano = PALAVRAS_HUMANO.some(p => msgLower.includes(p));
    if (querHumano) {
      // Pausar o bot para este cliente
      await salvarSessao(estabelecimentoId, telefone, sessao.historico, 'atendimento_humano');

      // Avisar o cliente
      const msgCliente = `👋 Claro! Vou chamar um de nossos atendentes agora.\n\nEm instantes alguém entrará em contato com você. ⏳\n\n_Para retomar o pedido pelo bot, digite *bot*._`;
      await enviarMensagemBot(wConfig, telefone, msgCliente);

      // Notificar o dono (telefone_whatsapp do estabelecimento)
      const telefoneDono = estab.informacoes_contato?.telefone_whatsapp || estab.telefone || null;
      if (telefoneDono) {
        const telDonoNum = String(telefoneDono).replace(/\D/g, '');
        const telDonoFmt = telDonoNum.startsWith('55') ? telDonoNum : `55${telDonoNum}`;
        const nomeClienteMsg = nomeClienteSalvo || telefone;
        const msgDono = `🔔 *ATENÇÃO — ${nomeEstab}*\n\nO cliente *${nomeClienteMsg}* (${telefone}) quer falar com um atendente!\n\n📱 Clique para responder: https://wa.me/${telefone}`;
        await enviarMensagemBot(wConfig, telDonoFmt, msgDono);
        logger.info(`🔔 Notificação enviada ao dono ${telDonoFmt}`);
      } else {
        logger.warn(`⚠️ Telefone do dono não cadastrado em informacoes_contato.telefone_whatsapp`);
      }

      return res.status(200).json({ ok: true, handoff: true });
    }

    const openai = new OpenAI({ apiKey: openAiApiKey.value() });

    // System prompt do bot
    const jsonExNome = nomeClienteSalvo ? `"${nomeClienteSalvo}"` : '"Nome do cliente"';
    const jsonExample = `{"acao":"CRIAR_PEDIDO","itens":[{"id":"ID_DO_PRODUTO","nome":"Nome do produto exato do cardápio","quantidade":1,"observacao":""}],"clienteNome":${jsonExNome},"enderecoEntrega":"Rua e número apenas","bairro":"Nome do bairro escolhido","observacoes":""}`;

    const regrasCliente = nomeClienteSalvo
      ? `CLIENTE FIEL: O nome dele é "${nomeClienteSalvo}". NUNCA peça o nome dele. Cumprimente-o pelo nome. No JSON do pedido use sempre clienteNome: "${nomeClienteSalvo}".`
      : `CLIENTE NOVO: Você precisa perguntar o nome completo ANTES de confirmar o pedido. Só pergunte uma vez.`;

    const systemPrompt = `Você é o atendente virtual do *${nomeEstab}* no WhatsApp. Seja simpático, direto e use emojis com moderação.

${regrasCliente}

CARDÁPIO DISPONÍVEL (use EXATAMENTE os IDs entre [ID:...] ao criar pedidos):
${cardapioTexto}
${taxasTexto}

REGRAS:
1. Apresente o cardápio organizado por categoria quando solicitado
2. ${nomeClienteSalvo ? `NÃO peça o nome — já é "${nomeClienteSalvo}". Pergunte só o endereço e bairro.` : 'Primeiro colete o pedido, depois peça: nome completo + endereço + bairro.'}
3. OBRIGATÓRIO: Sempre que pedir o bairro, envie a lista de bairros EXATAMENTE como descrita acima (com números e taxas). NÃO pergunte só "qual é seu bairro?" sem mostrar a lista.
4. Após o cliente escolher o bairro (pelo número ou nome), confirme: "Bairro X — taxa R$ Y." e mostre o resumo: subtotal + frete + total
5. Quando o cliente CONFIRMAR, retorne APENAS (JSON puro, sem markdown, uma linha):
PEDIDO_JSON:${jsonExample}:FIM_JSON
6. Se quiser cancelar: CANCELAR_PEDIDO
7. Nunca invente produtos fora do cardápio
8. Valores exatamente como no cardápio
9. Se o bairro não está na lista, avise e mostre a lista novamente
10. No JSON, coloque em "bairro" o nome EXATO do bairro escolhido e em "enderecoEntrega" apenas rua e número
11. Se o cliente quiser falar com atendente/responsável/humano, responda APENAS: "Claro, vou chamar um atendente! 🙋" — nunca tente resolver a questão sozinho`;

    // Montar histórico para GPT
    const messages = [
      { role: 'system', content: systemPrompt },
      ...sessao.historico,
      { role: 'user', content: mensagemTexto }
    ];

    // Chamar GPT (histórico limitado a últimas 10 mensagens para controle de tokens)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...sessao.historico.slice(-10),
        { role: 'user', content: mensagemTexto }
      ],
      temperature: 0.3,
      max_tokens: 800
    });

    const respostaGPT = completion.choices[0].message.content;
    logger.info(`🤖 Resposta GPT para ${telefone}: ${respostaGPT.slice(0, 300)}`);

    // Parser: detecta PEDIDO_JSON:...:FIM_JSON ou CANCELAR_PEDIDO
    const jsonMatch = respostaGPT.match(/PEDIDO_JSON:([\s\S]*?):FIM_JSON/);
    const isCancelar = respostaGPT.includes('CANCELAR_PEDIDO');
    let respostaFinal = respostaGPT.replace(/PEDIDO_JSON:[\s\S]*?:FIM_JSON/g, '').replace('CANCELAR_PEDIDO', '').trim();
    let novoEstado = 'conversando';
    let pedidoCriado = null;

    if (isCancelar) {
      novoEstado = 'saudacao';
      respostaFinal = '🙆 Tudo bem! Pedido cancelado. Se quiser fazer um novo pedido é só chamar! 😊';
    } else if (jsonMatch) {
      try {
        const dadosPedido = JSON.parse(jsonMatch[1].trim());

        if (dadosPedido.acao === 'CRIAR_PEDIDO' && dadosPedido.itens?.length > 0) {
          // Buscar taxa de entrega — prioriza bairro do JSON do GPT, depois do endereço
          const enderecoInfo = dadosPedido.enderecoEntrega || '';
          const bairroDoJSON = dadosPedido.bairro || '';
          const isRetirada = enderecoInfo.trim().toUpperCase() === 'RETIRADA';
          let taxaInfo = { taxa: 0, bairro: null };
          if (!isRetirada) {
            // Busca pelo bairro exato do JSON primeiro, depois pelo endereço
            const buscaPor = bairroDoJSON || enderecoInfo;
            if (buscaPor) {
              taxaInfo = await buscarTaxaEntrega(estabelecimentoId, buscaPor);
              // Se não encontrado, usar bairro do GPT mesmo sem taxa confirmada
              if (taxaInfo.naoEncontrado) {
                taxaInfo = { taxa: 0, bairro: bairroDoJSON || null };
                logger.warn(`Bot: bairro "${buscaPor}" não encontrado nas taxas cadastradas`);
              }
            }
          }

          // Criar pedido no Firestore
          pedidoCriado = await criarPedidoBot({
            estabelecimentoId,
            itens: dadosPedido.itens,
            clienteNome: dadosPedido.clienteNome || nomeClienteSalvo || 'Cliente WhatsApp',
            clienteTelefone: telefone,
            observacoes: dadosPedido.observacoes,
            enderecoEntrega: enderecoInfo,
            taxaEntrega: taxaInfo.taxa ?? 0,
            bairroEntrega: taxaInfo.bairro || bairroDoJSON || ''
          });

          if (pedidoCriado) {
            novoEstado = 'pedido_realizado';
            const nomeParaConfirmacao = dadosPedido.clienteNome && dadosPedido.clienteNome !== 'Nome do cliente'
              ? dadosPedido.clienteNome
              : (nomeClienteSalvo || 'cliente');
            const resumoItens = pedidoCriado.itens.map(i => `• ${i.quantidade}x ${i.nome}`).join('\n');
            respostaFinal = `✅ *Pedido registrado com sucesso!* 🎉\n\n*Resumo do seu pedido:*\n${resumoItens}\n\n💰 *Total: R$ ${pedidoCriado.totalFinal.toFixed(2).replace('.', ',')}*\n\n⏱️ Em breve você receberá atualizações do status. Obrigado, ${nomeParaConfirmacao}! 🍔`;
          } else {
            respostaFinal = '❌ Ops! Não consegui processar seu pedido. Algum item pode estar indisponível. Pode repetir?';
          }
        }
      } catch (parseErr) {
        logger.warn('Erro ao parsear JSON do GPT:', parseErr);
        // Resposta normal sem JSON
        respostaFinal = respostaGPT.replace(/```json[\s\S]*?```/g, '').trim();
      }
    }

    // Enviar resposta ao cliente
    await enviarMensagemBot(wConfig, telefone, respostaFinal);

    // Atualizar histórico da sessão
    const novoHistorico = [
      ...sessao.historico,
      { role: 'user', content: mensagemTexto },
      { role: 'assistant', content: respostaGPT }
    ];
    await salvarSessao(estabelecimentoId, telefone, novoHistorico, novoEstado, pedidoCriado);

    // Registrar conversa no Firestore para auditoria
    await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('bot_conversas').add({
        telefone,
        mensagemCliente: mensagemTexto,
        respostaBot: respostaFinal,
        pedidoCriado: !!pedidoCriado,
        pedidoId: pedidoCriado?.pedidoId || null,
        timestamp: FieldValue.serverTimestamp()
      });

    return res.status(200).json({ ok: true, respondido: true, pedidoCriado: !!pedidoCriado });

  } catch (error) {
    logger.error('❌ Erro no webhookBotPedidos:', error);
    return res.status(500).json({ erro: error.message });
  }
});

// ==================================================================
// CONFIGURAR/ATIVAR O BOT DE PEDIDOS (Admin)
// ==================================================================
export const configurarBotPedidos = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, ativo, mensagemBoasVindas, horarioAtendimento } = request.data;
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    await db.collection('estabelecimentos').doc(estabelecimentoId).update({
      botPedidos: {
        ativo: ativo !== false,
        mensagemBoasVindas: mensagemBoasVindas || `Olá! 👋 Bem-vindo ao nosso cardápio digital via WhatsApp!\nDigite *CARDÁPIO* para ver nossos produtos ou já me diga o que deseja pedir! 😊`,
        horarioAtendimento: horarioAtendimento || null,
        configuradoEm: FieldValue.serverTimestamp()
      }
    });

    return { sucesso: true, mensagem: ativo ? 'Bot ativado com sucesso!' : 'Bot desativado.' };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// BUSCAR CONVERSAS DO BOT (Admin)
// ==================================================================
export const buscarConversasBot = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login necessário.');

  const { estabelecimentoId, limite = 50 } = request.data;
  if (!estabelecimentoId) throw new HttpsError('invalid-argument', 'estabelecimentoId obrigatório.');

  try {
    const snap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('bot_conversas')
      .orderBy('timestamp', 'desc')
      .limit(limite)
      .get();

    const conversas = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      timestamp: d.data().timestamp?.toDate?.()?.toISOString() || null
    }));

    // Sessões ativas (últimos 30 min)
    const sessoesSnap = await db.collection('estabelecimentos').doc(estabelecimentoId)
      .collection('bot_sessoes')
      .where('ultimaMensagem', '>=', new Date(Date.now() - 30 * 60 * 1000))
      .get();

    return {
      sucesso: true,
      conversas,
      sessoesAtivas: sessoesSnap.size
    };
  } catch (error) {
    throw new HttpsError('internal', error.message);
  }
});

// ==================================================================
// DISPARO DE PUSH NOTIFICATIONS DE MARKETING (FCM)
// ==================================================================
export const sendMarketingPush = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Acesso negado.');

  const { targetUid, titulo, mensagem, icone } = request.data;
  if (!targetUid || !titulo || !mensagem) {
    throw new HttpsError('invalid-argument', 'Faltam dados: targetUid, titulo, mensagem.');
  }

  try {
    const clientSnap = await db.collection('clientes').doc(targetUid).get();
    if (!clientSnap.exists) throw new HttpsError('not-found', 'Cliente não encontrado no DB.');
    
    const clientData = clientSnap.data();
    if (!clientData.fcmToken) {
      return { sucesso: false, message: 'Cliente não possui token de notificação push.' };
    }

    const payload = {
      notification: {
        title: titulo,
        body: mensagem,
      },
      token: clientData.fcmToken
    };
    
    if (icone) payload.notification.image = icone;

    const response = await getMessaging().send(payload);
    logger.info(`✅ Push enviado para ${targetUid} com sucesso. ID: ${response}`);
    return { sucesso: true, messageId: response };
  } catch (error) {
    logger.error("❌ Falha no envio do Push Notification:", error);
    throw new HttpsError('internal', error.message);
  }
});
