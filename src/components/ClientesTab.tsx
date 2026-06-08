"use client";

import { useEffect, useState, useMemo } from "react";
import type { NAP, Cliente } from "@/lib/types";

export default function ClientesTab({ naps }: { naps: NAP[] }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [search, setSearch] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const municipios = useMemo(() => {
    const set = new Set(clientes.map((c) => c.municipio));
    return Array.from(set).sort();
  }, [clientes]);

  const localidades = useMemo(() => {
    if (!municipio) return [];
    const set = new Set(
      clientes.filter((c) => c.municipio === municipio).map((c) => c.localidad)
    );
    return Array.from(set).sort();
  }, [clientes, municipio]);

  useEffect(() => {
    let unsubs = () => {};
    import("@/lib/firestore").then(({ subscribeToClientes }) => {
      unsubs = subscribeToClientes((data) => {
        setClientes(data);
        setLoadingClientes(false);
      });
    });
    return () => unsubs();
  }, []);

  const filtered = useMemo(() => {
    let result = clientes;

    if (municipio) {
      result = result.filter((c) => c.municipio === municipio);
    }
    if (localidad) {
      result = result.filter((c) => c.localidad === localidad);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          c.id_wisp.toLowerCase().includes(q) ||
          c.id_nap.toLowerCase().includes(q)
      );
    }
    return result;
  }, [clientes, search, municipio, localidad]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      {/* ── Filter bar (Collapsible on mobile) ── */}
      <details className="group rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) [&:not([open])_.content]:hidden sm:[&:not([open])_.content]:block" open>
        <summary className="p-4 text-[13px] font-semibold text-(--hulux-text) cursor-pointer sm:hidden flex items-center justify-between list-none">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros y Búsqueda
          </div>
          <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-(--hulux-text-muted)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        
        <div className="content p-4 pt-0 sm:pt-4 flex flex-wrap items-end gap-3 border-t border-(--hulux-border) sm:border-0">
          <div className="relative flex-1 min-w-[200px]">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Buscar</label>
            <svg
              className="absolute left-3 top-[34px] -translate-y-1/2 h-4 w-4 text-(--hulux-text-muted)"
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
              placeholder="Buscar por nombre, ID WISP, NAP..."
              className="w-full pl-10 pr-4 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            />
          </div>

          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Municipio</label>
            <select
              value={municipio}
              onChange={(e) => {
                setMunicipio(e.target.value);
                setLocalidad("");
                setPage(0);
              }}
              className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todos</option>
              {municipios.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[140px] sm:flex-none">
            <label className="block text-xs text-(--hulux-text-muted) mb-1">Localidad</label>
            <select
              value={localidad}
              onChange={(e) => {
                setLocalidad(e.target.value);
                setPage(0);
              }}
              disabled={!municipio}
              className="w-full sm:w-auto px-3 py-2 bg-(--hulux-surface-elevated) border border-(--hulux-border) rounded-lg text-sm text-(--hulux-text) disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
            >
              <option value="">Todas</option>
              {localidades.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-(--hulux-text-muted) mb-3 whitespace-nowrap ml-auto">
            {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </details>

      {loadingClientes ? (
        <div className="text-center py-12 text-(--hulux-text-muted)">Cargando lista de clientes...</div>
      ) : paged.length === 0 ? (
        <div className="text-center py-12 text-(--hulux-text-muted)">
          {search ? "Sin resultados." : "No hay clientes registrados."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow)">
          <table className="w-full text-left text-sm table-zebra">
            <thead className="bg-(--hulux-subtle) text-(--hulux-text) text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">ID WISP</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">Municipio</th>
                <th className="p-3">NAP</th>
                <th className="p-3">Localidad</th>
                <th className="p-3">Fecha Alta</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c) => {
                const nap = naps.find((n) => n.id === c.id_nap);
                return (
                  <tr
                    key={c.id}
                    className="border-t border-(--hulux-border) hover:bg-[rgba(148,237,242,0.12)] transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-(--hulux-text) font-bold">{c.id_wisp}</td>
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3 text-(--hulux-text)">{c.municipio}</td>
                    <td className="p-3 text-(--hulux-text-muted) text-xs">
                      {nap ? nap.id_nap : c.id_nap}
                    </td>
                    <td className="p-3 text-(--hulux-text)">{c.localidad}</td>
                    <td className="p-3 text-(--hulux-text-muted) text-xs">{c.fecha_alta}</td>
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
                className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-(--hulux-text-muted)">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-(--hulux-text) border border-(--hulux-border) transition-colors"
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
