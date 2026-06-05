import type { Usuario } from "@/lib/firestore";

export default function UsuariosTab({ usuarios }: { usuarios: Usuario[] }) {
  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) overflow-hidden">
        <div className="bg-(--hulux-subtle) px-5 py-3 border-b border-(--hulux-border)">
          <h3 className="text-sm font-semibold text-(--hulux-text)">
            Usuarios de la plataforma ({usuarios.length})
          </h3>
        </div>
        {usuarios.length === 0 ? (
          <div className="p-8 text-center text-(--hulux-text-muted) text-sm">
            No hay usuarios registrados aún.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm table-zebra">
              <thead className="bg-(--hulux-subtle) text-(--hulux-text) text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3">Email</th>
                  <th className="p-3">Creado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-(--hulux-border) hover:bg-[rgba(148,237,242,0.12)] transition-colors">
                    <td className="p-3 font-semibold text-(--hulux-text)">{u.email}</td>
                    <td className="p-3 text-(--hulux-text-muted) text-xs">{u.creado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
