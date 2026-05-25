"use client";

import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import type { NAP } from "@/lib/types";
import { deleteCliente, getNAPColor, updateNAP, deleteNAP } from "@/lib/firestore";

interface Props {
  naps: NAP[];
  onRefresh: () => void;
  onFilterChange?: (filtered: NAP[]) => void;
}

type SemaforoFilter = "verde" | "amarillo" | "rojo" | "morado";

function getSemaforo(nap: NAP): SemaforoFilter {
  const o = nap.puertos_ocupados;
  const c = nap.capacidad_total;
  if (o > c) return "morado";
  if (o === c) return "rojo";
  if (o >= c * 0.7) return "amarillo";
  return "verde";
}

const SEMAFORO_COLORS: Record<SemaforoFilter, string> = {
  verde: "bg-(--hulux-lime)",
  amarillo: "bg-(--hulux-orange)",
  rojo: "bg-(--hulux-maroon)",
  // Use cyan but ensure it's visible on white by giving it a subtle outline.
  morado: "bg-(--hulux-cyan) ring-1 ring-[rgba(17,41,62,0.28)]",
};

const SEMAFORO_LABELS: Record<SemaforoFilter, string> = {
  verde: "Verde (disponible)",
  amarillo: "Amarillo (≥70%)",
  rojo: "Rojo (lleno)",
  morado: "Morado (error)",
};

export default function NAPTable({ naps, onRefresh, onFilterChange }: Props) {
  // ── Filters ──
  const [search, setSearch] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [activosSemaforo, setActivosSemaforo] = useState<Set<SemaforoFilter>>(new Set());
  const [disponibilidad, setDisponibilidad] = useState<"todas" | "espacio" | "llenas">("todas");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<NAP>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Expand
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedClientes, setExpandedClientes] = useState<import("@/lib/types").Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // Derived lists
  const municipios = useMemo(() => {
    const set = new Set(naps.map((n) => n.municipio));
    return Array.from(set).sort();
  }, [naps]);

  const localidades = useMemo(() => {
    if (!municipio) return [];
    const set = new Set(
      naps.filter((n) => n.municipio === municipio).map((n) => n.localidad)
    );
    return Array.from(set).sort();
  }, [naps, municipio]);

  // Reset localidad when municipio changes
  useEffect(() => {
    setLocalidad("");
  }, [municipio]);

  // Reset page on filter change
  useEffect(() => {
    setPage(0);
  }, [search, municipio, localidad, activosSemaforo, disponibilidad]);

  // Toggle semaforo filter
  const toggleSemaforo = (s: SemaforoFilter) => {
    setActivosSemaforo((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // ── Filtered NAPs ──
  const filteredNaps = useMemo(() => {
    return naps.filter((nap) => {
      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          nap.id_nap.toLowerCase().includes(q) ||
          nap.municipio.toLowerCase().includes(q) ||
          nap.localidad.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Municipio
      if (municipio && nap.municipio !== municipio) return false;

      // Localidad
      if (localidad && nap.localidad !== localidad) return false;

      // Semaforo
      if (activosSemaforo.size > 0) {
        if (!activosSemaforo.has(getSemaforo(nap))) return false;
      }

      // Disponibilidad
      if (disponibilidad === "espacio") {
        if (nap.puertos_ocupados >= nap.capacidad_total) return false;
      }
      if (disponibilidad === "llenas") {
        if (nap.puertos_ocupados < nap.capacidad_total) return false;
      }

      return true;
    });
  }, [naps, search, municipio, localidad, activosSemaforo, disponibilidad]);

  // Report filtered NAPs to parent for dashboard stats
  useEffect(() => {
    onFilterChange?.(filteredNaps);
  }, [filteredNaps, onFilterChange]);

  const handleDelete = async (clienteId: string, napId: string) => {
    const ok = confirm("¿Eliminar este cliente? Se liberará el puerto en la NAP.");
    if (!ok) return;
    try {
      const result = await deleteCliente(clienteId);
      if (!result.success) {
        alert(result.error || "Error al eliminar cliente.");
      } else {
        // Actualizamos el estado local para que el cambio sea instantáneo
        setExpandedClientes((prev) => prev.filter((c) => c.id !== clienteId));
      }
    } catch (e: any) {
      alert("Excepción: " + e.message);
    }
    onRefresh();
  };

  const toggleExpand = async (napId: string) => {
    if (expandedId === napId) {
      setExpandedId(null);
      setExpandedClientes([]);
    } else {
      setExpandedId(napId);
      setLoadingClientes(true);
      try {
        const { getClientesByNAP } = await import("@/lib/firestore");
        const data = await getClientesByNAP(napId);
        setExpandedClientes(data);
      } catch (err) {
        console.error("Error cargando clientes de NAP", err);
      }
      setLoadingClientes(false);
    }
  };

  const startEdit = (nap: NAP) => {
    setEditingId(nap.id);
    setEditFields({
      nombre: nap.nombre,
      municipio: nap.municipio,
      localidad: nap.localidad,
      capacidad_total: nap.capacidad_total,
      estado_tomodat: nap.estado_tomodat,
      verificacion: nap.verificacion,
      latitud: nap.latitud,
      longitud: nap.longitud,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      await updateNAP(editingId, editFields);
      cancelEdit();
      onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar.";
      console.error("Error al editar NAP:", message);
      alert(message);
    }
    setSaving(false);
  };

  const handleDeleteNAP = async (napId: string) => {
    const ok = confirm("¿Eliminar esta NAP y todos sus clientes? Esta acción no se puede deshacer.");
    if (!ok) return;
    setDeleting(napId);
    try {
      const result = await deleteNAP(napId);
      if (result.success) {
        onRefresh();
      } else {
        alert(result.error || "Error al eliminar NAP.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar NAP.";
      console.error("Error al eliminar NAP:", message);
      alert(message);
    }
    setDeleting(null);
  };

  // ── Pagination ──
  const totalPages = Math.ceil(filteredNaps.length / pageSize);
  const pagedNaps = filteredNaps.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      {/* ── Filter bar ── */}
      <div className="rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) p-4 space-y-3">
        {/* Row 1: Search + Municipio + Localidad + Disponibilidad */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Buscar</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--hulux-text-muted)"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por ID, municipio o localidad..."
                className="w-full pl-10 pr-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Municipio</label>
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className="px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todos</option>
              {municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Localidad</label>
            <select
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              disabled={!municipio}
              className="px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todas</option>
              {localidades.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-1">
            {(["todas", "espacio", "llenas"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDisponibilidad(d)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  disponibilidad === d
                    ? "bg-(--hulux-blue) text-white dark:bg-(--hulux-cyan) dark:text-(--hulux-blue)"
                    : "bg-(--hulux-surface-elevated) text-(--hulux-text-muted) hover:text-(--hulux-text) border border-(--hulux-border) hover:bg-[rgba(148,237,242,0.18)]"
                }`}
              >
                {d === "todas" ? "Todas" : d === "espacio" ? "Con espacio" : "Llenas"}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Semaforo chips */}
        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1.5">Semáforo</label>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SEMAFORO_LABELS) as SemaforoFilter[]).map((s) => {
              const active = activosSemaforo.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSemaforo(s)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    active
                      ? "bg-(--hulux-blue) text-white dark:bg-(--hulux-cyan) dark:text-(--hulux-blue)"
                      : "bg-(--hulux-surface-elevated) text-(--hulux-text-muted) hover:text-(--hulux-text) border border-(--hulux-border) hover:bg-[rgba(148,237,242,0.18)]"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${SEMAFORO_COLORS[s]}`} />
                  {SEMAFORO_LABELS[s]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-xs text-(--hulux-text-muted)">
          <span>
            Mostrando {filteredNaps.length} de {naps.length} NAPs
          </span>
          {(search || municipio || activosSemaforo.size > 0 || disponibilidad !== "todas") && (
            <button
              onClick={() => {
                setSearch("");
                setMunicipio("");
                setLocalidad("");
                setActivosSemaforo(new Set());
                setDisponibilidad("todas");
              }}
              className="text-(--hulux-maroon-light) hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {pagedNaps.length === 0 ? (
        <div className="text-center py-12 text-(--hulux-text-muted) text-sm rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow)">
          Sin resultados con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow)">
          <table className="w-full text-left text-sm table-zebra">
            <thead className="bg-(--hulux-subtle) text-(--hulux-text)">
              <tr>
                <th className="p-3 w-10">Semáforo</th>
                <th className="p-3">ID NAP</th>
                <th className="p-3">Municipio</th>
                <th className="p-3">Localidad</th>
                <th className="p-3">Ocupación</th>
                <th className="p-3">%</th>
                <th className="p-3">Verif.</th>
                <th className="p-3">Coords</th>
                <th className="p-3">Tomodat</th>
                <th className="p-3">Acciones</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pagedNaps.map((nap) => {
                const color = getNAPColor(nap);
                const pct = Math.round(
                  (nap.puertos_ocupados / nap.capacidad_total) * 100
                );
                const isExpanded = expandedId === nap.id;

                return (
                  <Fragment key={nap.id}>
                    <tr className="border-t border-(--hulux-border) hover:bg-[rgba(148,237,242,0.12)]">
                      <td className="p-3">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                        title={
                          nap.puertos_ocupados > nap.capacidad_total
                            ? "ERROR: sobre-ocupación"
                            : nap.puertos_ocupados === nap.capacidad_total
                            ? "LLENO"
                            : nap.puertos_ocupados >= nap.capacidad_total * 0.7
                            ? "Alta ocupación"
                            : "Disponible"
                        }
                      />
                    </td>
                    <td className="p-3 text-(--hulux-text-muted) font-medium">{nap.id_nap}</td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <input
                          type="text"
                          value={editFields.municipio || ""}
                          onChange={(e) => setEditFields((f) => ({ ...f, municipio: e.target.value }))}
                          className="w-full rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                        />
                      ) : (
                        nap.municipio
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <input
                          type="text"
                          value={editFields.localidad || ""}
                          onChange={(e) => setEditFields((f) => ({ ...f, localidad: e.target.value }))}
                          className="w-full rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                        />
                      ) : (
                        nap.localidad
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <select
                          value={editFields.capacidad_total || 8}
                          onChange={(e) => setEditFields((f) => ({ ...f, capacidad_total: parseInt(e.target.value) }))}
                          className="rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                        >
                          <option value={8}>8</option>
                          <option value={16}>16</option>
                        </select>
                      ) : (
                        <span style={{ color }} className="font-bold">
                          {nap.puertos_ocupados} / {nap.capacidad_total}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-2 bg-(--hulux-progress-track) rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="text-xs text-(--hulux-text) font-bold">{pct}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-(--hulux-text-muted) text-center">
                      {editingId === nap.id ? (
                        <input
                          type="number"
                          value={editFields.verificacion ?? 0}
                          onChange={(e) => setEditFields((f) => ({ ...f, verificacion: parseInt(e.target.value) || 0 }))}
                          min="0"
                          className="w-16 rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-sm text-(--hulux-text) text-center focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                        />
                      ) : (
                        nap.verificacion || "—"
                      )}
                    </td>
                    <td className="p-3 text-xs text-(--hulux-text-muted)">
                      {editingId === nap.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="number"
                            step="any"
                            value={editFields.latitud ?? ""}
                            onChange={(e) => setEditFields((f) => ({ ...f, latitud: e.target.value ? parseFloat(e.target.value) : undefined }))}
                            placeholder="Lat"
                            className="w-full rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-xs text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                          />
                          <input
                            type="number"
                            step="any"
                            value={editFields.longitud ?? ""}
                            onChange={(e) => setEditFields((f) => ({ ...f, longitud: e.target.value ? parseFloat(e.target.value) : undefined }))}
                            placeholder="Lon"
                            className="w-full rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-xs text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                          />
                        </div>
                      ) : nap.latitud != null && nap.longitud != null ? (
                        <span>{nap.latitud.toFixed(4)}, {nap.longitud.toFixed(4)}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <select
                          value={editFields.estado_tomodat || "Activo"}
                          onChange={(e) => setEditFields((f) => ({ ...f, estado_tomodat: e.target.value }))}
                          className="rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-xs text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Rojo">Rojo</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            nap.estado_tomodat === "Activo"
                              ? "bg-[rgba(205,219,0,0.20)] text-(--hulux-text)"
                              : "bg-[rgba(112,0,63,0.10)] text-(--hulux-text)"
                          }`}
                        >
                          {nap.estado_tomodat}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-(--hulux-orange) hover:brightness-95 disabled:opacity-50 text-(--hulux-blue) rounded transition-colors"
                          >
                            {saving ? "..." : "Guardar"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] text-(--hulux-text) border border-(--hulux-border) rounded transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(nap)}
                            className="px-2 py-1 text-xs bg-[rgba(148,237,242,0.22)] hover:bg-[rgba(148,237,242,0.32)] text-(--hulux-text) border border-[rgba(148,237,242,0.45)] rounded transition-colors font-bold"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteNAP(nap.id)}
                            disabled={deleting === nap.id}
                            className="px-2 py-1 text-xs bg-transparent hover:bg-[rgba(112,0,63,0.12)] text-(--hulux-text) border border-[rgba(112,0,63,0.35)] rounded transition-colors disabled:opacity-50 font-bold"
                          >
                            {deleting === nap.id ? "..." : "Eliminar"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="group relative inline-flex justify-center items-center">
                        <button
                          onClick={() => toggleExpand(nap.id)}
                          className="text-(--hulux-maroon-light) hover:bg-[rgba(112,0,63,0.1)] p-2 rounded text-xs transition-colors"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                        {/* Tooltip flotante */}
                        <div className="absolute right-full mr-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-50 pointer-events-none">
                          <div className="bg-(--hulux-blue) dark:bg-(--hulux-surface-elevated) dark:border dark:border-(--hulux-border) text-white text-[11px] px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-xl font-medium">
                            {isExpanded ? "Ocultar menú de clientes" : "Ver menú desplegable de clientes"}
                          </div>
                          <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[5px] border-l-(--hulux-blue) dark:border-l-(--hulux-border)" />
                        </div>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[rgba(17,41,62,0.02)] dark:bg-[rgba(148,237,242,0.03)] border-b border-(--hulux-border)">
                      <td colSpan={11} className="p-4">
                        <div className="bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-xl p-4 shadow-inner">
                          <h3 className="text-sm font-semibold mb-3 text-(--hulux-blue) dark:text-(--hulux-cyan)">
                            Clientes en {nap.id_nap}
                          </h3>
                          {loadingClientes ? (
                            <p className="text-(--hulux-text-muted) text-sm flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Cargando clientes...
                            </p>
                          ) : expandedClientes.length === 0 ? (
                            <p className="text-(--hulux-text-muted) text-sm bg-(--hulux-surface) border border-(--hulux-border) rounded-lg p-3 inline-block">
                              Sin clientes registrados en esta NAP.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {expandedClientes.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center gap-2 bg-(--hulux-surface) border border-(--hulux-border) rounded-lg px-3 py-1.5 text-sm shadow-sm transition-colors hover:bg-[rgba(148,237,242,0.05)]"
                                >
                                  <span className="text-(--hulux-text) font-medium">{c.nombre}</span>
                                  <span className="text-(--hulux-text-muted) text-xs bg-(--hulux-subtle) px-1.5 py-0.5 rounded">
                                    {c.id_wisp}
                                  </span>
                                  <button
                                    onClick={() => handleDelete(c.id, nap.id)}
                                    className="text-(--hulux-maroon-light) hover:bg-[rgba(112,0,63,0.1)] p-1 rounded transition-colors ml-1"
                                    title="Eliminar cliente"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {/* ── Legend ── */}
          <div className="flex flex-wrap gap-4 p-3 bg-(--hulux-subtle) rounded-b-xl border-t border-(--hulux-border) text-xs text-(--hulux-text-muted)">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-(--hulux-lime)" /> Disponible
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-(--hulux-orange)" /> ≥70%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-(--hulux-maroon)" /> Lleno
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-(--hulux-cyan)" /> Sobre-ocupación
            </span>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-(--hulux-text-muted)">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2.5 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
            >
              ««
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
            >
              « Anterior
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i;
              } else if (page < 3) {
                pageNum = i;
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 7 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-xs rounded-lg transition-colors ${
                    pageNum === page
                      ? "bg-(--hulux-blue) text-white dark:bg-(--hulux-cyan) dark:text-(--hulux-blue)"
                      : "bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] text-(--hulux-text-muted) border border-(--hulux-border)"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
            >
              Siguiente »
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
