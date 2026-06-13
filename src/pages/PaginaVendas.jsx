// src/pages/PaginaVendas.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FiPhone, FiCheck, FiChevronDown, FiChevronUp, FiDollarSign, 
  FiTrendingUp, FiCheckCircle, FiShield, FiCpu, FiMessageSquare, 
  FiSmartphone, FiPrinter, FiFileText, FiAward, FiArrowRight,
  FiActivity, FiTarget, FiHelpCircle
} from 'react-icons/fi';

export default function PaginaVendas() {
  // Estado para o FAQ Accordion
  const [openFaq, setOpenFaq] = useState(null);

  // Estados do Simulador de ROI
  const [faturamento, setFaturamento] = useState(30000); // Faturamento padrão: R$ 30.000
  const [porcentagemIfood, setPorcentagemIfood] = useState(70); // % de vendas no iFood: 70%

  // Cálculos do Simulador
  const ROI = useMemo(() => {
    const vendasIfood = faturamento * (porcentagemIfood / 100);
    // Taxa média estimada do iFood: 22% (comissão + taxa de pagamento + entrega)
    const taxaIfoodMensal = vendasIfood * 0.22;
    const taxaIfoodAnual = taxaIfoodMensal * 12;

    // Custo mensal do IdeaFood (Plano Essencial: R$ 150)
    const mensalidadeIdeaFood = 150;
    const custoIdeaFoodAnual = mensalidadeIdeaFood * 12;

    const economiaMensal = taxaIfoodMensal - mensalidadeIdeaFood;
    const economiaAnual = economiaMensal * 12;

    return {
      vendasIfood,
      taxaIfoodMensal,
      taxaIfoodAnual,
      custoIdeaFoodAnual,
      economiaMensal: economiaMensal > 0 ? economiaMensal : 0,
      economiaAnual: economiaAnual > 0 ? economiaAnual : 0,
    };
  }, [faturamento, porcentagemIfood]);

  // Efeito para carregar as fontes elegantes do Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;850&family=JetBrains+Mono:wght@400;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const WHATSAPP_LINK = "https://wa.me/5522998102575?text=Olá! Vim pela página de vendas e gostaria de saber mais sobre o IdeaFood e ativar minha conta.";

  const faqs = [
    {
      q: "Preciso pagar taxa por cada pedido realizado?",
      a: "Não! Ao contrário do iFood e outros marketplaces, o IdeaFood não cobra nenhuma comissão sobre suas vendas. Todo o lucro das vendas do seu cardápio digital vai direto para o seu bolso. Você paga apenas uma mensalidade fixa de acordo com o plano escolhido."
    },
    {
      q: "O IdeaFood necessita que os clientes baixem algum aplicativo?",
      a: "Não é necessário. O cardápio digital do IdeaFood é um PWA (Progressive Web App). Isso significa que seu cliente acessa instantaneamente por um link ou QR Code no navegador, e se ele desejar, pode instalar na tela inicial do celular com apenas um toque, sem ocupar espaço no armazenamento e sem passar por lojas de aplicativos."
    },
    {
      q: "Como funciona a integração com impressoras térmicas?",
      a: "O IdeaFood possui um módulo de impressão inteligente. Quando um novo pedido chega, ele é enviado automaticamente para o seu painel e pode ser impresso de forma instantânea nas suas impressoras de produção (cozinha, copa, caixa), agilizando a preparação sem trabalho manual."
    },
    {
      q: "Posso emitir Notas Fiscais (NFC-e) pelo sistema?",
      a: "Sim. O IdeaFood conta com emissão simplificada de NFC-e (Nota Fiscal de Consumidor Eletrônica) integrada diretamente no fluxo de fechamento de caixa e gestão de pedidos, permitindo manter o seu negócio 100% regularizado fiscalmente com poucos cliques."
    },
    {
      q: "Tem fidelidade contratual? Se eu quiser cancelar, pago multa?",
      a: "Não há fidelidade nem taxas de cancelamento. Nós confiamos na qualidade e no retorno financeiro que o IdeaFood traz para o seu restaurante. Você pode cancelar ou alterar seu plano a qualquer momento diretamente pelo painel administrativo."
    },
    {
      q: "Vocês ajudam na configuração inicial do cardápio?",
      a: "Com certeza! Nossa equipe de suporte faz o acompanhamento inicial, ajuda você a cadastrar seus primeiros produtos, configurar as áreas de entrega com taxas e conectar seu robô de pedidos do WhatsApp para que você comece a vender no mesmo dia."
    }
  ];

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 font-jakarta antialiased selection:bg-[#FFD400] selection:text-slate-900 overflow-x-hidden relative">
      
      {/* Estilos customizados locais de tipografia e gradientes */}
      <style>{`
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        
        .glowing-gold-text {
          background: linear-gradient(135deg, #FFF 30%, #FFD400 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .premium-glow-box {
          position: relative;
        }
        .premium-glow-box::after {
          content: '';
          position: absolute;
          inset: -1px;
          background: linear-gradient(135deg, rgba(255,212,0,0.4) 0%, rgba(255,212,0,0.05) 50%, rgba(255,255,255,0.05) 100%);
          border-radius: inherit;
          z-index: -1;
          pointer-events: none;
        }

        .premium-border-hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .premium-border-hover:hover {
          border-color: rgba(255, 212, 0, 0.4);
          box-shadow: 0 10px 30px -10px rgba(255, 212, 0, 0.15);
          transform: translateY(-2px);
        }
      `}</style>

      {/* Glowes de Fundo Atmosféricos */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#FFD400]/10 to-transparent blur-[130px] pointer-events-none z-0" />
      <div className="absolute top-[40%] right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-amber-500/5 to-transparent blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-yellow-600/5 to-transparent blur-[140px] pointer-events-none z-0" />

      {/* NAVBAR */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#FFD400] flex items-center justify-center font-outfit font-black text-slate-950 text-xl shadow-lg shadow-[#FFD400]/25">
              iF
            </div>
            <span className="text-2xl font-black font-outfit tracking-tight text-white">
              Idea<span className="text-[#FFD400]">Food</span>
            </span>
          </div>

          {/* Links Nav */}
          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <a href="#beneficios" className="hover:text-white transition-colors">Benefícios</a>
            <a href="#roi-simulador" className="hover:text-white transition-colors">Simulador</a>
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
            <a href="#faq" className="hover:text-white transition-colors">Dúvidas</a>
          </div>

          {/* CTA Nav */}
          <div>
            <a 
              href={WHATSAPP_LINK} 
              target="_blank" 
              rel="noreferrer"
              className="bg-slate-900 border border-slate-800 hover:border-[#FFD400]/30 hover:bg-slate-850 text-white font-bold py-2.5 px-5 rounded-full text-sm transition-all flex items-center gap-2 hover:shadow-[0_0_15px_rgba(255,212,0,0.1)]"
            >
              <FiPhone className="text-[#FFD400]" />
              Falar com Consultor
            </a>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-24 md:py-32 px-6 max-w-7xl mx-auto z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        
        {/* Lado Esquerdo: Texto */}
        <div className="lg:col-span-7 space-y-8 text-left">
          
          {/* Tag Promocional */}
          <div className="inline-flex items-center gap-2 bg-[#FFD400]/10 border border-[#FFD400]/20 rounded-full py-1.5 px-4">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD400] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFD400]"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-widest text-[#FFD400] font-mono">
              Comissão 0% • Seu Lucro Integral
            </span>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl md:text-6xl font-black font-outfit tracking-tight leading-[1.08] text-white">
            Pare de dar até <span className="text-red-500 line-through">27%</span> de suas vendas para aplicativos de delivery
          </h1>

          {/* Descrição */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl font-light leading-relaxed">
            Tenha seu próprio <strong className="text-white font-semibold">Cardápio Digital PWA</strong> e conecte-o diretamente ao WhatsApp e impressoras locais. Economize milhares de reais em taxas abusivas com o sistema PDV completo do <strong className="text-[#FFD400] font-bold">IdeaFood</strong>.
          </p>

          {/* Ações / CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="bg-[#FFD400] hover:bg-[#ffe240] text-slate-950 font-black py-4 px-8 rounded-full text-center uppercase tracking-wider text-sm transition-all shadow-lg shadow-[#FFD400]/20 active:scale-95 flex items-center justify-center gap-2"
            >
              Falar com Especialista
              <FiArrowRight size={16} />
            </a>
            
            <a 
              href="#roi-simulador"
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold py-4 px-8 rounded-full text-center text-sm transition-all active:scale-95"
            >
              Simular Economia
            </a>
          </div>

          {/* Benefícios rápidos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-900 pt-8 mt-4">
            {[
              { t: 'Sem Instalação Complicada', d: 'Seu cliente clica e pede' },
              { t: 'Impressão Automática', d: 'Direto na sua cozinha' },
              { t: 'IA de Demanda Inclusa', d: 'Previsão inteligente de estoque' }
            ].map((b, i) => (
              <div key={i} className="space-y-1">
                <p className="text-sm font-bold text-white flex items-center gap-1.5">
                  <FiCheckCircle className="text-[#FFD400] shrink-0" size={14} />
                  {b.t}
                </p>
                <p className="text-xs text-slate-500 font-medium">{b.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lado Direito: Mockup Visual Premium */}
        <div className="lg:col-span-5 relative flex justify-center items-center">
          
          {/* Efeito Glow atrás do Mockup */}
          <div className="absolute w-[350px] h-[350px] bg-[#FFD400]/10 rounded-full blur-[80px] z-0" />

          {/* Container de Dispositivos */}
          <div className="relative z-10 w-full max-w-[400px] md:max-w-none">
            
            {/* Tablet / Dashboard Mockup */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-4 md:w-[480px] lg:w-[440px] xl:w-[480px] relative z-10 transform lg:-translate-x-12 xl:-translate-x-16 hover:scale-[1.02] transition-transform duration-500">
              {/* Barra do Navegador */}
              <div className="flex items-center gap-1.5 pb-3 border-b border-slate-800 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-[10px] text-slate-500 font-mono ml-2">ideafood.com.br/painel</span>
              </div>
              
              {/* Conteúdo Simulado do PDV */}
              <div className="space-y-3 font-mono text-[10px] text-slate-400">
                <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[#FFD400] font-bold">🟢 NOVO PEDIDO #4829</span>
                  <span className="bg-[#FFD400]/10 text-[#FFD400] text-[8px] font-bold px-1.5 py-0.5 rounded">R$ 78,50</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <p className="text-[11px] font-bold text-white">🍕 Pizza Meio a Meio (Calabresa / 4 Queijos)</p>
                  <p className="text-[9px] text-slate-500">• Borda Recheada de Catupiry</p>
                  <p className="text-[9px] text-slate-500">• Coca-Cola Zero Lata</p>
                  <div className="h-px bg-slate-850 my-1.5" />
                  <div className="flex justify-between text-[8px]">
                    <span>Cliente: Matheus Jardim</span>
                    <span className="text-emerald-400 font-bold">Pago via PIX</span>
                  </div>
                </div>

                {/* Status bar */}
                <div className="grid grid-cols-4 gap-1 text-[8px] font-bold text-center">
                  <span className="bg-amber-500/20 text-amber-400 py-1 rounded border border-amber-500/30">Recebido</span>
                  <span className="bg-slate-950 text-slate-600 py-1 rounded border border-slate-850">Preparo</span>
                  <span className="bg-slate-950 text-slate-600 py-1 rounded border border-slate-850">Entrega</span>
                  <span className="bg-slate-950 text-slate-600 py-1 rounded border border-slate-850">Concluído</span>
                </div>
              </div>
            </div>

            {/* Celular / Cardápio Cliente Mockup */}
            <div className="absolute right-0 bottom-[-40px] md:bottom-[-60px] w-[200px] md:w-[220px] bg-slate-950 border border-slate-800 rounded-[32px] p-2.5 shadow-2xl z-20 transform translate-x-4 md:translate-x-8 hover:scale-[1.05] transition-transform duration-500">
              {/* Alto-falante / Notch */}
              <div className="w-20 h-4 bg-black rounded-full mx-auto mb-3 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              </div>

              {/* Interface do Cardápio */}
              <div className="bg-[#0b0f19] rounded-[24px] overflow-hidden p-2 text-left space-y-3" style={{ height: '280px' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 bg-[#FFD400] rounded-md flex items-center justify-center font-bold text-[10px] text-black">i</div>
                  <span className="text-[10px] font-bold text-white">IdeaFood Burger</span>
                </div>

                {/* Banner de Produto */}
                <div className="bg-slate-900 rounded-lg p-2 relative overflow-hidden flex flex-col justify-end" style={{ height: '90px' }}>
                  <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[7px] font-black uppercase px-1 py-0.5 rounded">Destaque</div>
                  <div className="z-10">
                    <p className="text-[9px] font-bold text-white">Double Cheddar Bacon</p>
                    <p className="text-[8px] text-[#FFD400] font-black">R$ 34,90</p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent opacity-80" />
                </div>

                {/* Botão de Adicionar ao Carrinho */}
                <button className="w-full bg-[#FFD400] text-slate-950 text-[9px] font-black py-2 rounded-xl text-center uppercase tracking-wider flex items-center justify-center gap-1">
                  🛒 Adicionar ao Carrinho
                </button>

                {/* Opções de Entrega */}
                <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-1.5 space-y-1">
                  <div className="flex justify-between items-center text-[7px] font-bold text-slate-400">
                    <span>🛵 Delivery</span>
                    <span className="text-emerald-400">30 - 45 min</span>
                  </div>
                  <div className="flex justify-between items-center text-[7px] font-bold text-slate-400">
                    <span>🛍️ Retirada</span>
                    <span>15 min</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SEÇÃO SIMULADOR DE ROI */}
      <section id="roi-simulador" className="py-24 border-t border-slate-900 bg-slate-950/40 relative z-10 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          
          <div className="space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-[#FFD400] font-mono">Calculadora de Economia Real</span>
            <h2 className="text-3xl md:text-5xl font-black font-outfit tracking-tight text-white">
              Veja o quanto você está deixando na mesa
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto font-light">
              Mova os controles deslizantes abaixo e descubra quanto seu restaurante economizará anualmente trocando as taxas abusivas dos marketplaces por uma assinatura fixa do IdeaFood.
            </p>
          </div>

          {/* Painel do Simulador */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch text-left">
            
            {/* Controles Sliders (Lado Esquerdo) */}
            <div className="lg:col-span-7 bg-slate-900/50 border border-slate-800/80 rounded-3xl p-8 space-y-8 flex flex-col justify-center">
              
              {/* Slider 1: Faturamento */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-300">Faturamento Mensal do Delivery</label>
                  <span className="text-lg font-black text-[#FFD400] font-mono bg-[#FFD400]/10 border border-[#FFD400]/20 px-3 py-1 rounded-lg">
                    R$ {faturamento.toLocaleString('pt-BR')}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="5000" 
                  max="150000" 
                  step="5000"
                  value={faturamento}
                  onChange={(e) => setFaturamento(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#FFD400]"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
                  <span>R$ 5.000</span>
                  <span>R$ 75.000</span>
                  <span>R$ 150.000+</span>
                </div>
              </div>

              {/* Slider 2: Porcentagem do iFood */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-300">Vendas que passam por Aplicativos de Terceiros (ex: iFood)</label>
                  <span className="text-lg font-black text-amber-500 font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-lg">
                    {porcentagemIfood}%
                  </span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  step="5"
                  value={porcentagemIfood}
                  onChange={(e) => setPorcentagemIfood(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
                  <span>10%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed flex items-start gap-1.5">
                <FiHelpCircle className="shrink-0 text-[#FFD400] mt-0.5" size={12} />
                Calculado com base na taxa média de mercado de 22% cobrada pelos marketplaces principais (comissões sobre produtos + taxas transacionais de cartões online e taxa de entrega mínima).
              </p>
            </div>

            {/* Resultado do ROI (Lado Direito) */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-950 border border-[#FFD400]/20 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-2xl shadow-[#FFD400]/5">
              
              {/* Efeito Glow Interno */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FFD400]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <FiTrendingUp size={16} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 font-mono">Economia Líquida Estimada</span>
                </div>

                {/* Economia Mensal */}
                <div className="space-y-1">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Você economiza todo mês</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white">R$</span>
                    <span className="text-4xl md:text-5xl font-black font-outfit text-white tracking-tight">
                      {ROI.economiaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Economia Anual Destaque */}
                <div className="bg-[#FFD400]/5 border border-[#FFD400]/10 rounded-2xl p-4 space-y-1">
                  <span className="text-[10px] font-black uppercase text-[#FFD400] tracking-widest">Economia total por ano</span>
                  <p className="text-2xl md:text-3xl font-black font-outfit text-[#FFD400]">
                    R$ {ROI.economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">Equivale a economizar {(ROI.economiaAnual / 12).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} cestas de taxas abusivas!</p>
                </div>
              </div>

              {/* Botão de Ação do Simulador */}
              <div className="pt-8 space-y-4">
                <a 
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-[#FFD400] hover:bg-[#ffe240] text-slate-950 font-black py-4 px-6 rounded-2xl text-center uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FFD400]/10"
                >
                  Garantir Minha Economia
                  <FiArrowRight size={14} />
                </a>
                <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-wider font-mono">
                  Setup gratuito incluso por tempo limitado
                </p>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* BENTO GRID DE FUNCIONALIDADES */}
      <section id="funcionalidades" className="py-24 px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-[#FFD400] font-mono">Tecnologia de Ponta</span>
          <h2 className="text-3xl md:text-5xl font-black font-outfit tracking-tight text-white">
            Tudo o que seu negócio precisa para crescer
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto font-light">
            Esqueça sistemas incompletos e lentos. O IdeaFood foi projetado para integrar a operação, marketing, fiscal e automações em um único lugar.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Card 1: Cardápio PWA (Destaque Grande) */}
          <div className="md:col-span-8 bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between premium-glow-box premium-border-hover min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
              <FiSmartphone size={22} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl md:text-2xl font-bold text-white">Cardápio Digital PWA de Alta Velocidade</h3>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                Cardápio digital que abre em menos de 1 segundo. Sem necessidade de instalar aplicativos pela App Store ou Google Play. Seu cliente pode navegar pelas categorias, escolher variações de ingredientes e finalizar o pedido direto de qualquer smartphone de forma simples e intuitiva.
              </p>
            </div>
          </div>

          {/* Card 2: Robô WhatsApp (Pequeno) */}
          <div className="md:col-span-4 bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between premium-glow-box premium-border-hover min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-6">
              <FiMessageSquare size={22} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">Integração WhatsApp</h3>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                Conecte seu sistema a um atendente virtual automático que responde e processa pedidos iniciados no WhatsApp sem interferência manual.
              </p>
            </div>
          </div>

          {/* Card 3: Impressão Automática (Pequeno) */}
          <div className="md:col-span-4 bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between premium-glow-box premium-border-hover min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-[#FFD400]/10 border border-[#FFD400]/20 flex items-center justify-center text-[#FFD400] mb-6">
              <FiPrinter size={22} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">Impressão Automática</h3>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                Módulo local que envia as comandas de produção diretamente para as impressoras da cozinha e do bar no exato instante em que o pedido é aceito.
              </p>
            </div>
          </div>

          {/* Card 4: IA e Demanda (Destaque Grande) */}
          <div className="md:col-span-8 bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between premium-glow-box premium-border-hover min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
              <FiCpu size={22} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-bold text-white">Previsão de Demanda com Inteligência Artificial</h3>
                <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full font-mono">IA Nativa</span>
              </div>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                Nossa rede neural estuda o histórico de vendas do seu estabelecimento e cruza dados para prever a demanda de vendas dos próximos 7 dias. Saiba exatamente quanto estoque comprar, evite desperdícios e planeje as escalas de pessoal de forma científica e simplificada.
              </p>
            </div>
          </div>

          {/* Card 5: NFC-e Fiscal */}
          <div className="md:col-span-6 bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between premium-glow-box premium-border-hover min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
              <FiFileText size={22} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">Monitoramento e Emissão de NFC-e</h3>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                Emita cupons fiscais eletrônicos integrados no fechamento do pedido de forma imediata. Controle os impostos, evite multas e faça a gestão tributária de forma simples e tranquila diretamente com o financeiro.
              </p>
            </div>
          </div>

          {/* Card 6: Gestão de Acessos & Master */}
          <div className="md:col-span-6 bg-slate-900/40 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between premium-glow-box premium-border-hover min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-6">
              <FiAward size={22} />
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-white">Controle de Equipes e Múltiplas Lojas</h3>
              <p className="text-sm text-slate-400 font-light leading-relaxed">
                Configure permissões de usuários detalhadas para garçons, gerentes, caixas e motoboys. Se você possui uma franquia ou rede de restaurantes, gerencie todas as lojas através de um painel de controle Master unificado.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* SEÇÃO DE PLANOS REDESENHADA */}
      <section id="planos" className="py-24 border-t border-slate-900 bg-slate-950/20 relative z-10 px-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center space-y-4 mb-16">
            <span className="text-xs font-black uppercase tracking-widest text-[#FFD400] font-mono">Preço Justo e Sem Surpresas</span>
            <h2 className="text-3xl md:text-5xl font-black font-outfit tracking-tight text-white">
              Investimento Simples e Transparente
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto font-light">
              Uma solução completa adaptada às necessidades do seu estabelecimento. Sem multas de rescisão ou taxas ocultas.
            </p>
          </div>

          {/* Grid de Planos com 1 Card Centralizado */}
          <div className="max-w-md mx-auto">
            
            {/* Plano Único/Destaque */}
            <div className="bg-slate-900 border-2 border-[#FFD400] rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-[#FFD400]/5 transform md:-translate-y-4 premium-border-hover">
              
              {/* Badge de Destaque */}
              <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-[#FFD400] text-slate-950 font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-full font-mono shadow-md whitespace-nowrap">
                Plano Completo
              </div>

              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-2xl font-black text-white font-outfit">IdeaFood PDV + Delivery</h3>
                  <p className="text-xs text-slate-400 mt-2">Toda a infraestrutura para automatizar suas vendas e delivery.</p>
                </div>
                
                <div className="flex flex-col items-center justify-center py-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <span className="text-[10px] font-black text-[#FFD400] uppercase tracking-widest font-mono">A partir de</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-[#FFD400]">R$</span>
                    <span className="text-6xl font-black font-outfit text-white">150</span>
                    <span className="text-sm text-slate-450 font-medium">/mês</span>
                  </div>
                </div>

                <div className="h-px bg-slate-800" />

                <ul className="space-y-3.5 text-xs text-slate-300 font-semibold px-2">
                  <li className="flex items-center gap-2.5">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Cardápio Online PWA Ilimitado
                  </li>
                  <li className="flex items-center gap-2.5">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Painel de Pedidos & Gestão de Mesas
                  </li>
                  <li className="flex items-center gap-2.5">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Módulo de WhatsApp Automático
                  </li>
                  <li className="flex items-center gap-2.5">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Impressão Automática na Cozinha/Bar
                  </li>
                  <li className="flex items-center gap-2.5">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Relatórios Financeiros e Margem de Lucro
                  </li>
                  <li className="flex items-center gap-2.5">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Suporte VIP com Acompanhamento Inicial
                  </li>
                  <li className="flex items-center gap-2.5 text-slate-400">
                    <FiCheck className="text-[#FFD400] shrink-0" size={15} />
                    Módulos Fiscais (NFC-e) & IA (Opcionais)
                  </li>
                </ul>
              </div>

              <div className="pt-8">
                <a 
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full block bg-[#FFD400] hover:bg-[#ffe240] text-slate-950 font-black py-4 px-4 rounded-xl text-center text-xs uppercase tracking-wider transition-colors shadow-lg shadow-[#FFD400]/10"
                >
                  Começar Agora
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-24 px-6 max-w-4xl mx-auto relative z-10">
        <div className="text-center space-y-4 mb-16">
          <span className="text-xs font-black uppercase tracking-widest text-[#FFD400] font-mono">Dúvidas Frequentes</span>
          <h2 className="text-3xl md:text-5xl font-black font-outfit tracking-tight text-white">
            Perguntas Comuns
          </h2>
          <p className="text-slate-400 font-light max-w-xl mx-auto">
            Tem dúvidas sobre o IdeaFood? Respondemos às principais perguntas dos proprietários.
          </p>
        </div>

        {/* Lista FAQ */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div 
                key={idx}
                className="bg-slate-900/40 border border-slate-850 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-6 flex justify-between items-center text-left text-white font-bold text-sm md:text-base transition-colors hover:text-[#FFD400]"
                >
                  <span className="pr-4">{faq.q}</span>
                  {isOpen ? <FiChevronUp className="text-[#FFD400] shrink-0" /> : <FiChevronDown className="text-slate-500 shrink-0" />}
                </button>
                
                {isOpen && (
                  <div className="px-6 pb-6 pt-1 border-t border-slate-850 text-xs md:text-sm text-slate-400 font-light leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO CTA FINAL */}
      <section className="py-24 border-t border-slate-900 bg-slate-950 relative z-10 px-6 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#FFD400]/10 rounded-full blur-[90px] pointer-events-none" />
        
        <div className="max-w-3xl mx-auto space-y-8 relative z-10">
          <div className="w-16 h-16 bg-[#FFD400]/10 border border-[#FFD400]/20 rounded-2xl mx-auto flex items-center justify-center text-[#FFD400] mb-4">
            <FiActivity size={28} />
          </div>
          
          <h2 className="text-3xl md:text-5xl font-black font-outfit tracking-tight text-white">
            Pare de pagar comissão. Tenha o controle total do seu delivery hoje.
          </h2>
          
          <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto font-light leading-relaxed">
            Junte-se a centenas de restaurantes que já digitalizaram seus pedidos e recuperaram a margem de lucro com o IdeaFood.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a 
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="bg-[#FFD400] hover:bg-[#ffe240] text-slate-950 font-black py-4 px-10 rounded-full text-center uppercase tracking-wider text-sm transition-all shadow-lg shadow-[#FFD400]/25 hover:scale-[1.01]"
            >
              Criar Meu Cardápio Agora
            </a>
          </div>

          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest font-mono pt-4">
            Ativação rápida em até 24 horas • Sem fidelidade
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-black/60 py-12 px-6 relative z-10 text-center text-slate-500 text-xs font-medium space-y-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#FFD400] flex items-center justify-center font-outfit font-black text-slate-950 text-xs">
              iF
            </div>
            <span className="text-sm font-black font-outfit tracking-tight text-white">
              Idea<span className="text-[#FFD400]">Food</span>
            </span>
          </div>
          
          <p>&copy; {new Date().getFullYear()} IdeaFood. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
