import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Tipos de acciones registrables en la bitácora de auditoría del sistema WebYun.
 */
export type AccionLog =
  | "CREAR_NAP"
  | "EDITAR_NAP"
  | "ELIMINAR_NAP"
  | "VERIFICAR_NAP"
  | "CREAR_CLIENTE"
  | "ELIMINAR_CLIENTE"
  | "REASIGNAR_CLIENTE"
  | "EDITAR_CLIENTE"
  | "SINCRONIZAR_CONTADORES"
  | "LOGIN";

/**
 * Representa una entrada de la bitácora de auditoría en Firestore.
 */
export interface LogEntry {
  /** ID único del log */
  id: string;
  /** Categoría o tipo de acción realizada */
  accion: AccionLog;
  /** Correo electrónico del usuario que ejecutó la acción */
  usuarioEmail: string;
  /** UID de autenticación en Firebase del usuario */
  usuarioUid: string;
  /** Descripción textual legible de la acción */
  descripcion: string;
  /** Metadata o detalles técnicos adicionales asociados al evento */
  detalles?: Record<string, unknown>;
  /** Marca temporal en formato ISO string */
  timestamp: string;
}

/** Nombre de la colección de auditoría en Firestore */
const LOGS_COL = "audit_logs";

/**
 * Registra una nueva acción en la bitácora de auditoría de Firestore.
 * No interrumpe el flujo principal si ocurre algún fallo al guardar.
 *
 * @param accion Tipo de acción ejecutada.
 * @param usuarioEmail Email del usuario autenticado.
 * @param usuarioUid UID de Firebase Authentication.
 * @param descripcion Resumen inteligible de la operación.
 * @param detalles Datos objeto opcionales con el estado antes/después o IDs relevantes.
 */
export async function registrarLog(
  accion: AccionLog,
  usuarioEmail: string,
  usuarioUid: string,
  descripcion: string,
  detalles?: Record<string, unknown>
): Promise<void> {
  try {
    await addDoc(collection(db, LOGS_COL), {
      accion,
      usuarioEmail,
      usuarioUid,
      descripcion,
      detalles: detalles ?? null,
      timestamp: Timestamp.now(),
    });
  } catch (err) {
    // Los logs de auditoría no deben interrumpir el flujo del usuario
    console.warn("No se pudo guardar el log de auditoría:", err);
  }
}

/**
 * Suscribe un callback en tiempo real a las entradas de auditoría más recientes.
 *
 * @param callback Función receptora de la lista actualizada de logs.
 * @param maxEntries Límite de registros a recuperar (por defecto 200).
 * @returns Función de desuscripción para limpiar el listener.
 */
export function subscribeToLogs(
  callback: (logs: LogEntry[]) => void,
  maxEntries = 200
): () => void {
  const q = query(
    collection(db, LOGS_COL),
    orderBy("timestamp", "desc"),
    limit(maxEntries)
  );

  return onSnapshot(q, (snap) => {
    const logs: LogEntry[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        accion: data.accion as AccionLog,
        usuarioEmail: data.usuarioEmail ?? "–",
        usuarioUid: data.usuarioUid ?? "",
        descripcion: data.descripcion ?? "",
        detalles: data.detalles ?? undefined,
        timestamp:
          data.timestamp instanceof Timestamp
            ? data.timestamp.toDate().toISOString()
            : String(data.timestamp),
      };
    });
    callback(logs);
  });
}


