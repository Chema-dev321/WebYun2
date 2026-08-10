"use client";

import { useEffect, useState, useMemo } from "react";
import type { NAP, Cliente } from "@/lib/types";
import { getClientes } from "@/lib/firestore";

/**
 * Propiedades del componente {@link ClientesTab}.
 */
interface ClientesTabProps {
  /** Lista de NAPs en memoria para derivar los selectores de filtro */
  naps: NAP[];
  /** Rol de usuario activo en el sistema */
  userRole?: string;
}

/**
 * Componente `ClientesTab`.
 *
 * Muestra el directorio general paginado desde el servidor de todos los clientes registrados.
 * Permite filtrar por Municipio, Localidad e ID de NAP, con navegación por cursores de Firestore.
 */
export default function ClientesTab({ naps, userRole = "instalador" }: ClientesTabProps) {
  /** Lista de clientes en la página activa */
  const [clientes, setClientes] = useState<Cliente[]>([]);
  /** Estado de carga mientras se consulta la base de datos */
  const [loadingClientes, setLoadingClientes] = useState(true);
  
  // ── Filtros de consulta ──
  /** Municipio seleccionado en el filtro */
  const [municipio, setMunicipio] = useState("");
  /** Localidad seleccionada en el filtro */
  const [localidad, setLocalidad] = useState("");
  /** ID de NAP filtrado */
  const [idNapFilter, setIdNapFilter] = useState("");

  // ── Paginación basada en cursores de Firestore ──
  /** Cantidad de clientes solicitados por página */
  const pageSize = 25;
  /** Historial de documentos de cursor para habilitar retroceso entre páginas */
  const [history, setHistory] = useState<any[]>([null]);
  /** Índice de la página actual */
  const [pageIndex, setPageIndex] = useState(0);
  /** Indica si existen más páginas después de la actual */
  const [hasMore, setHasMore] = useState(false);

  /** Lista memorizada de municipios derivados de las NAPs */
  const municipios = useMemo(() => {
    const set = new Set(naps.filter(n => n.municipio).map((n) => n.municipio!));
    return Array.from(set).sort();
  }, [naps]);

  /** Lista memorizada de localidades para el municipio seleccionado */
  const localidades = useMemo(() => {
    if (!municipio) return [];
    const set = new Set(
      naps.filter((n) => n.municipio === municipio && n.localidad).map((n) => n.localidad!)
    );
    return Array.from(set).sort();
  }, [naps, municipio]);

  /** NAPs disponibles acordes a los filtros activos */
  const napsDisponibles = useMemo(() => {
    let list = naps;
    if (municipio) list = list.filter((n) => n.municipio === municipio);
    if (localidad) list = list.filter((n) => n.localidad === localidad);
    const set = new Set(list.map((n) => n.id_nap));
    return Array.from(set).sort();
  }, [naps, municipio, localidad]);

  // Efecto: Carga la página actual de clientes desde Firestore cuando cambia el índice o los filtros
  useEffect(() => {
    let mounted = true;
    setLoadingClientes(true);
    
    const lastVisible = history[pageIndex];

    getClientes(pageSize, lastVisible, municipio, localidad, idNapFilter)
      .then((res) => {
        if (!mounted) return;
        setClientes(res.data);
        setHasMore(res.hasMore);
        
        // Guarda el cursor de la próxima página si existen más registros
        if (res.hasMore && pageIndex === history.length - 1) {
          setHistory((prev) => [...prev, res.lastVisible]);
        }
        setLoadingClientes(false);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setLoadingClientes(false);
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, municipio, localidad, idNapFilter]);

  /**
   * Restablece los cursores y la página a 0 cuando el usuario modifica los filtros.
   */
  const handleFilterChange = (type: "municipio" | "localidad" | "idNap", val: string) => {
    if (type === "municipio") {
      setMunicipio(val);
      setLocalidad("");
      setIdNapFilter("");
    } else if (type === "localidad") {
      setLocalidad(val);
      setIdNapFilter("");
    } else {
      setIdNapFilter(val);
    }
    setHistory([null]);
    setPageIndex(0);
  };

  /**
   * Limpia todos los filtros y reinicia la paginación al estado inicial.
   */
  const clearFilters = () => {
    setMunicipio("");
    setLocalidad("");
    setIdNapFilter("");
    setHistory([null]);
    setPageIndex(0);
  };

  return (
    <div className="space-y-4">
      {/* ── Barra de Filtros (Desplegable en móviles) ── */}
      <details className="group rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) [&:not([open])_.content]:hidden sm:[&:not([open])_.content]:block" open>
        <summary className="p-4 text-[13px] font-semibold text-(--hulux-text) cursor-pointer sm:hidden flex items-center justify-between list-none">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
          </div>
          <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        
        <div className="content p-4 pt-0 sm:pt-4 flex flex-wrap items-end gap-3 border-t border-(--hulux-border) sm:border-0">
          {/* Select Municipio */}
          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Municipio</label>
            <select
              value={municipio}
              onChange={(e) => handleFilterChange("municipio", e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todos</option>
              {municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Select Localidad */}
          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Localidad</label>
            <select
              value={localidad}
              onChange={(e) => handleFilterChange("localidad", e.target.value)}
              disabled={!municipio}
              className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todas</option>
              {localidades.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Select ID NAP */}
          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">ID NAP</label>
            <select
              value={idNapFilter}
              onChange={(e) => handleFilterChange("idNap", e.target.value)}
              className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todas</option>
              {napsDisponibles.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          {/* Botones de acción de filtros */}
          <div className="flex-1 min-w-[140px] sm:flex-none ml-auto text-right flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {(municipio || localidad || idNapFilter) && (
                <button
                  onClick={clearFilters}
                  className="text-xs px-3 py-1.5 bg-(--hulux-maroon-light) hover:brightness-95 text-white font-medium rounded-lg transition-colors"
                >
                  Limpiar filtros
                </button>
              )}
              {/* CSV_EXPORT_DISABLED
              <button
                onClick={async () => {
                  try {
                    const { getAllClientesForExport } = await import("@/lib/firestore");
                    const allClientes = await getAllClientesForExport(
                      municipio || undefined,
                      localidad || undefined,
                      idNapFilter || undefined
                    );
                    
                    if (allClientes.length === 0) return;
                    
                    const headers = ["ID WISP", "Nombre", "ID NAP", "Localidad", "Municipio", "Fecha Alta"];
                    const rows = allClientes.map(c => [
                      c.id_wisp,
                      c.nombre,
                      c.id_nap,
                      c.localidad,
                      c.municipio,
                      c.fecha_alta
                    ]);
                    
                    const csvContent = [
                      headers.join(","),
                      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
                    ].join("\n");
                    
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.setAttribute("download", `clientes_webyun_${new Date().toISOString().split("T")[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } catch (e) {
                    console.error("Error al exportar CSV:", e);
                    alert("Ocurrió un error al generar el archivo CSV.");
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.1)] border border-(--hulux-border) rounded-lg text-(--hulux-text) transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-(--hulux-cyan)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Descargar CSV
              </button>
              CSV_EXPORT_DISABLED */}
            </div>
            <span className="text-xs text-(--hulux-text-muted) block mb-1">Nota: Utiliza &quot;Buscar Cliente&quot; para buscar por nombre</span>
          </div>
        </div>
      </details>

      {/* Renderizado de la tabla o indicador de carga */}
      {loadingClientes ? (
        <div className="text-center py-12 text-(--hulux-text-muted)">Cargando página de clientes...</div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-12 text-(--hulux-text-muted)">
          No hay clientes registrados en este filtro.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow)">
          <table className="w-full text-left text-sm table-zebra">
            <thead className="bg-(--hulux-subtle) text-(--hulux-text) text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">ID WISP</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Municipio</th>
                <th className="p-3">NAP</th>
                <th className="p-3">Localidad</th>
                <th className="p-3">Fecha Alta</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const nap = naps.find((n) => n.id === c.id_nap);
                return (
                  <tr
                    key={c.id}
                    className="border-t border-(--hulux-border) hover:bg-[rgba(148,237,242,0.12)] transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-(--hulux-text) font-bold">{c.id_wisp}</td>
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3 text-(--hulux-text)">{c.municipio}</td>
                    <td className="p-3 text-(--hulux-text-muted) text-xs">
                      {nap ? nap.id_nap : c.id_nap}
                    </td>
                    <td className="p-3 text-(--hulux-text)">{c.localidad}</td>
                    <td className="p-3 text-(--hulux-text-muted) text-xs">{c.fecha_alta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>

          {/* Navegación por Paginación */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
              className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs text-(--hulux-text-muted)">
              Página {pageIndex + 1}
            </span>
            <button
              onClick={() => setPageIndex((p) => p + 1)}
              disabled={!hasMore}
              className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </div>
  );
}

