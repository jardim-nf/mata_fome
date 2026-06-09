import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useHeader } from '../../context/HeaderContext';
import withEstablishmentAuth from '../../hocs/withEstablishmentAuth';
import { toast } from 'react-toastify';
import { 
  IoBicycle, 
  IoPerson, 
  IoCall, 
  IoIdCard, 
  IoAdd, 
  IoPencil, 
  IoTrash, 
  IoClose,
  IoCheckmarkCircle,
  IoEllipse,
  IoList,
  IoEyeOff,
  IoCash,
  IoAlertCircle,
  IoAddCircleOutline,
  IoSearch,
  IoSaveOutline
} from 'react-icons/io5';
import BackButton from '../../components/BackButton';

// Skeleton loader compatible with Light premium theme
const SkeletonLoader = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white/60 border border-slate-100/80 rounded-[2.2rem] p-6 shadow-sm animate-pulse">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-2 flex-1">
                        <div className="h-6 bg-slate-100 rounded-lg w-2/3"></div>
                        <div className="h-4 bg-slate-50 rounded-lg w-1/2"></div>
                    </div>
                    <div className="h-6 bg-slate-100 rounded-full w-14"></div>
                </div>
                <div className="space-y-3 mb-4">
                    <div className="h-4 bg-slate-50 rounded-lg w-3/4"></div>
                    <div className="h-4 bg-slate-50 rounded-lg w-1/2"></div>
                    <div className="h-4 bg-slate-50 rounded-lg w-2/3"></div>
                </div>
                <div className="h-10 bg-slate-100 rounded-xl w-full mb-4"></div>
                <div className="grid grid-cols-3 gap-2">
                    <div className="h-8 bg-slate-150 rounded-xl"></div>
                    <div className="h-8 bg-slate-150 rounded-xl"></div>
                    <div className="h-8 bg-slate-150 rounded-xl"></div>
                </div>
            </div>
        ))}
    </div>
);

const StatsCard = ({ title, value, icon: Icon, colorClass, bgClass }) => (
    <div className="group bg-white/70 border border-slate-150/40 rounded-[2rem] p-6 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 hover:scale-[1.02] relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl transform translate-x-12 -translate-y-10 group-hover:scale-150 transition-transform duration-700 bg-amber-200 opacity-40`}></div>
        <div className="relative z-10">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">{title}</p>
            <p className={`text-2xl font-black tracking-tight ${colorClass} drop-shadow-sm`}>{value}</p>
        </div>
        <div className={`relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${bgClass}`}>
            <Icon className={`text-xl ${colorClass}`} />
        </div>
    </div>
);

const EntregadorCard = ({ entregador, onEdit, onDelete, onToggleStatus }) => {
  return (
    <div className="group bg-white/80 rounded-[2.2rem] shadow-sm border border-slate-150/40 hover:shadow-xl hover:border-amber-200/80 transition-all duration-300 flex flex-col overflow-hidden relative">
      <div className="p-6 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-xl transition-all duration-300 ${entregador.ativo ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>
                <IoBicycle className="text-2xl" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-slate-800 text-lg leading-tight truncate group-hover:text-amber-700 transition-colors" title={entregador.nome}>{entregador.nome}</h3>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center w-fit mt-1.5 border shadow-sm ${entregador.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                  <IoEllipse className={`w-1.5 h-1.5 mr-1 ${entregador.ativo ? 'text-emerald-500 animate-pulse' : 'text-red-500'}`} />
                  {entregador.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Informações */}
        <div className="space-y-3 mb-6 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
          <div className="flex items-center text-slate-655 text-sm font-semibold">
            <IoCall className="mr-2 text-slate-450 text-lg" />
            {entregador.telefone || 'Sem telefone'}
          </div>
          {entregador.placa && (
            <div className="flex items-center text-slate-655 text-sm">
              <IoIdCard className="mr-2 text-slate-450 text-lg" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Placa:</span>
              <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-sm">{entregador.placa.toUpperCase()}</span>
            </div>
          )}
          <div className="flex items-center text-slate-655 text-sm">
            <IoCash className="mr-2 text-slate-450 text-lg" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-1">Taxa:</span>
            <span className="font-extrabold text-slate-755">
              {entregador.taxaFixa > 0 
                ? Number(entregador.taxaFixa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : 'Sem taxa fixa'
              }
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-2 mt-auto">
          <button 
            onClick={() => onToggleStatus(entregador)}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all border active:scale-95 shadow-sm ${
              entregador.ativo 
                ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50' 
                : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {entregador.ativo ? 'Pausar' : 'Reativar'}
          </button>
          <button 
            onClick={() => onEdit(entregador)}
            className="py-2.5 bg-amber-400 hover:bg-amber-500 text-amber-955 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm shadow-amber-400/20 border border-amber-400/30 flex items-center justify-center gap-1"
            title="Editar"
          >
            <IoPencil size={12} /> Editar
          </button>
          <button 
            onClick={() => onDelete(entregador.id)}
            className="py-2.5 bg-white hover:bg-red-50 text-red-500 rounded-xl text-xs font-bold transition-all border border-slate-200 hover:border-red-200 shadow-sm active:scale-95 flex items-center justify-center gap-1"
            title="Excluir"
          >
            <IoTrash size={12} /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

function AdminEntregadores() {
  const { currentUser, estabelecimentoIdPrincipal } = useAuth();
  const { setActions, clearActions } = useHeader();
  const estabelecimentoId = estabelecimentoIdPrincipal || currentUser?.estabelecimentoId;

  const [entregadores, setEntregadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Custom confirmation modal states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entregadorToDelete, setEntregadorToDelete] = useState(null);

  // Filter and Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    placa: '',
    taxaFixa: '',
    ativo: true
  });

  // Listener para buscar entregadores
  useEffect(() => {
    if (!estabelecimentoId) { setLoading(false); return; }

    const q = query(collection(db, 'estabelecimentos', estabelecimentoId, 'entregadores'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEntregadores(data);
      setLoading(false);
    }, (error) => {
      console.error("Erro ao buscar entregadores:", error);
      toast.error("Erro ao carregar lista de entregadores.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [estabelecimentoId]);

  // Header Actions
  useEffect(() => {
    const actions = (
      <button onClick={() => handleOpenModal()}
        className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-955 font-bold py-2.5 px-5 rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.25)] text-sm transition-all transform hover:scale-[1.02] active:scale-[0.98]">
        <IoAddCircleOutline className="text-xl" /> <span>Novo Entregador</span>
      </button>
    );
    setActions(actions);
    return () => clearActions();
  }, [setActions, clearActions]);

  // Stats Bento calculations
  const stats = useMemo(() => {
    const total = entregadores.length;
    const ativos = entregadores.filter(e => e.ativo !== false).length;
    const inativos = total - ativos;
    
    const entregadoresComTaxa = entregadores.filter(e => Number(e.taxaFixa) > 0);
    const somaTaxas = entregadoresComTaxa.reduce((acc, e) => acc + Number(e.taxaFixa), 0);
    const mediaTaxa = entregadoresComTaxa.length > 0 ? somaTaxas / entregadoresComTaxa.length : 0;
    
    return { total, ativos, inativos, mediaTaxa };
  }, [entregadores]);

  // Filtering logic
  const filteredEntregadores = useMemo(() => {
    return entregadores.filter(e => {
      const nomeNorm = e.nome?.toLowerCase() || '';
      const telNorm = e.telefone?.toLowerCase() || '';
      const placaNorm = e.placa?.toLowerCase() || '';
      const searchNorm = searchTerm.toLowerCase().trim();
      
      const matchSearch = nomeNorm.includes(searchNorm) || 
                          telNorm.includes(searchNorm) || 
                          placaNorm.includes(searchNorm);
                          
      const matchStatus = statusFilter === 'todos' || 
                          (statusFilter === 'ativos' && e.ativo !== false) || 
                          (statusFilter === 'inativos' && e.ativo === false);
                          
      return matchSearch && matchStatus;
    });
  }, [entregadores, searchTerm, statusFilter]);

  const handleOpenModal = (entregador = null) => {
    if (entregador) {
      setEditingId(entregador.id);
      setFormData({
        nome: entregador.nome,
        telefone: entregador.telefone || '',
        placa: entregador.placa || '',
        taxaFixa: entregador.taxaFixa || '',
        ativo: entregador.ativo !== false
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: '',
        telefone: '',
        placa: '',
        taxaFixa: '',
        ativo: true
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) return toast.warning("O nome é obrigatório!");

    try {
      const dataToSave = {
        nome: formData.nome.trim(),
        telefone: formData.telefone.trim(),
        placa: formData.placa.trim().toUpperCase(),
        taxaFixa: formData.taxaFixa ? Number(formData.taxaFixa) : 0,
        ativo: formData.ativo,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'entregadores', editingId), dataToSave);
        toast.success("Entregador atualizado!");
      } else {
        await addDoc(collection(db, 'estabelecimentos', estabelecimentoId, 'entregadores'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
        toast.success("Entregador cadastrado!");
      }
      setShowModal(false);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar dados.");
    }
  };

  const handleExcluirClick = (id) => {
    setEntregadorToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmarExcluir = async () => {
    if (!entregadorToDelete) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'entregadores', entregadorToDelete));
      toast.success("Entregador removido.");
      setDeleteConfirmOpen(false);
      setEntregadorToDelete(null);
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleToggleStatus = async (entregador) => {
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'entregadores', entregador.id), {
        ativo: entregador.ativo === false
      });
      toast.success(`Entregador ${entregador.ativo === false ? 'ativado' : 'desativado'}!`);
    } catch (error) {
      toast.error("Erro ao alterar status.");
    }
  };

  if (loading) return (
      <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 md:p-8 font-sans pb-32">
          <div className="max-w-7xl mx-auto space-y-6">
              <BackButton className="mb-4" />
              <div className="h-10 bg-slate-100 rounded-lg w-1/4 animate-pulse"></div>
              <SkeletonLoader />
          </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 md:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
      {/* ─── NEBULA GLOWS ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-indigo-400/5 rounded-full blur-[130px] pointer-events-none"></div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        <BackButton className="mb-4" />
        
        {/* Header */}
        <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                    <IoBicycle size={24} />
                </div>
                Gestão de Entregadores
            </h1>
            <p className="text-slate-500 mt-2 ml-[60px] font-medium">Cadastre e gerencie sua equipe de entregas.</p>
        </div>

        {/* Stats Bento Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatsCard title="Total" value={stats.total} icon={IoList} colorClass="text-amber-800" bgClass="bg-amber-50" />
            <StatsCard title="Ativos" value={stats.ativos} icon={IoCheckmarkCircle} colorClass="text-emerald-700" bgClass="bg-emerald-50" />
            <StatsCard title="Inativos" value={stats.inativos} icon={IoEyeOff} colorClass="text-slate-500" bgClass="bg-slate-100" />
            <StatsCard title="Média de Taxa" value={Number(stats.mediaTaxa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={IoCash} colorClass="text-indigo-650" bgClass="bg-indigo-50" />
        </div>

        {/* Filter and Search Bar (Frosted Glass Container) */}
        <div className="bg-white/50 border border-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-3 mb-10 flex flex-col md:flex-row gap-3 md:items-center">
            <div className="relative flex-1">
                <IoSearch className="absolute left-5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xl" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome, telefone ou placa..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-[#f8fafc]/50 hover:bg-[#f8fafc]/90 border border-slate-150/40 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-3xl transition-all outline-none font-medium text-slate-700 placeholder-slate-400 shadow-sm" 
                />
            </div>
            <div className="flex gap-3 px-1 md:px-0">
                <select 
                  value={statusFilter} 
                  onChange={e => setStatusFilter(e.target.value)}
                  className="px-6 py-4 bg-white border border-slate-150/40 hover:bg-slate-50 focus:ring-4 focus:ring-amber-500/10 rounded-2xl text-sm font-bold text-slate-700 outline-none cursor-pointer transition-all shadow-sm min-w-[180px] appearance-none"
                  style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center', backgroundSize: '1em' }}
                >
                    <option value="todos">Status: Todos</option>
                    <option value="ativos">✅ Ativos</option>
                    <option value="inativos">⏸️ Inativos</option>
                </select>
            </div>
        </div>

        {/* Lista */}
        <div className="min-h-[400px]">
          {filteredEntregadores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white/70 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-slate-200/60 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none"></div>
              <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 bg-amber-50 text-amber-300 rounded-full flex items-center justify-center mb-6 shadow-inner">
                      <IoBicycle className="text-4xl" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-700 mb-2">Nenhum entregador encontrado</h3>
                  <p className="text-slate-400 font-medium text-center max-w-sm mb-6">Tente ajustar seus filtros de busca ou cadastre um novo entregador.</p>
                  <button onClick={() => handleOpenModal()}
                      className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-955 font-bold py-3 px-8 rounded-2xl shadow-lg shadow-amber-500/25 hover:from-amber-500 hover:to-amber-600 transition-all">
                      <IoAddCircleOutline size={20} /> Novo Entregador
                  </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEntregadores.map(entregador => (
                <EntregadorCard 
                  key={entregador.id} 
                  entregador={entregador} 
                  onEdit={handleOpenModal}
                  onDelete={handleExcluirClick}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          )}
        </div>

        {/* MODAL FORM (CRIAR / EDITAR) */}
        {showModal && (
          <div className="fixed inset-0 z-[99999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-6 animate-fadeIn">
            <div className="bg-[#f8fafc] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200/60">

              {/* Modal Header */}
              <div className="flex-none h-20 px-6 md:px-10 flex items-center justify-between bg-white border-b border-slate-100 shadow-sm">
                  <h2 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">
                      {editingId ? 'Editar Entregador' : 'Novo Entregador'}
                  </h2>
                  <button type="button" onClick={() => setShowModal(false)}
                      className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-red-500 rounded-full transition-all hover:rotate-90">
                      <IoClose size={24} />
                  </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 md:px-10 py-8 custom-scrollbar space-y-6">
                
                {/* Identificação Card */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 space-y-5">
                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700"><IoPerson size={20} /></div>
                        <h3 className="text-lg font-bold text-slate-800">Identificação</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold mb-2 text-slate-550 uppercase tracking-widest">Nome Completo <span className="text-red-500">*</span></label>
                          <input 
                            type="text" 
                            className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white text-slate-800 font-semibold outline-none transition-all text-sm"
                            placeholder="Ex: João da Silva"
                            value={formData.nome}
                            onChange={e => setFormData({...formData, nome: e.target.value})}
                            required 
                            autoComplete="off"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold mb-2 text-slate-550 uppercase tracking-widest">Telefone / WhatsApp</label>
                          <input 
                            type="tel" 
                            className="w-full p-4 bg-slate-50/50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 focus:bg-white text-slate-850 font-semibold outline-none transition-all text-sm"
                            placeholder="Ex: (11) 99999-9999"
                            value={formData.telefone}
                            onChange={e => setFormData({...formData, telefone: e.target.value})}
                            autoComplete="off"
                          />
                      </div>
                    </div>
                </div>

                {/* Veículo e Taxa Card */}
                <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-slate-100 space-y-5">
                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700"><IoIdCard size={20} /></div>
                        <h3 className="text-lg font-bold text-slate-800">Veículo & Taxa</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-455 mb-2 block uppercase tracking-widest">Placa (opcional)</label>
                          <input 
                            type="text" 
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-mono font-bold outline-none focus:ring-4 focus:ring-amber-500/10 uppercase"
                            placeholder="ABC-1234"
                            value={formData.placa}
                            onChange={e => setFormData({...formData, placa: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-455 mb-2 block uppercase tracking-widest">Taxa Sugerida (R$)</label>
                          <input 
                            type="number" 
                            step="0.50"
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-extrabold outline-none focus:ring-4 focus:ring-amber-500/10"
                            placeholder="0.00"
                            value={formData.taxaFixa}
                            onChange={e => setFormData({...formData, taxaFixa: e.target.value})}
                          />
                      </div>
                    </div>

                    {/* Status Switcher Toggle */}
                    <div 
                      className={`p-5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        formData.ativo 
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 border-transparent shadow-lg shadow-amber-500/15' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}
                    >
                        <div>
                            <p className={`font-extrabold ${formData.ativo ? 'text-amber-955' : 'text-slate-600'}`}>
                                {formData.ativo ? '✅ Entregador Ativo' : 'Entregador Inativo'}
                            </p>
                            <p className={`text-[10px] ${formData.ativo ? 'text-amber-900/80' : 'text-slate-400'} mt-0.5`}>
                                {formData.ativo ? 'Disponível para vincular a pedidos.' : 'Não aparecerá na lista de entregas.'}
                            </p>
                        </div>
                        <div className={`w-14 h-7 rounded-full p-1 transition-all ${formData.ativo ? 'bg-amber-955/20' : 'bg-slate-300'}`}>
                            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${formData.ativo ? 'translate-x-7' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3.5 bg-white border border-slate-250 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all text-sm active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-955 font-bold rounded-2xl hover:from-amber-500 hover:to-amber-600 transition-all text-sm shadow-xl shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <IoSaveOutline size={16} /> Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CONFIRMAÇÃO EXCLUSÃO CUSTOMIZADO */}
        {deleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999999] px-4 animate-fadeIn" onClick={() => { setDeleteConfirmOpen(false); setEntregadorToDelete(null); }}>
                <div className="bg-white border border-slate-150/40 rounded-[2.2rem] p-8 w-full max-w-md shadow-2xl relative transition-all duration-300" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <IoAlertCircle size={32} />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
                            Excluir Entregador?
                        </h2>
                        <p className="text-sm text-slate-500 mb-8 px-4 leading-relaxed">
                            Tem certeza que deseja remover este entregador da sua equipe? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex gap-4 w-full">
                            <button type="button" onClick={() => { setDeleteConfirmOpen(false); setEntregadorToDelete(null); }} 
                                className="flex-1 py-4 bg-white border border-gray-250 text-slate-700 hover:bg-gray-50 rounded-full font-bold text-sm transition-all active:scale-95">
                                Cancelar
                            </button>
                            <button type="button" onClick={confirmarExcluir} 
                                className="flex-1 py-4 bg-red-650 hover:bg-red-500 text-white rounded-full font-bold text-sm shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>

      <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          * { font-family: 'Inter', -apple-system, system-ui, sans-serif; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          
          @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
          }
          .animate-fadeIn {
              animation: fadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
      `}</style>
    </div>
  );
}

export default withEstablishmentAuth(AdminEntregadores);