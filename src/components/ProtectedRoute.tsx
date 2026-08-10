"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Componente `ProtectedRoute`.
 *
 * Envoltorio HOC (Higher-Order Component) que verifica el estado de autenticación del usuario.
 * Redirige automáticamente al `/login` si no existe una sesión activa y muestra un spinner de carga mientras valida.
 */
export default function ProtectedRoute({
  children,
}: {
  /** Contenido protegido a renderizar si el usuario está autenticado */
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  /** Ref para garantizar que la redirección a `/login` ocurra una sola vez */
  const redirected = useRef(false);

  // Efecto: Redirige a /login si terminó la carga y no hay usuario autenticado
  useEffect(() => {
    if (!loading && !user && !redirected.current) {
      redirected.current = true;
      try {
        router.replace("/login");
      } catch {
        window.location.href = "/login";
      }
    }
  }, [user, loading, router]);

  // Pantalla de carga mientras se verifica el estado de autenticación
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--hulux-bg)">
        <div className="flex items-center gap-3 text-(--hulux-text-muted)">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Cargando...
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, no renderiza nada mientras completa la redirección
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

