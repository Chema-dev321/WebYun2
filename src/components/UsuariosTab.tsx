import { useState } from "react";
import type { Usuario, Rol } from "@/lib/firestore";
import { updateUsuarioRol } from "@/lib/firestore";
import { useToast } from "./ToastContext";

export default function UsuariosTab({ usuarios }: { usuarios: Usuario[] }) {
  const { showToast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleRoleChange = async (uid: string, newRole: Rol) => {
    try {
      setUpdatingId(uid);
      await updateUsuarioRol(uid, newRole);
      showToast("Rol actualizado", "success");
    } catch (e) {
      console.error(e);
      showToast("Error al actualizar rol", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
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
                  <th className="p-3">Rol</th>
                  <th className="p-3">Creado</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-(--hulux-border) hover:bg-[rgba(148,237,242,0.12)] transition-colors">
                    <td className="p-3 font-semibold text-(--hulux-text)">{u.email}</td>
                    <td className="p-3">
                      <select
                        value={u.rol || "instalador"}
                        disabled={updatingId === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Rol)}
                        className="bg-(--hulux-bg) border border-(--hulux-border) text-(--hulux-text) text-sm rounded-lg focus:ring-(--hulux-cyan) focus:border-(--hulux-cyan) block w-full p-1.5"
                      >
                        <option value="admin">Admin</option>
                        <option value="sucursal">Sucursal</option>
                        <option value="infraestructura">Infraestructura</option>
                        <option value="administracion">Administración</option>
                        <option value="instalador">Instalador</option>
                      </select>
                    </td>
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
