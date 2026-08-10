import { initializeApp, getApps } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * Configuración de las credenciales del proyecto Firebase extraídas desde las variables de entorno (`.env.local`).
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Instancia única de la aplicación Firebase (Singleton para evitar múltiples inicializaciones en Next.js HMR).
 */
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * Instancia compartida de la base de datos Cloud Firestore.
 */
export const db = getFirestore(app);

// Habilita la persistencia en caché offline mediante IndexedDB en el navegador para agilizar la carga repetida de consultas
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("La persistencia de Firestore falló: Múltiples pestañas abiertas simultáneamente.");
    } else if (err.code === "unimplemented") {
      console.warn("La persistencia de Firestore no está soportada en este navegador.");
    }
  });
}

/**
 * Instancia compartida del servicio Firebase Authentication.
 */
export const auth = getAuth(app);

