import type { components } from "../api/schema";
import type { NombreIcono } from "./Icon";

type Estado = components["schemas"]["EstadoEnum"];

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
};

export const ACCIONES_POR_ESTADO: Record<
  Estado,
  Array<{ accion: "confirmar" | "completar" | "cancelar"; etiqueta: string; icono: NombreIcono }>
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
