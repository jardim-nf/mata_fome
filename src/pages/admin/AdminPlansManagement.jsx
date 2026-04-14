import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { 
  FaStore, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaCheck, 
  FaTimes, 
  FaIcons, 
  FaArrowLeft,
  FaSave,
  FaTags,
  FaLayerGroup,
  FaBolt
} from 'react-icons/fa';
import { IoLogOutOutline } from 'react-icons/io5';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Componente de Input Bento ---
const FormInput = ({ label, icon: Icon, ...props }) => (
  <div>
    <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">{label}</label>
    <div className="relative">
      {Icon && <div className="absolute left-4 top-4 text-[#86868B]"><Icon size={14} /></div>}
      <input 
        {...props}
        className={`w-full bg-[#F5F5F7] border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl outline-none focus:bg-white focus:border-black transition-all ${Icon ? 'pl-11 pr-4 py-4' : 'p-4'}`}
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
    corDestaque: '#10B981',
    icone: '⭐'
  });

  const availableIcons = [
    '⭐', '🚀', '💎', '👑', '📊', '🔧', '🛡️', '⚡', '🎯', '🌟',
    '💼', '🔑', '🎨', '📈', '🔔', '🔄', '📱', '💻', '🌐', '🔒'
  ];

  const availableColors = [
    '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#5856D6', '#AF52DE', '#FF2D55', '#1D1D1F', '#86868B', '#000000'
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
      corDestaque: plan.corDestaque || '#007AFF',
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
      nome: '', descricao: '', preco: '', duracao: '', recursos: [], ativo: true, corDestaque: '#007AFF', icone: '⭐'
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

  if (loading || authLoading) return <div className="flex h-screen items-center justify-center bg-[#F5F5F7]"><FaBolt className="text-[#86868B] text-4xl animate-pulse" /></div>;

  return (
    <div className="bg-[#F5F5F7] min-h-screen font-sans text-[#1D1D1F] pb-24 pt-4 px-4 sm:px-8">
      
      {/* ─── FLOATING PILL NAVBAR ─── */}
      <nav className="max-w-[1400px] mx-auto bg-white/70 backdrop-blur-xl border border-white/50 shadow-sm rounded-full h-16 flex items-center justify-between px-6 sticky top-4 z-50 transition-all">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/master-dashboard')} className="w-9 h-9 bg-[#F5F5F7] hover:bg-[#E5E5EA] rounded-full flex items-center justify-center transition-colors">
            <FaArrowLeft className="text-[#86868B] text-sm" />
          </button>
          <div className="hidden sm:block border-l border-[#E5E5EA] pl-4">
            <h1 className="font-semibold text-sm tracking-tight text-black">Planos e Assinaturas</h1>
            <p className="text-[11px] text-[#86868B] font-medium">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-px h-6 bg-[#E5E5EA] hidden sm:block" />
          <button onClick={async () => { await logout(); navigate('/'); }} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
            <IoLogOutOutline className="text-red-500" size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto mt-8">
        
        {/* HEADER DA PÁGINA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 px-2">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="bg-[#E5E5EA] text-[#1D1D1F] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">Monetização SaaS</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1D1D1F]">Gestão de Planos</h1>
            <p className="text-[#86868B] text-sm mt-1 font-medium">Configure os pacotes que serão exibidos no checkout e landing page.</p>
          </div>
          <button 
            onClick={() => { setEditingPlan(null); setShowModal(true); }} 
            className="flex items-center gap-2 bg-[#1D1D1F] text-white px-8 py-3.5 rounded-full hover:bg-black transition-all shadow-sm font-bold text-sm active:scale-95"
          >
            <FaPlus /> Novo Plano
          </button>
        </div>

        {/* GRID DE PLANOS */}
        {plans.length === 0 ? (
             <div className="text-center py-24 bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mb-5 border border-[#E5E5EA]">
                    <FaLayerGroup className="text-3xl text-[#86868B]" />
                </div>
                <h3 className="text-xl font-bold text-[#1D1D1F] tracking-tight">Vitrines Vazias</h3>
                <p className="text-[#86868B] text-sm mt-2 font-medium">Nenhum pacote cadastrado. Crie um agora mesmo.</p>
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {plans.map(plan => (
                    <div key={plan.id} className="bg-white rounded-[2rem] border border-[#E5E5EA] shadow-sm hover:shadow-lg hover:border-black/20 transition-all duration-300 flex flex-col overflow-hidden relative group">
                        
                        {/* Linha Fina no Topo */}
                        <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: plan.corDestaque }}></div>

                        <div className="p-8 flex-1 flex flex-col relative z-10 pt-10">
                            {/* Badges e Ícone */}
                            <div className="flex justify-between items-start mb-6">
                                <div 
                                    className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-2xl shadow-sm transition-transform group-hover:scale-105 duration-300 border"
                                    style={{ backgroundColor: `${plan.corDestaque}10`, color: plan.corDestaque, borderColor: `${plan.corDestaque}30` }}
                                >
                                    {plan.icone}
                                </div>
                                {plan.ativo ? (
                                    <span className="inline-flex items-center gap-1.5 bg-[#E5F1FF] text-[#007AFF] px-3 py-1.5 rounded-full text-[10px] font-bold border border-[#CCE3FF] uppercase tracking-widest">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse"></span> Ativo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 bg-[#FFE6E6] text-[#FF3B30] px-3 py-1.5 rounded-full text-[10px] font-bold border border-[#FFD1D1] uppercase tracking-widest">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]"></span> Oculto
                                    </span>
                                )}
                            </div>

                            {/* Título e Preço */}
                            <h3 className="text-2xl font-black text-[#1D1D1F] tracking-tight mb-2">{plan.nome}</h3>
                            <div className="flex items-baseline gap-1 mb-3">
                                <span className="text-sm font-bold text-[#86868B]">R$</span>
                                <span className="text-4xl font-black text-[#1D1D1F] tracking-tighter">{plan.preco.toFixed(2).replace('.', ',')}</span>
                                <span className="text-xs text-[#86868B] font-bold uppercase tracking-wider ml-1">/ {plan.duracao} dias</span>
                            </div>
                            <p className="text-sm font-medium text-[#86868B] mb-8 min-h-[40px] leading-relaxed">{plan.descricao}</p>

                            <hr className="border-[#E5E5EA] mb-6" />

                            {/* Recursos */}
                            <div className="flex-1">
                                <p className="text-[10px] font-bold text-[#86868B] uppercase tracking-widest mb-4">Inclusivo</p>
                                <ul className="space-y-4 mb-6">
                                    {plan.recursos?.slice(0, 5).map((rec, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-[#1D1D1F] font-medium">
                                            <FaCheck className="flex-shrink-0 mt-0.5 text-sm" style={{ color: plan.corDestaque }} />
                                            <span className="leading-tight">{rec}</span>
                                        </li>
                                    ))}
                                    {plan.recursos?.length > 5 && (
                                        <li className="text-xs text-[#86868B] font-bold pl-7">
                                            +{plan.recursos.length - 5} recurso(s) ocultos
                                        </li>
                                    )}
                                    {(!plan.recursos || plan.recursos.length === 0) && (
                                        <li className="text-xs text-[#86868B] italic">Sem benefícios declarados.</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* Rodapé de Ações */}
                        <div className="p-6 border-t border-[#E5E5EA] bg-[#F5F5F7] flex gap-3">
                            <button 
                                onClick={() => handleEdit(plan)}
                                className="flex-1 py-3.5 bg-white border border-[#E5E5EA] rounded-full text-xs font-bold text-[#1D1D1F] hover:bg-black hover:text-white hover:border-black transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                            >
                                <FaEdit /> Editar Características
                            </button>
                            <button 
                                onClick={() => handleDelete(plan.id)}
                                className="w-12 h-12 flex items-center justify-center bg-white border border-[#E5E5EA] rounded-full text-[#86868B] hover:bg-[#FFE6E6] hover:text-[#FF3B30] hover:border-[#FFD1D1] transition-all shadow-sm active:scale-95"
                                title="Excluir Plano"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* --- MODAL (FORMULÁRIO) BENTO --- */}
        {showModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-[2rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col transform transition-all border border-[#E5E5EA]">
                    
                    <div className="p-8 border-b border-[#E5E5EA] flex justify-between items-center bg-[#F5F5F7]">
                        <div>
                            <h2 className="text-2xl font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
                                {editingPlan ? <FaEdit className="text-[#86868B]" /> : <FaPlus className="text-[#86868B]" />}
                                {editingPlan ? 'Configurar Plano' : 'Montar Novo Plano'}
                            </h2>
                            <p className="text-xs font-medium text-[#86868B] mt-1">Insira os termos de venda desta assinatura.</p>
                        </div>
                        <button onClick={closeModal} className="bg-white text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA] p-3 rounded-full transition-colors active:scale-95 border border-[#E5E5EA] shadow-sm"><FaTimes /></button>
                    </div>

                    <div className="overflow-y-auto p-8 flex-1 custom-scrollbar bg-white">
                        <form id="plan-form" onSubmit={handleSavePlan} className="space-y-10">
                            
                            {/* Identificação */}
                            <div className="bg-[#F5F5F7] p-6 rounded-[2rem] border border-[#E5E5EA]">
                                <h3 className="text-sm font-bold text-[#1D1D1F] mb-6 flex items-center gap-2"><FaTags className="text-[#86868B]"/> Definição Primária</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <FormInput label="Nomenclatura (Título)" name="nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} required placeholder="Ex: Starter, Pro, Enterprise..." />
                                    </div>
                                    <FormInput label="Mensalidade (R$)" name="preco" type="number" step="0.01" value={formData.preco} onChange={e => setFormData({...formData, preco: e.target.value})} required placeholder="0.00" />
                                    <FormInput label="Ciclo de Retenção (Dias)" name="duracao" type="number" value={formData.duracao} onChange={e => setFormData({...formData, duracao: e.target.value})} required placeholder="Ex: 30" />
                                    
                                    <div className="md:col-span-2">
                                        <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-2">Resumo Publicitário</label>
                                        <textarea 
                                            className="w-full bg-white border border-[#E5E5EA] text-[#1D1D1F] text-sm font-semibold rounded-3xl outline-none focus:border-black transition-all p-4 resize-none shadow-sm"
                                            rows="2"
                                            placeholder="Por que os clientes comprariam este plano?"
                                            value={formData.descricao}
                                            onChange={e => setFormData({...formData, descricao: e.target.value})}
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Personalização */}
                            <div>
                                <h3 className="text-sm font-bold text-[#1D1D1F] mb-6 flex items-center gap-2"><FaIcons className="text-[#86868B]"/> Estética</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-[#F5F5F7] p-6 rounded-[2rem] border border-[#E5E5EA]">
                                        <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4">Emoji ou Ícone</p>
                                        <div className="flex flex-wrap gap-3">
                                            {availableIcons.map((ico) => (
                                                <button 
                                                    key={ico} type="button"
                                                    onClick={() => setFormData({...formData, icone: ico})}
                                                    className={`w-12 h-12 rounded-[1.25rem] text-2xl flex items-center justify-center transition-all ${formData.icone === ico ? 'bg-[#1D1D1F] text-white shadow-md scale-110' : 'bg-white border border-[#E5E5EA] text-[#86868B] hover:bg-[#E5E5EA] hover:scale-105'}`}
                                                >
                                                    {ico}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-[#F5F5F7] p-6 rounded-[2rem] border border-[#E5E5EA]">
                                        <p className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider mb-4">Hex Destaque</p>
                                        <div className="flex flex-wrap gap-3">
                                            {availableColors.map((cor) => (
                                                <button 
                                                    key={cor} type="button"
                                                    onClick={() => setFormData({...formData, corDestaque: cor})}
                                                    className={`w-10 h-10 rounded-full transition-all relative flex items-center justify-center ${formData.corDestaque === cor ? 'scale-125 shadow-md z-10 border-2 border-white' : 'hover:scale-110 opacity-60 hover:opacity-100'}`}
                                                    style={{ backgroundColor: cor }}
                                                >
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recursos */}
                            <div className="bg-[#F5F5F7] p-6 rounded-[2rem] border border-[#E5E5EA]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2"><FaCheck className="text-[#86868B]"/> Checklist Comercial</h3>
                                    <button type="button" onClick={addRecurso} className="text-[11px] font-bold bg-[#1D1D1F] text-white hover:bg-black px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm">
                                        <FaPlus size={10} /> Inserir Parâmetro
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.recursos.map((rec, idx) => (
                                        <div key={idx} className="flex gap-3 items-center bg-white p-2 pl-4 rounded-full border border-[#E5E5EA] group shadow-sm">
                                            <div className="text-[#86868B] font-bold text-xs">#{idx + 1}</div>
                                            <input 
                                                type="text" 
                                                value={rec} 
                                                onChange={e => updateRecurso(idx, e.target.value)}
                                                placeholder="Desbloqueio de..."
                                                className="flex-1 bg-transparent border-none focus:ring-0 py-1.5 text-sm font-medium text-[#1D1D1F] outline-none"
                                            />
                                            <button type="button" onClick={() => removeRecurso(idx)} className="w-9 h-9 flex items-center justify-center bg-[#F5F5F7] border border-[#E5E5EA] rounded-full text-[#86868B] hover:text-[#FF3B30] hover:border-[#FFD1D1] hover:bg-[#FFE6E6] transition-colors">
                                                <FaTrash size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {formData.recursos.length === 0 && (
                                        <div className="text-center py-8 border border-dashed border-[#E5E5EA] rounded-[1.5rem] bg-white">
                                            <p className="text-sm font-bold text-[#1D1D1F]">Vazio.</p>
                                            <p className="text-xs text-[#86868B] mt-1 font-medium">Os consumidores adoram ver o que estão comprando.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Footer Privado */}
                    <div className="p-8 border-t border-[#E5E5EA] bg-[#F5F5F7] flex flex-col sm:flex-row items-center justify-between gap-6">
                        <label className="flex items-center cursor-pointer gap-4 p-3 bg-white border border-[#E5E5EA] rounded-2xl hover:border-black transition-colors shadow-sm">
                            <div className="relative">
                                <input type="checkbox" className="sr-only" checked={formData.ativo} onChange={e => setFormData({...formData, ativo: e.target.checked})} />
                                <div className={`block w-12 h-7 rounded-full transition-colors ${formData.ativo ? 'bg-[#34C759]' : 'bg-[#E5E5EA]'}`}></div>
                                <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 shadow-sm ${formData.ativo ? 'transform translate-x-5' : ''}`}></div>
                            </div>
                            <div>
                                <span className={`block text-sm font-bold ${formData.ativo ? 'text-[#1D1D1F]' : 'text-[#86868B]'}`}>Oferta Pública</span>
                                <span className="block text-[10px] text-[#86868B] font-medium">{formData.ativo ? 'Em exposição.' : 'Draft oculto.'}</span>
                            </div>
                        </label>

                        <div className="flex gap-4 w-full sm:w-auto">
                            <button type="button" onClick={closeModal} className="flex-1 sm:flex-none px-8 py-4 rounded-full text-sm font-bold text-[#1D1D1F] bg-white border border-[#E5E5EA] hover:bg-[#E5E5EA] transition-colors shadow-sm">
                                Fechar
                            </button>
                            <button type="submit" form="plan-form" className="flex-1 sm:flex-none px-10 py-4 rounded-full text-sm font-bold text-white bg-[#1D1D1F] hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md">
                                <FaSave /> Finalizar Deploy
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        )}

      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
        
        /* Custom Scrollbar for Modal */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #E5E5EA;
          border-radius: 10px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #86868B;
        }
      `}</style>
    </div>
  );
}

export default AdminPlansManagement;