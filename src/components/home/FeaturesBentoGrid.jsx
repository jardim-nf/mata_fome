import React from 'react';
import { motion } from 'framer-motion';
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

const features = [
  {
    title: 'Robô de Atendimento via WhatsApp',
    description: 'Atendimento 24/7 com inteligência artificial para anotar e repassar pedidos direto pro sistema sem intervenção humana.',
    icon: Bot,
    color: 'from-green-400 to-emerald-600',
    colSpan: 'lg:col-span-2',
    rowSpan: 'lg:row-span-2',
  },
  {
    title: 'Ponto de Venda (PDV) Rápido',
    description: 'Frente de caixa otimizada e pensada para agilidade.',
    icon: MonitorSmartphone,
    color: 'from-orange-400 to-red-500',
  },
  {
    title: 'Gestão de Motoboys',
    description: 'Controle de acertos, mapa de entregas e app próprio.',
    icon: Bike,
    color: 'from-blue-400 to-indigo-600',
  },
  {
    title: 'Dashboard Master',
    description: 'Visão geral para donos de redes de franquias.',
    icon: LayoutDashboard,
    color: 'from-yellow-400 to-orange-500',
  },
  {
    title: 'Kitchen Display System (KDS)',
    description: 'Telas na cozinha que eliminam a chance de errar ou perder comandas de papel.',
    icon: ChefHat,
    color: 'from-red-400 to-rose-600',
    colSpan: 'lg:col-span-2',
  },
  {
    title: 'Controle de Mesas',
    description: 'Comandas, divisões de conta por assento e auditoria completa.',
    icon: Utensils,
    color: 'from-stone-400 to-stone-600',
  },
  {
    title: 'Totem Kiosk',
    description: 'Autoatendimento sem filas',
    icon: TabletSmartphone,
    color: 'from-sky-400 to-blue-500',
  },
  {
    title: 'App Próprio PWA',
    description: 'Seu cliente baixa o seu aplicativo diretamente do navegador.',
    icon: Smartphone,
    color: 'from-violet-400 to-purple-600',
    colSpan: 'lg:col-span-2',
  },
  {
    title: 'Estoque + Ficha Técnica',
    description: 'Baixa de ingredientes ao vender.',
    icon: PackageOpen,
    color: 'from-amber-400 to-yellow-600',
  },
  {
    title: 'Múltiplas Lojas',
    description: 'Controle toda rede em um único login.',
    icon: Store,
    color: 'from-emerald-400 to-teal-600',
  },
  {
    title: 'Auditoria Anti-Fraude',
    description: 'Rastreabilidade total das exclusões e estornos dos caixas.',
    icon: ShieldCheck,
    color: 'from-red-500 to-pink-600',
  },
  {
    title: 'Roteamento de Impressão',
    description: 'Manda drinks pro Bar e pratos pra Cozinha automaticamente.',
    icon: Printer,
    color: 'from-cyan-400 to-blue-600',
  },
  {
    title: 'Fidelidade e Cupons',
    description: 'Cupons, pontos e member-get-member.',
    icon: Ticket,
    color: 'from-orange-500 to-amber-600',
  },
  {
    title: 'Múltiplos Pagamentos',
    description: 'Pix integrado na hora e pagamentos divididos em vários cartões.',
    icon: Wallet,
    color: 'from-teal-400 to-emerald-600',
  },
  {
    title: 'Marketing e Disparos',
    description: 'Acione sua base para reengajar clientes via SMS ou E-mail.',
    icon: Megaphone,
    color: 'from-fuchsia-400 to-purple-600',
  },
  {
    title: 'Relatórios Financeiros ABC',
    description: 'DRE e ranking exato do que gera mais lucro bruto.',
    icon: LineChart,
    color: 'from-yellow-500 to-orange-600',
  },
  {
    title: 'Perfis de Acesso Granulares',
    description: 'Acessos e visibilidades diferentes (Gerente, Garçom, Cozinheiro, Caixa).',
    icon: Users,
    color: 'from-slate-400 to-gray-600',
    colSpan: 'lg:col-span-2',
  },
];

const FeaturesBentoGrid = () => {
  return (
    <section className="bg-[#0b0f19] py-24 px-4 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header */}
        <AnimatedSection className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-400 font-bold tracking-wider uppercase text-sm mb-4 border border-orange-500/20">
            Muito além do Delivery
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-6">
            O Ecossistema <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">Mais Completo</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto font-medium">
            Por que usar 5 sistemas diferentes se você pode ter todas essas 
            <span className="text-white font-bold"> +16 funcionalidades </span> 
            integradas em um só lugar?
          </p>
        </AnimatedSection>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                key={index}
                className={`relative group rounded-3xl p-6 md:p-8 flex flex-col justify-between overflow-hidden border border-white/10 bg-white/5 hover:bg-white/10 transition-colors backdrop-blur-sm shadow-2xl ${feature.colSpan || ''} ${feature.rowSpan || ''}`}
              >
                {/* Glow de fundo */}
                <div className={`absolute -inset-2 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-2xl`} />
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.color} opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`} />

                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                    <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

export default FeaturesBentoGrid;
