import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** `tailwind-merge` no conoce los tokens propios de `tailwind.config.js`,
 * así que hay que declararle los que generan conflicto entre sí. Sin
 * esto trataría `text-body-md` (tamaño) y `text-primary` (color) como
 * grupos distintos por adivinanza, y podría no resolver bien un
 * `text-headline-md` sobreescrito por `text-body-lg`. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-lg",
            "headline-lg",
            "headline-lg-mobile",
            "headline-md",
            "headline-md-mobile",
            "body-lg",
            "body-md",
            "label-md",
            "caption",
          ],
        },
      ],
      "font-family": [
        {
          font: [
            "display-lg",
            "headline-lg",
            "headline-lg-mobile",
            "headline-md",
            "body-lg",
            "body-md",
            "label-md",
            "caption",
          ],
        },
      ],
    },
  },
});

/** Une clases condicionales y resuelve conflictos de Tailwind, para que
 * la clase pasada por `className` gane siempre sobre la que trae el
 * componente por dentro (antes ganaba la que Tailwind emitiera de
 * último en el CSS, que no es controlable desde el call site: un
 * `<Button className="px-2">` sobre un botón con `px-4` era una
 * apuesta, no una sobreescritura). */
export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases));
}
