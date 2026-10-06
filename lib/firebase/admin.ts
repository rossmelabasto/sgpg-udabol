import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

// Con los emuladores de Firebase (pnpm dev:emulador) no hacen falta
// credenciales: el Admin SDK detecta FIRESTORE_EMULATOR_HOST y compañía.
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!getApps().length) {
  initializeApp(
    usingEmulator
      ? { projectId, storageBucket: `${projectId}.appspot.com` }
      : {
          credential: cert({
            projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          }),
          storageBucket: `${projectId}.firebasestorage.app`,
        },
  );
}

const adminDb = getFirestore();

// En Next.js (por el HMR), este archivo se ejecuta en cada recarga.
// Firestore prohíbe llamar a settings() más de una vez, así que lo "silenciamos" con un try/catch.
try {
  adminDb.settings({ preferRest: !usingEmulator });
} catch {
  // Ya fue inicializado en un ciclo anterior de HMR, lo ignoramos.
}

const adminStorage = getStorage();
const adminAuth = getAuth();

export { adminDb, adminStorage, adminAuth };
