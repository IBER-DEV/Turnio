import { useMemo } from "react";

import { useAuth } from "../auth/AuthContext";
import type { Capacidad, TipoDeUsuario } from "./catalogo";
import { shellDe, type Shell } from "./shell";

interface Permisos {
  /** Si su cargo le concede esa capacidad. Gatea **acciones**. */
  puede: (capacidad: Capacidad) => boolean;
  /** La forma de la app para su tipo. Gatea **navegación**. */
  shell: Shell;
  /** El discriminador de dominio crudo, por si hace falta discriminar. */
  tipo: TipoDeUsuario | undefined;
  cargando: boolean;
}

/** Todo lo que una pantalla necesita saber sobre quién la está mirando.
 *
 * Un solo lugar donde se atraviesa `membresía → cargo → capacidad`. Antes
 * cada pantalla leía `membresia.puede_x` directo; con las capacidades en
 * el cargo eso serían siete `?.` repartidos por el código, y el día que
 * el modelo cambie de nuevo habría que buscarlos todos.
 */
export function usePermisos(): Permisos {
  const { membresia, cargando } = useAuth();

  return useMemo(
    () => ({
      puede: (capacidad: Capacidad) => Boolean(membresia?.cargo?.[capacidad]),
      shell: shellDe(membresia?.tipo, membresia?.cargo),
      tipo: membresia?.tipo,
      cargando,
    }),
    [membresia, cargando],
  );
}
