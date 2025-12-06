import React, { useState, useEffect } from 'react';
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
  IoEllipse
} from 'react-icons/io5';

// Componente Card de Entregador
const EntregadorCard = ({ entregador, onEdit, onDelete, onToggleStatus }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col justify-between hover:shadow-md transition-all">
    <div>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-xl ${entregador.ativo ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
            <IoBicycle className="text-2xl" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">{entregador.nome}</h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center w-fit mt-1 ${entregador.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <IoEllipse className="w-2 h-2 mr-1" />
              {entregador.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-gray-600 text-sm">
          <IoCall className="mr-2 text-gray-400" />
          {entregador.telefone || 'Sem telefone'}
        </div>
        {entregador.placa && (
          <div className="flex items-center text-gray-600 text-sm">
            <IoIdCard className="mr-2 text-gray-400" />
            Placa: <span className="font-mono font-bold ml-1 bg-gray-100 px-1 rounded">{entregador.placa.toUpperCase()}</span>
          </div>
        )}
        {entregador.taxaFixa > 0 && (
          <div className="flex items-center text-gray-600 text-sm">
            <span className="font-bold mr-1">R$</span> Taxa Sugerida: {Number(entregador.taxaFixa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        )}
      </div>
    </div>

    <div className="flex gap-2 pt-4 border-t border-gray-100">
      <button 
        onClick={() => onToggleStatus(entregador)}
        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${entregador.ativo ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
      >
        {entregador.ativo ? 'Desativar' : 'Ativar'}
      </button>
      <button 
        onClick={() => onEdit(entregador)}
        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        title="Editar"
      >
        <IoPencil />
      </button>
      <button 
        onClick={() => onDelete(entregador.id)}
        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        title="Excluir"
      >
        <IoTrash />
      </button>
    </div>
  </div>
);

function AdminEntregadores() {
  const { estabelecimentosGerenciados } = useAuth();
  const estabelecimentoId = estabelecimentosGerenciados?.[0];

  const [entregadores, setEntregadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    placa: '',
    taxaFixa: '', // ✅ Campo opcional para taxa sugerida
    ativo: true
  });

  // Listener para buscar entregadores
  useEffect(() => {
    if (!estabelecimentoId) return;

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

  const handleOpenModal = (entregador = null) => {
    if (entregador) {
      setEditingId(entregador.id);
      setFormData({
        nome: entregador.nome,
        telefone: entregador.telefone || '',
        placa: entregador.placa || '',
        taxaFixa: entregador.taxaFixa || '',
        ativo: entregador.ativo
      });
    } else {
      setEditingId(null);
      setFormData({
        nome: '',
        telefone: '',
        placa: '',
        taxaFixa: '', // ✅ Campo opcional
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
        taxaFixa: formData.taxaFixa ? Number(formData.taxaFixa) : 0, // ✅ Salva como número
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

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este entregador?")) return;
    try {
      await deleteDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'entregadores', id));
      toast.success("Entregador removido.");
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

  const handleToggleStatus = async (entregador) => {
    try {
      await updateDoc(doc(db, 'estabelecimentos', estabelecimentoId, 'entregadores', entregador.id), {
        ativo: !entregador.ativo
      });
      toast.success(`Entregador ${!entregador.ativo ? 'ativado' : 'desativado'}!`);
    } catch (error) {
      toast.error("Erro ao alterar status.");
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <IoBicycle className="text-orange-600" />
              Gestão de Entregadores
            </h1>
            <p className="text-gray-500 mt-1">Cadastre e gerencie sua equipe de entregas</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-orange-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-700 transition-all active:scale-95"
          >
            <IoAdd className="text-xl" /> Novo Entregador
          </button>
        </div>

        {/* Lista */}
        {entregadores.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm">
            <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <IoBicycle className="text-4xl text-orange-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-400">Nenhum entregador cadastrado</h3>
            <p className="text-gray-400 text-sm mt-2">Clique em "Novo Entregador" para começar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {entregadores.map(entregador => (
              <EntregadorCard 
                key={entregador.id} 
                entregador={entregador} 
                onEdit={handleOpenModal}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
              <div className="bg-orange-600 p-6 flex justify-between items-center">
                <h3 className="text-white text-xl font-bold flex items-center gap-2">
                  {editingId ? <IoPencil /> : <IoAdd />}
                  {editingId ? 'Editar Entregador' : 'Novo Entregador'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                  <IoClose size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo *</label>
                  <div className="relative">
                    <IoPerson className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="Ex: João da Silva"
                      value={formData.nome}
                      onChange={e => setFormData({...formData, nome: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <IoCall className="absolute left-3 top-3 text-gray-400" />
                    <input 
                      type="tel" 
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                      placeholder="(00) 00000-0000"
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Placa (Opcional)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none uppercase"
                      placeholder="ABC-1234"
                      value={formData.placa}
                      onChange={e => setFormData({...formData, placa: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Taxa Sugerida (R$)</label>
                    <input 
                      type="number" 
                      step="0.50"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="0.00 (opcional)"
                      value={formData.taxaFixa}
                      onChange={e => setFormData({...formData, taxaFixa: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mt-2">
                  <input 
                    type="checkbox" 
                    id="ativoCheck"
                    checked={formData.ativo}
                    onChange={e => setFormData({...formData, ativo: e.target.checked})}
                    className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                  />
                  <label htmlFor="ativoCheck" className="text-gray-700 font-medium cursor-pointer select-none">
                    Entregador Ativo
                  </label>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 transition-colors shadow-lg shadow-orange-200"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default withEstablishmentAuth(AdminEntregadores);