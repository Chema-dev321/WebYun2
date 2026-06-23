"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { NAP } from "@/lib/types";

interface Props {
  naps: NAP[];
}

// Semaphore logic
function getSemaforo(nap: NAP): "verde" | "amarillo" | "rojo" | "celeste" {
  const o = nap.puertos_ocupados;
  const c = nap.capacidad_total;
  if (o > c) return "celeste";     // over-occupied
  if (o === c) return "rojo";      // full
  if (o >= c * 0.7) return "amarillo"; // ≥70%
  return "verde";                  // available
}

const SEMAFORO_HEX: Record<string, string> = {
  verde: "#4ade80",
  amarillo: "#f59e0b",
  rojo: "#ef4444",
  celeste: "#67e8f9",
};

const SEMAFORO_LABEL: Record<string, string> = {
  verde: "Disponible",
  amarillo: "Alta ocupación (≥70%)",
  rojo: "Llena",
  celeste: "Sobre-ocupación",
};

const TOMODAT_COLOR: Record<string, string> = {
  Activo: "#4ade80",
  Rojo: "#ef4444",
};

function createMarkerIcon(color: string, tomodatOk: boolean) {
  // NAP cabinet icon: a rectangular fiber box with ports and a signal arc on top
  const alertBadge = !tomodatOk
    ? `<circle cx="34" cy="6" r="7" fill="#f59e0b" stroke="white" stroke-width="1.5"/>
       <text x="34" y="10" text-anchor="middle" font-size="9" font-weight="bold" fill="white">!</text>`
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 52" width="44" height="52">
      <defs>
        <filter id="s" x="-20%" y="-10%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="rgba(0,0,0,0.4)"/>
        </filter>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.72"/>
        </linearGradient>
      </defs>

      <!-- Drop shadow base -->
      <ellipse cx="22" cy="50" rx="9" ry="3" fill="rgba(0,0,0,0.18)"/>

      <!-- Main body: NAP cabinet box -->
      <rect x="4" y="6" width="36" height="30" rx="5" ry="5"
        fill="url(#g)" stroke="white" stroke-width="2" filter="url(#s)"/>

      <!-- Cabinet inner panel (darker inset) -->
      <rect x="8" y="10" width="28" height="19" rx="3" ry="3"
        fill="rgba(0,0,0,0.18)"/>

      <!-- Fiber ports row — 4 circles -->
      <circle cx="13" cy="17" r="2.8" fill="white" opacity="0.9"/>
      <circle cx="20" cy="17" r="2.8" fill="white" opacity="0.9"/>
      <circle cx="27" cy="17" r="2.8" fill="white" opacity="0.9"/>
      <circle cx="34" cy="17" r="2.8" fill="white" opacity="0.9"/>

      <!-- Port dots (colored) -->
      <circle cx="13" cy="17" r="1.4" fill="${color}"/>
      <circle cx="20" cy="17" r="1.4" fill="${color}"/>
      <circle cx="27" cy="17" r="1.4" fill="${color}"/>
      <circle cx="34" cy="17" r="1.4" fill="${color}"/>

      <!-- Label area: "NAP" text -->
      <rect x="9" y="22" width="26" height="5" rx="2" fill="rgba(255,255,255,0.15)"/>
      <text x="22" y="26.5" text-anchor="middle" font-size="4.5" font-weight="800"
        fill="white" letter-spacing="1" font-family="monospace">NAP</text>

      <!-- Bottom connector stem -->
      <rect x="19" y="36" width="6" height="10" rx="2" fill="${color}" stroke="white" stroke-width="1.5"/>
      <polygon points="22,50 17,38 27,38" fill="${color}" stroke="white" stroke-width="1"/>

      <!-- Signal arc on top -->
      <path d="M10,8 Q22,-4 34,8" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>
      <path d="M14,8 Q22,1 30,8" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" opacity="0.5"/>

      <!-- Tomodat alert badge -->
      ${alertBadge}
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function MapaTab({ naps }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<import("leaflet").Marker[]>([]);
  const clusterGroupRef = useRef<any>(null);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [filtro, setFiltro] = useState<"todas" | "disponibles" | "llenas">("todas");
  const [tomodatFiltro, setTomodatFiltro] = useState<"todos" | "Activo" | "Rojo">("todos");
  const [selectedNap, setSelectedNap] = useState<NAP | null>(null);
  const [mounted, setMounted] = useState(false);
  const mapCenteredRef = useRef(false);

  // Special markers
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const searchMarkerRef = useRef<import("leaflet").Marker | null>(null);

  // Coords search
  const [searchCoordsInput, setSearchCoordsInput] = useState("");
  const [searchMarker, setSearchMarker] = useState<[number, number] | null>(null);


  // NAPs with coords
  const napsConCoords = useMemo(() => naps.filter(
    (n) => n.latitud != null && n.longitud != null
  ), [naps]);

  const napsFiltradas = useMemo(() => napsConCoords.filter((n) => {
    const sem = getSemaforo(n);
    if (filtro === "disponibles" && (sem === "rojo" || sem === "celeste")) return false;
    if (filtro === "llenas" && sem !== "rojo" && sem !== "celeste") return false;
    if (tomodatFiltro !== "todos" && n.estado_tomodat !== tomodatFiltro) return false;
    return true;
  }), [napsConCoords, filtro, tomodatFiltro]);

  // Stats
  const stats = useMemo(() => ({
    total: napsConCoords.length,
    disponibles: napsConCoords.filter((n) => {
      const s = getSemaforo(n); return s === "verde" || s === "amarillo";
    }).length,
    llenas: napsConCoords.filter((n) => {
      const s = getSemaforo(n); return s === "rojo" || s === "celeste";
    }).length,
    sinCoords: naps.length - napsConCoords.length,
  }), [naps, napsConCoords]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Init map
  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return;

    const L = require("leaflet");
    // @ts-ignore
    if (typeof window !== "undefined") window.L = L;

    // Fix default icon path issue with Next.js
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    // Default center: Mexico
    const defaultCenter: [number, number] = [23.6345, -102.5528];
    const map = L.map(mapRef.current!, {
      center: defaultCenter,
      zoom: 6,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mounted]);

  // Update markers when naps or filters change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const L = require("leaflet");
    // @ts-ignore
    if (typeof window !== "undefined") window.L = L;
    require("leaflet.markercluster");

    const map = mapInstanceRef.current!;

    // Remove old cluster group
    if (clusterGroupRef.current) {
      map.closePopup(); // Important: Fix for _leaflet_pos crash
      clusterGroupRef.current.clearLayers();
      map.removeLayer(clusterGroupRef.current);
    }

    // @ts-ignore
    const clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      disableClusteringAtZoom: 16,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: function (cluster: any) {
        const count = cluster.getChildCount();
        let bg = 'rgba(74, 222, 128, 0.2)';
        let border = '#4ade80';
        let textColor = 'var(--hulux-text, #11293e)';

        if (count >= 50) {
          bg = 'rgba(239, 68, 68, 0.2)'; // rojo
          border = '#ef4444';
        } else if (count >= 15) {
          bg = 'rgba(245, 158, 11, 0.2)'; // amarillo
          border = '#f59e0b';
        }

        return L.divIcon({
          html: `<div style="background-color: ${bg}; border: 2px solid ${border}; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; color: ${textColor}; backdrop-filter: blur(2px); box-shadow: 0 4px 10px rgba(0,0,0,0.15);"><span>${count}</span></div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(36, 36)
        });
      }
    });

    napsFiltradas.forEach((nap) => {
      const lat = nap.latitud!;
      const lng = nap.longitud!;
      const sem = getSemaforo(nap);
      const color = SEMAFORO_HEX[sem];
      const tomodatOk = nap.estado_tomodat === "Activo";
      const iconUrl = createMarkerIcon(color, tomodatOk);
      const pct = Math.round((nap.puertos_ocupados / nap.capacidad_total) * 100);

      const icon = L.icon({
        iconUrl,
        iconSize: [30, 36],
        iconAnchor: [15, 36],
        popupAnchor: [0, -38],
      });

      const marker = L.marker([lat, lng], { icon });

      const tomodatBadge = tomodatOk
        ? `<span style="background:#4ade8022;color:#16a34a;border:1px solid #4ade8055;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">✓ Tomodat Activo</span>`
        : `<span style="background:#f59e0b22;color:#b45309;border:1px solid #f59e0b55;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">⚠ Tomodat Rojo</span>`;

      const semBadge = `<span style="background:${color}22;color:${color === "#4ade80" ? "#16a34a" : color};border:1px solid ${color}55;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">${SEMAFORO_LABEL[sem]}</span>`;

      const verifBadge = nap.verificacion === 1
        ? `<span style="background:#cddb0022;color:#6b7c00;border:1px solid #cddb0055;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">✓ Verificada</span>`
        : `<span style="background:#70003f18;color:#a0005a;border:1px solid #70003f33;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:600">✗ Sin verificar</span>`;

      const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const coordsRow = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:5px 8px">
          <span style="font-size:10px;color:#0369a1;font-family:monospace">${coordsStr}</span>
          <button
            onclick="navigator.clipboard.writeText('${coordsStr}').then(()=>{this.textContent='✓';setTimeout(()=>{this.textContent='Copiar'},1200)})"
            style="font-size:10px;background:#0ea5e9;color:white;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;margin-left:6px;font-family:system-ui"
          >Copiar</button>
        </div>`;

      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:210px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px;color:#11293e">${nap.id_nap}</div>
          <div style="font-size:11px;color:#666;margin-bottom:8px">${nap.municipio} › ${nap.localidad}</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
            ${semBadge}
            ${tomodatBadge}
            ${verifBadge}
          </div>
          <div style="background:#f5f5f5;border-radius:6px;padding:6px 10px;font-size:12px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="color:#888">Puertos ocupados</span>
              <strong style="color:#11293e">${nap.puertos_ocupados} / ${nap.capacidad_total}</strong>
            </div>
            <div style="background:#e5e7eb;border-radius:4px;height:6px;overflow:hidden">
              <div style="height:100%;width:${Math.min(pct, 100)}%;background:${color};border-radius:4px;transition:width .3s"></div>
            </div>
            <div style="text-align:right;font-size:10px;color:#888;margin-top:2px">${pct}%</div>
          </div>
          ${nap.fecha_verificacion ? `<div style="font-size:10px;color:#888;margin-top:6px">Última verificación: <strong>${nap.fecha_verificacion}</strong></div>` : ""}
          ${coordsRow}
        </div>
      `, { maxWidth: 280 });

      marker.on("click", () => {
        setSelectedNap(nap);
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    // Auto-fit bounds if markers exist and no user pos
    if (napsFiltradas.length > 0 && !userPos && !mapCenteredRef.current) {
      const bounds = L.latLngBounds(
        napsFiltradas.map((n) => [n.latitud!, n.longitud!] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      mapCenteredRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [napsFiltradas, mounted]);

  // Special markers effect (User & Search)
  useEffect(() => {
    if (!mounted) return;
    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Update User Marker
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      if (userPos) {
        userMarkerRef.current = L.marker(userPos, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 2px rgba(59,130,246,0.3)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          }),
        })
          .addTo(map)
          .bindPopup("<b>Tu ubicación</b>");
      }

      // Update Search Marker
      if (searchMarkerRef.current) {
        map.removeLayer(searchMarkerRef.current);
        searchMarkerRef.current = null;
      }
      if (searchMarker) {
        searchMarkerRef.current = L.marker(searchMarker, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#0ea5e9;border:2px solid white;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -14],
          }),
        })
          .addTo(map)
          .bindPopup(`<b>Coordenadas buscadas</b><br/>${searchMarker[0].toFixed(6)}, ${searchMarker[1].toFixed(6)}`);
        
        // Don't auto-open popup on every render, but we can do it if desired.
      }
    });
  }, [userPos, searchMarker, mounted]);

  // Locate user
  const locateUser = useCallback(() => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos([lat, lng]);
        setLocating(false);

        import("leaflet").then((L) => {
          const map = mapInstanceRef.current;
          if (!map) return;
          map.setView([lat, lng], 13);
        });
      },
      () => {
        setLocating(false);
        alert("No se pudo obtener tu ubicación.");
      }
    );
  }, []);

  if (!mounted) return null;

  // Search coords
  const handleSearchCoords = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCoordsInput.trim()) {
      setSearchMarker(null);
      return;
    }
    const parts = searchCoordsInput.split(",");
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng)) {
        setSearchMarker([lat, lng]);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([lat, lng], 17);
        }
        return;
      }
    }
    alert("Formato inválido. Usa: latitud, longitud (ej. 20.123, -98.456)");
  };

  return (
    <div className="flex flex-col h-full space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-(--hulux-text)">Mapa de NAPs</h2>
          <p className="text-[11px] sm:text-xs text-(--hulux-text-muted)">
            {stats.total} con coords
            {stats.sinCoords > 0 && (
              <span className="ml-1 text-(--hulux-maroon)">· {stats.sinCoords} sin ubicación</span>
            )}
          </p>
        </div>

        {/* Mini stat pills */}
        <div className="flex gap-1.5 shrink-0">
          {[
            { label: "Disp.", count: stats.disponibles, color: "#4ade80" },
            { label: "Llenas", count: stats.llenas, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-(--hulux-border) bg-(--hulux-surface) text-[11px]">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="font-bold text-(--hulux-text)">{s.count}</span>
              <span className="text-(--hulux-text-muted) hidden sm:inline">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar (Collapsible on mobile) ── */}
      <details className="group bg-(--hulux-surface) border border-(--hulux-border) rounded-xl shadow-(--hulux-shadow) [&:not([open])_.content]:hidden sm:[&:not([open])_.content]:flex" open>
        <summary className="p-3 text-[13px] font-semibold text-(--hulux-text) cursor-pointer sm:hidden flex items-center justify-between list-none">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            Filtros y Controles
          </div>
          <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="content px-3 pb-3 sm:p-2 sm:px-3 flex flex-wrap items-center gap-3 border-t border-(--hulux-border) sm:border-0 mt-1 sm:mt-0 pt-3 sm:pt-2">

          {/* Disponibilidad */}
          <div className="flex gap-1 flex-1 min-w-[200px]">
            {(["todas", "disponibles", "llenas"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)}
                className={`flex-1 py-1.5 rounded-lg text-[12px] sm:text-[11px] font-medium transition-all ${
                  filtro === f
                    ? "bg-(--hulux-blue) text-white dark:bg-(--hulux-cyan) dark:text-(--hulux-blue) shadow-sm"
                    : "text-(--hulux-text-muted) bg-(--hulux-subtle) hover:bg-[rgba(148,237,242,0.18)]"
                }`}>
                {f === "todas" ? "Todas" : f === "disponibles" ? "🟢 Disp." : "🔴 Llenas"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-(--hulux-border) hidden sm:block" />

          {/* Tomodat */}
          <div className="flex gap-1 min-w-[140px] flex-1 sm:flex-none">
            {(["todos", "Activo", "Rojo"] as const).map((t) => (
              <button key={t} onClick={() => setTomodatFiltro(t)}
                title={t === "todos" ? "Todos" : t === "Activo" ? "Tomodat Activo" : "Tomodat Rojo"}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-[12px] sm:text-[11px] font-medium transition-all ${
                  tomodatFiltro === t
                    ? "bg-(--hulux-blue) text-white dark:bg-(--hulux-cyan) dark:text-(--hulux-blue) shadow-sm"
                    : "text-(--hulux-text-muted) bg-(--hulux-subtle) hover:bg-[rgba(148,237,242,0.18)]"
                }`}>
                {t === "todos" ? <span className="hidden sm:inline">Tomodat: </span> : null}
                {t === "todos" ? <span>Todos</span> : t === "Activo" ? "✅" : "⚠️"}
                <span className="inline sm:inline ml-1">{t === "todos" ? "" : t === "Activo" ? "Activo" : "Rojo"}</span>
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-(--hulux-border) hidden lg:block" />

          {/* Buscador de Coordenadas */}
          <form onSubmit={handleSearchCoords} className="flex gap-1 flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar lat, lng..."
              value={searchCoordsInput}
              onChange={(e) => setSearchCoordsInput(e.target.value)}
              className="flex-1 px-3 py-1.5 text-[12px] bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg focus:outline-none focus:border-(--hulux-cyan)"
            />
            <button type="submit"
              className="px-2 py-1.5 bg-(--hulux-subtle) hover:bg-(--hulux-border) border border-(--hulux-border) rounded-lg text-[12px] transition-colors flex items-center justify-center text-(--hulux-text-muted)"
              title="Buscar coordenadas"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </form>

          {/* Location + seed */}
          <div className="flex gap-2 w-full sm:w-auto lg:ml-auto">

            <button onClick={locateUser} disabled={locating}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-[12px] sm:text-[11px] font-medium bg-(--hulux-blue) text-white dark:bg-(--hulux-cyan) dark:text-(--hulux-blue) shadow-sm disabled:opacity-60 transition-all">
              {locating ? (
                <svg className="animate-spin h-4 w-4 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              )}
              <span>{locating ? "Localizando..." : "Mi ubicación"}</span>
            </button>
          </div>
        </div>
      </details>


      {/* ── Map ── fills available vertical space on mobile */}
      <div className="relative z-0 rounded-xl overflow-hidden border border-(--hulux-border) shadow-(--hulux-shadow)"
        style={{ height: "clamp(360px, 65vh, 620px)" }}>
        <div ref={mapRef} style={{ height: "100%", width: "100%" }} />

        {/* No coords overlay */}
        {napsConCoords.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-(--hulux-surface)/90 z-9999">
            <div className="text-center p-6">
              <p className="text-4xl mb-3">📍</p>
              <p className="font-semibold text-(--hulux-text)">Ninguna NAP tiene coordenadas</p>
              <p className="text-xs text-(--hulux-text-muted) mt-1 max-w-[200px] mx-auto">
                Agrega latitud y longitud en &ldquo;Agregar NAP&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Counter badge */}
        <div className="absolute top-2 right-2 z-9999 bg-(--hulux-surface)/90 backdrop-blur border border-(--hulux-border) rounded-lg px-2.5 py-1 text-[11px] font-medium text-(--hulux-text) shadow">
          {napsFiltradas.length}/{napsConCoords.length} NAPs
        </div>
      </div>

      {/* ── Selected NAP — slides up as a card on mobile ── */}
      {selectedNap && (
        <div className="bg-(--hulux-surface) border border-(--hulux-border) rounded-xl p-3 sm:p-4 shadow-(--hulux-shadow)">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full shrink-0 mt-1"
                style={{ background: SEMAFORO_HEX[getSemaforo(selectedNap)] }}/>
              <div className="min-w-0">
                <p className="font-bold text-(--hulux-text) text-sm">{selectedNap.id_nap}</p>
                <p className="text-[11px] text-(--hulux-text-muted) truncate">
                  {selectedNap.municipio} › {selectedNap.localidad}
                </p>
                {/* Progress bar */}
                <div className="mt-2 w-full">
                  <div className="flex justify-between text-[10px] text-(--hulux-text-muted) mb-1">
                    <span>Puertos</span>
                    <span className="font-semibold text-(--hulux-text)">
                      {selectedNap.puertos_ocupados}/{selectedNap.capacidad_total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-(--hulux-progress-track) rounded-full overflow-hidden w-40 sm:w-56">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(Math.round(selectedNap.puertos_ocupados / selectedNap.capacidad_total * 100), 100)}%`,
                        background: SEMAFORO_HEX[getSemaforo(selectedNap)]
                      }}/>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                  <span style={{ color: SEMAFORO_HEX[getSemaforo(selectedNap)] }} className="font-semibold">
                    {SEMAFORO_LABEL[getSemaforo(selectedNap)]}
                  </span>
                  <span className="text-(--hulux-text-muted)">·</span>
                  <span style={{ color: TOMODAT_COLOR[selectedNap.estado_tomodat] ?? "#888" }} className="font-semibold">
                    Tomodat {selectedNap.estado_tomodat}
                  </span>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedNap(null)}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-(--hulux-text-muted) hover:bg-(--hulux-subtle) transition-colors text-lg leading-none">
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Legend — collapsible on mobile ── */}
      <details className="sm:open" open={false}>
        <summary className="text-[11px] text-(--hulux-text-muted) cursor-pointer select-none list-none flex items-center gap-1.5 sm:hidden">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Ver leyenda de colores
        </summary>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-(--hulux-text-muted) mt-2">
          {Object.entries(SEMAFORO_LABEL).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEMAFORO_HEX[key] }}/>
              {label}
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-[#f59e0b]"/>
            Tomodat Rojo
          </div>
        </div>
      </details>

      {/* ── NAPs sin coords ── */}
      {stats.sinCoords > 0 && (
        <details className="bg-(--hulux-surface) border border-(--hulux-border) rounded-xl shadow-(--hulux-shadow)">
          <summary className="p-3 text-xs text-(--hulux-text-muted) cursor-pointer hover:text-(--hulux-text) transition-colors select-none">
            ⚠️ {stats.sinCoords} NAP{stats.sinCoords !== 1 ? "s" : ""} sin coordenadas
          </summary>
          <div className="px-3 pb-3 flex flex-wrap gap-2">
            {naps.filter((n) => n.latitud == null || n.longitud == null).map((n) => (
              <span key={n.id}
                className="px-2 py-0.5 text-xs rounded-md bg-(--hulux-subtle) text-(--hulux-text-muted) border border-(--hulux-border)">
                {n.id_nap}
              </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}


