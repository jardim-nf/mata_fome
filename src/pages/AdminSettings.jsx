import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { IoSave, IoLockClosed, IoEye, IoEyeOff } from 'react-icons/io5';

const AdminSettings = () => {
  const { estabelecimentoIdPrincipal } = useAuth();
  const [senhaMaster, setSenhaMaster] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!estabelecimentoIdPrincipal) return;
      try {
        const docRef = doc(db, 'estabelecimentos', estabelecimentoIdPrincipal);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().senhaMaster) {
          setSenhaMaster(docSnap.data().senhaMaster);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };

    fetchSettings();
  }, [estabelecimentoIdPrincipal]);

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
        senhaMaster: senhaMaster
      });
      toast.success("Senha Master atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao atualizar senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configurações Gerais</h1>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 mb-4 border-b pb-4">
            <div className="bg-red-100 p-2 rounded-lg">
                <IoLockClosed className="text-red-600 text-xl" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-800">Senha Master (Exclusão de Pedidos)</h2>
                <p className="text-sm text-gray-500">Esta senha é usada pelos garçons para autorizar a exclusão de itens já enviados para a cozinha.</p>
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
            
            <button 
                onClick={handleSave}
                disabled={loading}
                className="mt-4 flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-70"
            >
                {loading ? "Salvando..." : (
                    <>
                        <IoSave /> Salvar Alterações
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;