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
  FaIcons, 
  FaArrowLeft,
  FaSave,
  FaTags,
  FaLayerGroup
} from 'react-icons/fa';

// --- Header Premium (Reutilizado) ---
const DashboardHeader = ({ navigate, logout, currentUser }) => {
  const userEmailPrefix = currentUser?.email ? currentUser.email.split('@')[0] : 'Admin';
  
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50 shadow-sm h-16 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
           <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white font-bold p-1.5 rounded-lg shadow-md transform -skew-x-6 group-hover:rotate-3 transition-transform">
                  <svg className="w-5 h-5 drop-shadow-sm" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-gray-900 font-black text-xl tracking-tighter">
                  Idea<span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-yellow-600">Food</span>
              </span>
          </div>
        </div>
        <div className="flex items-center gap-5">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-gray-800 tracking-tight">{userEmailPrefix}</span>
              <span className="text-[9px] uppercase tracking-widest text-yellow-600 font-bold bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-100 mt-0.5">Master Access</span>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>
            <button 
                onClick={logout} 
                className="text-gray-400 hover:text-red-500 transition-all duration-300 p-2 rounded-xl hover:bg-red-50/80 active:scale-95"
                title="Encerrar Sessão"
            >
              <FaSignOutAlt size={18} />
            </button>
          </div>
      </div>
    </header>
  );
};

// --- Componente de Input Premium ---
const FormInput = ({ label, icon: Icon, ...props }) => (
  <div>
    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
    <div className="relative">
      {Icon && <div className="absolute left-4 top-3.5 text-gray-400"><Icon size={14} /></div>}
      <input 
        {...props}
        className={`w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm ${Icon ? 'pl-11 pr-4 py-3' : 'px-4 py-3'}`}
      />
    </div>
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
    corDestaque: '#10B981', // Padrão verde premium
    icone: '⭐'
  });

  // Ícones (Emojis) para o plano
  const availableIcons = [
    '⭐', '🚀', '💎', '👑', '📊', '🔧', '🛡️', '⚡', '🎯', '🌟',
    '💼', '🔑', '🎨', '📈', '🔔', '🔄', '📱', '💻', '🌐', '🔒'
  ];

  // Cores (Tailwind inspired hex)
  const availableColors = [
    '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', 
    '#F59E0B', '#F97316', '#14B8A6', '#06B6D4', '#0F172A'
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
      // Ordenar por preço (mais barato primeiro)
      plansData.sort((a, b) => (a.preco || 0) - (b.preco || 0));
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
        toast.success('Plano atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'plans'), planToSave);
        toast.success('Novo plano criado com sucesso!');
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
      corDestaque: plan.corDestaque || '#10B981',
      icone: plan.icone || '⭐',
      createdAt: plan.createdAt
    });
    setShowModal(true);
  };

  const handleDelete = async (planId) => {
    if (window.confirm('Tem certeza que deseja excluir este plano permanentemente?')) {
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
      nome: '', descricao: '', preco: '', duracao: '', recursos: [], ativo: true, corDestaque: '#10B981', icone: '⭐'
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

  if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-[#f8fafc]"><div className="w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin shadow-lg"></div></div>;

  return (
    <div className="bg-[#f8fafc] min-h-screen pt-24 pb-12 px-4 sm:px-6 font-sans text-gray-900 selection:bg-yellow-200 selection:text-black">
      <DashboardHeader navigate={navigate} logout={logout} currentUser={currentUser} />

      <div className="max-w-7xl mx-auto">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <button 
              onClick={() => navigate('/master-dashboard')} 
              className="text-gray-400 hover:text-yellow-600 flex items-center gap-2 mb-4 text-sm font-bold transition-colors group"
            >
              <span className="bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 group-hover:border-yellow-200 transition-colors">
                <FaArrowLeft />
              </span> 
              Voltar ao Painel Master
            </button>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-gray-900 text-yellow-400 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm">Assinaturas e Pacotes</span>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Gestão de Planos</h1>
            <p className="text-gray-500 text-sm mt-2 font-medium">Crie e configure os planos de venda disponíveis para as lojas parceiras.</p>
          </div>
          <button 
            onClick={() => { setEditingPlan(null); setShowModal(true); }} 
            className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-6 py-3 rounded-2xl hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg shadow-yellow-500/30 font-bold text-sm active:scale-95"
          >
            <FaPlus /> Novo Plano
          </button>
        </div>

        {/* GRID DE PLANOS */}
        {plans.length === 0 ? (
             <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-5 shadow-inner">
                    <FaLayerGroup className="text-4xl text-gray-300" />
                </div>
                <h3 className="text-xl font-black text-gray-800 tracking-tight">Nenhum plano criado</h3>
                <p className="text-gray-400 text-sm mt-2 font-medium">Crie o seu primeiro pacote de assinatura para começar a rentabilizar a plataforma.</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:shadow-gray-200/50 hover:-translate-y-2 transition-all duration-500 flex flex-col overflow-hidden relative group">
                        
                        {/* Borda superior colorida */}
                        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: plan.corDestaque }}></div>

                        <div className="p-8 flex-1 flex flex-col relative z-10">
                            {/* Badges e Ícone */}
                            <div className="flex justify-between items-start mb-6">
                                <div 
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300"
                                    style={{ backgroundColor: `${plan.corDestaque}15`, color: plan.corDestaque, border: `1px solid ${plan.corDestaque}30` }}
                                >
                                    {plan.icone}
                                </div>
                                {plan.ativo ? (
                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold border border-emerald-100 uppercase tracking-widest">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ativo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-md text-[10px] font-bold border border-rose-100 uppercase tracking-widest">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inativo
                                    </span>
                                )}
                            </div>

                            {/* Título e Preço */}
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">{plan.nome}</h3>
                            <div className="flex items-baseline gap-1 mb-3">
                                <span className="text-sm font-bold text-gray-400">R$</span>
                                <span className="text-4xl font-black text-gray-900 tracking-tighter">{plan.preco.toFixed(2).replace('.', ',')}</span>
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider ml-1">/ {plan.duracao} dias</span>
                            </div>
                            <p className="text-sm font-medium text-gray-500 mb-8 min-h-[40px] leading-relaxed">{plan.descricao}</p>

                            <hr className="border-gray-100 mb-6" />

                            {/* Recursos */}
                            <div className="flex-1">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">O que inclui</p>
                                <ul className="space-y-3.5 mb-6">
                                    {plan.recursos?.slice(0, 5).map((rec, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-gray-700 font-medium">
                                            <FaCheck className="flex-shrink-0 mt-0.5" style={{ color: plan.corDestaque }} />
                                            <span className="leading-tight">{rec}</span>
                                        </li>
                                    ))}
                                    {plan.recursos?.length > 5 && (
                                        <li className="text-xs text-gray-400 font-bold pl-7 italic">
                                            E mais {plan.recursos.length - 5} recurso(s)...
                                        </li>
                                    )}
                                    {(!plan.recursos || plan.recursos.length === 0) && (
                                        <li className="text-xs text-gray-400 italic">Nenhum recurso listado.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Rodapé de Ações */}
                        <div className="p-5 border-t border-gray-50 bg-gray-50/50 flex gap-2">
                            <button 
                                onClick={() => handleEdit(plan)}
                                className="flex-1 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-yellow-400 hover:text-yellow-600 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-95"
                            >
                                <FaEdit /> Editar Plano
                            </button>
                            <button 
                                onClick={() => handleDelete(plan.id)}
                                className="w-12 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:bg-rose-50 hover:text-rose-500 hover:border-rose-200 transition-all shadow-sm hover:shadow-md active:scale-95"
                                title="Excluir Plano"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- MODAL (FORMULÁRIO) PREMIUM --- */}
        {showModal && (
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col transform transition-all scale-100">
                    
                    <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-white">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                                {editingPlan ? <FaEdit className="text-yellow-500" /> : <FaPlus className="text-yellow-500" />}
                                {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
                            </h2>
                            <p className="text-xs font-medium text-gray-500 mt-1">Configure os detalhes e os recursos oferecidos.</p>
                        </div>
                        <button onClick={closeModal} className="bg-gray-100 text-gray-400 hover:text-gray-800 hover:bg-gray-200 p-3 rounded-full transition-colors active:scale-95"><FaTimes /></button>
                    </div>

                    <div className="overflow-y-auto p-6 md:p-8 flex-1 custom-scrollbar">
                        <form id="plan-form" onSubmit={handleSavePlan} className="space-y-8">
                            
                            {/* Seção 1: Identificação */}
                            <div>
                                <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><FaTags className="text-gray-400"/> Detalhes Principais</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <FormInput label="Nome do Plano" name="nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: Plano Master, Pacote Inicial..." />
                                    </div>
                                    <FormInput label="Preço (R$)" name="preco" type="number" step="0.01" value={formData.preco} onChange={e => setFormData({...formData, preco: e.target.value})} required placeholder="0.00" />
                                    <FormInput label="Duração (Dias)" name="duracao" type="number" value={formData.duracao} onChange={e => setFormData({...formData, duracao: e.target.value})} required placeholder="Ex: 30" />
                                    
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Descrição Curta</label>
                                        <textarea 
                                            className="w-full border-2 border-gray-100 bg-gray-50/50 rounded-2xl focus:outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/10 focus:bg-white transition-all font-semibold text-gray-700 text-sm p-4 resize-none"
                                            rows="2"
                                            placeholder="Descreva o plano em poucas palavras..."
                                            value={formData.descricao}
                                            onChange={e => setFormData({...formData, descricao: e.target.value})}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Seção 2: Personalização */}
                            <div>
                                <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-2"><FaIcons className="text-gray-400"/> Personalização Visual</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Selecione um Ícone</p>
                                        <div className="flex flex-wrap gap-2.5">
                                            {availableIcons.map((ico) => (
                                                <button 
                                                    key={ico} type="button"
                                                    onClick={() => setFormData({...formData, icone: ico})}
                                                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${formData.icone === ico ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/30 scale-110' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:scale-105'}`}
                                                >
                                                    {ico}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Cor de Destaque</p>
                                        <div className="flex flex-wrap gap-3">
                                            {availableColors.map((cor) => (
                                                <button 
                                                    key={cor} type="button"
                                                    onClick={() => setFormData({...formData, corDestaque: cor})}
                                                    className={`w-9 h-9 rounded-full transition-all relative flex items-center justify-center ${formData.corDestaque === cor ? 'scale-125 shadow-md z-10' : 'hover:scale-110 opacity-80 hover:opacity-100'}`}
                                                    style={{ backgroundColor: cor }}
                                                >
                                                    {formData.corDestaque === cor && <div className="w-8 h-8 rounded-full border-2 border-white absolute"></div>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Seção 3: Recursos */}
                            <div>
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2"><FaCheck className="text-gray-400"/> Lista de Benefícios</h3>
                                    <button type="button" onClick={addRecurso} className="text-xs font-bold bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 active:scale-95">
                                        <FaPlus size={10} /> Adicionar Item
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.recursos.map((rec, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-gray-50/50 p-2 rounded-xl border border-gray-100 group">
                                            <div className="w-8 flex justify-center text-gray-300 font-bold text-xs">{idx + 1}</div>
                                            <input 
                                                type="text" 
                                                value={rec} 
                                                onChange={e => updateRecurso(idx, e.target.value)}
                                                placeholder="Ex: Integração com WhatsApp..."
                                                className="flex-1 bg-transparent border-none focus:ring-0 px-2 py-1 text-sm font-medium text-gray-700 outline-none"
                                            />
                                            <button type="button" onClick={() => removeRecurso(idx)} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {formData.recursos.length === 0 && (
                                        <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                                            <p className="text-sm font-bold text-gray-500">Nenhum recurso adicionado ainda.</p>
                                            <p className="text-xs text-gray-400 mt-1">Clique no botão acima para listar as vantagens deste plano.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer do Modal */}
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <label className="flex items-center cursor-pointer gap-3 p-2 hover:bg-gray-100 rounded-xl transition-colors">
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-sm ${formData.ativo ? 'transform translate-x-5' : ''}`}></div>
                            </div>
                            <div>
                                <span className={`block text-sm font-black ${formData.ativo ? 'text-emerald-700' : 'text-gray-500'}`}>{formData.ativo ? 'Plano Ativo' : 'Plano Inativo'}</span>
                                <span className="block text-[10px] text-gray-400 font-medium">{formData.ativo ? 'Visível para os lojistas' : 'Oculto na plataforma'}</span>
                            </div>
                        </label>

                        <div className="flex gap-3 w-full sm:w-auto">
                            <button type="button" onClick={closeModal} className="flex-1 sm:flex-none px-6 py-3.5 rounded-2xl text-sm font-bold text-gray-500 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-800 transition-colors">
                                Cancelar
                            </button>
                            <button type="submit" form="plan-form" className="flex-1 sm:flex-none px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-gray-900 to-black hover:shadow-lg hover:shadow-gray-900/30 transition-all flex items-center justify-center gap-2 active:scale-95">
                                <FaSave /> {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default AdminPlansManagement;