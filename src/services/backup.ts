import * as XLSX from "xlsx";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { touchNapsMetadata, reconcileNAPs } from "@/lib/firestore";
import { registrarLog } from "@/lib/audit";

/**
 * Mapeo de colecciones de la base de datos a nombres de hojas en Excel.
 */
export const BACKUP_COLLECTIONS: { id: string; sheetName: string }[] = [
  { id: "naps", sheetName: "NAPs" },
  { id: "clientes", sheetName: "Clientes" },
  { id: "usuarios", sheetName: "Usuarios" },
  { id: "config_geografica", sheetName: "ConfigGeografica" },
  { id: "audit_logs", sheetName: "AuditLogs" },
];

/**
 * Resultado devuelto por la exportación de la base de datos.
 */
export interface ExportResult {
  success: boolean;
  totalElementos: number;
  detalles: Record<string, number>;
  nombreArchivo: string;
  error?: string;
}

/**
 * Resultado devuelto por la importación/restauración de la base de datos.
 */
export interface ImportResult {
  success: boolean;
  totalRestaurados: number;
  porColeccion: Record<string, number>;
  errores: string[];
}

/**
 * Sanitiza una celda o valor individual antes de guardarlo en Excel.
 * Convierte objetos y arrays a cadenas de texto JSON formateadas limpiamente.
 * Convierte timestamps de Firestore a ISO string.
 */
function sanitizeCell(val: unknown): unknown {
  if (val === undefined || val === null) {
    return "";
  }
  if (typeof val === "object") {
    // Si es un Timestamp de Firestore
    if (val && typeof (val as { toDate?: () => Date }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().toISOString();
    }
    // Si es una fecha JS normal
    if (val instanceof Date) {
      return val.toISOString();
    }
    // Para objetos y arreglos complejos
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return val;
}

/**
 * Procesa un documento de Firestore y lo transforma en un objeto plano apto para Excel.
 */
function sanitizeDocument(docId: string, data: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { id: docId };
  for (const [key, value] of Object.entries(data)) {
    row[key] = sanitizeCell(value);
  }
  return row;
}

/**
 * Parsea el valor de una celda importada desde Excel.
 * Si es una cadena JSON que representa un objeto o array, la convierte de nuevo a estructura JS.
 */
function parseCell(val: unknown): unknown {
  if (val === undefined || val === null) return null;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return val;
      }
    }
  }
  return val;
}

/**
 * 1. Exportar Base de Datos a Excel (.xlsx)
 *
 * Consulta todas las colecciones del sistema y genera un libro de Excel (.xlsx)
 * donde CADA COLECCIÓN O TABLA SE ENCUENTRE EN SU PROPIA HOJA/PESTAÑA independiente.
 * Sanitiza objetos/arrays complejos para guardarlos como JSON y activa la descarga automática.
 */
export async function exportarBaseDatosExcel(
  usuarioEmail?: string,
  usuarioUid?: string
): Promise<ExportResult> {
  try {
    const wb = XLSX.utils.book_new();
    const detalles: Record<string, number> = {};
    let totalElementos = 0;

    for (const colInfo of BACKUP_COLLECTIONS) {
      const snap = await getDocs(collection(db, colInfo.id));
      const rows: Record<string, unknown>[] = [];

      snap.docs.forEach((docSnap) => {
        const rawData = docSnap.data();
        const cleanRow = sanitizeDocument(docSnap.id, rawData);
        rows.push(cleanRow);
      });

      detalles[colInfo.sheetName] = rows.length;
      totalElementos += rows.length;

      // Generar hoja para la colección actual
      const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ info: "Colección vacía" }]);
      XLSX.utils.book_append_sheet(wb, ws, colInfo.sheetName);
    }

    // Nombre de archivo con la fecha y hora actual
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const nombreArchivo = `backup_webyun_${dateStr}_${timeStr}.xlsx`;

    // Activar descarga automática del archivo .xlsx
    XLSX.writeFile(wb, nombreArchivo);

    // Registrar log de auditoría
    if (usuarioEmail && usuarioUid) {
      await registrarLog(
        "EXPORTAR_BACKUP",
        usuarioEmail,
        usuarioUid,
        `Exportó copia de seguridad completa a Excel (${totalElementos} registros)`
      );
    }

    return {
      success: true,
      totalElementos,
      detalles,
      nombreArchivo,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al exportar base de datos";
    console.error("Error en exportarBaseDatosExcel:", err);
    return {
      success: false,
      totalElementos: 0,
      detalles: {},
      nombreArchivo: "",
      error: errorMsg,
    };
  }
}

/**
 * Resuelve la colección de Firestore objetivo a partir del nombre de la hoja en Excel.
 */
function resolveCollectionName(sheetName: string): string {
  const norm = sheetName.trim().toLowerCase().replace(/[\s\-_]+/g, "");
  if (norm === "naps" || norm === "nap") return "naps";
  if (norm === "clientes" || norm === "cliente") return "clientes";
  if (norm === "usuarios" || norm === "usuario" || norm === "users") return "usuarios";
  if (norm === "configgeografica" || norm === "geografia" || norm === "localidades") return "config_geografica";
  if (norm === "auditlogs" || norm === "registros" || norm === "logs" || norm === "bitacora") return "audit_logs";
  
  // Fallback: usar nombre de hoja sanitizado
  return sheetName.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Determina el ID de documento para una fila a importar.
 */
function resolveDocumentId(colName: string, row: Record<string, unknown>): string | null {
  if (row.id && String(row.id).trim() !== "") {
    return String(row.id).trim();
  }

  if (colName === "naps" && row.id_nap) {
    return String(row.id_nap).trim();
  }

  if (colName === "clientes" && row.id_wisp) {
    return String(row.id_wisp).trim();
  }

  if (colName === "usuarios" && row.uid) {
    return String(row.uid).trim();
  }

  if (colName === "config_geografica" && row.municipio && row.localidad) {
    return `${String(row.municipio).trim()}|${String(row.localidad).trim()}`;
  }

  return null;
}

/**
 * 2. Importar / Restaurar Base de Datos desde Excel (.xlsx / .xls)
 *
 * Recibe el archivo de Excel subido por el usuario, lee cada hoja por su nombre,
 * convierte las filas de nuevo a objetos estructurados y realiza la restauración/actualización (upsert/merge)
 * de los documentos en la base de datos correspondiente.
 */
export async function importarBaseDatosExcel(
  arrayBuffer: ArrayBuffer,
  usuarioEmail?: string,
  usuarioUid?: string
): Promise<ImportResult> {
  const porColeccion: Record<string, number> = {};
  const errores: string[] = [];
  let totalRestaurados = 0;

  try {
    const wb = XLSX.read(arrayBuffer, { type: "array" });
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      return {
        success: false,
        totalRestaurados: 0,
        porColeccion: {},
        errores: ["El archivo de Excel no contiene hojas válidas."],
      };
    }

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;

      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      if (rawRows.length === 0) continue;

      const targetCol = resolveCollectionName(sheetName);
      let countForSheet = 0;

      for (let index = 0; index < rawRows.length; index++) {
        const rawRow = rawRows[index];

        // Ignorar filas de relleno o vacías
        if (rawRow.info === "Colección vacía") continue;

        try {
          const cleanDoc: Record<string, unknown> = {};
          
          for (const [key, value] of Object.entries(rawRow)) {
            if (key === "id") continue; // El ID lo manejamos por separado para la referencia del documento
            const parsedVal = parseCell(value);
            if (parsedVal !== undefined && parsedVal !== null && parsedVal !== "") {
              cleanDoc[key] = parsedVal;
            }
          }

          // Convertir tipos numéricos específicos si corresponden
          if (targetCol === "naps") {
            if (cleanDoc.capacidad_total !== undefined) cleanDoc.capacidad_total = Number(cleanDoc.capacidad_total) || 8;
            if (cleanDoc.puertos_ocupados !== undefined) cleanDoc.puertos_ocupados = Number(cleanDoc.puertos_ocupados) || 0;
            if (cleanDoc.verificacion !== undefined) cleanDoc.verificacion = Number(cleanDoc.verificacion) || 0;
            if (cleanDoc.latitud !== undefined && cleanDoc.latitud !== "") cleanDoc.latitud = Number(cleanDoc.latitud);
            if (cleanDoc.longitud !== undefined && cleanDoc.longitud !== "") cleanDoc.longitud = Number(cleanDoc.longitud);
          }

          const docId = resolveDocumentId(targetCol, rawRow);
          
          if (docId) {
            const docRef = doc(db, targetCol, docId);
            await setDoc(docRef, cleanDoc, { merge: true });
          } else {
            // Si no hay ID explícito, usar un ID aleatorio generado por Firestore
            const newDocRef = doc(collection(db, targetCol));
            await setDoc(newDocRef, cleanDoc, { merge: true });
          }

          countForSheet++;
          totalRestaurados++;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : "Error desconocido";
          errores.push(`Hoja "${sheetName}" (Fila ${index + 2}): ${errMsg}`);
        }
      }

      porColeccion[sheetName] = countForSheet;
    }

    // Tras la restauración, sincronizar contadores y notificar a la app
    try {
      await touchNapsMetadata();
      await reconcileNAPs();
    } catch (syncErr) {
      console.warn("Advertencia en post-procesamiento de importación:", syncErr);
    }

    // Registrar log de auditoría
    if (usuarioEmail && usuarioUid) {
      await registrarLog(
        "IMPORTAR_BACKUP",
        usuarioEmail,
        usuarioUid,
        `Restauró base de datos desde archivo Excel (${totalRestaurados} elementos procesados)`
      );
    }

    return {
      success: errores.length === 0 || totalRestaurados > 0,
      totalRestaurados,
      porColeccion,
      errores,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Error al procesar archivo Excel";
    console.error("Error en importarBaseDatosExcel:", err);
    return {
      success: false,
      totalRestaurados,
      porColeccion,
      errores: [...errores, `Fallo general: ${errMsg}`],
    };
  }
}
