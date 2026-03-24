// src/components/home/HowItWorks.jsx
import { Search, ShoppingBag, Truck } from 'lucide-react';
import AnimatedSection from './AnimatedSection';

const steps = [
  {
    icon: Search,
    number: '01',
    title: 'Escolha',
    description: 'Navegue pelos melhores restaurantes e lanchonetes da sua cidade',
    color: 'from-yellow-400 to-orange-400',
    bg: 'bg-yellow-50',
  },
  {
    icon: ShoppingBag,
    number: '02',
    title: 'Peça',
    description: 'Monte seu pedido com facilidade e pague como preferir',
    color: 'from-orange-400 to-red-400',
    bg: 'bg-orange-50',
  },
  {
    icon: Truck,
    number: '03',
    title: 'Receba',
    description: 'Acompanhe em tempo real e receba na sua porta rapidinho',
    color: 'from-green-400 to-emerald-500',
    bg: 'bg-green-50',
  },
];

const HowItWorks = () => {
  return (
    <section className="py-20 md:py-28 px-4 bg-white">
      <div className="container mx-auto">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Como <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Funciona</span>
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Pedir ficou simples. Três passos e pronto!
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto mt-6 rounded-full" />
        </AnimatedSection>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 max-w-5xl mx-auto relative">
          {/* Connecting line (desktop) */}
          <div className="hidden md:block absolute top-24 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-yellow-300 via-orange-300 to-green-300 opacity-40" />

          {steps.map((step, index) => (
            <AnimatedSection key={index} delay={index * 0.2}>
              <div className={`relative text-center p-8 rounded-3xl ${step.bg} border border-gray-100 hover:shadow-xl transition-shadow duration-500 group`}>
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-bold text-white bg-gradient-to-r ${step.color} px-3 py-1 rounded-full">
                  PASSO {step.number}
                </div>

                {/* Icon */}
                <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="w-10 h-10 text-white" strokeWidth={1.5} />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
