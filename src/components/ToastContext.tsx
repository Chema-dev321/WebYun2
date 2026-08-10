"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

/** Tipo de notificación Toast ('success' para éxito, 'error' para errores, 'info' para avisos) */
type ToastType = "success" | "error" | "info";

/** Estructura interna de un elemento Toast */
interface Toast {
  /** ID autoincremental único del toast */
  id: number;
  /** Mensaje de texto a desplegar */
  message: string;
  /** Categoría visual del toast */
  type: ToastType;
}

/** Estructura del Contexto de Toast y Confirmaciones */
interface ToastContextType {
  /** Muestra un Toast flotante temporal */
  showToast: (message: string, type?: ToastType) => void;
  /** Abre un modal interactivo de confirmación basado en una Promesa (devuelve `true` si se confirma, `false` si se cancela) */
  confirm: (message: string) => Promise<boolean>;
}

/** Contexto React para Notificaciones y Modales de Confirmación */
const ToastContext = createContext<ToastContextType | undefined>(undefined);

/** Contador secuencial de IDs para los toasts creados */
let toastId = 0;

/**
 * Proveedor `ToastProvider`.
 *
 * Administra y renderiza en pantalla:
 * 1. Notificaciones flotantes temporales (toasts) que desaparecen tras 4 segundos.
 * 2. Modales asíncronos de confirmación interactiva.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  /**
   * Despliega una notificación flotante de tipo Toast.
   */
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Muestra un diálogo emergente de confirmación interactivo.
   * @returns Promesa que se resuelve con `true` al presionar 'Confirmar' o `false` al presionar 'Cancelar' o fondo.
   */
  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  /** Mapeo de clases CSS según el tipo de Toast */
  const bgMap: Record<ToastType, string> = {
    success: "bg-[rgba(205,219,0,0.90)] text-(--hulux-blue)",
    error: "bg-[rgba(112,0,63,0.90)] text-white",
    info: "bg-[rgba(17,41,62,0.90)] text-white dark:bg-[rgba(30,41,59,0.95)]",
  };

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* Notificaciones flotantes (Toasts) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto animate-[slideIn_200ms_ease-out] ${bgMap[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Diálogo Modal de Confirmación */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => {
              confirmState.resolve(false);
              setConfirmState(null);
            }}
          />
          <div className="relative bg-(--hulux-surface) border border-(--hulux-border) shadow-(--hulux-shadow) rounded-2xl p-6 max-w-sm w-full">
            <p className="text-(--hulux-text) text-sm mb-5">{confirmState.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs bg-(--hulux-surface) hover:bg-[rgba(148,237,242,0.18)] text-(--hulux-text) border border-(--hulux-border) rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className="px-4 py-2 text-xs bg-(--hulux-maroon) hover:brightness-110 text-white rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

/**
 * Hook para disparar notificaciones flotantes tipo Toast.
 * @throws Error si se invoca fuera de un `ToastProvider`.
 */
export function useToast(): Omit<ToastContextType, "confirm"> {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe ser utilizado dentro de un ToastProvider");
  return { showToast: ctx.showToast };
}

/**
 * Hook para solicitar confirmaciones interactivas mediante un modal emergente.
 * @throws Error si se invoca fuera de un `ToastProvider`.
 */
export function useConfirm(): Pick<ToastContextType, "confirm"> {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useConfirm debe ser utilizado dentro de un ToastProvider");
  return { confirm: ctx.confirm };
}

