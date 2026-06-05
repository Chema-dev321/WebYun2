// Script de prueba: inserta 10 NAPs de Actopan con coordenadas reales
// Ejecutar con: node scripts/seed-naps.mjs

import { initializeApp } from "firebase/app";
import { getFirestore, setDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCiTxcp3Ir33okaYQF8G_IdR4iRlfLWtYY",
  authDomain: "appgio-77c48.firebaseapp.com",
  projectId: "appgio-77c48",
  storageBucket: "appgio-77c48.firebasestorage.app",
  messagingSenderId: "711938578327",
  appId: "1:711938578327:web:75bf734d6b1d65bb22d6d2",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 10 NAPs de prueba con coordenadas reales de la región de Actopan, Hidalgo
const naps = [
  {
    id_nap: "ACT 101",
    nombre: "CENTRO - ACT 101",
    municipio: "ACTOPAN",
    localidad: "CENTRO",
    capacidad_total: 8,
    puertos_ocupados: 3,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2695,
    longitud: -98.9386,
  },
  {
    id_nap: "ACT 102",
    nombre: "CENTRO - ACT 102",
    municipio: "ACTOPAN",
    localidad: "CENTRO",
    capacidad_total: 8,
    puertos_ocupados: 8,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2710,
    longitud: -98.9401,
  },
  {
    id_nap: "ACT 103",
    nombre: "COL. NUEVA - ACT 103",
    municipio: "ACTOPAN",
    localidad: "COL. NUEVA",
    capacidad_total: 16,
    puertos_ocupados: 12,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2730,
    longitud: -98.9355,
  },
  {
    id_nap: "ACT 104",
    nombre: "COL. NUEVA - ACT 104",
    municipio: "ACTOPAN",
    localidad: "COL. NUEVA",
    capacidad_total: 8,
    puertos_ocupados: 2,
    estado_tomodat: "Rojo",
    verificacion: 0,
    latitud: 20.2748,
    longitud: -98.9340,
  },
  {
    id_nap: "ACT 105",
    nombre: "LAS PALMAS - ACT 105",
    municipio: "ACTOPAN",
    localidad: "LAS PALMAS",
    capacidad_total: 8,
    puertos_ocupados: 6,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2665,
    longitud: -98.9420,
  },
  {
    id_nap: "ACT 106",
    nombre: "EL HUERTO - ACT 106",
    municipio: "ACTOPAN",
    localidad: "EL HUERTO",
    capacidad_total: 8,
    puertos_ocupados: 8,
    estado_tomodat: "Rojo",
    verificacion: 0,
    latitud: 20.2680,
    longitud: -98.9448,
  },
  {
    id_nap: "ACT 107",
    nombre: "BARRIO SAN MIGUEL - ACT 107",
    municipio: "ACTOPAN",
    localidad: "BARRIO SAN MIGUEL",
    capacidad_total: 16,
    puertos_ocupados: 4,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2718,
    longitud: -98.9373,
  },
  {
    id_nap: "ACT 108",
    nombre: "LA ESTACION - ACT 108",
    municipio: "ACTOPAN",
    localidad: "LA ESTACION",
    capacidad_total: 8,
    puertos_ocupados: 7,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2655,
    longitud: -98.9395,
  },
  {
    id_nap: "ACT 109",
    nombre: "FRACCIONAMIENTO NORTE - ACT 109",
    municipio: "ACTOPAN",
    localidad: "FRACCIONAMIENTO NORTE",
    capacidad_total: 16,
    puertos_ocupados: 1,
    estado_tomodat: "Activo",
    verificacion: 1,
    latitud: 20.2758,
    longitud: -98.9380,
  },
  {
    id_nap: "ACT 110",
    nombre: "COLONIA HIDALGO - ACT 110",
    municipio: "ACTOPAN",
    localidad: "COLONIA HIDALGO",
    capacidad_total: 8,
    puertos_ocupados: 0,
    estado_tomodat: "Activo",
    verificacion: 0,
    latitud: 20.2700,
    longitud: -98.9330,
  },
];

async function seed() {
  console.log("Insertando 10 NAPs de prueba en Actopan, Hidalgo...\n");

  for (const nap of naps) {
    try {
      // Insert NAP
      await setDoc(doc(db, "naps", nap.id_nap), nap, { merge: true });

      // Register geo
      const geoId = `${nap.municipio}|${nap.localidad}`;
      await setDoc(
        doc(db, "config_geografica", geoId),
        { municipio: nap.municipio, localidad: nap.localidad },
        { merge: true }
      );

      const sem =
        nap.puertos_ocupados > nap.capacidad_total
          ? "🔵 Sobre-ocup."
          : nap.puertos_ocupados === nap.capacidad_total
          ? "🔴 LLENA"
          : nap.puertos_ocupados >= nap.capacidad_total * 0.7
          ? "🟡 Alta ocup."
          : "🟢 Disponible";

      console.log(
        `✓ ${nap.id_nap.padEnd(10)} ${sem.padEnd(18)} ${nap.puertos_ocupados}/${nap.capacidad_total} puertos  Tomodat: ${nap.estado_tomodat}`
      );
    } catch (err) {
      console.error(`✗ Error al insertar ${nap.id_nap}:`, err.message);
    }
  }

  console.log("\n✅ Listo. Recarga la app para ver las NAPs en el mapa.");
  process.exit(0);
}

seed();
