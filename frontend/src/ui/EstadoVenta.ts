import type { components } from "../api/schema";

type Estado = components["schemas"]["VentaEstadoEnum"];

/** Mismo molde que `EstadoCita.ts` y `EstadoCaja.ts`, reutilizando los
 * tokens de color que ya existen (`agendada`/`confirmada`/`completada`/
 * `cancelada` en `../design/tokens.css`) en vez de crear unos nuevos:
 * evita tocar un archivo que también usa `landing/`.
 *
 * Reemplaza a `EstadoRegistroServicio.ts`, que se fue con el circuito de
 * aprobación (rediseño del módulo de dinero, 2026-08-07).
 */
export const ESTILO_ESTADO_VENTA: Record<Estado, { etiqueta: string; badge: string }> = {
  pendiente: {
    // "Por cobrar" y no "Pendiente": para quien está en el mostrador, el
    // estado de la cuenta es una instrucción, no una clasificación.
    etiqueta: "Por cobrar",
    badge: "bg-agendada/15 text-agendada",
  },
  parcial: {
    etiqueta: "Pago parcial",
    badge: "bg-confirmada/15 text-confirmada",
  },
  pagada: {
    etiqueta: "Pagada",
    badge: "bg-completada/15 text-completada",
  },
  anulada: {
    etiqueta: "Anulada",
    badge: "bg-cancelada/15 text-cancelada",
  },
};

/** Los estados en que una cuenta todavía espera plata. Es exactamente lo
 * que la cola de cobro muestra, y lo que hace que una venta cuente como
 * "trabajo hecho sin cobrar" en el resumen del empleado. */
export const ESTADOS_POR_COBRAR: Estado[] = ["pendiente", "parcial"];
