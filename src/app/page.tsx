"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import type { NAP, Cliente } from "@/lib/types";
import { getNAPs, getClientes, getClienteByWisp, getNAPById, addNAP, getUsuarios, updateCliente, deleteCliente } from "@/lib/firestore";
import type { Usuario } from "@/lib/firestore";
import NAPTable from "@/components/NAPTable";
import ClientForm from "@/components/ClientForm";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";

type Tab = "dashboard" | "registro" | "clientes" | "buscar" | "agregarNap" | "usuarios";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard NAPs", icon: "📊" },
  { key: "registro", label: "Registrar Cliente", icon: "➕" },
  { key: "agregarNap", label: "Agregar NAP", icon: "🔌" },
  { key: "clientes", label: "Clientes", icon: "👥" },
  { key: "buscar", label: "Buscar Cliente", icon: "🔍" },
  { key: "usuarios", label: "Usuarios", icon: "👤" },
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
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("dashboard");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [napsData, clientesData, usuariosData] = await Promise.all([
        getNAPs(),
        getClientes(),
        getUsuarios(),
      ]);
      setNaps(napsData);
      setClientes(clientesData);
      setUsuarios(usuariosData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al cargar datos.";
      console.error("Error al cargar datos:", message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Stats
  const stats = useMemo(() => {
    const totalNaps = naps.length;
    const totalPuertos = naps.reduce((s, n) => s + n.capacidad_total, 0);
    const totalOcupados = naps.reduce((s, n) => s + n.puertos_ocupados, 0);
    const pctOcupacion =
      totalPuertos > 0 ? Math.round((totalOcupados / totalPuertos) * 100) : 0;
    const totalClientes = clientes.length;
    return { totalNaps, totalPuertos, totalOcupados, pctOcupacion, totalClientes };
  }, [naps, clientes]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
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
    <main className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">WebYun</h1>
            <p className="text-slate-400 text-xs">Gestión de fibra óptica</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-xs hidden sm:inline">{user?.email}</span>
            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total NAPs" value={stats.totalNaps} color="blue" />
          <StatCard label="Total Clientes" value={stats.totalClientes} color="emerald" />
          <StatCard label="Puertos Totales" value={stats.totalPuertos} color="slate" />
          <StatCard label="Puertos Ocupados" value={stats.totalOcupados} color="amber" />
          <StatCard label="% Ocupación" value={`${stats.pctOcupacion}%`} color="rose" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-900 rounded-xl p-1 border border-slate-800 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="mr-1.5">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "dashboard" && (
          <NAPTable naps={naps} onRefresh={loadData} />
        )}

        {tab === "registro" && (
          <div className="max-w-2xl mx-auto">
            <ClientForm onSuccess={loadData} />
          </div>
        )}

        {tab === "clientes" && (
          <ClientesTab clientes={clientes} naps={naps} onRefresh={loadData} />
        )}

        {tab === "buscar" && (
          <BuscarClienteTab naps={naps} />
        )}

        {tab === "agregarNap" && (
          <AgregarNapTab onSuccess={loadData} />
        )}

        {tab === "usuarios" && (
          <UsuariosTab usuarios={usuarios} />
        )}
      </div>
    </main>
  );
}

// ── Stat Card ──
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: "border-blue-500/30 bg-blue-500/5 text-blue-400",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
    slate: "border-slate-600/30 bg-slate-500/5 text-slate-300",
    amber: "border-amber-500/30 bg-amber-500/5 text-amber-400",
    rose: "border-rose-500/30 bg-rose-500/5 text-rose-400",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color] || colors.slate}`}>
      <p className="text-xs opacity-70 mb-0.5">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

// ── Tab Clientes ──
function ClientesTab({ clientes, naps, onRefresh }: { clientes: Cliente[]; naps: NAP[]; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const filtered = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.id_wisp.toLowerCase().includes(q) ||
        c.municipio.toLowerCase().includes(q) ||
        c.localidad.toLowerCase().includes(q)
    );
  }, [clientes, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Buscar por nombre, ID WISP, municipio..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-slate-500">
          {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {paged.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {search ? "Sin resultados." : "No hay clientes registrados."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">ID WISP</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Municipio</th>
                  <th className="p-3">Localidad</th>
                  <th className="p-3">NAP</th>
                  <th className="p-3">Fecha Alta</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => {
                  const nap = naps.find((n) => n.id === c.id_nap);
                  return (
                    <tr
                      key={c.id}
                      className="border-t border-slate-800 hover:bg-slate-900/50 transition-colors"
                    >
                      <td className="p-3 font-mono text-xs text-blue-400">{c.id_wisp}</td>
                      <td className="p-3 font-medium">{c.nombre}</td>
                      <td className="p-3 text-slate-300">{c.municipio}</td>
                      <td className="p-3 text-slate-300">{c.localidad}</td>
                      <td className="p-3 text-slate-400 text-xs">
                        {nap ? nap.nombre : c.id_nap}
                      </td>
                      <td className="p-3 text-slate-500 text-xs">{c.fecha_alta}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-slate-500">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg text-slate-300 transition-colors"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab Buscar Cliente ──
function BuscarClienteTab({ naps }: { naps: NAP[] }) {
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    setEditando(true);
  };

  const cancelarEdicion = () => {
    setEditando(false);
  };

  const guardarCambios = async () => {
    if (!cliente) return;
    setSaving(true);
    try {
      await updateCliente(cliente.id, {
        nombre: editNombre.trim(),
        municipio: editMunicipio.trim(),
        localidad: editLocalidad.trim(),
      });
      setCliente({
        ...cliente,
        nombre: editNombre.trim(),
        municipio: editMunicipio.trim(),
        localidad: editLocalidad.trim(),
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
        <label className="block text-sm text-slate-300 mb-2">
          Buscar cliente por ID WISP
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={idWisp}
            onChange={(e) => setIdWisp(e.target.value)}
            placeholder="Ej. 12594"
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {cliente && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 overflow-hidden">
          <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Cliente encontrado</h3>
            {!editando ? (
              <div className="flex gap-1.5">
                <button
                  onClick={eliminarCliente}
                  disabled={deleting}
                  className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/20 rounded-lg transition-colors"
                >
                  {deleting ? "Eliminando..." : "Eliminar"}
                </button>
                <button
                  onClick={iniciarEdicion}
                  className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                >
                  Editar
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={guardarCambios}
                  disabled={saving}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={cancelarEdicion}
                  className="px-3 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
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
              <EditableRow label="Municipio" value={editMunicipio} onChange={setEditMunicipio} />
            ) : (
              <InfoRow label="Municipio" value={cliente.municipio} />
            )}

            {editando ? (
              <EditableRow label="Localidad" value={editLocalidad} onChange={setEditLocalidad} />
            ) : (
              <InfoRow label="Localidad" value={cliente.localidad} />
            )}

            <InfoRow
              label="NAP"
              value={napInfo ? `${napInfo.nombre} (${napInfo.id_nap})` : cliente.id_nap}
            />
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
        <div className="text-center py-8 text-slate-500 text-sm">
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
      <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// ── Info Row ──
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-slate-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-white font-medium">{value || "—"}</span>
    </div>
  );
}

// ── Tab Agregar NAP ──
function AgregarNapTab({ onSuccess }: { onSuccess: () => void }) {
  const [idNap, setIdNap] = useState("");
  const [nombre, setNombre] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [capacidad, setCapacidad] = useState("8");
  const [estadoTomodat, setEstadoTomodat] = useState("Activo");
  const [verificacion, setVerificacion] = useState("0");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);

  // Dropdowns
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [localidades, setLocalidades] = useState<string[]>([]);
  const [modoMunicipio, setModoMunicipio] = useState<"select" | "custom">("select");

  // Duplicate check
  const [napExiste, setNapExiste] = useState(false);
  const [checking, setChecking] = useState(false);

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
        setMsg({ type: "info", text: `NAP "${idNap}" ya existe. Puedes modificar sus datos.` });
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
        className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/50 p-5"
      >
        <h2 className="text-lg font-semibold">{napExiste ? "Editar NAP" : "Agregar NAP"}</h2>

        <div>
          <label className="block text-xs text-slate-400 mb-1">
            ID NAP (código)
            {checking && <span className="ml-2 text-slate-500 animate-pulse">verificando...</span>}
            {!checking && napExiste && <span className="ml-2 text-amber-400">ya existe</span>}
            {!checking && idNap.trim().length >= 2 && !napExiste && (
              <span className="ml-2 text-green-400">nuevo</span>
            )}
          </label>
          <input
            type="text"
            value={idNap}
            onChange={(e) => setIdNap(e.target.value.toUpperCase())}
            placeholder="Ej. ACT 201"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Nombre de la NAP</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. COL. CENTRO - ACT 201"
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Municipio
              <button
                type="button"
                onClick={() => {
                  setModoMunicipio(modoMunicipio === "select" ? "custom" : "select");
                  setMunicipio("");
                  setLocalidad("");
                }}
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                {modoMunicipio === "select" ? "+ nuevo" : "▾ existente"}
              </button>
            </label>
            {modoMunicipio === "select" ? (
              <select
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Localidad</label>
            {localidades.length > 0 && modoMunicipio === "select" ? (
              <select
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Capacidad (puertos)</label>
            <select
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white"
            >
              <option value="8">8</option>
              <option value="16">16</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Verificación</label>
            <input
              type="number"
              value={verificacion}
              onChange={(e) => setVerificacion(e.target.value)}
              min="0"
              className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Estado Tomodat</label>
          <select
            value={estadoTomodat}
            onChange={(e) => setEstadoTomodat(e.target.value)}
            className="w-full rounded-lg bg-slate-700 border border-slate-600 p-2 text-sm text-white"
          >
            <option value="Activo">Activo</option>
            <option value="Rojo">Rojo</option>
          </select>
        </div>

        {msg && (
          <div
            className={`text-sm p-2 rounded-lg ${
              msg.type === "error"
                ? "bg-red-900/50 text-red-300"
                : msg.type === "info"
                ? "bg-amber-900/50 text-amber-300"
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
          {loading ? "Guardando..." : napExiste ? "Actualizar NAP" : "Agregar NAP"}
        </button>
      </form>
    </div>
  );
}

// ── Tab Usuarios ──
function UsuariosTab({ usuarios }: { usuarios: Usuario[] }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-800/50 px-5 py-3 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-300">
            Usuarios de la plataforma ({usuarios.length})
          </h3>
        </div>
        {usuarios.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No hay usuarios registrados aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Creado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-slate-800 hover:bg-slate-900/50 transition-colors">
                  <td className="p-3 font-medium text-white">{u.email}</td>
                  <td className="p-3 text-slate-500 text-xs">{u.creado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
