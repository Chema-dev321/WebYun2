"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { NAP } from "@/lib/types";
import { addNAP } from "@/lib/firestore";
import { useAuth } from "@/lib/AuthContext";
import { registrarLog } from "@/lib/audit";

interface Props {
  onSuccess: () => void;
  naps: NAP[];
  userRole?: string;
}

export default function AgregarNapTab({ onSuccess, naps, userRole }: Props) {
  const { user } = useAuth();
  const [idNap, setIdNap] = useState("");
  const [nombre, setNombre] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [capacidad, setCapacidad] = useState("8");
  const [estadoTomodat, setEstadoTomodat] = useState("Activo");
  const [verificacion, setVerificacion] = useState("0");
  const [fechaVerificacion, setFechaVerificacion] = useState("");
  const [latitud, setLatitud] = useState("");
  const [longitud, setLongitud] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);

  // Dropdowns
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [modoMunicipio, setModoMunicipio] = useState<"select" | "custom">("select");
  const [modoLocalidad, setModoLocalidad] = useState<"select" | "custom">("select");

  // Duplicate check
  const [napExiste, setNapExiste] = useState(false);
  const [checking, setChecking] = useState(false);
  const [nomenclaturaMsg, setNomenclaturaMsg] = useState("");

  // Track if idNap was manually entered by user — useRef so the effect always reads the latest value
  const isManualIdRef = useRef(false);

  // Get existing NAP IDs set for fast lookup
  const napIdsSet = useMemo(() => new Set(naps.map((n) => n.id_nap)), [naps]);

  const CONSONANTES = "BCDFGHJKLMNPQRSTVWXYZ";

  const generateIdNap = useCallback((mun: string, loc: string): string => {
    if (!mun || !loc) return "";
    const m = mun.charAt(0).toUpperCase();
    const l = loc.charAt(0).toUpperCase();

    // Collect unique consonants from localidad (excluding first letter) then municipio
    const seen = new Set<string>();
    const consonants: string[] = [];
    const full = (loc.toUpperCase() + mun.toUpperCase()).slice(1);
    for (const ch of full) {
      if (CONSONANTES.includes(ch) && !seen.has(ch)) {
        seen.add(ch);
        consonants.push(ch);
      }
    }

    // Try each consonant prefix
    for (const c of consonants.slice(0, 8)) {
      const prefix = `${m}${l}${c}`;
      // Find max existing suffix for this prefix
      let maxNum = 100;
      for (const id of napIdsSet) {
        if (id.startsWith(prefix + " ") || id.startsWith(prefix)) {
          const numPart = id.replace(prefix, "").replace(/\\s/g, "");
          const num = parseInt(numPart);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      const candidate = `${prefix} ${maxNum + 1}`;
      if (!napIdsSet.has(candidate) && !napIdsSet.has(`${prefix}${maxNum + 1}`)) {
        return candidate;
      }
    }

    // Fallback: just use first two letters + first consonant + next number
    const fallbackPrefix = consonants.length > 0
      ? `${m}${l}${consonants[0]}`
      : `${m}${l}X`;
    let fallbackNum = 101;
    while (napIdsSet.has(`${fallbackPrefix} ${fallbackNum}`)) fallbackNum++;
    return `${fallbackPrefix} ${fallbackNum}`;
  }, [napIdsSet]);

  // Auto-generate idNap when municipio + localidad change ONLY if user hasn't typed manually
  useEffect(() => {
    // If user manually typed an ID, never overwrite it
    if (isManualIdRef.current) return;
    if (!napExiste && municipio && localidad) {
      const generated = generateIdNap(municipio, localidad);
      setIdNap(generated);

      // Show message only if the first available consonant was actually skipped
      const m = municipio.charAt(0).toUpperCase();
      const l = localidad.charAt(0).toUpperCase();
      const locUp = localidad.toUpperCase();
      // Find first consonant in localidad (excluding first letter)
      let firstConsonant = "";
      for (let i = 1; i < locUp.length; i++) {
        if (CONSONANTES.includes(locUp[i])) {
          firstConsonant = locUp[i];
          break;
        }
      }
      // If no consonant in localidad, check municipio
      if (!firstConsonant) {
        const munUp = municipio.toUpperCase();
        for (let i = 0; i < munUp.length; i++) {
          if (CONSONANTES.includes(munUp[i])) {
            firstConsonant = munUp[i];
            break;
          }
        }
      }
      if (firstConsonant) {
        const firstChoicePrefix = `${m}${l}${firstConsonant}`;
        const generatedPrefix = generated.split(" ")[0];
        if (generatedPrefix !== firstChoicePrefix) {
          const exists = Array.from(napIdsSet).some((id) => id.startsWith(firstChoicePrefix + " ") || id === firstChoicePrefix);
          if (exists) {
            setNomenclaturaMsg(`"${firstChoicePrefix}" ya está en uso, se asignó "${generatedPrefix}".`);
          } else {
            setNomenclaturaMsg("");
          }
        } else {
          setNomenclaturaMsg("");
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipio, localidad, napExiste, generateIdNap, napIdsSet]);

  // When user manually edits idNap, mark it as manual so auto-generate won't overwrite it
  const handleIdNapChange = (val: string) => {
    isManualIdRef.current = true;
    setIdNap(val);
    setNomenclaturaMsg("");
  };

  // Clear the manual flag when form resets
  const clearManualFlag = () => {
    isManualIdRef.current = false;
  };

  const fetchMunicipios = useCallback(async () => {
    const { getMunicipios } = await import("@/lib/firestore");
    setMunicipios(await getMunicipios());
  }, []);

  useEffect(() => {
    fetchMunicipios();
  }, [fetchMunicipios]);

  useEffect(() => {
    if (municipio) {
      import("@/lib/firestore").then(({ getLocalidadesByMunicipio }) => {
        getLocalidadesByMunicipio(municipio).then(setLocalidades);
      });
    } else {
      setLocalidades([]);
    }
  }, [municipio]);

  // Auto-generate nombre when localidad or idNap changes (only for new NAPs)
  useEffect(() => {
    if (!napExiste && localidad && idNap) {
      setNombre(`${localidad} - ${idNap}`);
    }
  }, [localidad, idNap, napExiste]);

  // Check if NAP already exists
  useEffect(() => {
    if (!idNap.trim() || idNap.trim().length < 2) {
      setNapExiste(false);
      return;
    }
    const timer = setTimeout(async () => {
      setChecking(true);
      const { getNAPById } = await import("@/lib/firestore");
      const nap = await getNAPById(idNap.trim());
      setNapExiste(!!nap);
      setChecking(false);
      if (nap) {
        setMunicipio(nap.municipio);
        setLocalidad(nap.localidad);
        setNombre(nap.nombre);
        setCapacidad(String(nap.capacidad_total));
        setEstadoTomodat(nap.estado_tomodat);
        setVerificacion(String(nap.verificacion || 0));
        setFechaVerificacion(nap.fecha_verificacion || "");
        setLatitud(nap.latitud != null ? String(nap.latitud) : "");
        setLongitud(nap.longitud != null ? String(nap.longitud) : "");
        setMsg({ type: "info", text: `NAP "${idNap}" ya existe. Puedes modificar sus datos.` });
        setNomenclaturaMsg("");
      } else {
        setMsg(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [idNap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!idNap.trim() || !municipio.trim() || !localidad.trim()) {
      setMsg({ type: "error", text: "ID NAP, Municipio y Localidad son obligatorios." });
      return;
    }

    setLoading(true);
    try {
      await addNAP({
        id_nap: idNap.trim(),
        nombre: nombre.trim() || `${localidad.trim()} - ${idNap.trim()}`,
        municipio: municipio.trim(),
        localidad: localidad.trim(),
        capacidad_total: parseInt(capacidad) || 8,
        puertos_ocupados: 0,
        estado_tomodat: estadoTomodat,
        verificacion: parseInt(verificacion) || 0,
        fecha_verificacion: fechaVerificacion || undefined,
        latitud: latitud ? parseFloat(latitud) : undefined,
        longitud: longitud ? parseFloat(longitud) : undefined,
      });
      const accion = napExiste ? "EDITAR_NAP" : "CREAR_NAP";
      const desc = napExiste
        ? `Actualizó NAP "${idNap.trim()}" en ${localidad.trim()}`
        : `Creó NAP "${idNap.trim()}" en ${localidad.trim()}, ${municipio.trim()}`;
      await registrarLog(accion, user?.email ?? "desconocido", user?.uid ?? "", desc, {
        id_nap: idNap.trim(), municipio: municipio.trim(), localidad: localidad.trim(),
        capacidad: parseInt(capacidad) || 8,
      });
      setMsg({ type: "success", text: napExiste ? `NAP "${idNap}" actualizada.` : `NAP "${idNap}" agregada.` });
      if (!napExiste) {
        setIdNap("");
        setNombre("");
        setMunicipio("");
        setLocalidad("");
        setCapacidad("8");
        setEstadoTomodat("Activo");
        setVerificacion("0");
        setLatitud("");
        setLongitud("");
        setNomenclaturaMsg("");
        clearManualFlag(); // Allow auto-generate for the next NAP
      }
      setNapExiste(false);
      fetchMunicipios();
      onSuccess();
    } catch (err: unknown) {
      const msgErr = err instanceof Error ? err.message : "Error al guardar NAP.";
      setMsg({ type: "error", text: msgErr });
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) p-5"
      >
        <h2 className="text-lg font-semibold">{napExiste ? "Editar NAP" : "Agregar NAP"}</h2>

        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">
            ID NAP (código)
            {checking && <span className="ml-2 text-(--hulux-text-muted) animate-pulse">verificando...</span>}
            {!checking && napExiste && <span className="ml-2 text-(--hulux-maroon) font-semibold">ya existe</span>}
            {!checking && idNap.trim().length >= 2 && !napExiste && (
              <span className="ml-2 text-(--hulux-blue) font-semibold">nuevo</span>
            )}
          </label>
          <input
            type="text"
            value={idNap}
            onChange={(e) => handleIdNapChange(e.target.value.toUpperCase())}
            placeholder="Ej. ACT 201"
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
          />
          {nomenclaturaMsg && (
            <p className="mt-1 text-xs text-(--hulux-maroon)">{nomenclaturaMsg}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">Nombre de la NAP</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. COL. CENTRO - ACT 201"
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">
              Municipio
              <button
                type="button"
                onClick={() => {
                  setModoMunicipio(modoMunicipio === "select" ? "custom" : "select");
                  setMunicipio("");
                  setLocalidad("");
                }}
                className="ml-2 text-(--hulux-maroon) hover:underline"
              >
                {modoMunicipio === "select" ? "+ nuevo" : "▾ existente"}
              </button>
            </label>
            {modoMunicipio === "select" ? (
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              >
                <option value="">Seleccionar</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value.toUpperCase())}
                placeholder="Escribe el municipio"
                className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">
              Localidad
              {municipio && (
                <button
                  type="button"
                  onClick={() => {
                    setModoLocalidad(modoLocalidad === "select" ? "custom" : "select");
                    setLocalidad("");
                  }}
                  className="ml-2 text-(--hulux-maroon) hover:underline"
                >
                  {modoLocalidad === "select" ? "+ nueva" : "▾ existente"}
                </button>
              )}
            </label>
            {localidades.length > 0 && modoLocalidad === "select" ? (
              <select
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              >
                <option value="">Seleccionar</option>
                {localidades.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value.toUpperCase())}
                placeholder="Ej. COL. CENTRO"
                className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Capacidad (puertos)</label>
            <select
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text)"
            >
              <option value="8">8</option>
              <option value="16">16</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Verificación</label>
            <select
              value={verificacion}
              onChange={(e) => setVerificacion(e.target.value)}
              className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="0">No</option>
              <option value="1">Sí</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Fecha de verificación</label>
            <input
              type="date"
              value={fechaVerificacion}
              onChange={(e) => setFechaVerificacion(e.target.value)}
              className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Latitud</label>
            <input
              type="number"
              step="any"
              value={latitud}
              onChange={(e) => setLatitud(e.target.value)}
              placeholder="Ej. 19.4326"
              className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            />
          </div>
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Longitud</label>
            <input
              type="number"
              step="any"
              value={longitud}
              onChange={(e) => setLongitud(e.target.value)}
              placeholder="Ej. -99.1332"
              className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-(--hulux-text-muted) mb-1">Estado Tomodat</label>
          <select
            value={estadoTomodat}
            onChange={(e) => setEstadoTomodat(e.target.value)}
            className="w-full rounded-lg bg-(--hulux-surface) border border-(--hulux-border) p-2 text-sm text-(--hulux-text)"
          >
            <option value="Activo">Activo</option>
            <option value="Rojo">Rojo</option>
          </select>
        </div>

        {msg && (
          <div
            className={`text-sm p-2 rounded-lg ${
              msg.type === "error"
                ? "bg-[rgba(112,0,63,0.08)] border border-[rgba(112,0,63,0.22)] text-(--hulux-maroon)"
                : msg.type === "info"
                ? "bg-[rgba(148,237,242,0.22)] border border-[rgba(148,237,242,0.45)] text-(--hulux-blue)"
                : "bg-[rgba(205,219,0,0.18)] border border-[rgba(205,219,0,0.35)] text-(--hulux-blue)"
            }`}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-(--hulux-orange) hover:brightness-95 disabled:opacity-50 p-2.5 text-sm font-semibold text-(--hulux-blue) transition-colors"
        >
          {loading ? "Guardando..." : napExiste ? "Actualizar NAP" : "Agregar NAP"}
        </button>
      </form>
    </div>
  );
}
