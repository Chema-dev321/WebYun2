"use client";

import { useState, useRef, ChangeEvent } from "react";
import type { Usuario } from "@/lib/firestore";
import { useAuth } from "@/lib/AuthContext";
import { useToast, useConfirm } from "./ToastContext";
import {
  exportarBaseDatosExcel,
  importarBaseDatosExcel,
  ExportResult,
  ImportResult,
} from "@/services/backup";

interface AjustesTabProps {
  usuarios?: Usuario[];
  onRefreshNaps?: () => void;
}

export default function AjustesTab({ onRefreshNaps }: AjustesTabProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Maneja la exportación completa de la base de datos a Excel.
   */
  const handleExportar = async () => {
    setExporting(true);
    setExportResult(null);
    setErrorMessage(null);

    try {
      const result = await exportarBaseDatosExcel(user?.email ?? undefined, user?.uid ?? undefined);
      
      if (result.success) {
        setExportResult(result);
        showToast(`Respaldo descargado con éxito (${result.totalElementos} registros)`, "success");
      } else {
        setErrorMessage(result.error || "Fallo al exportar base de datos.");
        showToast("Error al exportar la base de datos", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error durante la exportación";
      setErrorMessage(msg);
      showToast("Error inesperado en exportación", "error");
    } finally {
      setExporting(false);
    }
  };

  /**
   * Maneja la selección de archivo e importación a la base de datos.
   */
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resetear valor para permitir seleccionar el mismo archivo si es necesario
    e.target.value = "";

    const ok = await confirm(
      `¿Deseas restaurar la base de datos desde el archivo "${file.name}"?\n\nEsta operación actualizará los documentos existentes e insertará las nuevas filas en sus respectivas colecciones.`
    );
    if (!ok) return;

    setImporting(true);
    setImportResult(null);
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await importarBaseDatosExcel(
        arrayBuffer,
        user?.email ?? undefined,
        user?.uid ?? undefined
      );

      setImportResult(result);

      if (result.success) {
        showToast(
          `Restauración completada: ${result.totalRestaurados} elementos procesados`,
          "success"
        );
        if (onRefreshNaps) {
          onRefreshNaps();
        }
      } else {
        setErrorMessage(
          result.errores.length > 0
            ? result.errores.join(" | ")
            : "No se pudieron restaurar los datos."
        );
        showToast("Error en la importación de datos", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar archivo de Excel";
      setErrorMessage(msg);
      showToast("Error inesperado al importar archivo", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Sección 1: Copia de Seguridad y Restauración (Excel) */}
      <div className="rounded-2xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--hulux-border) pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--hulux-blue)] to-[var(--hulux-cyan)] flex items-center justify-center text-white text-2xl shadow">
              💾
            </div>
            <div>
              <h2 className="text-xl font-bold text-(--hulux-text)">
                Copia de Seguridad y Restauración (Excel)
              </h2>
              <p className="text-xs text-(--hulux-text-muted)">
                Exporta e importa la base de datos completa en formato `.xlsx` con hojas independientes por tabla.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones principales: Exportar / Importar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Tarjeta de Exportación */}
          <div className="p-5 rounded-xl border border-(--hulux-border) bg-(--hulux-bg)/50 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📥</span>
                <h3 className="font-semibold text-sm text-(--hulux-text)">Exportar Base de Datos</h3>
              </div>
              <p className="text-xs text-(--hulux-text-muted) leading-relaxed">
                Descarga un libro de Excel (.xlsx) conteniendo todas las NAPs, Clientes, Usuarios, Configuración Geográfica y Registros de Auditoría en pestañas independientes.
              </p>
            </div>

            <button
              onClick={handleExportar}
              disabled={exporting || importing}
              className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--hulux-blue)] to-[var(--hulux-cyan)] text-white hover:brightness-110 shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exportando a Excel...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Exportar a Excel (.xlsx)
                </>
              )}
            </button>
          </div>

          {/* Tarjeta de Importación */}
          <div className="p-5 rounded-xl border border-(--hulux-border) bg-(--hulux-bg)/50 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📤</span>
                <h3 className="font-semibold text-sm text-(--hulux-text)">Restaurar Base de Datos</h3>
              </div>
              <p className="text-xs text-(--hulux-text-muted) leading-relaxed">
                Selecciona un archivo de Excel (.xlsx o .xls) respaldado previamente para actualizar o restaurar los datos del sistema en sus correspondientes colecciones.
              </p>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={exporting || importing}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] text-(--hulux-text) border border-(--hulux-border) shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-(--hulux-cyan)" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Restaurando datos...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-(--hulux-cyan)" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importar Excel (.xlsx / .xls)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Banner de Carga/Procesamiento */}
        {(exporting || importing) && (
          <div className="p-4 rounded-xl bg-[rgba(148,237,242,0.12)] border border-[rgba(148,237,242,0.3)] text-(--hulux-text) text-xs flex items-center gap-3 animate-pulse">
            <svg className="animate-spin h-5 w-5 text-(--hulux-cyan) shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <div>
              <p className="font-bold text-sm">
                {exporting ? "Procesando exportación de base de datos..." : "Procesando importación y restauración..."}
              </p>
              <p className="text-(--hulux-text-muted)">
                Por favor, no cierres ni recargues esta ventana mientras se completa la operación.
              </p>
            </div>
          </div>
        )}

        {/* Banner de Error */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-[rgba(112,0,63,0.12)] border border-[rgba(112,0,63,0.3)] text-(--hulux-maroon-light) text-xs space-y-1 mt-4">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span>⚠️ Error durante la operación</span>
            </div>
            <p className="break-words">{errorMessage}</p>
          </div>
        )}

        {/* Resultado de Exportación */}
        {exportResult && exportResult.success && (
          <div className="p-4 rounded-xl bg-[rgba(205,219,0,0.12)] border border-[rgba(205,219,0,0.3)] text-(--hulux-text) text-xs space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="text-base">✅</span>
                <span>Exportación Exitosa: {exportResult.nombreArchivo}</span>
              </div>
              <span className="font-mono bg-[rgba(205,219,0,0.25)] px-2 py-0.5 rounded text-xs">
                {exportResult.totalElementos} registros exportados
              </span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 border-t border-[rgba(205,219,0,0.2)]">
              {Object.entries(exportResult.detalles).map(([tabla, cant]) => (
                <div key={tabla} className="bg-(--hulux-surface) p-2 rounded-lg border border-(--hulux-border) text-center">
                  <p className="text-[10px] text-(--hulux-text-muted) uppercase tracking-wider">{tabla}</p>
                  <p className="font-bold text-sm text-(--hulux-text)">{cant}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado de Importación / Restauración */}
        {importResult && (
          <div className="p-4 rounded-xl bg-[rgba(205,219,0,0.12)] border border-[rgba(205,219,0,0.3)] text-(--hulux-text) text-xs space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="text-base">🎉</span>
                <span>Restauración Completada Exitosamente</span>
              </div>
              <span className="font-mono bg-[rgba(205,219,0,0.25)] px-2.5 py-1 rounded-full text-xs font-bold">
                {importResult.totalRestaurados} elementos restaurados
              </span>
            </div>

            {/* Desglose por colección */}
            {Object.keys(importResult.porColeccion).length > 0 && (
              <div>
                <p className="font-semibold text-xs mb-1.5 text-(--hulux-text-muted)">
                  Desglose de elementos restaurados por hoja/colección:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(importResult.porColeccion).map(([sheet, cant]) => (
                    <div key={sheet} className="bg-(--hulux-surface) p-2.5 rounded-lg border border-(--hulux-border) text-center">
                      <p className="text-[10px] text-(--hulux-text-muted) uppercase tracking-wider">{sheet}</p>
                      <p className="font-bold text-base text-(--hulux-text)">{cant}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de advertencias/errores en la importación */}
            {importResult.errores.length > 0 && (
              <div className="pt-2 border-t border-[rgba(205,219,0,0.2)]">
                <p className="font-bold text-xs text-(--hulux-maroon-light) mb-1">
                  Advertencias durante el procesamiento ({importResult.errores.length}):
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-(--hulux-text-muted) max-h-32 overflow-y-auto">
                  {importResult.errores.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
