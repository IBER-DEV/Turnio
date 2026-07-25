import { useId } from "react";

import { cn } from "./cn";

/** Switch de la matriz de capacidades (DESIGN.md § Components):
 * encendido en índigo primario, apagado en gris claro. */
export function Switch({
  checked,
  onChange,
  label,
  descripcion,
  disabled = false,
}: {
  checked: boolean;
  onChange: (valor: boolean) => void;
  /** Etiqueta accesible; se muestra si se pasa `descripcion`. */
  label: string;
  descripcion?: string;
  disabled?: boolean;
}) {
  const id = useId();

  const control = (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={descripcion ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-primary" : "bg-outline-variant",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );

  if (!descripcion) return control;

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
