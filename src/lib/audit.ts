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

export interface LogEntry {
  id: string;
  accion: AccionLog;
  usuarioEmail: string;
  usuarioUid: string;
  descripcion: string;
  detalles?: Record<string, unknown>;
  timestamp: string; // ISO string
}

const LOGS_COL = "audit_logs";

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
    // Audit logs should never break the main flow
    console.warn("No se pudo guardar el log de auditoría:", err);
  }
}

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

