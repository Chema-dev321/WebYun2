"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { NAP, Cliente } from "@/lib/types";
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
import MapaTab from "@/components/MapaTab";
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
  const [totalClientesCount, setTotalClientesCount] = useState(0);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [filteredNaps, setFilteredNaps] = useState<NAP[] | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileMsg, setReconcileMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    const unsubs: Array<() => void> = [];
    import("@/lib/firestore")
      .then(({ subscribeToNAPs, subscribeToUsuarios, getClientesCount }) => {
        if (!mounted) return;

        getClientesCount().then(setTotalClientesCount).catch(console.error);

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
    const totalClientes = hasFilter ? totalOcupados : totalClientesCount;
    return { totalNaps, totalPuertos, totalOcupados, pctOcupacion, totalClientes };
  }, [naps, filteredNaps, totalClientesCount]);

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
            <h1 className="text-xl font-bold tracking-tight text-(--hulux-text)">WebYun</h1>
            <p className="text-(--hulux-text-muted) text-xs">Gestión de fibra óptica</p>
          </div>
          <div className="flex items-center gap-4">
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
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total NAPs" value={stats.totalNaps} accentColor="var(--hulux-text)" />
          <StatCard label="Total Clientes" value={stats.totalClientes} accentColor="var(--hulux-lime)" />
          <StatCard label="Puertos Totales" value={stats.totalPuertos} accentColor="var(--hulux-orange)" />
          <StatCard label="Puertos Ocupados" value={stats.totalOcupados} accentColor="var(--hulux-cyan)" />
          <StatCard label="% Ocupación" value={`${stats.pctOcupacion}%`} accentColor="var(--hulux-text)" />
        </div>

        {/* Reconcile */}
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

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-(--hulux-surface) rounded-xl p-1 border border-(--hulux-border) shadow-(--hulux-shadow) overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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

        {/* Tab content */}
        {tab === "dashboard" && (
          <NAPTable naps={naps} onRefresh={emptyRefresh} onFilterChange={setFilteredNaps} />
        )}

        {tab === "registro" && (
          <div className="max-w-2xl mx-auto">
            <ClientForm onSuccess={emptyRefresh} />
          </div>
        )}

        {tab === "clientes" && (
          <ClientesTab naps={naps} />
        )}

        {tab === "buscar" && (
          <BuscarClienteTab naps={naps} />
        )}

        {tab === "agregarNap" && (
          <AgregarNapTab onSuccess={emptyRefresh} naps={naps} />
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
    </main>
  );
}
