import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { conReintentoDeAuth } from "../auth/refresh";

interface EstadoNegocio {
  /** Todavía no se sabe: no se decide nada hasta que termine. */
  cargando: boolean;
  tieneHorario: boolean;
  tieneServicios: boolean;
  /** Si el negocio puede recibir una reserva de verdad. */
  listo: boolean;
  /** Vuelve a preguntar. Lo llama el onboarding al completar un paso. */
  revalidar: () => Promise<void>;
}

const Contexto = createContext<EstadoNegocio | null>(null);

/** ¿El negocio puede recibir una reserva?
 *
 * Dos condiciones, y las dos son duras:
 *
 * - **Horario**: sin franjas, `huecos_disponibles` devuelve lista vacía y
 *   el enlace público no ofrece ni una hora. Un negocio recién registrado
 *   nace así.
 * - **Servicios**: sin catálogo no hay nada que reservar.
 *
 * Existe porque hasta ahora el producto tenía un **estado muerto
 * silencioso**: al registrarse, el enlace público quedaba vivo (responde
 * `200`, se ve bien, se puede compartir) y era incapaz de producir una
 * sola reserva, sin que nada se lo dijera al dueño. Y el enlace es *el*
 * MVP — el reemplazo de "escríbeme por WhatsApp". Entregarlo roto por
 * defecto era el peor default posible.
 *
 * Se consulta **una sola vez por sesión** y vive acá arriba, no en cada
 * pantalla: `Layout` se remonta en cada navegación, así que preguntarlo
 * ahí serían dos requests por clic de menú.
 */
export function EstadoNegocioProvider({ children }: { children: ReactNode }) {
  const { membresia, cargando: cargandoAuth } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [tieneHorario, setTieneHorario] = useState(false);
  const [tieneServicios, setTieneServicios] = useState(false);

  const revalidar = useCallback(async () => {
    if (!membresia) {
      setCargando(false);
      return;
    }
    setCargando(true);
    const [horarios, servicios] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/agenda/horario-negocio/")),
      conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
    ]);

    // Ante un error de red **no** se asume que falta nada: mandar a
    // alguien al onboarding porque se cayó una request sería peor que no
    // mandarlo. La puerta solo se cierra con una respuesta que de verdad
    // dice que está vacío.
    setTieneHorario(horarios.error ? true : (horarios.data ?? []).length > 0);
    setTieneServicios(servicios.error ? true : (servicios.data ?? []).length > 0);
    setCargando(false);
  }, [membresia]);

  useEffect(() => {
    if (cargandoAuth) return;
    revalidar();
  }, [cargandoAuth, revalidar]);

  const valor = useMemo(
    () => ({
      cargando: cargando || cargandoAuth,
      tieneHorario,
      tieneServicios,
      listo: tieneHorario && tieneServicios,
      revalidar,
    }),
    [cargando, cargandoAuth, tieneHorario, tieneServicios, revalidar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useEstadoNegocio(): EstadoNegocio {
  const valor = useContext(Contexto);
  if (!valor) {
    throw new Error("useEstadoNegocio necesita <EstadoNegocioProvider> por encima.");
  }
  return valor;
}
