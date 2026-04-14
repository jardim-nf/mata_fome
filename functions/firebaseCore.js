import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";
import * as logger from "firebase-functions/logger";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const adminAuth = getAuth();
export const messaging = getMessaging();
export let bucket;

try {
  bucket = getStorage().bucket();
} catch (e) {
  logger.warn('Bucket do storage não inicializou no escopo global', e.message);
}
