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
};
const NEGOCIO: ItemNav = {
  to: "/configuracion/negocio",
  etiqueta: "Perfil del negocio",
  icono: "storefront",
  capacidad: "puede_editar_negocio",
  secundaria: true,
};
// Sin `capacidad`: cualquier miembro puede haber hecho un servicio,
// incluido el dueño operador único (ver CLAUDE.md, caso n=1).
//
// Dos variantes del mismo destino, no una: en `administracion`/`recepcion`
// la barra inferior de móvil ya tiene sus cinco entradas principales
// ocupadas (Inicio, Agenda, Servicios, Equipo, Cargos), así que acá es
// secundaria — cortar pelo no es el trabajo diario de quien administra.
// Para `operativo` es justo lo contrario: es la pantalla que más usa, así
// que va principal.
const MIS_SERVICIOS_SECUNDARIA: ItemNav = {
  to: "/servicios/mios",
  etiqueta: "Mis servicios",
  icono: "add_task",
  secundaria: true,
};
const MIS_SERVICIOS_PRINCIPAL: ItemNav = {
  to: "/servicios/mios",
  etiqueta: "Mis servicios",
  icono: "add_task",
};
// Con `capacidad` y no por `tipo`: un "Validador" puede ser cualquier
// cargo al que el dueño se la conceda, no un tipo de shell propio (ver
// CONTRATO.md 5.13). Igual que NEGOCIO, se declara en las tres listas
// para que aparezca sin importar el tipo del cargo.
const VALIDAR_SERVICIOS: ItemNav = {
  to: "/servicios/validar",
  etiqueta: "Validar servicios",
  icono: "fact_check",
  capacidad: "puede_aprobar_servicios",
  secundaria: true,
};

export const SHELLS: Record<TipoDeUsuario, Shell> = {
  /** Ve el negocio completo: arranca en el panel con las cifras del día. */
  administracion: {
    inicio: "/",
    navegacion: [
      { to: "/", etiqueta: "Inicio", icono: "dashboard" },
      AGENDA,
      SERVICIOS,
      MIS_SERVICIOS_SECUNDARIA,
      VALIDAR_SERVICIOS,
      EQUIPO,
      CARGOS,
      NEGOCIO,
    ],
  },
  /** Vive en la agenda del local: entra directo ahí, no a un panel. */
  recepcion: {
    inicio: "/agenda",
    navegacion: [
      { to: "/", etiqueta: "Inicio", icono: "dashboard" },
      AGENDA,
      SERVICIOS,
      MIS_SERVICIOS_SECUNDARIA,
      VALIDAR_SERVICIOS,
      EQUIPO,
      CARGOS,
      NEGOCIO,
    ],
  },
  /** Su día y nada más, más registrar su propio trabajo. Sin catálogo ni
   * administración: para un barbero son pantallas de solo lectura que no
   * usa, y llenarle la barra inferior de secciones ajenas le esconde la
   * que sí necesita. `VALIDAR_SERVICIOS` sigue disponible si el dueño le
   * concede la capacidad a un cargo operativo (ej. un estilista senior
   * que valida a los demás). */
  operativo: {
    inicio: "/agenda",
    navegacion: [
      { to: "/", etiqueta: "Inicio", icono: "dashboard" },
      AGENDA,
      MIS_SERVICIOS_PRINCIPAL,
      VALIDAR_SERVICIOS,
    ],
  },
};

/** El shell de alguien, ya filtrado por lo que puede hacer. */
export function shellDe(
  tipo: TipoDeUsuario | undefined,
  capacidades: Partial<Record<Capacidad, boolean>> | null | undefined,
): Shell {
  const shell = SHELLS[tipo ?? "operativo"];
  return {
    inicio: shell.inicio,
    navegacion: shell.navegacion.filter(
      (item) => !item.capacidad || Boolean(capacidades?.[item.capacidad]),
    ),
  };
}
