// src/pages/Divulgacao.jsx — Material de Vendas PDF (Download Direto)
import React, { useEffect, useState } from 'react';
import { IoLogoWhatsapp, IoDownloadOutline } from 'react-icons/io5';

const TELEFONE = '(22) 99810-2575';

const features = [
  { title: 'Cardápio Digital', desc: 'Menu completo com fotos, categorias, variações e adicionais. QR Code para mesa.', cor: '#EF4444' },
  { title: 'Pedidos Online', desc: 'Delivery, retirada e salão. Pagamento via Pix, cartão e Mercado Pago.', cor: '#F59E0B' },
  { title: 'App PWA', desc: 'Funciona como aplicativo no celular. Instala direto do navegador, sem loja de apps.', cor: '#3B82F6' },
  { title: 'Painel Admin', desc: 'Dashboard completo: pedidos em tempo real, relatórios, gráficos e KPIs.', cor: '#8B5CF6' },
  { title: 'Notificações Push', desc: 'Cliente recebe alerta quando pedido muda de status: preparando → saiu → chegou.', cor: '#10B981' },
  { title: 'Bot WhatsApp', desc: 'Cliente pede direto pelo WhatsApp. Bot monta pedido automaticamente.', cor: '#25D366' },
  { title: 'Avaliações', desc: 'Cliente avalia com estrelas + comentário. Admin responde direto no painel.', cor: '#F59E0B' },
  { title: 'Previsão de Demanda', desc: 'IA analisa histórico e prevê demanda dos próximos 7 dias.', cor: '#06B6D4' },
  { title: 'Marketing Automático', desc: 'Reengaja clientes inativos. Cupom de aniversário automático.', cor: '#A855F7' },
  { title: 'Relatório de Lucro', desc: 'Receita - Custo = Lucro real por produto, com margem percentual.', cor: '#059669' },
  { title: 'Dividir Conta', desc: 'Cliente divide a conta com amigos direto no checkout e compartilha.', cor: '#EC4899' },
  { title: 'Recuperação de Carrinho', desc: 'Detecta carrinho abandonado e mostra banner para o cliente voltar.', cor: '#F97316' },
  { title: 'Controle de Estoque', desc: 'Entrada via XML de nota fiscal. Alerta de estoque baixo automático.', cor: '#6366F1' },
  { title: 'Identidade Visual', desc: 'Cada loja personaliza cores, logo e tema do cardápio digital.', cor: '#E11D48' },
  { title: 'NFC-e / Fiscal', desc: 'Emissão de nota fiscal eletrônica integrada com PlugNotas.', cor: '#0D9488' },
  { title: 'Impressão Automática', desc: 'Imprime comanda na cozinha automaticamente ao receber pedido.', cor: '#64748B' },
];

const comparacao = [
  ['Cardápio Digital próprio', true, false, true],
  ['Sem taxa por pedido', true, false, false],
  ['Bot WhatsApp', true, false, true],
  ['Previsão de Demanda com IA', true, false, false],
  ['Marketing Automático', true, true, true],
  ['Relatório de Lucro real', true, false, false],
  ['Divisão de conta', true, true, false],
  ['Notificação Push PWA', true, true, false],
  ['Controle de Estoque XML', true, false, false],
  ['NFC-e integrada', true, false, false],
  ['Ranking de equipe', true, false, false],
  ['Identidade visual própria', true, false, true],
];

function Divulgacao() {
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleDownloadPDF = async () => {
    if (!ready || generating) return;
    setGenerating(true);

    try {
      const element = document.getElementById('divulgacao-content');
      // Hide the download button during generation
      const btnEl = document.getElementById('btn-print-divulgacao');
      if (btnEl) btnEl.style.display = 'none';

      // Carrega html2pdf sob demanda (evita carregar 900KB+ na primeira visita)
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;

      const opt = {
        margin: [0, 0, 0, 0],
        filename: 'IdeaFood-Material-Divulgacao.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          letterRendering: true,
          scrollY: -window.scrollY,
          windowWidth: 1024,
          width: 1024,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { 
          mode: ['css'],
          before: '.pdf-page-break'
        }
      };

      await html2pdf().set(opt).from(element).save();

      // Show button again
      if (btnEl) btnEl.style.display = 'block';
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div id="divulgacao-content" style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", background: '#fff', width: '100%', maxWidth: 1024, margin: '0 auto', color: '#1e293b' }}>
      
      {/* ═══ PÁGINA 1: HERO ═══ */}
      <div style={{ background: 'linear-gradient(135deg, #fefce8 0%, #fffbeb 50%, #fef3c7 100%)', padding: '80px 24px', textAlign: 'center', borderBottom: '1px solid #fde68a' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#b45309', padding: '8px 16px', borderRadius: 50, fontSize: 11, fontWeight: 900, marginBottom: 32, border: '1px solid #fde68a', letterSpacing: 1 }}>
            ⚡ SISTEMA COMPLETO PARA RESTAURANTES
          </div>
          
          <h1 style={{ fontSize: 64, fontWeight: 900, color: '#1e293b', margin: '0 0 12px 0', lineHeight: 1.1, letterSpacing: -2 }}>
            Idea<span style={{ color: '#f59e0b' }}>Food</span>
          </h1>
          
          <p style={{ fontSize: 20, color: '#64748b', margin: '0 0 8px 0', fontWeight: 300, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            O sistema que <strong style={{ color: '#1e293b' }}>transforma</strong> seu restaurante em uma <strong style={{ color: '#1e293b' }}>máquina de vendas</strong>
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 48px 0' }}>
            Cardápio digital • Pedidos online • Delivery • Salão • Fiscal • Marketing — tudo em um só lugar
          </p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {[['16+', 'Funcionalidades'], ['PWA', 'App sem loja'], ['24/7', 'Pedidos online'], ['IA', 'Previsão de Demanda']].map(([v, l], i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', margin: 0 }}>{v}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', margin: '4px 0 0 0' }}>{l}</p>
              </div>
            ))}
          </div>

          {/* Contato no hero */}
          <div style={{ marginTop: 40, display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 12, padding: '12px 24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <IoLogoWhatsapp style={{ color: '#25D366', fontSize: 20 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>{TELEFONE}</span>
          </div>
        </div>
      </div>

      <div className="pdf-page-break"></div>

      {/* ═══ PÁGINA 2: FUNCIONALIDADES ═══ */}
      <div style={{ padding: '60px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 8px 0' }}>O que você ganha</p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', margin: 0 }}>Todas as funcionalidades</h2>
            <p style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>Tudo que iFood, Anota AI e Consumer têm — sem pagar taxa por pedido</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {features.map((f, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', breakInside: 'avoid' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: f.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>{i + 1}</span>
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 900, color: '#1e293b', margin: '0 0 4px 0' }}>{f.title}</h3>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="pdf-page-break"></div>

      {/* ═══ PÁGINA 3: COMPARAÇÃO ═══ */}
      <div style={{ padding: '60px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 8px 0' }}>Por que IdeaFood?</p>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', margin: 0 }}>Vs. a concorrência</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 900, color: '#1e293b' }}>Funcionalidade</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 900, color: '#f59e0b' }}>IdeaFood</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 900, color: '#94a3b8' }}>iFood</th>
                <th style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 900, color: '#94a3b8' }}>Anota AI</th>
              </tr>
            </thead>
            <tbody>
              {comparacao.map(([feat, mf, ifo, anota], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500, color: '#475569' }}>{feat}</td>
                  <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 16 }}>{mf ? '✅' : '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 16, color: '#cbd5e1' }}>{ifo ? '✅' : '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 12px', fontSize: 16, color: '#cbd5e1' }}>{anota ? '✅' : '—'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid #e2e8f0', background: '#fef2f2' }}>
                <td style={{ padding: '10px 12px', fontWeight: 900, color: '#1e293b' }}>Taxa por pedido</td>
                <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 900, color: '#16a34a' }}>R$ 0</td>
                <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 900, color: '#ef4444' }}>12-27%</td>
                <td style={{ textAlign: 'center', padding: '10px 12px', fontWeight: 900, color: '#d97706' }}>Mensal</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="pdf-page-break"></div>

      {/* ═══ PÁGINA 4: INVESTIMENTO — A PARTIR DE R$ 150 ═══ */}
      <div style={{ padding: '60px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 8px 0' }}>Investimento</p>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', margin: '0 0 8px 0' }}>Quanto custa?</h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 48px 0' }}>Um sistema completo por um preço acessível</p>

          {/* Preço destaque */}
          <div style={{ background: '#fff', borderRadius: 24, padding: '48px 32px', border: '2px solid #f59e0b', boxShadow: '0 10px 40px rgba(245,158,11,0.12)', marginBottom: 32 }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 16px 0' }}>Planos a partir de</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#94a3b8' }}>R$</span>
              <span style={{ fontSize: 72, fontWeight: 900, color: '#1e293b', lineHeight: 1, letterSpacing: -3 }}>150</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>,00/mês</span>
            </div>

            <div style={{ margin: '32px auto 0', maxWidth: 400, borderTop: '1px solid #f1f5f9', paddingTop: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', margin: 0 }}>R$ 0</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: 1 }}>Taxa por pedido</p>
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', margin: 0 }}>Zero</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: 1 }}>Fidelidade</p>
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', margin: 0 }}>16+</p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: 1 }}>Recursos</p>
                </div>
              </div>
            </div>
          </div>

          {/* O que inclui */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 32px', border: '1px solid #e2e8f0', textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 16px 0' }}>✅ O que está incluso:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {[
                'Cardápio Digital completo',
                'Pedidos Online + Delivery',
                'App PWA para clientes',
                'Painel Admin com relatórios',
                'Bot WhatsApp',
                'Marketing Automático',
                'Notificações Push',
                'Controle de Estoque',
                'Previsão de Demanda com IA',
                'Relatório de Lucro',
                'NFC-e / Fiscal integrada',
                'Suporte via WhatsApp',
              ].map((item, i) => (
                <p key={i} style={{ fontSize: 12, color: '#475569', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span> {item}
                </p>
              ))}
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 24 }}>
            💡 Sem fidelidade. Cancele quando quiser. Consulte valores para multi-filiais.
          </p>
        </div>
      </div>

      <div className="pdf-page-break"></div>

      {/* ═══ PÁGINA 5: CTA + CONTATO ═══ */}
      <div style={{ padding: '80px 24px', textAlign: 'center', background: 'linear-gradient(135deg, #fefce8, #fef3c7)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: '#1e293b', margin: '0 0 12px 0' }}>Pronto para vender mais?</h2>
          <p style={{ fontSize: 16, color: '#64748b', margin: '0 0 32px 0' }}>Pare de pagar taxa por pedido. Tenha seu próprio sistema completo.</p>
          
          {/* WhatsApp CTA grande */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16, padding: '20px 32px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: 24 }}>
            <IoLogoWhatsapp style={{ color: '#25D366', fontSize: 32 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>Fale conosco pelo WhatsApp</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', margin: '4px 0 0 0' }}>{TELEFONE}</p>
            </div>
          </div>

          {/* Resumo final */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>A partir de</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#b45309', margin: '4px 0 0 0' }}>R$ 150<span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>/mês</span></p>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Taxa por pedido</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', margin: '4px 0 0 0' }}>R$ 0,00</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 24px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 900, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Fidelidade</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', margin: '4px 0 0 0' }}>Zero</p>
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 32 }}>IdeaFood © {new Date().getFullYear()} — Sistema completo para restaurantes — {TELEFONE}</p>
        </div>
      </div>

      {/* Botão de baixar PDF */}
      <div id="btn-print-divulgacao" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50 }}>
        <button onClick={handleDownloadPDF}
          style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            background: (!ready || generating) ? '#d1d5db' : '#f59e0b', 
            color: '#fff', padding: '14px 28px', borderRadius: 16, 
            fontWeight: 900, fontSize: 14, border: 'none', 
            cursor: (!ready || generating) ? 'not-allowed' : 'pointer', 
            boxShadow: '0 10px 25px rgba(245,158,11,0.4)',
            opacity: (!ready || generating) ? 0.6 : 1
          }}>
          <IoDownloadOutline size={20} /> {generating ? 'Gerando PDF...' : ready ? 'Baixar PDF' : 'Carregando...'}
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .pdf-page-break {
          page-break-before: always;
          break-before: page;
          height: 0;
          display: block;
        }
        @media print {
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            color-adjust: exact !important;
            margin: 0 !important; 
            padding: 0 !important;
          }
          #btn-print-divulgacao { display: none !important; }
          @page { margin: 0; size: A4; }
        }
      `}</style>
    </div>
  );
}

export default Divulgacao;
