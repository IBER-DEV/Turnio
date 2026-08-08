import type { NombreIcono } from "../ui/Icon";
import type { Capacidad, TipoDeUsuario } from "./catalogo";

/** Una entrada de navegación del shell. */
export interface ItemNav {
  to: string;
  etiqueta: string;
  icono: NombreIcono;
  /** Si se declara, la entrada solo aparece con esa capacidad. */
  capacidad?: Capacidad;
  /** Ajustes que se visitan de vez en cuando, no el trabajo del día.
   *
   * En desktop caben todas en la barra lateral, pero la barra inferior
   * de móvil es un presupuesto cerrado: cinco entradas ya la llenan, y
   * cada ajuste nuevo le roba espacio a la pantalla que la persona usa
   * cada hora. Lo secundario vive en el menú de cuenta en móvil.
   *
   * `Cargos` es el otro candidato natural a moverse acá; no se tocó en
   * esta tanda para no cambiarle la navegación a quien ya la conoce.
   */
  secundaria?: boolean;
}

/** La forma de la app para un tipo de usuario.
 *
 * Este es el **domain discriminator** en acción: el backend manda
 * `tipo` y de acá sale qué navegación existe y dónde aterriza la
 * persona. Antes cada pantalla decidía sola, encadenando condicionales
 * por capacidad; ahora la forma es un dato y las pantallas solo la leen.
 *
 * La división de trabajo (ver `CONTRATO.md` 5.10):
 * - **`tipo` decide la forma**: qué secciones existen, dónde se entra.
 * - **las capacidades deciden las acciones**: qué botones se pintan.
 *
 * Ninguna de las dos es seguridad. El backend exige la capacidad en cada
 * endpoint; esto solo evita mostrar lo que respondería 403.
 */
export interface Shell {
  /** A dónde entra al iniciar sesión. */
  inicio: string;
  navegacion: ItemNav[];
}

const AGENDA: ItemNav = { to: "/agenda", etiqueta: "Agenda", icono: "calendar_today" };
const SERVICIOS: ItemNav = { to: "/servicios", etiqueta: "Servicios", icono: "content_cut" };
const EQUIPO: ItemNav = {
  to: "/empleados",
  etiqueta: "Equipo",
  icono: "group",
  capacidad: "puede_gestionar_empleados",
};
const CARGOS: ItemNav = {
  to: "/configuracion/cargos",
  etiqueta: "Cargos",
  icono: "settings",
  capacidad: "puede_gestionar_empleados",
  // Secundaria desde que existe CAJA: un cargo se configura una vez y
  // casi no se vuelve a tocar, así que le cede su lugar en la barra
  // principal a la pantalla que sí se usa todos los días.
  secundaria: true,
};
// Principal a propósito, no secundaria: cobrar es la pantalla que más se
// toca en el día, y cerrar el día viendo cuánto le corresponde a cada
// barbero es el momento de conversión del producto (reemplaza el Excel
// dominical). `CARGOS`, arriba, le cedió el lugar en la barra principal.
const CAJA: ItemNav = {
  to: "/caja",
  etiqueta: "Caja",
  icono: "point_of_sale",
  capacidad: "puede_cobrar",
};
const NEGOCIO: ItemNav = {
  to: "/configuracion/negocio",
  etiqueta: "Perfil del negocio",
  icono: "storefront",
  capacidad: "puede_editar_negocio",
  secundaria: true,
};
// Sin `capacidad`: cualquier miembro tiene trabajo propio que mirar,
// incluido el dueño operador único (ver CLAUDE.md, caso n=1). El backend
// deja a cualquiera listar las ventas donde él es el empleado de alguna
// línea, aunque no pueda cobrar (`CONTRATO.md` 5.13).
//
// Reemplaza a "Mis servicios", que existía para registrar trabajo a mano.
// Ya no hace falta registrarlo —la cita completada genera la cuenta sola—
// así que la pantalla dejó de ser un formulario y pasó a ser lo que el
// barbero de verdad quería de ella: qué hice y cuánto me toca.
//
// Dos variantes del mismo destino, no una: en `administracion`/`recepcion`
// la barra inferior de móvil ya tiene sus cinco entradas principales
// ocupadas, y cortar pelo no es el trabajo diario de quien administra.
// Para `operativo` es justo lo contrario: es su pantalla, así que va
// principal.
const MI_TRABAJO_SECUNDARIA: ItemNav = {
  to: "/mi-trabajo",
  etiqueta: "Mi trabajo",
  icono: "add_task",
  secundaria: true,
};
const MI_TRABAJO_PRINCIPAL: ItemNav = {
  to: "/mi-trabajo",
  etiqueta: "Mi trabajo",
  icono: "add_task",
};

export const SHELLS: Record<TipoDeUsuario, Shell> = {
  /** Ve el negocio completo: arranca en el panel con las cifras del día. */
  administracion: {
    inicio: "/",
    navegacion: [
      { to: "/", etiqueta: "Inicio", icono: "dashboard" },
      AGENDA,
      SERVICIOS,
      CAJA,
      MI_TRABAJO_SECUNDARIA,
      EQUIPO,
      CARGOS,
      NEGOCIO,
    ],
  },
  /** Vive en el mostrador: entra directo a los cobros pendientes, que es
   * lo que tiene enfrente cuando el cliente se para a pagar. Antes
   * aterrizaba en la agenda; desde que existe una cola de cobro real
   * (2026-08-07), la agenda es lo segundo que mira, no lo primero. */
  recepcion: {
    inicio: "/caja",
    navegacion: [
      { to: "/", etiqueta: "Inicio", icono: "dashboard" },
      CAJA,
      AGENDA,
      SERVICIOS,
      MI_TRABAJO_SECUNDARIA,
      EQUIPO,
      CARGOS,
      NEGOCIO,
    ],
  },
  /** Su día y nada más, más el registro de lo que hizo. Sin catálogo ni
   * administración: para un barbero son pantallas de solo lectura que no
   * usa, y llenarle la barra inferior de secciones ajenas le esconde la
   * que sí necesita. `CAJA` aparece acá solo si el dueño le concede
   * `puede_cobrar` — el caso del operador único, que cobra lo suyo. */
  operativo: {
    inicio: "/agenda",
    navegacion: [
      { to: "/", etiqueta: "Inicio", icono: "dashboard" },
      AGENDA,
      MI_TRABAJO_PRINCIPAL,
      CAJA,
    ],
  },
};

/** El shell de alguien, ya filtrado por lo que puede hacer.
 *
 * El `inicio` declarado puede quedar fuera de la navegación filtrada: el
 * shell de `recepcion` aterriza en `/caja`, que exige `puede_cobrar`, y
 * el dueño puede tener un cargo de recepción sin esa capacidad. Cuando
 * pasa, se cae a la primera entrada que sí le quedó.
 *
 * No es cosmético: `RutaProtegida` redirige a `shell.inicio` cuando
 * alguien entra donde no le toca, así que un inicio prohibido sería un
 * **bucle de redirecciones** — se le manda a `/caja`, se le rebota a
 * `/caja`, para siempre. La regla general que sale de acá: el `inicio`
 * de un shell tiene que salir siempre de su navegación ya filtrada,
 * nunca de la declarada.
 */
export function shellDe(
  tipo: TipoDeUsuario | undefined,
  capacidades: Partial<Record<Capacidad, boolean>> | null | undefined,
): Shell {
  const shell = SHELLS[tipo ?? "operativo"];
  const navegacion = shell.navegacion.filter(
    (item) => !item.capacidad || Boolean(capacidades?.[item.capacidad]),
  );
  const alcanzable = navegacion.some((item) => item.to === shell.inicio);

  return {
    inicio: alcanzable ? shell.inicio : (navegacion[0]?.to ?? "/"),
    navegacion,
  };
}
