import type { Usuario } from "@/lib/firestore";

export default function UsuariosTab({ usuarios }: { usuarios: Usuario[] }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-xl border border-[var(--hulux-border)] bg-[var(--hulux-surface)] shadow-[var(--hulux-shadow)] overflow-hidden">
        <div className="bg-[var(--hulux-subtle)] px-5 py-3 border-b border-[var(--hulux-border)]">
          <h3 className="text-sm font-semibold text-[var(--hulux-text)]">
            Usuarios de la plataforma ({usuarios.length})
          </h3>
        </div>
        {usuarios.length === 0 ? (
          <div className="p-8 text-center text-[var(--hulux-text-muted)] text-sm">
            No hay usuarios registrados aún.
          </div>
        ) : (
          <table className="w-full text-left text-sm table-zebra">
            <thead className="bg-[var(--hulux-subtle)] text-[var(--hulux-text)] text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Creado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t border-[var(--hulux-border)] hover:bg-[rgba(148,237,242,0.12)] transition-colors">
                  <td className="p-3 font-semibold text-[var(--hulux-text)]">{u.email}</td>
                  <td className="p-3 text-[var(--hulux-text-muted)] text-xs">{u.creado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
