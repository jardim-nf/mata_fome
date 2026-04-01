// src/pages/admin/BotPedidosConfig.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  IoToggle, IoToggleOutline, IoChatbubbleEllipses, IoCheckmarkCircle,
  IoRefreshOutline, IoCopyOutline, IoArrowBack, IoPeopleOutline, IoStorefront
} from 'react-icons/io5';
import { Link } from 'react-router-dom';

function BotPedidosConfig() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];

  const [botAtivo, setBotAtivo] = useState(false);
  const [mensagemBoasVindas, setMensagemBoasVindas] = useState('Olá! 👋 Bem-vindo! Digite *CARDÁPIO* para ver nossos produtos ou me diga o que deseja pedir! 😊');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversas, setConversas] = useState([]);
  const [sessoesAtivas, setSessoesAtivas] = useState(0);

  const webhookUrl = `https://us-central1-matafome-98455.cloudfunctions.net/webhookBotPedidos?estabId=${estabId || 'SEU_ID'}`;

  // Carregar config atual do Firestore diretamente
  useEffect(() => {
    if (!estabId) return;
    getDoc(doc(db, 'estabelecimentos', estabId)).then(snap => {
      if (snap.exists()) {
        const bot = snap.data().botPedidos || {};
        setBotAtivo(bot.ativo || false);
        if (bot.mensagemBoasVindas) setMensagemBoasVindas(bot.mensagemBoasVindas);
      }
      setLoading(false);
    });
  }, [estabId]);

  // Conversas em tempo real direto do Firestore
  useEffect(() => {
    if (!estabId) return;
    const q = query(
      collection(db, 'estabelecimentos', estabId, 'bot_conversas'),
      orderBy('timestamp', 'desc'),
      limit(30)
    );
    const unsub = onSnapshot(q, snap => {
      setConversas(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.() || null
      })));
    });
    return () => unsub();
  }, [estabId]);

  // Sessões ativas — contar bot_sessoes com ultimaMensagem recente
  useEffect(() => {
    if (!estabId) return;
    const trintaMinAtras = new Date(Date.now() - 30 * 60 * 1000);
    const q = query(
      collection(db, 'estabelecimentos', estabId, 'bot_sessoes'),
      orderBy('ultimaMensagem', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const ativas = snap.docs.filter(d => {
        const ultima = d.data().ultimaMensagem?.toDate?.();
        return ultima && ultima >= trintaMinAtras;
      });
      setSessoesAtivas(ativas.length);
    });
    return () => unsub();
  }, [estabId]);

  // Salvar config direto no Firestore
  const handleSalvar = async () => {
    if (!estabId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), {
        'botPedidos.ativo': botAtivo,
        'botPedidos.mensagemBoasVindas': mensagemBoasVindas,
      });
      toast.success(botAtivo ? '🤖 Bot ativado com sucesso!' : '⏸️ Bot desativado.');
    } catch (err) {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSaving(false);
    }
  };

  const copiarWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Link copiado!');
  };

  const totalPedidosBot = conversas.filter(c => c.pedidoCriado).length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/admin/whatsapp" className="p-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50">
            <IoArrowBack className="text-slate-600" size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-white text-xl">🤖</div>
            <div>
              <h1 className="text-xl font-black text-slate-800">Bot de Pedidos via WhatsApp</h1>
              <p className="text-xs text-slate-500">Clientes fazem pedidos conversando com IA</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Sessões Ativas', value: sessoesAtivas, cor: 'blue' },
            { label: 'Conversas (recentes)', value: conversas.length, cor: 'slate' },
            { label: 'Pedidos via Bot', value: totalPedidosBot, cor: 'green' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
              <div className={`text-2xl font-black ${s.cor === 'green' ? 'text-green-600' : s.cor === 'blue' ? 'text-blue-600' : 'text-slate-700'}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Configuração Principal */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="font-black text-slate-800">Configurações do Bot</h2>
              <p className="text-xs text-slate-500">Ative e personalize o atendente virtual</p>
            </div>
            <button
              onClick={() => setBotAtivo(!botAtivo)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                botAtivo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {botAtivo ? <IoToggle size={20} /> : <IoToggleOutline size={20} />}
              {botAtivo ? 'Ativo' : 'Inativo'}
            </button>
          </div>

          {/* Status visual */}
          <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${botAtivo ? 'bg-green-50 border border-green-100' : 'bg-slate-50 border border-slate-200'}`}>
            <div className={`w-2 h-2 rounded-full ${botAtivo ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className={`text-sm font-bold ${botAtivo ? 'text-green-700' : 'text-slate-500'}`}>
              {botAtivo ? '🤖 Bot online — respondendo automaticamente' : '⏸️ Bot offline — não está respondendo'}
            </span>
          </div>

          {/* Mensagem de Boas-Vindas */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-1">Mensagem de Boas-Vindas</label>
            <p className="text-xs text-slate-400 mb-2">Enviada quando um novo cliente inicia conversa</p>
            <textarea
              value={mensagemBoasVindas}
              onChange={e => setMensagemBoasVindas(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-green-500 outline-none resize-none"
            />
          </div>

          <button
            onClick={handleSalvar}
            disabled={saving}
            className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all"
          >
            {saving ? 'Salvando...' : '💾 Salvar Configurações'}
          </button>
        </div>

        {/* Webhook URL */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-black text-slate-800 mb-1">Configurar no UAZAPI</h2>
          <p className="text-xs text-slate-500 mb-4">Cole este link como webhook de mensagens recebidas no UAZAPI</p>

          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 font-mono text-slate-700 break-all">
              {webhookUrl}
            </code>
            <button onClick={copiarWebhook} className="shrink-0 p-3 bg-slate-700 text-white rounded-xl hover:bg-slate-800 transition-colors" title="Copiar">
              <IoCopyOutline size={18} />
            </button>
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Passo a passo no UAZAPI:</p>
            <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
              <li>Acesse o painel do UAZAPI → sua instância</li>
              <li>Vá em <strong>Webhooks → Messages Upsert</strong></li>
              <li>Cole a URL acima e salve</li>
              <li>Ative o bot aqui acima e salve</li>
              <li>Teste enviando "Oi" para o número da loja</li>
            </ol>
          </div>
        </div>

        {/* Como funciona */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-black text-slate-800 mb-3">Como o bot funciona</h2>
          <div className="space-y-3">
            {[
              { emoji: '1️⃣', titulo: 'Cliente manda mensagem', desc: 'Ex: "Oi, quero fazer um pedido"' },
              { emoji: '2️⃣', titulo: 'GPT-4 responde com o cardápio', desc: 'Mostra os produtos e preços automaticamente' },
              { emoji: '3️⃣', titulo: 'Cliente escolhe os itens', desc: 'Ex: "Quero 2 X-Burguer e 1 batata"' },
              { emoji: '4️⃣', titulo: 'Bot coleta nome e endereço', desc: 'Pergunta para onde entregar ou se é retirada' },
              { emoji: '5️⃣', titulo: 'Cliente confirma', desc: 'Ex: "Pode confirmar"' },
              { emoji: '✅', titulo: 'Pedido entra no sistema!', desc: 'Aparece no Painel igual delivery normal' },
            ].map(step => (
              <div key={step.titulo} className="flex items-start gap-3">
                <span className="text-xl shrink-0">{step.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{step.titulo}</p>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Log de conversas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <h2 className="font-black text-slate-800">Conversas Recentes</h2>
            <span className="text-xs text-slate-400">Atualiza automaticamente</span>
          </div>

          {conversas.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <IoChatbubbleEllipses size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma conversa ainda. Configure o webhook e teste!</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {conversas.map(c => (
                <div key={c.id} className="p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-600">📱 {c.telefone}</span>
                        {c.pedidoCriado ? (
                          <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">
                            <IoCheckmarkCircle size={10} /> Pedido criado
                          </span>
                        ) : (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Em conversa</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        <span className="font-medium text-slate-700">Cliente:</span> {c.mensagemCliente}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        <span className="font-medium">Bot:</span> {String(c.respostaBot || '').slice(0, 80)}...
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">
                      {c.timestamp ? format(c.timestamp, 'dd/MM HH:mm', { locale: ptBR }) : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default withEstablishmentAuth(BotPedidosConfig);
