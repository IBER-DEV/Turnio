import { apiClient } from "../api/client";
import { tokenStore } from "./tokenStore";

/**
 * Intenta refrescar el access token con el refresh guardado. Si
 * funciona, guarda los tokens nuevos (el backend rota el refresh en
 * cada uso, ver CONTRATO.md sección 3) y devuelve true. Si falla,
 * limpia los tokens (fuerza login de nuevo) y devuelve false.
 */
export async function intentarRefrescarToken(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;

  const { data, error } = await apiClient.POST("/api/auth/refresh/", {
    body: { refresh } as never,
  });

  if (error || !data) {
    tokenStore.clear();
    return false;
  }

  tokenStore.set(data.access, data.refresh ?? refresh);
  return true;
}

/**
 * Ejecuta `hacerRequest` y, si responde 401, intenta refrescar el
 * token una vez y reintenta. Si el refresh falla, deja el error 401
 * original (quien llama debe redirigir a /login).
 */
export async function conReintentoDeAuth<T extends { response: Response }>(
  hacerRequest: () => Promise<T>,
): Promise<T> {
  const primerIntento = await hacerRequest();
  if (primerIntento.response.status !== 401) {
    return primerIntento;
  }

  const refrescado = await intentarRefrescarToken();
  if (!refrescado) {
    return primerIntento;
  }

  return hacerRequest();
}
