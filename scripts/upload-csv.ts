/**
 * Script para subir datos de CSVs a Firestore.
 * Ejecutar con: npx tsx scripts/upload-csv.ts
 *
 * Lee los archivos CSV de la carpeta csv/ y los adapta al esquema de Firebase.
 */
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";
import * as fs from "fs";
import * as path from "path";

// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyCiTxcp3Ir33okaYQF8G_IdR4iRlfLWtYY",
  authDomain: "appgio-77c48.firebaseapp.com",
  projectId: "appgio-77c48",
  storageBucket: "appgio-77c48.firebasestorage.app",
  messagingSenderId: "711938578327",
  appId: "1:711938578327:web:75bf734d6b1d65bb22d6d2",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

// ── CSV Parser ──
function parseCSV(content: string): string[][] {
  const lines = content.split("\n");
  const result: string[][] = [];

  for (const line of lines) {
    if (line.trim() === "") continue;
    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    result.push(row);
  }
  return result;
}

// ── Helper: Parse date string ──
function parseDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === "") return "";
  // Format: DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return dateStr;
}

// ── Upload NAPs from LISTA GENERAL ──
async function uploadNAPs() {
  const filePath = path.join(process.cwd(), "csv", "Chema - LISTA GENERAL.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  // Skip header
  const dataRows = rows.slice(1);

  console.log(`\n📊 Procesando ${dataRows.length} NAPs del archivo LISTA GENERAL...`);

  const naps: Array<{
    id_nap: string;
    nombre: string;
    municipio: string;
    localidad: string;
    capacidad_total: number;
    puertos_ocupados: number;
    estado_tomodat: string;
    verificacion: number;
  }> = [];

  for (const row of dataRows) {
    if (row.length < 5) continue;

    const municipio = row[0]?.trim() || "";
    const localidad = row[1]?.trim() || "";
    const napId = row[2]?.trim() || "";
    const puertosStr = row[3]?.trim() || "0";
    const ocupadosStr = row[4]?.trim() || "0";
    const rojoTomodat = row[5]?.trim() || "";
    const verificacionStr = row[6]?.trim() || "0";

    if (!napId) continue;

    const capacidad = parseInt(puertosStr) || 8;
    const ocupados = parseInt(ocupadosStr) || 0;
    const verificacion = parseInt(verificacionStr) || 0;

    naps.push({
      id_nap: napId,
      nombre: `${localidad} - ${napId}`,
      municipio: municipio,
      localidad: localidad,
      capacidad_total: capacidad,
      puertos_ocupados: ocupados,
      estado_tomodat: rojoTomodat === "SI" ? "Rojo" : "Activo",
      verificacion,
    });
  }

  // Deduplicate by id_nap (keep first occurrence)
  const uniqueNAPs = new Map<string, (typeof naps)[0]>();
  for (const nap of naps) {
    if (!uniqueNAPs.has(nap.id_nap)) {
      uniqueNAPs.set(nap.id_nap, nap);
    }
  }

  console.log(`  ✅ ${uniqueNAPs.size} NAPs únicos encontrados`);

  // Upload using nap code as doc ID
  let count = 0;
  let errors = 0;

  for (const nap of uniqueNAPs.values()) {
    try {
      await setDoc(doc(db, "naps", nap.id_nap), nap);
      count++;
      if (count % 100 === 0) {
        console.log(`  📤 ${count} NAPs subidos...`);
      }
    } catch (err: unknown) {
      errors++;
      if (errors <= 3) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠️  Error al subir NAP ${nap.id_nap}: ${msg}`);
      }
      if (errors > 3 && errors % 100 === 0) {
        console.error(`  ⚠️  ${errors} errores acumulados...`);
      }
    }
  }

  console.log(`  ✅ ${count} NAPs subidos a Firestore`);
}

// ── Upload Clientes ──
async function uploadClientes() {
  const filePath = path.join(process.cwd(), "csv", "Chema - CLIENTES.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  // Skip header
  const dataRows = rows.slice(1);

  console.log(`\n👥 Procesando ${dataRows.length} clientes...`);

  const clientes: Array<{
    id_wisp: string;
    nombre: string;
    municipio: string;
    localidad: string;
    id_nap: string;
    fecha_alta: string;
  }> = [];

  for (const row of dataRows) {
    if (row.length < 5) continue;

    const idWisp = row[0]?.trim() || "";
    const nombre = row[1]?.trim() || "";
    const municipio = row[2]?.trim() || "";
    const localidad = row[3]?.trim() || "";
    const napId = row[4]?.trim() || "";
    const fecha = row[5]?.trim() || "";

    if (!idWisp || !nombre) continue;

    clientes.push({
      id_wisp: idWisp,
      nombre: nombre,
      municipio: municipio,
      localidad: localidad,
      id_nap: napId,
      fecha_alta: parseDate(fecha),
    });
  }

  // Deduplicate by id_wisp (keep latest)
  const uniqueClientes = new Map<string, (typeof clientes)[0]>();
  for (const cliente of clientes) {
    const existing = uniqueClientes.get(cliente.id_wisp);
    if (!existing || cliente.fecha_alta > existing.fecha_alta) {
      uniqueClientes.set(cliente.id_wisp, cliente);
    }
  }

  console.log(`  ✅ ${uniqueClientes.size} clientes únicos encontrados`);

  // Upload one by one
  let count = 0;
  let errors = 0;

  for (const cliente of uniqueClientes.values()) {
    try {
      await addDoc(collection(db, "clientes"), cliente);
      count++;
      if (count % 100 === 0) {
        console.log(`  📤 ${count} clientes subidos...`);
      }
    } catch (err: unknown) {
      errors++;
      if (errors <= 3) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠️  Error al subir cliente ${cliente.id_wisp}: ${msg}`);
      }
    }
  }

  console.log(`  ✅ ${count} clientes subidos a Firestore`);
}

// ── Upload Geographic Config ──
async function uploadGeographicConfig() {
  const filePath = path.join(process.cwd(), "csv", "Chema - LISTA GENERAL.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows = parseCSV(content);

  const dataRows = rows.slice(1);

  console.log(`\n🗺️  Procesando configuración geográfica...`);

  const geoEntries = new Map<string, { municipio: string; localidad: string }>();

  for (const row of dataRows) {
    if (row.length < 2) continue;

    const municipio = row[0]?.trim() || "";
    const localidad = row[1]?.trim() || "";

    if (!municipio || !localidad) continue;

    const key = `${municipio}|${localidad}`;
    if (!geoEntries.has(key)) {
      geoEntries.set(key, { municipio, localidad });
    }
  }

  console.log(`  ✅ ${geoEntries.size} combinaciones municipio/localidad encontradas`);

  // Upload one by one
  let count = 0;
  let errors = 0;

  for (const entry of geoEntries.values()) {
    try {
      await addDoc(collection(db, "config_geografica"), entry);
      count++;
      if (count % 10 === 0) {
        console.log(`  📤 ${count} entradas geográficas subidas...`);
      }
    } catch (err: unknown) {
      errors++;
      if (errors <= 3) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠️  Error al subir geo ${entry.municipio}/${entry.localidad}: ${msg}`);
      }
    }
  }

  console.log(`  ✅ ${count} entradas geográficas subidas a Firestore`);
}

// ── Main ──
async function main() {
  console.log("🚀 Iniciando carga de datos CSV a Firestore...\n");
  console.log("=".repeat(50));
  console.log("Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

  try {
    // Test connection first
    console.log("\n🔍 Probando conexión a Firestore...");
    const testSnap = await getDocs(collection(db, "naps"));
    console.log(`  Conexión exitosa. NAPs existentes: ${testSnap.size}`);

    await uploadNAPs();
    await uploadClientes();
    await uploadGeographicConfig();

    console.log("\n" + "=".repeat(50));
    console.log("\n✅ ¡Carga completada exitosamente!");
    console.log("\nResumen:");
    const napsSnap = await getDocs(collection(db, "naps"));
    const clientesSnap = await getDocs(collection(db, "clientes"));
    const geoSnap = await getDocs(collection(db, "config_geografica"));
    console.log(`  - NAPs en Firestore: ${napsSnap.size}`);
    console.log(`  - Clientes en Firestore: ${clientesSnap.size}`);
    console.log(`  - Config geográfica en Firestore: ${geoSnap.size}`);
  } catch (error) {
    console.error("\n❌ Error durante la carga:", error);
    console.error("\n⚠️  Asegúrate de que:");
    console.error("  1. Firestore está habilitado en Firebase Console");
    console.error("  2. Las reglas de seguridad permiten escritura");
    console.error("  3. El project ID es correcto");
    process.exit(1);
  }
}

main();
