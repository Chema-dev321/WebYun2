"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import useSupercluster from "use-supercluster";
import type { NAP } from "@/lib/types";

/**
 * Propiedades del componente {@link MapaTab}.
 */
interface Props {
  /** Lista completa de NAPs registradas para mostrar en el mapa */
  naps: NAP[];
}

/**
 * Determina el estado del semáforo de ocupación de una NAP.
 * @param nap Objeto NAP a evaluar.
 * @returns `"verde"` | `"amarillo"` | `"rojo"` | `"celeste"`.
 */
function getSemaforo(nap: NAP): "verde" | "amarillo" | "rojo" | "celeste" {
  const o = nap.puertos_ocupados, c = nap.capacidad_total;
  if (o > c) return "celeste";
  if (o === c) return "rojo";
  if (o >= c * 0.7) return "amarillo";
  return "verde";
}

/** Mapeo de colores hexadecimales según la clasificación del semáforo */
const SEMAFORO_HEX: Record<string, string> = {
  verde: "#22c55e", amarillo: "#f59e0b", rojo: "#ef4444", celeste: "#06b6d4",
};

/** Mapeo de texto explicativo para el semáforo */
const SEMAFORO_LABEL: Record<string, string> = {
  verde: "Disponible", amarillo: "Alta ocupación (≥70%)", rojo: "Llena", celeste: "Sobre-ocupación",
};

/** Colores por estado Tomodat */
const TOMODAT_COLOR: Record<string, string> = { Activo: "#22c55e", Verde: "#22c55e", Rojo: "#ef4444" };

/**
 * Genera una URL Data-URI de un marcador SVG personalizado para las NAPs.
 * @param color Color hexadecimal del marcador.
 * @param tomodatOk Si `false`, superpone una insignia de alerta de Tomodat.
 */
function createMarkerIcon(color: string, tomodatOk: boolean) {
  const alertBadge = !tomodatOk
    ? `<circle cx="34" cy="6" r="7" fill="#ef4444" stroke="white" stroke-width="1.5"/><text x="34" y="10" text-anchor="middle" font-size="9" font-weight="bold" fill="white">!</text>`
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 52" width="44" height="52">
      <defs>
        <filter id="s" x="-20%" y="-10%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.4)"/></filter>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="1"/><stop offset="100%" stop-color="${color}" stop-opacity="0.8"/></linearGradient>
      </defs>
      <ellipse cx="22" cy="50" rx="9" ry="3" fill="rgba(0,0,0,0.18)"/>
      <rect x="4" y="6" width="36" height="30" rx="5" ry="5" fill="url(#g)" stroke="white" stroke-width="2" filter="url(#s)"/>
      <rect x="8" y="10" width="28" height="19" rx="3" ry="3" fill="rgba(0,0,0,0.18)"/>
      <circle cx="13" cy="17" r="2.8" fill="white" opacity="0.9"/><circle cx="20" cy="17" r="2.8" fill="white" opacity="0.9"/><circle cx="27" cy="17" r="2.8" fill="white" opacity="0.9"/><circle cx="34" cy="17" r="2.8" fill="white" opacity="0.9"/>
      <circle cx="13" cy="17" r="1.4" fill="${color}"/><circle cx="20" cy="17" r="1.4" fill="${color}"/><circle cx="27" cy="17" r="1.4" fill="${color}"/><circle cx="34" cy="17" r="1.4" fill="${color}"/>
      <rect x="9" y="22" width="26" height="5" rx="2" fill="rgba(255,255,255,0.15)"/>
      <text x="22" y="26.5" text-anchor="middle" font-size="4.5" font-weight="800" fill="white" letter-spacing="1" font-family="monospace">NAP</text>
      <rect x="19" y="36" width="6" height="10" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
      <polygon points="22,50 17,38 27,38" fill="${color}" stroke="white" stroke-width="1"/>
      <path d="M10,8 Q22,-4 34,8" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
      <path d="M14,8 Q22,1 30,8" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>
      ${alertBadge}
    </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Genera el marcado HTML para los clusters de agrupamiento masivo de NAPs.
 * @param count Número de NAPs agrupadas en el cluster.
 */
function createClusterIconSvg(count: number) {
  let bg = "rgba(74, 222, 128, 0.4)";
  let border = "#4ade80";
  if (count >= 50) { bg = "rgba(239, 68, 68, 0.4)"; border = "#ef4444"; }
  else if (count >= 15) { bg = "rgba(245, 158, 11, 0.4)"; border = "#f59e0b"; }

  const html = `<div style="background-color:${bg};border:2px solid ${border};border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:var(--hulux-text, #11293e);backdrop-filter:blur(4px);box-shadow:0 4px 12px rgba(0,0,0,0.15)"><span>${count}</span></div>`;
  return html;
}

/**
 * Parsea una coordenada convirtiendo comas en puntos y descartando valores inválidos.
 * @param raw Valor bruto de la coordenada.
 */
function parseCoord(raw: unknown): number | null {
  const s = String(raw ?? "").replace(",", ".").trim();
  if (!s) return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Componente `MapaTab`.
 *
 * Visualizador cartográfico interactivo basado en Leaflet y Supercluster para renderizado fluido de NAPs:
 * - Agrupamiento de alto rendimiento (`useSupercluster`) para miles de marcadores.
 * - Filtros rápidos por estado de ocupación (Disponibles / Llenas) y Tomodat.
 * - Buscador directo de coordenadas GPS.
 * - Geolocalización del usuario en tiempo real.
 * - Popups informativos con opción de copiar coordenadas e inspección de puertos.
 */
export default function MapaTab({ naps }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);

  const [mounted, setMounted] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "disponibles" | "llenas">("todas");
  const [tomodatFiltro, setTomodatFiltro] = useState<"todos" | "Activo" | "Rojo">("todos");
  const [selectedNap, setSelectedNap] = useState<NAP | null>(null);
  const [locating, setLocating] = useState(false);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [searchInput, setSearchInput] = useState("");

  // ── Estado del mapa para Supercluster ──
  const [bounds, setBounds] = useState<[number, number, number, number] | undefined>(undefined);
  const [zoom, setZoom] = useState(6);

  useEffect(() => { setMounted(true); }, []);

  /** NAPs que poseen coordenadas lat/lng válidas */
  const napsConCoords = useMemo(() =>
    naps.filter(n => parseCoord(n.latitud) !== null && parseCoord(n.longitud) !== null),
    [naps]
  );

  /** NAPs filtradas según los parámetros seleccionados por el usuario */
  const napsFiltradas = useMemo(() => napsConCoords.filter(n => {
    const sem = getSemaforo(n);
    if (filtro === "disponibles" && (sem === "rojo" || sem === "celeste")) return false;
    if (filtro === "llenas" && sem !== "rojo" && sem !== "celeste") return false;
    if (tomodatFiltro !== "todos") {
      const norm = n.estado_tomodat?.trim().toLowerCase();
      const isOk = norm === "activo" || norm === "verde";
      if (tomodatFiltro === "Activo" && !isOk) return false;
      if (tomodatFiltro === "Rojo" && isOk) return false;
    }
    return true;
  }), [napsConCoords, filtro, tomodatFiltro]);

  /** Estadísticas calculadas de ocupación y georreferenciación */
  const stats = useMemo(() => ({
    total: napsConCoords.length,
    sinCoords: naps.length - napsConCoords.length,
    disponibles: napsConCoords.filter(n => { const s = getSemaforo(n); return s === "verde" || s === "amarillo"; }).length,
    llenas: napsConCoords.filter(n => { const s = getSemaforo(n); return s === "rojo" || s === "celeste"; }).length,
  }), [naps, napsConCoords]);

  /** Puntos formateados a GeoJSON para Supercluster */
  const points = useMemo(() => {
    return napsFiltradas.map(nap => {
      const lat = parseCoord(nap.latitud)!;
      const lng = parseCoord(nap.longitud)!;
      return {
        type: "Feature" as const,
        properties: { cluster: false, napId: nap.id_nap, nap },
        geometry: { type: "Point" as const, coordinates: [lng, lat] }
      };
    });
  }, [napsFiltradas]);

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 15 }
  });

  // Inicializa el mapa de Leaflet una única vez al montar
  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then(mod => {
      const L = (mod as any).default || mod;
      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: [20.2687, -98.9461],
        zoom: 13,
        preferCanvas: true,
        zoomControl: true,
      });
//aqui edite 
      /*
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      requestAnimationFrame(() => map.invalidateSize());
*/
      //nuevo codigo para api key


const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;

L.tileLayer(
  `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoApiKey}`,
  {
    attribution: "© OpenStreetMap © CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }
).addTo(map);



      //finaliza
      const updateBounds = () => {
        const b = map.getBounds();
        setBounds([
          b.getWest(),
          b.getSouth(),
          b.getEast(),
          b.getNorth()
        ]);
        setZoom(map.getZoom());
      };

      map.on("moveend", updateBounds);
      map.on("zoomend", updateBounds);
      updateBounds();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
    };
  }, [mounted]);

  // Renderiza ÚNICAMENTE los clusters y marcadores visibles según el área del viewport
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !clusters) return;

    const map = mapInstanceRef.current;
    if (layerGroupRef.current) {
      map.removeLayer(layerGroupRef.current);
    }

    import("leaflet").then(mod => {
      const L = (mod as any).default || mod;
      const newLayers: any[] = [];
      const iconCache: Record<string, any> = {};
//aqui agregue logs

console.log("NAPs recibidas:", naps.length);
console.log("NAPs con coordenadas:", napsConCoords.length);
console.log("NAPs filtradas:", napsFiltradas.length);
console.log("Puntos:", points.length);
console.log("Clusters:", clusters.length);
console.log("Bounds:", bounds);
      //finaliza
      for (const cluster of clusters) {
        const [lng, lat] = cluster.geometry.coordinates;
        const props = cluster.properties as any;
        const { cluster: isCluster, point_count: pointCount, nap } = props;

        if (isCluster) {
          const icon = L.divIcon({
            html: createClusterIconSvg(pointCount),
            className: "custom-cluster-icon",
            iconSize: L.point(44, 44),
          });
          const marker = L.marker([lat, lng], { icon });
          marker.on("click", () => {
            if (supercluster && cluster.id !== undefined) {
              const expansionZoom = supercluster.getClusterExpansionZoom(cluster.id as number);
              map.setView([lat, lng], expansionZoom, { animate: true });
            }
          });
          newLayers.push(marker);
        } else if (nap) {
          const sem = getSemaforo(nap);
          const color = SEMAFORO_HEX[sem];
          const normTomodat = nap.estado_tomodat?.trim().toLowerCase();
          const tomodatOk = normTomodat === "activo" || normTomodat === "verde";
          const pct = Math.round((nap.puertos_ocupados / nap.capacidad_total) * 100);

          const cacheKey = `${color}-${tomodatOk}`;
          if (!iconCache[cacheKey]) {
            iconCache[cacheKey] = L.icon({
              iconUrl: createMarkerIcon(color, tomodatOk),
              iconSize: [30, 36],
              iconAnchor: [15, 36],
              popupAnchor: [0, -38],
            });
          }

          const marker = L.marker([lat, lng], { icon: iconCache[cacheKey] });

          marker.bindPopup(`
            <div style="font-family:system-ui;min-width:200px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-weight:700;font-size:13px;margin-bottom:3px">${nap.id_nap}</div>
                  <div style="font-size:11px;color:#666;margin-bottom:6px">${nap.municipio} › ${nap.localidad}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;background:#f8fafc;border:1px dashed #cbd5e1;padding:4px 6px;border-radius:4px;margin-bottom:8px;">
                <span style="font-family:monospace;font-size:10px;color:#475569;">${lat}, ${lng}</span>
                <button onclick="navigator.clipboard.writeText('${lat}, ${lng}').then(()=>alert('Coordenadas copiadas: ${lat}, ${lng}'))" style="background:white;border:1px solid #cbd5e1;padding:2px 6px;border-radius:4px;cursor:pointer;font-size:9px;display:flex;align-items:center;gap:3px;" title="Copiar coordenadas">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copiar
                </button>
              </div>
              <div style="background:#f5f5f5;border-radius:6px;padding:6px 10px;font-size:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="color:#888">Puertos</span>
                  <strong>${nap.puertos_ocupados}/${nap.capacidad_total}</strong>
                </div>
                <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden">
                  <div style="height:100%;width:${Math.min(pct,100)}%;background:${color};border-radius:4px"></div>
                </div>
              </div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px;font-size:10px">
                <span style="background:${color}22;color:${color};border:1px solid ${color}55;padding:1px 7px;border-radius:999px;font-weight:600">${SEMAFORO_LABEL[sem]}</span>
                <span style="background:${tomodatOk?"#22c55e22":"#ef444422"};color:${tomodatOk?"#16a34a":"#dc2626"};border:1px solid ${tomodatOk?"#22c55e55":"#ef444455"};padding:1px 7px;border-radius:999px;font-weight:600">${tomodatOk?"✓ Tomodat Activo":"⚠ Tomodat Rojo"}</span>
              </div>
            </div>
          `, { maxWidth: 280 });

          marker.on("click", () => setSelectedNap(nap));
          newLayers.push(marker);
        }
      }

      const group = L.layerGroup(newLayers);
      group.addTo(map);
      layerGroupRef.current = group;
    });
  }, [clusters, mapReady, supercluster, userPos, points.length]);

  // Actualiza el marcador de posición del usuario
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    import("leaflet").then(mod => {
      const L = (mod as any).default || mod;
      const map = mapInstanceRef.current;
      if (!map) return;

      if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }
      if (userPos) {
        userMarkerRef.current = L.circleMarker(userPos, {
          radius: 9, fillColor: "#3b82f6", fillOpacity: 1, color: "#fff", weight: 3,
        }).addTo(map).bindPopup("<b>Tu ubicación</b>");
      }
    });
  }, [mapReady, userPos]);

  /**
   * Obtiene la posición GPS del usuario mediante la API de Geolocalización del navegador.
   */
  const locateUser = useCallback(() => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserPos([lat, lng]);
      setLocating(false);
      if (mapInstanceRef.current) mapInstanceRef.current.setView([lat, lng], 14);
    }, () => { setLocating(false); alert("No se pudo obtener tu ubicación."); });
  }, []);

  /**
   * Procesa la búsqueda por coordenadas lat/lng en la entrada de texto.
   */
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;
    const [a, b] = searchInput.split(",");
    const lat = parseFloat((a || "").trim()), lng = parseFloat((b || "").trim());
    if (!isNaN(lat) && !isNaN(lng) && mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 17);
      import("leaflet").then(mod => {
        const L = (mod as any).default || mod;
        if (searchMarkerRef.current) mapInstanceRef.current.removeLayer(searchMarkerRef.current);
        searchMarkerRef.current = L.circleMarker([lat, lng], {
          radius: 11, fillColor: "#0ea5e9", fillOpacity: 0.85, color: "#fff", weight: 3,
        }).addTo(mapInstanceRef.current)
          .bindPopup(`<b>Búsqueda</b><br/>${lat.toFixed(6)}, ${lng.toFixed(6)}`).openPopup();
      });
    } else {
      alert("Formato inválido. Usa: lat, lng");
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-(--hulux-text)">Mapa de NAPs</h2>
          <p className="text-xs text-(--hulux-text-muted)">
            {stats.total} con coordenadas
            {stats.sinCoords > 0 && <span className="ml-1 text-red-500">· {stats.sinCoords} sin ubicación</span>}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {[{ label: "Disp.", count: stats.disponibles, color: "#22c55e" }, { label: "Llenas", count: stats.llenas, color: "#ef4444" }].map(s => (
            <div key={s.label} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-(--hulux-border) bg-(--hulux-surface) text-[11px]">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="font-bold text-(--hulux-text)">{s.count}</span>
              <span className="text-(--hulux-text-muted) hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros de Mapa */}
      <div className="bg-(--hulux-surface) border border-(--hulux-border) rounded-xl shadow-(--hulux-shadow) p-2 px-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-1 min-w-[200px]">
          {(["todas", "disponibles", "llenas"] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex-1 py-1.5 rounded-lg text-[12px] font-medium transition-all ${filtro === f ? "bg-(--hulux-blue) text-white shadow-sm" : "text-(--hulux-text-muted) bg-(--hulux-subtle) hover:bg-[rgba(148,237,242,0.18)]"}`}>
              {f === "todas" ? "Todas" : f === "disponibles" ? "🟢 Disp." : "🔴 Llenas"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["todos", "Activo", "Rojo"] as const).map(t => (
            <button key={t} onClick={() => setTomodatFiltro(t)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${tomodatFiltro === t ? "bg-(--hulux-blue) text-white shadow-sm" : "text-(--hulux-text-muted) bg-(--hulux-subtle) hover:bg-[rgba(148,237,242,0.18)]"}`}>
              {t === "todos" ? "Tomodat: Todos" : t === "Activo" ? "✅ Activo" : "⚠️ Rojo"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSearch} className="flex gap-1 flex-1 min-w-[180px]">
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="lat, lng..."
            className="flex-1 px-3 py-1.5 text-xs bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg focus:outline-none focus:border-(--hulux-cyan) text-(--hulux-text)" />
          <button type="submit" className="px-2 py-1.5 bg-(--hulux-subtle) border border-(--hulux-border) rounded-lg transition-colors text-(--hulux-text-muted) hover:text-(--hulux-text)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </button>
        </form>
        {(filtro !== "todas" || tomodatFiltro !== "todos" || searchInput !== "") && (
          <button 
            onClick={() => {
              setFiltro("todas");
              setTomodatFiltro("todos");
              setSearchInput("");
            }}
            className="text-[12px] text-red-500 hover:underline px-2"
          >
            Limpiar filtros
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={locateUser} disabled={locating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-(--hulux-blue) text-white shadow-sm disabled:opacity-60 transition-all">
            {locating
              ? <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            <span>{locating ? "Localizando..." : "Mi ubicación"}</span>
          </button>
        </div>
      </div>

      {/* Contenedor del Mapa */}
      <div className="relative z-0 rounded-xl overflow-hidden border border-(--hulux-border) shadow-(--hulux-shadow)" style={{ height: "clamp(360px, 65vh, 620px)" }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
        {/* Contador superpuesto */}
        <div className="absolute top-2 right-2 z-[9999] bg-(--hulux-surface)/90 backdrop-blur border border-(--hulux-border) rounded-lg px-2.5 py-1 text-[11px] font-medium text-(--hulux-text) shadow">
          {napsFiltradas.length}/{stats.total} NAPs
        </div>
      </div>

      {/* Tarjeta de detalle de NAP seleccionada */}
      {selectedNap && (() => {
        const sem = getSemaforo(selectedNap);
        const pct = Math.min(Math.round(selectedNap.puertos_ocupados / selectedNap.capacidad_total * 100), 100);
        const lat = parseCoord(selectedNap.latitud);
        const lng = parseCoord(selectedNap.longitud);

        return (
          <div className="bg-(--hulux-surface) border border-(--hulux-border) rounded-xl p-4 shadow-(--hulux-shadow)">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ background: SEMAFORO_HEX[sem] }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-(--hulux-text) text-sm">{selectedNap.id_nap}</p>
                    {lat !== null && lng !== null && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${lat}, ${lng}`);
                          alert(`Coordenadas copiadas: ${lat}, ${lng}`);
                        }}
                        className="flex items-center gap-1 text-[10px] bg-(--hulux-subtle) hover:bg-[rgba(148,237,242,0.2)] text-(--hulux-text-muted) px-2 py-0.5 rounded border border-(--hulux-border) transition-colors"
                        title="Copiar coordenadas"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copiar Coordenadas
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-(--hulux-text-muted) truncate">{selectedNap.municipio} › {selectedNap.localidad}</p>
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-(--hulux-text-muted) mb-1">
                      <span>Puertos ocupados</span>
                      <span className="font-semibold text-(--hulux-text)">{selectedNap.puertos_ocupados}/{selectedNap.capacidad_total}</span>
                    </div>
                    <div className="h-1.5 bg-(--hulux-progress-track) rounded-full overflow-hidden w-48">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: SEMAFORO_HEX[sem] }} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                    <span style={{ color: SEMAFORO_HEX[sem] }} className="font-semibold">{SEMAFORO_LABEL[sem]}</span>
                    <span className="text-(--hulux-text-muted)">·</span>
                    <span style={{ color: TOMODAT_COLOR[selectedNap.estado_tomodat] ?? "#888" }} className="font-semibold">Tomodat {selectedNap.estado_tomodat}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedNap(null)} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-(--hulux-text-muted) hover:bg-(--hulux-subtle) transition-colors text-lg">×</button>
            </div>
          </div>
        );
      })()}

      {/* Leyenda de Semáforo */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-(--hulux-text-muted)">
        {Object.entries(SEMAFORO_LABEL).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEMAFORO_HEX[key] }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

