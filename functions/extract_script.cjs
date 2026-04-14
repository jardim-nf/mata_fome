const fs = require('fs');

const indexFile = 'index.js';
const apiDir = 'api';
let code = fs.readFileSync(indexFile, 'utf8');

// Normalize line endings
code = code.replace(/\r\n/g, '\n');

const mpBlockStart = code.indexOf('// ==================================================================\n// 13. GERAR PIX MERCADO PAGO');
const nextBlockStart = code.indexOf('// ==================================================================\n// 14. WHATSAPP');

if (mpBlockStart > -1 && nextBlockStart > -1) {
  const mpCode = code.substring(mpBlockStart, nextBlockStart);
  
  const contentToSave = `import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { db } from '../firebaseCore.js';

const mercadoPagoToken = defineSecret('MP_ACCESS_TOKEN');
const mpClientSecret = defineSecret('MP_CLIENT_SECRET');
const mpClientIdSecret = defineSecret('MP_CLIENT_ID');

${mpCode}`;

  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir);
  fs.writeFileSync('api/mercadopago.js', contentToSave);
  
  const newIndexCode = code.replace(mpCode, 'export * from "./api/mercadopago.js";\n\n');
  fs.writeFileSync(indexFile, newIndexCode);
  console.log('MercadoPago module extracted successfully.');
} else {
  console.log('Blocks not found again: ', mpBlockStart, nextBlockStart);
}
