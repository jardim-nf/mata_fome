import React, { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { IoColorPalette, IoBrush, IoText, IoArrowBack, IoSaveOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

const AdminColorSettings = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cores, setCores] = useState({
    primaria: '#DC2626',
    secundaria: '#991B1B',
    destaque: '#059669',
    background: '#000000',
    texto: {
      principal: '#FFFFFF',
      secundario: '#9CA3AF',
      placeholder: '#6B7280',
      destaque: '#FBBF24',
      erro: '#EF4444',
      sucesso: '#10B981'
    }
  });

  // Identificar estabelecimento
  const estabelecimentosGerenciados = useMemo(() => {
    return userData?.estabelecimentosGerenciados || [];
  }, [userData]);

  const primeiroEstabelecimento = estabelecimentosGerenciados[0];

  // Carregar Cores Atuais
  useEffect(() => {
    if (primeiroEstabelecimento) {
      const fetchColors = async () => {
        try {
          const docRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().cores) {
            // Mescla as cores salvas com o estado inicial para garantir que novos campos (como texto) existam
            setCores(prev => ({
              ...prev,
              ...docSnap.data().cores,
              texto: {
                ...prev.texto,
                ...(docSnap.data().cores.texto || {})
              }
            }));
          }
        } catch (error) {
          console.error("Erro ao buscar cores:", error);
          toast.error("Erro ao carregar configurações de cores.");
        } finally {
          setLoading(false);
        }
      };
      fetchColors();
    }
  }, [primeiroEstabelecimento]);

  // Salvar Cores
  const handleSaveColors = async () => {
    if (!primeiroEstabelecimento) return;
    setSaving(true);

    try {
      const estabRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
      await updateDoc(estabRef, {
        cores: cores,
        atualizadoEm: serverTimestamp()
      });
      toast.success("🎨 Identidade visual atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar as cores.");
    } finally {
      setSaving(false);
    }
  };

  // Função auxiliar para atualizar estado aninhado
  const updateColor = (key, value) => {
    setCores(prev => ({ ...prev, [key]: value }));
  };

  const updateTextColor = (key, value) => {
    setCores(prev => ({
      ...prev,
      texto: { ...prev.texto, [key]: value }
    }));
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header da Página */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <IoArrowBack size={24} />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center">
                <IoColorPalette className="mr-3 text-blue-600" />
                Identidade Visual
              </h1>
              <p className="text-gray-500 text-sm mt-1">Personalize as cores do seu cardápio digital</p>
            </div>
          </div>
          
          <button
            onClick={handleSaveColors}
            disabled={saving}
            className="hidden md:flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
          >
            {saving ? (
               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <IoSaveOutline size={20} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Coluna da Esquerda: Controles */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Cores Principais */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <IoBrush className="mr-2 text-purple-500" />
                Cores Principais
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Cor Primária</label>
                  <div className="flex items-center space-x-2">
                    <input type="color" value={cores.primaria} onChange={(e) => updateColor('primaria', e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
                    <input type="text" value={cores.primaria} onChange={(e) => updateColor('primaria', e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 text-sm uppercase" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Botões principais, ícones, destaques.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Cor de Destaque</label>
                  <div className="flex items-center space-x-2">
                    <input type="color" value={cores.destaque} onChange={(e) => updateColor('destaque', e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
                    <input type="text" value={cores.destaque} onChange={(e) => updateColor('destaque', e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 text-sm uppercase" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Promoções, avisos importantes.</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Cor de Fundo</label>
                  <div className="flex items-center space-x-2">
                    <input type="color" value={cores.background} onChange={(e) => updateColor('background', e.target.value)} className="h-10 w-10 rounded cursor-pointer border-0" />
                    <input type="text" value={cores.background} onChange={(e) => updateColor('background', e.target.value)} className="flex-1 border border-gray-300 rounded-lg p-2 text-sm uppercase" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Fundo geral do aplicativo.</p>
                </div>
              </div>
            </div>

            {/* Tipografia / Cores de Texto */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
               <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <IoText className="mr-2 text-blue-500" />
                Cores do Texto
              </h3>
              <div className="space-y-4">
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Principal</label>
                        <input type="color" value={cores.texto.principal} onChange={(e) => updateTextColor('principal', e.target.value)} className="flex-col sm:flex-row h-8 rounded cursor-pointer" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Secundário</label>
                        <input type="color" value={cores.texto.secundario} onChange={(e) => updateTextColor('secundario', e.target.value)} className="flex-col sm:flex-row h-8 rounded cursor-pointer" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Preço/Destaque</label>
                        <input type="color" value={cores.texto.destaque} onChange={(e) => updateTextColor('destaque', e.target.value)} className="flex-col sm:flex-row h-8 rounded cursor-pointer" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">Placeholder</label>
                        <input type="color" value={cores.texto.placeholder} onChange={(e) => updateTextColor('placeholder', e.target.value)} className="flex-col sm:flex-row h-8 rounded cursor-pointer" />
                    </div>
                </div>
              </div>
            </div>

            {/* Botão Salvar Mobile */}
            <button
                onClick={handleSaveColors}
                disabled={saving}
                className="md:hidden flex-col sm:flex-row flex justify-center items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg"
            >
                {saving ? <span>Salvando...</span> : <span>Salvar Configurações</span>}
            </button>
          </div>

          {/* Coluna da Direita: Preview em Tempo Real */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Preview em Tempo Real</h3>
                
                {/* Simulação da Tela do Celular */}
                <div className="max-w-[375px] mx-auto border-8 border-gray-800 rounded-[3rem] overflow-hidden shadow-2xl h-[600px] relative">
                    {/* Status Bar Fake */}
                    <div className="bg-black h-6 flex-col sm:flex-row absolute top-0 z-20"></div>
                    
                    {/* Conteúdo do App Simulado */}
                    <div className="h-full overflow-y-auto pb-10" style={{ backgroundColor: cores.background }}>
                        
                        {/* Header do App */}
                        <div className="p-6 pt-10">
                            <h2 className="text-2xl font-bold mb-1" style={{ color: cores.texto.principal }}>Olá, Cliente! 👋</h2>
                            <p className="text-sm" style={{ color: cores.texto.secundario }}>O que vamos comer hoje?</p>
                        </div>

                        {/* Barra de Busca */}
                        <div className="px-6 mb-6">
                            <div className="rounded-xl p-3 flex items-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: `1px solid ${cores.texto.secundario}40` }}>
                                <span className="mr-2" style={{ color: cores.texto.placeholder }}>🔍</span>
                                <span className="text-sm" style={{ color: cores.texto.placeholder }}>Buscar pratos...</span>
                            </div>
                        </div>

                        {/* Categorias */}
                        <div className="px-6 mb-6 flex space-x-3 overflow-x-auto hide-scrollbar">
                            <div className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap" style={{ backgroundColor: cores.primaria, color: '#FFFFFF' }}>
                                Todos
                            </div>
                            <div className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border" style={{ borderColor: `${cores.texto.secundario}40`, color: cores.texto.secundario }}>
                                Burguers
                            </div>
                            <div className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border" style={{ borderColor: `${cores.texto.secundario}40`, color: cores.texto.secundario }}>
                                Bebidas
                            </div>
                        </div>

                        {/* Card de Produto */}
                        <div className="px-6 space-y-4">
                            {/* Item 1 */}
                            <div className="rounded-2xl p-4 flex items-center space-x-4 relative overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${cores.texto.secundario}20` }}>
                                <div className="w-20 h-20 rounded-xl bg-gray-300 flex-shrink-0"></div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-base mb-1" style={{ color: cores.texto.principal }}>X-Burger Especial</h3>
                                    <p className="text-xs mb-2 line-clamp-2" style={{ color: cores.texto.secundario }}>Pão brioche, blend 180g, queijo cheddar e bacon.</p>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold" style={{ color: cores.texto.destaque }}>R$ 28,90</span>
                                        <button className="p-2 rounded-lg" style={{ backgroundColor: cores.primaria, color: '#FFFFFF' }}>
                                            +
                                        </button>
                                    </div>
                                </div>
                                {/* Tag Promoção */}
                                <div className="absolute top-0 right-0 px-2 py-1 text-[10px] font-bold rounded-bl-xl" style={{ backgroundColor: cores.destaque, color: '#FFFFFF' }}>
                                    PROMO
                                </div>
                            </div>

                             {/* Item 2 */}
                             <div className="rounded-2xl p-4 flex items-center space-x-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${cores.texto.secundario}20` }}>
                                <div className="w-20 h-20 rounded-xl bg-gray-300 flex-shrink-0"></div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-base mb-1" style={{ color: cores.texto.principal }}>Coca-Cola Lata</h3>
                                    <p className="text-xs mb-2" style={{ color: cores.texto.secundario }}>350ml gelada.</p>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold" style={{ color: cores.texto.destaque }}>R$ 6,00</span>
                                        <button className="p-2 rounded-lg" style={{ backgroundColor: cores.primaria, color: '#FFFFFF' }}>
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Bar */}
                        <div className="absolute bottom-0 flex-col sm:flex-row p-4 bg-white/10 backdrop-blur-md border-t border-white/10">
                             <div className="flex-col sm:flex-row h-12 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: cores.primaria, color: '#FFFFFF' }}>
                                Ver Sacola (R$ 0,00)
                             </div>
                        </div>

                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withEstablishmentAuth(AdminColorSettings);