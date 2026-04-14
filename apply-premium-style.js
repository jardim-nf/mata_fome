const fs = require('fs');

try {
  let file = 'src/pages/MasterDashboard.jsx';
  let code = fs.readFileSync(file, 'utf8');

  // Add framer motion import
  code = code.replace(
    /import \{ format \} from 'date-fns';/,
    "import { format } from 'date-fns';\nimport { motion } from 'framer-motion';"
  );

  // Background and base text
  code = code.replace(
    /min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50\/20 font-sans/g,
    "min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 font-sans text-slate-300"
  );

  // Text color replaces
  code = code.replace(/text-slate-900/g, 'text-white');
  code = code.replace(/text-slate-800/g, 'text-slate-100');
  code = code.replace(/text-slate-700/g, 'text-slate-200');
  code = code.replace(/text-slate-600/g, 'text-slate-300');
  code = code.replace(/text-slate-500/g, 'text-slate-400');
  code = code.replace(/bg-slate-50/g, 'bg-zinc-800/40');
  code = code.replace(/bg-white/g, 'bg-zinc-900/40 backdrop-blur-md border border-white/5');
  code = code.replace(/border-slate-100/g, 'border-white/5');
  code = code.replace(/border-slate-200/g, 'border-white/10');

  // Framer Motion variants
  const variants = `
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };
  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 10 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };
  `;
  
  code = code.replace(
    /const hora = new Date\(\)\.getHours\(\);/,
    \`\${variants}\n  const hora = new Date().getHours();\`
  );

  // Stat cards motion
  code = code.replace(
    /<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">/,
    '<motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">'
  );
  // Animate individual stat cards
  code = code.replace(
    /<div className="group relative overflow-hidden rounded-2xl border border-white\/5 bg-zinc-900\/40 backdrop-blur-md border border-white\/5 p-6/g,
    '<motion.div variants={itemVariants} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/50 backdrop-blur-xl p-6'
  );
  // Match the remaining closing div for stat cards (approximate)
  code = code.replace(
    /<\/div>\n\n        {\/\* ─── CONTROLE TOTAL & INTELIGÊNCIA ─── \*\/}/,
    '</motion.div>\n\n        {/* ─── CONTROLE TOTAL & INTELIGÊNCIA ─── */}'
  );

  // Modules grid motion
  code = code.replace(
    /<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">/,
    '<motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">'
  );
  code = code.replace(
    /<Link key=\{i\} to=\{m\.to\}/g,
    '<motion.div variants={itemVariants} key={i}><Link to={m.to}'
  );
  code = code.replace(
    /<\/Link>\n            \}\)\}/g,
    '</Link></motion.div>\n            })}'
  );
  code = code.replace(
    /<\/div>\n        <\/div>\n\n        {\/\* ─── FOOTER ─── \*\/}/,
    '</motion.div>\n        </div>\n\n        {/* ─── FOOTER ─── */}'
  );

  fs.writeFileSync(file, code);
  console.log('Premium Aesthetic Applied.');
} catch (e) {
  console.error(e);
}
