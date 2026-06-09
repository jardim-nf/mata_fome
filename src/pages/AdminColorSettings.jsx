import React, { useState, useEffect, useMemo } from 'react';
import BackButton from '../components/BackButton';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import withEstablishmentAuth from '../hocs/withEstablishmentAuth';
import { 
  IoColorPalette, IoBrush, IoText, IoSaveOutline, 
  IoColorWandOutline, IoCheckmarkCircle, IoInformationCircleOutline,
  IoSparkles, IoChevronDownOutline
} from 'react-icons/io5';

// 🌈 Temas Predefinidos Premium
const PRESET_THEMES = [
  {
    id: 'matafome_classic',
    nome: 'Mata Fome Clássico',
    descricao: 'Energia gastronômica tradicional do delivery.',
    cores: {
      primaria: '#EA1D2C',
      secundaria: '#991B1B',
      destaque: '#FBBF24',
      background: '#FFFFFF',
      texto: {
        principal: '#111827',
        secundario: '#4B5563',
        placeholder: '#9CA3AF',
        destaque: '#D97706',
        erro: '#EF4444',
        sucesso: '#10B981'
      }
    }
  },
  {
    id: 'midnight_emerald',
    nome: 'Esmeralda Elegante',
    descricao: 'Sofisticado, fresco e focado na saudabilidade.',
    cores: {
      primaria: '#059669',
      secundaria: '#065F46',
      destaque: '#10B981',
      background: '#F8FAFC',
      texto: {
        principal: '#0F172A',
        secundario: '#475569',
        placeholder: '#94A3B8',
        destaque: '#047857',
        erro: '#EF4444',
        sucesso: '#10B981'
      }
    }
  },
  {
    id: 'sweet_berry',
    nome: 'Doce Framboesa',
    descricao: 'Visual moderno, descontraído e vibrante.',
    cores: {
      primaria: '#DB2777',
      secundaria: '#9D174D',
      destaque: '#7C3AED',
      background: '#FFFDFE',
      texto: {
        principal: '#1E1B4B',
        secundario: '#5C2D91',
        placeholder: '#A78BFA',
        destaque: '#BE185D',
        erro: '#EF4444',
        sucesso: '#10B981'
      }
    }
  },
  {
    id: 'ocean_breeze',
    nome: 'Brisa do Oceano',
    descricao: 'Calmo, limpo e extremamente profissional.',
    cores: {
      primaria: '#2563EB',
      secundaria: '#1E40AF',
      destaque: '#06B6D4',
      background: '#F1F5F9',
      texto: {
        principal: '#0F172A',
        secundario: '#334155',
        placeholder: '#64748B',
        destaque: '#1D4ED8',
        erro: '#EF4444',
        sucesso: '#10B981'
      }
    }
  }
];

const AdminColorSettings = () => {
  const { userData, estabelecimentoIdPrincipal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cores, setCores] = useState({
    primaria: '#EA1D2C',
    secundaria: '#991B1B',
    destaque: '#FBBF24',
    background: '#FFFFFF',
    texto: {
      principal: '#111827',
      secundario: '#4B5563',
      placeholder: '#9CA3AF',
      destaque: '#D97706',
      erro: '#EF4444',
      sucesso: '#10B981'
    }
  });

  const primeiroEstabelecimento = estabelecimentoIdPrincipal || userData?.estabelecimentoId || userData?.estabelecimentosGerenciados?.[0];

  // Carregar Cores Atuais
  useEffect(() => {
    if (primeiroEstabelecimento) {
      const fetchColors = async () => {
        try {
          const docRef = doc(db, 'estabelecimentos', primeiroEstabelecimento);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists() && docSnap.data().cores) {
            const dataCores = docSnap.data().cores;
            setCores({
              primaria: dataCores.primaria || '#EA1D2C',
              secundaria: dataCores.secundaria || '#991B1B',
              destaque: dataCores.destaque || '#FBBF24',
              background: dataCores.background || '#FFFFFF',
              texto: {
                principal: dataCores.texto?.principal || '#111827',
                secundario: dataCores.texto?.secundario || '#4B5563',
                placeholder: dataCores.texto?.placeholder || '#9CA3AF',
                destaque: dataCores.texto?.destaque || '#D97706',
                erro: dataCores.texto?.erro || '#EF4444',
                sucesso: dataCores.texto?.sucesso || '#10B981'
              }
            });
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

      // 🚀 Limpar cache local do cardápio para forçar o recarregamento imediato
      Object.keys(localStorage)
        .filter(key => key.startsWith('mf_cardapio_cache_'))
        .forEach(key => localStorage.removeItem(key));

      toast.success("🎨 Identidade visual atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar as cores.");
    } finally {
      setSaving(false);
    }
  };

  // Funções de Update
  const updateColor = (key, value) => {
    setCores(prev => ({ ...prev, [key]: value }));
  };

  const updateTextColor = (key, value) => {
    setCores(prev => ({
      ...prev,
      texto: { ...prev.texto, [key]: value }
    }));
  };

  // Comparação de Preset Ativo
  const activePresetId = useMemo(() => {
    const match = PRESET_THEMES.find(preset => 
      preset.cores.primaria.toLowerCase() === cores.primaria.toLowerCase() &&
      preset.cores.background.toLowerCase() === cores.background.toLowerCase() &&
      preset.cores.destaque.toLowerCase() === cores.destaque.toLowerCase() &&
      preset.cores.texto.principal.toLowerCase() === cores.texto.principal.toLowerCase()
    );
    return match ? match.id : null;
  }, [cores]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-amber-400/5 rounded-full blur-[140px] pointer-events-none"></div>
        <div className="text-center relative z-10">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-bold">Carregando identidade visual...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f8fa] via-[#eef2f6] to-[#f6f8fa] p-4 sm:p-6 lg:p-8 font-sans pb-32 relative overflow-hidden transition-colors duration-300">
      
      {/* ─── NEBULA GLOWS ─── */}
      <div className="absolute top-[-10%] left-[-15%] w-[600px] h-[600px] bg-pink-400/15 rounded-full blur-[140px] pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[550px] h-[550px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"></div>
      <div className="absolute top-[30%] right-[30%] w-[400px] h-[400px] bg-purple-400/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-6">
        
        {/* Voltar */}
        <BackButton to="/admin" className="mb-4" />

        {/* Header da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-amber-955 shadow-lg shadow-amber-500/20">
                <IoColorPalette size={24} />
              </div>
              Identidade Visual
            </h1>
            <p className="text-slate-500 mt-2 ml-[60px] font-medium">Personalize e harmonize as cores do seu cardápio digital.</p>
          </div>
          
          <button
            onClick={handleSaveColors}
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-955 font-bold py-3.5 px-6 rounded-2xl transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-amber-500/20 disabled:opacity-50 border border-amber-400/30 shrink-0"
          >
            {saving ? (
               <div className="w-5 h-5 border-2 border-amber-955 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <IoSaveOutline size={18} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>

        {/* Info Alert Cache */}
        <div className="bg-blue-50/60 border border-blue-200/50 rounded-2xl p-4 flex gap-3 text-xs text-blue-700 font-semibold leading-relaxed">
          <IoInformationCircleOutline className="text-lg shrink-0 text-blue-500" />
          <p>As cores do cardápio são salvas instantaneamente. A limpeza de cache é executada automaticamente para que você e os clientes vejam as mudanças logo na próxima visita!</p>
        </div>

        {/* ─── SEÇÃO 1: TEMAS PREDEFINIDOS ─── */}
        <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
            <IoColorWandOutline className="text-pink-500" size={22} />
            Temas Predefinidos Premium
          </h3>
          <p className="text-slate-500 text-xs font-semibold mb-6">Escolha uma combinação balanceada desenvolvida por designers com um único clique.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRESET_THEMES.map(preset => {
              const isActive = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => setCores(preset.cores)}
                  className={`group text-left p-5 rounded-3xl border transition-all duration-300 hover:shadow-md hover:scale-[1.02] flex flex-col justify-between h-44 relative overflow-hidden ${
                    isActive 
                      ? 'bg-gradient-to-br from-amber-500/10 to-amber-400/5 border-amber-400 shadow-sm ring-1 ring-amber-400/30' 
                      : 'bg-white border-slate-200/60 hover:border-slate-350'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-black text-slate-800 text-sm leading-tight">{preset.nome}</p>
                      {isActive && <IoCheckmarkCircle className="text-amber-500 text-lg shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold leading-relaxed line-clamp-2">{preset.descricao}</p>
                  </div>
                  
                  {/* Cores mini grid */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100/80">
                    <span className="w-5 h-5 rounded-full border border-slate-200/50 shadow-inner" style={{ backgroundColor: preset.cores.primaria }} title="Primária" />
                    <span className="w-5 h-5 rounded-full border border-slate-200/50 shadow-inner" style={{ backgroundColor: preset.cores.destaque }} title="Destaque" />
                    <span className="w-5 h-5 rounded-full border border-slate-200/50 shadow-inner" style={{ backgroundColor: preset.cores.background }} title="Fundo" />
                    <span className="w-5 h-5 rounded-full border border-slate-200/50 shadow-inner" style={{ backgroundColor: preset.cores.texto.principal }} title="Texto" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── SEÇÃO 2: CUSTOMIZAÇÃO + PREVIEW ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Controles de Customização (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Cores Principais */}
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md">
              <h3 className="text-base font-black text-slate-800 mb-5 flex items-center gap-2">
                <IoBrush className="text-amber-500" size={18} />
                Estrutura e Destaques
              </h3>
              
              <div className="space-y-4">
                {/* Cor Primária */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Cor Primária *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.primaria} 
                      onChange={(e) => updateColor('primaria', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.primaria} 
                      onChange={(e) => updateColor('primaria', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Botões principais, ícones, destaques de abas.</p>
                </div>

                {/* Cor de Destaque */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Cor de Destaque *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.destaque} 
                      onChange={(e) => updateColor('destaque', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.destaque} 
                      onChange={(e) => updateColor('destaque', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Preços, tags de promoção, botão flutuante de carrinho.</p>
                </div>

                {/* Cor de Fundo */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Fundo do Cardápio *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.background} 
                      onChange={(e) => updateColor('background', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.background} 
                      onChange={(e) => updateColor('background', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Cor de fundo da tela do cliente.</p>
                </div>
              </div>
            </div>

            {/* Cores de Texto */}
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md">
              <h3 className="text-base font-black text-slate-800 mb-5 flex items-center gap-2">
                <IoText className="text-blue-500" size={18} />
                Tipografia e Conteúdo
              </h3>
              
              <div className="space-y-4">
                {/* Texto Principal */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Texto Principal *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.texto.principal} 
                      onChange={(e) => updateTextColor('principal', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.texto.principal} 
                      onChange={(e) => updateTextColor('principal', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Nomes de pratos, títulos principais.</p>
                </div>

                {/* Texto Secundário */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Texto Secundário *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.texto.secundario} 
                      onChange={(e) => updateTextColor('secundario', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.texto.secundario} 
                      onChange={(e) => updateTextColor('secundario', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Descrições, subtítulos, observações de itens.</p>
                </div>

                {/* Texto Preço/Destaque */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Preços e Badges de Destaque *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.texto.destaque} 
                      onChange={(e) => updateTextColor('destaque', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.texto.destaque} 
                      onChange={(e) => updateTextColor('destaque', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Cor dos textos de valores monetários na loja.</p>
                </div>

                {/* Texto Placeholder */}
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Texto Placeholder / Busca *</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={cores.texto.placeholder} 
                      onChange={(e) => updateTextColor('placeholder', e.target.value)} 
                      className="h-11 w-11 rounded-xl cursor-pointer border border-slate-200 shadow-inner shrink-0" 
                    />
                    <input 
                      type="text" 
                      value={cores.texto.placeholder} 
                      onChange={(e) => updateTextColor('placeholder', e.target.value)} 
                      className="flex-1 p-3 bg-white/60 hover:bg-white/80 border border-slate-200 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 rounded-xl text-xs font-bold text-slate-700 outline-none uppercase transition-all shadow-sm" 
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">Campos de busca e texto placeholder.</p>
                </div>
              </div>
            </div>

            {/* Botão Salvar Mobile */}
            <button
              onClick={handleSaveColors}
              disabled={saving}
              className="lg:hidden w-full py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-955 rounded-2xl font-bold text-sm transition-all transform active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 border border-amber-400/30"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>

          </div>

          {/* Simulador de Smartphone Premium (Col 7) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="bg-white/70 border border-slate-200/40 rounded-[2.2rem] p-6 shadow-sm backdrop-blur-md w-full sticky top-6">
              <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                <IoSparkles className="text-pink-500" />
                Visualização em Tempo Real (Menu)
              </h3>
              
              {/* iPhone Mockup Container */}
              <div className="max-w-[330px] mx-auto border-[10px] border-slate-900 rounded-[2.8rem] overflow-hidden shadow-2xl h-[560px] relative bg-slate-900">
                {/* Notch / Câmera */}
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-30 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800/80 ml-auto mr-4"></div>
                </div>
                
                {/* Reflexo de Vidro Fake */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 pointer-events-none z-25"></div>

                {/* Conteúdo do Cardápio Simulado */}
                <div className="h-full overflow-y-auto pb-20 scrollbar-none text-left relative" style={{ backgroundColor: cores.background }}>
                  
                  {/* Fake Status Bar Spacing */}
                  <div className="h-7 w-full"></div>

                  {/* Header do App */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border border-white/20">🍔</div>
                      <span className="text-[10px] font-black text-white bg-slate-800/80 border border-white/10 px-2 py-0.5 rounded-full">ABERTO</span>
                    </div>
                    <h2 className="text-xl font-black leading-tight" style={{ color: cores.texto.principal }}>Mata Fome Delivery</h2>
                    <p className="text-[11px] mt-1 font-bold" style={{ color: cores.texto.secundario }}>O melhor sabor da cidade na sua casa!</p>
                  </div>

                  {/* Barra de Busca */}
                  <div className="px-5 mb-5">
                    <div className="rounded-xl p-2.5 flex items-center bg-white/10 shadow-sm border border-slate-200/40" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }}>
                      <span className="mr-2 text-xs">🔍</span>
                      <span className="text-xs font-semibold" style={{ color: cores.texto.placeholder }}>Buscar pratos...</span>
                    </div>
                  </div>

                  {/* Categorias Filtros */}
                  <div className="px-5 mb-5 flex gap-2 overflow-x-auto scrollbar-none">
                    <div className="px-4 py-1.5 rounded-full text-xs font-black whitespace-nowrap shadow-sm" style={{ backgroundColor: cores.primaria, color: '#FFFFFF' }}>
                      Promoções
                    </div>
                    <div className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border" style={{ borderColor: `${cores.texto.secundario}30`, color: cores.texto.secundario, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      Lanches
                    </div>
                    <div className="px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border" style={{ borderColor: `${cores.texto.secundario}30`, color: cores.texto.secundario, backgroundColor: 'rgba(255,255,255,0.2)' }}>
                      Bebidas
                    </div>
                  </div>

                  {/* Lista de Pratos */}
                  <div className="px-5 space-y-3">
                    
                    {/* Item 1 */}
                    <div className="rounded-2xl p-3.5 flex gap-3 relative overflow-hidden bg-white/50 border border-slate-100 shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,200,200,0.15)' }}>
                      <div className="w-16 h-16 rounded-xl bg-slate-200 flex-shrink-0 flex items-center justify-center text-2xl shadow-inner">🍔</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-xs truncate" style={{ color: cores.texto.principal }}>X-Combo Supremo</h3>
                        <p className="text-[9px] line-clamp-2 mt-0.5" style={{ color: cores.texto.secundario }}>Pão brioche, hambúrguer 150g artesanal, queijo derretido e batata rústica.</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-black text-xs" style={{ color: cores.texto.destaque }}>R$ 34,90</span>
                          <button className="p-1 rounded-lg text-white shadow-sm flex items-center justify-center" style={{ backgroundColor: cores.primaria }}>
                            <span className="text-[10px] px-1 font-bold">Adicionar</span>
                          </button>
                        </div>
                      </div>
                      
                      {/* Tag Promo */}
                      <div className="absolute top-0 right-0 px-2 py-0.5 text-[8px] font-black rounded-bl-lg text-white" style={{ backgroundColor: cores.destaque }}>
                        OFERTA
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="rounded-2xl p-3.5 flex gap-3 bg-white/50 border border-slate-100 shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderColor: 'rgba(200,200,200,0.15)' }}>
                      <div className="w-16 h-16 rounded-xl bg-slate-200 flex-shrink-0 flex items-center justify-center text-2xl shadow-inner">🥤</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-extrabold text-xs truncate" style={{ color: cores.texto.principal }}>Suco Natural Citrus</h3>
                        <p className="text-[9px] line-clamp-2 mt-0.5" style={{ color: cores.texto.secundario }}>Suco natural refrescante de laranja com acerola, garrafa 400ml.</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-black text-xs" style={{ color: cores.texto.destaque }}>R$ 9,00</span>
                          <button className="p-1 rounded-lg text-white shadow-sm flex items-center justify-center" style={{ backgroundColor: cores.primaria }}>
                            <span className="text-[10px] px-1 font-bold">Adicionar</span>
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Bottom Checkout Bar */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-white/80 backdrop-blur-md border-slate-200/40 z-20">
                    <div className="w-full h-9 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-md shadow-slate-900/5 cursor-pointer" style={{ backgroundColor: cores.primaria }}>
                      Ver Sacola (2 itens)
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