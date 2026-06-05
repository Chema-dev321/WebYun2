"use client";

import { useState, useMemo, useEffect } from "react";
import type { NAP, Cliente } from "@/lib/types";
import { getClienteByWisp, getNAPById, updateCliente, deleteCliente, updateClienteNAP, subscribeToNAPs } from "@/lib/firestore";
import { useConfirm } from "@/components/ToastContext";

export default function BuscarClienteTab({ naps }: { naps: NAP[] }) {
  const [idWisp, setIdWisp] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [napInfo, setNapInfo] = useState<NAP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const { confirm } = useConfirm();

  // Edit mode
  const [editando, setEditando] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editMunicipio, setEditMunicipio] = useState("");
  const [editLocalidad, setEditLocalidad] = useState("");
  const [editIdNap, setEditIdNap] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Derived dropdown options for edit mode
  const municipiosUnicos = useMemo(() => {
    const set = new Set(naps.map((n) => n.municipio));
    return Array.from(set).sort();
  }, [naps]);

  const localidadesFiltradas = useMemo(() => {
    if (!editMunicipio) return [];
    const set = new Set(
      naps.filter((n) => n.municipio === editMunicipio).map((n) => n.localidad)
    );
    return Array.from(set).sort();
  }, [naps, editMunicipio]);

  // Subscribe to NAP updates when a client is loaded
  useEffect(() => {
    if (!cliente) return;
    const unsub = subscribeToNAPs((allNaps) => {
      const updated = allNaps.find((n) => n.id_nap === cliente.id_nap || n.id === cliente.id_nap);
      if (updated) {
        setNapInfo(updated);
      }
    });
    return () => unsub();
  }, [cliente]);

  const limpiarBusqueda = () => {
    setIdWisp("");
    setCliente(null);
    setNapInfo(null);
    setSearched(false);
    setError("");
    setEditando(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCliente(null);
    setNapInfo(null);
    setSearched(false);
    setEditando(false);

    if (!idWisp.trim()) {
      setError("Ingresa un ID WISP para buscar.");
      return;
    }

    setLoading(true);
    try {
      const result = await getClienteByWisp(idWisp.trim());
      if (!result) {
        setError(`No se encontró cliente con ID WISP "${idWisp.trim()}".`);
      } else {
        setCliente(result);
        const nap = await getNAPById(result.id_nap);
        setNapInfo(nap);
      }
    } catch {
      setError("Error al buscar. Intenta de nuevo.");
    }
    setSearched(true);
    setLoading(false);
  };

  const iniciarEdicion = () => {
    if (!cliente) return;
    setEditNombre(cliente.nombre);
    setEditMunicipio(cliente.municipio);
    setEditLocalidad(cliente.localidad);
    setEditIdNap(cliente.id_nap);
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
  };

  const guardarCambios = async () => {
    if (!cliente) return;
    setSaving(true);
    try {
      // Update basic fields
      await updateCliente(cliente.id, {
        nombre: editNombre.trim(),
        municipio: editMunicipio.trim(),
        localidad: editLocalidad.trim(),
      });

      // Reassign NAP if changed
      if (editIdNap !== cliente.id_nap) {
        const result = await updateClienteNAP(cliente.id, editIdNap);
        if (!result.success) {
          setError(result.error || "Error al reasignar NAP.");
          setSaving(false);
          return;
        }
        const nap = await getNAPById(editIdNap);
        setNapInfo(nap);
      }

      setCliente({
        ...cliente,
        nombre: editNombre.trim(),
        municipio: editMunicipio.trim(),
        localidad: editLocalidad.trim(),
        id_nap: editIdNap,
      });
      setEditando(false);
    } catch {
      setError("Error al guardar cambios.");
    }
    setSaving(false);
  };

  const eliminarCliente = async () => {
    if (!cliente) return;
    const ok = await confirm(
      `¿Eliminar a "${cliente.nombre}" (ID ${cliente.id_wisp})? Se liberará el puerto en la NAP.`
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const result = await deleteCliente(cliente.id);
      if (result.success) {
        setCliente(null);
        setNapInfo(null);
        setSearched(false);
        setError("");
        setIdWisp("");
      } else {
        setError(result.error || "Error al eliminar.");
      }
    } catch {
      setError("Error al eliminar cliente.");
    }
    setDeleting(false);
  };

  return (
    <div className="max-w-2xl mx-auto">

      <form onSubmit={handleSearch} className="mb-6">
        <label className="block text-sm text-(--hulux-text) mb-2">
          Buscar cliente por ID WISP
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={idWisp}
            onChange={(e) => setIdWisp(e.target.value)}
            placeholder="Ej. 12594"
            className="w-full sm:flex-1 px-4 py-2.5 bg-(--hulux-surface) border border-(--hulux-border) rounded-lg text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
          />
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-(--hulux-orange) hover:brightness-95 disabled:opacity-50 text-(--hulux-blue) font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? "Buscando..." : "Buscar"}
            </button>
            <button
              type="button"
              onClick={limpiarBusqueda}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] text-(--hulux-text) border border-(--hulux-border) rounded-lg transition-colors text-sm"
            >
              Limpiar
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-[rgba(112,0,63,0.08)] border border-[rgba(112,0,63,0.22)] text-(--hulux-maroon) text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {cliente && (
        <div className="rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) overflow-hidden">
          <div className="bg-(--hulux-subtle) px-5 py-3 border-b border-(--hulux-border) flex items-center justify-between">
            <h3 className="text-sm font-semibold text-(--hulux-text)">Cliente encontrado</h3>
            {!editando ? (
              <div className="flex gap-1.5">
                <button
                  onClick={eliminarCliente}
                  disabled={deleting}
                  className="px-3 py-1 text-xs bg-transparent hover:bg-[rgba(112,0,63,0.12)] text-(--hulux-maroon-light) border border-[rgba(112,0,63,0.35)] rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
                <button
                  onClick={iniciarEdicion}
                  className="px-3 py-1 text-xs bg-[rgba(148,237,242,0.22)] hover:bg-[rgba(148,237,242,0.32)] text-(--hulux-blue) border border-[rgba(148,237,242,0.45)] rounded-lg transition-colors"
                >
                  Editar
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={guardarCambios}
                  disabled={saving}
                  className="px-3 py-1 text-xs bg-(--hulux-orange) hover:brightness-95 disabled:opacity-50 text-(--hulux-blue) rounded-lg transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={cancelarEdicion}
                  className="px-3 py-1 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] text-(--hulux-text) border border-(--hulux-border) rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="p-5 space-y-3">
            <InfoRow label="ID WISP" value={cliente.id_wisp} />

            {editando ? (
              <EditableRow label="Nombre" value={editNombre} onChange={setEditNombre} />
            ) : (
              <InfoRow label="Nombre" value={cliente.nombre} />
            )}

            {editando ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-xs text-(--hulux-text-muted) sm:w-28 shrink-0">Municipio</span>
                  <select
                    value={editMunicipio}
                    onChange={(e) => {
                      setEditMunicipio(e.target.value);
                      setEditLocalidad("");
                      setEditIdNap("");
                    }}
                    className="flex-1 px-3 py-1.5 bg-(--hulux-surface) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                  >
                    <option value="">Seleccionar</option>
                    {municipiosUnicos.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-xs text-(--hulux-text-muted) sm:w-28 shrink-0">Localidad</span>
                  <select
                    value={editLocalidad}
                    onChange={(e) => {
                      setEditLocalidad(e.target.value);
                      setEditIdNap("");
                    }}
                    disabled={!editMunicipio}
                    className="flex-1 px-3 py-1.5 bg-(--hulux-surface) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue) disabled:opacity-40"
                  >
                    <option value="">Seleccionar</option>
                    {localidadesFiltradas.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-xs text-(--hulux-text-muted) sm:w-28 shrink-0">NAP</span>
                  <select
                    value={editIdNap}
                    onChange={(e) => setEditIdNap(e.target.value)}
                    disabled={!editLocalidad}
                    className="flex-1 px-3 py-1.5 bg-(--hulux-surface) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue) disabled:opacity-40"
                  >
                    <option value="">Seleccionar NAP</option>
                    {naps
                      .filter((n) => {
                        if (editMunicipio && n.municipio !== editMunicipio) return false;
                        if (editLocalidad && n.localidad !== editLocalidad) return false;
                        return true;
                      })
                      .sort((a, b) => a.nombre.localeCompare(b.nombre))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.id_nap} — {n.puertos_ocupados}/{n.capacidad_total}
                          {n.puertos_ocupados >= n.capacidad_total ? " (LLENA)" : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <InfoRow label="Municipio" value={cliente.municipio} />
                <InfoRow label="Localidad" value={cliente.localidad} />
              </>
            )}

            {!editando && (
              <InfoRow
                label="NAP"
                value={napInfo ? napInfo.id_nap : cliente.id_nap}
              />
            )}
            {napInfo && (
              <InfoRow
                label="Ocupación NAP"
                value={`${napInfo.puertos_ocupados}/${napInfo.capacidad_total} puertos`}
              />
            )}
            <InfoRow label="Fecha de alta" value={cliente.fecha_alta || "—"} />
          </div>
        </div>
      )}

      {searched && !cliente && !error && !loading && (
        <div className="text-center py-8 text-(--hulux-text-muted) text-sm">
          No se encontraron resultados.
        </div>
      )}
    </div>
  );
}

// ── Editable Row ──
function EditableRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <span className="text-xs text-(--hulux-text-muted) sm:w-28 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 bg-(--hulux-surface) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
      />
    </div>
  );
}

// ── Info Row ──
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3">
      <span className="text-xs text-(--hulux-text-muted) sm:w-28 shrink-0">{label}</span>
      <span className="text-sm text-(--hulux-text) font-semibold break-all">{value || "—"}</span>
    </div>
  );
}
