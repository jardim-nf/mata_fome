import React, { useState } from 'react';
import { IoCalculatorOutline, IoCashOutline, IoTrendingUp, IoWalletOutline } from 'react-icons/io5';

const ROICalculator = () => {
  const [faturamentoMensal, setFaturamentoMensal] = useState(45000);
  const [taxaConcorrente, setTaxaConcorrente] = useState(8); // Em % (Perdas por desperdício/licenças)

  // Cálculos
  const perdidoMensal = faturamentoMensal * (taxaConcorrente / 100);
  const perdidoAnual = perdidoMensal * 12;

  return (
    <section className="py-24 bg-white relative overflow-hidden border-y border-slate-100">
      {/* Elementos de fundo dinâmicos */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-orange-500/5 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-red-500/5 blur-3xl"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-50 text-orange-600 font-bold text-sm mb-6 border border-orange-100 uppercase tracking-widest shadow-sm">
            <IoCalculatorOutline className="text-lg" />
            <span>Simulador de Ganhos</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight mb-6">
            Descubra o quanto você deixa <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">na mesa.</span>
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
            Múltiplos sistemas, planilhas desintegradas e furos de estoque custam caro. Veja quanto o Idea System pode economizar para a sua empresa hoje.
          </p>
        </div>

        <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-[0_20px_50px_rgb(0,0,0,0.05)] border border-slate-100 flex flex-col lg:flex-row gap-12 lg:items-center">
          
          {/* Lado Esquerdo - Controles */}
          <div className="flex-1 space-y-10">
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-base font-bold text-slate-700">Seu Faturamento Mensal (Varejo/Atacado)</label>
                <span className="text-2xl font-black text-orange-600">
                  R$ {faturamentoMensal.toLocaleString('pt-BR')}
                </span>
              </div>
              <input 
                type="range" 
                min="10000" 
                max="300000" 
                step="5000" 
                value={faturamentoMensal} 
                onChange={(e) => setFaturamentoMensal(Number(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-500/20"
              />
              <div className="flex justify-between text-xs font-bold text-slate-400 mt-2 uppercase tracking-wide">
                <span>R$ 10k</span>
                <span>R$ 300k+</span>
              </div>
            </div>

            <div>
               <div className="flex justify-between items-center mb-4">
                <label className="text-base font-bold text-slate-700">Desperdício Estimado com Sistemas e Estoque</label>
                <span className="text-2xl font-black text-red-500">
                  {taxaConcorrente}%
                </span>
              </div>
              <input 
                type="range" 
                min="3" 
                max="20" 
                step="1" 
                value={taxaConcorrente} 
                onChange={(e) => setTaxaConcorrente(Number(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20"
              />
               <div className="flex justify-between text-xs font-bold text-slate-400 mt-2 uppercase tracking-wide">
                <span>Eficiência Alta (3%)</span>
                <span>Desintegração Crítica (20%)</span>
              </div>
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
               <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                  <IoWalletOutline className="text-2xl" />
               </div>
               <div>
                 <p className="text-sm font-bold text-slate-800 mb-1">Centralize e Automatize Tudo</p>
                 <p className="text-xs text-slate-500 leading-relaxed font-medium">Una PDV, ERP, WMS e canais digitais de venda em uma única plataforma para eliminar furos de estoque, digitações manuais e licenças redundantes.</p>
               </div>
            </div>
          </div>

          {/* Lado Direito - Resultados */}
          <div className="flex-1 bg-slate-900 rounded-[2rem] p-8 sm:p-10 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none transform translate-x-1/3 -translate-y-1/3 group-hover:bg-orange-500/20 transition-all duration-700"></div>
            
            <div className="relative z-10 h-full flex flex-col justify-center">
               <p className="text-orange-400 font-extrabold uppercase tracking-widest text-sm flex items-center gap-2 mb-4">
                  <IoTrendingUp className="text-lg" /> Seu Potencial de Economia
               </p>
               <h3 className="text-white text-3xl font-bold mb-8 leading-tight">
                 Veja o custo da <span className="text-red-400 underline decoration-red-400/50 underline-offset-4">desintegração e desperdício</span> ao ano:
               </h3>

               <div className="space-y-6">
                 <div className="flex flex-col">
                    <span className="text-slate-400 text-sm font-medium mb-1">Desperdício Mensal Estimado</span>
                    <span className="text-4xl font-black text-rose-500">R$ {perdidoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                 </div>
                 
                 <div className="h-px w-full bg-slate-800"></div>

                 <div className="flex flex-col">
                    <span className="text-slate-400 text-sm font-medium mb-1 flex justify-between items-center">
                       Economia Anual com o Idea System:
                       <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-widest">Wow!</span>
                    </span>
                    <span className="text-5xl sm:text-6xl font-black text-orange-400 tracking-tight drop-shadow-sm flex items-center">
                       <span className="text-2xl mr-2 text-orange-500/80">R$</span>{perdidoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                 </div>
               </div>

               <div className="mt-10 pt-8 border-t border-slate-800">
                  <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                     Com o <strong className="text-white font-black">Idea System</strong>, você centraliza sua operação com mensalidade fixa e sem taxas sobre seu crescimento.
                  </p>
                  <button 
                  onClick={() => {
                    const phoneNumber = "5522999812575";
                    const message = "Olá! Gostaria de saber mais sobre como centralizar minha gestão e economizar com o Idea System.";
                    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-slate-900 font-black py-4 px-8 rounded-xl text-lg uppercase tracking-wider transition-all transform hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/20 flex items-center justify-center gap-2">
                     <IoCashOutline className="text-2xl" /> Parar de Desperdiçar Agora
                  </button>
               </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default ROICalculator;
