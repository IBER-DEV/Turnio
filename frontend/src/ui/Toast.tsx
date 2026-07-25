import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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

/** Feedback de éxito/error tras crear, editar o borrar algo. Se ubican
 * arriba-centro en móvil (lejos del pulgar y de la bottom nav) y
 * abajo-derecha en escritorio. */
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

  // Sin esto, un toast disparado justo antes de desmontar el provider
  // deja un timer vivo apuntando a un componente que ya no existe.
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
              "pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-lg px-4 py-3 font-body-md text-body-md shadow-card",
              // Entra desde arriba en móvil (donde se ancla) y desde
              // abajo en escritorio, siguiendo su propia posición.
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
