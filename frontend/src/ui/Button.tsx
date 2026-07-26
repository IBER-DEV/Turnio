import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";
import type { NombreIcono } from "./Icon";

type Variante = "primary" | "secondary" | "accent" | "danger" | "ghost";
type Tamano = "sm" | "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  primary: "bg-menta text-white hover:bg-menta-oscura shadow-suave",
  secondary: "border border-menta/30 bg-menta/5 text-menta hover:bg-menta/10",
  accent: "bg-primary text-on-primary hover:bg-primary-container",
  danger: "border border-error/30 bg-error/5 text-error hover:bg-error/10",
  ghost: "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
};

const TAMANOS: Record<Tamano, string> = {
  // 36px: por debajo del objetivo táctil de 44px, así que se reserva para
  // acciones secundarias dentro de una tarjeta ya densa (las de una cita),
  // no para acciones principales.
  sm: "min-h-[36px] px-3 py-1.5",
  md: "min-h-[44px] px-5 py-2.5",
  lg: "min-h-[52px] px-7 py-3.5",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  icono?: NombreIcono;
  cargando?: boolean;
  anchoCompleto?: boolean;
  children?: ReactNode;
}

export function Button({
  variante = "primary",
  tamano = "md",
  icono,
  cargando = false,
  anchoCompleto = false,
  className,
  children,
  disabled,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "tactile inline-flex items-center justify-center gap-2 rounded-xl font-label-md text-label-md transition-all",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTES[variante],
        TAMANOS[tamano],
        anchoCompleto && "w-full",
        className,
      )}
      disabled={disabled || cargando}
      {...props}
    >
      {cargando ? (
        <Icon name="progress_activity" className="animate-spin text-[20px]" />
      ) : (
        icono && <Icon name={icono} className="text-[20px]" />
      )}
      {children}
    </button>
  );
}
