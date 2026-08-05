import type { components } from "../api/schema";

type Estado = components["schemas"]["CajaEstadoEnum"];

/** Mismo molde que `EstadoRegistroServicio.ts`, reutilizando los tokens
 * de color que ya existen (`agendada`/`completada` en
 * `../design/tokens.css`) en vez de crear unos nuevos. */
export const ESTILO_ESTADO_CAJA: Record<Estado, { etiqueta: string; badge: string }> = {
  abierta: {
    etiqueta: "Abierta",
    badge: "bg-agendada/15 text-agendada",
  },
  cerrada: {
    etiqueta: "Cerrada",
    badge: "bg-completada/15 text-completada",
  },
};
