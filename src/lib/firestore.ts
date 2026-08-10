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

/** Colección principal de Cajas NAP en Firestore */
const NAPS_COL = "naps";
/** Colección principal de Clientes en Firestore */
const CLIENTES_COL = "clientes";
/** Colección de configuración geográfica (municipios y localidades) */
const GEO_COL = "config_geografica";

// ── NAPs ──

/**
 * Actualiza la marca temporal global de NAPs en el documento `metadata/naps`.
 * Permite a los clientes remotos detectar cambios y actualizar su caché local.
 */
export async function touchNapsMetadata(): Promise<void> {
  try {
    await setDoc(doc(db, "metadata", "naps"), { lastUpdatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error("No se pudo actualizar la marca temporal de metadata de NAPs:", e);
  }
}

/**
 * Estructura de resultado paginado para consultas de listas extensas.
 */
export interface PaginatedResult<T> {
  /** Colección de elementos recuperados en la página actual */
  data: T[];
  /** Puntero al último documento visible (usado para `startAfter` en la siguiente página) */
  lastVisible: unknown;
  /** Indica si existen más elementos disponibles para seguir paginando */
  hasMore: boolean;
}

/** Tamaño predeterminado de página para la lista de NAPs */
const DEFAULT_PAGE_SIZE = 50;

/**
 * Obtiene una lista paginada de NAPs ordenadas por su nombre.
 *
 * @param pageSize Cantidad de NAPs por página (por defecto 50).
 * @param lastVisible Puntero al último documento retornado en la página previa.
 */
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

/**
 * Obtiene una NAP individual a partir de su ID de documento.
 * @param id ID único de la NAP.
 */
export async function getNAPById(id: string): Promise<NAP | null> {
  const snap = await getDoc(doc(db, NAPS_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<NAP, "id">) };
}

/**
 * Registra una nueva NAP o sobrescribe una existente de forma limpia (depurando campos `undefined`).
 * También actualiza el registro de municipios/localidades en la colección geográfica.
 *
 * @param data Datos de la NAP sin el ID.
 * @returns El ID asignado a la NAP (`data.id_nap`).
 */
export async function addNAP(data: Omit<NAP, "id">): Promise<string> {
  // Firestore no acepta valores `undefined`, se remueven antes de guardar
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Omit<NAP, "id">;
  await setDoc(doc(db, NAPS_COL, data.id_nap), cleaned, { merge: true });
  
  // Registra municipio/localidad en config_geografica
  const geoId = `${data.municipio}|${data.localidad}`;
  await setDoc(doc(db, GEO_COL, geoId), {
    municipio: data.municipio,
    localidad: data.localidad,
  });
  await touchNapsMetadata();
  return data.id_nap;
}

/**
 * Actualiza parcialmente los campos de una NAP.
 *
 * @param id ID único del documento NAP.
 * @param data Objeto parcial con las propiedades a actualizar.
 */
export async function updateNAP(id: string, data: Partial<NAP>): Promise<void> {
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(db, NAPS_COL, id), cleaned as Record<string, unknown>);
  await touchNapsMetadata();
}

/**
 * Elimina una NAP y todos los clientes asociados en una única transacción atómica de Firestore.
 *
 * @param napId ID único de la NAP a eliminar.
 */
export async function deleteNAP(napId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const clientesQuery = query(collection(db, CLIENTES_COL), where("id_nap", "==", napId));
    const clientesSnap = await getDocs(clientesQuery);

    await runTransaction(db, async (tx) => {
      // Bloquea la NAP leyéndola dentro de la transacción
      const napRef = doc(db, NAPS_COL, napId);
      const napSnap = await tx.get(napRef);
      
      if (!napSnap.exists()) {
        throw new Error("La NAP ya no existe o fue eliminada.");
      }

      // Elimina todos los clientes conectados a esta NAP
      clientesSnap.docs.forEach((d) => tx.delete(d.ref));
      
      // Elimina la NAP
      tx.delete(napRef);
    });
    await touchNapsMetadata();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar NAP.";
    return { success: false, error: message };
  }
}

// ── Clientes ──

/**
 * Obtiene una lista paginada y filtrable de clientes.
 *
 * @param pageSize Cantidad de clientes por página.
 * @param lastVisible Documento previo para paginación.
 * @param municipio Filtro por municipio.
 * @param localidad Filtro por localidad.
 * @param id_nap Filtro por NAP.
 */
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

  // Ordena por fecha_alta únicamente si no hay filtros activos para no requerir un índice compuesto
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

/**
 * Recupera todos los clientes coincidentes con los filtros para exportación completa.
 */
export async function getAllClientesForExport(
  municipio?: string,
  localidad?: string,
  id_nap?: string
): Promise<Cliente[]> {
  const colRef = collection(db, CLIENTES_COL);
  const constraints: any[] = [];

  if (municipio) constraints.push(where("municipio", "==", municipio));
  if (localidad) constraints.push(where("localidad", "==", localidad));
  if (id_nap) constraints.push(where("id_nap", "==", id_nap));

  if (!municipio && !localidad && !id_nap) {
    constraints.push(orderBy("fecha_alta", "desc"));
  }

  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, "id">) }));
}

/**
 * Obtiene todos los clientes conectados a una NAP específica, ordenados por fecha de alta descendente.
 * @param napId ID de la NAP.
 */
export async function getClientesByNAP(napId: string): Promise<Cliente[]> {
  const q = query(
    collection(db, CLIENTES_COL),
    where("id_nap", "==", napId)
  );
  const snap = await getDocs(q);
  const clientes = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Cliente, "id">) }));
  return clientes.sort((a, b) => b.fecha_alta.localeCompare(a.fecha_alta));
}

/**
 * Busca un cliente por su ID WISP.
 * @param id_wisp Identificador único de cliente en WISP.
 */
export async function getClienteByWisp(id_wisp: string): Promise<Cliente | null> {
  const q = query(collection(db, CLIENTES_COL), where("id_wisp", "==", id_wisp), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<Cliente, "id">) };
}

/** Caché en memoria para optimizar la búsqueda flexible de clientes por subcadena de nombre */
let cachedClientes: Cliente[] | null = null;
/** Marca temporal de la última actualización del caché de clientes */
let lastCacheTime = 0;
/** Tiempo de vida (TTL) del caché en memoria (5 minutos) */
const CACHE_TTL = 1000 * 60 * 5;

/**
 * Búsqueda inteligente de clientes por ID WISP, ID NAP o coincidencia parcial de nombre.
 * Utiliza caché en memoria para evitar consumo masivo de lecturas en Firestore.
 *
 * @param searchText Texto a buscar.
 */
export async function searchClientes(searchText: string): Promise<Cliente[]> {
  const txt = searchText.trim();
  if (!txt) return [];

  const map = new Map<string, Cliente>();
  const addDocs = (snap: any) => {
    snap.docs.forEach((doc: any) => {
      map.set(doc.id, { id: doc.id, ...(doc.data() as Omit<Cliente, "id">) });
    });
  };

  // 1. Coincidencia exacta por ID WISP
  const qWisp = await getDocs(query(collection(db, CLIENTES_COL), where("id_wisp", "==", txt), limit(5)));
  addDocs(qWisp);
  if (map.size > 0) return Array.from(map.values());

  // 2. Coincidencia exacta por ID NAP
  const qNap = await getDocs(query(collection(db, CLIENTES_COL), where("id_nap", "==", txt.toUpperCase()), limit(50)));
  addDocs(qNap);
  if (map.size > 0) return Array.from(map.values());

  // 3. Búsqueda por subcadena en nombre utilizando el caché en memoria
  if (!cachedClientes || Date.now() - lastCacheTime > CACHE_TTL) {
    const snap = await getDocs(collection(db, CLIENTES_COL));
    cachedClientes = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Omit<Cliente, "id">) }));
    lastCacheTime = Date.now();
  }

  const searchLower = txt.toLowerCase();
  const matchedByName = cachedClientes.filter(c => c.nombre.toLowerCase().includes(searchLower));
  
  return matchedByName;
}

/**
 * Actualiza los datos generales de un cliente (nombre, municipio, localidad).
 */
export async function updateCliente(
  clienteId: string,
  data: Partial<Pick<Cliente, "nombre" | "municipio" | "localidad">>
): Promise<void> {
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(db, CLIENTES_COL, clienteId), cleaned as Record<string, unknown>);
}

/**
 * Reasigna un cliente a una nueva NAP en una transacción atómica.
 * Ajusta automáticamente los contadores de puertos ocupados en la NAP origen y destino.
 * Dispara notificaciones por correo electrónico si alguna NAP se llena o se libera.
 *
 * @param clienteId ID del cliente.
 * @param newNapId ID de la nueva NAP destino.
 */
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
        // Valida la capacidad de la NAP destino antes de realizar escrituras
        if (newNapData.puertos_ocupados >= newNapData.capacidad_total) {
          return { success: false, error: "La NAP destino está llena." };
        }

        let oldNapData: Omit<NAP, "id"> | null = null;
        let oldNapWasFull = false;
        let oldNapNewOcupados = 0;

        // Decrementa el contador de la NAP anterior
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

        // Incrementa el contador de la nueva NAP
        const newNapNewOcupados = newNapData.puertos_ocupados + 1;
        tx.update(newNapRef, {
          puertos_ocupados: newNapNewOcupados,
        });

        // Actualiza los datos del cliente
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
      // Notifica si la nueva NAP quedó saturada
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
      // Notifica si la NAP anterior se liberó
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
      await touchNapsMetadata();
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al reasignar cliente.";
    return { success: false, error: message };
  }
}

// ── Registro con validación y atomicidad ──

/**
 * Resultado devuelto por la función `registerCliente`.
 */
export interface RegisterResult {
  /** Indica si la alta fue exitosa */
  success: boolean;
  /** Mensaje de error si la operación no fue exitosa */
  error?: string;
  /** ID asignado al cliente en Firestore */
  clienteId?: string;
}

/**
 * Registra un cliente de forma atómica en Firestore.
 * Valida la existencia de la NAP, la capacidad disponible de puertos y la unicidad del ID WISP.
 * Incrementar el número de puertos ocupados en la NAP objetivo.
 *
 * @param data Datos del cliente a registrar.
 */
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

      // Valida que el ID WISP no esté duplicado
      const dupRef = doc(db, CLIENTES_COL, data.id_wisp);
      const dupSnap = await tx.get(dupRef);
      if (dupSnap.exists()) {
        return { success: false, error: `El ID WISP "${data.id_wisp}" ya existe.` };
      }

      // Valida la capacidad de puertos de la NAP
      if (napData.puertos_ocupados >= napData.capacidad_total) {
        return {
          success: false,
          error: `La NAP "${napData.nombre}" está llena (${napData.puertos_ocupados}/${napData.capacidad_total}).`,
        };
      }

      // Crea el documento de cliente usando su ID WISP como ID único
      const clienteData = {
        ...data,
        fecha_alta: new Date().toISOString().split("T")[0],
      };
      const clienteRef = doc(db, CLIENTES_COL, data.id_wisp);
      tx.set(clienteRef, clienteData);

      // Registra municipio/localidad en la colección geográfica
      const geoId = `${data.municipio}|${data.localidad}`;
      const geoRef = doc(db, GEO_COL, geoId);
      tx.set(geoRef, {
        municipio: data.municipio,
        localidad: data.localidad,
      });

      // Incrementa el contador de puertos ocupados
      const newOcupados = napData.puertos_ocupados + 1;
      tx.update(napRef, {
        puertos_ocupados: newOcupados,
      });

      return { success: true, clienteId: clienteRef.id, napData, newOcupados };
    });

    // Verifica si la NAP se llenó completamente tras el alta
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
      await touchNapsMetadata();
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar cliente.";
    return { success: false, error: message };
  }
}

// ── Eliminar cliente con decremento atómico ──

/**
 * Elimina a un cliente de Firestore y decrementa atómicamente la cantidad de puertos ocupados en la NAP correspondiente.
 * Envia un correo de notificación 'LIBERADA' si la NAP estaba llena antes de borrar.
 *
 * @param clienteId ID único del cliente.
 */
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

    const r = result as {
      success: boolean;
      napData?: Omit<NAP, "id"> | null;
      newOcupados?: number;
      idNap?: string | null;
      wasFull?: boolean;
    };

    if (r.success && r.wasFull && r.napData && r.idNap) {
      console.log(`[deleteCliente] NAP ${r.idNap} estaba llena — enviando correo LIBERADA`);
      await notifyNapEvent({
        tipoEvento: "LIBERADA",
        idNap: String(r.idNap),
        nombre: r.napData.nombre,
        municipio: r.napData.municipio,
        localidad: r.napData.localidad,
        ocupados: r.newOcupados ?? 0,
        capacidad: r.napData.capacidad_total,
      });
    }

    if (r.success && r.napData) {
      await touchNapsMetadata();
    }

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar cliente.";
    console.error("Error en deleteCliente:", err);
    return { success: false, error: message };
  }
}

// ── Geografía: filtros en cascada ──

/**
 * Obtiene la lista única de municipios registrados en la colección de configuración geográfica.
 */
export async function getMunicipios(): Promise<string[]> {
  const snap = await getDocs(collection(db, GEO_COL));
  const municipios = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data() as LocalidadEntry;
    municipios.add(data.municipio);
  });
  return Array.from(municipios).sort();
}

/**
 * Obtiene la lista única de localidades asociadas a un municipio específico.
 * @param municipio Nombre del municipio.
 */
export async function getLocalidadesByMunicipio(municipio: string): Promise<string[]> {
  const q = query(collection(db, GEO_COL), where("municipio", "==", municipio));
  const snap = await getDocs(q);
  const localidades = new Set<string>();
  snap.docs.forEach((d) => {
    localidades.add((d.data() as LocalidadEntry).localidad);
  });
  return Array.from(localidades).sort();
}

/**
 * Obtiene la lista de NAPs pertenecientes a una localidad específica.
 * @param localidad Nombre de la localidad.
 */
export async function getNAPsByLocalidad(localidad: string): Promise<NAP[]> {
  const q = query(collection(db, NAPS_COL), where("localidad", "==", localidad));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
}

// ── Semáforo de Ocupación ──

/** Estados posibles para el semáforo de disponibilidad de una NAP */
export type SemaforoState = "verde" | "amarillo" | "rojo" | "celeste";

/**
 * Determina el estado del semáforo de una NAP a partir de sus puertos ocupados y su capacidad total.
 * - `celeste`: Sobre-ocupación (puertos ocupados > capacidad total).
 * - `rojo`: Saturada / Lleno (puertos ocupados == capacidad total).
 * - `amarillo`: Alta ocupación (ocupación >= 70%).
 * - `verde`: Disponible (ocupación < 70%).
 */
export function getNAPColor(nap: NAP): SemaforoState {
  const o = nap.puertos_ocupados;
  const c = nap.capacidad_total;
  if (o > c) return "celeste";
  if (o === c) return "rojo";
  if (o >= c * 0.7) return "amarillo";
  return "verde";
}

// ── Usuarios de plataforma ──

/** Roles de acceso permitidos en el sistema */
export type Rol = "admin" | "sucursal" | "supervisor" | "infraestructura" | "instalador" | "administracion" | "soporte";

/**
 * Representa a un usuario registrado en la plataforma WebYun.
 */
export interface Usuario {
  /** ID único del documento en Firestore */
  id: string;
  /** UID de autenticación en Firebase Auth */
  uid: string;
  /** Correo electrónico */
  email: string;
  /** Nombre completo */
  nombre?: string;
  /** Fecha de registro */
  creado: string;
  /** Rol asignado */
  rol: Rol;
  /** Estado de inhabilitación */
  deshabilitado?: boolean;
}

/** Nombre de la colección de usuarios en Firestore */
const USUARIOS_COL = "usuarios";

/**
 * Obtiene la lista completa de usuarios registrados en la plataforma.
 */
export async function getUsuarios(): Promise<Usuario[]> {
  const snap = await getDocs(collection(db, USUARIOS_COL));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Usuario, "id">) }));
}

/**
 * Agrega un nuevo usuario a Firestore asignando el rol 'admin' si es el primer usuario o 'instalador' en caso contrario.
 */
export async function addUsuario(uid: string, email: string, nombre?: string): Promise<void> {
  const userRef = doc(db, USUARIOS_COL, uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const allUsersSnap = await getDocs(query(collection(db, USUARIOS_COL), limit(1)));
    const defaultRol: Rol = allUsersSnap.empty ? "admin" : "instalador";

    await setDoc(userRef, {
      uid,
      email,
      nombre: nombre || "",
      creado: new Date().toISOString().split("T")[0],
      rol: defaultRol,
    });
  } else if (nombre && !userSnap.data().nombre) {
    await updateDoc(userRef, { nombre });
  }
}

/**
 * Cambia el rol de un usuario en Firestore.
 */
export async function updateUsuarioRol(uid: string, nuevoRol: Rol): Promise<void> {
  await updateDoc(doc(db, USUARIOS_COL, uid), { rol: nuevoRol });
}

/**
 * Habilita o inhabilita el acceso de un usuario a la plataforma.
 */
export async function toggleUsuarioHabilitado(uid: string, deshabilitado: boolean): Promise<void> {
  await updateDoc(doc(db, USUARIOS_COL, uid), { deshabilitado });
}

/**
 * Modifica el nombre asignado a un usuario en Firestore.
 */
export async function updateUsuarioNombre(uid: string, nombre: string): Promise<void> {
  await updateDoc(doc(db, USUARIOS_COL, uid), { nombre });
}

// ── Optimizaciones (Suscripciones en tiempo real) ──

/**
 * Recupera de una sola vez la lista completa de NAPs (hasta 3000 registros).
 */
export async function fetchAllNAPs(): Promise<NAP[]> {
  const q = query(collection(db, NAPS_COL), orderBy("nombre"), limit(3000));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NAP, "id">) }));
}

/**
 * Escucha cambios en tiempo real en la marca de tiempo de actualización global de NAPs.
 */
export function subscribeToNapsMetadata(callback: (lastUpdated: number) => void) {
  const docRef = doc(db, "metadata", "naps");
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.lastUpdatedAt) {
          callback(data.lastUpdatedAt);
        }
      }
    },
    (error) => {
      console.warn("Error en la suscripción a la metadata de NAPs:", error);
    }
  );
}

/**
 * Suscribe un callback a cambios en vivo en la lista completa de NAPs.
 */
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

/**
 * Suscribe un callback a cambios en vivo en la lista de usuarios de la plataforma.
 */
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

/**
 * Audita y sincroniza los contadores de `puertos_ocupados` de todas las NAPs contrastándolos contra el conteo real de clientes vinculados.
 *
 * @returns Resumen con la cantidad de NAPs corregidas y NAPs que ya estaban correctas.
 */
export async function reconcileNAPs(): Promise<{ corregidas: number; correctas: number }> {
  const [napsSnap, clientesSnap] = await Promise.all([
    getDocs(collection(db, NAPS_COL)),
    getDocs(collection(db, CLIENTES_COL)),
  ]);

  // Conteo de clientes reales por NAP
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

