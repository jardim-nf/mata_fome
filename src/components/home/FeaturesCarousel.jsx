// src/components/home/FeaturesCarousel.jsx
import React from 'react';
import {
  MonitorSmartphone,
  Bike,
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
  Boxes,
  Truck,
  ShoppingBag,
} from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const allFeatures = [
  {
    title: 'Robô de Atendimento via WhatsApp',
    description: 'Atendimento 24/7 com IA diretamente pelo seu WhatsApp.',
    icon: Bot,
    color: 'from-green-400 to-emerald-500',
    iconColor: 'text-emerald-400',
  },
  {
    title: 'Ponto de Venda (PDV) Rápido',
    description: 'Frente de caixa otimizada e pensada para total agilidade.',
    icon: MonitorSmartphone,
    color: 'from-orange-400 to-red-500',
    iconColor: 'text-orange-400',
  },
  {
    title: 'Gestão de Motoboys',
    description: 'Controle de acertos, mapa de entregas e app próprio.',
    icon: Bike,
    color: 'from-blue-400 to-indigo-500',
    iconColor: 'text-blue-400',
  },
  {
    title: 'Dashboard Master',
    description: 'Visão geral gerencial para donos de redes e franquias.',
    icon: LayoutDashboard,
    color: 'from-orange-400 to-amber-500',
    iconColor: 'text-orange-400',
  },
  {
    title: 'Separação e Expedição (WMS)',
    description: 'Telas dedicadas que otimizam a separação de mercadorias no estoque físico.',
    icon: Boxes,
    color: 'from-rose-400 to-red-500',
    iconColor: 'text-rose-400',
  },
  {
    title: 'Balcão e Força de Vendas',
    description: 'Atendimento ágil para vendedores externos e pré-vendas integradas de balcão.',
    icon: ShoppingBag,
    color: 'from-stone-400 to-gray-500',
    iconColor: 'text-slate-400',
  },
  {
    title: 'Totem de Autoatendimento',
    description: 'Totens e Kiosks de autoatendimento interativos para zerar filas.',
    icon: TabletSmartphone,
    color: 'from-sky-400 to-cyan-500',
    iconColor: 'text-sky-400',
  },
  {
    title: 'E-commerce B2B e B2C',
    description: 'Seu e-commerce próprio de marca própria integrado ao estoque e finanças.',
    icon: Smartphone,
    color: 'from-violet-400 to-purple-500',
    iconColor: 'text-violet-400',
  },
  {
    title: 'Estoque Avançado e Ficha Técnica',
    description: 'Baixa e conciliação de insumos e matérias-primas no momento da venda.',
    icon: PackageOpen,
    color: 'from-amber-400 to-orange-500',
    iconColor: 'text-amber-400',
  },
  {
    title: 'Multilojas (Multi-CD)',
    description: 'Controle a sua rede e centros de distribuição inteiros em apenas um painel.',
    icon: Store,
    color: 'from-emerald-400 to-teal-500',
    iconColor: 'text-teal-400',
  },
  {
    title: 'Auditoria Anti-Fraude',
    description: 'Histórico e rastreabilidade total de exclusões e estornos de caixas.',
    icon: ShieldCheck,
    color: 'from-pink-400 to-rose-500',
    iconColor: 'text-pink-400',
  },
  {
    title: 'Logística e Roteamento',
    description: 'Planejamento de rotas inteligentes de entrega para frotas de distribuição.',
    icon: Truck,
    color: 'from-cyan-400 to-blue-500',
    iconColor: 'text-cyan-400',
  },
  {
    title: 'Motor de Fidelidade e Cupons',
    description: 'Recompensas e cupons automáticos para seus clientes comprarem mais.',
    icon: Ticket,
    color: 'from-red-400 to-orange-500',
    iconColor: 'text-red-400',
  },
  {
    title: 'Múltiplos de Pagamento Ágil',
    description: 'Pix integrado na hora e divisões em vários cartões.',
    icon: Wallet,
    color: 'from-emerald-400 to-green-500',
    iconColor: 'text-emerald-400',
  },
  {
    title: 'Marketing Automation',
    description: 'Acione sua base para reengajar clientes via SMS ou E-mail.',
    icon: Megaphone,
    color: 'from-fuchsia-400 to-purple-500',
    iconColor: 'text-fuchsia-400',
  },
  {
    title: 'DRE e Relatórios Financeiros',
    description: 'Curva ABC e ranking exato do que gera mais lucro.',
    icon: LineChart,
    color: 'from-orange-400 to-red-500',
    iconColor: 'text-orange-400',
  },
  {
    title: 'Acessos Granulares e Perfis',
    description: 'Limitação restrita do que o Vendedor, Estoquista e Caixa podem ver.',
    icon: Users,
    color: 'from-slate-400 to-gray-500',
    iconColor: 'text-slate-400',
  },
];

const row1 = allFeatures.slice(0, 9);
const row2 = allFeatures.slice(9, 17);

const FeatureCard = ({ feature }) => {
  const Icon = feature.icon;
  return (
    <div className="w-[340px] h-[160px] whitespace-normal flex-shrink-0 bg-slate-900/60 border border-white/5 rounded-3xl p-6 shadow-md hover:shadow-[0_15px_35px_rgba(249,115,22,0.12)] hover:-translate-y-1.5 hover:border-orange-500/20 transition-all duration-300 flex flex-col justify-center relative overflow-hidden group cursor-pointer mx-3">
      {/* Detalhe color card glow */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full mix-blend-screen opacity-10 blur-2xl transition-all duration-500 group-hover:scale-150 bg-gradient-to-br ${feature.color}`} />
      
      <div className="flex items-start gap-4 z-10 w-full">
        <div className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center bg-slate-950 transition-transform duration-300 group-hover:scale-110 shadow-inner border border-white/5">
          <Icon className={`w-6 h-6 ${feature.iconColor}`} strokeWidth={2} />
        </div>
        <div className="flex flex-col flex-1">
          <h3 className="text-white font-bold text-[16px] leading-snug mb-1 group-hover:text-orange-400 transition-colors break-words">
            {feature.title}
          </h3>
          <p className="text-slate-400 text-[13px] leading-snug break-words font-medium">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
};

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
    <section className="bg-slate-950 py-24 relative overflow-hidden border-t border-slate-900">
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

      {/* Ambient glows */}
      <div className="absolute top-[20%] left-[20%] w-[350px] h-[350px] rounded-full bg-red-500/5 blur-[100px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 relative z-10 mb-16">
        <AnimatedSection className="text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 font-bold tracking-wider uppercase text-xs mb-4 border border-orange-500/20 shadow-sm">
            Um Ecossistema Completo
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">
            Nós não somos apenas mais um sistema básico.
            <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              {' '}Somos o Controle Total da sua Operação.
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">
            Conheça as <span className="font-black text-white">+16 ferramentas e diferenciais</span> exclusivas integradas dentro do Idea System.
          </p>
        </AnimatedSection>
      </div>

      {/* Marquees */}
      <div className="relative w-full overflow-hidden flex flex-col gap-2 z-10">
        {/* Gradients de fade-out nas pontas para sumir suavemente o carrossel */}
        <div className="absolute top-0 bottom-0 left-0 w-16 md:w-48 bg-gradient-to-r from-slate-950 to-transparent z-20 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-16 md:w-48 bg-gradient-to-l from-slate-950 to-transparent z-20 pointer-events-none" />
        
        <MarqueeRow items={row1} direction="left" speed={70} />
        <MarqueeRow items={row2} direction="right" speed={65} />
      </div>

    </section>
  );
};

export default FeaturesCarousel;
