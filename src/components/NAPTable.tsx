"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import type { NAP, Cliente as ClienteType } from "@/lib/types";
import { deleteCliente, getNAPColor, updateNAP, deleteNAP } from "@/lib/firestore";
import type { SemaforoState } from "@/lib/firestore";
import { useToast, useConfirm } from "@/components/ToastContext";
import { useAuth } from "@/lib/AuthContext";
import { registrarLog } from "@/lib/audit";
import ClientForm from "@/components/ClientForm";

interface Props {
  naps: NAP[];
  onRefresh: () => void;
  onFilterChange?: (filtered: NAP[]) => void;
  userRole?: string;
}

const SEMAFORO_COLORS: Record<SemaforoState, string> = {
  verde: "var(--hulux-lime)",
  amarillo: "var(--hulux-orange)",
  rojo: "var(--hulux-maroon)",
  celeste: "var(--hulux-cyan)",
};

const SEMAFORO_LABELS: Record<SemaforoState, string> = {
  verde: "Verde (disponible)",
  amarillo: "Amarillo (≥70%)",
  rojo: "Rojo (lleno)",
  celeste: "Azul celeste (sobre-ocupación)",
};

export default function NAPTable({ naps, onRefresh, onFilterChange, userRole = "instalador" }: Props) {
  // ── Filters ──
  const [search, setSearch] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [activosSemaforo, setActivosSemaforo] = useState<Set<SemaforoState>>(new Set());
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
  const [expandedClientes, setExpandedClientes] = useState<ClienteType[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [addingClientToNap, setAddingClientToNap] = useState<string | null>(null);

  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();

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
  const toggleSemaforo = (s: SemaforoState) => {
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
        if (!activosSemaforo.has(getNAPColor(nap))) return false;
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

  const handleDownloadCSV = () => {
    if (filteredNaps.length === 0) return;
    
    const headers = [
      "ID NAP", "Localidad", "Municipio", "Capacidad", 
      "Ocupados", "Disponibles", "Semáforo", "Verificación", "Última Verificación", "Latitud", "Longitud"
    ];
    
    const rows = filteredNaps.map(nap => {
      const color = getNAPColor(nap);
      const semaforoStr = SEMAFORO_LABELS[color];
      return [
        nap.id_nap,
        nap.localidad,
        nap.municipio,
        nap.capacidad_total,
        nap.puertos_ocupados,
        nap.capacidad_total - nap.puertos_ocupados,
        semaforoStr,
        nap.verificacion === 1 ? "Sí" : "No",
        nap.fecha_verificacion || "",
        nap.latitud || "",
        nap.longitud || ""
      ];
    });
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `naps_webyun_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (clienteId: string, napId: string) => {
    const ok = await confirm("¿Eliminar este cliente? Se liberará el puerto en la NAP.");
    if (!ok) return;
    try {
      const cliente = expandedClientes.find((c) => c.id === clienteId);
      const result = await deleteCliente(clienteId);
      if (!result.success) {
        showToast(result.error || "Error al eliminar cliente.", "error");
      } else {
        setExpandedClientes((prev) => prev.filter((c) => c.id !== clienteId));
        await registrarLog(
          "ELIMINAR_CLIENTE",
          user?.email ?? "desconocido",
          user?.uid ?? "",
          `Eliminó cliente "${cliente?.nombre ?? clienteId}" de NAP ${napId}`,
          { clienteId, napId, cliente }
        );
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      showToast(message, "error");
    }
    onRefresh();
  };

  const toggleExpand = async (napId: string) => {
    if (expandedId === napId) {
      setExpandedId(null);
      setExpandedClientes([]);
      setAddingClientToNap(null);
    } else {
      setExpandedId(napId);
      setAddingClientToNap(null);
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
      fecha_verificacion: nap.fecha_verificacion,
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
      const napOriginal = naps.find((n) => n.id === editingId);
      await updateNAP(editingId, editFields);
      await registrarLog(
        "EDITAR_NAP",
        user?.email ?? "desconocido",
        user?.uid ?? "",
        `Editó NAP ${napOriginal?.id_nap ?? editingId}`,
        { napId: editingId, antes: napOriginal, despues: editFields }
      );
      cancelEdit();
      onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al guardar.";
      console.error("Error al editar NAP:", message);
      showToast(message, "error");
    }
    setSaving(false);
  };

  const handleDeleteNAP = async (napId: string) => {
    const ok = await confirm("¿Eliminar esta NAP y todos sus clientes? Esta acción no se puede deshacer.");
    if (!ok) return;
    setDeleting(napId);
    try {
      const napTarget = naps.find((n) => n.id === napId);
      const result = await deleteNAP(napId);
      if (result.success) {
        await registrarLog(
          "ELIMINAR_NAP",
          user?.email ?? "desconocido",
          user?.uid ?? "",
          `Eliminó NAP ${napTarget?.id_nap ?? napId} (${napTarget?.localidad ?? ""})`,
          { napId, nap: napTarget }
        );
        onRefresh();
      } else {
        showToast(result.error || "Error al eliminar NAP.", "error");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al eliminar NAP.";
      console.error("Error al eliminar NAP:", message);
      showToast(message, "error");
    }
    setDeleting(null);
  };

  // ── Pagination ──
  const totalPages = Math.ceil(filteredNaps.length / pageSize);
  const pagedNaps = filteredNaps.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      {/* ── Filter bar (Collapsible on mobile) ── */}
      <details className="group rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) [&:not([open])_.content]:hidden sm:[&:not([open])_.content]:block" open>
        <summary className="p-4 text-[13px] font-semibold text-(--hulux-text) cursor-pointer sm:hidden flex items-center justify-between list-none">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros y Búsqueda
          </div>
          <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        
        <div className="content p-4 pt-0 sm:pt-4 space-y-3 border-t border-(--hulux-border) sm:border-0">
          {/* Row 1: Search + Municipio + Localidad + Disponibilidad */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-50">
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

            <div className="flex-1 min-w-35 sm:flex-none">
              <label className="block text-xs text-(--hulux-text-muted) mb-1">Municipio</label>
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              >
                <option value="">Todos</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-35 sm:flex-none">
              <label className="block text-xs text-(--hulux-text-muted) mb-1">Localidad</label>
              <select
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                disabled={!municipio}
                className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              >
                <option value="">Todas</option>
                {localidades.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-1 w-full sm:w-auto">
              {(["todas", "espacio", "llenas"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDisponibilidad(d)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
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
              {(Object.keys(SEMAFORO_LABELS) as SemaforoState[]).map((s) => {
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
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: SEMAFORO_COLORS[s] }}
                    />
                    {SEMAFORO_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results count */}
          <div className="flex items-center justify-between text-xs text-(--hulux-text-muted) pt-2">
            <div className="flex items-center gap-3">
              <span>
                Mostrando {filteredNaps.length} de {naps.length} NAPs
              </span>
              {/* CSV_EXPORT_DISABLED
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.1)] border border-(--hulux-border) rounded text-(--hulux-text) transition-colors"
                title="Descargar tabla actual como CSV"
              >
                <svg className="w-3.5 h-3.5 text-(--hulux-cyan)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
              CSV_EXPORT_DISABLED */}
            </div>
            {(search || municipio || activosSemaforo.size > 0 || disponibilidad !== "todas") && (
              <button
                onClick={() => {
                  setSearch("");
                  setMunicipio("");
                  setLocalidad("");
                  setActivosSemaforo(new Set());
                  setDisponibilidad("todas");
                }}
                className="text-(--hulux-maroon-light) hover:underline flex items-center gap-1"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </details>

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
                <th className="p-3">Últ. Verificación</th>
                <th className="p-3">Verif.</th>
                <th className="p-3">Coords</th>
                <th className="p-3">Tomodat</th>
                <th className="p-3">Acciones</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pagedNaps.map((nap) => {
                const color = SEMAFORO_COLORS[getNAPColor(nap)];
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
                    {/* Últ. Verificación */}
                    <td className="p-3 text-xs text-(--hulux-text-muted) whitespace-nowrap">
                      {editingId === nap.id ? (
                        <input
                          type="date"
                          value={editFields.fecha_verificacion ?? ""}
                          onChange={(e) => setEditFields((f) => ({ ...f, fecha_verificacion: e.target.value }))}
                          className="rounded bg-(--hulux-surface) border border-(--hulux-border) p-1 text-xs text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                        />
                      ) : nap.fecha_verificacion ? (
                        <span>{new Date(nap.fecha_verificacion + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    {/* Verificación Sí/No — inline select */}
                    <td className="p-3 text-center">
                      <select
                        value={editingId === nap.id ? (editFields.verificacion ?? nap.verificacion) : nap.verificacion}
                        onChange={async (e) => {
                          const val = parseInt(e.target.value);
                          const hoy = new Date().toISOString().split("T")[0];
                          if (editingId === nap.id) {
                            setEditFields((f) => ({ ...f, verificacion: val, fecha_verificacion: hoy }));
                          } else {
                            try {
                              await updateNAP(nap.id, { verificacion: val, fecha_verificacion: hoy });
                              await registrarLog(
                                "VERIFICAR_NAP",
                                user?.email ?? "desconocido",
                                user?.uid ?? "",
                                `Marcó NAP ${nap.id_nap} como ${val ? "verificada (Sí)" : "no verificada (No)"} — ${hoy}`,
                                { napId: nap.id, id_nap: nap.id_nap, verificacion: val, fecha_verificacion: hoy }
                              );
                              onRefresh();
                            } catch (err) {
                              showToast("Error al actualizar verificación", "error");
                            }
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-(--hulux-blue) transition-colors ${
                          (editingId === nap.id ? (editFields.verificacion ?? nap.verificacion) : nap.verificacion)
                            ? "bg-[rgba(205,219,0,0.18)] text-(--hulux-text) border-[rgba(205,219,0,0.35)]"
                            : "bg-[rgba(112,0,63,0.10)] text-(--hulux-text-muted) border-[rgba(112,0,63,0.25)]"
                        }`}
                      >
                        <option value={1}>✓ Sí</option>
                        <option value={0}>✗ No</option>
                      </select>
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
                      {(userRole === "admin" || userRole === "infraestructura") && (
                        editingId === nap.id ? (
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
                        )
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
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-(--hulux-blue) dark:text-(--hulux-cyan)">
                              Clientes en {nap.id_nap}
                            </h3>
                            {addingClientToNap !== nap.id && (
                              <button
                                onClick={() => setAddingClientToNap(nap.id)}
                                className="px-2 py-1 text-xs bg-(--hulux-orange) hover:brightness-95 text-(--hulux-blue) font-bold rounded flex items-center gap-1 transition-colors"
                              >
                                <span>+</span>
                                <span>Añadir</span>
                              </button>
                            )}
                          </div>
                          
                          {addingClientToNap === nap.id && (
                            <div className="mb-4 bg-[rgba(148,237,242,0.05)] border border-[rgba(148,237,242,0.15)] rounded-lg p-4">
                              <h4 className="text-xs font-semibold text-(--hulux-text) mb-2">Nuevo cliente en {nap.id_nap}</h4>
                              <ClientForm
                                initialNap={nap}
                                naps={naps}
                                onSuccess={() => {
                                  setAddingClientToNap(null);
                                  // Refresh clients for this NAP
                                  setLoadingClientes(true);
                                  import("@/lib/firestore").then(({ getClientesByNAP }) => {
                                    getClientesByNAP(nap.id).then(setExpandedClientes).finally(() => setLoadingClientes(false));
                                  });
                                  onRefresh(); // Refresh the NAP table to update occupation numbers
                                }}
                                onCancel={() => setAddingClientToNap(null)}
                              />
                            </div>
                          )}

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
                                  {(userRole === "admin" || userRole === "soporte") && (
                                    <button
                                      onClick={() => handleDelete(c.id, nap.id)}
                                      className="text-(--hulux-maroon-light) hover:bg-[rgba(112,0,63,0.1)] p-1 rounded transition-colors ml-1"
                                      title="Eliminar cliente"
                                    >
                                      ✕
                                    </button>
                                  )}
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
              <span className="w-3 h-3 rounded-full bg-(--hulux-cyan)" /> Azul celeste (sobre-ocupación)
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
