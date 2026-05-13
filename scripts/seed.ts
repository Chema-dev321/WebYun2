/**
 * Script de seed para poblar Firestore con datos de prueba.
 * Ejecutar con: npx tsx scripts/seed.ts
 *
 * Requiere .env.local con las variables de Firebase configuradas.
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const CONFIG_GEOGRAFICA = [
  { municipio: "Morelia", localidad: "Centro" },
  { municipio: "Morelia", localidad: "Charo" },
  { municipio: "Morelia", localidad: "Tarímbaro" },
  { municipio: "Uruapan", localidad: "Centro" },
  { municipio: "Uruapan", localidad: "Jicalán" },
  { municipio: "Zamora", localidad: "Centro" },
  { municipio: "Zamora", localidad: "Jacona" },
  { municipio: "Pátzcuaro", localidad: "Centro" },
  { municipio: "Pátzcuaro", localidad: "Tzintzuntzan" },
];

const NAPS = [
  {
    id_nap: "NAP-MOR-001",
    nombre: "NAP Morelia Centro",
    municipio: "Morelia",
    localidad: "Centro",
    capacidad_total: 16,
    puertos_ocupados: 2,
    estado_tomodat: "Activo",
  },
  {
    id_nap: "NAP-MOR-002",
    nombre: "NAP Morelia Charo",
    municipio: "Morelia",
    localidad: "Charo",
    capacidad_total: 8,
    puertos_ocupados: 6,
    estado_tomodat: "Activo",
  },
  {
    id_nap: "NAP-MOR-003",
    nombre: "NAP Morelia Tarímbaro",
    municipio: "Morelia",
    localidad: "Tarímbaro",
    capacidad_total: 16,
    puertos_ocupados: 8,
    estado_tomodat: "Activo",
  },
  {
    id_nap: "NAP-URU-001",
    nombre: "NAP Uruapan Centro",
    municipio: "Uruapan",
    localidad: "Centro",
    capacidad_total: 8,
    puertos_ocupados: 8,
    estado_tomodat: "Activo",
  },
  {
    id_nap: "NAP-URU-002",
    nombre: "NAP Uruapan Jicalán",
    municipio: "Uruapan",
    localidad: "Jicalán",
    capacidad_total: 8,
    puertos_ocupados: 2,
    estado_tomodat: "Inactivo",
  },
  {
    id_nap: "NAP-ZAM-001",
    nombre: "NAP Zamora Centro",
    municipio: "Zamora",
    localidad: "Centro",
    capacidad_total: 16,
    puertos_ocupados: 14,
    estado_tomodat: "Activo",
  },
  {
    id_nap: "NAP-ZAM-002",
    nombre: "NAP Zamora Jacona",
    municipio: "Zamora",
    localidad: "Jacona",
    capacidad_total: 8,
    puertos_ocupados: 1,
    estado_tomodat: "Activo",
  },
  {
    id_nap: "NAP-PAT-001",
    nombre: "NAP Pátzcuaro Centro",
    municipio: "Pátzcuaro",
    localidad: "Centro",
    capacidad_total: 8,
    puertos_ocupados: 0,
    estado_tomodat: "Activo",
  },
];

async function seed() {
  console.log("⏳ Poblando config_geografica...");
  for (const entry of CONFIG_GEOGRAFICA) {
    await addDoc(collection(db, "config_geografica"), entry);
  }

  console.log("⏳ Poblando naps...");
  for (const nap of NAPS) {
    await addDoc(collection(db, "naps"), nap);
  }

  console.log("✅ Seed completado:");
  const geoS = await getDocs(collection(db, "config_geografica"));
  const napsS = await getDocs(collection(db, "naps"));
  console.log(`  config_geografica: ${geoS.size} documentos`);
  console.log(`  naps: ${napsS.size} documentos`);
}

seed().catch(console.error);
