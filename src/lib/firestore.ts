import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import type { NAP, Cliente, LocalidadEntry } from "./types";

const NAPS_COL = "naps";
const CLIENTES_COL = "clientes";
const GEO_COL = "config_geografica";

// ── NAPs ──

export async function getNAPs(): Promise<NAP[]> {
  const snap = await getDocs(collection(db, NAPS_COL));
  const napsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
  return napsData.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function getNAPById(id: string): Promise<NAP | null> {
  const snap = await getDoc(doc(db, NAPS_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<NAP, "id">) };
}

export async function addNAP(data: Omit<NAP, "id">): Promise<string> {
  await setDoc(doc(db, NAPS_COL, data.id_nap), data, { merge: true });
  // Registrar municipio/localidad en config_geografica
  const geoId = `${data.municipio}|${data.localidad}`;
  await setDoc(doc(db, GEO_COL, geoId), {
    municipio: data.municipio,
    localidad: data.localidad,
  });
  return data.id_nap;
}

export async function updateNAP(id: string, data: Partial<NAP>): Promise<void> {
  await updateDoc(doc(db, NAPS_COL, id), data as Record<string, unknown>);
}

export async function deleteNAP(napId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await runTransaction(db, async (tx) => {
      const clientesQuery = query(collection(db, CLIENTES_COL), where("id_nap", "==", napId));
      const clientesSnap = await tx.get(clientesQuery);

      clientesSnap.docs.forEach((d) => tx.delete(d.ref));

      tx.delete(doc(db, NAPS_COL, napId));
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar NAP.";
    return { success: false, error: message };
  }
}

// ── Clientes ──

export async function getClientes(): Promise<Cliente[]> {
  const snap = await getDocs(collection(db, CLIENTES_COL));
  const clientes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, "id">) }));
  return clientes.sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta));
}

export async function getClientesByNAP(napId: string): Promise<Cliente[]> {
  const q = query(
    collection(db, CLIENTES_COL),
    where("id_nap", "==", napId)
  );
  const snap = await getDocs(q);
  const clientes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, "id">) }));
  return clientes.sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta));
}

export async function getClienteByWisp(id_wisp: string): Promise<Cliente | null> {
  const q = query(collection(db, CLIENTES_COL), where("id_wisp", "==", id_wisp));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Cliente, "id">) };
}

export async function updateCliente(
  clienteId: string,
  data: Partial<Pick<Cliente, "nombre" | "municipio" | "localidad">>
): Promise<void> {
  await updateDoc(doc(db, CLIENTES_COL, clienteId), data as Record<string, unknown>);
}

// ── Registro con validación y atomicidad ──

export interface RegisterResult {
  success: boolean;
  error?: string;
  clienteId?: string;
}

export async function registerCliente(
  data: Omit<Cliente, "id" | "fecha_alta">
): Promise<RegisterResult> {
  const napRef = doc(db, NAPS_COL, data.id_nap);

  try {
    const result = await runTransaction(db, async (tx) => {
      const napSnap = await tx.get(napRef);
      if (!napSnap.exists()) {
        return { success: false, error: "NAP no encontrada." };
      }

      const napData = napSnap.data() as Omit<NAP, "id">;

      // Validar duplicidad de id_wisp
      const dupQuery = query(
        collection(db, CLIENTES_COL),
        where("id_wisp", "==", data.id_wisp)
      );
      const dupSnap = await getDocs(dupQuery);
      if (!dupSnap.empty) {
        return { success: false, error: `El ID WISP "${data.id_wisp}" ya existe.` };
      }

      // Validar capacidad
      if (napData.puertos_ocupados >= napData.capacidad_total) {
        return {
          success: false,
          error: `La NAP "${napData.nombre}" está llena (${napData.puertos_ocupados}/${napData.capacidad_total}).`,
        };
      }

      // Crear cliente
      const clienteData = {
        ...data,
        fecha_alta: new Date().toISOString().split("T")[0],
      };
      const clienteRef = doc(collection(db, CLIENTES_COL));
      tx.set(clienteRef, clienteData);

      // Registrar municipio/localidad en config_geografica
      const geoId = `${data.municipio}|${data.localidad}`;
      const geoRef = doc(db, GEO_COL, geoId);
      tx.set(geoRef, {
        municipio: data.municipio,
        localidad: data.localidad,
      });

      // Incrementar contador atómicamente
      tx.update(napRef, {
        puertos_ocupados: napData.puertos_ocupados + 1,
      });

      return { success: true, clienteId: clienteRef.id, napData };
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar cliente.";
    return { success: false, error: message };
  }
}

// ── Eliminar cliente con decremento atómico ──

export async function deleteCliente(clienteId: string): Promise<{ success: boolean; error?: string }> {
  const clienteRef = doc(db, CLIENTES_COL, clienteId);

  try {
    const result = await runTransaction(db, async (tx) => {
      const clienteSnap = await tx.get(clienteRef);
      if (!clienteSnap.exists()) {
        return { success: false, error: "Cliente no encontrado." };
      }

      const clienteData = clienteSnap.data() as Omit<Cliente, "id">;
      const napRef = doc(db, NAPS_COL, clienteData.id_nap);
      const napSnap = await tx.get(napRef);

      if (napSnap.exists()) {
        const napData = napSnap.data() as Omit<NAP, "id">;
        tx.update(napRef, {
          puertos_ocupados: Math.max(0, napData.puertos_ocupados - 1),
        });
      }

      tx.delete(clienteRef);
      return { success: true, napData: napSnap.exists() ? napSnap.data() as Omit<NAP, "id"> : null };
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar cliente.";
    return { success: false, error: message };
  }
}

// ── Geografía: filtros en cascada ──

export async function getMunicipios(): Promise<string[]> {
  const snap = await getDocs(collection(db, GEO_COL));
  const municipios = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data() as LocalidadEntry;
    municipios.add(data.municipio);
  });
  return Array.from(municipios).sort();
}

export async function getLocalidadesByMunicipio(municipio: string): Promise<string[]> {
  const q = query(collection(db, GEO_COL), where("municipio", "==", municipio));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => (d.data() as LocalidadEntry).localidad)
    .sort();
}

export async function getNAPsByLocalidad(localidad: string): Promise<NAP[]> {
  const q = query(collection(db, NAPS_COL), where("localidad", "==", localidad));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
}

// ── Semáforo ──

export function getNAPColor(nap: NAP): string {
  const o = nap.puertos_ocupados;
  const c = nap.capacidad_total;

  if (o > c) return "#a855f7"; // morado — error de sobre-ocupación
  if (o === c) return "#ef4444"; // rojo — lleno
  if (o >= c * 0.75) return "#eab308"; // amarillo — alta ocupación
  if (o <= 2) return "#22c55e"; // verde — disponible
  return "#eab308"; // amarillo por defecto
}

// ── Usuarios de plataforma ──

export interface Usuario {
  id: string;
  uid: string;
  email: string;
  creado: string;
}

const USUARIOS_COL = "usuarios";

export async function getUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, USUARIOS_COL));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Usuario, "id">) }));
}

export async function addUsuario(uid: string, email: string): Promise<void> {
  await setDoc(doc(db, USUARIOS_COL, uid), {
    uid,
    email,
    creado: new Date().toISOString().split("T")[0],
  });
}
