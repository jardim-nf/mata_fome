// src/components/AdminPlansManagement.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { 
  FaStore, 
  FaSignOutAlt, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaCheck, 
  FaTimes, 
  FaPalette, 
  FaIcons, 
  FaArrowLeft,
  FaSave 
} from 'react-icons/fa';

// --- Header Minimalista (Reutilizado) ---
const DashboardHeader = ({ navigate, logout, currentUser }) => {
  const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Admin';
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
           <div className="flex items-center gap-1">
              <div className="bg-yellow-400 text-black font-bold p-1 rounded-sm transform -skew-x-12">
                  <FaStore />
              </div>
              <span className="text-gray-900 font-extrabold text-xl tracking-tight">
                  Na<span className="text-yellow-500">Mão</span>
              </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">{userEmailPrefix}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Master Admin</span>
            </div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50"
                title="Sair"
            >
              <FaSignOutAlt />
            </button>
          </div>
      </div>
    </header>
  );
};

// --- Componente de Input Minimalista ---
const FormInput = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">{label}</label>
    <input 
      {...props}
      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-3 transition-all placeholder-gray-400"
    />
  </div>
);

function AdminPlansManagement() {
  const navigate = useNavigate();
  const { currentUser, logout, isMasterAdmin, loading: authLoading } = useAuth();

  const [plans, setPlans] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    preco: '',
    duracao: '',
    recursos: [],
    ativo: true,
    corDestaque: '#000000', // Padrão preto
    icone: '📊'
  });

  // Ícones (Emojis) para o plano
  const availableIcons = [
    '📊', '🚀', '⭐', '👑', '💎', '🔧', '🛡️', '⚡', '🎯', '🌟',
    '💼', '🔑', '🎨', '📈', '🔔', '🔄', '📱', '💻', '🌐', '🔒'
  ];

  // Cores (Tailwind inspired hex)
  const availableColors = [
    '#000000', '#F59E0B', '#10B981', '#3B82F6', '#6366F1',
    '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#64748B'
  ];

  useEffect(() => {
    if (authLoading) return;
    if (!isMasterAdmin) {
        navigate('/master-dashboard');
        return;
    }

    const unsubscribe = onSnapshot(collection(db, 'plans'), (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlans(plansData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authLoading, isMasterAdmin, navigate]);

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      const planToSave = {
        nome: formData.nome,
        descricao: formData.descricao,
        preco: Number(formData.preco),
        duracao: Number(formData.duracao),
        recursos: formData.recursos.filter(rec => rec.trim() !== ''),
        ativo: formData.ativo,
        corDestaque: formData.corDestaque,
        icone: formData.icone,
        createdAt: editingPlan ? formData.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (editingPlan) {
        await updateDoc(doc(db, 'plans', editingPlan.id), planToSave);
        toast.success('Plano atualizado!');
      } else {
        await addDoc(collection(db, 'plans'), planToSave);
        toast.success('Plano criado!');
      }

      closeModal();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar plano.');
    }
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      nome: plan.nome || '',
      descricao: plan.descricao || '',
      preco: plan.preco?.toString() || '',
      duracao: plan.duracao?.toString() || '',
      recursos: plan.recursos || [],
      ativo: plan.ativo !== false,
      corDestaque: plan.corDestaque || '#000000',
      icone: plan.icone || '📊',
      createdAt: plan.createdAt
    });
    setShowModal(true);
  };

  const handleDelete = async (planId) => {
    if (window.confirm('Tem certeza que deseja excluir este plano?')) {
      try {
        await deleteDoc(doc(db, 'plans', planId));
        toast.success('Plano excluído.');
      } catch (error) {
        toast.error('Erro ao excluir.');
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPlan(null);
    setFormData({
      nome: '', descricao: '', preco: '', duracao: '', recursos: [], ativo: true, corDestaque: '#000000', icone: '📊'
    });
  };

  // Funções de Recursos
  const addRecurso = () => setFormData({ ...formData, recursos: [...formData.recursos, ''] });
  const updateRecurso = (index, value) => {
    const novos = [...formData.recursos];
    novos[index] = value;
    setFormData({ ...formData, recursos: novos });
  };
  const removeRecurso = (index) => {
    setFormData({ ...formData, recursos: formData.recursos.filter((_, i) => i !== index) });
  };

  if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="bg-gray-50 min-h-screen pt-20 pb-12 px-4 sm:px-6 font-sans text-gray-900">
      <DashboardHeader navigate={navigate} logout={logout} currentUser={currentUser} />

      <div className="max-w-7xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <button onClick={() => navigate('/master-dashboard')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-2 text-sm font-medium transition-colors">
                    <FaArrowLeft /> Voltar ao Dashboard
                </button>
                <h1 className="text-3xl font-bold tracking-tight">Planos & Assinaturas</h1>
                <p className="text-gray-500 text-sm mt-1">Configure os pacotes disponíveis para os estabelecimentos.</p>
            </div>
            <button 
                onClick={() => { setEditingPlan(null); setShowModal(true); }} 
                className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-lg font-bold text-sm"
            >
                <FaPlus /> Novo Plano
            </button>
        </div>

        {/* Grid de Planos */}
        {plans.length === 0 ? (
             <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 text-2xl">
                    <FaIcons />
                </div>
                <h3 className="text-lg font-bold text-gray-700">Nenhum plano criado</h3>
                <p className="text-gray-400 text-sm mt-1">Crie o primeiro plano para começar a vender.</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col overflow-hidden group">
                        
                        {/* Faixa de Cor */}
                        <div className="h-2 w-full" style={{ backgroundColor: plan.corDestaque }}></div>

                        <div className="p-6 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl shadow-inner">
                                    {plan.icone}
                                </div>
                                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${plan.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {plan.ativo ? 'Ativo' : 'Inativo'}
                                </div>
                            </div>

                            <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.nome}</h3>
                            <div className="flex items-baseline gap-1 mb-4">
                                <span className="text-sm font-bold text-gray-400">R$</span>
                                <span className="text-3xl font-extrabold text-gray-900">{plan.preco.toFixed(2).replace('.', ',')}</span>
                                <span className="text-xs text-gray-400 font-medium">/ {plan.duracao} dias</span>
                            </div>

                            <p className="text-sm text-gray-500 mb-6 line-clamp-2 min-h-[40px]">{plan.descricao}</p>

                            <div className="space-y-2 mb-6">
                                {plan.recursos?.slice(0, 4).map((rec, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                                        <FaCheck className="text-green-500 flex-shrink-0" />
                                        <span className="truncate">{rec}</span>
                                    </div>
                                ))}
                                {plan.recursos?.length > 4 && (
                                    <p className="text-xs text-gray-400 pl-5">+ {plan.recursos.length - 4} recursos</p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                            <button 
                                onClick={() => handleEdit(plan)}
                                className="flex-1 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                            >
                                <FaEdit /> Editar
                            </button>
                            <button 
                                onClick={() => handleDelete(plan.id)}
                                className="w-10 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- MODAL (FORMULÁRIO) --- */}
        {showModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            {editingPlan ? <FaEdit className="text-yellow-500" /> : <FaPlus className="text-yellow-500" />}
                            {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
                        </h2>
                        <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><FaTimes /></button>
                    </div>

                    <form onSubmit={handleSavePlan} className="p-6 space-y-6">
                        
                        {/* Seção 1: Identificação */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <FormInput label="Nome do Plano" name="nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: Básico, Premium..." />
                            </div>
                            <FormInput label="Preço (R$)" name="preco" type="number" step="0.01" value={formData.preco} onChange={e => setFormData({...formData, preco: e.target.value})} required placeholder="0.00" />
                            <FormInput label="Duração (Dias)" name="duracao" type="number" value={formData.duracao} onChange={e => setFormData({...formData, duracao: e.target.value})} required placeholder="30" />
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Descrição Curta</label>
                                <textarea 
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-black focus:border-transparent block p-3 transition-all placeholder-gray-400 resize-none"
                                    rows="2"
                                    value={formData.descricao}
                                    onChange={e => setFormData({...formData, descricao: e.target.value})}
                                ></textarea>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Seção 2: Personalização */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2"><FaIcons /> Ícone & Cor</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs text-gray-400 mb-2">Selecione um Ícone:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableIcons.map((ico) => (
                                            <button 
                                                key={ico} type="button"
                                                onClick={() => setFormData({...formData, icone: ico})}
                                                className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all ${formData.icone === ico ? 'bg-black text-white shadow-md scale-110' : 'bg-gray-50 text-gray-600 hover:bg-gray-200'}`}
                                            >
                                                {ico}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 mb-2">Cor de Destaque:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {availableColors.map((cor) => (
                                            <button 
                                                key={cor} type="button"
                                                onClick={() => setFormData({...formData, corDestaque: cor})}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${formData.corDestaque === cor ? 'border-gray-400 scale-110 shadow-md' : 'border-transparent'}`}
                                                style={{ backgroundColor: cor }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Seção 3: Recursos */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-bold text-gray-500 uppercase">Lista de Benefícios</label>
                                <button type="button" onClick={addRecurso} className="text-xs font-bold text-yellow-600 hover:text-yellow-700 flex items-center gap-1">+ Adicionar Item</button>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {formData.recursos.map((rec, idx) => (
                                    <div key={idx} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={rec} 
                                            onChange={e => updateRecurso(idx, e.target.value)}
                                            placeholder="Ex: Suporte 24h"
                                            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-black"
                                        />
                                        <button type="button" onClick={() => removeRecurso(idx)} className="text-gray-400 hover:text-red-500 px-2"><FaTrash /></button>
                                    </div>
                                ))}
                                {formData.recursos.length === 0 && <p className="text-xs text-gray-400 italic">Nenhum benefício adicionado.</p>}
                            </div>
                        </div>

                        {/* Footer do Modal */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <label className="flex items-center cursor-pointer gap-3">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only" checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} />
                                    <div className={`block w-10 h-6 rounded-full transition-colors ${formData.ativo ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                    <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.ativo ? 'transform translate-x-4' : ''}`}></div>
                                </div>
                                <span className="text-sm font-bold text-gray-700">{formData.ativo ? 'Disponível para venda' : 'Indisponível'}</span>
                            </label>

                            <div className="flex gap-3">
                                <button type="button" onClick={closeModal} className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors">Cancelar</button>
                                <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-black hover:bg-gray-800 shadow-lg flex items-center gap-2">
                                    <FaSave /> Salvar Plano
                                </button>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default AdminPlansManagement;