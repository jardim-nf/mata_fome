// src/components/AdminPlansManagement.jsx
import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-toastify';

function AdminPlansManagement() {
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
    corDestaque: '#3B82F6', // Cor padrão azul
    icone: '📊' // Ícone padrão
  });

  // Ícones disponíveis para os planos
  const availableIcons = [
    '📊', '🚀', '⭐', '👑', '💎', '🔧', '🛡️', '⚡', '🎯', '🌟',
    '💼', '🔑', '🎨', '📈', '🔔', '🔄', '📱', '💻', '🌐', '🔒'
  ];

  // Cores disponíveis para os planos
  const availableColors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  // Carregar planos em tempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'plans'), (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPlans(plansData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSavePlan = async (e) => {
    e.preventDefault();
    try {
      // Preparar dados para salvar
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
        toast.success('🎉 Plano atualizado com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'plans'), planToSave);
        toast.success('🚀 Plano criado com sucesso!');
      }

      // Limpar formulário e fechar modal
      setShowModal(false);
      setEditingPlan(null);
      setFormData({
        nome: '',
        descricao: '',
        preco: '',
        duracao: '',
        recursos: [],
        ativo: true,
        corDestaque: '#3B82F6',
        icone: '📊'
      });
    } catch (error) {
      console.error('Erro ao salvar plano:', error);
      toast.error('❌ Erro ao salvar plano: ' + error.message);
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
      corDestaque: plan.corDestaque || '#3B82F6',
      icone: plan.icone || '📊',
      createdAt: plan.createdAt
    });
    setShowModal(true);
  };

  const handleDelete = async (planId) => {
    if (window.confirm('Tem certeza que deseja excluir este plano?')) {
      try {
        await deleteDoc(doc(db, 'plans', planId));
        toast.success('🗑️ Plano excluído com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir plano:', error);
        toast.error('❌ Erro ao excluir plano: ' + error.message);
      }
    }
  };

  const addRecurso = () => {
    setFormData({
      ...formData,
      recursos: [...formData.recursos, '']
    });
  };

  const updateRecurso = (index, value) => {
    const novosRecursos = [...formData.recursos];
    novosRecursos[index] = value;
    setFormData({
      ...formData,
      recursos: novosRecursos
    });
  };

  const removeRecurso = (index) => {
    const novosRecursos = formData.recursos.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      recursos: novosRecursos
    });
  };

  const handleNewPlan = () => {
    setEditingPlan(null);
    setFormData({
      nome: '',
      descricao: '',
      preco: '',
      duracao: '',
      recursos: [],
      ativo: true,
      corDestaque: '#3B82F6',
      icone: '📊'
    });
    setShowModal(true);
  };

  // Função para obter cor de texto baseada na cor de fundo
  const getTextColor = (bgColor) => {
    const color = bgColor.replace('#', '');
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho Premium */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl shadow-2xl mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Gerenciar Planos
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Crie e personalize planos de assinatura para seus estabelecimentos com recursos exclusivos
          </p>
        </div>

        {/* Botão de Ação Principal */}
        <div className="flex justify-center mb-12">
          <button
            onClick={handleNewPlan}
            className="group relative bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
            <span className="flex items-center gap-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Criar Novo Plano
            </span>
          </button>
        </div>

        {/* Grid de Planos Premium */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-12">
          {plans.map(plan => (
            <div 
              key={plan.id} 
              className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden border border-gray-100"
            >
              {/* Header com Gradiente */}
              <div 
                className="h-4"
                style={{ 
                  background: plan.corDestaque || '#3B82F6',
                  backgroundImage: `linear-gradient(135deg, ${plan.corDestaque} 0%, ${plan.corDestaque}99 100%)`
                }}
              ></div>
              
              <div className="p-8">
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
                      style={{ 
                        backgroundColor: plan.corDestaque || '#3B82F6',
                        color: getTextColor(plan.corDestaque || '#3B82F6')
                      }}
                    >
                      {plan.icone || '📊'}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">{plan.nome}</h3>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                          plan.ativo 
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {plan.ativo ? '✅ Ativo' : '❌ Inativo'}
                        </span>
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {plan.duracao} dias
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Menu de Ações */}
                  <div className="relative">
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    <div className="absolute right-0 top-10 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-10">
                      <button
                        onClick={() => handleEdit(plan)}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors duration-200 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar Plano
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="w-full text-left px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-200 flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>

                {/* Descrição */}
                {plan.descricao && (
                  <p className="text-gray-600 text-lg mb-6 leading-relaxed">{plan.descricao}</p>
                )}

                {/* Preço */}
                <div className="mb-8 text-center">
                  <div className="inline-flex items-baseline bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    <span className="text-4xl font-bold">R$ </span>
                    <span className="text-5xl font-black mx-1">
                      {typeof plan.preco === 'number' ? plan.preco.toFixed(2).replace('.', ',') : '0,00'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-lg mt-2">por ciclo de {plan.duracao} dias</p>
                </div>

                {/* Recursos */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    🎯 Recursos Incluídos
                  </h4>
                  <div className="space-y-3">
                    {plan.recursos && plan.recursos.length > 0 ? (
                      plan.recursos.slice(0, 5).map((recurso, index) => (
                        <div key={index} className="flex items-center text-base text-gray-700">
                          <div 
                            className="w-2 h-2 rounded-full mr-3 flex-shrink-0"
                            style={{ backgroundColor: plan.corDestaque || '#3B82F6' }}
                          ></div>
                          {recurso}
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center italic py-4">Nenhum recurso definido</p>
                    )}
                    {plan.recursos && plan.recursos.length > 5 && (
                      <p className="text-center text-gray-500 text-sm bg-gray-50 py-2 rounded-lg">
                        +{plan.recursos.length - 5} recursos adicionais
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer do Card */}
              <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
                <div className="text-sm text-gray-500 flex items-center justify-between">
                  <span>🕐 Criado em: {plan.createdAt?.toDate ? plan.createdAt.toDate().toLocaleDateString('pt-BR') : 'N/A'}</span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                    plan.ativo ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
                  }`}>
                    {plan.ativo ? 'DISPONÍVEL' : 'INDISPONÍVEL'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Estado Vazio Premium */}
        {plans.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl shadow-xl border border-gray-200">
            <div className="w-32 h-32 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-16 h-16 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Nenhum plano criado</h3>
            <p className="text-xl text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
              Comece criando seu primeiro plano personalizado para oferecer aos estabelecimentos
            </p>
            <button
              onClick={handleNewPlan}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
            >
              🚀 Criar Primeiro Plano
            </button>
          </div>
        )}

        {/* Modal Premium */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200">
              {/* Header do Modal */}
              <div className="p-8 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-3xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-xl">
                    {editingPlan ? '✏️' : '🚀'}
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      {editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}
                    </h2>
                    <p className="text-gray-600 text-lg mt-1">
                      {editingPlan ? 'Atualize os detalhes do seu plano' : 'Configure um novo plano personalizado'}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSavePlan} className="p-8 space-y-8">
                {/* Informações Básicas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Nome e Descrição */}
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="nome" className="block text-lg font-semibold text-gray-900 mb-3">
                        Nome do Plano *
                      </label>
                      <input
                        type="text"
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({...formData, nome: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200"
                        placeholder="Ex: Plano Premium, Plano Empresarial..."
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="descricao" className="block text-lg font-semibold text-gray-900 mb-3">
                        Descrição
                      </label>
                      <textarea
                        id="descricao"
                        value={formData.descricao}
                        onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-2xl px-6 py-4 text-lg focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200 resize-none"
                        rows="4"
                        placeholder="Descreva os benefícios e características deste plano..."
                      />
                    </div>
                  </div>

                  {/* Personalização */}
                  <div className="space-y-6">
                    {/* Ícone */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-3">
                        Ícone do Plano
                      </label>
                      <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200">
                        {availableIcons.map((icon, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setFormData({...formData, icone: icon})}
                            className={`w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-all duration-200 ${
                              formData.icone === icon 
                                ? 'bg-indigo-500 text-white shadow-lg transform scale-110' 
                                : 'bg-white text-gray-600 hover:bg-gray-100 hover:scale-105'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cor de Destaque */}
                    <div>
                      <label className="block text-lg font-semibold text-gray-900 mb-3">
                        Cor de Destaque
                      </label>
                      <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 rounded-2xl border-2 border-gray-200">
                        {availableColors.map((color, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setFormData({...formData, corDestaque: color})}
                            className={`w-12 h-12 rounded-xl transition-all duration-200 border-4 ${
                              formData.corDestaque === color 
                                ? 'scale-110 shadow-lg border-white ring-2 ring-gray-400' 
                                : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preço e Duração */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label htmlFor="preco" className="block text-lg font-semibold text-gray-900 mb-3">
                      Preço (R$) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 transform -translate-y-1/2 text-2xl text-gray-500">R$</span>
                      <input
                        type="number"
                        id="preco"
                        step="0.01"
                        min="0"
                        value={formData.preco}
                        onChange={(e) => setFormData({...formData, preco: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-2xl px-16 py-4 text-2xl font-bold focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200"
                        placeholder="0,00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="duracao" className="block text-lg font-semibold text-gray-900 mb-3">
                      Duração (dias) *
                    </label>
                    <input
                      type="number"
                      id="duracao"
                      min="1"
                      value={formData.duracao}
                      onChange={(e) => setFormData({...formData, duracao: e.target.value})}
                      className="w-full border-2 border-gray-200 rounded-2xl px-6 py-4 text-2xl font-bold text-center focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-200"
                      placeholder="30"
                      required
                    />
                  </div>
                </div>

                {/* Recursos */}
                <div>
                  <label className="block text-lg font-semibold text-gray-900 mb-4">
                    🎯 Recursos do Plano
                  </label>
                  <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border-2 border-gray-200">
                    {formData.recursos.map((recurso, index) => (
                      <div key={index} className="flex gap-4 items-center">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: formData.corDestaque }}
                        ></div>
                        <input
                          type="text"
                          value={recurso}
                          onChange={(e) => updateRecurso(index, e.target.value)}
                          className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                          placeholder="Ex: Pedidos ilimitados, Suporte 24/7..."
                        />
                        <button
                          type="button"
                          onClick={() => removeRecurso(index)}
                          className="bg-red-100 text-red-600 p-3 rounded-xl hover:bg-red-200 transition-colors duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addRecurso}
                      className="flex items-center gap-3 text-indigo-600 hover:text-indigo-700 font-semibold text-lg p-4 rounded-xl hover:bg-white transition-all duration-200"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Adicionar Recurso
                    </button>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border-2 border-gray-200">
                  <div>
                    <label htmlFor="ativo" className="block text-lg font-semibold text-gray-900 mb-2">
                      Status do Plano
                    </label>
                    <p className="text-gray-600">
                      Planos ativos ficam disponíveis para novos estabelecimentos
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id="ativo"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Ações */}
                <div className="flex gap-4 pt-8 border-t border-gray-200">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-5 px-8 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
                  >
                    {editingPlan ? '💾 Atualizar Plano' : '🚀 Criar Plano'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingPlan(null);
                      setFormData({
                        nome: '',
                        descricao: '',
                        preco: '',
                        duracao: '',
                        recursos: [],
                        ativo: true,
                        corDestaque: '#3B82F6',
                        icone: '📊'
                      });
                    }}
                    className="flex-1 bg-gray-500 text-white py-5 px-8 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:bg-gray-600 transition-all duration-300"
                  >
                    ❌ Cancelar
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

export default AdminPlansManagement;