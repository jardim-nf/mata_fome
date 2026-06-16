import React, { useState, useEffect } from 'react';
import { TrendingUp, LayoutDashboard, DollarSign, CheckCircle2 } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const benefits = [
  {
    icon: TrendingUp,
    badge: 'Aumente suas vendas',
    badgeColor: 'bg-green-500',
    iconColor: 'from-green-400 to-emerald-500',
    title: 'Omnichannel: Venda no Varejo e Atacado',
    description: 'Conecte suas vendas físicas e digitais em um só ecossistema. Crie catálogos digitais para atacado, controle comissões de vendedores e crie cupons para varejo.',
    items: ['Catálogo para Atacado B2B', 'Cupons e Fidelidade no Varejo', 'Força de Vendas e Balcão', 'Integração com WhatsApp', 'E-commerce Próprio Integrado'],
    checkColor: 'text-green-500',
    btnColor: 'from-green-500 to-emerald-600',
    btnText: 'Quero Vender Omnichannel',
  },
  {
    icon: LayoutDashboard,
    badge: '+60% eficiência',
    badgeColor: 'bg-blue-500',
    iconColor: 'from-blue-400 to-indigo-500',
    title: 'Estoque, Financeiro e Expedição',
    description: 'Centralize múltiplos centros de distribuição (CD) e controle seu financeiro com DRE automático, fluxo de caixa em tempo real e conciliação bancária.',
    items: ['Multilojas e Multi-CD', 'Controle de Estoque e WMS', 'DRE e Demonstrativos ABC', 'PDV Offline de alta velocidade', 'Auditoria anti-fraude integrada'],
    checkColor: 'text-blue-500',
    btnColor: 'from-blue-500 to-indigo-600',
    btnText: 'Otimizar Minha Gestão',
  },
  {
    icon: DollarSign,
    badge: 'Economia garantida',
    badgeColor: 'bg-purple-500',
    iconColor: 'from-purple-400 to-violet-500',
    title: 'Custo de Licenciamento Justo',
    description: 'Diga adeus a taxas de implantação abusivas e atualizações cobradas à parte. Mensalidade fixa e transparente sem pegadinhas.',
    items: ['Mensalidade Fixa e Justa', 'Suporte Técnico Premium 24/7', 'Sem taxas sobre faturamento', 'Atualizações na nuvem inclusas', 'Fácil migração de sistemas antigos'],
    checkColor: 'text-purple-500',
    btnColor: 'from-purple-500 to-violet-600',
    btnText: 'Mudar para o Idea System',
  },
];

const commissionData = [
  { platform: 'ERP Tradicional', commission: 'Implantação Cara', color: 'bg-red-500 text-white' },
  { platform: 'Sistemas Legados', commission: 'Suporte Lento', color: 'bg-orange-500 text-white' },
  { platform: 'Outros Cloud', commission: 'Taxa s/ Faturamento', color: 'bg-blue-600 text-white' },
  { platform: 'Idea System', commission: 'Mensalidade Fixa', color: 'bg-gradient-to-r from-orange-500 to-red-500 text-white ring-2 ring-orange-400' },
];

const BenefitsSection = () => {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab((prev) => (prev + 1) % benefits.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  const activeBenefit = benefits[activeTab];

  return (
    <section className="bg-gradient-to-br from-gray-50 to-white py-20 md:py-28 px-4">
      <div className="container mx-auto">
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            Transforme sua{' '}
            <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">
              Operação e Vendas
            </span>
          </h2>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto">
            Ferramentas integradas para simplificar seu dia a dia, automatizar processos e maximizar seus lucros.
          </p>
          <div className="w-32 h-1 bg-gradient-to-r from-orange-500 to-red-600 mx-auto mt-6 rounded-full" />
        </AnimatedSection>

        {/* Interactive Menu & Content */}
        <div className="flex flex-col lg:flex-row gap-8 md:gap-12 mt-12 items-start">
          
          {/* Menu Lateral */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4">
            {benefits.map((benefit, index) => {
              const isActive = activeTab === index;
              return (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`flex items-center text-left gap-4 p-5 rounded-2xl transition-all duration-300 border-2 ${
                    isActive 
                      ? 'border-orange-500 bg-white shadow-xl scale-105' 
                      : 'border-transparent bg-white/60 hover:bg-white hover:shadow-md'
                  }`}
                >
                  <div className={`w-12 h-12 flex-shrink-0 bg-gradient-to-br ${benefit.iconColor} rounded-xl flex items-center justify-center shadow-md`}>
                    <benefit.icon className="w-6 h-6 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className={`font-bold text-lg ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                      {benefit.title}
                    </h3>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Painel de Conteúdo Ativo */}
          <div className="w-full lg:w-2/3">
            <AnimatedSection key={activeTab} className="bg-white rounded-3xl p-8 md:p-10 shadow-2xl border border-gray-100 flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-gray-50 to-transparent rounded-bl-full z-0 opacity-50" />
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 bg-gradient-to-br ${activeBenefit.iconColor} rounded-2xl flex items-center justify-center shadow-lg`}>
                      <activeBenefit.icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900">{activeBenefit.title}</h3>
                  </div>
                  <div className={`${activeBenefit.badgeColor} text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg whitespace-nowrap`}>
                    ⭐ {activeBenefit.badge}
                  </div>
                </div>

                <p className="text-lg text-gray-600 leading-relaxed mb-8">{activeBenefit.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  {activeBenefit.items.map((item, i) => (
                    <div key={i} className="flex items-center text-gray-700 font-medium">
                      <CheckCircle2 className={`w-6 h-6 ${activeBenefit.checkColor} mr-3 flex-shrink-0`} />
                      {item}
                    </div>
                  ))}
                </div>

                <div className="mt-auto">
                  <button 
                    onClick={() => {
                      const phoneNumber = "5522998102575";
                      const message = `Olá! Gostaria de entender mais sobre o pilar "${activeBenefit.title}" do Idea System.`;
                      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className={`w-full md:w-auto bg-gradient-to-r ${activeBenefit.btnColor} text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl`}
                  >
                    {activeBenefit.btnText}
                  </button>
                </div>
              </div>
            </AnimatedSection>
          </div>
        </div>

        {/* Commission Comparison */}
        <AnimatedSection className="mt-20">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-center overflow-hidden relative">
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500 rounded-full opacity-5 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500 rounded-full opacity-5 translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
                🚫 Chega de Custos Escondidos!
              </h3>
              <p className="text-lg text-gray-400 mb-8">
                Compare o modelo tradicional de ERP com o nosso modelo de assinatura justa
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                {commissionData.map((item, index) => (
                  <AnimatedSection key={index} delay={0.1 * index}>
                    <div className={`p-6 rounded-2xl ${item.color} shadow-lg transform hover:scale-105 transition-transform duration-300 flex flex-col justify-between min-h-[140px] text-center`}>
                      <div className="font-bold text-xs uppercase tracking-wider mb-2 opacity-80">{item.platform}</div>
                      <div className="text-lg sm:text-xl md:text-2xl font-black leading-tight break-words flex-grow flex items-center justify-center">
                        {item.commission}
                      </div>
                      <div className="text-[10px] uppercase font-bold mt-2 opacity-60 tracking-widest">modelo</div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              <p className="mt-6 text-xs text-gray-500">
                *Comparação de mercado com base nas principais queixas de lojistas em 2025.
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* CTA */}
        <AnimatedSection className="text-center mt-16">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Pronto para Transformar seu Negócio?
          </h3>
          <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de estabelecimentos que já aumentaram suas vendas
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => {
                const phoneNumber = "5522998102575";
                const message = "Olá! Gostaria de agendar uma demonstração do Idea System.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all transform hover:scale-105"
            >
              🚀 Agendar Demonstração Gratuita
            </button>
            <button 
              onClick={() => {
                const phoneNumber = "5522998102575";
                const message = "Olá! Tenho algumas dúvidas técnicas sobre o Idea System.";
                window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
              }}
              className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105"
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
