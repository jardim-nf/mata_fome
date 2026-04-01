const JSZip = require('jszip');
const xml2js = require('xml2js');
const fs = require('fs');

async function extractPPTX(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
  
  // Get slide files
  const slideFiles = Object.keys(zip.files)
    .filter(f => f.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  console.log(`Total de slides encontrados: ${slideFiles.length}\n`);

  function extractText(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    
    let text = '';
    if (obj['a:t']) {
      if (typeof obj['a:t'] === 'string') text += obj['a:t'];
      else if (Array.isArray(obj['a:t'])) text += obj['a:t'].join('');
    }
    if (obj['a:r']) {
      const runs = Array.isArray(obj['a:r']) ? obj['a:r'] : [obj['a:r']];
      for (const run of runs) {
        text += extractText(run);
      }
    }
    if (obj['a:p']) {
      const paras = Array.isArray(obj['a:p']) ? obj['a:p'] : [obj['a:p']];
      for (const para of paras) {
        const paraText = extractText(para);
        if (paraText.trim()) text += paraText + '\n';
      }
    }
    if (obj['p:txBody']) text += extractText(obj['p:txBody']);
    if (obj['p:sp']) {
      const shapes = Array.isArray(obj['p:sp']) ? obj['p:sp'] : [obj['p:sp']];
      for (const sp of shapes) {
        text += extractText(sp);
      }
    }
    if (obj['p:cSld']) text += extractText(obj['p:cSld']);
    if (obj['p:spTree']) text += extractText(obj['p:spTree']);
    
    return text;
  }

  for (let i = 0; i < slideFiles.length; i++) {
    const slideFile = slideFiles[i];
    const xmlContent = await zip.files[slideFile].async('string');
    
    try {
      const result = await parser.parseStringPromise(xmlContent);
      const slideText = extractText(result['p:sld']);
      
      console.log(`${'='.repeat(60)}`);
      console.log(`SLIDE ${i + 1}`);
      console.log(`${'='.repeat(60)}`);
      if (slideText.trim()) {
        console.log(slideText.trim());
      } else {
        console.log('[Slide sem texto - pode conter apenas imagens/gráficos]');
      }
      console.log('');
    } catch (e) {
      console.log(`Slide ${i + 1}: Erro ao parsear - ${e.message}`);
    }
  }
}

extractPPTX('./LC214_ORIGINAL.pptx').catch(console.error);
