// src/pages/admin/WhatsAppConfig.jsx — Configuração do Bot WhatsApp
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { IoArrowBack, IoLogoWhatsapp, IoCheckmarkCircle, IoAlertCircle, IoLinkOutline, IoCopyOutline } from 'react-icons/io5';

function WhatsAppConfig() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];

  const [config, setConfig] = useState({ phoneNumberId: '', accessToken: '', ativo: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // URL do webhook (baseada no projeto Firebase)
  const webhookUrl = `https://us-central1-matafome-98455.cloudfunctions.net/webhookWhatsApp`;

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
      const data = snap.data()?.whatsapp || {};
      setConfig({ phoneNumberId: data.phoneNumberId || '', accessToken: data.accessToken || '', ativo: data.ativo || false });
      setLoading(false);
    };
    load();
  }, [estabId]);

  const handleSave = async () => {
    if (!config.phoneNumberId || !config.accessToken) return toast.warn('Preencha todos os campos!');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), {
        whatsapp: { phoneNumberId: config.phoneNumberId, accessToken: config.accessToken, ativo: config.ativo }
      });
      toast.success('✅ WhatsApp configurado!');
    } catch (e) {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 font-sans pb-20">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 shadow-sm">
            <IoArrowBack size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <IoLogoWhatsapp className="text-green-500" /> Bot WhatsApp
            </h1>
            <p className="text-xs text-gray-400 font-medium">Configure o pedido automático via WhatsApp</p>
          </div>
        </div>

        {/* Status */}
        <div className={`rounded-2xl p-5 mb-6 border ${config.ativo && config.phoneNumberId ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {config.ativo && config.phoneNumberId ? (
              <><IoCheckmarkCircle className="text-green-500 text-2xl" /><div><p className="font-bold text-green-700 text-sm">Bot Ativo</p><p className="text-[10px] text-green-600">Recebendo pedidos via WhatsApp</p></div></>
            ) : (
              <><IoAlertCircle className="text-gray-400 text-2xl" /><div><p className="font-bold text-gray-600 text-sm">Bot Desativado</p><p className="text-[10px] text-gray-400">Configure abaixo para ativar</p></div></>
            )}
          </div>
        </div>

        {/* Tutorial */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="text-sm font-black text-gray-800 mb-4">📖 Como configurar</h3>
          <div className="space-y-3 text-xs text-gray-600">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">1</span>
              <p>Acesse <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Meta Business Suite</a> e crie um App do tipo "Business"</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">2</span>
              <p>No app, vá em <strong>WhatsApp &gt; API Setup</strong> e copie o <strong>Phone Number ID</strong> e o <strong>Access Token</strong></p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">3</span>
              <p>Na aba <strong>Webhooks</strong>, cole a URL abaixo e use <strong>"matafome"</strong> como Verify Token</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">4</span>
              <p>Inscreva o webhook no evento <strong>"messages"</strong></p>
            </div>
          </div>
        </div>

        {/* Webhook URL */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-6">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">🔗 URL do Webhook</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-green-400 bg-gray-900 p-3 rounded-xl break-all font-mono">{webhookUrl}</code>
            <button onClick={() => copyToClipboard(webhookUrl)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors shrink-0">
              <IoCopyOutline size={16} />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-black text-gray-800">⚙️ Credenciais</h3>
          
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Phone Number ID</label>
            <input value={config.phoneNumberId} onChange={e => setConfig(p => ({...p, phoneNumberId: e.target.value}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-200 transition-all"
              placeholder="Ex: 123456789012345"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Access Token (Permanente)</label>
            <input value={config.accessToken} onChange={e => setConfig(p => ({...p, accessToken: e.target.value}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-200 transition-all font-mono"
              placeholder="EAAxxxxxxx..."
              type="password"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-bold text-gray-800">Ativar Bot</p>
              <p className="text-[10px] text-gray-400">Receber e responder mensagens automaticamente</p>
            </div>
            <button onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))}
              className={`w-14 h-7 rounded-full transition-all relative ${config.ativo ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.ativo ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-200"
          >
            <IoLogoWhatsapp size={18}/> {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>

        {/* How the bot works */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-6">
          <h3 className="text-sm font-black text-gray-800 mb-3">🤖 Como o Bot funciona</h3>
          <div className="space-y-2 text-xs text-gray-600">
            <p>1. Cliente manda <strong>"oi"</strong> ou <strong>"menu"</strong> → Bot envia o cardápio</p>
            <p>2. Cliente digita <strong>"2 X-Bacon"</strong> → Bot adiciona ao pedido</p>
            <p>3. Cliente digita <strong>"finalizar"</strong> → Bot mostra resumo e pede o nome</p>
            <p>4. Cliente digita o nome → Pedido criado no <strong>Painel de Pedidos</strong> ✅</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withEstablishmentAuth(WhatsAppConfig);
