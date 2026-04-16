import React, { useState, useEffect } from 'react';
import { TrendingUp, LayoutDashboard, DollarSign, CheckCircle2 } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const benefits = [
  {
    icon: TrendingUp,
    badge: '+47% em média',
    badgeColor: 'bg-green-500',
    iconColor: 'from-green-400 to-emerald-500',
    title: 'Venda Mais e Aumente sua Receita',
    description: 'Crie cupons, programas de fidelidade, campanhas de email e push para fidelizar seus clientes.',
    items: ['Cupons personalizados', 'Programa de pontos', 'Email marketing', 'Notificações push', 'Relatórios de performance'],
    checkColor: 'text-green-500',
    btnColor: 'from-green-500 to-emerald-600',
    btnText: 'Começar a Vender Mais',
  },
  {
    icon: LayoutDashboard,
    badge: '+60% eficiência',
    badgeColor: 'bg-blue-500',
    iconColor: 'from-blue-400 to-indigo-500',
    title: 'Organize sua Operação de Delivery',
    description: 'Centralize seus pedidos em uma só plataforma e organize suas operações de forma eficiente.',
    items: ['Painel unificado', 'Gestão de pedidos', 'Controle de estoque', 'Relatórios em tempo real', 'App para entregadores'],
    checkColor: 'text-blue-500',
    btnColor: 'from-blue-500 to-indigo-600',
    btnText: 'Otimizar Operação',
  },
  {
    icon: DollarSign,
    badge: 'Até 80% economia',
    badgeColor: 'bg-purple-500',
    iconColor: 'from-purple-400 to-violet-500',
    title: 'Economize Dinheiro com Comissões',
    description: 'Com seu canal próprio você não paga mais comissões altas e não fica dependente de marketplaces.',
    items: ['Comissão zero', 'Canal próprio', 'Sem intermediários', 'Branding completo', 'Clientes diretos'],
    checkColor: 'text-purple-500',
    btnColor: 'from-purple-500 to-violet-600',
    btnText: 'Economizar Agora',
  },
];

const commissionData = [
  { platform: 'Ifood', commission: '25-35%', color: 'bg-red-500 text-white' },
  { platform: 'Rappi', commission: '28-38%', color: 'bg-orange-500 text-white' },
  { platform: 'Uber Eats', commission: '30-40%', color: 'bg-green-600 text-white' },
  { platform: 'IdeaFood', commission: '0%', color: 'bg-white text-yellow-600 ring-2 ring-yellow-400' },
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
            Transforme seu{' '}
            <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Negócio de Delivery
            </span>
          </h2>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto">
            Ferramentas poderosas para você vender mais, organizar melhor e economizar
          </p>
          <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto mt-6 rounded-full" />
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
                      ? 'border-yellow-500 bg-white shadow-xl scale-105' 
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
                  <button className={`w-full md:w-auto bg-gradient-to-r ${activeBenefit.btnColor} text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl`}>
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
                🚫 Chega de Comissões Abusivas!
              </h3>
              <p className="text-lg text-gray-400 mb-8">
                Compare e veja quanto você pode economizar
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                {commissionData.map((item, index) => (
                  <AnimatedSection key={index} delay={0.1 * index}>
                    <div className={`p-5 rounded-2xl ${item.color} shadow-lg transform hover:scale-105 transition-transform duration-300`}>
                      <div className="font-bold text-sm mb-1 opacity-80">{item.platform}</div>
                      <div className="text-3xl font-extrabold">{item.commission}</div>
                      <div className="text-xs mt-1 opacity-70">comissão</div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>

              <p className="mt-6 text-xs text-gray-500">
                *Valores médios de comissão no mercado — Dados 2024
              </p>
            </div>
          </div>
        </AnimatedSection>

        {/* CTA */}
        <AnimatedSection className="text-center mt-16">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Pronto para Transformar seu Delivery?
          </h3>
          <p className="text-xl text-gray-500 mb-8 max-w-2xl mx-auto">
            Junte-se a centenas de estabelecimentos que já aumentaram suas vendas
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg shadow-yellow-500/25 hover:shadow-xl transition-all transform hover:scale-105">
              🚀 Começar Agora — 7 Dias Grátis
            </button>
            <button className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-300 transform hover:scale-105">
              📞 Falar com Especialista
            </button>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};

export default BenefitsSection;
