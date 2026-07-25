import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

/** Exige sesión iniciada; si no hay membresía, redirige a /login.
 *
 * No gatea por capacidad a nivel de ruta: cada pantalla (Servicios,
 * Agenda, Empleados) permite lectura a cualquier miembro del negocio
 * y oculta/deshabilita sus propias acciones de escritura según la
 * capacidad puntual que necesiten — ver `useAuth().membresia`. */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const { cargando, membresia } = useAuth();

  if (cargando) {
    return <p className="mensaje-carga">Cargando…</p>;
  }

  if (!membresia) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
