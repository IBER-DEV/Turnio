import type { components } from "../api/schema";
import type { NombreIcono } from "./Icon";

type Estado = components["schemas"]["CitaEstadoEnum"];

export const ESTILO_ESTADO: Record<
  Estado,
  { etiqueta: string; bloque: string; borde: string; titulo: string; texto: string; badge: string }
> = {
  agendada: {
    etiqueta: "Agendada",
    bloque: "bg-agendada/10",
    borde: "border-agendada",
    titulo: "text-primary",
    texto: "text-on-surface-variant",
    badge: "bg-agendada/15 text-agendada",
  },
  confirmada: {
    etiqueta: "Confirmada",
    bloque: "bg-confirmada/10 ring-2 ring-confirmada/10",
    borde: "border-confirmada",
    titulo: "text-primary",
    texto: "text-on-surface-variant",
    badge: "bg-confirmada/15 text-confirmada",
  },
  en_atencion: {
    etiqueta: "En atención",
    // El anillo más marcado es a propósito: de todas las citas del día,
    // esta es la única que está pasando ahora mismo.
    bloque: "bg-menta/10 ring-2 ring-menta/25",
    borde: "border-menta",
    titulo: "text-primary",
    texto: "text-on-surface-variant",
    badge: "bg-menta/15 text-menta",
  },
  completada: {
    etiqueta: "Completada",
    bloque: "bg-completada/10 opacity-80",
    borde: "border-completada",
    titulo: "text-primary",
    texto: "text-on-surface-variant",
    badge: "bg-completada/15 text-completada",
  },
  cancelada: {
    etiqueta: "Cancelada",
    bloque: "bg-surface-container-low",
    borde: "border-outline-variant",
    titulo: "text-on-surface-variant line-through italic",
    texto: "text-on-surface-variant",
    badge: "bg-cancelada/10 text-cancelada",
  },
  no_show: {
    // Se ve como cancelada porque para el calendario es lo mismo (la
    // franja se liberó), pero se nombra distinto porque para el negocio
    // no lo es: una la avisaron, la otra no.
    etiqueta: "No asistió",
    bloque: "bg-surface-container-low",
    borde: "border-outline-variant",
    titulo: "text-on-surface-variant line-through italic",
    texto: "text-on-surface-variant",
    badge: "bg-cancelada/10 text-cancelada",
  },
};

export type AccionCita = "confirmar" | "en-atencion" | "completar" | "cancelar" | "no-show";

/** Qué se puede hacer desde cada estado, en el orden en que se ofrece.
 *
 * **No es un espejo de `TRANSICIONES_VALIDAS` del backend**, y esa
 * diferencia es deliberada: el backend define qué es *posible*, esta
 * tabla define qué *se ofrece*.
 *
 * La diferencia más grande es que **`en_atencion` no se ofrece nunca**
 * (decisión del humano, 2026-08-07). El estado existe en el dominio y el
 * endpoint funciona, pero marcarlo es un toque más para el empleado a
 * cambio de nada: en una barbería el barbero sabe perfectamente a quién
 * tiene en la silla, y el sistema no hace nada distinto por saberlo.
 * Ganaría sentido el día que alguien **que no está haciendo el trabajo**
 * necesite ver el estado del local en vivo — una recepción manejando
 * sala de espera en un salón grande. Hasta entonces, cobra un clic por
 * cliente y no devuelve nada.
 *
 * Se conservan las acciones desde `en_atencion` por si una cita llega a
 * ese estado desde fuera de esta UI (la API es pública para el negocio),
 * para que no quede atrapada sin salida.
 *
 * `completar` es la que importa: genera la cuenta por cobrar, así que
 * su etiqueta lo dice ("Terminé") en vez de nombrar el estado.
 */
export const ACCIONES_POR_ESTADO: Record<
  Estado,
  Array<{ accion: AccionCita; etiqueta: string; icono: NombreIcono }>
> = {
  agendada: [
    { accion: "confirmar", etiqueta: "Confirmar", icono: "check_circle" },
    { accion: "no-show", etiqueta: "No vino", icono: "person_off" },
    { accion: "cancelar", etiqueta: "Cancelar", icono: "cancel" },
  ],
  confirmada: [
    { accion: "completar", etiqueta: "Terminé", icono: "task_alt" },
    { accion: "no-show", etiqueta: "No vino", icono: "person_off" },
    { accion: "cancelar", etiqueta: "Cancelar", icono: "cancel" },
  ],
  en_atencion: [
    { accion: "completar", etiqueta: "Terminé", icono: "task_alt" },
    { accion: "cancelar", etiqueta: "Cancelar", icono: "cancel" },
  ],
  completada: [],
  cancelada: [],
  no_show: [],
};
