import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import type { components } from "../api/schema";

type MiMembresia = components["schemas"]["MiMembresia"];
/** Nombres de los flags `puede_*` de la membresía propia. */
export type Capacidad = {
  [K in keyof MiMembresia]: K extends `puede_${string}` ? K : never;
}[keyof MiMembresia];

/** Exige sesión iniciada; si no hay membresía, redirige a /login.
 *
 * Con `capacidad`, además exige ese flag para entrar a la ruta. Se usa
 * en pantallas que son **de gestión de punta a punta** (ej. Equipo):
 * ahí no tiene sentido dejar entrar en modo lectura, porque lo único
 * que se ve son datos de administración —email y permisos de los
 * compañeros— que quien no gestiona no necesita. El backend aplica la
 * misma regla (`GET /api/negocios/empleados/` exige
 * `puede_gestionar_empleados`), así que esto no es la barrera de
 * seguridad, solo evita mostrar una pantalla que respondería 403.
 *
 * No aplica a pantallas donde la lectura sí es útil para cualquiera
 * (Servicios, Agenda): esas siguen abiertas y ocultan solo sus
 * acciones de escritura. */
export function RutaProtegida({
  children,
  capacidad,
}: {
  children: ReactNode;
  capacidad?: Capacidad;
}) {
  const { cargando, membresia } = useAuth();

  if (cargando) {
    return <p className="p-margin-mobile text-on-surface-variant">Cargando…</p>;
  }

  if (!membresia) {
    return <Navigate to="/login" replace />;
  }

  if (capacidad && !membresia[capacidad]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
