import { useId, useState } from "react";
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";
import type { NombreIcono } from "./Icon";

const BASE_CAMPO =
  "w-full rounded-xl border border-outline-variant bg-white py-3 font-body-md text-body-md text-on-surface outline-none transition-all placeholder:text-outline focus:border-menta focus:ring-2 focus:ring-menta/20";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icono?: NombreIcono;
  ayuda?: string;
  error?: string;
  accionLabel?: ReactNode;
}

export function Input({
  label,
  icono,
  ayuda,
  error,
  accionLabel,
  className,
  type = "text",
  id,
  ...props
}: InputProps) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;

  const [visible, setVisible] = useState(false);
  const esPassword = type === "password";
  const tipoReal = esPassword && visible ? "text" : type;

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex items-center justify-between gap-2">
        <label className="font-label-md text-label-md text-on-surface" htmlFor={idCampo}>
          {label}
        </label>
        {accionLabel}
      </div>

      <div className="group relative">
        {icono && (
          <Icon
            name={icono}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-menta"
          />
        )}
        <input
          id={idCampo}
          type={tipoReal}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
          className={cn(
            BASE_CAMPO,
            icono ? "pl-12" : "pl-4",
            esPassword ? "pr-12" : "pr-4",
            error && "border-error focus:border-error focus:ring-error/20",
            className,
          )}
          {...props}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors hover:text-menta"
          >
            <Icon name={visible ? "visibility_off" : "visibility"} />
          </button>
        )}
      </div>

      {error ? (
        <p id={idError} className="flex items-center gap-xs font-caption text-caption text-error">
          <Icon name="error" className="text-[18px]" />
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={idAyuda} className="font-caption text-caption text-on-surface-variant">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  ayuda?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, ayuda, error, className, id, children, ...props }: SelectProps) {
  const idGenerado = useId();
  const idCampo = id ?? idGenerado;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;

  return (
    <div className="flex flex-col gap-xs">
      <label className="font-label-md text-label-md text-on-surface" htmlFor={idCampo}>
        {label}
      </label>
      <select
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? idError : ayuda ? idAyuda : undefined}
        className={cn(BASE_CAMPO, "px-4", error && "border-error", className)}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={idError} className="flex items-center gap-xs font-caption text-caption text-error">
          <Icon name="error" className="text-[18px]" />
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={idAyuda} className="font-caption text-caption text-on-surface-variant">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}
