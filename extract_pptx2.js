const JSZip = require('jszip');
const fs = require('fs');

async function extractPPTX(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  const slideFiles = Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)[1]);
      const nb = parseInt(b.match(/slide(\d+)/)[1]);
      return na - nb;
    });

  console.log(`Total: ${slideFiles.length} slides\n`);

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('string');
    
    // Extrai todos os textos <a:t>...</a:t>
    const texts = [];
    const regex = /<a:t[^>]*>([^<]+)<\/a:t>/g;
    let m;
    while ((m = regex.exec(xml)) !== null) {
      const t = m[1].trim();
      if (t) texts.push(t);
    }
    
    console.log(`${'─'.repeat(50)}`);
    console.log(`SLIDE ${i + 1}:`);
    if (texts.length > 0) {
      texts.forEach(t => console.log(`  • ${t}`));
    } else {
      console.log('  [sem texto - apenas imagens/gráficos]');
    }
    console.log('');
  }
}

extractPPTX('./LC214_ORIGINAL.pptx').catch(console.error);
