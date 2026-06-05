"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    resolve: (v: boolean) => void;
  } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }, []);

  const bgMap: Record<ToastType, string> = {
    success: "bg-[rgba(205,219,0,0.90)] text-(--hulux-blue)",
    error: "bg-[rgba(112,0,63,0.90)] text-white",
    info: "bg-[rgba(17,41,62,0.90)] text-white dark:bg-[rgba(30,41,59,0.95)]",
  };

  return (
    <ToastContext.Provider value={{ showToast, confirm }}>
      {children}

      {/* Toasts */}
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

      {/* Confirm dialog */}
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

export function useToast(): Omit<ToastContextType, "confirm"> {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return { showToast: ctx.showToast };
}

export function useConfirm(): Pick<ToastContextType, "confirm"> {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useConfirm must be used within ToastProvider");
  return { confirm: ctx.confirm };
}
