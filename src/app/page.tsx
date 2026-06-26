"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { NAP } from "@/lib/types";
import type { Usuario } from "@/lib/firestore";
import NAPTable from "@/components/NAPTable";
import ClientForm from "@/components/ClientForm";
import ProtectedRoute from "@/components/ProtectedRoute";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";

// Imported extracted components
import StatCard from "@/components/StatCard";
import ClientesTab from "@/components/ClientesTab";
import BuscarClienteTab from "@/components/BuscarClienteTab";
import AgregarNapTab from "@/components/AgregarNapTab";
import UsuariosTab from "@/components/UsuariosTab";
import LogsTab from "@/components/LogsTab";
import dynamic from "next/dynamic";
const MapaTab = dynamic(() => import("@/components/MapaTab"), { ssr: false });
import PerfilModal from "@/components/PerfilModal";
import { registrarLog } from "@/lib/audit";

type Tab = "dashboard" | "registro" | "clientes" | "buscar" | "agregarNap" | "usuarios" | "logs" | "mapa";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard NAPs", icon: "📊" },
  { key: "registro", label: "Registrar Cliente", icon: "➕" },
  { key: "agregarNap", label: "Agregar NAP", icon: "🔌" },
  { key: "clientes", label: "Clientes", icon: "👥" },
  { key: "buscar", label: "Buscar Cliente", icon: "🔍" },
  { key: "usuarios", label: "Usuarios", icon: "👤" },
  { key: "logs", label: "Actividad", icon: "📋" },
  { key: "mapa", label: "Mapa NAPs", icon: "🗺️" },
];

export default function Home() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const [naps, setNaps] = useState<NAP[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filteredNaps, setFilteredNaps] = useState<NAP[] | null>(null);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState("");

  let userRole = usuarios.find((u) => u.uid === user?.uid)?.rol || "instalador";
  if (user?.email === "chemjmme@gmail.com") {
    userRole = "admin";
  }

  const availableTabs = useMemo(() => {
    return TABS.filter((t) => {
      if (userRole === "admin") return true;
      if (userRole === "sucursal") {
        return ["dashboard", "registro", "clientes", "buscar", "mapa"].includes(t.key);
      }
      if (userRole === "supervisor") {
        return ["dashboard", "registro", "clientes", "buscar", "mapa", "logs"].includes(t.key);
      }
      if (userRole === "soporte") {
        return ["dashboard", "clientes", "buscar"].includes(t.key);
      }
      if (userRole === "infraestructura") {
        return ["dashboard", "agregarNap", "clientes", "buscar", "mapa"].includes(t.key);
      }
      if (userRole === "administracion") {
        return ["dashboard", "clientes", "buscar", "mapa"].includes(t.key);
      }
      // instalador
      return t.key === "mapa";
    });
  }, [userRole]);

  useEffect(() => {
    if (availableTabs.length > 0) {
      // Only redirect if current tab is not in the allowed list
      setTab((current) => {
        const isAllowed = availableTabs.some((t) => t.key === current);
        return isAllowed ? current : availableTabs[0].key;
      });
    }
  // Only re-run when the set of available tabs changes, NOT when tab changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTabs]);

  useEffect(() => {
    let mounted = true;
    const unsubs: Array<() => void> = [];
    import("@/lib/firestore")
      .then(({ subscribeToNAPs, subscribeToUsuarios }) => {
        if (!mounted) return;

        unsubs.push(
          subscribeToNAPs((data) => {
            setNaps(data);
            setLoading(false);
          })
        );
        unsubs.push(subscribeToUsuarios(setUsuarios));
      })
      .catch((err) => {
        console.error("Error al cargar datos:", err);
        setLoading(false);
      });
    return () => {
      mounted = false;
      unsubs.forEach((fn) => fn());
    };
  }, []);

  const emptyRefresh = useCallback(() => {}, []);

  // Stats — use filtered NAPs when filters are active, otherwise all NAPs
  const stats = useMemo(() => {
    const hasFilter = filteredNaps && filteredNaps.length < naps.length;
    const sourceNaps = hasFilter ? filteredNaps : naps;
    const totalNaps = sourceNaps.length;
    const totalPuertos = sourceNaps.reduce((s, n) => s + n.capacidad_total, 0);
    const totalOcupados = sourceNaps.reduce((s, n) => s + n.puertos_ocupados, 0);
    const pctOcupacion =
      totalPuertos > 0 ? Math.round((totalOcupados / totalPuertos) * 100) : 0;
    
    // Al ser un puerto ocupado por cada cliente, el total de clientes es exactamente igual a los puertos ocupados
    const totalClientes = totalOcupados;
    
    return { totalNaps, totalPuertos, totalOcupados, pctOcupacion, totalClientes };
  }, [naps, filteredNaps]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--hulux-bg)">
        <div className="flex items-center gap-3 text-(--hulux-text-muted)">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Cargando...
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-(--hulux-bg)">
      {/* Header */}
      <header className="border-b border-(--hulux-border) bg-(--hulux-bg)/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-(--hulux-text)">OptiCore</h1>
            <p className="text-(--hulux-text-muted) text-xs">Gestión de fibra óptica</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Botón de perfil */}
            <button
              onClick={() => setPerfilOpen(true)}
              title="Mi perfil"
              className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--hulux-blue)] to-[var(--hulux-cyan)] flex items-center justify-center text-white text-sm font-bold shadow hover:brightness-110 transition-all"
            >
              {(user?.displayName || user?.email || "?")[0].toUpperCase()}
            </button>
            <span className="text-(--hulux-text-muted) text-xs hidden sm:inline">{user?.email}</span>
            <ThemeToggle />
            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs bg-(--hulux-orange) hover:brightness-110 text-white rounded-lg transition-colors font-semibold"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards (scrollable on mobile) */}
        <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
          <div className="shrink-0 w-3/4 sm:w-auto snap-start"><StatCard label="Total NAPs" value={stats.totalNaps} accentColor="var(--hulux-text)" /></div>
          <div className="shrink-0 w-3/4 sm:w-auto snap-start"><StatCard label="Total Clientes" value={stats.totalClientes} accentColor="var(--hulux-lime)" /></div>
          <div className="shrink-0 w-3/4 sm:w-auto snap-start"><StatCard label="Puertos Totales" value={stats.totalPuertos} accentColor="var(--hulux-orange)" /></div>
          <div className="shrink-0 w-3/4 sm:w-auto snap-start"><StatCard label="Puertos Ocupados" value={stats.totalOcupados} accentColor="var(--hulux-cyan)" /></div>
          <div className="shrink-0 w-3/4 sm:w-auto snap-start"><StatCard label="% Ocupación" value={`${stats.pctOcupacion}%`} accentColor="var(--hulux-text)" /></div>
        </div>

        {/* Reconcile */}
        {(userRole === "admin" || userRole === "infraestructura" || userRole === "administracion") && (
          <div className="flex items-center gap-3 mb-6">
            <button
            onClick={async () => {
              setReconciling(true);
              setReconcileMsg("");
              try {
                const { reconcileNAPs } = await import("@/lib/firestore");
                const r = await reconcileNAPs();
                setReconcileMsg(`${r.corregidas} NAPs corregidas, ${r.correctas} correctas.`);
                await registrarLog(
                  "SINCRONIZAR_CONTADORES",
                  user?.email ?? "desconocido",
                  user?.uid ?? "",
                  `Sincronizó contadores: ${r.corregidas} corregidas, ${r.correctas} correctas`
                );
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Error";
                setReconcileMsg(`Error: ${msg}`);
              }
              setReconciling(false);
            }}
            disabled={reconciling}
            className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-50 text-(--hulux-text) border border-(--hulux-border) rounded-lg transition-colors flex items-center gap-2"
          >
            {reconciling ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sincronizando...
              </>
            ) : (
              "Sincronizar contadores"
            )}
          </button>
          {reconcileMsg && (
            <span className="text-xs text-(--hulux-text-muted)">{reconcileMsg}</span>
          )}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          {/* Mobile Select */}
          <div className="sm:hidden relative">
            <select
              value={tab}
              onChange={(e) => setTab(e.target.value as Tab)}
              className="w-full appearance-none bg-(--hulux-surface) border border-(--hulux-border) text-(--hulux-text) font-semibold rounded-xl px-4 py-3 shadow-(--hulux-shadow) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
            {availableTabs.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.icon} {t.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-(--hulux-text-muted)">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Desktop Tabs */}
          <div className="hidden sm:flex flex-wrap gap-1 bg-(--hulux-surface) rounded-xl p-1 border border-(--hulux-border) shadow-(--hulux-shadow)">
            {availableTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 whitespace-nowrap text-center ${
                  tab === t.key
                    ? "bg-(--hulux-blue) text-white shadow dark:bg-(--hulux-cyan) dark:text-(--hulux-blue)"
                    : "text-(--hulux-text-muted) hover:text-(--hulux-text) hover:bg-[rgba(148,237,242,0.18)]"
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === "dashboard" && (
          <NAPTable naps={naps} onRefresh={emptyRefresh} onFilterChange={setFilteredNaps} userRole={userRole} />
        )}

        {tab === "registro" && (
          <div className="max-w-2xl mx-auto">
            <ClientForm onSuccess={emptyRefresh} naps={naps} />
          </div>
        )}

        {tab === "clientes" && (
          <ClientesTab naps={naps} userRole={userRole} />
        )}

        {tab === "buscar" && (
          <BuscarClienteTab naps={naps} userRole={userRole} />
        )}

        {tab === "agregarNap" && (
          <AgregarNapTab onSuccess={emptyRefresh} naps={naps} userRole={userRole} />
        )}

        {tab === "usuarios" && (
          <UsuariosTab usuarios={usuarios} />
        )}

        {tab === "logs" && (
          <LogsTab />
        )}

        {tab === "mapa" && (
          <MapaTab naps={naps} />
        )}
      </div>

      {/* Modal de perfil */}
      {perfilOpen && <PerfilModal onClose={() => setPerfilOpen(false)} />}
    </main>
  );
}
