"use client";

import { useState } from "react";
import {
  updateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ToastContext";

interface Props {
  onClose: () => void;
}

export default function PerfilModal({ onClose }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();

  // Nombre
  const [nombre, setNombre] = useState(user?.displayName || "");
  const [savingNombre, setSavingNombre] = useState(false);

  // Contraseña
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleGuardarNombre = async () => {
    if (!nombre.trim()) {
      showToast("El nombre no puede estar vacío.", "error");
      return;
    }
    setSavingNombre(true);
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: nombre.trim() });
        const { updateUsuarioNombre } = await import("@/lib/firestore");
        await updateUsuarioNombre(auth.currentUser.uid, nombre.trim());
        showToast("Nombre actualizado correctamente.", "success");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al actualizar el nombre.", "error");
    } finally {
      setSavingNombre(false);
    }
  };

  const handleCambiarPassword = async () => {
    if (!passwordActual) {
      showToast("Ingresa tu contraseña actual.", "error");
      return;
    }
    if (passwordNueva.length < 6) {
      showToast("La nueva contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }
    if (passwordNueva !== passwordConfirm) {
      showToast("Las contraseñas nuevas no coinciden.", "error");
      return;
    }
    setSavingPass(true);
    try {
      if (!auth.currentUser?.email) throw new Error("Sin usuario");
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        passwordActual
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordNueva);
      showToast("Contraseña actualizada correctamente.", "success");
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirm("");
    } catch (err: unknown) {
      console.error("Password update error:", err);
      const msg =
        err instanceof Error && err.message.includes("wrong-password")
          ? "La contraseña actual es incorrecta."
          : err instanceof Error && err.message.includes("invalid-credential")
          ? "La contraseña actual es incorrecta."
          : err instanceof Error && err.message.includes("requires-recent-login")
          ? "Por seguridad, cierra sesión y vuelve a entrar para cambiar tu contraseña."
          : "Error al cambiar la contraseña.";
      showToast(msg, "error");
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-1000"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md z-1010 flex flex-col bg-(--hulux-surface) border-l border-(--hulux-border) shadow-2xl">
        {/* Header del panel */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--hulux-border) bg-(--hulux-subtle)">
          <div>
            <h2 className="text-base font-bold text-(--hulux-text)">Mi Perfil</h2>
            <p className="text-xs text-(--hulux-text-muted) mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[rgba(148,237,242,0.15)] text-(--hulux-text-muted) hover:text-(--hulux-text) transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">

          {/* Avatar / Inicial */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-linear-to-br from-(--hulux-blue) to-(--hulux-cyan) flex items-center justify-center text-white text-2xl font-bold shadow-lg select-none">
              {(user?.displayName || user?.email || "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-(--hulux-text)">
                {user?.displayName || "Sin nombre"}
              </p>
              <p className="text-xs text-(--hulux-text-muted)">{user?.email}</p>
            </div>
          </div>

          {/* ── Sección: Nombre ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-(--hulux-text-muted) mb-3">
              Nombre para mostrar
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre completo"
                className="w-full rounded-lg bg-(--hulux-surface-elevated) border border-(--hulux-border) px-3 py-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
              />
              <button
                onClick={handleGuardarNombre}
                disabled={savingNombre}
                className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-(--hulux-blue) hover:brightness-110 text-white transition-colors disabled:opacity-50"
              >
                {savingNombre ? "Guardando..." : "Guardar nombre"}
              </button>
            </div>
          </section>

          {/* Separador */}
          <div className="border-t border-(--hulux-border)" />

          {/* ── Sección: Contraseña ── */}
          <section>
            {user?.providerData.some(p => p.providerId === "google.com") ? (
              <div className="bg-[rgba(148,237,242,0.1)] border border-[rgba(148,237,242,0.2)] rounded-lg p-4 text-sm text-(--hulux-text-muted)">
                Iniciaste sesión con Google. No puedes cambiar tu contraseña desde aquí; hazlo directamente en tu cuenta de Google.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-(--hulux-text-muted)">
                    Cambiar contraseña
                  </h3>
                  <button
                    onClick={() => setShowPass((v) => !v)}
                    className="text-xs text-(--hulux-text-muted) hover:text-(--hulux-text) transition-colors"
                  >
                    {showPass ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-(--hulux-text-muted) mb-1">
                      Contraseña actual
                    </label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={passwordActual}
                      onChange={(e) => setPasswordActual(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg bg-(--hulux-surface-elevated) border border-(--hulux-border) px-3 py-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-(--hulux-text-muted) mb-1">
                      Nueva contraseña
                    </label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={passwordNueva}
                      onChange={(e) => setPasswordNueva(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-lg bg-(--hulux-surface-elevated) border border-(--hulux-border) px-3 py-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-(--hulux-text-muted) mb-1">
                      Confirmar nueva contraseña
                    </label>
                    <input
                      type={showPass ? "text" : "password"}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Repite la nueva contraseña"
                      className="w-full rounded-lg bg-(--hulux-surface-elevated) border border-(--hulux-border) px-3 py-2 text-sm text-(--hulux-text) placeholder-(--hulux-text-muted) focus:outline-none focus:ring-2 focus:ring-(--hulux-blue)"
                    />
                  </div>

                  {/* Indicador de seguridad */}
                  {passwordNueva.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              passwordNueva.length >= i * 3
                                ? i <= 1
                                  ? "bg-red-400"
                                  : i <= 2
                                  ? "bg-orange-400"
                                  : i <= 3
                                  ? "bg-yellow-400"
                                  : "bg-green-400"
                                : "bg-(--hulux-border)"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-(--hulux-text-muted)">
                        {passwordNueva.length < 6
                          ? "Muy corta"
                          : passwordNueva.length < 9
                          ? "Débil"
                          : passwordNueva.length < 12
                          ? "Aceptable"
                          : "Fuerte"}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleCambiarPassword}
                    disabled={savingPass}
                    className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-[rgba(112,0,63,0.12)] hover:bg-[rgba(112,0,63,0.22)] text-(--hulux-maroon-light) border border-[rgba(112,0,63,0.25)] transition-colors disabled:opacity-50"
                  >
                    {savingPass ? "Cambiando..." : "Cambiar contraseña"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
