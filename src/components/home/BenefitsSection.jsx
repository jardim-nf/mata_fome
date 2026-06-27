// src/components/home/BenefitsSection.jsx
import React, { useState, useEffect } from 'react';
import { TrendingUp, LayoutDashboard, DollarSign, CheckCircle2 } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const benefits = [
  {
    icon: TrendingUp,
    badge: 'Aumente suas vendas',
    badgeColor: 'bg-green-500/20 border-green-500/30 text-green-400',
    iconColor: 'from-green-400 to-emerald-500',
    title: 'Omnichannel: Venda no Varejo e Atacado',
    description: 'Conecte suas vendas físicas e digitais em um só ecossistema. Crie catálogos digitais para atacado, controle comissões de vendedores e crie cupons para varejo.',
    items: ['Catálogo para Atacado B2B', 'Cupons e Fidelidade no Varejo', 'Força de Vendas e Balcão', 'Integração com WhatsApp', 'E-commerce Próprio Integrado'],
    checkColor: 'text-green-400',
    btnColor: 'from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/20',
    btnText: 'Quero Vender Omnichannel',
  },
  {
    icon: LayoutDashboard,
    badge: '+60% eficiência',
    badgeColor: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
    iconColor: 'from-blue-400 to-indigo-500',
    title: 'Estoque, Financeiro e Expedição',
    description: 'Centralize múltiplos centros de distribuição (CD) e controle seu financeiro com DRE automático, fluxo de caixa em tempo real e conciliação bancária.',
    items: ['Multilojas e Multi-CD', 'Controle de Estoque e WMS', 'DRE e Demonstrativos ABC', 'PDV Offline de alta velocidade', 'Auditoria anti-fraude integrada'],
    checkColor: 'text-blue-400',
    btnColor: 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/20',
    btnText: 'Otimizar Minha Gestão',
  },
  {
    icon: DollarSign,
    badge: 'Economia garantida',
    badgeColor: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
    iconColor: 'from-purple-400 to-violet-500',
    title: 'Custo de Licenciamento Justo',
    description: 'Diga adeus a taxas de implantação abusivas e atualizações cobradas à parte. Mensalidade fixa e transparente sem pegadinhas.',
    items: ['Mensalidade Fixa e Justa', 'Suporte Técnico Premium 24/7', 'Sem taxas sobre faturamento', 'Atualizações na nuvem inclusas', 'Fácil migração de sistemas antigos'],
    checkColor: 'text-purple-400',
    btnColor: 'from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 shadow-purple-500/20',
    btnText: 'Mudar para o Idea System',
  },
];

const commissionData = [
  { platform: 'ERP Tradicional', commission: 'Implantação Cara', color: 'bg-red-950/40 text-red-400 border border-red-500/20' },
  { platform: 'Sistemas Legados', commission: 'Suporte Lento', color: 'bg-orange-950/40 text-orange-400 border border-orange-500/20' },
  { platform: 'Outros Cloud', commission: 'Taxa s/ Faturamento', color: 'bg-blue-950/40 text-blue-400 border border-blue-500/20' },
  { platform: 'Idea System', commission: 'Mensalidade Fixa', color: 'bg-gradient-to-r from-orange-500 to-red-550 text-white border border-orange-550/30 ring-2 ring-orange-500/30 shadow-lg shadow-orange-500/25 font-bold' },
];

const BenefitsSection = () => {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % benefits.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);
  const activeBenefit = benefits[activeTab];

  return (
    <section className="bg-slate-950 py-20 md:py-28 px-4 text-white relative overflow-hidden border-t border-slate-900">
      {/* Glow effect */}
      <div className="absolute bottom-[20%] left-0 w-[400px] h-[400px] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />

      <div className="container mx-auto relative z-10">
        {/* Header */}
        <AnimatedSection className="text-center mb-20">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-4">
            🔥 Benefícios Inteligentes
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            Transforme sua{' '}
            <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
              Operação e Vendas
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto font-medium">
            Ferramentas integradas para simplificar seu dia a dia, automatizar processos e maximizar seus lucros.
          </p>
          <div className="w-32 h-1 bg-gradient-to-r from-orange-500 to-red-600 mx-auto mt-6 rounded-full" />
        </AnimatedSection>

        {/* Interactive Menu & Content */}
        <div className="flex flex-col lg:flex-row gap-8 md:gap-12 mt-12 items-stretch">
          
          {/* Menu Lateral */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4 justify-center">
            {benefits.map((benefit, index) => {
              const isActive = activeTab === index;
              return (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`flex items-center text-left gap-4 p-5 rounded-2xl transition-all duration-300 border-2 ${
                    isActive 
                      ? 'border-orange-500 bg-slate-900/80 shadow-[0_20px_50px_rgba(249,115,22,0.15)] scale-[1.03] text-white' 
                      : 'border-white/5 bg-slate-900/30 text-slate-400 hover:bg-slate-900/50 hover:border-white/10'
                  }`}
                >
                  <div className={`w-12 h-12 flex-shrink-0 bg-gradient-to-br ${benefit.iconColor} rounded-xl flex items-center justify-center shadow-md`}>
                    <benefit.icon className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg leading-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                      {benefit.title}
                    </h3>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Painel de Conteúdo Ativo */}
          <div className="w-full lg:w-2/3">
            <AnimatedSection key={activeTab} className="bg-slate-900/40 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-white/10 flex flex-col h-full relative overflow-hidden min-h-[420px] justify-between">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-bl-full z-0 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${activeBenefit.iconColor} rounded-2xl flex items-center justify-center shadow-lg border border-white/10`}>
                      <activeBenefit.icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">{activeBenefit.title}</h3>
                  </div>
                  <div className={`${activeBenefit.badgeColor} border text-xs px-4 py-2 rounded-full font-black uppercase tracking-wider shadow-md whitespace-nowrap`}>
                    ⭐ {activeBenefit.badge}
                  </div>
                </div>

                <p className="text-base text-slate-400 leading-relaxed font-medium">{activeBenefit.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeBenefit.items.map((item, i) => (
                    <div key={i} className="flex items-center text-slate-300 font-medium text-sm">
                      <CheckCircle2 className={`w-5 h-5 ${activeBenefit.checkColor} mr-3 flex-shrink-0`} />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <button 
                    onClick={() => {
                      const phoneNumber = "5522998102575";
                      const message = `Olá! Gostaria de entender mais sobre o pilar "${activeBenefit.title}" do Idea System.`;
                      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className={`w-full md:w-auto bg-gradient-to-r ${activeBenefit.btnColor} text-slate-950 font-black py-4 px-8 rounded-2xl text-base transition-all duration-300 transform hover:scale-[1.03] shadow-lg active:scale-95`}
                  >
                    {activeBenefit.btnText}
                  </button>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Commission Comparison */}
        <AnimatedSection className="mt-24">
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 text-center border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <h3 className="text-2xl md:text-3xl font-black text-white mb-3 tracking-tight">
                🚫 Chega de Custos Escondidos!
              </h3>
              <p className="text-base text-slate-400 mb-8 font-medium">
                Compare o modelo tradicional de ERP com o nosso modelo de assinatura justa
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                {commissionData.map((item, index) => (
                  <AnimatedSection key={index} delay={0.1 * index}>
                    <div className={`p-6 rounded-2xl ${item.color} shadow-lg hover:scale-105 transition-all duration-300 flex flex-col justify-between min-h-[140px] text-center`}>
                      <div className="font-bold text-xs uppercase tracking-wider mb-2 opacity-80">{item.platform}</div>
                      <div className="text-base sm:text-lg font-black leading-tight break-words flex-grow flex items-center justify-center">
                        {item.commission}
                      </div>
                      <div className="text-[10px] uppercase font-black mt-2 opacity-60 tracking-widest">modelo</div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              <p className="mt-8 text-xs text-slate-500 font-medium">
                *Comparação de mercado com base nas principais queixas de lojistas em 2025.
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* CTA */}
        <AnimatedSection className="text-center mt-24">
          <h3 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
            Pronto para Transformar seu Negócio?
          </h3>
          <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto font-medium">
            Junte-se a centenas de estabelecimentos que já aumentaram suas vendas
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                const phoneNumber = "5522998102575";
                const message = "Olá! Gostaria de agendar uma demonstração do Idea System.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 px-8 rounded-2xl text-base shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all transform hover:scale-[1.03] active:scale-95"
            >
              🚀 Agendar Demonstração Gratuita
            </button>
            <button 
              onClick={() => {
                const phoneNumber = "5522998102575";
                const message = "Olá! Tenho algumas dúvidas técnicas sobre o Idea System.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="border-2 border-slate-700 text-slate-300 font-bold py-4 px-8 rounded-2xl text-base hover:bg-slate-800 hover:text-white hover:border-slate-500 transition-all duration-300 transform hover:scale-[1.03] active:scale-95"
            >
              📞 Falar com Especialista
            </button>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default BenefitsSection;
