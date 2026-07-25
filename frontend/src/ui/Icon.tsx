import { cn } from "./cn";
import { ICONOS } from "./iconos.generated";
import type { NombreIcono } from "./iconos.generated";

export type { NombreIcono };

/** Icono de Material Symbols, inyectado como SVG inline.
 *
 * Antes esto era una fuente de iconos (`material-symbols/outlined.css`),
 * que costaba **3,96 MB de woff2** para dibujar ~30 glifos: peso muerto
 * permanente en el bundle Capacitor y un primer arranque lentísimo con
 * datos móviles. Ahora solo viajan los iconos que el código usa
 * (~11 kB en total), generados por `npm run iconos`.
 *
 * Efecto secundario bueno: el nombre está tipado. Con la fuente, un
 * icono mal escrito renderizaba el texto literal ("calendar_todai")
 * dentro de la UI y nadie se enteraba; ahora no compila.
 *
 * Siempre `aria-hidden`: los iconos acompañan texto o van dentro de un
 * control que ya trae su propia etiqueta accesible. Si un icono queda
 * como única pista de una acción, el control que lo envuelve debe
 * llevar `aria-label`.
 *
 * El tamaño se hereda de `font-size` (`1em`), para que las clases de
 * texto existentes (`text-[20px]`, `text-[32px]`) sigan funcionando
 * igual que cuando era una fuente. */
export function Icon({
  name,
  className,
  filled = false,
}: {
  name: NombreIcono;
  className?: string;
  filled?: boolean;
}) {
  const clave = filled && `${name}--fill` in ICONOS ? `${name}--fill` : name;
  const contenido = ICONOS[clave as keyof typeof ICONOS];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={cn("inline-block h-[1em] w-[1em] shrink-0 align-middle text-[24px]", className)}
      dangerouslySetInnerHTML={{ __html: contenido }}
    />
  );
}
