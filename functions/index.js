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
  maxInstances: 1, // Reduzido de 2 para 1 temporariamente para não estourar a cota de CPU global
  concurrency: 80, // allows single container to process 80 requests at the same time
  memory: "256MiB" // Limits memory size
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

export { ifoodTestarConexao, ifoodConfigurarWebhook, ifoodWebhook, ifoodPolling, ifoodAtualizarStatus } from "./api/ifood.js";
