const fs = require('fs');
const indexFile = 'index.js';
const apiDir = 'api';
let code = fs.readFileSync(indexFile, 'utf8');
code = code.replace(/\r\n/g, '\n');

function extractBlock(startMarker, endMarker, fileName, imports) {
  const start = code.indexOf(startMarker);
  const end = endMarker ? code.indexOf(endMarker) : code.length;
  
  if (start > -1 && end > -1) {
    const block = code.substring(start, end);
    const content = imports + '\n\n' + block;
    if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);
    fs.writeFileSync(fileName, content);
    code = code.replace(block, 'export * from "./' + fileName + '";\n\n');
    console.log(fileName + ' extracted.');
  } else {
    console.log('NOT FOUND: ' + fileName);
  }
}

const commonImports = `import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';`;

// AI
extractBlock(
  '// ==================================================================\n// 1. SEU AGENTE DE IA',
  '// ==================================================================\n// 1.5 CRIAR USUÁRIO (MASTER ADMIN)',
  'api/ai_agent.js',
  commonImports + `\nimport { OpenAI } from 'openai';\nconst openAiApiKey = defineSecret("OPENAI_API_KEY");`
);

// Admin
extractBlock(
  '// ==================================================================\n// 1.5 CRIAR USUÁRIO (MASTER ADMIN)',
  '// ==================================================================\n// 2. CRIAR PEDIDO SEGURO',
  'api/admin.js',
  commonImports
);

// Pedidos
extractBlock(
  '// ==================================================================\n// 2. CRIAR PEDIDO SEGURO',
  'export * from "./api/fiscal.js";',
  'api/pedidos.js',
  commonImports
);

// Estoque
extractBlock(
  '// ==================================================================\n// 21. CONTROLE DE ESTOQUE',
  '// ==================================================================\n// 22. ACERTO COM MOTOBOYS',
  'api/estoque.js',
  commonImports
);

// Motoboys
extractBlock(
  '// ==================================================================\n// 22. ACERTO COM MOTOBOYS',
  '// ==================================================================\n// 23. INDICAÇÃO DE CLIENTES',
  'api/motoboys.js',
  commonImports
);

// Referral
extractBlock(
  '// ==================================================================\n// 23. INDICAÇÃO DE CLIENTES',
  null,
  'api/referral.js',
  commonImports
);

// Clean up index.js
code = code.replace('const openAiApiKey = defineSecret("OPENAI_API_KEY");', '');

fs.writeFileSync(indexFile, code);
console.log('Finished final extractions.');
