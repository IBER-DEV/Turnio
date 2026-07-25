import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "./refresh";
import { tokenStore } from "./tokenStore";

type MiMembresia = components["schemas"]["MiMembresia"];
type RegistroNegocio = components["schemas"]["RegistroNegocio"];

type ResultadoAuth = { ok: true } | { ok: false; error: string };

interface AuthState {
  /** null mientras se resuelve la sesión al cargar la app. */
  cargando: boolean;
  membresia: MiMembresia | null;
  login: (email: string, password: string) => Promise<ResultadoAuth>;
  registrarNegocio: (datos: RegistroNegocio) => Promise<ResultadoAuth>;
  logout: () => void;
  /** Vuelve a pedir /mi-membresia/ (ej. tras editar el propio perfil). */
  refrescarMembresia: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function obtenerMiMembresia(): Promise<MiMembresia | null> {
  const { data, error } = await conReintentoDeAuth(() => apiClient.GET("/api/negocios/mi-membresia/"));
  if (error || !data) return null;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [membresia, setMembresia] = useState<MiMembresia | null>(null);

  useEffect(() => {
    async function restaurarSesion() {
      if (!tokenStore.getAccess()) {
        setCargando(false);
        return;
      }
      const datos = await obtenerMiMembresia();
      setMembresia(datos);
      setCargando(false);
    }
    restaurarSesion();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await apiClient.POST("/api/auth/login/", {
      body: { email, password } as never,
    });

    if (error || !data) {
      return { ok: false as const, error: "Email o contraseña incorrectos." };
    }

    tokenStore.set(data.access, data.refresh);

    const datosMembresia = await obtenerMiMembresia();
    if (!datosMembresia) {
      tokenStore.clear();
      return { ok: false as const, error: "No se pudo cargar tu perfil. Intenta de nuevo." };
    }

    setMembresia(datosMembresia);
    return { ok: true as const };
  }, []);

  const registrarNegocio = useCallback(async (datos: RegistroNegocio) => {
    const { data, error } = await apiClient.POST("/api/negocios/registro/", {
      body: datos,
    });

    if (error || !data) {
      const primerError = error ? Object.values(error).flat()[0] : null;
      return {
        ok: false as const,
        error: typeof primerError === "string" ? primerError : "No se pudo registrar el negocio.",
      };
    }

    tokenStore.set(data.access, data.refresh);

    const datosMembresia = await obtenerMiMembresia();
    if (!datosMembresia) {
      tokenStore.clear();
      return { ok: false as const, error: "No se pudo cargar tu perfil. Intenta de nuevo." };
    }

    setMembresia(datosMembresia);
    return { ok: true as const };
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setMembresia(null);
  }, []);

  const refrescarMembresia = useCallback(async () => {
    const datos = await obtenerMiMembresia();
    setMembresia(datos);
  }, []);

  return (
    <AuthContext.Provider
      value={{ cargando, membresia, login, registrarNegocio, logout, refrescarMembresia }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return contexto;
}
