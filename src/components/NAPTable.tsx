"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { NAP } from "@/lib/types";
import { deleteCliente, getNAPColor, updateNAP, deleteNAP } from "@/lib/firestore";

interface Props {
  naps: NAP[];
  allClientes: import("@/lib/types").Cliente[];
  onRefresh: () => void;
}

type SemaforoFilter = "verde" | "amarillo" | "rojo" | "morado";

function getSemaforo(nap: NAP): SemaforoFilter {
  const o = nap.puertos_ocupados;
  const c = nap.capacidad_total;
  if (o > c) return "morado";
  if (o === c) return "rojo";
  if (o >= c * 0.75) return "amarillo";
  return "verde";
}

const SEMAFORO_COLORS: Record<SemaforoFilter, string> = {
  verde: "bg-green-500",
  amarillo: "bg-yellow-500",
  rojo: "bg-red-500",
  morado: "bg-purple-500",
};

const SEMAFORO_LABELS: Record<SemaforoFilter, string> = {
  verde: "Verde (disponible)",
  amarillo: "Amarillo (≥75%)",
  rojo: "Rojo (lleno)",
  morado: "Morado (error)",
};

export default function NAPTable({ naps, allClientes, onRefresh }: Props) {
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

  const getClientesForNap = (napId: string) => {
    return allClientes.filter((c) => c.id_nap === napId);
  };

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
          nap.nombre.toLowerCase().includes(q) ||
          nap.id_nap.toLowerCase().includes(q);
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

  const handleDelete = async (clienteId: string, napId: string) => {
    const ok = confirm("¿Eliminar este cliente? Se liberará el puerto en la NAP.");
    if (!ok) return;
    try {
      const result = await deleteCliente(clienteId);
      if (!result.success) {
        alert(result.error || "Error al eliminar cliente.");
      }
    } catch (e: any) {
      alert("Excepción: " + e.message);
    }
    onRefresh();
  };

  const toggleExpand = (napId: string) => {
    setExpandedId((prev) => (prev === napId ? null : napId));
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
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-3">
        {/* Row 1: Search + Municipio + Localidad + Disponibilidad */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">Buscar</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre o ID de NAP..."
                className="w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Municipio</label>
            <select
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Localidad</label>
            <select
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              disabled={!municipio}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    ? "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
                }`}
              >
                {d === "todas" ? "Todas" : d === "espacio" ? "Con espacio" : "Llenas"}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Semaforo chips */}
        <div>
          <label className="block text-xs text-slate-500 mb-1.5">Semáforo</label>
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
                      ? "bg-slate-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
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
        <div className="flex items-center justify-between text-xs text-slate-500">
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
              className="text-blue-400 hover:text-blue-300"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {pagedNaps.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-sm rounded-xl border border-slate-800 bg-slate-900/30">
          Sin resultados con los filtros actuales.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-slate-300">
              <tr>
                <th className="p-3 w-10">Semáforo</th>
                <th className="p-3">Nombre NAP</th>
                <th className="p-3">ID NAP</th>
                <th className="p-3">Municipio</th>
                <th className="p-3">Localidad</th>
                <th className="p-3">Ocupación</th>
                <th className="p-3">%</th>
                <th className="p-3">Verif.</th>
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
                  <tr key={nap.id} className="border-t border-slate-700">
                    <td className="p-3">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                        title={
                          nap.puertos_ocupados > nap.capacidad_total
                            ? "ERROR: sobre-ocupación"
                            : nap.puertos_ocupados === nap.capacidad_total
                            ? "LLENO"
                            : nap.puertos_ocupados >= nap.capacidad_total * 0.75
                            ? "Alta ocupación"
                            : "Disponible"
                        }
                      />
                    </td>
                    <td className="p-3 font-medium">
                      {editingId === nap.id ? (
                        <input
                          type="text"
                          value={editFields.nombre || ""}
                          onChange={(e) => setEditFields((f) => ({ ...f, nombre: e.target.value }))}
                          className="w-full rounded bg-slate-700 border border-slate-600 p-1 text-sm text-white"
                        />
                      ) : (
                        nap.nombre
                      )}
                    </td>
                    <td className="p-3 text-slate-400">{nap.id_nap}</td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <input
                          type="text"
                          value={editFields.municipio || ""}
                          onChange={(e) => setEditFields((f) => ({ ...f, municipio: e.target.value }))}
                          className="w-full rounded bg-slate-700 border border-slate-600 p-1 text-sm text-white"
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
                          className="w-full rounded bg-slate-700 border border-slate-600 p-1 text-sm text-white"
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
                          className="rounded bg-slate-700 border border-slate-600 p-1 text-sm text-white"
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
                        <div className="w-14 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{pct}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400 text-center">
                      {editingId === nap.id ? (
                        <input
                          type="number"
                          value={editFields.verificacion ?? 0}
                          onChange={(e) => setEditFields((f) => ({ ...f, verificacion: parseInt(e.target.value) || 0 }))}
                          min="0"
                          className="w-16 rounded bg-slate-700 border border-slate-600 p-1 text-sm text-white text-center"
                        />
                      ) : (
                        nap.verificacion || "—"
                      )}
                    </td>
                    <td className="p-3">
                      {editingId === nap.id ? (
                        <select
                          value={editFields.estado_tomodat || "Activo"}
                          onChange={(e) => setEditFields((f) => ({ ...f, estado_tomodat: e.target.value }))}
                          className="rounded bg-slate-700 border border-slate-600 p-1 text-xs text-white"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Rojo">Rojo</option>
                        </select>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            nap.estado_tomodat === "Activo"
                              ? "bg-green-900/70 text-green-300"
                              : "bg-red-900/70 text-red-300"
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
                            className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded transition-colors"
                          >
                            {saving ? "..." : "Guardar"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(nap)}
                            className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/20 rounded transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteNAP(nap.id)}
                            disabled={deleting === nap.id}
                            className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/20 rounded transition-colors disabled:opacity-50"
                          >
                            {deleting === nap.id ? "..." : "Eliminar"}
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleExpand(nap.id)}
                        className="text-blue-400 hover:text-blue-300 text-xs whitespace-nowrap"
                      >
                        {isExpanded ? "▼" : "▶"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Expanded client panel ── */}
          {expandedId && (
            <div className="bg-slate-900 border-t border-slate-700 p-4">
              <h3 className="text-sm font-semibold mb-2">
                Clientes en NAP: {naps.find((n) => n.id === expandedId)?.nombre}
              </h3>
              {getClientesForNap(expandedId).length === 0 ? (
                <p className="text-slate-500 text-sm">Sin clientes registrados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {getClientesForNap(expandedId).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-1.5 text-sm"
                    >
                      <span className="text-slate-300">{c.nombre}</span>
                      <span className="text-slate-500 text-xs">({c.id_wisp})</span>
                      <button
                        onClick={() => handleDelete(c.id, expandedId)}
                        className="text-red-400 hover:text-red-300 ml-1 text-xs"
                        title="Eliminar cliente"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Legend ── */}
          <div className="flex flex-wrap gap-4 p-3 bg-slate-800/50 rounded-b-xl border-t border-slate-700 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" /> Disponible
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" /> ≥75%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500" /> Lleno
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-purple-500" /> Sobre-ocupación
            </span>
          </div>
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
            >
              ««
            </button>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
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
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-400"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
            >
              Siguiente »
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
