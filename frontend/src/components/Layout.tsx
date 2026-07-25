import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { cn } from "../ui/cn";
import { Icon } from "../ui/Icon";

const NAVEGACION = [
  { to: "/", etiqueta: "Inicio", icono: "dashboard" },
  { to: "/agenda", etiqueta: "Agenda", icono: "calendar_today" },
  { to: "/servicios", etiqueta: "Servicios", icono: "content_cut" },
  { to: "/empleados", etiqueta: "Equipo", icono: "group" },
] as const;

/** Iniciales del usuario para el avatar: el diseño usa una foto, pero
 * el backend no expone imagen de perfil (ver CONTRATO.md), así que se
 * usa el mismo círculo con las iniciales en vez de inventar el campo. */
function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function Layout({ children }: { children: ReactNode }) {
  const { membresia, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* TopAppBar */}
      <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 bg-surface px-margin-mobile py-4 safe-top md:px-margin-desktop">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-surface-container-highest font-label-md text-label-md text-primary">
            {membresia ? iniciales(membresia.nombre) : "T"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-label-md text-label-md text-on-surface-variant">
              {membresia?.negocio.nombre}
            </p>
            <h1 className="truncate font-headline-md text-headline-md font-bold tracking-tight text-primary">
              Hola, {membresia?.nombre.split(" ")[0]}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-container"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <Icon name="logout" className="text-[26px]" />
        </button>
      </header>

      <div className="flex">
        {/* NavigationDrawer (escritorio) */}
        <aside className="sticky top-[88px] hidden h-[calc(100dvh-88px)] w-[240px] shrink-0 flex-col border-r border-outline-variant bg-surface-container-low lg:flex">
          <nav className="flex-1 space-y-1 p-2 pt-6" aria-label="Navegación principal">
            {NAVEGACION.map(({ to, etiqueta, icono }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg py-3 pl-4 font-label-md text-label-md transition-colors",
                    isActive
                      ? "border-l-4 border-primary bg-surface-container-high font-bold text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high",
                  )
                }
              >
                <Icon name={icono} />
                <span>{etiqueta}</span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-outline-variant p-4">
            <p className="text-center font-caption text-[10px] text-on-surface-variant">
              Turnio · Fase 1
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-margin-mobile pb-28 pt-4 md:px-margin-desktop lg:pb-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* BottomNavBar (móvil) */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around bg-surface px-4 pb-4 pt-2 shadow-nav safe-bottom lg:hidden"
      >
        {NAVEGACION.map(({ to, etiqueta, icono }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "tactile flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-2xl px-4 py-2 transition-colors",
                isActive
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={icono} filled={isActive} />
                <span className="font-label-md text-[11px]">{etiqueta}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
