// src/pages/admin/MarketingConfig.jsx — Configuração de Marketing Automático
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { IoArrowBack, IoMegaphoneOutline, IoCheckmarkCircle, IoAlertCircle, IoPeopleOutline, IoCalendarOutline } from 'react-icons/io5';

function MarketingConfig() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];

  const [config, setConfig] = useState({ ativo: false, diasInativo: 7, mensagem: '', limiteDiario: 20, aniversario: false, aniversarioDesconto: 15, aniversarioMsg: '' });
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
      const data = snap.data()?.marketing || {};
      setConfig({
        ativo: data.ativo || false,
        diasInativo: data.diasInativo || 7,
        mensagem: data.mensagem || `Ei! Faz tempo que você não pede! 🍔 Que tal pedir hoje? Estamos com novidades!`,
        limiteDiario: data.limiteDiario || 20,
        aniversario: data.aniversario || false,
        aniversarioDesconto: data.aniversarioDesconto || 15,
        aniversarioMsg: data.aniversarioMsg || `🎂 Feliz aniversário! Toma um desconto especial pra comemorar!`
      });

      // Últimas campanhas
      try {
        const campSnap = await getDocs(query(collection(db, 'estabelecimentos', estabId, 'campanhas'), orderBy('enviadoEm', 'desc'), limit(20)));
        setCampanhas(campSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      
      setLoading(false);
    };
    load();
  }, [estabId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), { marketing: config });
      toast.success('✅ Marketing configurado!');
    } catch (e) {
      toast.error('Erro ao salvar');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
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
              <IoMegaphoneOutline className="text-purple-500" /> Marketing Automático
            </h1>
            <p className="text-xs text-gray-400 font-medium">Reengaje clientes inativos automaticamente</p>
          </div>
        </div>

        {/* Status */}
        <div className={`rounded-2xl p-5 mb-6 border ${config.ativo ? 'bg-purple-50 border-purple-200' : 'bg-gray-100 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {config.ativo ? (
              <><IoCheckmarkCircle className="text-purple-500 text-2xl" /><div><p className="font-bold text-purple-700 text-sm">Marketing Ativo</p><p className="text-[10px] text-purple-600">Roda automaticamente todo dia às 10h</p></div></>
            ) : (
              <><IoAlertCircle className="text-gray-400 text-2xl" /><div><p className="font-bold text-gray-600 text-sm">Desativado</p><p className="text-[10px] text-gray-400">Configure abaixo para ativar</p></div></>
            )}
          </div>
        </div>

        {/* Explicação */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="text-sm font-black text-gray-800 mb-3">🤖 Como funciona</h3>
          <div className="space-y-2 text-xs text-gray-600">
            <p>1. Todo dia às 10h, o sistema verifica quem <strong>não pediu</strong> há X dias</p>
            <p>2. Registra uma campanha para cada cliente inativo</p>
            <p>3. Se o WhatsApp Bot estiver ativo, envia a mensagem automaticamente</p>
            <p>4. Você acompanha o histórico de campanhas abaixo</p>
          </div>
        </div>

        {/* Config */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 mb-6">
          <h3 className="text-sm font-black text-gray-800">⚙️ Configuração</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Ativar Marketing</p>
              <p className="text-[10px] text-gray-400">Procurar clientes inativos diariamente</p>
            </div>
            <button onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))}
              className={`w-14 h-7 rounded-full transition-all relative ${config.ativo ? 'bg-purple-500' : 'bg-gray-300'}`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.ativo ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Dias sem pedir (mínimo para considerar inativo)</label>
            <select value={config.diasInativo} onChange={e => setConfig(p => ({...p, diasInativo: Number(e.target.value)}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
              <option value={3}>3 dias</option>
              <option value={5}>5 dias</option>
              <option value={7}>7 dias</option>
              <option value={14}>14 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Mensagem que o cliente recebe</label>
            <textarea value={config.mensagem} onChange={e => setConfig(p => ({...p, mensagem: e.target.value}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none h-24 outline-none focus:ring-2 focus:ring-purple-200"
              maxLength={500} />
            <p className="text-[10px] text-gray-400 text-right">{config.mensagem.length}/500</p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Limite de mensagens/dia</label>
            <input type="number" value={config.limiteDiario} onChange={e => setConfig(p => ({...p, limiteDiario: Number(e.target.value)}))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" min={1} max={100} />
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 bg-purple-500 hover:bg-purple-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-200">
            <IoMegaphoneOutline size={18}/> {saving ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>

        {/* Cupom de Aniversário */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 mb-6">
          <h3 className="text-sm font-black text-gray-800">🎂 Cupom de Aniversário</h3>
          <p className="text-xs text-gray-500">Envie desconto automático para clientes no dia do aniversário</p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Ativar Cupom de Aniversário</p>
              <p className="text-[10px] text-gray-400">Desconto automático no dia do aniversário do cliente</p>
            </div>
            <button onClick={() => setConfig(p => ({...p, aniversario: !p.aniversario}))}
              className={`w-14 h-7 rounded-full transition-all relative ${config.aniversario ? 'bg-pink-500' : 'bg-gray-300'}`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.aniversario ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          {config.aniversario && (
            <>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Desconto (%)</label>
                <select value={config.aniversarioDesconto} onChange={e => setConfig(p => ({...p, aniversarioDesconto: Number(e.target.value)}))}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                  <option value={5}>5%</option>
                  <option value={10}>10%</option>
                  <option value={15}>15%</option>
                  <option value={20}>20%</option>
                  <option value={25}>25%</option>
                  <option value={30}>30%</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Mensagem de aniversário</label>
                <textarea value={config.aniversarioMsg} onChange={e => setConfig(p => ({...p, aniversarioMsg: e.target.value}))}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none h-20 outline-none focus:ring-2 focus:ring-pink-200"
                  maxLength={300} />
              </div>
            </>
          )}

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 shadow-lg shadow-pink-200">
            {saving ? 'Salvando...' : '🎂 Salvar Aniversário'}
          </button>
        </div>

        {/* Histórico */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
            <IoCalendarOutline className="text-purple-500" /> Últimas campanhas
          </h3>
          {campanhas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Nenhuma campanha registrada ainda</p>
          ) : (
            <div className="space-y-2">
              {campanhas.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <IoPeopleOutline className="text-purple-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-800 truncate">{c.clienteNome}</p>
                    <p className="text-[10px] text-gray-400">{c.diasInativo} dias sem pedir</p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded-lg">{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default withEstablishmentAuth(MarketingConfig);
