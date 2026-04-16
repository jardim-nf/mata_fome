import React from 'react';
import {
  MonitorSmartphone,
  Bike,
  Utensils,
  ChefHat,
  TabletSmartphone,
  PackageOpen,
  Smartphone,
  Bot,
  Store,
  ShieldCheck,
  Printer,
  Ticket,
  LineChart,
  LayoutDashboard,
  Users,
  Wallet,
  Megaphone,
} from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const allFeatures = [
  {
    title: 'Robô de Atendimento via WhatsApp',
    description: 'Atendimento 24/7 com IA diretamente pelo seu WhatsApp.',
    icon: Bot,
    color: 'from-green-400 to-emerald-500',
    iconColor: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
  },
  {
    title: 'Ponto de Venda (PDV) Rápido',
    description: 'Frente de caixa otimizada e pensada para total agilidade.',
    icon: MonitorSmartphone,
    color: 'from-orange-400 to-red-500',
    iconColor: 'text-orange-600',
    bgLight: 'bg-orange-50',
  },
  {
    title: 'Gestão de Motoboys',
    description: 'Controle de acertos, mapa de entregas e app próprio.',
    icon: Bike,
    color: 'from-blue-400 to-indigo-500',
    iconColor: 'text-blue-600',
    bgLight: 'bg-blue-50',
  },
  {
    title: 'Dashboard Master',
    description: 'Visão geral gerencial para donos de redes e franquias.',
    icon: LayoutDashboard,
    color: 'from-yellow-400 to-orange-400',
    iconColor: 'text-yellow-600',
    bgLight: 'bg-yellow-50',
  },
  {
    title: 'Kitchen Display System (KDS)',
    description: 'Telas na cozinha que eliminam comandas de papel perdidas.',
    icon: ChefHat,
    color: 'from-rose-400 to-red-500',
    iconColor: 'text-rose-600',
    bgLight: 'bg-rose-50',
  },
  {
    title: 'Controle de Mesas e Salão',
    description: 'Comandas, divisões de conta por assento e auditoria completa.',
    icon: Utensils,
    color: 'from-stone-400 to-gray-500',
    iconColor: 'text-stone-600',
    bgLight: 'bg-stone-100',
  },
  {
    title: 'Totem de Autoatendimento',
    description: 'Totens e Kiosks de autoatendimento para zerar filas.',
    icon: TabletSmartphone,
    color: 'from-sky-400 to-cyan-500',
    iconColor: 'text-sky-600',
    bgLight: 'bg-sky-50',
  },
  {
    title: 'App Próprio PWA de Delivery',
    description: 'Cliente pede e baixa seu aplicativo pelo navegador, sem taxas.',
    icon: Smartphone,
    color: 'from-violet-400 to-purple-500',
    iconColor: 'text-violet-600',
    bgLight: 'bg-violet-50',
  },
  {
    title: 'Estoque Avançado e Ficha Técnica',
    description: 'Baixa de ingredientes exata no momento da venda.',
    icon: PackageOpen,
    color: 'from-amber-400 to-yellow-500',
    iconColor: 'text-amber-600',
    bgLight: 'bg-amber-50',
  },
  {
    title: 'Multilojas (Multi-CD)',
    description: 'Controle a sua rede inteira em apenas um painel.',
    icon: Store,
    color: 'from-emerald-400 to-teal-500',
    iconColor: 'text-teal-600',
    bgLight: 'bg-teal-50',
  },
  {
    title: 'Auditoria Anti-Fraude',
    description: 'Histórico e rastreabilidade total de estornos no PDV.',
    icon: ShieldCheck,
    color: 'from-pink-400 to-rose-500',
    iconColor: 'text-pink-600',
    bgLight: 'bg-pink-50',
  },
  {
    title: 'Roteamento Inteligente',
    description: 'Redirecione saídas para Cervejas no Bar e Pratos na Cozinha.',
    icon: Printer,
    color: 'from-cyan-400 to-blue-500',
    iconColor: 'text-cyan-600',
    bgLight: 'bg-cyan-50',
  },
  {
    title: 'Motor de Fidelidade e Cupons',
    description: 'Recompensas automáticas para seus clientes comprarem mais.',
    icon: Ticket,
    color: 'from-red-400 to-orange-500',
    iconColor: 'text-red-500',
    bgLight: 'bg-red-50',
  },
  {
    title: 'Múltiplos de Pagamento Ágil',
    description: 'Pix integrado na hora e divisões em vários cartões.',
    icon: Wallet,
    color: 'from-emerald-400 to-green-500',
    iconColor: 'text-green-600',
    bgLight: 'bg-green-50',
  },
  {
    title: 'Marketing Automation',
    description: 'Acione sua base para reengajar clientes via SMS ou E-mail.',
    icon: Megaphone,
    color: 'from-fuchsia-400 to-purple-500',
    iconColor: 'text-fuchsia-600',
    bgLight: 'bg-fuchsia-50',
  },
  {
    title: 'DRE e Relatórios Financeiros',
    description: 'Curva ABC e ranking exato do que gera mais lucro.',
    icon: LineChart,
    color: 'from-orange-400 to-yellow-500',
    iconColor: 'text-orange-500',
    bgLight: 'bg-orange-50',
  },
  {
    title: 'Acessos Granulares e Perfis',
    description: 'Limitação restrita do que o Garçom, Cozinheiro e Caixa podem ver.',
    icon: Users,
    color: 'from-slate-400 to-gray-500',
    iconColor: 'text-slate-600',
    bgLight: 'bg-slate-100',
  },
];

const row1 = allFeatures.slice(0, 9);
const row2 = allFeatures.slice(9, 17);

const FeatureCard = ({ feature }) => {
  const Icon = feature.icon;
  return (
    <div className="w-[340px] h-[160px] whitespace-normal flex-shrink-0 bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group cursor-pointer mx-3">
      {/* Detalhe color card glow */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full mix-blend-multiply opacity-20 blur-2xl transition-all duration-500 group-hover:scale-150 bg-gradient-to-br ${feature.color}`} />
      
      <div className="flex items-start gap-4 z-10 w-full">
        <div className={`w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center ${feature.bgLight} transition-transform duration-300 group-hover:scale-110 shadow-sm border border-black/5`}>
          <Icon className={`w-6 h-6 ${feature.iconColor}`} strokeWidth={2} />
        </div>
        <div className="flex flex-col flex-1">
          <h3 className="text-gray-900 font-bold text-[16px] leading-snug mb-1 group-hover:text-amber-600 transition-colors break-words">
            {feature.title}
          </h3>
          <p className="text-gray-500 text-[13px] leading-snug break-words">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
};

// We create a wrapper to seamlessly duplicate items so the CSS marquee runs continuously
const MarqueeRow = ({ items, direction = 'left', speed = 60 }) => {
  return (
    <div className="flex overflow-hidden w-full group py-4">
      <div className={`flex w-max animate-infinite-marquee whitespace-nowrap ${direction === 'right' ? 'animate-infinite-marquee-reverse' : ''}`} style={{ animationDuration: `${speed}s` }}>
        {items.map((feature, idx) => <FeatureCard key={`a-${idx}`} feature={feature} />)}
        {items.map((feature, idx) => <FeatureCard key={`b-${idx}`} feature={feature} />)}
      </div>
    </div>
  );
};

const FeaturesCarousel = () => {
  return (
    <section className="bg-gradient-to-b from-white to-gray-50 py-24 relative overflow-hidden">
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes marquee-reverse {
            0% { transform: translateX(-50%); }
            100% { transform: translateX(0); }
          }
          .animate-infinite-marquee {
            animation: marquee 50s linear infinite;
          }
          .animate-infinite-marquee-reverse {
            animation: marquee-reverse 50s linear infinite;
          }
          .group:hover .animate-infinite-marquee,
          .group:hover .animate-infinite-marquee-reverse {
            animation-play-state: paused;
          }
        `}
      </style>
      
      <div className="max-w-7xl mx-auto px-4 relative z-10 mb-16">
        <AnimatedSection className="text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-100 text-amber-700 font-bold tracking-wider uppercase text-sm mb-4 border border-amber-200 shadow-sm">
            Um Ecossistema Completo
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
            Nós não somos apenas um app de delivery.
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
              {' '}Somos o seu Controle Total.
            </span>
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">
            Conheça as <span className="font-bold text-gray-900">+16 ferramentas e diferenciais</span> exclusivas integradas dentro da plataforma Matafome.
          </p>
        </AnimatedSection>
      </div>

      {/* Marquees */}
      <div className="relative w-full overflow-hidden flex flex-col gap-2">
        {/* Gradients de fade-out nas pontas para sumir suavemente o carrossel */}
        <div className="absolute top-0 bottom-0 left-0 w-16 md:w-48 bg-gradient-to-r from-white/90 to-transparent z-20 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 md:w-48 bg-gradient-to-l from-gray-50/90 to-transparent z-20 pointer-events-none" />
        
        <MarqueeRow items={row1} direction="left" speed={70} />
        <MarqueeRow items={row2} direction="right" speed={65} />
      </div>

    </section>
  );
};

export default FeaturesCarousel;
