const PptxGenJS = require('pptxgenjs');
const path = require('path');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches

// ── Paleta Ceotax ─────────────────────────────────────────
const C = {
  navy:    '1D3461',
  navyDk:  '152548',
  orange:  'F4A620',
  orangeLt:'FFC547',
  white:   'FFFFFF',
  offwhite:'F7F9FC',
  gray:    '8899AA',
  grayLt:  'DDE4EE',
  dark:    '1D3461',
  text:    '2C3E50',
};

const LOGO = path.resolve('extracted_image1.png');

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

/** Adiciona o rodapé padrão com logo em cada slide */
function addFooter(s, slideNum, total) {
  // Faixa inferior fina
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.18, w: 13.33, h: 0.32, fill: { color: C.navy } });
  // Logo no rodapé
  s.addImage({ path: LOGO, x: 0.18, y: 7.19, w: 1.55, h: 0.29 });
  // Número de slide
  if (slideNum) {
    s.addText(`${slideNum} / ${total}`, {
      x: 11.8, y: 7.2, w: 1.3, h: 0.28,
      fontSize: 9, color: C.grayLt, fontFace: 'Arial', align: 'right'
    });
  }
  // Site
  s.addText('ceotax.com.br  |  (85) 99938-0443', {
    x: 4.5, y: 7.2, w: 5.5, h: 0.26,
    fontSize: 8.5, color: C.grayLt, fontFace: 'Arial', align: 'center'
  });
}

/** Slide de CAPA */
function coverSlide(title, subtitle) {
  const s = pptx.addSlide();
  // Fundo azul escuro
  s.background = { color: C.navyDk };
  // Bloco diagonal laranja - simulado com dois retângulos sobrepostos
  s.addShape(pptx.ShapeType.rect, { x: 8.5, y: 0, w: 4.83, h: 7.5, fill: { color: C.navy } });
  s.addShape(pptx.ShapeType.rect, { x: 10.2, y: 0, w: 3.13, h: 7.5, fill: { color: C.orange } });
  // Linha decorativa laranja vertical
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.07, h: 7.5, fill: { color: C.orange } });
  // Logo grande centralizado na área esquerda
  s.addImage({ path: LOGO, x: 0.55, y: 0.5, w: 4.2, h: 0.8 });
  // Linha separadora dourada abaixo do logo
  s.addShape(pptx.ShapeType.rect, { x: 0.55, y: 1.45, w: 4.1, h: 0.04, fill: { color: C.orange } });
  // Título principal
  s.addText(title, {
    x: 0.55, y: 1.7, w: 7.8, h: 2.4,
    fontSize: 34, bold: true, color: C.white,
    fontFace: 'Arial', align: 'left', valign: 'top',
    wrap: true
  });
  // Subtítulo
  s.addText(subtitle, {
    x: 0.55, y: 4.3, w: 7.5, h: 0.6,
    fontSize: 16, color: C.orange,
    fontFace: 'Arial', align: 'left'
  });
  // Dados do palestrante
  s.addText('Eduardo Oliveira  |  Consultor Tributário', {
    x: 0.55, y: 5.1, w: 7.5, h: 0.4,
    fontSize: 13, color: C.grayLt, fontFace: 'Arial', align: 'left', italic: true
  });
  // Data
  s.addText('2025', {
    x: 0.55, y: 5.6, w: 3, h: 0.4,
    fontSize: 12, color: C.gray, fontFace: 'Arial', align: 'left'
  });
  // Rodapé
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.18, w: 13.33, h: 0.32, fill: { color: C.navyDk } });
  s.addText('ceotax.com.br  |  (85) 99938-0443  |  eduardo@ceotax.com.br', {
    x: 0.3, y: 7.2, w: 12.5, h: 0.26,
    fontSize: 8.5, color: C.gray, fontFace: 'Arial', align: 'center'
  });
}

/** Slide de SEÇÃO */
function sectionSlide(num, title, slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.offwhite };
  // Bloco azul à esquerda (2/3 do slide)
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 8.8, h: 7.18, fill: { color: C.navy } });
  // Acento laranja vertical
  s.addShape(pptx.ShapeType.rect, { x: 8.8, y: 0, w: 0.18, h: 7.18, fill: { color: C.orange } });
  // Número da seção grande
  s.addText(String(num).padStart(2, '0'), {
    x: 0.4, y: 0.5, w: 3, h: 2.4,
    fontSize: 110, bold: true, color: C.orange,
    fontFace: 'Arial', align: 'left', valign: 'top', transparency: 20
  });
  // Linha decorativa
  s.addShape(pptx.ShapeType.rect, { x: 0.45, y: 3.2, w: 3.5, h: 0.05, fill: { color: C.orange } });
  // Título da seção
  s.addText(title, {
    x: 0.45, y: 3.4, w: 7.8, h: 2.2,
    fontSize: 30, bold: true, color: C.white,
    fontFace: 'Arial', align: 'left', valign: 'top', wrap: true
  });
  // Ícone/detalhe laranja à direita
  s.addShape(pptx.ShapeType.rect, { x: 9.1, y: 1.5, w: 4, h: 4, fill: { color: C.grayLt }, rounding: true });
  s.addImage({ path: LOGO, x: 9.5, y: 3.0, w: 3.2, h: 0.62 });
  addFooter(s, slideNum, total);
}

/** Slide de CONTEÚDO padrão */
function contentSlide(title, bullets, slideNum, total, opts={}) {
  const s = pptx.addSlide();
  s.background = { color: C.offwhite };
  // Cabeçalho azul
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.25, fill: { color: C.navy } });
  // Acento laranja inferior ao cabeçalho
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: 13.33, h: 0.06, fill: { color: C.orange } });
  // Acento laranja vertical início
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 1.25, fill: { color: C.orange } });
  // Logo no cabeçalho (direita)
  s.addImage({ path: LOGO, x: 10.3, y: 0.22, w: 2.8, h: 0.53 });
  // Título
  s.addText(title, {
    x: 0.3, y: 0.1, w: 9.7, h: 1.05,
    fontSize: 21, bold: true, color: C.white, fontFace: 'Arial',
    align: 'left', valign: 'middle'
  });

  const fs = opts.small ? 12 : (bullets.length > 7 ? 13 : 15);

  if (opts.twoCol && opts.col2) {
    // Divisor vertical central
    s.addShape(pptx.ShapeType.rect, { x: 6.5, y: 1.5, w: 0.04, h: 5.4, fill: { color: C.grayLt } });
    // Rótulos das colunas
    if (opts.label1) {
      s.addShape(pptx.ShapeType.rect, { x: 0.25, y: 1.42, w: 5.9, h: 0.34, fill: { color: C.orange } });
      s.addText(opts.label1, { x: 0.3, y: 1.43, w: 5.8, h: 0.3, fontSize: 11, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center' });
    }
    if (opts.label2) {
      s.addShape(pptx.ShapeType.rect, { x: 6.7, y: 1.42, w: 6.3, h: 0.34, fill: { color: C.orange } });
      s.addText(opts.label2, { x: 6.75, y: 1.43, w: 6.2, h: 0.3, fontSize: 11, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center' });
    }
    const yStart = (opts.label1 || opts.label2) ? 1.88 : 1.5;
    const hAvail = (opts.label1 || opts.label2) ? 4.9 : 5.4;
    s.addText(bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 10 }, paraSpaceAfter: 5, fontSize: fs, color: C.text, fontFace: 'Arial' }})),
      { x: 0.25, y: yStart, w: 6.15, h: hAvail, valign: 'top' });
    s.addText(opts.col2.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 10 }, paraSpaceAfter: 5, fontSize: fs, color: C.text, fontFace: 'Arial' }})),
      { x: 6.65, y: yStart, w: 6.45, h: hAvail, valign: 'top' });
  } else {
    s.addText(bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 12 }, paraSpaceAfter: 6, fontSize: fs, color: C.text, fontFace: 'Arial' }})),
      { x: 0.3, y: 1.5, w: 12.8, h: 5.4, valign: 'top' });
  }
  addFooter(s, slideNum, total);
}

/** Slide de TABELA */
function tableSlide(title, head, rows, slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.offwhite };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.25, fill: { color: C.navy } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: 13.33, h: 0.06, fill: { color: C.orange } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 1.25, fill: { color: C.orange } });
  s.addImage({ path: LOGO, x: 10.3, y: 0.22, w: 2.8, h: 0.53 });
  s.addText(title, { x: 0.3, y: 0.1, w: 9.7, h: 1.05, fontSize: 21, bold: true, color: C.white, fontFace: 'Arial', align: 'left', valign: 'middle' });

  const tableRows = [
    head.map(h => ({ text: h, options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 11, align: 'center', fontFace: 'Arial', valign: 'middle' } })),
    ...rows.map((r, i) => r.map((c, ci) => ({
      text: c,
      options: {
        fontSize: ci === 0 ? 11 : 12,
        bold: ci === 0,
        color: ci === 0 ? C.navyDk : C.text,
        fill: { color: i % 2 === 0 ? 'EEF3FA' : C.white },
        align: ci === 0 ? 'left' : 'center',
        fontFace: 'Arial',
        valign: 'middle'
      }
    })))
  ];

  s.addTable(tableRows, {
    x: 0.25, y: 1.42, w: 12.85,
    rowH: 0.62,
    border: { pt: 0.5, color: 'D0D8E8' },
    colW: [3.5, ...Array(head.length - 1).fill((12.85 - 3.5) / (head.length - 1))]
  });
  addFooter(s, slideNum, total);
}

/** Slide de PERFIL (2 colunas: lista + destaque) */
function profileSlide(slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.offwhite };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.25, fill: { color: C.navy } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.25, w: 13.33, h: 0.06, fill: { color: C.orange } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 1.25, fill: { color: C.orange } });
  s.addImage({ path: LOGO, x: 10.3, y: 0.22, w: 2.8, h: 0.53 });
  s.addText('Apresentação — Quem Sou', { x: 0.3, y: 0.1, w: 9.7, h: 1.05, fontSize: 21, bold: true, color: C.white, fontFace: 'Arial', align: 'left', valign: 'middle' });

  // Card azul com nome à direita
  s.addShape(pptx.ShapeType.rect, { x: 9.0, y: 1.42, w: 4.1, h: 5.55, fill: { color: C.navy }, rounding: true });
  s.addText('Eduardo\nOliveira', { x: 9.05, y: 1.7, w: 4.0, h: 1.5, fontSize: 24, bold: true, color: C.white, fontFace: 'Arial', align: 'center' });
  s.addShape(pptx.ShapeType.rect, { x: 9.4, y: 3.25, w: 3.2, h: 0.05, fill: { color: C.orange } });
  s.addText('Consultor Tributário', { x: 9.05, y: 3.35, w: 4.0, h: 0.5, fontSize: 12, color: C.orange, fontFace: 'Arial', align: 'center', italic: true });
  s.addText('eduardo@ceotax.com.br\n(85) 99938-0443\nLinkedIn: Eduardo Oliveira', {
    x: 9.05, y: 4.1, w: 4.0, h: 1.2, fontSize: 11, color: C.grayLt, fontFace: 'Arial', align: 'center'
  });

  // Bullets à esquerda
  const items = [
    'Contador — Ciências Contábeis, Universidade 7 de Setembro',
    'Especialista em Direito, Processo e Planejamento Tributário (UNIFOR)',
    'Sócio da CEO Consultoria Tributária',
    'Ex-Consultor Tributário em big four (EY) — auditoria e impostos corporativos',
    'Mais de 10 anos de experiência contábil/tributária em empresas nacionais e multinacionais',
    'Palestrante registrado no CRC-CE',
    'Professor de extensão e pós-graduação em Direito Tributário e Reforma Tributária há 8+ anos',
  ];
  s.addText(items.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 10 }, paraSpaceAfter: 7, fontSize: 13, color: C.text, fontFace: 'Arial' }})),
    { x: 0.3, y: 1.5, w: 8.5, h: 5.4, valign: 'top' });

  addFooter(s, slideNum, total);
}

/** Slide de ENCERRAMENTO */
function closingSlide(slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.navyDk };
  // Bloco laranja à direita
  s.addShape(pptx.ShapeType.rect, { x: 9.5, y: 0, w: 3.83, h: 7.18, fill: { color: C.orange } });
  // Linha laranja vertical esquerda
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.08, h: 7.18, fill: { color: C.orange } });
  // Logo
  s.addImage({ path: LOGO, x: 0.4, y: 0.4, w: 4.0, h: 0.76 });
  s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 1.3, w: 4.0, h: 0.05, fill: { color: C.orange } });
  // Mensagem
  s.addText('A reforma tributária chegou.', {
    x: 0.4, y: 1.55, w: 8.8, h: 1.0,
    fontSize: 30, bold: true, color: C.white, fontFace: 'Arial', align: 'left'
  });
  s.addText('O que sua empresa está fazendo para\nlidar com essa nova realidade?', {
    x: 0.4, y: 2.65, w: 8.8, h: 1.5,
    fontSize: 19, color: C.orange, fontFace: 'Arial', align: 'left'
  });
  // Contato
  s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 4.4, w: 8.7, h: 0.05, fill: { color: C.gray } });
  s.addText('Entre em contato:', { x: 0.4, y: 4.6, w: 4, h: 0.4, fontSize: 13, bold: true, color: C.gray, fontFace: 'Arial' });
  s.addText('eduardo@ceotax.com.br\n(85) 99938-0443\nLinkedIn: Eduardo Oliveira\nceotax.com.br', {
    x: 0.4, y: 5.1, w: 8.5, h: 1.7,
    fontSize: 14, color: C.grayLt, fontFace: 'Arial', align: 'left'
  });
  // Texto no elemento laranja da direita
  s.addText('LC\n214\n2025', {
    x: 9.55, y: 1.5, w: 3.6, h: 3.5,
    fontSize: 52, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center', valign: 'middle'
  });
  addFooter(s, slideNum, total);
}

// ─────────────────────────────────────────────────────────
// MONTAGEM DOS SLIDES (total: 30)
// ─────────────────────────────────────────────────────────
const TOTAL = 30;

// 1 - Capa
coverSlide(
  'Reforma Tributária e Aspectos da LC 214/2025',
  'Conceitos gerais da reforma sobre o consumo'
);

// 2 - Perfil
profileSlide(2, TOTAL);

// 3 - Agenda
contentSlide('Agenda — O que veremos hoje', [
  '1. Introdução — O novo sistema tributário brasileiro',
  '2. Impactos no setor de prestação de serviços',
  '3. Não cumulatividade plena e Split Payment',
  '4. Próximos passos e ações estratégicas'
], 3, TOTAL);

// 4 - SEÇÃO 1
sectionSlide(1, 'Introdução\nO Novo Sistema Tributário', 4, TOTAL);

// 5 - Estrutura
contentSlide('A Arquitetura da Reforma — O que muda?', [
  'EXTINÇÃO: PIS/COFINS → substituído pela CBS (federal)',
  'EXTINÇÃO: ICMS → substituído pelo IBS (subnacional)',
  'EXTINÇÃO: ISS → substituído pelo IBS (subnacional)',
  'EXTINÇÃO: IPI (exceto produtos da Zona Franca de Manaus)',
  'CRIAÇÃO — CBS: Contribuição sobre Bens e Serviços (Federal — União)',
  'CRIAÇÃO — IBS: Imposto sobre Bens e Serviços (Estados e Municípios)',
  'CRIAÇÃO — IS: Imposto Seletivo — bens/serviços prejudiciais à saúde ou meio ambiente'
], 5, TOTAL);

// 6 - Cronograma
contentSlide('Cronograma de Transição — 2026 a 2033', [
  '2026: CBS começa com alíquota teste de 0,9% (fase piloto)',
  '2027: IBS entra com alíquota teste de 0,1%; CBS sobe para 10%',
  '2029–2032: Redução gradual do ISS (de 5% → 0%) e ICMS, aumento progressivo do IBS',
  '2033: Plena vigência — extinção total do ISS e do ICMS; IBS/CBS em alíquotas definitivas',
  'Período de adaptação: empresas terão ~8 anos para ajustar sistemas, contratos e estratégia'
], 6, TOTAL);

// 7 - Princípios IVA
contentSlide('Princípios do Novo IVA Dual (IBS + CBS)', [
  'Base ampla: incide sobre bens, serviços, aluguéis, intangíveis e mútuos',
  'Não cumulatividade PLENA: crédito de tudo ligado à atividade (exceto consumo pessoal)',
  'Legislação uniforme: Estado não legisla sobre IVA, apenas fixa alíquota',
  'Neutralidade: decisões econômicas não distorcidas por questões tributárias',
  'Split Payment: imposto pago automaticamente no ato do pagamento (via meio de pagamento)',
  'Cobrança por fora: transparência total — cliente vê quanto paga de imposto',
  'Tributação no DESTINO: alíquota do local do comprador, não do vendedor'
], 7, TOTAL);

// 8 - Incentivos Fiscais
contentSlide('Incentivos Fiscais — LC 214/25: Quem mantém?', [
  'Exige adimplência com as normas do ato concessivo original',
  'Ato deve envolver ônus reais: expansão, empregos, limitação de preços',
  'NÃO são contrapartidas válidas: declarações de intenção, mero cumprimento legal, destinação a fundos (ex: FEEF)',
  'Habilitação obrigatória perante a RFB entre jan/2026 e dez/2028',
  'Valem apenas incentivos concedidos até 31/05/2023 (com cumprimento da LC 160/2017)',
  'Prazo certo + condição + repercussão econômica efetiva = requisitos cumulativos',
  'Empresas beneficiárias serão compensadas pelo Fundo de Compensação (2029–2032)'
], 8, TOTAL, { small: true });

// 9 - Tributação no Destino
contentSlide('Tributação no Destino — Mudança Estrutural',
  ['HOJE — ISS (origem): alíquota do município do PRESTADOR', 'Ex: Prestador em Eusébio → ISS 2% (alíquota de Eusébio)', 'Planejamento fiscal via domicílio do prestador era comum'],
  9, TOTAL, {
    twoCol: true, label1: '📍 HOJE (origem)', label2: '📍 COM A REFORMA (destino)',
    col2: [
      'IBS/CBS: alíquota do município do TOMADOR (comprador)',
      'Ex: Tomador em Fortaleza → alíquota de Fortaleza',
      'Planejamentos via domicílio do prestador ficam obsoletos',
      'Exemplo: ISS hoje = 5,65% total  |  IVA 2033 = ~28% por fora'
    ]
  }
);

// 10 - SEÇÃO 2
sectionSlide(2, 'Impactos no Setor\nde Prestação de Serviços', 10, TOTAL);

// 11 - Precificação
contentSlide('Como Precificar com a Reforma Tributária?',
  ['Impostos embutidos no preço bruto — técnica de "gross up"', 'Preço Bruto: R$ 1.094,69', 'ISS: R$ 54,73  |  PIS/COFINS: R$ 39,96', 'Receita Líquida: R$ 1.000,00'],
  11, TOTAL, {
    twoCol: true, label1: '📊 HOJE (impostos por dentro)', label2: '📊 COM A REFORMA (impostos por fora)',
    col2: [
      'Imposto destacado separadamente — cliente enxerga tudo',
      'Preço Líquido: R$ 1.000,00',
      'IBS: R$ 180,00  |  CBS: R$ 100,00',
      'Preço Bruto na Nota: R$ 1.280,00',
      'Precificação parte sempre do valor LÍQUIDO'
    ]
  }
);

// 12 - Não Cumulatividade
contentSlide('Não Cumulatividade — Comparativo',
  ['PIS/COFINS: crédito restrito a insumos e compras de mercadorias', 'ICMS: crédito limitado pela não cumulatividade "clássica"', 'ISS: praticamente sem crédito na saída', 'Material de uso e consumo: raramente gera crédito'],
  12, TOTAL, {
    twoCol: true, label1: '❌ Hoje — Não cumulatividade restrita', label2: '✅ Com a Reforma — Não cumulatividade plena',
    col2: [
      'Crédito de TUDO que tenha relação com a atividade',
      'Aluguéis, intangíveis, serviços de terceiros, seguros',
      'Exceção: bens/serviços de uso e consumo estritamente pessoal',
      'Resultado: redução de custo efetivo para empresas com alto volume de compras'
    ]
  }
);

// 13 - Alíquotas por Setor
tableSlide('Alíquotas por Setor — Impacto Estimado',
  ['Setor de Atuação', 'Redução Alíquota', 'Carga Estimada', 'Observação Principal'],
  [
    ['Cesta Básica', '100%', '0%', 'Alíquota zero — isenção total'],
    ['Escolas / Educação', '60%', '~11,2%', 'Simples Nacional: nada muda'],
    ['Clínicas Médicas', '60%', '~11,2%', 'Verificar estrutura de custos'],
    ['Advogados / Contadores', '30%', '~19,6%', 'Repasse possível (clientes PJ)'],
    ['Serviços em Geral', '0%', '~28%', 'Impacto severo se cliente for PF'],
    ['Vigilância / Limpeza', '0%', '~28%', 'Alta folha de pagamento = sem crédito'],
  ],
  13, TOTAL
);

// 14 - Tabela Evolução Alíquotas Regime Geral
tableSlide('Evolução das Alíquotas — Regime Geral (serviços sem redução)',
  ['Tributo', 'Hoje', '2027', '2028', '2029', '2030', '2031', '2032', '2033'],
  [
    ['IBS', '—', '1,8%', '3,6%', '5,4%', '7,2%', '—', '—', '18,0%'],
    ['CBS', '—', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%'],
    ['ISS', '5,0%', '5,0%', '5,0%', '4,5%', '4,0%', '3,5%', '3,0%', '0,0%'],
    ['IRPJ', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%'],
    ['CSLL', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%'],
    ['TOTAL', '19,5%', '25,9%', '25,9%', '27,2%', '28,5%', '29,8%', '31,1%', '38,9%'],
  ],
  14, TOTAL
);

// 15 - Simples Nacional
contentSlide('Como Ficam os Contribuintes do Simples Nacional',
  ['Simples NÃO é afetado pelo regime regular de IBS/CBS — por padrão', 'Carga efetiva antes = carga efetiva depois da reforma (regra geral)', 'Escola no Simples (12,3%): NADA MUDA após a reforma', 'Escritório contábil no Simples (9,8%): NADA MUDA'],
  15, TOTAL, {
    twoCol: true, label1: '🔒 Regime Simples (padrão)', label2: '⚡ Opção pelo Regime Regular IBS/CBS',
    col2: [
      'Contribuinte PODE optar voluntariamente pelo regime regular',
      'Vantagem: cliente PJ pode tomar crédito do IVA destacado',
      'Risco: se o cliente também for Simples, não há crédito para ele',
      'OBS: empresa do Simples NÃO gera crédito para quem compra sem opção',
      'Análise obrigatória caso a caso!'
    ]
  }
);

// 16 - Cuidados Fato Gerador
contentSlide('Cuidados com o Fato Gerador — Novidades 2026', [
  'A partir de 2026: fato gerador = qualquer operação onerosa entre pessoas físicas ou jurídicas',
  'Aluguel, cessão de direitos, permuta — atualmente NÃO tributados — passam a incidir IBS/CBS',
  'Distribuição gratuita de bens/serviços pela PJ = fato gerador (mesmo sem cobrança)',
  'Atenção: pagamento de escola do filho pelo CNPJ, despesas de sócios pagas pela empresa',
  'Operações entre PJs do mesmo grupo econômico visando economia tributária passam a ser monitoradas',
  'Menor margem para evitar o pagamento por omissão ou por planejamento de forma jurídica'
], 16, TOTAL, { small: true });

// 17 - SEÇÃO 3
sectionSlide(3, 'Não Cumulatividade\ne Split Payment', 17, TOTAL);

// 18 - Art. 47 LC 214
contentSlide('Não Cumulatividade — Art. 47 da LC 214/25', [
  'Crédito sobre toda operação onerada com IBS/CBS, extinta conforme art. 27 (Split Payment)',
  'Regime de Caixa: crédito nasce no pagamento, não na aquisição (Art. 47)',
  'Condicionante I: documento fiscal idôneo emitido regularmente',
  'Condicionante II: apuração segregada — sem compensação cruzada de CBS × IBS',
  'Simples Nacional: vedado o crédito integral; permite crédito do valor pago no regime único',
  'Estornos: operações com alíquota reduzida NÃO obrigam estorno de créditos (Art. 47, § 10)'
], 18, TOTAL);

// 19 - Bens uso pessoal
contentSlide('Bens de Uso e Consumo Pessoal — Sem Direito a Crédito', [
  'a) Joias, pedras e metais preciosos; b) Obras de arte e antiguidades',
  'c) Bebidas alcoólicas; d) Derivados do tabaco; e) Armas e munições',
  'f) Bens e serviços recreativos, esportivos e estéticos',
  'EXCEÇÃO: destinados à atividade-fim (ex.: fábrica de bebidas, empresa de segurança)',
  'Também sem crédito: bens fornecidos gratuitamente a sócios, diretores, empregados e familiares até 3º grau',
  'EXCEÇÃO: EPIs, fardamentos, saúde ocupacional, planos de saúde, creche e benefícios trabalhistas legais',
  'Previsão em regulamento: lista aberta para outros itens não classificados como consumo pessoal'
], 19, TOTAL, { small: true });

// 20 - Split Formas
contentSlide('Split Payment — As 3 Modalidades + Formas de Extinção', [
  '① SPLIT SIMPLIFICADO: o split ocorre no pagamento, sem consulta — crédito depois devolvido em 3 dias',
  '② SPLIT INTELIGENTE: consulta ao Comitê Gestor antes do pagamento — split já considera créditos',
  '③ SPLIT SUPERINTELIGENTE (definitivo): sistema totalmente automatizado e integrado em tempo real',
  'Outras formas de extinção do tributo: recolhimento direto do saldo devedor',
  'Compensação: créditos do mesmo período ou de períodos anteriores',
  'Ressarcimento por opção — prazo de uso: até 5 anos (valor nominal)',
  'Crédito presumido: compras de produtor rural, transporte por PF, resíduos sólidos'
], 20, TOTAL, { small: true });

// 21 - Split Superinteligente
contentSlide('Split Superinteligente — Fluxo da Cadeia',
  ['ATACADISTA vende para VAREJISTA: R$ 100 + 28% IVA = R$ 128', 'Split 1: R$ 28 vai direto ao Comitê Gestor IBS/CBS', 'VAREJISTA acumula crédito de R$ 28'],
  21, TOTAL, {
    twoCol: true, label1: '🔵 1ª Etapa: Atacadista → Varejista', label2: '🟠 2ª Etapa: Varejista → Consumidor Final',
    col2: [
      'VAREJISTA vende para CONSUMIDOR: R$ 150 + 28% IVA = R$ 192',
      'Comitê confirma crédito de R$ 28; Split 2 = R$ 14 (R$ 42 - R$ 28)',
      'Pagamento líquido: R$ 192 - R$ 14 = R$ 178',
      'Total do IVA arrecadado na cadeia: R$ 42 ✅'
    ]
  }
);

// 22 - Split compras a prazo
contentSlide('Split Payment — Compras a Prazo (Regime de Caixa)', [
  'Compra a prazo de 90 dias: nenhum Split ocorre na emissão da nota',
  'Crédito só nasce no momento do PAGAMENTO efetivo (regime de caixa)',
  'Débito do vendedor: também reconhecido apenas no recebimento',
  'Compra à vista pelo consumidor final: Split 2 = R$ 42 (valor integral imediato)',
  'IMPACTO PRÁTICO: empresas com alto prazo médio de recebimento sentirão mais o efeito de caixa',
  'É necessário revisar políticas de crédito e prazo com clientes para adequação ao novo fluxo'
], 22, TOTAL, { small: true });

// 23 - SEÇÃO 4
sectionSlide(4, 'Próximos Passos\npara sua Empresa', 23, TOTAL);

// 24 - Simulação impacto
contentSlide('Simulação — Impacto Real em Empresa de Serviços (Regime Geral)',
  ['Receita Bruta Atual: R$ 4.532.309', 'Impostos atuais: R$ 392.045 (ISS 5% + PIS/COFINS 3,65%) — carga 19,25%', 'SEM repasse de preço (2033): Impostos = R$ 1.614.608 — carga 35,62%'],
  24, TOTAL, {
    twoCol: true, label1: '📉 Sem repasse de preço', label2: '📈 Com repasse (mesma Receita Líquida)',
    col2: [
      'Receita Bruta sobe para R$ 5.299.538',
      'Impostos: R$ 1.504.836 — carga 28,40%',
      'Resultado: praticamente igual ao atual',
      '⚠️ CONCLUSÃO: repassar preço é ESSENCIAL',
      'Aumento acumulado de recolhimento até 2033: até 85,1%'
    ]
  }
);

// 25 - Primeiras discussões
contentSlide('Primeiras Controvérsias Tributárias — LC 214/25', [
  'Debate: IBS/CBS deve ou não compor a base de cálculo do ICMS/ISS durante a transição?',
  'Exemplo 2027: IVA de R$ 500.000 incluso na base → diferença de ISS/ICMS = R$ 25.000 a mais',
  'Exemplo 2033: IVA de R$ 1.400.000 incluso na base → diferença = R$ 70.000 a mais',
  'Projeto de lei propõe exclusão do IBS/CBS da base do ICMS — ainda sem aprovação',
  'Princípio tributário: IVA não deve onerar a base de outros impostos sobre o mesmo fato',
  'Monitorar regulamentação: decisão impacta diretamente o DRE no período de transição'
], 25, TOTAL, { small: true });

// 26 - Roadmap
contentSlide('Roadmap — O que sua empresa deve fazer?',
  ['Simulação de cenários tributários (urgente — 2025/2026)', 'Revisão de contratos: cláusulas de reajuste por impacto normativo', 'Revisão de estrutura societária e tributária (holding, CSC, etc.)', 'Avaliar regime Simples vs. Regime Regular para 2027'],
  26, TOTAL, {
    twoCol: true, label1: '🔵 2025–2026 (Agora!)', label2: '🟠 2027+ (Implementação)',
    col2: [
      'Adequação de sistemas (ERP, NF-e, NFS-e) — tags do IVA',
      'Mudança de plantas industriais e logística considerando tributação no destino',
      'Operacionalização das decisões tributárias estratégicas',
      'Treinamento de equipes financeiras e contábeis',
      'Monitoramento contínuo de regulamentações'
    ]
  }
);

// 27 - Panorama Geral
contentSlide('Panorama Geral — Áreas de Impacto nas Empresas', [
  '🔧 Sistemas — ERPs, emissão de NF, tags do IVA, apuração assistida',
  '💰 Planejamento financeiro — Split Payment antecipa recolhimento; rever fluxo de caixa',
  '📊 Precificação — revisar portfólio, margens e repasse ao cliente',
  '⚠️ Mapeamento de riscos — fato gerador ampliado, operações intragrupo',
  '🚚 Logística e distribuição — tributação muda conforme destino da mercadoria/serviço',
  '📝 Contratos — incluir cláusulas de reajuste por variação tributária',
  '🏛️ Planejamento tributário — Simples vs. Regime Regular; estrutura societária',
  '📈 Investimentos — nova lógica de crédito amplo altera análise de viabilidade'
], 27, TOTAL, { small: true });

// 28 - Roadmap visual
contentSlide('Roadmap da Reforma — 3 Fases Estratégicas', [
  '🟢 FASE 1 — Garantia da Operação (2025–2026): entender a lei, simular cenários, adaptar sistemas e NF',
  '🟡 FASE 2 — Planejamento (2026–2028): rever contratos, estrutura societária, decisão Simples vs. Regular',
  '🔵 FASE 3 — Adequação ao Novo Cenário (2027–2033): implementação plena, monitoramento, otimização contínua',
  '',
  'Ceotax oferece suporte completo em todas as fases — diagnóstico, planejamento e execução'
], 28, TOTAL);

// 29 - Perguntas frequentes
contentSlide('Perguntas Frequentes — Pontos de Atenção', [
  'Quando meu negócio começa a sentir o impacto? → Em 2027 com entrada do IBS (1,8%)',
  'O Simples Nacional acaba? → NÃO. Continua, mas perde o crédito para quem compra',
  'Vou pagar mais imposto? → Depende do setor, estrutura de custos e se você repassar preço',
  'O que é mais urgente fazer AGORA? → Simular cenários e revisar contratos com cláusula tributária',
  'Minha empresa de serviços terá alíquota cheia de 28%? → Somente se não tiver redução prevista na LC 214',
  'Vale optar pelo regime regular sendo Simples? → Depende: analisar perfil de clientes (PJ vs. PF)'
], 29, TOTAL, { small: true });

// 30 - Encerramento
closingSlide(30, TOTAL);

// ── Gerar PPTX ────────────────────────────────────────────
pptx.writeFile({ fileName: 'LC214_CEOTAX_PREMIUM.pptx' })
  .then(() => console.log('✅ Apresentação premium gerada: LC214_CEOTAX_PREMIUM.pptx'))
  .catch(e => console.error('❌ Erro:', e));
