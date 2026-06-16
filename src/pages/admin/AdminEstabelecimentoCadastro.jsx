import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext'; 
import { useAdminEstabelecimentoCadastroData } from '../../hooks/useAdminEstabelecimentoCadastroData';
import { FaArrowLeft, FaPlus, FaCheck, FaTimes, FaSun, FaMoon } from 'react-icons/fa';
import { FiHome, FiImage, FiSettings, FiPhone, FiMapPin } from 'react-icons/fi';

// Componente FormInput Premium
function FormInput({ label, name, value, onChange, type = 'text', helpText = '', required = false, theme = 'dark', t, ...props }) {
    const inputStyle = theme === 'dark' 
      ? "w-full rounded-2xl border border-white/5 bg-slate-950/75 px-4 py-3.5 text-white placeholder-slate-500 font-bold focus:outline-none focus:border-cyan-500/50 transition-all duration-300 font-space focus:ring-1 focus:ring-cyan-500/30 shadow-inner text-xs"
      : "w-full rounded-2xl border border-stone-200 bg-stone-100/75 px-4 py-3.5 text-stone-900 placeholder-stone-400 font-bold focus:outline-none focus:border-[#ff6b35] transition-all duration-300 font-space focus:ring-1 focus:ring-[#ff6b35]/30 shadow-inner text-xs";

    return (
        <div className="space-y-2 font-space">
            <label htmlFor={name} className={`block text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>
                {label} {required && <span className="text-rose-500 font-black">*</span>}
            </label>
            <input
                id={name}
                name={name}
                value={value || ''}
                onChange={onChange}
                type={type}
                required={required}
                className={inputStyle}
                {...props}
            />
            {helpText && <p className={`text-[10px] font-bold ${t.textMuted} mt-1`}>{helpText}</p>}
        </div>
    );
}

// Componente FormSection Premium
function FormSection({ title, children, icon, theme = 'dark', t }) {
    return (
        <div className={`rounded-[2rem] border p-8 shadow-xl relative overflow-hidden transition-all duration-300 ${t.cardBg} ${t.border}`}>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                {icon && (
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                      theme === 'dark' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-[#ff6b35]/10 border-[#ff6b35]/20 text-[#ff6b35]'
                    }`}>
                        {icon}
                    </div>
                )}
                <h2 className={`text-lg font-black tracking-tight font-bricolage ${t.text}`}>{title}</h2>
            </div>
            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
}

function AdminEstabelecimentoCadastro() {
    const navigate = useNavigate();
    const { currentUser, isMasterAdmin, loading: authLoading } = useAuth(); 

    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('dashboard_theme');
        return saved || 'dark';
    });

    // Carrega fontes customizadas
    useEffect(() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;650;700&display=swap';
        document.head.appendChild(link);
        return () => {
            document.head.removeChild(link);
        };
    }, []);

    // Sincroniza o tema entre abas do dashboard
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'dashboard_theme') {
                setTheme(e.newValue || 'dark');
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('dashboard_theme', newTheme);
    };

    const themeClasses = {
        dark: {
            bg: 'bg-[#080c16] bg-cyber-grid-dark text-slate-100',
            surface: 'bg-slate-955/45 backdrop-blur-xl border border-white/5 shadow-2xl',
            border: 'border-white/5',
            text: 'text-slate-100 font-space',
            textSecondary: 'text-slate-400 font-space font-medium',
            textMuted: 'text-slate-500 font-space font-semibold',
            accent: 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]',
            accentHover: 'hover:bg-cyan-600',
            gradient: 'from-cyan-400 via-violet-500 to-fuchsia-500',
            cardBg: 'bg-slate-950/30 backdrop-blur-xl border border-white/5 shadow-2xl',
            inputBg: 'bg-slate-950/75 border-white/5 focus-within:border-cyan-500/50',
            buttonBg: 'bg-slate-900/80 border-white/5 text-slate-350 hover:border-cyan-500/30 hover:text-white',
        },
        light: {
            bg: 'bg-[#fbfbfa] bg-cyber-grid-light text-stone-900',
            surface: 'bg-white/95 backdrop-blur-md border border-stone-200 shadow-md',
            border: 'border-stone-200',
            text: 'text-stone-900 font-space font-bold',
            textSecondary: 'text-stone-750 font-space font-medium',
            textMuted: 'text-stone-400 font-space font-semibold',
            accent: 'bg-[#ff6b35] shadow-sm',
            accentHover: 'hover:bg-[#e85a2a]',
            gradient: 'from-[#ff6b35] via-amber-500 to-[#e85a2a]',
            cardBg: 'bg-[#f5f5f4]/80 backdrop-blur-md border border-stone-200 shadow-sm',
            inputBg: 'bg-stone-100/70 border-stone-200 focus-within:border-[#ff6b35]',
            buttonBg: 'bg-white border-stone-200 text-stone-700 hover:border-stone-400 hover:text-black',
        }
    };

    const t = themeClasses[theme];

    const {
        formData, handleInputChange, logoPreview,
        availableAdmins, availablePlans,
        loadingForm, loadingAdmins, loadingPlans, formError,
        handleSubmit
    } = useAdminEstabelecimentoCadastroData(currentUser, isMasterAdmin, authLoading, navigate);

    const selectStyle = theme === 'dark'
        ? "w-full rounded-2xl border border-white/5 bg-slate-950/75 px-4 py-3.5 text-white placeholder-slate-500 font-bold focus:outline-none focus:border-cyan-500/50 transition-all duration-300 font-space focus:ring-1 focus:ring-cyan-500/30 cursor-pointer text-xs"
        : "w-full rounded-2xl border border-stone-200 bg-stone-100/75 px-4 py-3.5 text-stone-900 placeholder-stone-400 font-bold focus:outline-none focus:border-[#ff6b35] transition-all duration-300 font-space focus:ring-1 focus:ring-[#ff6b35]/30 cursor-pointer text-xs";

    if (authLoading || loadingAdmins || loadingPlans) {
        return (
            <div className={`min-h-screen bg-[#080d19] flex items-center justify-center font-sans`}>
                <div className="flex flex-col items-center gap-4">
                    <div className="relative w-14 h-14">
                        <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider text-slate-400 font-space">Carregando Formulário...</p>
                </div>
            </div>
        );
    }

    if (!isMasterAdmin) return null;

    return (
        <div className={`min-h-screen ${t.bg} transition-colors duration-500 relative overflow-hidden pb-24 pt-4 px-4 sm:px-8 font-space`}>
            
            {/* Estilos e Variáveis Injetadas */}
            <style>{`
                .font-bricolage {
                    font-family: 'Bricolage Grotesque', sans-serif !important;
                }
                .font-space {
                    font-family: 'Space Grotesk', sans-serif !important;
                }
                .font-mono-jb {
                    font-family: 'JetBrains Mono', monospace !important;
                }
                .bg-cyber-grid-dark {
                    background-image: 
                        linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
                    background-size: 40px 40px;
                }
                .bg-cyber-grid-light {
                    background-image: 
                        linear-gradient(to right, rgba(28, 25, 23, 0.018) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(28, 25, 23, 0.018) 1px, transparent 1px);
                    background-size: 40px 40px;
                }
            `}</style>

            {/* Esferas de luz ambiente flutuantes */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    animate={{
                        x: [0, 50, -30, 0],
                        y: [0, -60, 30, 0],
                        scale: [1, 1.2, 0.9, 1],
                    }}
                    transition={{
                        duration: 22,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-cyan-500/10 to-transparent blur-[120px]"
                />
                <motion.div
                    animate={{
                        x: [0, -30, 40, 0],
                        y: [0, 40, -40, 0],
                        scale: [1, 0.95, 1.15, 1],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="absolute top-1/3 right-[10%] w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[100px]"
                />
            </div>

            {/* ─── HEADER BAR ─── */}
            <div className={`max-w-[1000px] mx-auto border shadow-sm rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 relative z-10 ${t.cardBg} ${t.border}`}>
                <div className="flex items-center gap-3">
                    <Link to="/master/estabelecimentos" className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title="Voltar ao Painel">
                        <FaArrowLeft size={14} />
                    </Link>
                    <button onClick={toggleTheme} className={`p-2.5 rounded-xl border transition-all active:scale-95 ${t.buttonBg} ${t.border}`} title={theme === 'dark' ? "Mudar para tema claro" : "Mudar para tema escuro"}>
                        {theme === 'dark' ? <FaSun size={14} className="text-amber-400" /> : <FaMoon size={14} />}
                    </button>
                    <div>
                        <h1 className={`font-black text-sm tracking-tight font-bricolage ${t.text}`}>Operações</h1>
                        <p className={`text-[11px] font-bold font-space ${t.textSecondary}`}>Nova Operação</p>
                    </div>
                </div>
            </div>

            <div className="max-w-[1000px] mx-auto relative z-10">
                <div className="text-center mb-8">
                    <h1 className={`text-4xl font-black tracking-tight font-bricolage ${t.text} mb-3`}>
                        Novo Estabelecimento
                    </h1>
                    <p className={`text-sm font-medium max-w-2xl mx-auto ${t.textSecondary}`}>
                        Preencha as informações básicas, administrativas e de contato para inicializar uma nova operação na rede.
                    </p>
                    <div className={`w-20 h-1 bg-gradient-to-r ${theme === 'dark' ? 'from-cyan-400 to-violet-500' : 'from-[#ff6b35] to-amber-500'} mx-auto mt-4 rounded-full`}></div>
                </div>

                {formError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-450 p-6 mb-8 rounded-2xl shadow-sm font-space" role="alert">
                        <div className="flex items-start gap-3">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <p className="font-bold text-xs uppercase tracking-wider">Erro de validação</p>
                                <p className="text-xs mt-1 font-semibold">{formError}</p>
                            </div>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* SECTION 1: INFORMAÇÕES GERAIS */}
                    <FormSection title="Informações Gerais" icon={<FiHome size={18} />} theme={theme} t={t}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormInput 
                                label="Nome do Estabelecimento" 
                                name="nome" 
                                value={formData.nome} 
                                onChange={handleInputChange} 
                                required 
                                theme={theme}
                                t={t}
                                placeholder="Ex: Hamburgueria Idea Food"
                            />
                            <div className="space-y-2">
                                <FormInput 
                                    label="Slug (URL amigável)" 
                                    name="slug" 
                                    value={formData.slug} 
                                    onChange={handleInputChange} 
                                    required 
                                    theme={theme}
                                    t={t}
                                    placeholder="nome-do-estabelecimento"
                                />
                                <p className={`text-[9px] font-bold ${t.textMuted} flex items-center gap-1`}>
                                    🔗 Link do cardápio: <span className="font-mono-jb font-black text-cyan-400">/cardapio/{formData.slug || 'url'}</span>
                                </p>
                            </div>
                        </div>
                        
                        <FormInput 
                            label="Chave PIX" 
                            name="chavePix" 
                            value={formData.chavePix} 
                            onChange={handleInputChange} 
                            theme={theme}
                            t={t}
                            helpText="Chave PIX padrão para pagamentos online no cardápio"
                            placeholder="CNPJ, E-mail, Celular ou Chave Aleatória"
                        />

                        <div className="space-y-2.5">
                            <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>
                                Logo do Estabelecimento
                            </label>
                            <div className="flex w-full gap-6 items-start flex-col sm:flex-row">
                                <div className="flex-1 w-full">
                                    <div className={`border-2 border-dashed rounded-3xl p-6 text-center transition-all duration-300 ${
                                        theme === 'dark' 
                                            ? 'border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 text-slate-400' 
                                            : 'border-stone-300 hover:border-[#ff6b35]/40 hover:bg-[#ff6b35]/5 text-stone-600'
                                    }`}>
                                        <input 
                                            type="file" 
                                            id="logoUpload" 
                                            name="logoUpload" 
                                            accept="image/*" 
                                            onChange={handleInputChange} 
                                            className="hidden"
                                        />
                                        <label htmlFor="logoUpload" className="cursor-pointer block">
                                            <FiImage className="w-10 h-10 mx-auto mb-3 opacity-60" />
                                            <span className={`text-xs font-bold ${t.textSecondary} block`}>
                                                Selecione ou solte a imagem aqui
                                            </span>
                                            <p className={`text-[10px] ${t.textMuted} mt-1`}>
                                                PNG, JPG até 5MB (Recomendado proporção 1:1)
                                            </p>
                                        </label>
                                    </div>
                                </div>
                                {logoPreview && (
                                    <div className="flex flex-col items-center shrink-0 w-full sm:w-auto">
                                        <p className={`text-[10px] font-bold ${t.textSecondary} mb-2`}>Pré-visualização:</p>
                                        <img 
                                            src={logoPreview} 
                                            alt="Pré-visualização do Logo" 
                                            className="w-28 h-28 object-cover rounded-2xl shadow-xl border border-white/5 bg-slate-900"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <FormInput 
                            label="Avaliação Inicial" 
                            name="rating" 
                            value={formData.rating} 
                            onChange={handleInputChange} 
                            type="number" 
                            min="0" 
                            max="5" 
                            step="0.1" 
                            theme={theme}
                            t={t}
                            helpText="Nota inicial exibida no catálogo de estabelecimentos (0 a 5)"
                            placeholder="4.8"
                        />
                    </FormSection>

                    {/* SECTION 2: CONFIGURAÇÕES ADMINISTRATIVAS */}
                    <FormSection title="Configurações Administrativas" icon={<FiSettings size={18} />} theme={theme} t={t}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6 border-b border-white/5 mb-6">
                            <div className="space-y-2">
                                <label htmlFor="tipoNegocio" className={`block text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>
                                    Tipo de Negócio <span className="text-rose-500 font-black">*</span>
                                </label>
                                <select
                                    id="tipoNegocio" 
                                    name="tipoNegocio" 
                                    value={formData.tipoNegocio || 'restaurante'} 
                                    onChange={handleInputChange}
                                    className={selectStyle}
                                >
                                    <option value="restaurante" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Restaurante / Delivery de Comida</option>
                                    <option value="varejo" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Varejo / Loja de Material (Multiprojetos)</option>
                                    <option value="servicos" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Prestação de Serviços / Eventos</option>
                                </select>
                                <p className={`text-[10px] ${t.textMuted}`}>Define o comportamento de módulos no painel administrativo</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label htmlFor="adminUID" className={`block text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>
                                    Admin Responsável <span className="text-rose-500 font-black">*</span>
                                </label>
                                <select
                                    id="adminUID" 
                                    name="adminUID" 
                                    value={formData.adminUID} 
                                    onChange={handleInputChange} 
                                    required
                                    className={selectStyle}
                                >
                                    <option value="" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Selecione um administrador...</option>
                                    {availableAdmins.map(admin => (
                                        <option key={admin.id} value={admin.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>
                                            {admin.nome} ({admin.email})
                                        </option>
                                    ))}
                                </select>
                                <div className="flex justify-between items-center gap-2 mt-1">
                                    <p className={`text-[10px] ${t.textMuted}`}>Quem gerenciará esta unidade</p>
                                    <Link to="/master/usuarios" className={`text-[10px] font-bold transition-colors ${theme === 'dark' ? 'text-cyan-400 hover:text-cyan-300' : 'text-[#ff6b35] hover:text-[#e85a2a]'}`}>
                                        Criar novo Admin
                                    </Link>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="currentPlanId" className={`block text-[10px] font-black uppercase tracking-wider ${t.textSecondary}`}>
                                    Plano de Assinatura
                                </label>
                                <select
                                    id="currentPlanId" 
                                    name="currentPlanId" 
                                    value={formData.currentPlanId} 
                                    onChange={handleInputChange}
                                    className={selectStyle}
                                >
                                    <option value="" className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>Sem Plano Vinculado (Definir depois)</option>
                                    {availablePlans.map(plan => (
                                        <option key={plan.id} value={plan.id} className={theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-white text-stone-900'}>{plan.name}</option>
                                    ))}
                                </select>
                                <div className="flex justify-between items-center gap-2 mt-1">
                                    <p className={`text-[10px] ${t.textMuted}`}>Plano de faturamento da unidade</p>
                                    <Link to="/master/plans" className={`text-[10px] font-bold transition-colors ${theme === 'dark' ? 'text-cyan-400 hover:text-cyan-300' : 'text-[#ff6b35] hover:text-[#e85a2a]'}`}>
                                        Gerenciar planos
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </FormSection>

                    {/* SECTION 3: INFORMAÇÕES DE CONTATO */}
                    <FormSection title="Informações de Contato" icon={<FiPhone size={18} />} theme={theme} t={t}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <FormInput 
                                label="Telefone / WhatsApp" 
                                name="informacoes_contato.telefone_whatsapp" 
                                value={formData.informacoes_contato.telefone_whatsapp} 
                                onChange={handleInputChange} 
                                theme={theme}
                                t={t}
                                placeholder="(00) 00000-0000"
                            />
                            <FormInput 
                                label="Instagram" 
                                name="informacoes_contato.instagram" 
                                value={formData.informacoes_contato.instagram} 
                                onChange={handleInputChange} 
                                theme={theme}
                                t={t}
                                placeholder="@exemplo"
                            />
                        </div>
                        <FormInput 
                            label="Horário de Funcionamento" 
                            name="informacoes_contato.horario_funcionamento" 
                            value={formData.informacoes_contato.horario_funcionamento} 
                            onChange={handleInputChange} 
                            theme={theme}
                            t={t}
                            placeholder="Seg a Sex: 18h às 23h | Sab e Dom: 17h às 00h"
                        />
                    </FormSection>

                    {/* SECTION 4: ENDEREÇO */}
                    <FormSection title="Localização" icon={<FiMapPin size={18} />} theme={theme} t={t}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <FormInput 
                                label="Rua / Avenida" 
                                name="endereco.rua" 
                                value={formData.endereco.rua} 
                                onChange={handleInputChange} 
                                theme={theme}
                                t={t}
                                placeholder="Ex: Av. Brasil"
                            />
                            <FormInput 
                                label="Número" 
                                name="endereco.numero" 
                                value={formData.endereco.numero} 
                                onChange={handleInputChange} 
                                theme={theme}
                                t={t}
                                placeholder="Ex: 123"
                            />
                            <FormInput 
                                label="Bairro" 
                                name="endereco.bairro" 
                                value={formData.endereco.bairro} 
                                onChange={handleInputChange} 
                                theme={theme}
                                t={t}
                                placeholder="Ex: Centro"
                            />
                            <FormInput 
                                label="Cidade" 
                                name="endereco.cidade" 
                                value={formData.endereco.cidade} 
                                onChange={handleInputChange} 
                                theme={theme}
                                t={t}
                                placeholder="Ex: São Paulo"
                            />
                        </div>
                    </FormSection>

                    {/* ACTIONS DOCK */}
                    <div className="flex w-full gap-4 justify-end pt-6">
                        <Link
                            to="/master/estabelecimentos"
                            className={`px-6 py-3.5 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 active:scale-95 shadow-sm ${t.buttonBg} ${t.border}`}
                        >
                            <FaTimes size={12} /> Cancelar
                        </Link>
                        <button 
                            type="submit" 
                            disabled={loadingForm}
                            className={`px-8 py-3.5 text-white rounded-xl font-black text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 ${t.accent} ${t.accentHover}`}
                        >
                            {loadingForm ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white"></div>
                                    <span>Cadastrando...</span>
                                </>
                            ) : (
                                <>
                                    <FaCheck size={12} />
                                    <span>Cadastrar Operação</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AdminEstabelecimentoCadastro;