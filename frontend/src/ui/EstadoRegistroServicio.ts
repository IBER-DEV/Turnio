import type { components } from "../api/schema";

type Estado = components["schemas"]["RegistroServicioEstadoEnum"];

/** Mismo molde que `EstadoCita.ts`, reutilizando los tokens de color que
 * ya existen (`agendada`/`completada`/`cancelada` en `../design/tokens.css`)
 * en vez de crear unos nuevos: evita tocar un archivo que también usa
 * `landing/`. */
export const ESTILO_ESTADO_REGISTRO: Record<
  Estado,
  { etiqueta: string; badge: string }
> = {
  pendiente: {
    etiqueta: "Pendiente",
    badge: "bg-agendada/15 text-agendada",
  },
  aprobado: {
    etiqueta: "Aprobado",
    badge: "bg-completada/15 text-completada",
  },
  rechazado: {
    etiqueta: "Rechazado",
    badge: "bg-cancelada/15 text-cancelada",
  },
};
