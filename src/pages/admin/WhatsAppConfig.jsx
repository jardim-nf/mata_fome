/* eslint-disable react-refresh/only-export-components */
// src/pages/admin/WhatsAppConfig.jsx — Configuração do Bot WhatsApp (UAZAPI)
import React, { useState, useEffect } from 'react';
import BackButton from '../../components/BackButton';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { IoArrowBack, IoLogoWhatsapp, IoCheckmarkCircle, IoAlertCircle, IoCopyOutline, IoRocketOutline, IoChatbubbleEllipsesOutline } from 'react-icons/io5';

function WhatsAppConfig() {
  const { userData , estabelecimentoIdPrincipal } = useAuth();
  const estabId = estabelecimentoIdPrincipal;

  // Configuração inicial adaptada para Uazapi
  const [config, setConfig] = useState({ 
    instanceName: '', 
    apiKey: '6a160a1d-b02d-4439-92cb-b03c4b187737', 
    serverUrl: 'https://meunumero.uazapi.com', 
    ativo: false,
    telefoneNotificacao: '',
    notificarVendas: false,
    notificarOS: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const webhookUrl = estabId === 'Ee89E1HlsA6QR9C8uuBC'
    ? 'https://pontocertoinfo.netlify.app/.netlify/functions/webhook'
    : `https://us-central1-matafome-98455.cloudfunctions.net/webhookBotPedidos?estabId=${estabId || 'SEU_ID'}`;

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
      const data = snap.data()?.whatsapp || {};
      setConfig({ 
        instanceName: data.instanceName || '', 
        apiKey: data.apiKey || '6a160a1d-b02d-4439-92cb-b03c4b187737', 
        serverUrl: data.serverUrl || 'https://meunumero.uazapi.com',
        ativo: data.ativo || false,
        telefoneNotificacao: data.telefoneNotificacao || '',
        notificarVendas: data.notificarVendas || false,
        notificarOS: data.notificarOS || false
      });
      setLoading(false);
    };
    load();
  }, [estabId]);

  const handleSave = async () => {
    if (!config.instanceName || !config.apiKey || !config.serverUrl) return toast.warn('Preencha todos os campos!');
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), {
        whatsapp: { 
          instanceName: config.instanceName, 
          apiKey: config.apiKey, 
          serverUrl: config.serverUrl,
          ativo: config.ativo,
          telefoneNotificacao: config.telefoneNotificacao || '',
          notificarVendas: !!config.notificarVendas,
          notificarOS: !!config.notificarOS
        }
      });
      toast.success('✅ WhatsApp configurado para Uazapi!');
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
        <div className="flex items-center gap-3 mb-6">
          <BackButton to="/dashboard" />
          <div>
            <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <IoLogoWhatsapp className="text-green-500" /> WhatsApp (Uazapi)
            </h1>
            <p className="text-xs text-gray-400 font-medium">Configure a conexão via QR Code</p>
          </div>
        </div>

        <div className={`rounded-2xl p-5 mb-6 border ${config.ativo && config.instanceName ? 'bg-green-50 border-green-200' : 'bg-gray-100 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {config.ativo && config.instanceName ? (
              <><IoCheckmarkCircle className="text-green-500 text-2xl" /><div><p className="font-bold text-green-700 text-sm">Bot Ativo</p></div></>
            ) : (
              <><IoAlertCircle className="text-gray-400 text-2xl" /><div><p className="font-bold text-gray-600 text-sm">Bot Desativado</p></div></>
            )}
          </div>
        </div>

        {/* Atalho: Bot de Pedidos IA */}
        {estabId !== 'Ee89E1HlsA6QR9C8uuBC' && (
          <Link
            to="/admin/bot-pedidos"
            className="flex items-center gap-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-4 mb-6 text-white shadow-md hover:shadow-lg hover:scale-[1.01] transition-all"
          >
            <div className="bg-white/20 rounded-xl p-3">
              <IoRocketOutline size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm">🤖 Bot de Pedidos (IA)</p>
              <p className="text-[11px] text-green-100 font-medium">Configure o bot inteligente que recebe pedidos pelo WhatsApp</p>
            </div>
            <IoChatbubbleEllipsesOutline size={20} className="text-white/70" />
          </Link>
        )}

        <div className="bg-gray-800 rounded-2xl p-4 mb-6">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">🔗 URL do Webhook (Cole no painel da Uazapi)</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-green-400 bg-gray-900 p-3 rounded-xl break-all font-mono">{webhookUrl}</code>
            <button onClick={() => copyToClipboard(webhookUrl)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-white">
              <IoCopyOutline size={16} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-black text-gray-800">⚙️ Credenciais Uazapi</h3>
          
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Nome da Instância</label>
            <input value={config.instanceName} onChange={e => setConfig(p => ({...p, instanceName: e.target.value}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" placeholder="Ex: restaurante_01" />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">API Key (Token)</label>
            <input value={config.apiKey} onChange={e => setConfig(p => ({...p, apiKey: e.target.value}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none font-mono" />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">URL do Servidor</label>
            <input value={config.serverUrl} onChange={e => setConfig(p => ({...p, serverUrl: e.target.value}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none font-mono" />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-sm font-bold text-gray-800">Ativar Bot</p>
            <button type="button" onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))}
              className={`w-14 h-7 rounded-full relative ${config.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.ativo ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-2 space-y-4">
            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">🔔 Notificações Administrativas</h4>
            
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Telefone para Notificações (Com DDD)</label>
              <input 
                type="text" 
                value={config.telefoneNotificacao || ''} 
                onChange={e => setConfig(p => ({...p, telefoneNotificacao: e.target.value.replace(/\D/g, '')}))}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none placeholder-gray-400" 
                placeholder="Ex: 22998102575" 
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-bold text-gray-700">Notificar Novas Vendas (PDV)</p>
                <p className="text-[10px] text-gray-400 font-medium">Receba no WhatsApp os dados de cada venda finalizada</p>
              </div>
              <button 
                type="button"
                onClick={() => setConfig(p => ({...p, notificarVendas: !p.notificarVendas}))}
                className={`w-12 h-6 rounded-full relative shrink-0 transition-colors ${config.notificarVendas ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.notificarVendas ? 'left-[26px]' : 'left-0.5'}`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-xs font-bold text-gray-700">Notificar Atualizações de OS</p>
                <p className="text-[10px] text-gray-400 font-medium">Receba quando uma OS mudar de status ou for paga</p>
              </div>
              <button 
                type="button"
                onClick={() => setConfig(p => ({...p, notificarOS: !p.notificarOS}))}
                className={`w-12 h-6 rounded-full relative shrink-0 transition-colors ${config.notificarOS ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.notificarOS ? 'left-[26px]' : 'left-0.5'}`}></div>
              </button>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2">
            <IoLogoWhatsapp size={18}/> {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default withEstablishmentAuth(WhatsAppConfig);