/**
 * Script de reconciliación: corrige puertos_ocupados de cada NAP
 * contando los clientes reales que la referencian.
 *
 * Ejecutar con: npx tsx scripts/reconcile-naps.ts
 */
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";

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

async function reconcile() {
  console.log("🔍 Iniciando reconciliación de NAPs...\n");

  const napsSnap = await getDocs(collection(db, "naps"));
  const clientesSnap = await getDocs(collection(db, "clientes"));

  // Contar clientes por NAP
  const clientesPorNap = new Map<string, number>();
  for (const c of clientesSnap.docs) {
    const idNap = c.data().id_nap as string;
    if (idNap) {
      clientesPorNap.set(idNap, (clientesPorNap.get(idNap) || 0) + 1);
    }
  }

  let corregidas = 0;
  let correctas = 0;

  for (const nap of napsSnap.docs) {
    const data = nap.data();
    const real = clientesPorNap.get(nap.id) || 0;
    const actual = (data.puertos_ocupados as number) || 0;

    if (actual !== real) {
      console.log(`  ⚡ ${data.id_nap || nap.id}: ${actual} → ${real} (${real - actual > 0 ? "+" : ""}${real - actual})`);
      await updateDoc(doc(db, "naps", nap.id), { puertos_ocupados: real });
      corregidas++;
    } else {
      correctas++;
    }
  }

  console.log(`\n✅ ${corregidas} NAPs corregidas, ${correctas} ya estaban correctas.`);
  console.log(`   Total NAPs: ${napsSnap.size}, Total clientes: ${clientesSnap.size}`);
}

reconcile().catch(console.error).finally(() => process.exit(0));
