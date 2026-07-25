import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";

type TipoToast = "exito" | "error" | "info";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

const ESTILOS: Record<TipoToast, { icono: string; clases: string }> = {
  exito: { icono: "check_circle", clases: "bg-primary text-on-primary" },
  error: { icono: "error", clases: "bg-error text-on-error" },
  info: { icono: "info", clases: "bg-inverse-surface text-inverse-on-surface" },
};

const ToastContext = createContext<{ mostrar: (tipo: TipoToast, mensaje: string) => void } | null>(
  null,
);

/** Feedback de éxito/error tras crear, editar o borrar algo — el
 * diseño los ubica arriba-centro en móvil y abajo-derecha en
 * escritorio (DESIGN.md § Toasts). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((tipo: TipoToast, mensaje: string) => {
    const id = Date.now() + Math.random();
    setToasts((actual) => [...actual, { id, tipo, mensaje }]);
    setTimeout(() => {
      setToasts((actual) => actual.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 p-margin-mobile safe-top sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-lg px-4 py-3 font-body-md text-body-md shadow-card",
              ESTILOS[toast.tipo].clases,
            )}
          >
            <Icon name={ESTILOS[toast.tipo].icono} className="shrink-0" />
            <span className="flex-1">{toast.mensaje}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return contexto;
}
