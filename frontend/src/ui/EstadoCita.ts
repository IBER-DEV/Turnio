import type { components } from "../api/schema";

type Estado = components["schemas"]["EstadoEnum"];

/** Sistema de color de los 4 estados de `Cita`, tomado literalmente del
 * diseño de Agenda (`ui-ux/agenda_calendario/code.html`). Vive en un
 * solo lugar para que el bloque del calendario, el badge y cualquier
 * vista futura no se desincronicen entre sí. */
export const ESTILO_ESTADO: Record<
  Estado,
  { etiqueta: string; bloque: string; borde: string; titulo: string; texto: string; badge: string }
> = {
  agendada: {
    etiqueta: "Agendada",
    bloque: "bg-surface-variant",
    borde: "border-primary-fixed-dim",
    titulo: "text-primary",
    texto: "text-on-surface-variant",
    badge: "bg-surface-variant text-primary-fixed-dim",
  },
  confirmada: {
    etiqueta: "Confirmada",
    bloque: "bg-secondary-fixed/30 ring-2 ring-secondary-container/20",
    borde: "border-secondary-container",
    titulo: "text-on-secondary-fixed",
    texto: "text-on-secondary-fixed-variant",
    badge: "bg-secondary-fixed text-on-secondary-fixed-variant",
  },
  completada: {
    etiqueta: "Completada",
    bloque: "bg-green-50 opacity-80",
    borde: "border-green-500",
    titulo: "text-green-900",
    texto: "text-green-700",
    badge: "bg-green-100 text-green-700",
  },
  cancelada: {
    etiqueta: "Cancelada",
    bloque: "bg-surface-container-low",
    borde: "border-outline-variant",
    titulo: "text-on-surface-variant line-through italic",
    texto: "text-on-surface-variant",
    badge: "bg-surface-container text-on-surface-variant",
  },
};

/** Transiciones válidas según la máquina de estados del backend
 * (`apps/agenda/services.py`). El backend valida de todos modos y
 * responde 400; esto solo evita ofrecer acciones imposibles. */
export const ACCIONES_POR_ESTADO: Record<
  Estado,
  Array<{ accion: "confirmar" | "completar" | "cancelar"; etiqueta: string; icono: string }>
> = {
  agendada: [
    { accion: "confirmar", etiqueta: "Confirmar", icono: "check_circle" },
    { accion: "cancelar", etiqueta: "Cancelar", icono: "cancel" },
  ],
  confirmada: [
    { accion: "completar", etiqueta: "Completar", icono: "task_alt" },
    { accion: "cancelar", etiqueta: "Cancelar", icono: "cancel" },
  ],
  completada: [],
  cancelada: [],
};
