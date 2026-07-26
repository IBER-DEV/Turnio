import type { components } from "./schema";

/**
 * Varios serializers de DRF (los que son ModelSerializer directos,
 * sin @extend_schema) exponen `id` como de solo lectura, pero el
 * schema generado no separa "forma de entrada" de "forma de salida":
 * el mismo componente sirve para request y response, con `id` marcado
 * `readonly` pero igual de obligatorio en el tipo. Estos alias quitan
 * los campos de solo lectura para tipar los formularios de creación
 * sin pelear con eso en cada pantalla.
 */
export type ServicioInput = Omit<components["schemas"]["Servicio"], "id">;
export type HorarioTrabajoInput = Omit<components["schemas"]["HorarioTrabajo"], "id">;
