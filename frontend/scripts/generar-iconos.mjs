/**
 * Genera `src/ui/iconos.generated.ts` con solo los iconos que el código
 * usa de verdad, extraídos de `@material-symbols/svg-400`.
 *
 * Por qué existe: antes se cargaba la fuente completa de Material
 * Symbols (3,96 MB de woff2) para dibujar ~30 iconos. En un negocio con
 * datos móviles eso es un primer arranque inaceptable, y en el bundle
 * Capacitor es peso muerto permanente.
 *
 * Uso: `npm run iconos` — se corre a mano cuando se agrega un icono
 * nuevo. No hace falta en cada build: el archivo generado se commitea,
 * y si alguien usa un icono que no está, TypeScript falla en compilación
 * (con la fuente, en cambio, se renderizaba el texto literal
 * "calendar_today" dentro de la UI y nadie se enteraba hasta verlo).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "..");
const SRC = join(RAIZ, "src");
const ORIGEN = join(RAIZ, "node_modules/@material-symbols/svg-400/outlined");
const DESTINO = join(SRC, "ui/iconos.generated.ts");

/** Iconos que se piden con `filled` (hoy: la barra de navegación). */
const CON_RELLENO = ["dashboard", "calendar_today", "content_cut", "group"];

/** Recorre `src/` y saca los nombres de icono usados.
 *
 * Se captura el valor completo del atributo —incluyendo `{...}`— y de
 * ahí se sacan todas las cadenas. Así entra también el caso de los
 * ternarios (`name={activo ? "person_off" : "person_check"}`), que una
 * regex de `name="..."` a secas se perdía. */
function iconosUsados() {
  const nombres = new Set();
  // name= / icono= como prop JSX, o icono: como clave de objeto.
  const contextos = /\b(?:name|icono)\s*[=:]\s*(\{[^}]*\}|"[^"]*")/g;

  const pila = [SRC];
  while (pila.length > 0) {
    const dir = pila.pop();
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        pila.push(ruta);
        continue;
      }
      if (!/\.tsx?$/.test(entrada.name)) continue;
      if (entrada.name.endsWith(".generated.ts")) continue;
      const contenido = readFileSync(ruta, "utf8");
      for (const [, valor] of contenido.matchAll(contextos)) {
        for (const [, nombre] of valor.matchAll(/"([a-z][a-z0-9_]*)"/g)) {
          nombres.add(nombre);
        }
      }
    }
  }
  return [...nombres].sort();
}

/** Extrae solo el contenido interno del <svg> (los <path>), que es lo
 * que se inyecta; el wrapper lo pone el componente. */
function cuerpoSvg(archivo) {
  const svg = readFileSync(archivo, "utf8");
  const interno = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return interno.trim();
}

const disponibles = new Set(readdirSync(ORIGEN));
const candidatos = iconosUsados();
const entradas = [];
const descartados = [];

for (const nombre of candidatos) {
  // `name=` también aparece en inputs de formulario (`name="email"`), así
  // que lo que no corresponde a un SVG real simplemente no es un icono.
  // No se falla acá: si alguien escribió mal un nombre de icono, el que
  // avisa es TypeScript al compilar, que además señala el archivo y la
  // línea exactos.
  if (!disponibles.has(`${nombre}.svg`)) {
    descartados.push(nombre);
    continue;
  }
  entradas.push([nombre, cuerpoSvg(join(ORIGEN, `${nombre}.svg`))]);

  if (CON_RELLENO.includes(nombre) && disponibles.has(`${nombre}-fill.svg`)) {
    entradas.push([`${nombre}--fill`, cuerpoSvg(join(ORIGEN, `${nombre}-fill.svg`))]);
  }
}

const cuerpo = entradas
  .map(([nombre, svg]) => `  ${JSON.stringify(nombre)}: ${JSON.stringify(svg)},`)
  .join("\n");

const salida = `// GENERADO POR scripts/generar-iconos.mjs — NO EDITAR A MANO.
// Regenerar con: npm run iconos
//
// Contiene solo los iconos que el código usa. Si agregas un <Icon
// name="..."> con un icono nuevo, TypeScript va a fallar hasta que
// corras \`npm run iconos\`.

export const ICONOS = {
${cuerpo}
} as const;

/** Solo los nombres públicos: las variantes \`--fill\` son internas
 * del componente Icon y no se piden por nombre. */
export type NombreIcono = Exclude<keyof typeof ICONOS, \`\${string}--fill\`>;
`;

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, salida);

const kb = Buffer.byteLength(salida) / 1024;
console.log(`✓ ${entradas.length} iconos → src/ui/iconos.generated.ts (${kb.toFixed(1)} kB)`);
if (descartados.length > 0) {
  console.log(`  (ignoradas ${descartados.length} cadenas que no son iconos: ${descartados.join(", ")})`);
}
