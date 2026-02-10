// src/pages/AdminSettings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import withAuth from '../hocs/withAuth';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoSave, IoLockClosed, IoTime, IoStorefront, IoGameController } from 'react-icons/io5'; // Importei IoGameController

const AdminSettings = () => {
  const { primeiroEstabelecimento } = useAuth(); // userData não estava sendo usado
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados do Formulário
  const [senhaMaster, setSenhaMaster] = useState('');
  const [tempoMinimo, setTempoMinimo] = useState('');
  const [tempoMaximo, setTempoMaximo] = useState('');
  const [lojaAberta, setLojaAberta] = useState(false);
  const [nomeLoja, setNomeLoja] = useState('');
  
  // 🔥 NOVO ESTADO: Valor da Raspadinha
  const [valorMinimoRaspadinha, setValorMinimoRaspadinha] = useState('100');

  // Carregar dados ao iniciar
  useEffect(() => {
    const fetchSettings = async () => {
      if (!primeiroEstabelecimento) return;

      try {
        const docRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setSenhaMaster(data.senhaMaster || '');
          setTempoMinimo(data.tempoMinimo || '40');
          setTempoMaximo(data.tempoMaximo || '60');
          setLojaAberta(data.aberto || false);
          setNomeLoja(data.nome || '');
          
          // 🔥 Carrega o valor do banco (padrão 100 se não existir)
          setValorMinimoRaspadinha(data.valorMinimoRaspadinha || '100');
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
        toast.error("Erro ao carregar dados da loja.");
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [primeiroEstabelecimento]);

  // Salvar alterações
  const handleSave = async (e) => {
    e.preventDefault();
    if (!primeiroEstabelecimento) return;

    setSaving(true);
    try {
      const docRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
      
      await updateDoc(docRef, {
        senhaMaster: senhaMaster,
        tempoMinimo: tempoMinimo,
        tempoMaximo: tempoMaximo,
        aberto: lojaAberta,
        // 🔥 Salva o novo valor
        valorMinimoRaspadinha: valorMinimoRaspadinha,
        updatedAt: new Date()
      });

      toast.success("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Configurações Gerais</h1>
          <p className="text-gray-500">Gerencie segurança, horários e status da loja: <span className="font-semibold text-green-600">{nomeLoja}</span></p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* BLOCO 1: Segurança */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <IoLockClosed size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Segurança</h2>
                <p className="text-sm text-gray-500">Senha usada para cancelar pedidos e ações críticas</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Senha Master</label>
                <input type="text" value={senhaMaster} onChange={(e) => setSenhaMaster(e.target.value)} placeholder="Ex: 1234" className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all bg-gray-50 focus:bg-white" />
              </div>
            </div>
          </div>

          {/* BLOCO 2: Operação */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <IoTime size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Operação</h2>
                <p className="text-sm text-gray-500">Defina os tempos médios e status da loja</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">Status da Loja</label>
                <button type="button" onClick={() => setLojaAberta(!lojaAberta)} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all border-2 flex items-center justify-center gap-2 ${lojaAberta ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
                  <IoStorefront />
                  {lojaAberta ? 'LOJA ABERTA' : 'LOJA FECHADA'}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tempo Mínimo (min)</label>
                <input type="number" value={tempoMinimo} onChange={(e) => setTempoMinimo(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tempo Máximo (min)</label>
                <input type="number" value={tempoMaximo} onChange={(e) => setTempoMaximo(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 transition-all" />
              </div>
            </div>
          </div>

          {/* 🔥 BLOCO 3: Gamificação (RASPADINHA) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4 border-b pb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <IoGameController size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Gamificação (Raspadinha)</h2>
                <p className="text-sm text-gray-500">Configurações de prêmios para o cliente</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Valor Mínimo do Pedido (R$)</label>
                <input
                  type="number"
                  value={valorMinimoRaspadinha}
                  onChange={(e) => setValorMinimoRaspadinha(e.target.value)}
                  placeholder="Ex: 100"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
                <p className="mt-2 text-xs text-gray-500">O cliente ganha uma raspadinha se o pedido ultrapassar esse valor.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={saving} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
              {saving ? 'Salvando...' : <><IoSave size={20} /> Salvar Alterações</>}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default withAuth(AdminSettings, { requireAdmin: true });