import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

/**
 * Cliente para `/api/publico/*` — **deliberadamente sin cabecera de auth**.
 *
 * No es una preferencia de estilo: `apiClient` adjunta `Authorization`
 * siempre que haya un token en storage, y DRF autentica **antes** de
 * evaluar permisos. Un token vencido en el `localStorage` de alguien que
 * alguna vez entró como staff haría que `JWTAuthentication` respondiera
 * `401` en una vista `AllowAny` — el perfil público se caería para la
 * única persona que ya conoce el producto.
 *
 * El caso no es raro: el dueño abre su propio perfil público para ver
 * cómo le quedó, con la sesión del panel a medio expirar.
 */
export const apiPublico = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8001",
});

export type NegocioResumen = components["schemas"]["NegocioPublicoResumen"];
export type NegocioPublico = components["schemas"]["NegocioPublico"];
export type ServicioPublico = components["schemas"]["ServicioPublico"];
export type ProfesionalPublico = components["schemas"]["ProfesionalPublico"];
export type HorarioPublico = components["schemas"]["HorarioNegocioPublico"];
export type Hueco = components["schemas"]["Hueco"];
export type ReservaConfirmada = components["schemas"]["ReservaConfirmada"];
