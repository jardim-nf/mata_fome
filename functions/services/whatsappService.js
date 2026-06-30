import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../firebaseCore.js';

const _produtosCache = new Map();

export async function buscarProdutosRobo(estabId) {
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
export async function processarFluxoRobo(chatKey, estabId, estab, produtos, messageText, from, origem) {
    const agora = Date.now();

    // ── Estado persistido no Firestore (suporta múltiplas instâncias Cloud Run) ──
    // conversas em RAM causavam bug: com maxInstances:10, cada mensagem podia
    // cair em instâncias diferentes e o bot perdia o contexto do pedido.
    const chatRef = db.doc(`conversasBot/${chatKey}`);
    const chatSnap = await chatRef.get();
    let chat;
    let menuEnviadoEm = null;

    if (chatSnap.exists()) {
        chat = chatSnap.data();
        menuEnviadoEm = chat.menuEnviadoEm || null;
        // FIX: reset aumentado para 20 min (antes 3 min causava perda de pedido em celulares lentos)
        if (chat.ultimaMensagem && (agora - chat.ultimaMensagem) > 20 * 60 * 1000) {
            chat = { etapa: 'inicio', itens: [], nome: '', enderecoEntrega: '', bairro: '', taxaEntrega: 0, menuEnviadoEm };
        }
    } else {
        chat = { etapa: 'inicio', itens: [], nome: '', enderecoEntrega: '', bairro: '', taxaEntrega: 0, menuEnviadoEm: null };
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
      const umDiaEmMs = 24 * 60 * 60 * 1000;
      const jaEnviouMenuRecentemente = chat.menuEnviadoEm && (agora - chat.menuEnviadoEm < umDiaEmMs);
      const forcarMenu = ['menu', 'cardápio', 'cardapio'].includes(msgLower);

      if (jaEnviouMenuRecentemente && !forcarMenu) {
        resposta = '';
        return resposta;
      }

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
      chat.menuEnviadoEm = agora;

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
        await chatRef.set({
            etapa: 'inicio',
            menuEnviadoEm: chat.menuEnviadoEm || agora,
            ultimaMensagem: agora
        });
    } else {
        await chatRef.set(chat);
    }

    return resposta;
}


// Helper: envia texto via UAZAPI (mesmo padrão da notificarClienteWhatsApp)
export async function enviarWhatsAppUAZAPI(wConfig, telefone, texto) {
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


