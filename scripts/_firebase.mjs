// Inicializa Firebase Admin para los scripts de mantenimiento.
// Uso: node --env-file=.env scripts/<script>.mjs
import { initializeApp, cert } from "firebase-admin/app";

export function initAdmin() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.error("Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (usa --env-file=.env).");
    process.exit(1);
  }
  return initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: `${FIREBASE_PROJECT_ID}.firebasestorage.app`,
  });
}

export const APPLY = process.argv.includes("--aplicar");
