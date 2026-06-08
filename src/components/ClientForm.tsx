"use client";

import { useState, useEffect, useMemo } from "react";
import type { NAP } from "@/lib/types";
import {
  getMunicipios,
  getLocalidadesByMunicipio,
  getNAPs,
  registerCliente,
} from "@/lib/firestore";
import { useAuth } from "@/lib/AuthContext";
import { registrarLog } from "@/lib/audit";

interface Props {
  onSuccess: () => void;
  initialNap?: NAP;
  onCancel?: () => void;
}

export default function ClientForm({ onSuccess, initialNap, onCancel }: Props) {
  const { user } = useAuth();
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [todasLasNaps, setTodasLasNaps] = useState<NAP[]>([]);

  const [municipio, setMunicipio] = useState(initialNap?.municipio || "");
  const [localidad, setLocalidad] = useState(initialNap?.localidad || "");
  const [idNap, setIdNap] = useState(initialNap?.id || "");
  const [nombre, setNombre] = useState("");
  const [idWisp, setIdWisp] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    getMunicipios().then(setMunicipios);
    getNAPs(3000).then((result) => setTodasLasNaps(result.data));
  }, []);

  useEffect(() => {
    if (municipio) {
      getLocalidadesByMunicipio(municipio).then((l) => {
        setLocalidades(l);
        // Do not reset if we have an initialNap
        if (!initialNap) {
          setLocalidad("");
          setIdNap("");
        }
      });
    } else {
      setLocalidades([]);
      if (!initialNap) setLocalidad("");
    }
  }, [municipio, initialNap]);

  // NAPs filtradas por municipio y/o localidad seleccionados
  const napsFiltradas = useMemo(() => {
    return todasLasNaps.filter((n) => {
      if (municipio && n.municipio !== municipio) return false;
      if (localidad && n.localidad !== localidad) return false;
      return true;
    });
  }, [todasLasNaps, municipio, localidad]);

  const selectedNap = todasLasNaps.find((n) => n.id === idNap);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!idNap || !nombre.trim() || !idWisp.trim()) {
      setMsg({ type: "error", text: "Todos los campos son obligatorios." });
      return;
    }

    const napSeleccionada = todasLasNaps.find((n) => n.id === idNap);
    if (!napSeleccionada) {
      setMsg({ type: "error", text: "NAP no encontrada." });
      return;
    }

    setLoading(true);
    const result = await registerCliente({
      nombre: nombre.trim(),
      id_wisp: idWisp.trim(),
      municipio: napSeleccionada.municipio,
      localidad: napSeleccionada.localidad,
      id_nap: idNap,
    });

    if (result.success) {
      await registrarLog(
        "CREAR_CLIENTE",
        user?.email ?? "desconocido",
        user?.uid ?? "",
        `Registró cliente "${nombre.trim()}" (WISP: ${idWisp.trim()}) en NAP ${idNap}`,
        { nombre: nombre.trim(), id_wisp: idWisp.trim(), id_nap: idNap }
      );
      setMsg({ type: "success", text: "Cliente registrado correctamente." });
      setNombre("");
      setIdWisp("");
      onSuccess();
    } else {
      setMsg({ type: "error", text: result.error || "Error desconocido." });
    }
    setLoading(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) p-5"
    >
      <h2 className="text-lg font-semibold">Registrar Cliente</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Municipio (filtro opcional) */}
        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">Municipio (filtro)</label>
          <select
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text)"
          >
            <option value="">Todos los municipios</option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Localidad (filtro opcional) */}
        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">Localidad (filtro)</label>
          <select
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            disabled={!municipio}
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) disabled:opacity-40"
          >
            <option value="">Todas las localidades</option>
            {[...new Set(localidades)].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* NAP - dropdown completo con filtro */}
        <div className="md:col-span-2">
          <label className="block text-xs text-(--hulux-text-muted) mb-1">
            NAP ({napsFiltradas.length} disponibles)
          </label>
          <select
            value={idNap}
            onChange={(e) => setIdNap(e.target.value)}
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text)"
          >
            <option value="">Seleccionar NAP</option>
            {napsFiltradas.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id_nap} — {n.municipio}, {n.localidad} ({n.puertos_ocupados}/{n.capacidad_total})
              </option>
            ))}
          </select>
        </div>

        {/* Info NAP */}
        {selectedNap && (
          <div className="md:col-span-2 text-xs text-(--hulux-text-muted)">
            <span className="text-(--hulux-text-muted)">{selectedNap.municipio} &rsaquo; {selectedNap.localidad}</span>
            <span className="ml-3">
              Capacidad: {selectedNap.puertos_ocupados} / {selectedNap.capacidad_total} puertos
            </span>
            {selectedNap.puertos_ocupados >= selectedNap.capacidad_total && (
              <span className="text-(--hulux-maroon) ml-2 font-semibold">(LLENA)</span>
            )}
          </div>
        )}

        {/* Nombre cliente */}
        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">
            Nombre del Cliente
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Juan Pérez"
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted)"
          />
        </div>

        {/* ID WISP */}
        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">ID WISP</label>
          <input
            type="text"
            value={idWisp}
            onChange={(e) => setIdWisp(e.target.value)}
            placeholder="Ej. HULUX-001"
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted)"
          />
        </div>
      </div>

      {msg && (
        <div
          className={`text-sm p-2 rounded-lg ${
            msg.type === "error"
              ? "bg-[rgba(112,0,63,0.08)] border border-[rgba(112,0,63,0.22)] text-(--hulux-maroon)"
              : "bg-[rgba(205,219,0,0.18)] border border-[rgba(205,219,0,0.35)] text-(--hulux-blue)"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-1/3 rounded-lg bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-50 p-2.5 text-sm font-semibold text-(--hulux-text) border border-(--hulux-border) transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-(--hulux-orange) hover:brightness-95 disabled:opacity-50 p-2.5 text-sm font-semibold text-(--hulux-blue) transition-colors"
        >
          {loading ? "Registrando..." : "Registrar Cliente"}
        </button>
      </div>
    </form>
  );
}
