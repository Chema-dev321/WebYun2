// Seed via Firebase REST API — no requiere auth admin SDK
// Ejecutar con: node scripts/seed-naps-rest.mjs

const PROJECT_ID = "appgio-77c48";
const API_KEY = "AIzaSyCiTxcp3Ir33okaYQF8G_IdR4iRlfLWtYY";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const naps = [
  { id: "ACT 101", municipio: "ACTOPAN", localidad: "CENTRO",              lat: 20.2695, lng: -98.9386, ocupados: 3,  cap: 8,  tomodat: "Activo" },
  { id: "ACT 102", municipio: "ACTOPAN", localidad: "CENTRO",              lat: 20.2710, lng: -98.9401, ocupados: 8,  cap: 8,  tomodat: "Activo" },
  { id: "ACT 103", municipio: "ACTOPAN", localidad: "COL. NUEVA",          lat: 20.2730, lng: -98.9355, ocupados: 12, cap: 16, tomodat: "Activo" },
  { id: "ACT 104", municipio: "ACTOPAN", localidad: "COL. NUEVA",          lat: 20.2748, lng: -98.9340, ocupados: 2,  cap: 8,  tomodat: "Rojo"   },
  { id: "ACT 105", municipio: "ACTOPAN", localidad: "LAS PALMAS",          lat: 20.2665, lng: -98.9420, ocupados: 6,  cap: 8,  tomodat: "Activo" },
  { id: "ACT 106", municipio: "ACTOPAN", localidad: "EL HUERTO",           lat: 20.2680, lng: -98.9448, ocupados: 8,  cap: 8,  tomodat: "Rojo"   },
  { id: "ACT 107", municipio: "ACTOPAN", localidad: "BARRIO SAN MIGUEL",   lat: 20.2718, lng: -98.9373, ocupados: 4,  cap: 16, tomodat: "Activo" },
  { id: "ACT 108", municipio: "ACTOPAN", localidad: "LA ESTACION",         lat: 20.2655, lng: -98.9395, ocupados: 7,  cap: 8,  tomodat: "Activo" },
  { id: "ACT 109", municipio: "ACTOPAN", localidad: "FRACCIONAMIENTO NORTE",lat:20.2758, lng: -98.9380, ocupados: 1,  cap: 16, tomodat: "Activo" },
  { id: "ACT 110", municipio: "ACTOPAN", localidad: "COLONIA HIDALGO",     lat: 20.2700, lng: -98.9330, ocupados: 0,  cap: 8,  tomodat: "Activo" },
];

// Encode a Firestore document body
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (typeof v === "number" && Number.isInteger(v)) fields[k] = { integerValue: String(v) };
    else if (typeof v === "number") fields[k] = { doubleValue: v };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
  }
  return fields;
}

async function upsert(collection, docId, data) {
  const url = `${BASE_URL}/${collection}/${encodeURIComponent(docId)}?key=${API_KEY}`;
  const body = { fields: toFields(data) };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? res.statusText);
  }
  return res.json();
}

async function seed() {
  console.log("Insertando 10 NAPs de prueba (Actopan, Hidalgo)...\n");

  for (const n of naps) {
    const sem =
      n.ocupados > n.cap   ? "🔵 Sobre-ocup." :
      n.ocupados === n.cap ? "🔴 LLENA       " :
      n.ocupados >= n.cap * 0.7 ? "🟡 Alta ocup.  " :
                              "🟢 Disponible  ";
    try {
      await upsert("naps", n.id, {
        id_nap: n.id,
        nombre: `${n.localidad} - ${n.id}`,
        municipio: n.municipio,
        localidad: n.localidad,
        capacidad_total: n.cap,
        puertos_ocupados: n.ocupados,
        estado_tomodat: n.tomodat,
        verificacion: 1,
        latitud: n.lat,
        longitud: n.lng,
      });
      await upsert("config_geografica", `${n.municipio}|${n.localidad}`, {
        municipio: n.municipio,
        localidad: n.localidad,
      });
      console.log(`✓ ${n.id.padEnd(10)} ${sem} ${n.ocupados}/${n.cap} puertos  Tomodat: ${n.tomodat}`);
    } catch (err) {
      console.error(`✗ Error en ${n.id}:`, err.message);
    }
  }

  console.log("\n✅ Listo. Abre el mapa en la app para verlas.");
  process.exit(0);
}

seed();
