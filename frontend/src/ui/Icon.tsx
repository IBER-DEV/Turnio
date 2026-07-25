import { cn } from "./cn";

/** Icono de Material Symbols (fuente autoalojada, ver index.css).
 *
 * Siempre `aria-hidden`: los iconos del diseño acompañan texto o van
 * dentro de un control que ya trae su propia etiqueta accesible. Si un
 * icono queda solo como única pista de una acción, el control que lo
 * envuelve debe llevar `aria-label`. */
export function Icon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined", filled && "icon-fill", className)}
    >
      {name}
    </span>
  );
}
