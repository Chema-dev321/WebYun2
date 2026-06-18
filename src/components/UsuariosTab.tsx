import { useState } from "react";
import type { Usuario, Rol } from "@/lib/firestore";
import { updateUsuarioRol, toggleUsuarioHabilitado } from "@/lib/firestore";
import { useToast } from "./ToastContext";
import { useConfirm } from "./ToastContext";

export default function UsuariosTab({ usuarios }: { usuarios: Usuario[] }) {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
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

  const handleToggleHabilitado = async (u: Usuario) => {
    const accion = u.deshabilitado ? "habilitar" : "inhabilitar";
    const ok = await confirm(
      `¿Deseas ${accion} la cuenta de ${u.email}? ${
        u.deshabilitado
          ? "El usuario podrá volver a acceder."
          : "El usuario no podrá ingresar al sistema."
      }`
    );
    if (!ok) return;
    try {
      setUpdatingId(u.id);
      await toggleUsuarioHabilitado(u.id, !u.deshabilitado);
      showToast(
        u.deshabilitado ? "Cuenta habilitada" : "Cuenta inhabilitada",
        u.deshabilitado ? "success" : "error"
      );
    } catch (e) {
      console.error(e);
      showToast("Error al cambiar estado de la cuenta", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDownloadCSV = () => {
    if (usuarios.length === 0) return;
    
    // Headers
    const headers = ["ID", "Nombre", "Email", "Rol", "Estado", "Fecha Creación"];
    
    // Rows
    const rows = usuarios.map(u => [
      u.uid,
      u.nombre || "Sin nombre",
      u.email,
      u.rol,
      u.deshabilitado ? "Inhabilitado" : "Activo",
      u.creado
    ]);
    
    // Construir CSV
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n");
    
    // Descargar
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `usuarios_webyun_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-xl border border-(--hulux-border) bg-(--hulux-surface) shadow-(--hulux-shadow) overflow-hidden">
        <div className="bg-(--hulux-subtle) px-5 py-3 border-b border-(--hulux-border) flex items-center justify-between">
          <h3 className="text-sm font-semibold text-(--hulux-text)">
            Usuarios de la plataforma ({usuarios.length})
          </h3>
          {/* CSV_EXPORT_DISABLED
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.1)] border border-(--hulux-border) rounded-lg text-(--hulux-text) transition-colors"
          >
            <svg className="w-4 h-4 text-(--hulux-cyan)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Descargar CSV
          </button>
          CSV_EXPORT_DISABLED */}
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
                  <th className="p-3">Usuario</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Creado</th>
                  <th className="p-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const isDisabled = !!u.deshabilitado;
                  const isUpdating = updatingId === u.id;
                  return (
                    <tr
                      key={u.id}
                      className={`border-t border-(--hulux-border) transition-colors ${
                        isDisabled
                          ? "opacity-50 bg-[rgba(112,0,63,0.04)]"
                          : "hover:bg-[rgba(148,237,242,0.12)]"
                      }`}
                    >
                      {/* Usuario (Nombre + Email) */}
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${
                              isDisabled ? "bg-(--hulux-maroon)" : "bg-(--hulux-lime)"
                            }`}
                          />
                          <div>
                            <p className="font-semibold text-(--hulux-text)">
                              {u.nombre || "Sin nombre"}
                            </p>
                            <p className="text-xs text-(--hulux-text-muted)">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rol select */}
                      <td className="p-3">
                        <select
                          value={u.rol || "instalador"}
                          disabled={isUpdating || isDisabled}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as Rol)}
                          className="bg-(--hulux-bg) border border-(--hulux-border) text-(--hulux-text) text-sm rounded-lg focus:ring-(--hulux-cyan) focus:border-(--hulux-cyan) block w-full p-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="admin">Admin</option>
                          <option value="administracion">Administración</option>
                          <option value="sucursal">Sucursal</option>
                          <option value="supervisor">Supervisor</option>
                          <option value="soporte">Soporte</option>
                          <option value="infraestructura">Infraestructura</option>
                          <option value="instalador">Instalador</option>
                        </select>
                      </td>

                      {/* Estado badge */}
                      <td className="p-3">
                        {isDisabled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[rgba(112,0,63,0.12)] text-(--hulux-maroon-light) border border-[rgba(112,0,63,0.2)]">
                            🔒 Inhabilitado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[rgba(205,219,0,0.15)] text-(--hulux-text) border border-[rgba(205,219,0,0.3)]">
                            ✓ Activo
                          </span>
                        )}
                      </td>

                      {/* Fecha creación */}
                      <td className="p-3 text-(--hulux-text-muted) text-xs whitespace-nowrap">
                        {u.creado}
                      </td>

                      {/* Botón habilitar / inhabilitar */}
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleHabilitado(u)}
                          disabled={isUpdating}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isDisabled
                              ? "bg-[rgba(148,237,242,0.15)] hover:bg-[rgba(148,237,242,0.25)] text-(--hulux-text) border border-[rgba(148,237,242,0.3)]"
                              : "bg-[rgba(112,0,63,0.10)] hover:bg-[rgba(112,0,63,0.2)] text-(--hulux-maroon-light) border border-[rgba(112,0,63,0.25)]"
                          }`}
                        >
                          {isUpdating
                            ? "..."
                            : isDisabled
                            ? "🔓 Habilitar"
                            : "🔒 Inhabilitar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
