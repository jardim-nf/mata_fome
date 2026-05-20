// functions/index.js
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import archiver from "archiver";
import nodemailer from "nodemailer";

import { MercadoPagoConfig, Payment } from 'mercadopago';

// Set global options to prevent GCP CPU quota exhaustion
setGlobalOptions({
  maxInstances: 2,    // 63 serviços × 2 instâncias × 0.5 vCPU (256MiB) = ~63 vCPU máximo (dentro da cota)
  concurrency: 80,    // cada container aguenta 80 req simultâneas — compensa o maxInstances baixo
  memory: "256MiB",  // menos memória = menos CPU alocada por instância no Cloud Run
});

// --- IMPORTS FIREBASE ADMIN ---
import { FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { db, bucket } from "./firebaseCore.js";

// Segredos

const mercadoPagoToken = defineSecret("MP_ACCESS_TOKEN");
const mpClientSecret = defineSecret("MP_CLIENT_SECRET");
const mpClientIdSecret = defineSecret("MP_CLIENT_ID"); 
// const metaVerifyToken = defineSecret("META_VERIFY_TOKEN");
// const metaApiToken = defineSecret("META_API_TOKEN");
// iFood Partner API — lidos via process.env (já configurados como env vars no Cloud Run)
// Não usar defineSecret para evitar conflito com env vars normais existentes
// const meshyApiKey = defineSecret("MESHY_API_KEY"); // desativado - 3D feito manual

export * from "./api/ai_agent.js";

export * from "./api/admin.js";

export * from "./api/pedidos.js";

export * from "./api/fiscal.js";

export * from "./api/mercadopago.js";

export * from "./api/whatsapp.js";

export * from "./api/estoque.js";

export * from "./api/motoboys.js";

export * from "./api/referral.js";

export * from "./api/mesas.js";

// [IFOOD DESATIVADO] - As funções abaixo causavam ~1.440 requisições HTTP/hora em fins de semana
// e colapsavam o sistema por excesso de polling. Reativar quando implementar Cloud Scheduler.
// export { ifoodTestarConexao, ifoodConfigurarWebhook, ifoodWebhook, ifoodPolling, ifoodAtualizarStatus } from "./api/ifood.js";
