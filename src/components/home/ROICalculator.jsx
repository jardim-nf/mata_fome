// src/components/home/ROICalculator.jsx
import React, { useState } from 'react';
import { IoCalculatorOutline, IoCashOutline, IoTrendingUp, IoWalletOutline } from 'react-icons/io5';

const ROICalculator = () => {
  const [faturamentoMensal, setFaturamentoMensal] = useState(45000);
  const [taxaConcorrente, setTaxaConcorrente] = useState(8); // Em % (Perdas por desperdício/licenças)

  // Cálculos
  const perdidoMensal = faturamentoMensal * (taxaConcorrente / 100);
  const perdidoAnual = perdidoMensal * 12;

  return (
    <section className="py-24 bg-slate-950 text-white relative overflow-hidden border-t border-slate-900">
      {/* Background glow effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-orange-500/5 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[50%] h-[50%] rounded-full bg-red-500/5 blur-3xl"></div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 text-orange-400 font-bold text-xs mb-6 border border-orange-500/20 uppercase tracking-widest shadow-sm">
            <IoCalculatorOutline className="text-sm" />
            <span>Simulador de Ganhos</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-6">
            Descubra o quanto você deixa <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">na mesa.</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Múltiplos sistemas, planilhas desintegradas e furos de estoque custam caro. Veja quanto o Idea System pode economizar para a sua empresa hoje.
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-md rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border border-white/10 flex flex-col lg:flex-row gap-12 lg:items-stretch">
          
          {/* Lado Esquerdo - Controles */}
          <div className="flex-1 flex flex-col justify-between gap-8">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-base font-bold text-slate-300">Seu Faturamento Mensal (Varejo/Atacado)</label>
                  <span className="text-2xl font-black text-orange-400">
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
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/20"
                />
                <div className="flex justify-between text-xs font-bold text-slate-500 mt-2 uppercase tracking-wide">
                  <span>R$ 10k</span>
                  <span>R$ 300k+</span>
                </div>
              </div>

              <div>
                 <div className="flex justify-between items-center mb-4">
                  <label className="text-base font-bold text-slate-300">Desperdício Estimado com Sistemas e Estoque</label>
                  <span className="text-2xl font-black text-red-400">
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
                  className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500 focus:outline-none focus:ring-4 focus:ring-red-500/20"
                />
                 <div className="flex justify-between text-xs font-bold text-slate-500 mt-2 uppercase tracking-wide">
                  <span>Eficiência Alta (3%)</span>
                  <span>Desintegração Crítica (20%)</span>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-950/80 p-6 rounded-2xl border border-white/5 flex items-start gap-4">
               <div className="w-12 h-12 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center text-slate-450 shadow-sm shrink-0">
                  <IoWalletOutline className="text-2xl text-slate-400" />
               </div>
               <div>
                 <p className="text-sm font-bold text-white mb-1">Centralize e Automatize Tudo</p>
                 <p className="text-xs text-slate-400 leading-relaxed font-medium">Una PDV, ERP, WMS e canais digitais de venda em uma única plataforma para eliminar furos de estoque, digitações manuais e licenças redundantes.</p>
               </div>
            </div>
          </div>

          {/* Lado Direito - Resultados */}
          <div className="flex-1 bg-slate-950/80 rounded-[2rem] p-8 sm:p-10 relative overflow-hidden group shadow-2xl border border-orange-500/10 flex flex-col justify-between">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-3xl pointer-events-none transform translate-x-1/3 -translate-y-1/3 group-hover:bg-orange-500/10 transition-all duration-700"></div>
            
            <div className="relative z-10 h-full flex flex-col justify-between gap-8">
               <div>
                 <p className="text-orange-400 font-extrabold uppercase tracking-widest text-xs flex items-center gap-2 mb-4">
                    <IoTrendingUp className="text-base" /> Seu Potencial de Economia
                 </p>
                 <h3 className="text-white text-2xl md:text-3xl font-black mb-6 leading-tight">
                   Veja o custo da <span className="text-red-400 underline decoration-red-400/50 underline-offset-4">desintegração e desperdício</span> ao ano:
                 </h3>

                 <div className="space-y-6">
                   <div className="flex flex-col">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Desperdício Mensal Estimado</span>
                      <span className="text-3xl font-black text-rose-500">R$ {perdidoMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                   </div>
                   
                   <div className="h-px w-full bg-white/10"></div>

                   <div className="flex flex-col">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex justify-between items-center">
                         Economia Anual com o Idea System:
                         <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full font-black tracking-widest">WOW!</span>
                      </span>
                      <span className="text-4xl sm:text-5xl font-black text-orange-400 tracking-tight drop-shadow-sm flex items-baseline">
                         <span className="text-xl mr-1.5 text-orange-500/80">R$</span>{perdidoAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                   </div>
                 </div>
               </div>

               <div className="pt-6 border-t border-white/10">
                  <p className="text-slate-400 text-sm mb-6 leading-relaxed font-medium">
                     Com o <strong className="text-white font-black">Idea System</strong>, você centraliza sua operação com mensalidade fixa e sem taxas sobre seu crescimento.
                  </p>
                  <button 
                    onClick={() => {
                      const phoneNumber = "5522998102575";
                      const message = "Olá! Gostaria de saber mais sobre como centralizar minha gestão e economizar com o Idea System.";
                      window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-650 hover:from-orange-650 hover:to-red-700 text-slate-950 font-black py-4 px-8 rounded-xl text-base uppercase tracking-wider transition-all transform hover:scale-[1.03] active:scale-95 shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2"
                  >
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
