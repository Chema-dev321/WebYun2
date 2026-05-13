"use client";

import { useState, useEffect, useMemo } from "react";
import type { NAP } from "@/lib/types";
import {
  getMunicipios,
  getLocalidadesByMunicipio,
  getNAPs,
  registerCliente,
} from "@/lib/firestore";

interface Props {
  onSuccess: () => void;
}

export default function ClientForm({ onSuccess }: Props) {
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [todasLasNaps, setTodasLasNaps] = useState<NAP[]>([]);

  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [idNap, setIdNap] = useState("");
  const [nombre, setNombre] = useState("");
  const [idWisp, setIdWisp] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    getMunicipios().then(setMunicipios);
    getNAPs().then(setTodasLasNaps);
  }, []);

  useEffect(() => {
    if (municipio) {
      getLocalidadesByMunicipio(municipio).then((l) => {
        setLocalidades(l);
        setLocalidad("");
        setIdNap("");
      });
    } else {
      setLocalidades([]);
      setLocalidad("");
    }
  }, [municipio]);

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
      className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-5"
    >
      <h2 className="text-lg font-semibold">Registrar Cliente</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Municipio (filtro opcional) */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Municipio (filtro)</label>
          <select
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white"
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
          <label className="block text-xs text-slate-400 mb-1">Localidad (filtro)</label>
          <select
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            disabled={!municipio}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white disabled:opacity-40"
          >
            <option value="">Todas las localidades</option>
            {localidades.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* NAP - dropdown completo con filtro */}
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">
            NAP ({napsFiltradas.length} disponibles)
          </label>
          <select
            value={idNap}
            onChange={(e) => setIdNap(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white"
          >
            <option value="">Seleccionar NAP</option>
            {napsFiltradas.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} — {n.municipio}, {n.localidad} ({n.puertos_ocupados}/{n.capacidad_total})
              </option>
            ))}
          </select>
        </div>

        {/* Info NAP */}
        {selectedNap && (
          <div className="md:col-span-2 text-xs text-slate-400">
            <span className="text-slate-500">{selectedNap.municipio} &rsaquo; {selectedNap.localidad}</span>
            <span className="ml-3">
              Capacidad: {selectedNap.puertos_ocupados} / {selectedNap.capacidad_total} puertos
            </span>
            {selectedNap.puertos_ocupados >= selectedNap.capacidad_total && (
              <span className="text-red-400 ml-2 font-medium">(LLENA)</span>
            )}
          </div>
        )}

        {/* Nombre cliente */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Nombre del Cliente
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Juan Pérez"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white placeholder-slate-500"
          />
        </div>

        {/* ID WISP */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">ID WISP</label>
          <input
            type="text"
            value={idWisp}
            onChange={(e) => setIdWisp(e.target.value)}
            placeholder="Ej. HULUX-001"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white placeholder-slate-500"
          />
        </div>
      </div>

      {msg && (
        <div
          className={`text-sm p-2 rounded-lg ${
            msg.type === "error"
              ? "bg-red-900/50 text-red-300"
              : "bg-green-900/50 text-green-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-2.5 text-sm font-medium transition-colors"
      >
        {loading ? "Registrando..." : "Registrar Cliente"}
      </button>
    </form>
  );
}
