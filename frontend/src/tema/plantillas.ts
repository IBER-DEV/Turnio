/** Las plantillas del perfil público, una por rubro.
 *
 * Cada una es una **paleta completa** —fondo, superficies, texto, borde,
 * primario— más un radio y una tipografía de titular. No es "un color
 * distinto": la de barbería es modo oscuro, y eso obliga a que los
 * componentes del perfil no usen los tokens fijos de Turnio (`bg-white`,
 * `text-primary`) sino los semánticos `perfil-*` que se declaran en
 * `src/index.css` y se sobreescriben acá en tiempo de ejecución.
 *
 * El backend solo guarda **cuál** eligió el negocio (`Negocio.Tema`); los
 * valores viven de este lado, que es donde se pintan. La única parte que
 * el backend duplica es el color de fondo, para la meta `theme-color`
 * (ver `Negocio.FONDO_POR_TEMA`) — si se toca una paleta acá, hay que
 * tocarla allá.
 *
 * Origen del diseño: `stitch_booking_page_ui_system/`, con las paletas de
 * la especificación escrita (dorado / salvia / azul médico). Las capturas
 * de ese directorio están renderizadas con un morado genérico que no
 * corresponde a ninguna de las tres.
 */
import { textoSobre } from "./colores";

export type IdPlantilla = "barberia" | "spa" | "clinica";

export interface Plantilla {
  id: IdPlantilla;
  nombre: string;
  descripcion: string;
  /** Portada de muestra mientras el negocio no sube la suya. */
  portadaMuestra: string;
  /** Titulares en serif (solo barbería). Decide la carga de la fuente. */
  serif: boolean;
  /** Clases del contorno de una tarjeta. Es el otro rasgo, además del
   * radio, que el `DESIGN.md` usa para diferenciar las plantillas:
   * barbería marca profundidad con capas tonales y un filo dorado; spa
   * con una sombra difusa teñida; clínica con un borde gris preciso. */
  tarjeta: string;
  variables: Record<string, string>;
}

const PLANTILLAS: Record<IdPlantilla, Plantilla> = {
  barberia: {
    id: "barberia",
    nombre: "Barbería",
    descripcion: "Oscura y dorada. Sobria, masculina, de oficio tradicional.",
    portadaMuestra: "/plantillas/barberia.webp",
    serif: true,
    // Sin sombras: sobre un fondo casi negro no se ven. La profundidad
    // la da el escalón tonal (#1e1e1e sobre #121212) más el filo dorado.
    tarjeta: "border border-perfil-primario/20",
    variables: {
      "--color-perfil-fondo": "#121212",
      "--color-perfil-superficie": "#1e1e1e",
      "--color-perfil-superficie-alta": "#2a2a2a",
      "--color-perfil-texto": "#f5f5f5",
      "--color-perfil-texto-suave": "#a1a1a1",
      "--color-perfil-borde": "#2a2a2a",
      "--color-perfil-primario": "#d4af37",
      "--color-perfil-sobre-primario": "#121212",
      "--radius-perfil": "0.375rem",
      "--radius-perfil-hoja": "0.75rem",
      "--font-perfil-titulo": '"Libre Caslon Text", ui-serif, Georgia, serif',
    },
  },
  spa: {
    id: "spa",
    nombre: "Spa y estética",
    descripcion: "Clara y serena. Formas redondeadas, verde salvia, mucho aire.",
    portadaMuestra: "/plantillas/spa.webp",
    serif: false,
    tarjeta: "shadow-[0_10px_30px_rgba(122,139,123,0.10)]",
    variables: {
      "--color-perfil-fondo": "#fafafa",
      "--color-perfil-superficie": "#ffffff",
      "--color-perfil-superficie-alta": "#f1f4f1",
      "--color-perfil-texto": "#2b2b2b",
      "--color-perfil-texto-suave": "#6b7280",
      "--color-perfil-borde": "#e8ece8",
      "--color-perfil-primario": "#5f7360",
      "--color-perfil-sobre-primario": "#ffffff",
      "--radius-perfil": "1rem",
      "--radius-perfil-hoja": "2rem",
      "--font-perfil-titulo": '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    },
  },
  clinica: {
    id: "clinica",
    nombre: "Clínica y salud",
    descripcion: "Profesional y limpia. Azul médico, bordes precisos, alta legibilidad.",
    portadaMuestra: "/plantillas/clinica.webp",
    serif: false,
    tarjeta: "border border-perfil-borde",
    variables: {
      "--color-perfil-fondo": "#f8fafc",
      "--color-perfil-superficie": "#ffffff",
      "--color-perfil-superficie-alta": "#eef2f7",
      "--color-perfil-texto": "#0f172a",
      "--color-perfil-texto-suave": "#64748b",
      "--color-perfil-borde": "#e2e8f0",
      "--color-perfil-primario": "#0284c7",
      "--color-perfil-sobre-primario": "#ffffff",
      "--radius-perfil": "0.5rem",
      "--radius-perfil-hoja": "1rem",
      "--font-perfil-titulo": '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    },
  },
};

/** La plantilla por defecto, espejo de `Negocio.tema` en el backend. */
export const PLANTILLA_POR_DEFECTO: IdPlantilla = "spa";

/** El catálogo, en el orden en que se le muestra al dueño. */
export const CATALOGO_PLANTILLAS: Plantilla[] = [
  PLANTILLAS.barberia,
  PLANTILLAS.spa,
  PLANTILLAS.clinica,
];

/** La plantilla de un negocio.
 *
 * Degrada a la de por defecto ante un valor desconocido: el backend puede
 * estar desplegado por delante de la app instalada en un teléfono, y una
 * plantilla nueva no puede dejar el perfil en blanco.
 */
export function plantillaDe(tema: string | null | undefined): Plantilla {
  return PLANTILLAS[tema as IdPlantilla] ?? PLANTILLAS[PLANTILLA_POR_DEFECTO];
}

/** Las variables CSS del contenedor del perfil: la plantilla, con el
 * color del negocio encima si eligió uno.
 *
 * El acento sustituye **solo el primario** —botones, precios, detalles—,
 * no el fondo ni las superficies: un negocio elige su color de marca, no
 * rediseña la plantilla. Y el color de texto que va encima se recalcula,
 * porque el de la plantilla estaba pensado para su propio primario.
 */
export function variablesDePlantilla(
  tema: string | null | undefined,
  colorAcento?: string | null,
): Record<string, string> {
  const plantilla = plantillaDe(tema);
  if (!colorAcento || !/^#[0-9a-fA-F]{6}$/.test(colorAcento)) {
    return plantilla.variables;
  }
  return {
    ...plantilla.variables,
    "--color-perfil-primario": colorAcento,
    "--color-perfil-sobre-primario": textoSobre(colorAcento),
  };
}

/** Carga la serif de la barbería solo cuando hace falta.
 *
 * Autoalojada (`@fontsource`) y no por CDN, como el resto de las fuentes
 * del proyecto: esto termina en un bundle de Capacitor y tiene que verse
 * igual sin conexión. Con `import()` dinámico, quien abre el perfil de un
 * spa no la descarga.
 *
 * Falla en silencio a propósito: si la fuente no carga, los titulares
 * caen en la serif del sistema, que es exactamente lo que dice el
 * `font-family` de respaldo. Un perfil no se rompe por una tipografía.
 */
export function cargarFuenteDe(plantilla: Plantilla): void {
  if (!plantilla.serif) return;
  import("@fontsource/libre-caslon-text/latin-400.css").catch(() => {});
  import("@fontsource/libre-caslon-text/latin-700.css").catch(() => {});
}
