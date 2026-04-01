const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';

// ── Cores Ceotax ─────────────────────────────────────────
const NAVY   = '1A2D5A';   // azul marinho (fundo escuro)
const ORANGE = 'F4A620';   // laranja/dourado Ceotax
const WHITE  = 'FFFFFF';
const LIGHT  = 'EEF2F7';   // cinza muito claro
const DARK   = '1A2D5A';
const GRAY   = '8899AA';

// ── Helpers ──────────────────────────────────────────────
function titleSlide(title, subtitle) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  // Barra laranja esquerda
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: ORANGE } });
  // Título
  s.addText(title, {
    x: 0.4, y: 2.4, w: 12.6, h: 1.4,
    fontSize: 36, bold: true, color: WHITE, fontFace: 'Arial',
    align: 'left', valign: 'middle'
  });
  if (subtitle) {
    s.addText(subtitle, {
      x: 0.4, y: 3.9, w: 12, h: 0.7,
      fontSize: 16, color: ORANGE, fontFace: 'Arial', align: 'left'
    });
  }
  // rodapé
  s.addText('ceotax.com.br  |  Consultoria Tributária', {
    x: 0.4, y: 6.9, w: 12, h: 0.4,
    fontSize: 10, color: GRAY, fontFace: 'Arial', align: 'left'
  });
  return s;
}

function sectionSlide(section) {
  const s = pptx.addSlide();
  s.background = { color: ORANGE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: NAVY } });
  s.addText(section, {
    x: 0.5, y: 2.8, w: 12.3, h: 1.6,
    fontSize: 40, bold: true, color: NAVY, fontFace: 'Arial',
    align: 'center', valign: 'middle'
  });
  return s;
}

function contentSlide(title, bullets, opts = {}) {
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  // Cabeçalho
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: NAVY } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.1, w: 13.33, h: 0.06, fill: { color: ORANGE } });
  s.addText(title, {
    x: 0.3, y: 0.1, w: 12.7, h: 0.9,
    fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial',
    align: 'left', valign: 'middle'
  });
  // Conteúdo
  if (opts.twoCol && opts.col2) {
    // Duas colunas
    const col1 = bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' }, fontSize: 14, color: DARK, fontFace: 'Arial', paraSpaceAfter: 6 } }));
    s.addText(col1, { x: 0.4, y: 1.4, w: 5.8, h: 5.6, valign: 'top' });
    s.addText(opts.col2.map(b => ({ text: b, options: { bullet: { type: 'bullet' }, fontSize: 14, color: DARK, fontFace: 'Arial', paraSpaceAfter: 6 } })),
      { x: 6.6, y: 1.4, w: 6.4, h: 5.6, valign: 'top' });
    s.addShape(pptx.ShapeType.line, { x: 6.4, y: 1.5, w: 0, h: 5.4, line: { color: LIGHT, width: 1.5 } });
  } else {
    const rows = bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' }, fontSize: opts.small ? 12 : 15, color: DARK, fontFace: 'Arial', paraSpaceAfter: 5 } }));
    s.addText(rows, { x: 0.4, y: 1.4, w: 12.5, h: 5.7, valign: 'top' });
  }
  // número slide (rodapé)
  s.addText('ceotax.com.br', { x: 11, y: 7.1, w: 2, h: 0.3, fontSize: 9, color: GRAY, align: 'right', fontFace: 'Arial' });
  return s;
}

function tableSlide(title, head, rows) {
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: NAVY } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.1, w: 13.33, h: 0.06, fill: { color: ORANGE } });
  s.addText(title, { x: 0.3, y: 0.1, w: 12.7, h: 0.9, fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial', align: 'left', valign: 'middle' });

  const tableRows = [
    head.map(h => ({ text: h, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11, align: 'center', fontFace: 'Arial' } })),
    ...rows.map((r, i) => r.map(c => ({ text: c, options: { fontSize: 10, color: DARK, fill: { color: i % 2 === 0 ? LIGHT : WHITE }, align: 'center', fontFace: 'Arial' } })))
  ];

  s.addTable(tableRows, { x: 0.3, y: 1.3, w: 12.7, h: 5.8, border: { pt: 0.5, color: 'CCCCCC' } });
  s.addText('ceotax.com.br', { x: 11, y: 7.1, w: 2, h: 0.3, fontSize: 9, color: GRAY, align: 'right', fontFace: 'Arial' });
  return s;
}

function closingSlide(title, sub, contact) {
  const s = pptx.addSlide();
  s.background = { color: NAVY };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: ORANGE } });
  s.addText(title, { x: 0.4, y: 1.8, w: 12.6, h: 1.2, fontSize: 36, bold: true, color: WHITE, fontFace: 'Arial', align: 'left' });
  if (sub) s.addText(sub, { x: 0.4, y: 3.1, w: 11, h: 0.8, fontSize: 18, color: ORANGE, fontFace: 'Arial', align: 'left' });
  if (contact) s.addText(contact, { x: 0.4, y: 4.2, w: 8, h: 1.5, fontSize: 14, color: WHITE, fontFace: 'Arial', align: 'left' });
  s.addText('ceotax.com.br', { x: 11, y: 6.9, w: 2.1, h: 0.4, fontSize: 11, color: ORANGE, align: 'right', fontFace: 'Arial' });
  return s;
}

function profileSlide() {
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: NAVY } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.1, w: 13.33, h: 0.06, fill: { color: ORANGE } });
  s.addText('Apresentação — Eduardo Oliveira', { x: 0.3, y: 0.1, w: 12.7, h: 0.9, fontSize: 22, bold: true, color: WHITE, fontFace: 'Arial', align: 'left', valign: 'middle' });
  const bullets = [
    'Contador, Graduado em Ciências Contábeis pela Universidade 7 de Setembro',
    'Especializado em Direito, Processo e Planejamento Tributário pela UNIFOR',
    'Sócio da CEO Consultoria Tributária',
    'Experiência como gestor de planejamento tributário de indústria de grande porte',
    'Ex-Consultor Tributos com atuação em big four — EY (auditoria, impostos e transações corporativas)',
    'Consultor tributário com mais de 10 anos de atuação nas áreas contábil/tributária',
    'Palestrante registrado no CRC-CE, professor de cursos de extensão/in company há mais de 8 anos',
    'Professor convidado em pós-graduações: Direito Tributário e Reforma Tributária'
  ];
  s.addText(bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet' }, fontSize: 14, color: DARK, fontFace: 'Arial', paraSpaceAfter: 5 } })),
    { x: 0.4, y: 1.4, w: 12.5, h: 5.7, valign: 'top' });
  s.addText('ceotax.com.br', { x: 11, y: 7.1, w: 2, h: 0.3, fontSize: 9, color: GRAY, align: 'right', fontFace: 'Arial' });
  return s;
}

// ── SLIDES ───────────────────────────────────────────────

// 1. Capa
titleSlide(
  'Reforma Tributária e Aspectos da LC 214/2025',
  'Conceitos gerais da reforma sobre o consumo'
);

// 2. Apresentação
profileSlide();

// 3. Agenda
contentSlide('Agenda', [
  '1. Introdução — O novo sistema tributário',
  '2. Impactos no setor de prestação de serviços',
  '3. Não cumulatividade e Split Payment',
  '4. Próximos passos e Debates'
]);

// 4. SEÇÃO 1
sectionSlide('1. Introdução\nO Novo Sistema Tributário');

// 5. Estrutura da Reforma
contentSlide('Reforma Tributária sobre o consumo — Visão Geral', [
  'EXTINÇÃO: PIS/COFINS, ICMS, ISS e IPI (exceto ZFM)',
  'CRIAÇÃO — Federal: CBS (Contribuição sobre Bens e Serviços)',
  'CRIAÇÃO — Subnacional: IBS (Imposto sobre Bens e Serviços)',
  'CRIAÇÃO — Federal: IS (Imposto Seletivo) — bens/serviços prejudiciais à saúde ou ao meio ambiente'
]);

// 6. Cronograma de Transição
contentSlide('Cronograma de Transição', [
  '2026: CBS começa com alíquota de 0,9% (teste)',
  '2027: IBS começa com alíquota de 0,1% (teste)',
  '2029–2032: Redução gradual do ISS/ICMS e aumento do IBS/CBS',
  '2033: Plena vigência do novo sistema — extinção total do ISS e ICMS'
]);

// 7. Princípios do novo IVA
contentSlide('Princípios do Novo IVA Dual', [
  'Base ampla de incidência — inclusive aluguéis, intangíveis e mútuos',
  'Vedação a incentivos fiscais (regra geral)',
  'Não cumulatividade plena — crédito de tudo, exceto uso e consumo pessoal',
  'Legislação uniforme em todo o território nacional',
  'Princípio da neutralidade — decisões econômicas não afetadas por questões tributárias',
  'Split Payment — pagamento automático do tributo via meio de pagamento',
  'Cobrança por fora — mais transparência no cálculo do tributo',
  'Tributação no destino'
]);

// 8. Incentivos Fiscais
contentSlide('Incentivos Fiscais — LC 214/25', [
  'Contribuinte deve estar adimplente com as normas do ato concessivo',
  'Ato concessivo deve exigir ônus ou restrições: expansão do empreendimento, geração de empregos, limitações de preço',
  'NÃO são contrapartidas: declarações de intenção, mero cumprimento obrigatório, destinação a fundos (ex: FEEF)',
  'Habilitação perante a RFB entre jan/2026 e dez/2028',
  'Requisito: titular de incentivo concedido até 31/05/2023 e cumprimento dos requisitos da LC 160/2017',
  'Incentivo deve ser concedido sobre prazo certo, sob condição, com efetiva repercussão econômica'
], { small: true });

// 9. Tributação no Destino
contentSlide('Reforma Tributária — Tributação no Destino', [
  'HOJE (ISS): alíquota do município de ORIGEM do prestador (2% em Eusébio, por ex.)',
  'COM A REFORMA: alíquota do município de DESTINO do tomador, independente de onde está o prestador',
  'Planejamentos tributários envolvendo domicílio do prestador devem ser revistos',
  'Exemplo comparativo: ISS hoje = 5,65% total  |  IVA novo (2033) = 28% por fora'
]);

// 10. SEÇÃO 2
sectionSlide('2. Impactos no Setor\nde Prestação de Serviços');

// 11. Precificação
contentSlide('Como Precificar com a Reforma Tributária?',
  ['HOJE — Impostos embutidos no preço bruto (técnica de "gross up")', 'Preço bruto R$ 1.094,69 → ISS R$ 54,73 + PIS/COFINS R$ 39,96 → Receita Líquida R$ 1.000,00'],
  { twoCol: true, col2: [
    'COM A REFORMA — Impostos cobrados "por fora" do preço líquido',
    'Preço Líquido R$ 1.000,00 + IBS R$ 180,00 + CBS R$ 100,00 → Preço Bruto R$ 1.280,00',
    'Cliente enxerga claramente qual parcela é tributo'
  ]}
);

// 12. Não Cumulatividade
contentSlide('Não Cumulatividade — Comparativo',
  ['PIS/COFINS/ICMS/ISS: não cumulatividade TRADICIONAL (crédito restrito)', 'Compras de mercadorias, insumos, comunicação, transporte', 'ISS: poucos créditos', 'Material de uso e consumo: raramente creditável'],
  { twoCol: true, col2: [
    'IBS/CBS: não cumulatividade PLENA',
    'Tudo que tenha relação com a atividade da empresa gera crédito',
    'Exceção: bens/serviços de uso e consumo pessoal',
    'Inclui: aluguéis, intangíveis, serviços de terceiros...'
  ]}
);

// 13. Reconhecimento de Despesas
contentSlide('Como Reconhecer Despesas com a Reforma', [
  'HOJE: Preço bruto R$ 1.800,00 → ISS R$ 90,00 + PIS/COFINS R$ 65,70 → Custo líquido R$ 1.644,30',
  'COM A REFORMA: Preço Líquido R$ 1.644,30 + IBS R$ 295,97 + CBS R$ 164,43 → Preço Bruto R$ 2.104,70',
  'Crédito a compensar: R$ 460,40 — reduz o custo efetivo da operação',
  'Análise deve ser caso a caso — empresas com alto volume de compras podem ter redução de carga líquida'
]);

// 14. Alíquotas gerais
contentSlide('Alíquotas — Conceitos', [
  'Alíquota Referência: definida pelo Senado Federal via TCU; mantém carga neutra; é o padrão em caso de omissão',
  'Alíquota Padrão: definida por cada ente federado (União→CBS, Estados→IBS, Municípios→IBS)',
  'Liberdade para adotar a referência ou alíquota própria',
  'Alíquota padrão aplica-se a TODAS as operações com bens e serviços naquele local',
  'Referência temporal: destino da operação define a alíquota aplicável'
]);

// 15. Alíquotas por Setor
tableSlide('Alíquotas por Setor — Impacto Estimado',
  ['Setor', 'Redução de Alíquota', 'Observação'],
  [
    ['Escolas', '60%', 'Estimado aumento de carga; Simples não muda a priori'],
    ['Clínicas Médicas', '60%', 'Verificar estrutura de custos; Simples não muda'],
    ['Advogados e Contadores', '30%', 'Maior custo com folha (sem crédito); possível repasse'],
    ['Serviços em Geral', '0% (sem redução)', 'Alíquota cheia de 28%; impacto severo se cliente for PF'],
    ['Cesta Básica', '100%', 'Alíquota zero — isenção total'],
  ]
);

// 16. Alíquotas ao longo do tempo (Regime Geral)
tableSlide('Evolução das Alíquotas — Regime Geral (sem redução)',
  ['Tributo', 'Hoje', '2027', '2028', '2029', '2030', '2031', '2032', '2033'],
  [
    ['IBS', '—', '1,8%', '3,6%', '5,4%', '7,2%', '—', '—', '18,0%'],
    ['CBS', '—', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%'],
    ['ISS', '5,0%', '5,0%', '5,0%', '4,5%', '4,0%', '3,5%', '3,0%', '0,0%'],
    ['PISCO', '3,65%', '—', '—', '—', '—', '—', '—', '—'],
    ['IRPJ', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%'],
    ['CSLL', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%'],
    ['TOTAL', '19,5%', '25,9%', '25,9%', '27,2%', '28,5%', '29,8%', '31,1%', '38,9%'],
  ]
);

// 17. Cuidados fato gerador
contentSlide('Cuidados com o Fato Gerador — Novidades de 2026', [
  'A partir de 2026: fato gerador = operação onerosa com outras pessoas (físicas ou jurídicas)',
  'Aluguel, cessão, permuta e outros itens que HOJE NÃO são tributados, passarão a ser',
  'Menor margem para não pagamento de impostos por omissão de fato gerador',
  'Operações com partes relacionadas: distribuição gratuita de bens/serviços pela PJ = fato gerador',
  'Ex.: pagamento de escola do filho pela PJ, despesas de sócios',
  'Venda entre PJs do mesmo grupo econômico visando economia tributária passa a ser monitorada'
]);

// 18. Simples Nacional
contentSlide('Como Ficam os Contribuintes do Simples Nacional', [
  'O Simples NÃO será afetado pelo regime regular de IBS e CBS — por regra',
  'Opcionalmente, contribuinte pode aderir ao regime regular de IBS/CBS',
  'Se optar, a parcela de IBS/CBS sai do DAS; cliente PJ pode tomar crédito',
  'ATENÇÃO: empresa do Simples que vende para cliente Simples → nenhum crédito para o adquirente',
  'Oportunidade B2B: pode ser vantajoso migrar para o regime regular quando a maioria dos clientes for PJ',
  'Escola no Simples: carga efetiva antes = depois da reforma (NADA MUDA)',
  'Escritório contábil no Simples: idem → avaliar caso a caso se compensa migrar'
]);

// 19. SEÇÃO 3
sectionSlide('3. Não Cumulatividade\ne Split Payment');

// 20. Não Cumulatividade — Detalhe LC 214
contentSlide('Não Cumulatividade — Art. 47 da LC 214/25', [
  'Creditamento de toda operação onerada com IBS e CBS desde que extinta por modalidade do art. 27 (Split Payment)',
  'Regime de Caixa (Art. 47)',
  'Condicionantes ao crédito: I. documento fiscal idôneo; II. apuração segregada CBS x IBS sem compensação cruzada',
  'Simples Nacional: vedado o crédito pelo regime regular — permitido apropriar crédito pago no regime único',
  'Estornos: operações com alíquota reduzida NÃO acarretam estorno de créditos (Art. 47, § 10)'
]);

// 21. Bens de Uso e Consumo Pessoal
contentSlide('Bens de Uso e Consumo Pessoal — Sem Crédito', [
  'a) Joias, pedras e metais preciosos',
  'b) Obras de arte e antiguidades de valor histórico/arqueológico',
  'c) Bebidas alcoólicas',
  'd) Derivados do tabaco',
  'e) Armas e munições',
  'f) Bens e serviços recreativos, esportivos e estéticos',
  'Exceção: quando destinados à atividade-fim (ex.: fábrica de bebidas, empresa de segurança)',
  'Também sem crédito: bens fornecidos gratuitamente a sócios, empregados, cônjuges e parentes até 3º grau',
  'Exceção: EPIs, fardamentos, serviços de saúde, planos de saúde, creche e benefícios trabalhistas'
], { small: true });

// 22. Split Payment — Formas de Pagamento
contentSlide('Split Payment — Formas de Extinção do Tributo', [
  'Recolhimento do saldo devedor (forma tradicional)',
  'Compensação: créditos do mesmo período ou de períodos anteriores',
  'Ressarcimento por opção — uso em até 5 anos (valor nominal)',
  'Crédito presumido: compras de produtor rural, serviços de transporte de PF, resíduos sólidos',
  'Split Payment (3 modalidades): Simplificado | Inteligente | Superinteligente (definitivo)',
  'Sem Split implementado: crédito vinculado ao destaque em nota fiscal'
]);

// 23. Split — Superinteligente
contentSlide('Split Superinteligente — Como Funciona', [
  'Na emissão da nota: sistema consulta o Comitê Gestor IBS/CBS se há créditos para aquela operação',
  'Atacadista → Varejista (R$ 100 + 28% IVA = R$ 128): Split 1 = R$ 28 enviado ao Comitê',
  'Varejista → Consumidor Final (R$ 150 + 28% IVA = R$ 192): Comitê responde "Sim" (crédito de R$ 28)',
  'Split 2 = R$ 14 (débito R$ 42 - crédito R$ 28); Pagamento R$ 178 (192 - 14)',
  'Total do IVA na cadeia: R$ 42 — repassado ao Fisco de forma automática e precisa'
]);

// 24. Split — Inteligente
contentSlide('Split Inteligente — Sem Consulta Prévia', [
  'Funciona sem consulta ao Comitê: o sistema presume que há créditos',
  'Atacadista → Varejista: Split 1 = R$ 28',
  'Varejista → Consumidor Final: Split 2 = R$ 42 (valor cheio)',
  'Comitê devolve os créditos ao varejista em até 3 dias úteis: R$ 28',
  'Resultado final idêntico ao superinteligente — R$ 42 de IVA arrecadado na cadeia'
]);

// 25. Split — Compras a Prazo
contentSlide('Split Payment — Variação em Compras a Prazo', [
  'Compra a prazo (90 dias): nenhum Split ocorre na data da operação',
  'Crédito só nasce quando houver pagamento (Regime de Caixa)',
  'Compra à vista pelo consumidor final: Split 2 = R$ 42 (valor integral)',
  'Atenção ao fluxo de caixa: crédito e débito ocorrem em momentos diferentes'
]);

// 26. SEÇÃO 4
sectionSlide('4. Próximos Passos\npara sua Empresa');

// 27. Simulação — Impacto serviços
contentSlide('Simulação — Impacto Real em Empresa de Serviços', [
  'Receita Bruta Total atual: R$ 4.532.309',
  'Impostos atuais (ISS + PIS/COFINS): R$ 392.045 (19,25% da RL)',
  'COM REFORMA — sem repasse de preço: Impostos = R$ 1.614.608 (35,62% da RL)',
  'COM REFORMA — com repasse (mesma RL): Impostos = R$ 1.504.836 (28,40% da RL)',
  'Aumento acumulado até 2033 pode chegar a 85,1% em relação ao recolhimento atual',
  'CONCLUSÃO: Negócios que prestam serviço a Pessoa Física sofrerão impacto severo sem repasse de preço'
]);

// 28. Próximos Passos — Roadmap
contentSlide('Quais os Próximos Passos?',
  ['2025: Preparação de sistemas da Receita Federal', 'Adequação de parâmetros de emissão de NF-e com tags do IVA', 'Nota Técnica nº 004/005 — Adequações da NFSe', 'Demais normativos regulamentadores'],
  { twoCol: true, col2: [
    '2026: Simulação de cenários',
    'Revisão de contratos e discussão de repasses',
    'Revisão de estrutura societária e tributária',
    'Planejamento estratégico',
    '2027+: Mudança de plantas, operacionalização de decisões tributárias estratégicas'
  ]}
);

// 29. Panorama Geral de Impactos
contentSlide('Panorama Geral de Impactos para Empresas', [
  '🔧 Sistemas — adequação de ERPs e emissão de NF',
  '💰 Planejamento financeiro — antecipação de caixa pelo Split Payment',
  '📊 Precificação — revisão de portfólio e margens',
  '⚠️ Mapeamento de riscos — fato gerador ampliado',
  '🚚 Logística e distribuição — tributação no destino',
  '📝 Revisão de contratos — cláusulas de reajuste por reforma tributária',
  '🏛️ Planejamento tributário — regime Simples vs. Regular',
  '📈 Decisões de investimentos — nova lógica de crédito',
  '🏢 Estrutura societária — grupo econômico e operações intragrupo'
]);

// 30. Encerramento
closingSlide(
  'A reforma tributária chegou.',
  'O que você está fazendo para lidar com essa nova realidade?',
  'Eduardo Oliveira — Consultor Tributário\neduardo@ceotax.com.br\n(85) 99938-0443\nLinkedIn: Eduardo Oliveira'
);

// ── Gerar arquivo ─────────────────────────────────────────
pptx.writeFile({ fileName: 'LC214_CEOTAX_NOVA.pptx' })
  .then(() => console.log('✅ Apresentação gerada: LC214_CEOTAX_NOVA.pptx'))
  .catch(e => console.error('Erro:', e));
