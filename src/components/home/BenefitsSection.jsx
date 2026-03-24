// src/components/home/BenefitsSection.jsx
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

        {/* Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10">
          {benefits.map((benefit, index) => (
            <AnimatedSection key={index} delay={index * 0.15}>
              <div className="group relative bg-white rounded-3xl p-8 shadow-lg border border-gray-100 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 h-full flex flex-col">
                {/* Badge */}
                <div className={`absolute -top-3 right-6 ${benefit.badgeColor} text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg`}>
                  {benefit.badge}
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${benefit.iconColor} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <benefit.icon className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">{benefit.title}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{benefit.description}</p>

                {/* Checklist */}
                <ul className="space-y-3 mb-8 flex-grow">
                  {benefit.items.map((item, i) => (
                    <li key={i} className="flex items-center text-gray-600 text-sm">
                      <CheckCircle2 className={`w-5 h-5 ${benefit.checkColor} mr-3 flex-shrink-0`} />
                      {item}
                    </li>
                  ))}
                </ul>

                {/* Button */}
                <button className={`w-full bg-gradient-to-r ${benefit.btnColor} text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl`}>
                  {benefit.btnText}
                </button>
              </div>
            </AnimatedSection>
          ))}
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
