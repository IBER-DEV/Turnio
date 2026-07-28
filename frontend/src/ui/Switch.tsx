import { useId } from "react";

import { cn } from "./cn";

/** Switch de capacidades / formularios. Encendido en menta. */
export function Switch({
  checked,
  onChange,
  label,
  descripcion,
  disabled = false,
  soloControl = false,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  /** Etiqueta (visible salvo `soloControl`). */
  label: string;
  descripcion?: string;
  disabled?: boolean;
  /** Solo el interruptor, sin etiqueta (útil cuando el contexto ya la muestra). */
  soloControl?: boolean;
}) {
  const id = useId();

  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={soloControl || descripcion ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-menta" : "bg-outline-variant",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );

  if (soloControl) return control;

  // Con descripción: etiqueta a la izquierda, switch a la derecha (matriz de permisos).
  if (descripcion) {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="max-w-[240px]">
          <label htmlFor={id} className="block cursor-pointer font-body-md font-medium text-primary">
            {label}
          </label>
          <p className="font-caption text-caption leading-tight text-on-surface-variant">
            {descripcion}
          </p>
        </div>
        {control}
      </div>
    );
  }

  // Solo etiqueta: switch + texto en línea (login, etc.).
  return (
    <div className="flex items-center gap-2.5">
      {control}
      <label htmlFor={id} className="cursor-pointer text-[14px] font-medium text-on-surface">
        {label}
      </label>
    </div>
  );
}
