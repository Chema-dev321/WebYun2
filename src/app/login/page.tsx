"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginPage() {
  const { login, register, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recordar, setRecordar] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedEmail = localStorage.getItem("webyun_email");
      if (savedEmail) setEmail(savedEmail);
      
      const savedRecordar = localStorage.getItem("webyun_recordar") === "true";
      setRecordar(savedRecordar);
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await loginWithGoogle();
      try {
        router.push("/");
      } catch {
        window.location.href = "/";
      }
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : String(err);
      if (code.includes("auth/popup-closed-by-user")) {
        setError("Inicio de sesión cancelado.");
      } else if (code.includes("auth/configuration-not-found")) {
        setError("Google no está habilitado en Firebase. Configúralo en Firebase Console.");
      } else if (code.includes("auth/popup-blocked")) {
        setError("El navegador bloqueó la ventana de Google. Permite ventanas emergentes.");
      } else {
        setError(code);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password);
      } else {
        await login(email, password);
      }
      if (typeof window !== "undefined") {
        if (recordar) {
          localStorage.setItem("webyun_email", email);
          localStorage.setItem("webyun_recordar", "true");
        } else {
          localStorage.removeItem("webyun_email");
          localStorage.removeItem("webyun_recordar");
        }
      }
      try {
        router.push("/");
      } catch {
        window.location.href = "/";
      }
    } catch (err: unknown) {
      const code = err instanceof Error ? err.message : String(err);
      if (code.includes("auth/email-already-in-use")) {
        setError("Este correo ya está registrado");
      } else if (code.includes("auth/invalid-credential")) {
        setError("Correo o contraseña incorrectos");
      } else if (code.includes("auth/weak-password")) {
        setError("La contraseña debe tener al menos 6 caracteres");
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hulux-bg)] px-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--hulux-surface)] border border-[var(--hulux-border)] shadow-[var(--hulux-shadow)] rounded-2xl p-8 relative">
          <div className="absolute top-4 right-4">
            <ThemeToggle />
          </div>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[var(--hulux-text)]">WebYun</h1>
            <p className="text-[var(--hulux-text-muted)] text-sm mt-1">
              {isRegister ? "Crea tu cuenta" : "Inicia sesión para continuar"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--hulux-text)] mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-[var(--hulux-text)] placeholder-[var(--hulux-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)] focus:border-transparent"
                placeholder="tu@correo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--hulux-text)] mb-1.5">
                Contraseña
              </label>
              <div className="relative">
              <input
                type={verPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 bg-[var(--hulux-surface)] border border-[var(--hulux-border)] rounded-lg text-[var(--hulux-text)] placeholder-[var(--hulux-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--hulux-blue)] focus:border-transparent pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--hulux-text-muted)] hover:text-[var(--hulux-text)]"
                tabIndex={-1}
              >
                {verPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
               </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-[var(--hulux-text-muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="rounded border-[var(--hulux-border)] bg-[var(--hulux-surface)] text-[var(--hulux-orange)] focus:ring-[var(--hulux-blue)] focus:ring-offset-0"
                />
                Recordarme
              </label>
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                className="text-[var(--hulux-text-muted)] hover:text-[var(--hulux-text)]"
              >
                {verPassword ? "Ocultar contraseña" : "Ver contraseña"}
              </button>
            </div>

            {error && (
              <div className="bg-[rgba(112,0,63,0.08)] border border-[rgba(112,0,63,0.22)] text-[var(--hulux-maroon)] text-sm px-4 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[var(--hulux-orange)] hover:brightness-95 disabled:opacity-50 text-[var(--hulux-blue)] font-semibold rounded-lg transition-colors"
            >
              {loading
                ? "Procesando..."
                : isRegister
                ? "Crear cuenta"
                : "Iniciar sesión"}
            </button>
          </form>

          <div className="mt-4">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--hulux-border)]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[var(--hulux-surface)] px-2 text-[var(--hulux-text-muted)]">o continúa con</span>
              </div>
            </div>
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 bg-[var(--hulux-surface)] hover:bg-[rgba(148,237,242,0.18)] disabled:opacity-50 text-[var(--hulux-blue)] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 border border-[var(--hulux-border)]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-sm text-[var(--hulux-text-muted)] hover:text-[var(--hulux-maroon)] transition-colors"
            >
              {isRegister
                ? "¿Ya tienes cuenta? Inicia sesión"
                : "¿No tienes cuenta? Regístrate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
