const PptxGenJS = require('pptxgenjs');
const path = require('path');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 in

// ── Paleta Ceotax Premium ─────────────────────────────────
const C = {
  navy:   '1D3461',
  navyDk: '111D38',
  orange: 'F4A620',
  white:  'FFFFFF',
  off:    'F5F7FA',
  slate:  '3D5A80',
  grayLt: 'E8ECF2',
  gray:   '7A8EA8',
  text:   '1D2D44',
  textLt: '4A5568',
};

const LOGO  = path.resolve('extracted_image1.png');
const SIDEBAR_W = 2.55;  // largura sidebar esquerda

// ── Helpers ──────────────────────────────────────────────

/** SIDEBAR esquerda com logo + número de slide */
function sidebar(s, slideNum, total, label='') {
  // Fundo sidebar escuro
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SIDEBAR_W, h: 7.5,
    fill: { color: C.navyDk }
  });
  // Acento laranja lateral
  s.addShape(pptx.ShapeType.rect, {
    x: SIDEBAR_W - 0.055, y: 0, w: 0.055, h: 7.5,
    fill: { color: C.orange }
  });
  // Logo no topo
  s.addImage({ path: LOGO, x: 0.22, y: 0.28, w: 2.1, h: 0.4 });
  // Linha separadora fina
  s.addShape(pptx.ShapeType.rect, {
    x: 0.22, y: 0.78, w: 2.1, h: 0.03,
    fill: { color: C.slate }
  });
  // Label de seção (ex: "INTRODUÇÃO")
  if (label) {
    s.addText(label.toUpperCase(), {
      x: 0.15, y: 0.9, w: 2.3, h: 0.5,
      fontSize: 8.5, bold: true, color: C.orange,
      fontFace: 'Arial', align: 'left', charSpacing: 1.5
    });
  }
  // Número de slide + total (rodapé sidebar)
  if (slideNum) {
    s.addText(`${String(slideNum).padStart(2,'0')}`, {
      x: 0.2, y: 6.4, w: 1.2, h: 0.75,
      fontSize: 42, bold: true, color: C.slate,
      fontFace: 'Arial', align: 'left'
    });
    s.addText(`/ ${total}`, {
      x: 1.15, y: 6.72, w: 1.1, h: 0.38,
      fontSize: 13, color: C.gray,
      fontFace: 'Arial', align: 'left'
    });
    // Barra de progresso
    const prog = (slideNum / total) * 2.1;
    s.addShape(pptx.ShapeType.rect, { x: 0.22, y: 7.32, w: 2.1, h: 0.055, fill: { color: C.slate } });
    s.addShape(pptx.ShapeType.rect, { x: 0.22, y: 7.32, w: prog, h: 0.055, fill: { color: C.orange } });
  }
}

/** Título de slide (área direita) */
function slideTitle(s, title, subtitle='') {
  const x = SIDEBAR_W + 0.35;
  const w = 13.33 - SIDEBAR_W - 0.5;
  s.addText(title, {
    x, y: 0.28, w, h: 0.68,
    fontSize: 22, bold: true, color: C.text,
    fontFace: 'Arial', align: 'left', valign: 'middle'
  });
  // Linha decorativa dupla: larga laranja + fina slate
  s.addShape(pptx.ShapeType.rect, { x, y: 1.02, w: 3.8, h: 0.05, fill: { color: C.orange } });
  s.addShape(pptx.ShapeType.rect, { x: x + 3.85, y: 1.02, w: w - 3.85, h: 0.05, fill: { color: C.grayLt } });
  if (subtitle) {
    s.addText(subtitle, {
      x, y: 1.1, w, h: 0.42,
      fontSize: 12, color: C.gray, fontFace: 'Arial', italic: true
    });
  }
}

/** Bullet com marcador laranja manual */
function bulletRows(items, fsize=14) {
  return items.map(b => [
    { text: '▸ ', options: { fontSize: fsize - 1, color: C.orange, bold: true } },
    { text: b,  options: { fontSize: fsize, color: C.text, fontFace: 'Arial' } }
  ]);
}

// ─────────────────────────────────────────────────────────
//  SLIDE CAPA
// ─────────────────────────────────────────────────────────
function coverSlide() {
  const s = pptx.addSlide();
  s.background = { color: C.navyDk };

  // Bloco geométrico laranja (triângulo inferior direito simulado com rect rotacionado)
  s.addShape(pptx.ShapeType.rect, {
    x: 7.8, y: 0, w: 5.53, h: 7.5,
    fill: { color: C.navy }
  });
  // Acento laranja diagonal — bloco fino inclinado simulado
  s.addShape(pptx.ShapeType.rect, {
    x: 7.62, y: 0, w: 0.18, h: 7.5,
    fill: { color: C.orange }
  });
  // Segundo bloco escuro
  s.addShape(pptx.ShapeType.rect, {
    x: 11.0, y: 0, w: 2.33, h: 7.5,
    fill: { color: C.navyDk },
    flipH: true
  });
  // Losango decorativo laranja à direita
  s.addShape(pptx.ShapeType.rect, {
    x: 11.5, y: 2.5, w: 1.2, h: 1.2,
    fill: { color: C.orange }, rotate: 45
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 11.8, y: 4.5, w: 0.7, h: 0.7,
    fill: { color: C.slate }, rotate: 45
  });

  // Logo grande
  s.addImage({ path: LOGO, x: 0.5, y: 0.45, w: 4.6, h: 0.88 });

  // Linha laranja decorativa abaixo logo
  s.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 1.48, w: 4.5, h: 0.06,
    fill: { color: C.orange }
  });

  // Título principal
  s.addText('Reforma Tributária', {
    x: 0.5, y: 1.68, w: 7.0, h: 1.1,
    fontSize: 40, bold: true, color: C.white, fontFace: 'Arial', align: 'left'
  });
  s.addText('Aspectos da LC 214/2025', {
    x: 0.5, y: 2.78, w: 6.8, h: 0.75,
    fontSize: 26, color: C.orange, fontFace: 'Arial', align: 'left', bold: false
  });

  // Subtítulo
  s.addText('Conceitos gerais da reforma sobre o consumo', {
    x: 0.5, y: 3.65, w: 6.8, h: 0.5,
    fontSize: 14, color: C.gray, fontFace: 'Arial', italic: true
  });

  // Linha separadora
  s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.35, w: 4.5, h: 0.03, fill: { color: C.slate } });

  // Palestrante
  s.addText('Eduardo Oliveira', {
    x: 0.5, y: 4.5, w: 4.5, h: 0.5,
    fontSize: 16, bold: true, color: C.white, fontFace: 'Arial'
  });
  s.addText('Consultor Tributário  |  Sócio CEO Consultoria Tributária', {
    x: 0.5, y: 5.0, w: 5.5, h: 0.38,
    fontSize: 12, color: C.gray, fontFace: 'Arial'
  });
  s.addText('eduardo@ceotax.com.br  |  (85) 99938-0443', {
    x: 0.5, y: 5.38, w: 5.5, h: 0.35,
    fontSize: 11, color: C.gray, fontFace: 'Arial'
  });

  // Rodapé
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.22, w: 13.33, h: 0.28,
    fill: { color: C.orange }
  });
  s.addText('ceotax.com.br  |  Consultoria Tributária', {
    x: 0, y: 7.22, w: 13.33, h: 0.27,
    fontSize: 10, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center'
  });
}

// ─────────────────────────────────────────────────────────
//  SLIDE SEÇÃO (inversão laranja)
// ─────────────────────────────────────────────────────────
function sectionSlide(num, title, sub, slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.orange };

  // Bloco escuro direito
  s.addShape(pptx.ShapeType.rect, {
    x: 8.2, y: 0, w: 5.13, h: 7.5,
    fill: { color: C.navyDk }
  });
  // Linha fina branca separando blocos
  s.addShape(pptx.ShapeType.rect, {
    x: 8.18, y: 0, w: 0.055, h: 7.5,
    fill: { color: C.white }
  });

  // Número grande
  s.addText(String(num).padStart(2,'0'), {
    x: 0.4, y: 0.2, w: 3.5, h: 3.2,
    fontSize: 130, bold: true, color: C.navyDk,
    fontFace: 'Arial', align: 'left', transparency: 15
  });

  // Linha decorativa
  s.addShape(pptx.ShapeType.rect, {
    x: 0.45, y: 3.52, w: 3.5, h: 0.06,
    fill: { color: C.navyDk }
  });

  // Título
  s.addText(title, {
    x: 0.45, y: 3.7, w: 7.4, h: 1.8,
    fontSize: 30, bold: true, color: C.navyDk,
    fontFace: 'Arial', align: 'left', wrap: true
  });
  if (sub) {
    s.addText(sub, {
      x: 0.45, y: 5.55, w: 7.5, h: 0.5,
      fontSize: 14, color: C.navyDk, fontFace: 'Arial', italic: true
    });
  }

  // Logo no bloco escuro
  s.addImage({ path: LOGO, x: 8.55, y: 3.28, w: 4.3, h: 0.82 });

  // Número de slide pequeno no bloco escuro
  s.addText(`${String(slideNum).padStart(2,'0')} / ${total}`, {
    x: 8.55, y: 6.4, w: 4.3, h: 0.5,
    fontSize: 13, color: C.gray, fontFace: 'Arial', align: 'right'
  });

  // Rodapé laranja abaixo
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 7.22, w: 13.33, h: 0.28,
    fill: { color: C.navyDk }
  });
  s.addText('ceotax.com.br', {
    x: 0, y: 7.22, w: 13.33, h: 0.27,
    fontSize: 10, color: C.orange, fontFace: 'Arial', align: 'center', bold: true
  });
}

// ─────────────────────────────────────────────────────────
//  SLIDE CONTEÚDO (sidebar esquerda)
// ─────────────────────────────────────────────────────────
function contentSlide(title, bullets, slideNum, total, opts={}) {
  const s = pptx.addSlide();
  s.background = { color: C.off };
  sidebar(s, slideNum, total, opts.section || '');
  slideTitle(s, title, opts.subtitle || '');

  const x0 = SIDEBAR_W + 0.35;
  const w0 = 13.33 - SIDEBAR_W - 0.55;
  const yStart = opts.subtitle ? 1.65 : 1.25;
  const hAvail = 7.22 - yStart - 0.05;
  const fs = opts.small ? 12 : (bullets.length > 7 ? 12.5 : 14);

  if (opts.twoCol && opts.col2) {
    const divX = x0 + (w0 / 2) + 0.1;
    // Rótulos
    if (opts.label1) {
      s.addShape(pptx.ShapeType.rect, { x: x0, y: yStart - 0.02, w: w0/2 - 0.15, h: 0.38, fill: { color: C.navy } });
      s.addText(opts.label1, { x: x0 + 0.08, y: yStart, w: w0/2 - 0.3, h: 0.3, fontSize: 10, bold: true, color: C.white, fontFace: 'Arial', charSpacing: 0.5 });
    }
    if (opts.label2) {
      s.addShape(pptx.ShapeType.rect, { x: divX, y: yStart - 0.02, w: w0/2 - 0.1, h: 0.38, fill: { color: C.orange } });
      s.addText(opts.label2, { x: divX + 0.08, y: yStart, w: w0/2 - 0.25, h: 0.3, fontSize: 10, bold: true, color: C.navyDk, fontFace: 'Arial', charSpacing: 0.5 });
    }
    const y2 = (opts.label1 || opts.label2) ? yStart + 0.46 : yStart;
    const h2 = hAvail - ((opts.label1 || opts.label2) ? 0.46 : 0);
    // Linha divisória
    s.addShape(pptx.ShapeType.rect, { x: divX - 0.06, y: y2, w: 0.04, h: h2, fill: { color: C.grayLt } });

    for (const b of bullets) {
      // col1: usar addText com array de runs por pessoa
    }
    s.addText(bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 10, code: 9658, color: C.orange }, paraSpaceAfter: 6, fontSize: fs, color: C.text, fontFace: 'Arial' }})),
      { x: x0, y: y2, w: w0/2 - 0.2, h: h2, valign: 'top' });
    s.addText(opts.col2.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 10, code: 9658, color: C.orange }, paraSpaceAfter: 6, fontSize: fs, color: C.text, fontFace: 'Arial' }})),
      { x: divX + 0.05, y: y2, w: w0/2 - 0.1, h: h2, valign: 'top' });
  } else {
    s.addText(bullets.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 12, code: 9658, color: C.orange }, paraSpaceAfter: 7, fontSize: fs, color: C.text, fontFace: 'Arial' }})),
      { x: x0, y: yStart, w: w0, h: hAvail, valign: 'top' });
  }
}

// ─────────────────────────────────────────────────────────
//  SLIDE TABELA
// ─────────────────────────────────────────────────────────
function tableSlide(title, head, rows, slideNum, total, section='') {
  const s = pptx.addSlide();
  s.background = { color: C.off };
  sidebar(s, slideNum, total, section);
  slideTitle(s, title);

  const x0 = SIDEBAR_W + 0.3;
  const w0 = 13.33 - SIDEBAR_W - 0.5;

  const tableRows = [
    head.map(h => ({
      text: h,
      options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 11, align: 'center', fontFace: 'Arial', valign: 'middle' }
    })),
    ...rows.map((r, i) => r.map((c, ci) => ({
      text: c,
      options: {
        fontSize: ci === 0 ? 11 : 11.5,
        bold: ci === 0,
        color: ci === 0 ? C.navy : C.text,
        fill: { color: i % 2 === 0 ? 'EDF1F9' : C.white },
        align: ci === 0 ? 'left' : 'center',
        fontFace: 'Arial', valign: 'middle'
      }
    })))
  ];

  // Acento laranja acima da tabela
  s.addShape(pptx.ShapeType.rect, { x: x0, y: 1.2, w: 0.22, h: (rows.length + 1) * 0.63, fill: { color: C.orange } });

  s.addTable(tableRows, {
    x: x0 + 0.25, y: 1.2, w: w0 - 0.28,
    rowH: 0.63,
    border: { pt: 0, color: C.white },
    colW: [3.2, ...Array(head.length - 1).fill((w0 - 0.28 - 3.2) / (head.length - 1))]
  });
}

// ─────────────────────────────────────────────────────────
//  SLIDE PERFIL
// ─────────────────────────────────────────────────────────
function profileSlide(slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.off };
  sidebar(s, slideNum, total, 'APRESENTAÇÃO');
  slideTitle(s, 'Eduardo Oliveira — Consultor Tributário');

  const x0 = SIDEBAR_W + 0.35;
  const w0 = 13.33 - SIDEBAR_W - 0.55;

  // Card de destaque à direita
  s.addShape(pptx.ShapeType.rect, { x: x0 + w0 * 0.62, y: 1.18, w: w0 * 0.38 - 0.1, h: 5.8, fill: { color: C.navy }, rounding: true });
  s.addShape(pptx.ShapeType.rect, { x: x0 + w0 * 0.62, y: 1.18, w: 0.22, h: 5.8, fill: { color: C.orange } });
  s.addText('10+', { x: x0 + w0*0.63, y: 1.45, w: w0*0.37, h: 1.1, fontSize: 60, bold: true, color: C.orange, fontFace: 'Arial', align: 'center' });
  s.addText('anos de\nexperiência', { x: x0 + w0*0.63, y: 2.55, w: w0*0.37, h: 0.9, fontSize: 14, color: C.white, fontFace: 'Arial', align: 'center' });
  s.addShape(pptx.ShapeType.rect, { x: x0 + w0*0.64, y: 3.55, w: w0*0.34, h: 0.04, fill: { color: C.slate } });
  s.addText('8+', { x: x0 + w0*0.63, y: 3.7, w: w0*0.37, h: 0.8, fontSize: 48, bold: true, color: C.orange, fontFace: 'Arial', align: 'center' });
  s.addText('anos como\nprofessor', { x: x0 + w0*0.63, y: 4.5, w: w0*0.37, h: 0.8, fontSize: 14, color: C.white, fontFace: 'Arial', align: 'center' });
  s.addShape(pptx.ShapeType.rect, { x: x0 + w0*0.64, y: 5.42, w: w0*0.34, h: 0.04, fill: { color: C.slate } });
  s.addText('EY · UNIFOR · CRC-CE', { x: x0 + w0*0.63, y: 5.55, w: w0*0.37, h: 0.6, fontSize: 11, color: C.gray, fontFace: 'Arial', align: 'center', italic: true });
  s.addText('eduardo@ceotax.com.br\n(85) 99938-0443', { x: x0 + w0*0.63, y: 6.2, w: w0*0.37, h: 0.65, fontSize: 10.5, color: C.grayLt, fontFace: 'Arial', align: 'center' });

  // Bullets à esquerda
  const items = [
    'Contador — Ciências Contábeis, Universidade 7 de Setembro',
    'Especialista em Direito, Processo e Planejamento Tributário (UNIFOR)',
    'Sócio da CEO Consultoria Tributária',
    'Ex-Consultor big four EY — auditoria e impostos corporativos',
    'Experiência em empresas nacionais e multinacionais de diversos portes',
    'Palestrante registrado no CRC-CE',
    'Professor de pós-graduação: Direito Tributário e Reforma Tributária',
  ];
  s.addText(items.map(b => ({ text: b, options: { bullet: { type: 'bullet', indent: 10, code: 9658, color: C.orange }, paraSpaceAfter: 8, fontSize: 13, color: C.text, fontFace: 'Arial' }})),
    { x: x0, y: 1.22, w: w0 * 0.60, h: 5.8, valign: 'top' });
}

// ─────────────────────────────────────────────────────────
//  SLIDE ENCERRAMENTO
// ─────────────────────────────────────────────────────────
function closingSlide(slideNum, total) {
  const s = pptx.addSlide();
  s.background = { color: C.navyDk };

  // Bloco laranja à direita com borda arredondada simulada
  s.addShape(pptx.ShapeType.rect, { x: 8.6, y: 0.4, w: 4.5, h: 6.7, fill: { color: C.orange }, rounding: false });
  s.addShape(pptx.ShapeType.rect, { x: 8.6, y: 0, w: 4.73, h: 0.4, fill: { color: C.navyDk } });

  // Losango decorativo
  s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 5.3, w: 0.9, h: 0.9, fill: { color: C.orange }, rotate: 45 });
  s.addShape(pptx.ShapeType.rect, { x: 1.75, y: 5.5, w: 0.5, h: 0.5, fill: { color: C.slate }, rotate: 45 });

  // Logo
  s.addImage({ path: LOGO, x: 0.5, y: 0.45, w: 4.4, h: 0.84 });
  s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.42, w: 4.0, h: 0.06, fill: { color: C.orange } });

  // Mensagem
  s.addText('A reforma tributária\njá chegou.', {
    x: 0.5, y: 1.62, w: 7.8, h: 1.8,
    fontSize: 34, bold: true, color: C.white, fontFace: 'Arial', align: 'left', lineSpacingMultiple: 1.15
  });
  s.addText('O que sua empresa está fazendo para\nlidar com essa nova realidade?', {
    x: 0.5, y: 3.55, w: 7.5, h: 1.2,
    fontSize: 18, color: C.orange, fontFace: 'Arial', lineSpacingMultiple: 1.3
  });

  // Contato
  s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 4.85, w: 3.5, h: 0.05, fill: { color: C.slate } });
  s.addText('Fale com a Ceotax', { x: 0.5, y: 5.02, w: 5, h: 0.42, fontSize: 12, bold: true, color: C.gray, fontFace: 'Arial', charSpacing: 1 });
  s.addText('eduardo@ceotax.com.br', { x: 0.5, y: 5.48, w: 7, h: 0.38, fontSize: 14, color: C.white, fontFace: 'Arial' });
  s.addText('(85) 99938-0443  |  ceotax.com.br', { x: 0.5, y: 5.9, w: 7, h: 0.38, fontSize: 14, color: C.white, fontFace: 'Arial' });
  s.addText('LinkedIn: Eduardo Oliveira', { x: 0.5, y: 6.3, w: 7, h: 0.38, fontSize: 13, color: C.gray, fontFace: 'Arial', italic: true });

  // Conteúdo no bloco laranja
  s.addText('LC', { x: 8.65, y: 1.0, w: 4.5, h: 0.85, fontSize: 46, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center' });
  s.addText('214', { x: 8.65, y: 1.85, w: 4.5, h: 1.5, fontSize: 90, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center' });
  s.addShape(pptx.ShapeType.rect, { x: 9.2, y: 3.45, w: 3.4, h: 0.06, fill: { color: C.navyDk } });
  s.addText('2025', { x: 8.65, y: 3.6, w: 4.5, h: 0.85, fontSize: 40, bold: false, color: C.navyDk, fontFace: 'Arial', align: 'center' });
  s.addShape(pptx.ShapeType.rect, { x: 9.2, y: 4.55, w: 3.4, h: 0.06, fill: { color: C.navyDk } });
  s.addText('Reforma\nTributária', { x: 8.65, y: 4.72, w: 4.5, h: 1.5, fontSize: 22, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center' });

  // Rodapé
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.22, w: 13.33, h: 0.28, fill: { color: C.orange } });
  s.addText('ceotax.com.br  |  Consultoria Tributária', { x: 0, y: 7.22, w: 13.33, h: 0.27, fontSize: 10, bold: true, color: C.navyDk, fontFace: 'Arial', align: 'center' });
}

// ─────────────────────────────────────────────────────────
//  MONTAGEM — 30 SLIDES
// ─────────────────────────────────────────────────────────
const T = 30;

coverSlide();                                           // 1
profileSlide(2, T);                                     // 2
contentSlide('Agenda — O que Veremos Hoje', [           // 3
  '1. Introdução — O novo sistema tributário brasileiro',
  '2. Impactos no setor de prestação de serviços',
  '3. Não cumulatividade plena e Split Payment',
  '4. Próximos passos e ações estratégicas'
], 3, T, { section: 'AGENDA' });
sectionSlide(1, 'Introdução\nO Novo Sistema Tributário', 'Objetivos, estrutura e cronograma de transição', 4, T);
contentSlide('A Arquitetura da Reforma — O que Muda?', [   // 5
  'EXTINÇÃO: PIS/COFINS → CBS (federal)',
  'EXTINÇÃO: ICMS → IBS (subnacional, estados)',
  'EXTINÇÃO: ISS → IBS (subnacional, municípios)',
  'EXTINÇÃO: IPI (exceto Zona Franca de Manaus)',
  'CRIAÇÃO — CBS: Contribuição sobre Bens e Serviços (União)',
  'CRIAÇÃO — IBS: Imposto sobre Bens e Serviços (Estados + Municípios)',
  'CRIAÇÃO — IS: Imposto Seletivo (bens/serviços prejudiciais à saúde ou meio ambiente)'
], 5, T, { section: 'INTRODUÇÃO' });
contentSlide('Cronograma de Transição — 2026 a 2033', [   // 6
  '2026: CBS inicia com alíquota-teste de 0,9% (fase piloto da Receita Federal)',
  '2027: IBS entra com 0,1%; CBS sobe para alíquota padrão de 10%',
  '2029–2032: ISS cai gradualmente (5% → 0%); IBS cresce progressivamente',
  '2033: Plena vigência — ISS e ICMS extintos; IBS/CBS em alíquotas definitivas',
  'As empresas têm ~8 anos para adaptar sistemas, contratos e estratégia tributária'
], 6, T, { section: 'INTRODUÇÃO' });
contentSlide('Princípios do Novo IVA Dual', [              // 7
  'Base ampla: bens, serviços, aluguéis, intangíveis e mútuos — tudo incide',
  'Não cumulatividade PLENA: crédito de tudo ligado à atividade (exceto consumo pessoal)',
  'Legislação uniforme nacional — Estado não legisla sobre IVA; apenas fixa sua alíquota',
  'Neutralidade: decisões econômicas não podem ser distorcidas por questões tributárias',
  'Split Payment: tributo pago automaticamente no ato do pagamento via meio de pagamento',
  'Cobrança por fora: total transparência — cliente vê exatamente quanto paga de imposto',
  'Tributação no DESTINO: alíquota do local do comprador, não do vendedor'
], 7, T, { section: 'INTRODUÇÃO' });
contentSlide('Incentivos Fiscais — Quem se Habilita?', [   // 8
  'Exige adimplência com todas as normas do ato concessivo original',
  'Devem envolver ônus reais: expansão de empreendimento, geração de empregos, limitação de preços',
  'NÃO são válidas: declarações de intenção, mero cumprimento legal, destinação a fundos (ex: FEEF)',
  'Habilitação obrigatória na RFB: entre janeiro/2026 e dezembro/2028',
  'Somente incentivos concedidos até 31/05/2023 (com cumprimento da LC 160/2017)',
  'Fundo de Compensação: empresas beneficiárias serão compensadas pelo Estado entre 2029–2032'
], 8, T, { section: 'INTRODUÇÃO', small: true });
contentSlide('Tributação no Destino — Mudança Estrutural',  // 9
  ['HOJE — ISS: alíquota do servidor (prestador) no município de origem', 'Ex: prestador em Eusébio cobra ISS 2% — mesmo que cliente seja de Fortaleza', 'Planejamento fiscal via domicílio do prestador era comum e legal'],
  9, T, { section: 'INTRODUÇÃO',
  twoCol: true, label1: '📍 HOJE — Tributação na Origem', label2: '📍 COM A REFORMA — Tributação no Destino',
  col2: ['IBS/CBS: alíquota do município onde está o TOMADOR (comprador)', 'Domicílio do prestador perde relevância tributária', 'Planejamentos via mudança de sede do prestador ficam obsoletos', 'ISS hoje: 5,65% total  |  IVA em 2033: ~28% por fora'] });

sectionSlide(2, 'Impactos no Setor\nde Prestação de Serviços', 'Precificação, alíquotas e créditos', 10, T);
contentSlide('Como Precificar com a Reforma?',              // 11
  ['Impostos embutidos no preço bruto — técnica de "gross up"', 'Preço Bruto: R$ 1.094,69  →  ISS: R$ 54,73  +  PIS/COFINS: R$ 39,96', 'Receita Líquida: R$ 1.000,00'],
  11, T, { section: 'SERVIÇOS',
  twoCol: true, label1: '📊 HOJE — Impostos por DENTRO', label2: '📊 COM A REFORMA — Impostos por FORA',
  col2: ['Imposto destacado separadamente na nota fiscal', 'Preço Líquido: R$ 1.000,00  +  IBS: R$ 180  +  CBS: R$ 100', 'Preço Bruto na Nota: R$ 1.280,00', 'Precificação parte do valor LÍQUIDO; imposto é acrescido por fora'] });
tableSlide('Alíquotas por Setor — Impacto Estimado', [     // 12
  'Setor', 'Redução', 'Alíquota efetiva', 'Situação'
], [
  ['Cesta Básica', '100%', '0%', 'Isenção total'],
  ['Escolas / Educação', '60%', '~11,2%', 'Simples: nada muda'],
  ['Clínicas Médicas', '60%', '~11,2%', 'Analisar custos'],
  ['Advogados / Contadores', '30%', '~19,6%', 'Repasse viável (PJ)'],
  ['Serviços em Geral', '0%', '~28%', 'Alto impacto se PF'],
  ['Vigilância / Limpeza', '0%', '~28%', 'Folha sem crédito'],
], 12, T, 'SERVIÇOS');
tableSlide('Evolução das Alíquotas — Regime Geral',        // 13
  ['Tributo', 'Hoje', '2027', '2028', '2029', '2030', '2031', '2032', '2033'],
  [
    ['IBS', '—', '1,8%', '3,6%', '5,4%', '7,2%', '—', '—', '18,0%'],
    ['CBS', '—', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%', '10,0%'],
    ['ISS', '5,0%', '5,0%', '5,0%', '4,5%', '4,0%', '3,5%', '3,0%', '0,0%'],
    ['IRPJ', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%', '8,0%'],
    ['CSLL', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%', '2,9%'],
    ['TOTAL', '19,5%', '25,9%', '25,9%', '27,2%', '28,5%', '29,8%', '31,1%', '38,9%'],
  ], 13, T, 'SERVIÇOS');
contentSlide('Não Cumulatividade — Comparativo',            // 14
  ['Crédito restrito a insumos e compras de mercadorias', 'ICMS: não cumulatividade "clássica" com limitações', 'ISS: praticamente sem crédito', 'Material de uso e consumo: raramente creditável'],
  14, T, { section: 'SERVIÇOS',
  twoCol: true, label1: '❌ HOJE — Restrita', label2: '✅ COM A REFORMA — Plena',
  col2: ['Crédito de TUDO com relação à atividade', 'Aluguéis, intangíveis, serviços, seguros', 'Exceção: uso e consumo estritamente pessoal', 'Empresas com alto volume de compras ganham'] });
contentSlide('Simples Nacional — O que Muda?',              // 15
  ['Simples NÃO é afetado pelo regime regular de IBS/CBS por padrão', 'Escola no Simples (12,3%): NADA MUDA após a reforma', 'Escritório contábil (9,8%): NADA MUDA'],
  15, T, { section: 'SERVIÇOS',
  twoCol: true, label1: '🔒 Regime Simples (padrão)', label2: '⚡ Opção Regime Regular',
  col2: ['Contribuinte pode optar pelo regime regular IBS/CBS', 'Vantagem: cliente PJ toma crédito do IVA destacado', 'Risco: se cliente for Simples, não há crédito para ele', 'Análise obrigatória caso a caso — sem regra geral!'] });
contentSlide('Cuidados com o Fato Gerador em 2026', [      // 16
  'A partir de 2026: fato gerador = qualquer operação onerosa entre pessoas (PF ou PJ)',
  'Aluguel, cessão de direitos, permuta — atualmente sem tributação — passam a incidir IBS/CBS',
  'Distribuição gratuita de bens/serviços pela PJ = fato gerador (mesmo sem cobrança ao cliente)',
  'Atenção: pagamento de escola do filho pelo CNPJ, despesas de sócios cobertas pela empresa',
  'Operações entre PJs do mesmo grupo econômico com fins de economia tributária serão monitoradas',
  'Menor margem de omissão ou planejamento via subterfúgio jurídico'
], 16, T, { section: 'SERVIÇOS', small: true });

sectionSlide(3, 'Não Cumulatividade\ne Split Payment', 'Art. 47 da LC 214 e as 3 modalidades', 17, T);
contentSlide('Não Cumulatividade — Art. 47 da LC 214/25', [ // 18
  'Crédito sobre toda operação onerada com IBS/CBS extinta conforme art. 27 (Split Payment)',
  'Regime de Caixa (Art. 47): crédito nasce no PAGAMENTO, não na aquisição',
  'Condicionante I: documento fiscal idôneo emitido regularmente',
  'Condicionante II: apuração segregada — sem compensação cruzada de CBS × IBS',
  'Simples Nacional: vedado crédito integral; permite crédito do valor pago no regime único',
  'Estornos: alíquota reduzida NÃO obriga estorno de créditos (Art. 47, § 10)'
], 18, T, { section: 'SPLIT PAYMENT' });
contentSlide('Bens de Uso Pessoal — Sem Crédito', [         // 19
  'Joias, pedras e metais preciosos; Obras de arte e antiguidades históricas',
  'Bebidas alcoólicas; Derivados do tabaco; Armas e munições',
  'Bens e serviços recreativos, esportivos e estéticos',
  'EXCEÇÃO: quando destinados à atividade-fim (ex.: fábrica de bebidas, empresa de segurança)',
  'Também sem crédito: bens e serviços fornecidos gratuitamente a sócios, diretores, empregados e familiares até 3º grau',
  'EXCEÇÃO: EPIs, fardamentos, saúde ocupacional, planos de saúde, creche e benefícios trabalhistas',
  'Lista aberta: regulamento poderá classificar outros itens como não pessoais'
], 19, T, { section: 'SPLIT PAYMENT', small: true });
contentSlide('Split Payment — As 3 Modalidades', [          // 20
  '① SIMPLIFICADO: split automático no pagamento sem consulta; crédito devolvido em 3 dias úteis',
  '② INTELIGENTE: consulta prévia ao Comitê Gestor IBS/CBS; split já desconta créditos antes do pagamento',
  '③ SUPERINTELIGENTE (definitivo): totalmente integrado e automatizado em tempo real',
  'Outras formas: recolhimento direto do saldo devedor; compensação de períodos anteriores',
  'Ressarcimento por opção — prazo de uso: até 5 anos pelo valor nominal',
  'Crédito presumido: compras de produtor rural, transporte por PF, resíduos sólidos coletados'
], 20, T, { section: 'SPLIT PAYMENT', small: true });
contentSlide('Split Superinteligente — Fluxo da Cadeia',    // 21
  ['ATACADISTA → VAREJISTA: R$ 100 + 28% IVA = R$ 128', 'Sistema consulta Comitê: "Há créditos?" → Não', 'Split 1: R$ 28 vai direto ao Comitê; Varejista acumula crédito'],
  21, T, { section: 'SPLIT PAYMENT',
  twoCol: true, label1: '1ª ETAPA — Atacadista → Varejista', label2: '2ª ETAPA — Varejista → Consumidor Final',
  col2: ['VAREJISTA → CONSUMIDOR: R$ 150 + 28% IVA = R$ 192', 'Sistema consulta: "Há créditos?" → Sim (R$ 28)', 'Split 2 = R$ 14 (débito R$ 42 – crédito R$ 28)', 'Pagamento líquido: R$ 178  |  IVA total cadeia: R$ 42 ✅'] });
contentSlide('Split e Compras a Prazo — Regime de Caixa', [ // 22
  'Compra a prazo (90 dias): nenhum Split ocorre na emissão da nota fiscal',
  'Crédito nasce apenas no momento do PAGAMENTO efetivo',
  'Débito do vendedor: reconhecido também somente no recebimento',
  'Compra à vista: Split ocorre imediatamente no pagamento',
  'IMPACTO: empresas com alto prazo de recebimento terão maior descasamento de caixa',
  'Revisão urgente de políticas de prazo e crédito com clientes é necessária'
], 22, T, { section: 'SPLIT PAYMENT', small: true });

sectionSlide(4, 'Próximos Passos\ne Ações Estratégicas', 'O que fazer agora para sua empresa', 23, T);
contentSlide('Simulação — Impacto Real em Empresa de Serviços', // 24
  ['Receita Bruta Atual: R$ 4.532.309', 'Impostos atuais: R$ 392.045 (ISS 5% + PIS/COFINS 3,65%) — 19,25%', 'SEM repasse (2033): impostos = R$ 1.614.608 — carga 35,62%'],
  24, T, { section: 'PRÓXIMOS PASSOS',
  twoCol: true, label1: '📉 Sem repasse de preço', label2: '📈 Com repasse (mesma Receita Líquida)',
  col2: ['Receita Bruta sobe para R$ 5.299.538', 'Impostos: R$ 1.504.836 — carga 28,40%', 'Resultado praticamente igual ao atual', '⚠️ CONCLUSÃO: repassar preço é ESSENCIAL', 'Aumento de recolhimento até 2033: até 85,1%'] });
contentSlide('Primeiras Controvérsias — LC 214/25', [       // 25
  'Debate: IBS/CBS deve ou não compor a base do ICMS/ISS durante a transição?',
  'Exemplo 2027: IVA de R$ 500k incluso → diferença de ISS/ICMS = R$ 25.000 a mais',
  'Exemplo 2033: IVA de R$ 1,4M incluso → diferença = R$ 70.000 a mais',
  'Projeto de lei propõe exclusão do IBS/CBS da base do ICMS — ainda sem aprovação',
  'Acompanhar regulamentação: decisão impacta diretamente o DRE no período de transição'
], 25, T, { section: 'PRÓXIMOS PASSOS', small: true });
contentSlide('Roadmap — O que Fazer Agora?',                // 26
  ['Simulação de cenários tributários (urgente — 2025/2026)', 'Revisão de contratos: inserir cláusula de reajuste por variação normativa', 'Revisão da estrutura societária (holding, CSC, operações intragrupo)', 'Avaliar migração Simples → Regime Regular para 2027'],
  26, T, { section: 'PRÓXIMOS PASSOS',
  twoCol: true, label1: '🔵 2025–2026 (Urgente)', label2: '🟠 2027+ (Implementação)',
  col2: ['Adequar ERP, NF-e e NFS-e: tags do IVA obrigatórias', 'Revisar logística considerando tributação no destino', 'Treinar equipes financeiras e contábeis', 'Monitorar regulamentações do Comitê Gestor'] });
contentSlide('Panorama Geral de Impactos nas Empresas', [   // 27
  '🔧 Sistemas — ERPs, NF, tags IVA, apuração assistida pelo Comitê Gestor',
  '💰 Planejamento Financeiro — Split antecipa recolhimento; rever fluxo de caixa',
  '📊 Precificação — revisar portfólio, margens e política de repasse ao cliente',
  '⚠️ Mapeamento de Riscos — fato gerador ampliado, operações intragrupo monitoradas',
  '🚚 Logística — tributação muda conforme destino da mercadoria/serviço',
  '📝 Contratos — cláusulas de reajuste por variação tributária são agora essenciais',
  '🏛️ Planejamento Tributário — Simples vs. Regular; estrutura societária',
  '📈 Decisões de Investimento — nova lógica de crédito amplo altera viabilidade'
], 27, T, { section: 'PRÓXIMOS PASSOS', small: true });
contentSlide('Roadmap da Reforma — 3 Fases Estratégicas', [ // 28
  '🟢 FASE 1 — Garantia da Operação (2025–2026): entender a lei, simular cenários, adaptar sistemas',
  '🟡 FASE 2 — Planejamento (2026–2028): rever contratos, estrutura societária, definir regime',
  '🔵 FASE 3 — Adequação Plena (2027–2033): implementação, monitoramento e otimização contínua',
  '',
  'A Ceotax oferece suporte completo em todas as fases — diagnóstico, planejamento e execução'
], 28, T, { section: 'PRÓXIMOS PASSOS' });
contentSlide('Perguntas Frequentes', [                       // 29
  'Quando meu negócio sentirá o impacto? → Em 2027 com a entrada do IBS (1,8%)',
  'O Simples Nacional acaba? → NÃO — continua, mas perde crédito para compradores',
  'Vou pagar mais imposto? → Depende do setor, custos e se você repassar preço ao cliente',
  'O que é mais urgente fazer AGORA? → Simular cenários e rever contratos com cláusula tributária',
  'Minha empresa de serviços pagará 28%? → Somente sem redução prevista na LC 214',
  'Vale migrar do Simples para o Regime Regular? → Depende do perfil de clientes (PJ vs. PF)'
], 29, T, { section: 'DEBATE', small: true });
closingSlide(30, T);                                         // 30

// ── Gerar ────────────────────────────────────────────────
pptx.writeFile({ fileName: 'LC214_CEOTAX_V3.pptx' })
  .then(() => console.log('✅  LC214_CEOTAX_V3.pptx gerado!'))
  .catch(e => console.error('❌', e));
