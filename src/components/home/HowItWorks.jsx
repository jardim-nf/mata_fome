// src/components/home/HowItWorks.jsx
import { Network, Sliders, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import AnimatedSection from './AnimatedSection';

const steps = [
  {
    icon: Network,
    number: '01',
    title: 'Integre',
    description: 'Conecte seus PDVs, canais de venda e centros de distribuição em minutos.',
    color: 'from-orange-400 to-amber-500',
    bg: 'bg-orange-50/40',
  },
  {
    icon: Sliders,
    number: '02',
    title: 'Gerencie',
    description: 'Monitore vendas, estoque, financeiro e equipe em um único painel em tempo real.',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-orange-50/20',
  },
  {
    icon: TrendingUp,
    number: '03',
    title: 'Escale',
    description: 'Automatize processos, reduza custos operacionais e impulsione seus lucros.',
    color: 'from-red-500 to-rose-600',
    bg: 'bg-red-50/20',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 md:py-28 px-4 bg-white overflow-hidden">
      <div className="container mx-auto">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Como <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">Funciona</span>
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Implementação simples, rápida e sem complicação para o seu negócio.
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-orange-500 to-red-600 mx-auto mt-6 rounded-full" />
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-24 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-orange-300 via-red-300 to-rose-300 opacity-40" />

          {steps.map((step, index) => (
            <AnimatedSection key={index} delay={index * 0.2}>
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: index * 0.5 
                }}
                className={`relative text-center p-8 rounded-3xl ${step.bg} border border-gray-100 hover:shadow-xl transition-shadow duration-500 group`}
              >
                {/* Step number */}
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-gradient-to-r ${step.color} px-3 py-1 rounded-full`}>
                  PASSO {step.number}
                </div>

                {/* Icon animado com framer-motion também */}
                <motion.div 
                  animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ 
                    duration: 5, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: index * 0.3 
                  }}
                  className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  <step.icon className="w-10 h-10 text-white" strokeWidth={1.5} />
                </motion.div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
