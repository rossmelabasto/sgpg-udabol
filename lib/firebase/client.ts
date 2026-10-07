// lib/firebase/client.ts — Firebase en el navegador (solo Auth: el resto pasa por el servidor).
import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const useEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1";

// Configuración web pública de Firebase (no es un secreto: identifica el proyecto).
const firebaseConfig = useEmulator
  ? { projectId: "demo-sgpg", apiKey: "demo-key", authDomain: "demo-sgpg.firebaseapp.com" }
  : {
      projectId: "udabol-project-manager",
      appId: "1:40531606088:web:a9b7fb1a51b57a8093767d",
      storageBucket: "udabol-project-manager.firebasestorage.app",
      apiKey: "AIzaSyCta5_FwQhVxH3KQZ_SjhW_qLVJu-93UOM",
      authDomain: "udabol-project-manager.firebaseapp.com",
      messagingSenderId: "40531606088",
    };

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

if (useEmulator && !(auth as unknown as { emulatorConfig?: unknown }).emulatorConfig) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

export { app, auth };
