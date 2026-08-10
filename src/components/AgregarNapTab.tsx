"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { NAP } from "@/lib/types";
import { addNAP } from "@/lib/firestore";
import { useAuth } from "@/lib/AuthContext";
import { registrarLog } from "@/lib/audit";

/**
 * Propiedades del componente {@link AgregarNapTab}.
 */
interface Props {
  /** Callback ejecutado exitosamente tras guardar la NAP */
  onSuccess: (idNap?: string) => void;
  /** Lista de NAPs existentes para validar duplicados y calcular sufijos */
  naps: NAP[];
  /** Rol de usuario activo en el sistema */
  userRole?: string;
}

/**
 * Componente `AgregarNapTab`.
 *
 * Ofrece una interfaz inteligente para el alta y edición de NAPs (Cajas de Distribución de Fibra Optical), incluyendo:
 * - Algoritmo de autogeneración de nomenclatura/código de NAP basado en consonantes de Municipio y Localidad.
 * - Detección automática de NAPs existentes para edición inmediata.
 * - Formularios reactivos para Municipio y Localidad con opción de valor existente o nuevo.
 * - Captura de coordenadas GPS, estado Tomodat, verificación y capacidad de puertos.
 */
export default function AgregarNapTab({ onSuccess, naps, userRole }: Props) {
  const { user } = useAuth();
  /** ID o código único de la NAP */
  const [idNap, setIdNap] = useState("");
  /** Nombre descriptivo de la NAP */
  const [nombre, setNombre] = useState("");
  /** Municipio al que pertenece la NAP */
  const [municipio, setMunicipio] = useState("");
  /** Localidad o colonia de la NAP */
  const [localidad, setLocalidad] = useState("");
  /** Capacidad de puertos (8 o 16) */
  const [capacidad, setCapacidad] = useState("8");
  /** Estado en el sistema Tomodat */
  const [estadoTomodat, setEstadoTomodat] = useState("Activo");
  /** Bandera de verificación técnica (0 o 1) */
  const [verificacion, setVerificacion] = useState("0");
  /** Fecha de la última verificación */
  const [fechaVerificacion, setFechaVerificacion] = useState("");
  /** Coordenada de latitud GPS */
  const [latitud, setLatitud] = useState("");
  /** Coordenada de longitud GPS */
  const [longitud, setLongitud] = useState("");
  /** Estado de carga durante el guardado */
  const [loading, setLoading] = useState(false);
  /** Mensaje de notificación del formulario */
  const [msg, setMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);

  // ── Controles de desplegables dinámicos ──
  /** Lista de municipios disponibles */
  const [municipios, setMunicipios] = useState<string[]>([]);
  /** Lista de localidades del municipio seleccionado */
  const [localidades, setLocalidades] = useState<string[]>([]);
  /** Modo de selección de municipio: existente en desplegable o ingreso manual */
  const [modoMunicipio, setModoMunicipio] = useState<"select" | "custom">("select");
  /** Modo de selección de localidad: existente en desplegable o ingreso manual */
  const [modoLocalidad, setModoLocalidad] = useState<"select" | "custom">("select");

  // ── Comprobación de duplicados y alertas ──
  /** Indica si el ID de NAP especificado ya existe en la base de datos */
  const [napExiste, setNapExiste] = useState(false);
  /** Estado de verificación asíncrona de existencia */
  const [checking, setChecking] = useState(false);
  /** Mensaje explicativo sobre la nomenclatura de la NAP */
  const [nomenclaturaMsg, setNomenclaturaMsg] = useState("");

  /** Referencia para saber si el usuario ingresó manualmente el ID (evita sobreescritura automática) */
  const isManualIdRef = useRef(false);

  /** Set de IDs de NAPs existentes para búsquedas rápidas `O(1)` */
  const napIdsSet = useMemo(() => new Set(naps.map((n) => n.id_nap)), [naps]);

  const CONSONANTES = "BCDFGHJKLMNPQRSTVWXYZ";

  /**
   * Genera automáticamente un código/ID de NAP óptimo utilizando las iniciales de Municipio y Localidad
   * seguidas de las consonantes y el siguiente número secuencial disponible.
   */
  const generateIdNap = useCallback((mun: string, loc: string): string => {
    if (!mun || !loc) return "";
    const m = mun.charAt(0).toUpperCase();
    const l = loc.charAt(0).toUpperCase();

    // Recolectar consonantes únicas
    const seen = new Set<string>();
    const consonants: string[] = [];
    const full = (loc.toUpperCase() + mun.toUpperCase()).slice(1);
    for (const ch of full) {
      if (CONSONANTES.includes(ch) && !seen.has(ch)) {
        seen.add(ch);
        consonants.push(ch);
      }
    }

    // Probar prefijos de consonantes
    for (const c of consonants.slice(0, 8)) {
      const prefix = `${m}${l}${c}`;
      let maxNum = 100;
      for (const id of napIdsSet) {
        if (id.startsWith(prefix + " ") || id.startsWith(prefix)) {
          const numPart = id.replace(prefix, "").replace(/\s/g, "");
          const num = parseInt(numPart);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      }
      const candidate = `${prefix} ${maxNum + 1}`;
      if (!napIdsSet.has(candidate) && !napIdsSet.has(`${prefix}${maxNum + 1}`)) {
        return candidate;
      }
    }

    // Alternativa en caso de fallback
    const fallbackPrefix = consonants.length > 0
      ? `${m}${l}${consonants[0]}`
      : `${m}${l}X`;
    let fallbackNum = 101;
    while (napIdsSet.has(`${fallbackPrefix} ${fallbackNum}`)) fallbackNum++;
    return `${fallbackPrefix} ${fallbackNum}`;
  }, [napIdsSet]);

  // Autogeneración del ID cuando cambian municipio/localidad si el usuario no editó manualmente
  useEffect(() => {
    if (isManualIdRef.current) return;
    if (!napExiste && municipio && localidad) {
      const generated = generateIdNap(municipio, localidad);
      setIdNap(generated);

      const m = municipio.charAt(0).toUpperCase();
      const l = localidad.charAt(0).toUpperCase();
      const locUp = localidad.toUpperCase();
      let firstConsonant = "";
      for (let i = 1; i < locUp.length; i++) {
        if (CONSONANTES.includes(locUp[i])) {
          firstConsonant = locUp[i];
          break;
        }
      }
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

  /**
   * Manejador del cambio manual del ID de la NAP.
   */
  const handleIdNapChange = (val: string) => {
    isManualIdRef.current = true;
    setIdNap(val);
    setNomenclaturaMsg("");
  };

  /** Restablece la bandera manual al reiniciar el formulario */
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

  // Autogenera el nombre legible de la NAP
  useEffect(() => {
    if (!napExiste && localidad && idNap) {
      setNombre(`${localidad} - ${idNap}`);
    }
  }, [localidad, idNap, napExiste]);

  // Comprueba la existencia previa de la NAP ingresada
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

  /**
   * Envía el formulario para crear o actualizar la NAP en Firestore.
   */
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
        clearManualFlag();
      }
      setNapExiste(false);
      fetchMunicipios();
      onSuccess(idNap);
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

        {/* Input ID NAP */}
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

        {/* Input Nombre */}
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

        {/* Municipio y Localidad */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-(--hulux-text-muted) mb-1 flex items-center">
              Municipio
              <button
                type="button"
                onClick={() => {
                  setModoMunicipio(modoMunicipio === "select" ? "custom" : "select");
                  setMunicipio("");
                  setLocalidad("");
                }}
                className="ml-3 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-(--hulux-orange) text-(--hulux-blue) hover:brightness-95 transition-all shadow-sm cursor-pointer"
              >
                {modoMunicipio === "select" ? "+ Nuevo" : "▾ Existente"}
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
            <label className="block text-xs text-(--hulux-text-muted) mb-1 flex items-center">
              Localidad
              {municipio && (
                <button
                  type="button"
                  onClick={() => {
                    setModoLocalidad(modoLocalidad === "select" ? "custom" : "select");
                    setLocalidad("");
                  }}
                  className="ml-3 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded bg-(--hulux-orange) text-(--hulux-blue) hover:brightness-95 transition-all shadow-sm cursor-pointer"
                >
                  {modoLocalidad === "select" ? "+ Nueva" : "▾ Existente"}
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

        {/* Capacidad, Verificación y Fecha */}
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

        {/* Coordenadas GPS */}
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

        {/* Estado Tomodat */}
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

        {/* Mensaje de estado */}
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

