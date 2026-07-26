import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";
import type { NombreIcono } from "./Icon";

type TipoToast = "exito" | "error" | "info";

interface Toast {
  id: number;
  tipo: TipoToast;
  mensaje: string;
}

const ESTILOS: Record<TipoToast, { icono: NombreIcono; clases: string }> = {
  exito: { icono: "check_circle", clases: "bg-menta text-white" },
  error: { icono: "error", clases: "bg-error text-on-error" },
  info: { icono: "info", clases: "bg-primary text-on-primary" },
};

const ToastContext = createContext<{ mostrar: (tipo: TipoToast, mensaje: string) => void } | null>(
  null,
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const temporizadores = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const mostrar = useCallback((tipo: TipoToast, mensaje: string) => {
    const id = Date.now() + Math.random();
    setToasts((actual) => [...actual, { id, tipo, mensaje }]);

    const temporizador = setTimeout(() => {
      setToasts((actual) => actual.filter((toast) => toast.id !== id));
      temporizadores.current.delete(temporizador);
    }, 4000);
    temporizadores.current.add(temporizador);
  }, []);

  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => {
      pendientes.forEach(clearTimeout);
      pendientes.clear();
    };
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
              "pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-xl px-5 py-3.5 font-body-md text-body-md shadow-card",
              "animate-slide-in-top sm:animate-slide-in-bottom",
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
