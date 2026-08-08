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

// `MovimientoCajaInput` se fue con el rediseño del módulo de dinero
// (2026-08-07): los movimientos ya no se crean a mano desde el frontend
// —nacen de cobrar una venta o de registrar un egreso, cada uno con su
// endpoint y su propio serializer de entrada— así que no queda ningún
// `ModelSerializer` de caja con este problema.
