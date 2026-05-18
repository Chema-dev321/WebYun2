"use client";

import { useState, useMemo } from "react";
import type { NAP, Cliente } from "@/lib/types";
import { getClienteByWisp, getNAPById, updateCliente, deleteCliente, updateClienteNAP } from "@/lib/firestore";

export default function BuscarClienteTab({ naps }: { naps: NAP[] }) {
  const [idWisp, setIdWisp] = useState("");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [napInfo, setNapInfo] = useState<NAP | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

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
    const ok = confirm(
      `¿Eliminar a "${cliente.nombre}" (ID ${cliente.id_wisp})?\nSe liberará el puerto en la NAP.`
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
        <label className="block text-sm text-[var(--hulux-text)] mb-2">
          Buscar cliente por ID WISP
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={idWisp}
            onChange={(e) => setIdWisp(e.target.value)}
            placeholder="Ej. 12594"
            className="flex-1 px-4 py-2.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-[var(--hulux-text)] placeholder-[var(--hulux-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[var(--hulux-orange)] hover:brightness-95 disabled:opacity-50 text-[var(--hulux-blue)] font-semibold rounded-lg transition-colors text-sm"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-[rgba(112,0,63,0.08)] border border-[rgba(112,0,63,0.22)] text-[var(--hulux-maroon)] text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {cliente && (
        <div className="rounded-xl border border-[var(--hulux-border)] bg-[var(--hulux-surface)] shadow-[var(--hulux-shadow)] overflow-hidden">
          <div className="bg-[var(--hulux-subtle)] px-5 py-3 border-b border-[var(--hulux-border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--hulux-text)]">Cliente encontrado</h3>
            {!editando ? (
              <div className="flex gap-1.5">
                <button
                  onClick={eliminarCliente}
                  disabled={deleting}
                  className="px-3 py-1 text-xs bg-transparent hover:bg-[rgba(112,0,63,0.12)] text-[var(--hulux-maroon-light)] border border-[rgba(112,0,63,0.35)] rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
                <button
                  onClick={iniciarEdicion}
                  className="px-3 py-1 text-xs bg-[rgba(148,237,242,0.22)] hover:bg-[rgba(148,237,242,0.32)] text-[var(--hulux-blue)] border border-[rgba(148,237,242,0.45)] rounded-lg transition-colors"
                >
                  Editar
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={guardarCambios}
                  disabled={saving}
                  className="px-3 py-1 text-xs bg-[var(--hulux-orange)] hover:brightness-95 disabled:opacity-50 text-[var(--hulux-blue)] rounded-lg transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={cancelarEdicion}
                  className="px-3 py-1 text-xs bg-[var(--hulux-surface)] hover:bg-[rgba(148,237,242,0.18)] text-[var(--hulux-text)] border border-[var(--hulux-border)] rounded-lg transition-colors"
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
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--hulux-text-muted)] w-28 shrink-0">Municipio</span>
                  <select
                    value={editMunicipio}
                    onChange={(e) => {
                      setEditMunicipio(e.target.value);
                      setEditLocalidad("");
                      setEditIdNap("");
                    }}
                    className="flex-1 px-3 py-1.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
                  >
                    <option value="">Seleccionar</option>
                    {municipiosUnicos.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--hulux-text-muted)] w-28 shrink-0">Localidad</span>
                  <select
                    value={editLocalidad}
                    onChange={(e) => {
                      setEditLocalidad(e.target.value);
                      setEditIdNap("");
                    }}
                    disabled={!editMunicipio}
                    className="flex-1 px-3 py-1.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)] disabled:opacity-40"
                  >
                    <option value="">Seleccionar</option>
                    {localidadesFiltradas.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--hulux-text-muted)] w-28 shrink-0">NAP</span>
                  <select
                    value={editIdNap}
                    onChange={(e) => setEditIdNap(e.target.value)}
                    disabled={!editLocalidad}
                    className="flex-1 px-3 py-1.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)] disabled:opacity-40"
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
        <div className="text-center py-8 text-[var(--hulux-text-muted)] text-sm">
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
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--hulux-text-muted)] w-28 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
      />
    </div>
  );
}

// ── Info Row ──
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-[var(--hulux-text-muted)] w-28 shrink-0">{label}</span>
      <span className="text-sm text-[var(--hulux-text)] font-semibold">{value || "—"}</span>
    </div>
  );
}
