// src/components/home/HowItWorks.jsx
import { Network, Sliders, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedSection from './AnimatedSection';
import TiltCard from './TiltCard';

const steps = [
  {
    icon: Network,
    number: '01',
    title: 'Integre',
    description: 'Conecte seus PDVs, canais de venda e centros de distribuição em minutos.',
    color: 'from-orange-400 to-amber-500',
    bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  },
  {
    icon: Sliders,
    number: '02',
    title: 'Gerencie',
    description: 'Monitore vendas, estoque, financeiro e equipe em um único painel em tempo real.',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-red-500/10 border-red-500/20 text-red-400',
  },
  {
    icon: TrendingUp,
    number: '03',
    title: 'Escale',
    description: 'Automatize processos, reduza custos operacionais e impulsione seus lucros.',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-rose-500/10 border-rose-500/20 text-rose-450',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 md:py-28 px-4 bg-slate-950 text-white relative overflow-hidden border-t border-slate-900">
      {/* Background glow */}
      <div className="absolute top-[10%] right-[10%] w-[350px] h-[350px] rounded-full bg-orange-500/5 blur-[90px] pointer-events-none" />

      <div className="container mx-auto">
        <AnimatedSection className="text-center mb-20">
          <span className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest mb-4">
            🚀 Três Passos Simples
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Como <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">Funciona</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium">
            Implementação simples, rápida e sem complicação para o seu negócio.
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-orange-500 to-red-600 mx-auto mt-6 rounded-full" />
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto relative z-10">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-24 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-orange-500/30 via-red-500/30 to-rose-500/30 opacity-40" />

          {steps.map((step, index) => (
            <AnimatedSection key={index} delay={index * 0.2}>
              <TiltCard maxRotate={10} scale={1.03}>
                <div 
                  className="relative text-center p-8 rounded-3xl bg-slate-900/50 backdrop-blur-md border border-white/10 hover:border-orange-500/30 shadow-[0_20px_40px_rgba(0,0,0,0.55)] transition-all duration-300 group"
                >
                  {/* Step number */}
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-black text-white bg-gradient-to-r ${step.color} px-4 py-1.5 rounded-full shadow-lg shadow-orange-950/20 uppercase tracking-widest`}>
                    Passo {step.number}
                  </div>

                  {/* Animated Icon */}
                  <motion.div 
                    animate={{ scale: [1, 1.05, 1], rotate: [0, 4, -4, 0] }}
                    transition={{ 
                      duration: 5, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      delay: index * 0.3 
                    }}
                    className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg shadow-orange-500/10 group-hover:scale-110 transition-transform duration-300 border border-white/10`}
                  >
                    <step.icon className="w-10 h-10 text-white" strokeWidth={1.5} />
                  </motion.div>

                  <h3 className="text-2xl font-bold text-white mb-3 tracking-tight group-hover:text-orange-400 transition-colors">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm font-medium">{step.description}</p>
                </div>
              </TiltCard>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
