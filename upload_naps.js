const fs = require('fs');
const xlsx = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadNAPs() {
  console.log("Reading Excel file...");
  const workbook = xlsx.readFile('csv/NAPs ACTUALIZACION.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  console.log(`Found ${data.length} rows. Uploading to Firestore...`);

  let count = 0;
  let batchData = [];
  
  for (const row of data) {
    const getVal = (key) => {
      const foundKey = Object.keys(row).find(k => k.trim().toUpperCase() === key.toUpperCase());
      return foundKey ? row[foundKey] : undefined;
    };

    const idNap = getVal('NAP');
    if (!idNap) continue;

    const latStr = String(getVal('Latitud') || '').trim();
    const lngStr = String(getVal('Longitud') || '').trim();
    const lat = parseFloat(latStr.replace(/,/g, ''));
    const lng = parseFloat(lngStr.replace(/,/g, ''));

    const rojoTomodat = String(getVal('¿ROJO EN TOMODAT?') || '').toUpperCase().trim();
    let estadoTomodat = 'Verde'; // Default
    if (rojoTomodat === 'SI' || rojoTomodat === 'SÍ') {
      estadoTomodat = 'Rojo';
    } else if (rojoTomodat === 'NO') {
      estadoTomodat = 'Verde';
    } else if (rojoTomodat) {
      estadoTomodat = getVal('¿ROJO EN TOMODAT?'); // fallback if it's something else
    }

    const napData = {
      id_nap: String(idNap).trim(),
      nombre: String(idNap).trim(),
      municipio: String(getVal('MUNICIPIO') || '').trim(),
      localidad: String(getVal('LOCALIDAD') || '').trim(),
      capacidad_total: parseInt(getVal('PUERTOS')) || 8,
      puertos_ocupados: 0, 
      estado_tomodat: estadoTomodat,
      verificacion: 0,
      latitud: isNaN(lat) ? null : lat,
      longitud: isNaN(lng) ? null : lng,
    };

    const docRef = doc(db, 'naps', napData.id_nap);
    batchData.push(setDoc(docRef, napData));
    count++;

    if (batchData.length >= 100) {
      await Promise.all(batchData);
      console.log(`Uploaded ${count} NAPs...`);
      batchData = [];
    }
  }

  if (batchData.length > 0) {
    await Promise.all(batchData);
  }

  console.log(`Successfully uploaded ${count} NAPs with correct coordinates!`);
  process.exit(0);
}

uploadNAPs().catch(err => {
  console.error("Error uploading:", err);
  process.exit(1);
});
