import * as SelectPrimitive from "@radix-ui/react-select";
import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";

interface SelectCustomProps {
  label: string;
  valor: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  ayuda?: string;
  error?: string;
  disabled?: boolean;
  /** Oculta la etiqueta visualmente pero la deja para lectores de
   * pantalla. Para layouts densos (una matriz) donde la columna ya dice
   * de quién es el control y repetirlo lo haría ilegible. */
  etiquetaOculta?: boolean;
  children: ReactNode;
  className?: string;
}

export function SelectCustom({
  label,
  valor,
  onChange,
  placeholder = "Selecciona…",
  ayuda,
  error,
  disabled = false,
  etiquetaOculta = false,
  children,
  className,
}: SelectCustomProps) {
  // El trigger de Radix es un `<button>`, no un `<select>`: un `<label>`
  // suelto al lado **no** lo nombra, ni siquiera con `htmlFor`. Sin este
  // `aria-labelledby`, un lector de pantalla anuncia "botón, Efectivo"
  // sin decir de qué campo — y en un formulario con tres selectores
  // seguidos (método, categoría, empleado) eso es indistinguible.
  const idEtiqueta = useId();
  const idAyuda = useId();

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        id={idEtiqueta}
        className={cn(
          "font-label-md text-label-md text-on-surface",
          etiquetaOculta && "sr-only",
        )}
      >
        {label}
      </label>
      <SelectPrimitive.Root value={valor} onValueChange={onChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          aria-labelledby={idEtiqueta}
          aria-describedby={ayuda || error ? idAyuda : undefined}
          className={cn(
            "inline-flex w-full items-center justify-between rounded-xl border bg-white py-3 pl-4 pr-3 font-body-md text-body-md text-on-surface outline-hidden transition-all",
            "placeholder:text-outline",
            "focus:border-menta focus:ring-2 focus:ring-menta/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
            error
              ? "border-error focus:border-error focus:ring-error/20"
              : "border-outline-variant",
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <Icon name="keyboard_arrow_down" className="text-[20px] text-outline" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className={cn(
              "z-70 max-h-[300px] w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-outline-variant bg-white shadow-card",
              "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
            )}
          >
            <SelectPrimitive.Viewport className="p-1.5">
              {children}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {error ? (
        <p id={idAyuda} className="flex items-center gap-2 font-caption text-caption text-error">
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

export function SelectItem({
  value,
  children,
  className,
  disabled = false,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Item
      value={value}
      disabled={disabled}
      className={cn(
        "relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 pr-8 font-body-md text-body-md text-on-surface outline-hidden transition-colors",
        "data-highlighted:bg-menta/10 data-highlighted:text-primary",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-3">
        <Icon name="check" className="text-[18px] text-menta" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <SelectPrimitive.Group>
      <SelectPrimitive.Label className="px-3 py-1.5 font-caption text-caption font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </SelectPrimitive.Label>
      {children}
    </SelectPrimitive.Group>
  );
}

export function SelectSeparator() {
  return <SelectPrimitive.Separator className="my-1 h-px bg-outline-variant" />;
}
