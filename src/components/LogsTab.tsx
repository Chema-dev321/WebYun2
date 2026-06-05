"use client";

import { useEffect, useState, useMemo, useCallback, Fragment } from "react";
import type { LogEntry, AccionLog } from "@/lib/audit";
import { subscribeToLogs } from "@/lib/audit";

const ACCION_LABELS: Record<AccionLog, string> = {
  CREAR_NAP: "Crear NAP",
  EDITAR_NAP: "Editar NAP",
  ELIMINAR_NAP: "Eliminar NAP",
  CREAR_CLIENTE: "Nuevo Cliente",
  ELIMINAR_CLIENTE: "Eliminar Cliente",
  REASIGNAR_CLIENTE: "Reasignar Cliente",
  EDITAR_CLIENTE: "Editar Cliente",
  SINCRONIZAR_CONTADORES: "Sincronizar",
  LOGIN: "Inicio sesión",
};

const ACCION_COLORS: Record<AccionLog, string> = {
  CREAR_NAP: "bg-[rgba(205,219,0,0.18)] text-[var(--hulux-lime)] border border-[rgba(205,219,0,0.35)]",
  EDITAR_NAP: "bg-[rgba(148,237,242,0.18)] text-[var(--hulux-cyan)] border border-[rgba(148,237,242,0.35)]",
  ELIMINAR_NAP: "bg-[rgba(112,0,63,0.12)] text-[var(--hulux-maroon)] border border-[rgba(112,0,63,0.25)]",
  CREAR_CLIENTE: "bg-[rgba(205,219,0,0.18)] text-[var(--hulux-lime)] border border-[rgba(205,219,0,0.35)]",
  ELIMINAR_CLIENTE: "bg-[rgba(112,0,63,0.12)] text-[var(--hulux-maroon)] border border-[rgba(112,0,63,0.25)]",
  REASIGNAR_CLIENTE: "bg-[rgba(255,165,0,0.15)] text-[var(--hulux-orange)] border border-[rgba(255,165,0,0.3)]",
  EDITAR_CLIENTE: "bg-[rgba(148,237,242,0.18)] text-[var(--hulux-cyan)] border border-[rgba(148,237,242,0.35)]",
  SINCRONIZAR_CONTADORES: "bg-[rgba(148,237,242,0.10)] text-[var(--hulux-text-muted)] border border-[var(--hulux-border)]",
  LOGIN: "bg-[rgba(17,41,62,0.08)] text-[var(--hulux-text-muted)] border border-[var(--hulux-border)]",
};

const ACCION_ICONS: Record<AccionLog, string> = {
  CREAR_NAP: "🔌",
  EDITAR_NAP: "✏️",
  ELIMINAR_NAP: "🗑️",
  CREAR_CLIENTE: "➕",
  ELIMINAR_CLIENTE: "❌",
  REASIGNAR_CLIENTE: "🔄",
  EDITAR_CLIENTE: "📝",
  SINCRONIZAR_CONTADORES: "🔃",
  LOGIN: "🔐",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "hace unos segundos";
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs} h`;
    const days = Math.floor(hrs / 24);
    return `hace ${days} día${days !== 1 ? "s" : ""}`;
  } catch {
    return "";
  }
}

export default function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroAccion, setFiltroAccion] = useState<AccionLog | "">("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 30;

  useEffect(() => {
    const unsub = subscribeToLogs((data) => {
      setLogs(data);
      setLoading(false);
    }, 500);
    return () => unsub();
  }, []);

  // Unique users from logs
  const usuarios = useMemo(() => {
    const set = new Set(logs.map((l) => l.usuarioEmail));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (filtroAccion) result = result.filter((l) => l.accion === filtroAccion);
    if (filtroUsuario) result = result.filter((l) => l.usuarioEmail === filtroUsuario);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.descripcion.toLowerCase().includes(q) ||
          l.usuarioEmail.toLowerCase().includes(q) ||
          l.accion.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filtroAccion, filtroUsuario, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const clearFilters = useCallback(() => {
    setFiltroAccion("");
    setFiltroUsuario("");
    setSearch("");
    setPage(0);
  }, []);

  const hasFilters = filtroAccion || filtroUsuario || search.trim();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--hulux-text)]">Registro de Actividad</h2>
          <p className="text-xs text-[var(--hulux-text-muted)] mt-0.5">
            Historial completo de cambios realizados por los administradores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[rgba(148,237,242,0.15)] text-[var(--hulux-cyan)] border border-[rgba(148,237,242,0.3)]">
            {filtered.length} registros
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-xl p-4 shadow-[var(--hulux-shadow)]">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <label className="block text-xs text-[var(--hulux-text-muted)] mb-1">Buscar</label>
            <svg
              className="absolute left-3 top-[34px] -translate-y-1/2 h-4 w-4 text-[var(--hulux-text-muted)]"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Buscar en descripción, usuario..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--hulux-surface-elevated)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] placeholder-[var(--hulux-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
            />
          </div>

          {/* Accion filter */}
          <div>
            <label className="block text-xs text-[var(--hulux-text-muted)] mb-1">Tipo de acción</label>
            <select
              value={filtroAccion}
              onChange={(e) => { setFiltroAccion(e.target.value as AccionLog | ""); setPage(0); }}
              className="px-3 py-2 bg-[var(--hulux-surface-elevated)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
            >
              <option value="">Todas las acciones</option>
              {(Object.keys(ACCION_LABELS) as AccionLog[]).map((a) => (
                <option key={a} value={a}>{ACCION_LABELS[a]}</option>
              ))}
            </select>
          </div>

          {/* User filter */}
          <div>
            <label className="block text-xs text-[var(--hulux-text-muted)] mb-1">Usuario</label>
            <select
              value={filtroUsuario}
              onChange={(e) => { setFiltroUsuario(e.target.value); setPage(0); }}
              className="px-3 py-2 bg-[var(--hulux-surface-elevated)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-[var(--hulux-maroon)] hover:underline whitespace-nowrap"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-[var(--hulux-text-muted)]">
          <svg className="animate-spin h-6 w-6 mx-auto mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Cargando logs...
        </div>
      ) : paged.length === 0 ? (
        <div className="text-center py-16 text-[var(--hulux-text-muted)]">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">{hasFilters ? "Sin resultados con esos filtros." : "Aún no hay registros de actividad."}</p>
          <p className="text-xs mt-1">Las acciones aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--hulux-border)] bg-[var(--hulux-surface)] shadow-[var(--hulux-shadow)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--hulux-subtle)] text-[var(--hulux-text)] text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Fecha y hora</th>
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Acción</th>
                  <th className="p-3">Descripción</th>
                  <th className="p-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="border-t border-[var(--hulux-border)] hover:bg-[rgba(148,237,242,0.07)] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      {/* Icon */}
                      <td className="p-3 text-center text-base">
                        {ACCION_ICONS[log.accion]}
                      </td>

                      {/* Date */}
                      <td className="p-3">
                        <div className="font-mono text-xs text-[var(--hulux-text)]">
                          {formatDate(log.timestamp)}
                        </div>
                        <div className="text-[10px] text-[var(--hulux-text-muted)] mt-0.5">
                          {timeAgo(log.timestamp)}
                        </div>
                      </td>

                      {/* User */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[var(--hulux-blue)] dark:bg-[var(--hulux-cyan)] flex items-center justify-center text-[10px] font-bold text-white dark:text-[var(--hulux-blue)] shrink-0">
                            {log.usuarioEmail.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-[var(--hulux-text)] truncate max-w-[140px]">
                            {log.usuarioEmail}
                          </span>
                        </div>
                      </td>

                      {/* Action badge */}
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${ACCION_COLORS[log.accion]}`}>
                          {ACCION_LABELS[log.accion]}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="p-3 text-xs text-[var(--hulux-text)] max-w-xs">
                        <span className="line-clamp-2">{log.descripcion}</span>
                      </td>

                      {/* Expand toggle */}
                      <td className="p-3 text-center">
                        {log.detalles && (
                          <svg
                            className={`h-4 w-4 text-[var(--hulux-text-muted)] transition-transform mx-auto ${expandedId === log.id ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </td>
                    </tr>

                    {/* Expanded details */}
                    {expandedId === log.id && log.detalles && (
                      <tr key={`${log.id}-details`} className="border-t border-[var(--hulux-border)] bg-[rgba(148,237,242,0.04)]">
                        <td colSpan={6} className="px-6 py-4">
                          <div className="bg-[var(--hulux-surface-elevated)] rounded-lg p-3 border border-[var(--hulux-border)]">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--hulux-text-muted)] mb-2">
                              Detalles del cambio
                            </p>
                            <pre className="text-xs text-[var(--hulux-text)] overflow-x-auto whitespace-pre-wrap break-words font-mono">
                              {JSON.stringify(log.detalles, null, 2)}
                            </pre>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs bg-[var(--hulux-surface)] hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-[var(--hulux-text)] border border-[var(--hulux-border)] transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-[var(--hulux-text-muted)]">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs bg-[var(--hulux-surface)] hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-[var(--hulux-text)] border border-[var(--hulux-border)] transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
