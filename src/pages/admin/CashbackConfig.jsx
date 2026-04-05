// src/pages/admin/CashbackConfig.jsx — Configuração de Cashback Digital
import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { IoArrowBack, IoWalletOutline, IoCheckmarkCircle, IoAlertCircle } from 'react-icons/io5';

function CashbackConfig() {
  const { userData } = useAuth();
  const estabId = userData?.estabelecimentosGerenciados?.[0];

  const [config, setConfig] = useState({ ativo: false, porcentagem: 5 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!estabId) return;
    const load = async () => {
      const snap = await getDoc(doc(db, 'estabelecimentos', estabId));
      const data = snap.data()?.cashback || {};
      setConfig({
        ativo: data.ativo || false,
        porcentagem: data.porcentagem || 5
      });
      setLoading(false);
    };
    load();
  }, [estabId]);

  const handleSave = async () => {
    if (config.porcentagem < 1 || config.porcentagem > 100) {
      toast.error('A porcentagem deve ser entre 1% e 100%');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabId), { cashback: config });
      toast.success('✅ Cashback configurado com sucesso!');
    } catch (e) {
      toast.error('Erro ao salvar cashback');
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent" />
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
              <IoWalletOutline className="text-emerald-500" /> Cashback Virtual
            </h1>
            <p className="text-xs text-gray-400 font-medium">Fidelize clientes devolvendo parte do valor</p>
          </div>
        </div>

        {/* Status */}
        <div className={`rounded-2xl p-5 mb-6 border ${config.ativo ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-100 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            {config.ativo ? (
              <><IoCheckmarkCircle className="text-emerald-500 text-2xl" /><div><p className="font-bold text-emerald-700 text-sm">Cashback Ativo</p><p className="text-[10px] text-emerald-600">Clientes ganharão {config.porcentagem}% em toda compra finalizada!</p></div></>
            ) : (
              <><IoAlertCircle className="text-gray-400 text-2xl" /><div><p className="font-bold text-gray-600 text-sm">Desativado</p><p className="text-[10px] text-gray-400">Configure abaixo para ativar a carteira virtual</p></div></>
            )}
          </div>
        </div>

        {/* Explicação */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <h3 className="text-sm font-black text-gray-800 mb-3">💰 Entenda o Funcionamento</h3>
          <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
            <p>1. Quando o Pedido for arrastado para <strong>Finalizado</strong> no painel, o sistema guarda {config.porcentagem}% do valor total no "Bancão" (Carteira Virtual) atrelada ao número de Telefone do cliente.</p>
            <p>2. Imediatamente o Robô avisa o cliente no WhatsApp que ele acabou de ganhar dinheiro de volta, gerando um efeito uau (gatilho de reciprocidade).</p>
            <p>3. No <strong>próximo pedido</strong>, o Robô avisa o cliente sobre o Saldo e pergunta se deseja abater o preço automaticamente.</p>
            <p className="text-emerald-600 font-bold mt-2">Dica: A média nacional para Delivery é de 3% a 8%.</p>
          </div>
        </div>

        {/* Config */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-black text-gray-800">⚙️ Configuração Principal</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">Ativar Programa de Cashback</p>
              <p className="text-[10px] text-gray-400">Liberar a criação de carteiras automaticamente</p>
            </div>
            <button onClick={() => setConfig(p => ({...p, ativo: !p.ativo}))}
              className={`w-14 h-7 rounded-full transition-all relative ${config.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <div className={`w-6 h-6 bg-white rounded-full shadow absolute top-0.5 transition-all ${config.ativo ? 'left-[30px]' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Porcentagem de Retorno (%)</label>
            <div className="relative">
              <input type="number" value={config.porcentagem} onChange={e => setConfig(p => ({...p, porcentagem: Number(e.target.value)}))}
                className="w-full p-3 pl-4 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-200 font-bold" min={1} max={100} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 mt-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200">
            <IoWalletOutline size={18}/> {saving ? 'Salvando...' : 'Salvar Cashback'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default withEstablishmentAuth(CashbackConfig);
