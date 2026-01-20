import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoSave, IoLockClosed, IoEye, IoEyeOff, IoTicket, IoToggle } from 'react-icons/io5';

const AdminSettings = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  
  // Estados da Senha Master
  const [senhaMaster, setSenhaMaster] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 🔥 Estados da Raspadinha
  const [raspadinhaAtiva, setRaspadinhaAtiva] = useState(false);
  const [raspadinhaChance, setRaspadinhaChance] = useState(20); // Padrão 20% de chance
  const [raspadinhaValor, setRaspadinhaValor] = useState(10);   // Padrão 10% de desconto

  const [loading, setLoading] = useState(false);

  // Carregar dados
  useEffect(() => {
    const fetchSettings = async () => {
      if (!estabelecimentoIdPrincipal) return;
      try {
        const docRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          
          // Carrega Senha
          if (data.senhaMaster) setSenhaMaster(data.senhaMaster);

          // 🔥 Carrega Raspadinha
          if (data.raspadinhaConfig) {
            setRaspadinhaAtiva(data.raspadinhaConfig.ativa ?? false);
            setRaspadinhaChance(data.raspadinhaConfig.chance ?? 20);
            setRaspadinhaValor(data.raspadinhaConfig.valor ?? 10);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };

    fetchSettings();
  }, [estabelecimentoIdPrincipal]);

  // Salvar dados
  const handleSave = async () => {
    if (!estabelecimentoIdPrincipal) return;
    if (!senhaMaster.trim()) {
      toast.warning("A senha não pode ser vazia.");
      return;
    }

    setLoading(true);
    try {
      const docRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal);
      
      await updateDoc(docRef, {
        senhaMaster: senhaMaster,
        // 🔥 Salva Config da Raspadinha
        raspadinhaConfig: {
            ativa: raspadinhaAtiva,
            chance: Number(raspadinhaChance),
            valor: Number(raspadinhaValor)
        }
      });
      
      toast.success("Configurações atualizadas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao atualizar configurações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações Gerais</h1>

      {/* --- SEÇÃO 1: SENHA MASTER --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-4 border-b pb-4">
            <div className="bg-red-100 p-2 rounded-lg">
                <IoLockClosed className="text-red-600 text-xl" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-800">Senha Master</h2>
                <p className="text-sm text-gray-500">Para autorizar exclusão de pedidos na cozinha.</p>
            </div>
        </div>

        <div className="max-w-md">
            <label className="block text-sm font-bold text-gray-700 mb-2">Definir Senha</label>
            <div className="relative">
                <input 
                    type={showPassword ? "text" : "password"}
                    value={senhaMaster}
                    onChange={(e) => setSenhaMaster(e.target.value)}
                    placeholder="Ex: 1234"
                    className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-lg"
                />
                <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                    {showPassword ? <IoEyeOff size={20}/> : <IoEye size={20}/>}
                </button>
            </div>
        </div>
      </div>

      {/* --- SEÇÃO 2: RASPADINHA (NOVO) --- */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-3 mb-4 border-b pb-4">
            <div className="bg-purple-100 p-2 rounded-lg">
                <IoTicket className="text-purple-600 text-xl" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-800">Raspadinha Premiada</h2>
                <p className="text-sm text-gray-500">Configure o prêmio que aparece para o cliente no Cardápio.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            
            {/* Toggle Ativar */}
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 col-span-1 md:col-span-2">
                <div>
                    <span className="block font-bold text-gray-800">Ativar Raspadinha</span>
                    <span className="text-xs text-gray-500">Exibir o jogo no cardápio digital</span>
                </div>
                <button 
                    onClick={() => setRaspadinhaAtiva(!raspadinhaAtiva)}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${raspadinhaAtiva ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 shadow-sm ${raspadinhaAtiva ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
            </div>

            {/* Inputs de Valor */}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Chance de Ganhar (%)</label>
                <div className="relative">
                    <input 
                        type="number"
                        min="0"
                        max="100"
                        value={raspadinhaChance}
                        onChange={(e) => setRaspadinhaChance(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Ex: 30% dos clientes ganharão.</p>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Valor do Desconto (%)</label>
                <div className="relative">
                    <input 
                        type="number"
                        min="0"
                        max="100"
                        value={raspadinhaValor}
                        onChange={(e) => setRaspadinhaValor(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Desconto aplicado no carrinho.</p>
            </div>

        </div>
      </div>

      {/* Botão Salvar Geral */}
      <button 
        onClick={handleSave}
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full max-w-md mx-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-70"
      >
        {loading ? "Salvando..." : (
            <>
                <IoSave size={20} /> Salvar Configurações
            </>
        )}
      </button>

    </div>
  );
};

export default AdminSettings;