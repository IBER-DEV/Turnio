import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";
import type { NombreIcono } from "./Icon";

type Variante = "primary" | "secondary" | "accent" | "danger" | "ghost";
type Tamano = "md" | "lg";

const VARIANTES: Record<Variante, string> = {
  // Fondo índigo profundo + texto blanco.
  primary: "bg-primary text-on-primary hover:bg-primary-container shadow-sm",
  // Fondo transparente + borde 1px índigo.
  secondary: "border border-primary text-primary hover:bg-surface-container",
  // Terracota-oro: acciones destacadas no destructivas (ej. Confirmar).
  accent: "bg-secondary-container text-on-secondary-container hover:brightness-95",
  danger: "border border-error text-error hover:bg-error-container",
  ghost: "text-on-surface-variant hover:bg-surface-container",
};

const TAMANOS: Record<Tamano, string> = {
  // min-h 44px: objetivo táctil mínimo del sistema de diseño.
  md: "min-h-[44px] px-4 py-2",
  lg: "min-h-[52px] px-6 py-4",
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
        "tactile inline-flex items-center justify-center gap-2 rounded-lg font-label-md text-label-md transition-colors",
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
