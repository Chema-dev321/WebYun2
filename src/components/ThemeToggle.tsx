"use client";

import { useEffect, useState } from "react";

/** Tipo de tema visual ('light' para modo claro, 'dark' para modo oscuro) */
type Theme = "light" | "dark";

/** Clave de almacenamiento en localStorage para recordar el tema seleccionado */
const STORAGE_KEY = "webyun-theme";

/**
 * Detecta el tema preferido del sistema operativo/navegador mediante media query.
 */
function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Aplica el tema al elemento raíz `<html>` mediante el atributo `data-theme` y lo guarda en `localStorage`.
 * @param theme Tema visual a aplicar.
 */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Si localStorage está bloqueado por el navegador, se ignora
  }
}

/**
 * Componente `ThemeToggle`.
 *
 * Renderiza un botón interactivo para conmutar entre el modo claro y oscuro del tema visual de la aplicación.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  // Efecto: Recupera la preferencia guardada en localStorage o la del sistema operativo al montar el componente
  useEffect(() => {
    let stored: Theme | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {
      // Ignorar errores de acceso
    }
    const initial = stored ?? getSystemTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  /**
   * Conmuta el tema actual entre claro y oscuro.
   */
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
      }
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-(--hulux-border) bg-(--hulux-surface) text-(--hulux-text) hover:bg-[rgba(148,237,242,0.18)] transition-colors"
    >
      {theme === "dark" ? (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

