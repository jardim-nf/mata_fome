import React from 'react';

/**
 * Creates a canvas element with a Brazil flag painted on it.
 * Used for the 3D scene decoration.
 */
export function createBrazilFlagCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 358;
  const ctx = canvas.getContext('2d');

  // Fundo Verde
  ctx.fillStyle = '#009c3b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Losango Amarelo
  ctx.fillStyle = '#ffdf00';
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 35);
  ctx.lineTo(canvas.width - 35, canvas.height / 2);
  ctx.lineTo(canvas.width / 2, canvas.height - 35);
  ctx.lineTo(35, canvas.height / 2);
  ctx.closePath();
  ctx.fill();

  // Círculo Azul
  ctx.fillStyle = '#002776';
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 85, 0, 2 * Math.PI);
  ctx.fill();

  // Faixa Branca (Arco)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(canvas.width / 2 - 30, canvas.height / 2 + 180, 240, -Math.PI * 0.44, -Math.PI * 0.28);
  ctx.stroke();

  // Estrelas (Pontinhos brancos)
  ctx.fillStyle = '#ffffff';
  const stars = [
    { x: canvas.width / 2, y: canvas.height / 2 + 35 },
    { x: canvas.width / 2 - 18, y: canvas.height / 2 + 25 },
    { x: canvas.width / 2 + 18, y: canvas.height / 2 + 25 },
    { x: canvas.width / 2 - 8, y: canvas.height / 2 + 45 },
    { x: canvas.width / 2 + 8, y: canvas.height / 2 + 45 },
    { x: canvas.width / 2 + 35, y: canvas.height / 2 + 15 },
    { x: canvas.width / 2 - 35, y: canvas.height / 2 + 8 },
    { x: canvas.width / 2 - 12, y: canvas.height / 2 - 12 },
    { x: canvas.width / 2 + 30, y: canvas.height / 2 + 45 },
  ];
  stars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  return canvas;
}

/**
 * Basic Markdown parser for code blocks with syntax highlighting.
 * Renders ```code``` blocks as styled pre/code elements.
 */
export function renderChatMessage(text) {
  if (typeof text !== 'string') return text;
  if (!text.includes('```')) return text;

  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const content = part.slice(3, -3);
      const firstNewlineIndex = content.indexOf('\n');
      let lang = '';
      let code = content;
      if (firstNewlineIndex !== -1 && firstNewlineIndex < 20) {
        lang = content.slice(0, firstNewlineIndex).trim();
        code = content.slice(firstNewlineIndex + 1);
      }
      return (
        <div key={i} className="my-2 rounded-lg bg-[#0d1117] border border-slate-700/50 overflow-hidden text-left">
          {lang && <div className="bg-[#161b22] px-3 py-1 text-[9px] text-slate-400 font-bold uppercase border-b border-slate-700/50">{lang}</div>}
          <pre className="p-3 text-[11px] font-mono overflow-x-auto text-emerald-300 bg-transparent m-0">
            <code>{code}</code>
          </pre>
        </div>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * Helper for asynchronous pauses in async flows.
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
