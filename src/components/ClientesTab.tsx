"use client";

import { useEffect, useState, useMemo } from "react";
import type { NAP, Cliente } from "@/lib/types";

export default function ClientesTab({ naps }: { naps: NAP[] }) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

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
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.id_wisp.toLowerCase().includes(q) ||
        c.municipio.toLowerCase().includes(q) ||
        c.localidad.toLowerCase().includes(q) ||
        c.id_nap.toLowerCase().includes(q)
    );
  }, [clientes, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hulux-text-muted)]"
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
            placeholder="Buscar por nombre, ID WISP, NAP, municipio..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-sm text-[var(--hulux-text)] placeholder-[var(--hulux-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)]"
          />
        </div>
        <span className="text-xs text-[var(--hulux-text-muted)]">
          {filtered.length} cliente{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {loadingClientes ? (
        <div className="text-center py-12 text-[var(--hulux-text-muted)]">Cargando lista de clientes...</div>
      ) : paged.length === 0 ? (
        <div className="text-center py-12 text-[var(--hulux-text-muted)]">
          {search ? "Sin resultados." : "No hay clientes registrados."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--hulux-border)] bg-[var(--hulux-surface)] shadow-[var(--hulux-shadow)]">
          <table className="w-full text-left text-sm table-zebra">
            <thead className="bg-[var(--hulux-subtle)] text-[var(--hulux-text)] text-xs uppercase tracking-wider">
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
                    className="border-t border-[var(--hulux-border)] hover:bg-[rgba(148,237,242,0.12)] transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-[var(--hulux-text)] font-bold">{c.id_wisp}</td>
                    <td className="p-3 font-medium">{c.nombre}</td>
                    <td className="p-3 text-[var(--hulux-text)]">{c.municipio}</td>
                    <td className="p-3 text-[var(--hulux-text-muted)] text-xs">
                      {nap ? nap.id_nap : c.id_nap}
                    </td>
                    <td className="p-3 text-[var(--hulux-text)]">{c.localidad}</td>
                    <td className="p-3 text-[var(--hulux-text-muted)] text-xs">{c.fecha_alta}</td>
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
                className="px-3 py-1.5 text-xs bg-[var(--hulux-surface)] hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-[var(--hulux-text)] border border-[var(--hulux-border)] transition-colors"
              >
                Anterior
              </button>
              <span className="text-xs text-[var(--hulux-text-muted)]">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 text-xs bg-[var(--hulux-surface)] hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-30 rounded-lg text-[var(--hulux-text)] border border-[var(--hulux-border)] transition-colors"
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
