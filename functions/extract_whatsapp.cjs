const fs = require('fs');

const indexFile = 'index.js';
const apiDir = 'api';
let code = fs.readFileSync(indexFile, 'utf8');
code = code.replace(/\r\n/g, '\n');

const mainStart = code.indexOf('// ==================================================================\n// 14. WHATSAPP BUSINESS API & UAZAPI E MOTOR FLUXO (HÍBRIDO)');
const mainEnd = code.indexOf('// ==================================================================\n// 21. CONTROLE DE ESTOQUE');

if (mainStart > -1 && mainEnd > -1) {
  const mainBlock = code.substring(mainStart, mainEnd);

  const contentToSave = `import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { db } from '../firebaseCore.js';

const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
const whatsappApiToken = defineSecret('WHATSAPP_API_TOKEN');
const openAiApiKey = defineSecret("OPENAI_API_KEY");

${mainBlock}`;

  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);
  fs.writeFileSync('api/whatsapp.js', contentToSave);
  
  let newIndexCode = code;
  newIndexCode = newIndexCode.replace(mainBlock, 'export * from "./api/whatsapp.js";\n\n');
  
  // Clean up unused secrets in index.js for whatsapp if they aren't used elsewhere.
  // We'll leave OPENAI_API_KEY as it's probably used by the AI Agent module.
  newIndexCode = newIndexCode.replace('const whatsappVerifyToken = defineSecret("WHATSAPP_VERIFY_TOKEN");\n', '');
  newIndexCode = newIndexCode.replace('const whatsappApiToken = defineSecret("WHATSAPP_API_TOKEN");\n', '');
  
  fs.writeFileSync(indexFile, newIndexCode);
  console.log('WhatsApp module extracted successfully.');
} else {
  console.log('Blocks not found!', { mainStart, mainEnd });
}
