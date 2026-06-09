// src/pages/Divulgacao.jsx — Material de Vendas PDF (Download Direto / Gerador Interativo)
import React, { useEffect, useState, useMemo } from 'react';
import { 
  FiPhone, FiSliders, FiEdit3, FiSettings, FiCheck, FiX, 
  FiMoon, FiSun, FiArrowLeft, FiDownload, FiCheckSquare, FiSquare,
  FiActivity, FiCheckCircle, FiSend, FiInbox
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const defaultFeatures = [
  { title: 'Cardápio Digital', desc: 'Menu completo com fotos, categorias, variações e QR Code para mesa.', cor: '#EF4444' },
  { title: 'Pedidos Online', desc: 'Delivery, retirada e salão. Pagamento integrado via Pix e cartão.', cor: '#F59E0B' },
  { title: 'App PWA', desc: 'Funciona como aplicativo no celular. Instala direto do navegador.', cor: '#3B82F6' },
  { title: 'Painel Admin', desc: 'Dashboard completo: pedidos em tempo real, relatórios e gráficos.', cor: '#8B5CF6' },
  { title: 'Notificações Push', desc: 'Alertas automáticos quando o status do pedido é alterado.', cor: '#10B981' },
  { title: 'Bot WhatsApp', desc: 'Cliente pede direto pelo WhatsApp com processamento automatizado.', cor: '#25D366' },
  { title: 'Avaliações', desc: 'Avaliações com estrelas e respostas do administrador no painel.', cor: '#F59E0B' },
  { title: 'Previsão de Demanda', desc: 'IA que prevê a demanda de vendas dos próximos 7 dias.', cor: '#06B6D4' },
  { title: 'Marketing Automático', desc: 'Reengajamento de clientes e cupom de aniversário automáticos.', cor: '#A855F7' },
  { title: 'Relatório de Lucro', desc: 'Exibe custos e margens de lucro reais por produto vendido.', cor: '#059669' },
  { title: 'Dividir Conta', desc: 'Divisão de conta simplificada direto no checkout do cliente.', cor: '#EC4899' },
  { title: 'Recuperação de Carrinho', desc: 'Identifica abandono de compra e exibe lembretes inteligentes.', cor: '#F97316' },
  { title: 'Controle de Estoque', desc: 'Entrada via XML de nota fiscal e alertas de estoque baixo.', cor: '#6366F1' },
  { title: 'Identidade Visual', desc: 'Cores, logo e tema personalizados para cada estabelecimento.', cor: '#E11D48' },
  { title: 'NFC-e / Fiscal', desc: 'Emissão automática de notas fiscais eletrônicas de venda.', cor: '#0D9488' },
  { title: 'Impressão Automática', desc: 'Imprime as comandas na cozinha imediatamente ao receber pedidos.', cor: '#64748B' },
];

const comparacaoItens = [
  { label: 'Cardápio Digital próprio', ifood: false, anota: true },
  { label: 'Sem taxa por pedido', ifood: false, anota: false },
  { label: 'Bot WhatsApp automatizado', ifood: false, anota: true },
  { label: 'Previsão de Demanda com IA', ifood: false, anota: false },
  { label: 'Marketing Automático', ifood: true, anota: true },
  { label: 'Relatório de Lucro real', ifood: false, anota: false },
  { label: 'Divisão de conta no checkout', ifood: true, anota: false },
  { label: 'Notificação Push nativa', ifood: true, anota: false },
  { label: 'Controle de Estoque via XML', ifood: false, anota: false },
  { label: 'NFC-e integrada', ifood: false, anota: false },
  { label: 'Identidade visual personalizável', ifood: false, anota: true },
];

function Divulgacao() {
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Estados Customizáveis do Gerador de Proposta
  const [nomeSistema, setNomeSistema] = useState('Idea');
  const [nomeSufixo, setNomeSufixo] = useState('Food');
  const [telefone, setTelefone] = useState('(22) 99810-2575');
  const [precoPlano, setPrecoPlano] = useState('150');
  const [periodoPlano, setPeriodoPlano] = useState(',00/mês');
  
  // Lista de índices dos recursos selecionados (por padrão, todos)
  const [recursosAtivos, setRecursosAtivos] = useState(() => defaultFeatures.map((_, i) => i));

  // Controle de Tema
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('dashboard_theme');
    return saved || 'dark';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('dashboard_theme', newTheme);
  };

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // Filtra os recursos que serão desenhados no PDF
  const featuresToShow = useMemo(() => {
    return defaultFeatures.filter((_, idx) => recursosAtivos.includes(idx));
  }, [recursosAtivos]);

  const handleToggleRecurso = (idx) => {
    if (recursosAtivos.includes(idx)) {
      if (recursosAtivos.length === 1) return toast.warn("Selecione pelo menos um recurso.");
      setRecursosAtivos(recursosAtivos.filter(i => i !== idx));
    } else {
      setRecursosAtivos([...recursosAtivos, idx].sort((a, b) => a - b));
    }
  };

  const handleSelectAll = () => {
    setRecursosAtivos(defaultFeatures.map((_, i) => i));
  };

  const handleDeselectAll = () => {
    setRecursosAtivos([0]); // deixa pelo menos o cardapio
  };

  const handleDownloadPDF = async () => {
    if (!ready || generating) return;
    setGenerating(true);

    // Salvar posição de scroll e rolar ao topo absoluto
    const scrollPos = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const element = document.getElementById('divulgacao-content');
      
      // Carrega html2pdf sob demanda
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;

      const opt = {
        margin: [0, 0, 0, 0],
        filename: `${nomeSistema}${nomeSufixo}-Proposta-Comercial.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1024,
          width: 1024,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { 
          mode: ['css'],
          before: '.pdf-page'
        }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setGenerating(false);
      // Restaurar scroll
      window.scrollTo(0, scrollPos);
    }
  };

  const themeClasses = {
    dark: {
      bg: 'bg-[#0b0f19]',
      surface: 'bg-slate-900/60 backdrop-blur-xl border-slate-800/80',
      text: 'text-slate-100',
      textSecondary: 'text-slate-400',
      textMuted: 'text-slate-500',
      border: 'border-slate-800/80',
      inputBg: 'bg-slate-950/60',
      btnAccent: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950',
    },
    light: {
      bg: 'bg-[#f1f5f9]',
      surface: 'bg-white/80 backdrop-blur-md border-slate-200/60',
      text: 'text-slate-900',
      textSecondary: 'text-slate-650',
      textMuted: 'text-slate-400',
      border: 'border-slate-200/60',
      inputBg: 'bg-slate-100/60',
      btnAccent: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white',
    }
  };

  const t = themeClasses[theme];

  return (
    <div className={`min-h-screen ${t.bg} flex flex-col lg:flex-row transition-colors duration-500 overflow-hidden relative`}>
      
      {/* ─── SIDEBAR DE CONFIGURAÇÃO (ESQUERDA) ─── */}
      <aside 
        className={`shrink-0 border-b lg:border-b-0 lg:border-r ${t.surface} ${t.border} p-6 flex flex-col justify-between overflow-y-auto z-30 transition-all duration-300 ${
          sidebarOpen ? 'w-full lg:w-[380px] h-[500px] lg:h-screen sticky top-0' : 'w-full lg:w-0 h-16 lg:h-screen lg:p-0 overflow-hidden'
        }`}
      >
        {sidebarOpen && (
          <div className="space-y-6 flex-1 pr-1">
            {/* Header Sidebar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center">
                  <FiSettings size={18} />
                </div>
                <div>
                  <h2 className={`font-black text-sm tracking-tight ${t.text}`}>Mídia Kit Builder</h2>
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Gerador de Propostas</p>
                </div>
              </div>
              <button 
                onClick={toggleTheme}
                className={`p-2 rounded-xl ${t.inputBg} border ${t.border} ${t.textSecondary} hover:${t.text} transition-colors`}
              >
                {theme === 'dark' ? <FiSun size={15} /> : <FiMoon size={15} />}
              </button>
            </div>

            <div className="w-full h-px bg-slate-700/20" />

            {/* Inputs de Customização */}
            <div className="space-y-4">
              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-1.5`}>Nome da Marca (Prefixo + Destaque)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    value={nomeSistema}
                    onChange={(e) => setNomeSistema(e.target.value)}
                    placeholder="Ex: Idea"
                    className={`w-full ${t.inputBg} border ${t.border} rounded-xl px-3 py-2 text-xs font-bold ${t.text} outline-none focus:border-amber-500 transition-colors`}
                  />
                  <input 
                    type="text" 
                    value={nomeSufixo}
                    onChange={(e) => setNomeSufixo(e.target.value)}
                    placeholder="Ex: Food"
                    className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-xs font-bold text-amber-500 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-1.5`}>Telefone de Contato</label>
                <div className="relative">
                  <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
                  <input 
                    type="text" 
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="Ex: (22) 99810-2575"
                    className={`w-full ${t.inputBg} border ${t.border} rounded-xl pl-8 pr-3 py-2.5 text-xs font-bold ${t.text} outline-none focus:border-amber-500 transition-colors`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[10px] font-black uppercase tracking-wider ${t.textMuted} mb-1.5`}>Preço do Plano & Período</label>
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    value={precoPlano}
                    onChange={(e) => setPrecoPlano(e.target.value)}
                    placeholder="Ex: 150"
                    className={`w-full ${t.inputBg} border ${t.border} rounded-xl px-3 py-2.5 text-xs font-bold ${t.text} outline-none focus:border-amber-500 transition-colors`}
                  />
                  <input 
                    type="text" 
                    value={periodoPlano}
                    onChange={(e) => setPeriodoPlano(e.target.value)}
                    placeholder="Ex: ,00/mês"
                    className={`w-full ${t.inputBg} border ${t.border} rounded-xl px-3 py-2.5 text-xs font-bold ${t.text} outline-none focus:border-amber-500 transition-colors`}
                  />
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-slate-700/20" />

            {/* Checklist de Recursos */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between items-center">
                <label className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>Recursos Inclusos ({recursosAtivos.length})</label>
                <div className="flex gap-2">
                  <button onClick={handleSelectAll} className="text-[9px] font-bold text-amber-500 hover:underline">Todos</button>
                  <span className="text-[9px] text-slate-600">|</span>
                  <button onClick={handleDeselectAll} className="text-[9px] font-bold text-amber-500 hover:underline">Nenhum</button>
                </div>
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-[220px] lg:max-h-none lg:flex-1 pr-1 border border-slate-800/10 dark:border-slate-800/40 p-2 rounded-2xl bg-black/5 dark:bg-black/10">
                {defaultFeatures.map((feat, i) => {
                  const active = recursosAtivos.includes(i);
                  return (
                    <button 
                      key={i}
                      onClick={() => handleToggleRecurso(i)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left border text-[11px] font-semibold transition-all ${
                        active 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                          : `${t.inputBg} ${t.border} ${t.textSecondary} opacity-60 hover:opacity-100`
                      }`}
                    >
                      <span className="truncate pr-2">{feat.title}</span>
                      {active ? <FiCheckSquare size={13} className="shrink-0" /> : <FiSquare size={13} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Download Button (Sidebar Footer) */}
        {sidebarOpen && (
          <div className="pt-4 border-t border-slate-700/20 space-y-3 mt-4">
            <button 
              onClick={handleDownloadPDF}
              disabled={generating || !ready}
              className={`w-full py-3.5 ${t.btnAccent} rounded-2xl font-bold text-xs shadow-lg hover:scale-[1.01] transition-all flex items-center justify-center gap-2`}
            >
              <FiDownload size={14} />
              {generating ? 'Exportando Proposta...' : 'Baixar Proposta PDF'}
            </button>
          </div>
        )}
      </aside>

      {/* Botão de Fechar/Abrir Sidebar Flutuante */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-7 left-4 z-40 p-2 rounded-xl shadow-lg border backdrop-blur-md transition-all ${
          theme === 'dark' ? 'bg-slate-900/90 border-slate-800 text-white' : 'bg-white/90 border-slate-200 text-slate-800'
        } ${sidebarOpen ? 'lg:left-[396px]' : 'left-4'}`}
        title={sidebarOpen ? "Ocultar Painel" : "Mostrar Painel"}
      >
        <FiSliders size={15} />
      </button>

      {/* ─── CANVAS VIEWER DE PÁGINAS A4 (DIREITA) ─── */}
      <main className="flex-1 overflow-y-auto h-screen py-10 px-4 flex flex-col items-center relative select-none">
        
        {/* Glow effects no canvas de visualização */}
        <div className="absolute top-[-10%] left-1/4 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-violet-500/10 to-transparent blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-blue-500/8 to-transparent blur-[100px] pointer-events-none" />

        <div className="mb-4 flex items-center justify-center gap-2 lg:-mt-2">
          <span className={`text-[10px] font-black uppercase tracking-wider ${t.textMuted}`}>Visualização A4 do Documento</span>
        </div>

        {/* CONTAINER IMPRIMÍVEL DO PDF */}
        <div id="divulgacao-content" className="flex flex-col items-center">
          
          {/* ═══ PÁGINA 1: HERO ═══ */}
          <div className="pdf-page bg-white relative shadow-2xl border border-slate-200/60 mb-10 flex flex-col justify-between" style={{ width: '794px', height: '1123px', padding: '80px 48px', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #fefce8 0%, #fffbeb 50%, #fef3c7 100%)', position: 'absolute', inset: 0, zIndex: 0 }} />
            
            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Header Pill */}
              <div className="text-center">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#b45309', padding: '8px 16px', borderRadius: 50, fontSize: 11, fontWeight: 900, border: '1px solid #fde68a', letterSpacing: 1 }}>
                  ⚡ SISTEMA COMPLETO PARA RESTAURANTES
                </div>
              </div>

              {/* Central Hero text */}
              <div className="text-center my-auto space-y-6">
                <h1 style={{ fontSize: 60, fontWeight: 900, color: '#1e293b', margin: 0, lineHeight: 1.1, letterSpacing: -2 }}>
                  {nomeSistema}<span style={{ color: '#f59e0b' }}>{nomeSufixo}</span>
                </h1>
                
                <p style={{ fontSize: 20, color: '#64748b', margin: '0 auto', fontWeight: 300, maxWidth: 550 }}>
                  O sistema que <strong style={{ color: '#1e293b' }}>transforma</strong> seu restaurante em uma <strong style={{ color: '#1e293b' }}>máquina de vendas</strong>
                </p>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                  Cardápio digital • Pedidos online • Delivery • Salão • Fiscal • Marketing — tudo em um só lugar
                </p>
              </div>

              {/* Stats badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, width: '100%' }}>
                {[['16+', 'Funcionalidades'], ['PWA', 'App sem loja'], ['24/7', 'Pedidos online'], ['IA', 'Previsão de Demanda']].map(([v, l], i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <p style={{ fontSize: 24, fontWeight: 900, color: '#1e293b', margin: 0 }}>{v}</p>
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', margin: '4px 0 0 0' }}>{l}</p>
                  </div>
                ))}
              </div>

              {/* Footer WhatsApp Contact pill */}
              <div className="text-center pt-8">
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '12px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <span style={{ color: '#25D366', fontSize: 15, fontWeight: 'bold' }}>WhatsApp:</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: '#1e293b' }}>{telefone}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ PÁGINA 2: FUNCIONALIDADES ═══ */}
          <div className="pdf-page bg-[#f8fafc] relative shadow-2xl border border-slate-200/60 mb-10 flex flex-col justify-between" style={{ width: '794px', height: '1123px', padding: '60px 48px', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div className="flex flex-col justify-between h-full">
              {/* Header Title */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px 0' }}>O que você ganha</p>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>Recursos Tecnológicos Ativos</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Toda a infraestrutura configurada de acordo com as necessidades da sua loja</p>
              </div>

              {/* Grid de recursos ativos */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, margin: 'auto 0' }}>
                {featuresToShow.slice(0, 15).map((f, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '16px 12px', border: '1px solid #e2e8f0', height: '135px', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', boxSizing: 'border-box' }}>
                    <div>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: f.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>{i + 1}</span>
                      </div>
                      <h3 style={{ fontSize: 12, fontWeight: 900, color: '#1e293b', margin: '0 0 2px 0' }}>{f.title}</h3>
                    </div>
                    <p style={{ fontSize: 10, color: '#64748b', margin: 0, lineHeight: 1.4 }} className="line-clamp-3">{f.desc}</p>
                  </div>
                ))}
                {featuresToShow.length > 15 && (
                  <div style={{ background: '#fff', borderRadius: 12, padding: '16px 12px', border: '1px solid #e2e8f0', height: '135px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
                    <p style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', margin: 0 }}>+ recursos inclusos</p>
                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 0 0', textAlign: 'center' }}>Consulte a listagem detalhada no plano de contratação.</p>
                  </div>
                )}
              </div>

              {/* Footer info */}
              <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Proposta Comercial — {nomeSistema}{nomeSufixo} — Contato: {telefone}</p>
              </div>
            </div>
          </div>

          {/* ═══ PÁGINA 3: COMPARAÇÃO ═══ */}
          <div className="pdf-page bg-white relative shadow-2xl border border-slate-200/60 mb-10 flex flex-col justify-between" style={{ width: '794px', height: '1123px', padding: '60px 48px', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div className="flex flex-col justify-between h-full">
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px 0' }}>Por que {nomeSistema}{nomeSufixo}?</p>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>Diferencial competitivo</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Compare as ferramentas e saiba por que somos a escolha ideal para o seu crescimento</p>
              </div>

              {/* Tabela de Comparação */}
              <div style={{ margin: 'auto 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '12px', fontWeight: 900, color: '#1e293b' }}>Funcionalidade / Benefício</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: 900, color: '#f59e0b' }}>{nomeSistema}{nomeSufixo}</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: 900, color: '#94a3b8' }}>iFood</th>
                      <th style={{ textAlign: 'center', padding: '12px', fontWeight: 900, color: '#94a3b8' }}>Anota AI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparacaoItens.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 550, color: '#475569' }}>{item.label}</td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 14 }}>✅</td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 14, color: '#cbd5e1' }}>{item.ifood ? '✅' : '—'}</td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 14, color: '#cbd5e1' }}>{item.anota ? '✅' : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#fef2f2' }}>
                      <td style={{ padding: '12px', fontWeight: 900, color: '#1e293b' }}>Taxa por pedido</td>
                      <td style={{ textAlign: 'center', padding: '12px', fontWeight: 900, color: '#16a34a' }}>R$ 0,00</td>
                      <td style={{ textAlign: 'center', padding: '12px', fontWeight: 900, color: '#ef4444' }}>12% a 27%</td>
                      <td style={{ textAlign: 'center', padding: '12px', fontWeight: 900, color: '#d97706' }}>Mensalidade</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Footer info */}
              <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Proposta Comercial — {nomeSistema}{nomeSufixo} — Contato: {telefone}</p>
              </div>
            </div>
          </div>

          {/* ═══ PÁGINA 4: INVESTIMENTO ═══ */}
          <div className="pdf-page bg-[#f8fafc] relative shadow-2xl border border-slate-200/60 mb-10 flex flex-col justify-between" style={{ width: '794px', height: '1123px', padding: '60px 48px', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div className="flex flex-col justify-between h-full">
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px 0' }}>Investimento</p>
                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>Valores de Licenciamento</h2>
                <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Contratação sob medida, sem taxas ocultas e sem fidelidade obrigatória</p>
              </div>

              {/* Preço Destaque */}
              <div style={{ background: '#fff', borderRadius: 20, padding: '32px 24px', border: '2px solid #f59e0b', boxShadow: '0 8px 30px rgba(245,158,11,0.06)', textAlign: 'center', margin: 'auto 0' }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 10px 0' }}>Valor do Plano Comercial</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#94a3b8' }}>R$</span>
                  <span style={{ fontSize: 60, fontWeight: 900, color: '#1e293b', lineHeight: 1, letterSpacing: -2 }}>{precoPlano}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>{periodoPlano}</span>
                </div>

                <div style={{ margin: '24px auto 0', maxWidth: 380, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#16a34a', margin: 0 }}>R$ 0</p>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', margin: '2px 0 0 0', textTransform: 'uppercase' }}>Taxa por pedido</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#16a34a', margin: 0 }}>Isento</p>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', margin: '2px 0 0 0', textTransform: 'uppercase' }}>Taxa de Adesão</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 900, color: '#16a34a', margin: 0 }}>Zero</p>
                      <p style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', margin: '2px 0 0 0', textTransform: 'uppercase' }}>Multa Rescisória</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Itens Inclusos na Proposta */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '24px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px 0' }}>✓ Recursos Inclusos nesta proposta:</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                  {featuresToShow.map((item, i) => (
                    <p key={i} style={{ fontSize: 11, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 'bold' }}>✓</span> {item.title}
                    </p>
                  ))}
                </div>
              </div>

              {/* Footer info */}
              <div style={{ textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
                <p style={{ fontSize: 10, color: '#94a3b8', margin: 0 }}>Proposta Comercial — {nomeSistema}{nomeSufixo} — Contato: {telefone}</p>
              </div>
            </div>
          </div>

          {/* ═══ PÁGINA 5: CTA + CONTATO ═══ */}
          <div className="pdf-page relative shadow-2xl border border-slate-200/60 mb-10 flex flex-col justify-between" style={{ width: '794px', height: '1123px', padding: '80px 48px', boxSizing: 'border-box', overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(135deg, #fefce8, #fef3c7)', position: 'absolute', inset: 0, zIndex: 0 }} />
            
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div />

              {/* Main Call to Action */}
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', margin: '0 0 12px 0' }}>Pronto para alavancar suas vendas?</h2>
                <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 32px 0' }}>Pare de pagar comissões por pedido. Tenha o controle total do seu delivery.</p>
                
                {/* Whatsapp Contact Display */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, background: '#fff', borderRadius: 16, padding: '20px 32px', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0', marginBottom: 24 }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Solicite ativação pelo WhatsApp</p>
                    <p style={{ fontSize: 24, fontWeight: 900, color: '#1e293b', margin: '6px 0 0 0' }}>{telefone}</p>
                  </div>
                </div>

                {/* Resumo Final Pills */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Mensalidade</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#b45309', margin: '2px 0 0 0' }}>R$ {precoPlano}<span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>{periodoPlano}</span></p>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Taxa por Pedido</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', margin: '2px 0 0 0' }}>R$ 0,00</p>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 12, padding: '12px 20px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>Fidelidade</p>
                    <p style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', margin: '2px 0 0 0' }}>Livre</p>
                  </div>
                </div>
              </div>

              {/* Copyright footer */}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                  {nomeSistema}{nomeSufixo} — Sistema de Gestão Inteligente para Gastronomia — {new Date().getFullYear()}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* CSS Customizado das Páginas do Visualizador */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
          
          .pdf-page {
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
          }

          @media print {
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
              color-adjust: exact !important;
              margin: 0 !important; 
              padding: 0 !important;
            }
            @page { margin: 0; size: A4; }
          }
        `}</style>
      </main>
    </div>
  );
}

export default Divulgacao;
