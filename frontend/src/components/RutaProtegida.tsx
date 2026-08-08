import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import type { Capacidad } from "../permisos/catalogo";
import { usePermisos } from "../permisos/usePermisos";

export type { Capacidad };

/** Exige sesión iniciada; si no hay membresía, redirige a /login.
 *
 * Con `capacidad` (una) o `capacidades` (basta **cualquiera** de ellas),
 * además exige que su **cargo** se la conceda. Se usa en pantallas que
 * son **de gestión de punta a punta** (Equipo, Cargos):
 * ahí no tiene sentido dejar entrar en modo lectura, porque lo único
 * que se ve son datos de administración que quien no gestiona no
 * necesita. El backend aplica la misma regla, así que esto no es la
 * barrera de seguridad, solo evita mostrar una pantalla que respondería
 * 403.
 *
 * No aplica a pantallas donde la lectura sí es útil para cualquiera
 * (Servicios, Agenda): esas siguen abiertas y ocultan solo sus acciones
 * de escritura.
 *
 * Quien llega a una ruta que no le toca cae en el inicio **de su shell**,
 * no en `/` — para un operativo `/` no es su pantalla (ver
 * `permisos/shell.ts`).
 */
export function RutaProtegida({
  children,
  capacidad,
  capacidades,
}: {
  children: ReactNode;
  capacidad?: Capacidad;
  /** Basta con tener **una** de ellas. Existe desde Caja (2026-08-07):
   * esa pantalla la abre tanto quien cobra como quien solo mira
   * reportes, y modelarlo con dos rutas distintas al mismo componente
   * habría sido peor. */
  capacidades?: Capacidad[];
}) {
  const { cargando, membresia } = useAuth();
  const { puede, shell } = usePermisos();

  if (cargando) {
    return <p className="p-margin-mobile text-on-surface-variant">Cargando…</p>;
  }

  if (!membresia) {
    return <Navigate to="/login" replace />;
  }

  const exigidas = capacidades ?? (capacidad ? [capacidad] : []);
  if (exigidas.length > 0 && !exigidas.some((nombre) => puede(nombre))) {
    return <Navigate to={shell.inicio} replace />;
  }

  return <>{children}</>;
}
