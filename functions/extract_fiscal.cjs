const fs = require('fs');

const indexFile = 'index.js';
const apiDir = 'api';
let code = fs.readFileSync(indexFile, 'utf8');
code = code.replace(/\r\n/g, '\n');

const helperStart = code.indexOf('// ==================================================================\n// FUNÇÃO AUXILIAR: Salvar XML no Firebase Storage');
const helperEnd = code.indexOf('// Segredos');

const mainStart = code.indexOf('// ==================================================================\n// 3. EMITIR NFC-E VIA PLUGNOTAS');
const mainEnd = code.indexOf('export * from "./api/mercadopago.js";');

if (helperStart > -1 && helperEnd > -1 && mainStart > -1 && mainEnd > -1) {
  const helperBlock = code.substring(helperStart, helperEnd);
  const mainBlock = code.substring(mainStart, mainEnd);

  const contentToSave = `import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import archiver from 'archiver';
import nodemailer from 'nodemailer';
import { db, bucket } from '../firebaseCore.js';

const plugNotasApiKey = defineSecret('PLUGNOTAS_API_KEY');
const plugNotasWebhookToken = defineSecret('PLUGNOTAS_WEBHOOK_TOKEN');

${helperBlock}
${mainBlock}`;

  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);
  fs.writeFileSync('api/fiscal.js', contentToSave);
  
  let newIndexCode = code;
  newIndexCode = newIndexCode.replace(helperBlock, '');
  newIndexCode = newIndexCode.replace(mainBlock, 'export * from "./api/fiscal.js";\n\n');
  
  // also specifically remove the references to plugnotas secrets from 'index.js'
  newIndexCode = newIndexCode.replace('const plugNotasApiKey = defineSecret("PLUGNOTAS_API_KEY");\n', '');
  newIndexCode = newIndexCode.replace('const plugNotasWebhookToken = defineSecret("PLUGNOTAS_WEBHOOK_TOKEN"); \n', '');
  
  fs.writeFileSync(indexFile, newIndexCode);
  console.log('Fiscal module extracted successfully.');
} else {
  console.log('Blocks not found!', { helperStart, helperEnd, mainStart, mainEnd });
}
