/** El color de marca del negocio, y las cuentas mínimas para usarlo bien.
 *
 * No hay librería de color acá **a propósito** (se evaluaron `chroma-js`
 * y `culori`). Todo lo que hace falta son dos cosas:
 *
 * 1. **Derivar tonos** (hover, fondo suave). Eso lo hace el navegador con
 *    `color-mix(in oklch, …)`, mejor de lo que lo haría una interpolación
 *    en sRGB y sin sumar un kilobyte al bundle.
 * 2. **Decidir si el texto encima va blanco o oscuro.** Eso sí necesita
 *    JavaScript, y son las veinte líneas de abajo: la fórmula de
 *    luminancia relativa de la WCAG, que está congelada desde 2008.
 *
 * Si algún día hace falta generar una escala completa 50–900, o convertir
 * entre espacios de color, ahí sí conviene una librería y esta decisión
 * se revisa (ver `DECISIONES.md`).
 */

/** El texto oscuro del sistema, para cuando el acento es claro. */
const TINTA = "#0f172a";
const BLANCO = "#ffffff";

/** Contraste mínimo para texto normal según WCAG AA. */
const AA_TEXTO = 4.5;
/** Contraste mínimo para elementos de interfaz y texto grande (WCAG AA). */
const AA_INTERFAZ = 3;

function componentes(hex: string): [number, number, number] | null {
  const limpio = hex.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(limpio)) return null;
  return [
    parseInt(limpio.slice(1, 3), 16),
    parseInt(limpio.slice(3, 5), 16),
    parseInt(limpio.slice(5, 7), 16),
  ];
}

/** Luminancia relativa (WCAG 2.x). 0 = negro, 1 = blanco. */
function luminancia(hex: string): number {
  const rgb = componentes(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((canal) => {
    const s = canal / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razón de contraste entre dos colores, de 1 (idénticos) a 21. */
export function contraste(unColor: string, otroColor: string): number {
  const a = luminancia(unColor);
  const b = luminancia(otroColor);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Qué color de texto se lee mejor **encima** del acento.
 *
 * Es la cuenta que evita el clásico botón amarillo con letras blancas que
 * el dueño ve bien en su pantalla y sus clientes no ven en la calle.
 */
export function textoSobre(acento: string): string {
  return contraste(acento, BLANCO) >= contraste(acento, TINTA) ? BLANCO : TINTA;
}

/** Si el acento sirve además como **color de texto sobre fondo claro**.
 *
 * Es el caso más exigente: el precio o un enlace pintados con el acento
 * sobre el blanco de una tarjeta. Un amarillo pastel pasa perfecto como
 * fondo de botón y es ilegible acá.
 */
export function sirveComoTexto(acento: string): boolean {
  return contraste(acento, BLANCO) >= AA_TEXTO;
}

/** El aviso que se le muestra al dueño, o `null` si el color está bien.
 *
 * Se **avisa**, no se bloquea: es su marca y puede tener razones para
 * usar ese color exacto. Lo que no puede pasar es que se entere por un
 * cliente que no pudo leer los precios.
 */
export function avisoDeContraste(acento: string): string | null {
  if (componentes(acento) === null) return "Ese color no es válido.";

  const contra_blanco = contraste(acento, BLANCO);
  if (contra_blanco < AA_INTERFAZ) {
    return (
      "Este color es muy claro: sobre fondo blanco casi no se distingue. " +
      "Los textos y bordes que lo usen van a costar de leer."
    );
  }
  if (contra_blanco < AA_TEXTO) {
    return (
      "Este color funciona bien en los botones, pero es flojo para textos " +
      "pequeños sobre blanco. Uno un poco más oscuro se lee mejor."
    );
  }
  return null;
}

/** Las variables CSS que pinta el contenedor del perfil público.
 *
 * Redeclara los mismos nombres que `design/tokens.css` define por
 * defecto —no unos intermedios— porque una custom property se resuelve
 * en el elemento donde se declara: los descendientes heredarían el
 * fallback ya resuelto. El detalle está comentado en `tokens.css`.
 */
export function variablesDeTema(acento: string | null | undefined): Record<string, string> {
  if (!acento || componentes(acento) === null) return {};
  return {
    "--color-acento": acento,
    "--color-acento-fuerte": `color-mix(in oklch, ${acento}, black 14%)`,
    "--color-acento-suave": `color-mix(in oklch, ${acento}, white 88%)`,
    "--color-sobre-acento": textoSobre(acento),
  };
}

/** Colores de arranque, elegidos para que cualquiera de ellos se vea
 * bien: todos pasan AA como texto sobre blanco (≥ 4.5), así que quien
 * elige de acá nunca ve un aviso. Hay un test que lo verifica, para que
 * nadie agregue un pastel bonito a la lista sin darse cuenta.
 *
 * La "Menta" de acá es `#047857` y **no** la menta de Turnio
 * (`#10b981`), que contra blanco da 2.54 y no llegaría al mínimo. Ver
 * `DECISIONES.md`: la paleta del producto tiene ese problema aparte y
 * arreglarlo es una decisión de marca, no de esta pantalla. */
export const PRESETS: Array<{ nombre: string; hex: string }> = [
  { nombre: "Menta", hex: "#047857" },
  { nombre: "Índigo", hex: "#4f46e5" },
  { nombre: "Océano", hex: "#0369a1" },
  { nombre: "Vino", hex: "#be123c" },
  { nombre: "Terracota", hex: "#c2410c" },
  { nombre: "Bosque", hex: "#15803d" },
  { nombre: "Violeta", hex: "#7e22ce" },
  { nombre: "Grafito", hex: "#334155" },
];
