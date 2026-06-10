import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  runTransaction,
  onSnapshot,
  getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import type { NAP, Cliente, LocalidadEntry } from "./types";
import { notifyNapEvent } from "./napNotify";

const NAPS_COL = "naps";
const CLIENTES_COL = "clientes";
const GEO_COL = "config_geografica";

// ── NAPs ──

export interface PaginatedResult<T> {
  data: T[];
  lastVisible: unknown;
  hasMore: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

export async function getNAPs(pageSize: number = DEFAULT_PAGE_SIZE, lastVisible?: unknown): Promise<PaginatedResult<NAP>> {
  const colRef = collection(db, NAPS_COL);
  let q = query(colRef, orderBy("nombre"), limit(pageSize));
  
  if (lastVisible) {
    q = query(colRef, orderBy("nombre"), startAfter(lastVisible), limit(pageSize));
  }
  
  const snap = await getDocs(q);
  const napsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
  
  return {
    data: napsData,
    lastVisible: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === pageSize,
  };
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
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(db, NAPS_COL, id), cleaned as Record<string, unknown>);
}

export async function deleteNAP(napId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const clientesQuery = query(collection(db, CLIENTES_COL), where("id_nap", "==", napId));
    const clientesSnap = await getDocs(clientesQuery);

    await runTransaction(db, async (tx) => {
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

export async function getClientes(
  pageSize: number = 25,
  lastVisible?: unknown,
  municipio?: string,
  localidad?: string,
  id_nap?: string
): Promise<PaginatedResult<Cliente>> {
  const colRef = collection(db, CLIENTES_COL);
  const constraints: any[] = [];

  if (municipio) constraints.push(where("municipio", "==", municipio));
  if (localidad) constraints.push(where("localidad", "==", localidad));
  if (id_nap) constraints.push(where("id_nap", "==", id_nap));

  // Solo ordenamos por fecha_alta si NO hay filtros, para no requerir un composite index
  if (!municipio && !localidad && !id_nap) {
    constraints.push(orderBy("fecha_alta", "desc"));
  }

  if (lastVisible) constraints.push(startAfter(lastVisible));
  constraints.push(limit(pageSize));

  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);
  const clientes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, "id">) }));
  
  return {
    data: clientes,
    lastVisible: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
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
  const q = query(collection(db, CLIENTES_COL), where("id_wisp", "==", id_wisp), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<Cliente, "id">) };
}

export async function searchClientes(searchText: string): Promise<Cliente[]> {
  const txt = searchText.trim();
  if (!txt) return [];

  // Buscar coincidencia exacta por ID WISP
  const qWisp = getDocs(query(collection(db, CLIENTES_COL), where("id_wisp", "==", txt), limit(5)));
  
  // Buscar coincidencia exacta por ID NAP (ignorando case asumiendo que suelen escribir exacto)
  // Para hacer búsqueda parcial requeriríamos Algolia, pero un "==" en id_nap ayuda
  const qNap = getDocs(query(collection(db, CLIENTES_COL), where("id_nap", "==", txt.toUpperCase()), limit(50)));

  // Búsqueda por prefijo de nombre (Case Sensitive en Firestore, asume que está Capitalizado o en Mayúsculas)
  // Intentamos con la primera letra mayúscula para coincidir con el formato de la BD
  const txtCapitalizado = txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
  const txtMayusculas = txt.toUpperCase();

  const qNombreCap = getDocs(
    query(
      collection(db, CLIENTES_COL),
      where("nombre", ">=", txtCapitalizado),
      where("nombre", "<=", txtCapitalizado + "\uf8ff"),
      limit(20)
    )
  );

  const qNombreMayus = getDocs(
    query(
      collection(db, CLIENTES_COL),
      where("nombre", ">=", txtMayusculas),
      where("nombre", "<=", txtMayusculas + "\uf8ff"),
      limit(20)
    )
  );

  const results = await Promise.all([qWisp, qNap, qNombreCap, qNombreMayus]);
  
  const map = new Map<string, Cliente>();
  results.forEach(snap => {
    snap.docs.forEach(doc => {
      map.set(doc.id, { id: doc.id, ...(doc.data() as Omit<Cliente, "id">) });
    });
  });

  return Array.from(map.values());
}

export async function updateCliente(
  clienteId: string,
  data: Partial<Pick<Cliente, "nombre" | "municipio" | "localidad">>
): Promise<void> {
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(db, CLIENTES_COL, clienteId), cleaned as Record<string, unknown>);
}

export async function updateClienteNAP(
  clienteId: string,
  newNapId: string
): Promise<{ success: boolean; error?: string }> {
  const clienteRef = doc(db, CLIENTES_COL, clienteId);

  try {
    const result = await runTransaction(db, async (tx) => {
      const clienteSnap = await tx.get(clienteRef);
      if (!clienteSnap.exists()) {
        return { success: false, error: "Cliente no encontrado." };
      }
      const clienteData = clienteSnap.data() as Omit<Cliente, "id">;
      const oldNapId = clienteData.id_nap;

      const newNapRef = doc(db, NAPS_COL, newNapId);
      const newNapSnap = await tx.get(newNapRef);
      if (!newNapSnap.exists()) {
        return { success: false, error: "NAP destino no encontrada." };
      }
      const newNapData = newNapSnap.data() as Omit<NAP, "id">;

      if (oldNapId !== newNapId) {
        // Validar capacidad ANTES de cualquier escritura
        if (newNapData.puertos_ocupados >= newNapData.capacidad_total) {
          return { success: false, error: "La NAP destino está llena." };
        }

        let oldNapData: Omit<NAP, "id"> | null = null;
        let oldNapWasFull = false;
        let oldNapNewOcupados = 0;

        // Decrement old NAP
        if (oldNapId) {
          const oldNapRef = doc(db, NAPS_COL, oldNapId);
          const oldNapSnap = await tx.get(oldNapRef);
          if (oldNapSnap.exists()) {
            oldNapData = oldNapSnap.data() as Omit<NAP, "id">;
            oldNapWasFull = oldNapData.puertos_ocupados >= oldNapData.capacidad_total;
            oldNapNewOcupados = Math.max(0, oldNapData.puertos_ocupados - 1);
            tx.update(oldNapRef, {
              puertos_ocupados: oldNapNewOcupados,
            });
          }
        }

        // Increment new NAP
        const newNapNewOcupados = newNapData.puertos_ocupados + 1;
        tx.update(newNapRef, {
          puertos_ocupados: newNapNewOcupados,
        });

        // Update cliente
        tx.update(clienteRef, {
          id_nap: newNapId,
          municipio: newNapData.municipio,
          localidad: newNapData.localidad,
        } as Record<string, unknown>);

        return { 
          success: true,
          oldNapId,
          oldNapData,
          oldNapWasFull,
          oldNapNewOcupados,
          newNapData,
          newNapNewOcupados,
        };
      }

      return { success: true };
    });

    if (result.success && "newNapData" in result) {
      const data = result as any;
      // Notificar si la NAP nueva se llenó
      if (data.newNapNewOcupados >= data.newNapData.capacidad_total) {
        await notifyNapEvent({
          tipoEvento: "LLENA",
          idNap: newNapId,
          nombre: data.newNapData.nombre,
          municipio: data.newNapData.municipio,
          localidad: data.newNapData.localidad,
          ocupados: data.newNapNewOcupados,
          capacidad: data.newNapData.capacidad_total,
        });
      }
      // Notificar si la NAP antigua se liberó
      if (data.oldNapId && data.oldNapWasFull && data.oldNapData) {
        await notifyNapEvent({
          tipoEvento: "LIBERADA",
          idNap: data.oldNapId,
          nombre: data.oldNapData.nombre,
          municipio: data.oldNapData.municipio,
          localidad: data.oldNapData.localidad,
          ocupados: data.oldNapNewOcupados,
          capacidad: data.oldNapData.capacidad_total,
        });
      }
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al reasignar cliente.";
    return { success: false, error: message };
  }
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

      // Validar duplicidad de id_wisp (dentro de la transacción)
      const dupRef = doc(db, CLIENTES_COL, data.id_wisp);
      const dupSnap = await tx.get(dupRef);
      if (dupSnap.exists()) {
        return { success: false, error: `El ID WISP "${data.id_wisp}" ya existe.` };
      }

      // Validar capacidad
      if (napData.puertos_ocupados >= napData.capacidad_total) {
        return {
          success: false,
          error: `La NAP "${napData.nombre}" está llena (${napData.puertos_ocupados}/${napData.capacidad_total}).`,
        };
      }

      // Crear cliente usando id_wisp como ID del documento
      const clienteData = {
        ...data,
        fecha_alta: new Date().toISOString().split("T")[0],
      };
      const clienteRef = doc(db, CLIENTES_COL, data.id_wisp);
      tx.set(clienteRef, clienteData);

      // Registrar municipio/localidad en config_geografica
      const geoId = `${data.municipio}|${data.localidad}`;
      const geoRef = doc(db, GEO_COL, geoId);
      tx.set(geoRef, {
        municipio: data.municipio,
        localidad: data.localidad,
      });

      // Incrementar contador atómicamente
      const newOcupados = napData.puertos_ocupados + 1;
      tx.update(napRef, {
        puertos_ocupados: newOcupados,
      });

      return { success: true, clienteId: clienteRef.id, napData, newOcupados };
    });

    // Verificar si la NAP se lleno despues de registrar
    if (result.success && "newOcupados" in result && "napData" in result) {
      const { napData, newOcupados } = result as { napData: Omit<NAP, "id">; newOcupados: number };
      if (newOcupados >= napData.capacidad_total) {
        await notifyNapEvent({
          tipoEvento: "LLENA",
          idNap: data.id_nap,
          nombre: napData.nombre,
          municipio: napData.municipio,
          localidad: napData.localidad,
          ocupados: newOcupados,
          capacidad: napData.capacidad_total,
        });
      }
    }

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
        return { success: false, error: "Cliente no encontrado en la base de datos." };
      }

      const clienteData = clienteSnap.data() as Omit<Cliente, "id">;
      
      if (!clienteData.id_nap) {
        tx.delete(clienteRef);
        return { success: true, napData: null, idNap: null, wasFull: false };
      }

      const napRef = doc(db, NAPS_COL, String(clienteData.id_nap));
      const napSnap = await tx.get(napRef);

      let newOcupados = 0;
      let wasFull = false;
      if (napSnap.exists()) {
        const napData = napSnap.data() as Omit<NAP, "id">;
        wasFull = napData.puertos_ocupados >= napData.capacidad_total;
        newOcupados = Math.max(0, napData.puertos_ocupados - 1);
        tx.update(napRef, {
          puertos_ocupados: newOcupados,
        });
      }

      tx.delete(clienteRef);
      return { success: true, napData: napSnap.exists() ? napSnap.data() as Omit<NAP, "id"> : null, newOcupados, idNap: clienteData.id_nap, wasFull };
    });

    // Enviar correo solo si la NAP estaba LLENA y se libero un puerto
    if (result.success && result.wasFull && "napData" in result && result.napData && result.idNap) {
      const { napData, newOcupados, idNap } = result as { napData: Omit<NAP, "id">; newOcupados: number; idNap: string };
      await notifyNapEvent({
        tipoEvento: "LIBERADA",
        idNap: String(idNap),
        nombre: napData.nombre,
        municipio: napData.municipio,
        localidad: napData.localidad,
        ocupados: newOcupados,
        capacidad: napData.capacidad_total,
      });
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar cliente.";
    console.error("Error en deleteCliente:", err);
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
  const localidades = new Set<string>();
  snap.docs.forEach((d) => {
    localidades.add((d.data() as LocalidadEntry).localidad);
  });
  return Array.from(localidades).sort();
}

export async function getNAPsByLocalidad(localidad: string): Promise<NAP[]> {
  const q = query(collection(db, NAPS_COL), where("localidad", "==", localidad));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
}

// ── Semáforo ──

export type SemaforoState = "verde" | "amarillo" | "rojo" | "celeste";

export function getNAPColor(nap: NAP): SemaforoState {
  const o = nap.puertos_ocupados;
  const c = nap.capacidad_total;
  if (o > c) return "celeste";
  if (o === c) return "rojo";
  if (o >= c * 0.7) return "amarillo";
  return "verde";
}

// ── Usuarios de plataforma ──

export type Rol = "admin" | "sucursal" | "infraestructura" | "instalador" | "administracion" | "soporte";

export interface Usuario {
  id: string;
  uid: string;
  email: string;
  creado: string;
  rol: Rol;
}

const USUARIOS_COL = "usuarios";

export async function getUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, USUARIOS_COL));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Usuario, "id">) }));
}

export async function addUsuario(uid: string, email: string): Promise<void> {
  const userRef = doc(db, USUARIOS_COL, uid);
  const userSnap = await getDoc(userRef);

  // Solo creamos el documento si no existe, para NO sobrescribir su rol
  if (!userSnap.exists()) {
    const allUsersSnap = await getDocs(query(collection(db, USUARIOS_COL), limit(1)));
    const defaultRol: Rol = allUsersSnap.empty ? "admin" : "instalador";

    await setDoc(userRef, {
      uid,
      email,
      creado: new Date().toISOString().split("T")[0],
      rol: defaultRol,
    });
  }
}

export async function updateUsuarioRol(uid: string, nuevoRol: Rol): Promise<void> {
  await updateDoc(doc(db, USUARIOS_COL, uid), { rol: nuevoRol });
}

// ── Optimizaciones (Suscripciones en tiempo real) ──

export function subscribeToNAPs(callback: (naps: NAP[]) => void) {
  const q = query(collection(db, NAPS_COL), orderBy("nombre"), limit(3000));
  return onSnapshot(
    q,
    (snap) => {
      const napsData = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
      callback(napsData);
    },
    (error) => {
      if (error.code === "permission-denied") console.warn("Suscripción a NAPs cancelada (logout).");
      else console.error("Error en NAPs:", error);
    }
  );
}

export function subscribeToUsuarios(callback: (usuarios: Usuario[]) => void) {
  return onSnapshot(
    collection(db, USUARIOS_COL),
    (snap) => {
      const usuarios = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Usuario, "id">) }));
      callback(usuarios);
    },
    (error) => {
      if (error.code === "permission-denied") console.warn("Suscripción a Usuarios cancelada (logout).");
      else console.error("Error en Usuarios:", error);
    }
  );
}

// ── Reconciliación de puertos ──

export async function reconcileNAPs(): Promise<{ corregidas: number; correctas: number }> {
  const [napsSnap, clientesSnap] = await Promise.all([
    getDocs(collection(db, NAPS_COL)),
    getDocs(collection(db, CLIENTES_COL)),
  ]);

  // Contar clientes reales por NAP
  const clientesPorNap = new Map<string, number>();
  for (const c of clientesSnap.docs) {
    const idNap = (c.data() as Record<string, unknown>).id_nap as string;
    if (idNap) {
      clientesPorNap.set(idNap, (clientesPorNap.get(idNap) || 0) + 1);
    }
  }

  let corregidas = 0;
  let correctas = 0;

  for (const nap of napsSnap.docs) {
    const data = nap.data() as Record<string, unknown>;
    const real = clientesPorNap.get(nap.id) || 0;
    const actual = (data.puertos_ocupados as number) || 0;

    if (actual !== real) {
      await updateDoc(doc(db, NAPS_COL, nap.id), { puertos_ocupados: real } as Record<string, unknown>);
      corregidas++;
    } else {
      correctas++;
    }
  }

  return { corregidas, correctas };
}
