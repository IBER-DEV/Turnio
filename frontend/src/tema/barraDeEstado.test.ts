import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Se leen del disco y no con `?raw`: `design/` vive fuera de la raíz de
// Vite (es de la raíz del repo, compartido con la landing) y el servidor
// de desarrollo rechaza importar desde ahí — "Denied ID". Leerlos con
// `fs` es además lo correcto para lo que hace este test, que es comparar
// dos archivos fuente, no cargar un módulo.

/** El `theme-color` de `index.html` tiñe la barra de estado del sistema,
 * que en la app queda pegada al encabezado indigo. Es un literal en un
 * archivo HTML: ninguna utilidad de Tailwind lo genera y ningún token lo
 * alimenta, así que si alguien cambia el color de marca en
 * `design/tokens.css` esto se queda con el viejo **en silencio** — la app
 * sigue compilando y la franja de arriba simplemente deja de coincidir
 * con el encabezado.
 *
 * Es exactamente la deriva que ya pasó una vez entre la landing y la app
 * (ver el preámbulo de `design/tokens.css`), con la diferencia de que
 * aquella se veía en una pantalla completa y esta en una franja de 40px
 * que es fácil no mirar.
 */
describe("theme-color de la barra de estado", () => {
  it("es el mismo `--color-primary` que pinta el encabezado", () => {
    const raiz = join(process.cwd(), "..");
    const tokens = readFileSync(join(raiz, "design", "tokens.css"), "utf-8");
    const html = readFileSync(join(raiz, "frontend", "index.html"), "utf-8");

    const primary = /--color-primary:\s*(#[0-9a-fA-F]{3,8});/.exec(tokens)?.[1];
    const themeColor = /<meta name="theme-color" content="(#[0-9a-fA-F]{3,8})"/.exec(html)?.[1];

    expect(primary, "no se encontró --color-primary en design/tokens.css").toBeDefined();
    expect(themeColor, "no se encontró la meta theme-color en index.html").toBeDefined();
    expect(themeColor?.toLowerCase()).toBe(primary?.toLowerCase());
  });
});
