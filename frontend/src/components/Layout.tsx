import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../ui/Avatar";
import { cn } from "../ui/cn";
import { Icon } from "../ui/Icon";
import { MenuAcciones, MenuAccionesItem } from "../ui/MenuAcciones";
import { Separator } from "../ui/Separator";

const NAVEGACION = [
  { to: "/", etiqueta: "Inicio", icono: "dashboard" },
  { to: "/agenda", etiqueta: "Agenda", icono: "calendar_today" },
  { to: "/servicios", etiqueta: "Servicios", icono: "content_cut" },
  {
    to: "/empleados",
    etiqueta: "Equipo",
    icono: "group",
    capacidad: "puede_gestionar_empleados",
  },
  {
    to: "/configuracion/permisos",
    etiqueta: "Permisos",
    icono: "settings",
    capacidad: "puede_gestionar_empleados",
  },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { membresia, logout } = useAuth();

  const navegacion = NAVEGACION.filter(
    (item) => !("capacidad" in item) || Boolean(membresia?.[item.capacidad]),
  );
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header — visible siempre en mobile, simplificado en desktop */}
      <header className="sticky top-0 z-40 flex w-full items-center justify-between gap-4 border-b border-outline-variant/60 bg-white/80 px-margin-mobile py-3.5 backdrop-blur-md safe-top md:px-margin-desktop lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            nombre={membresia?.nombre ?? "Turnio"}
            forma="cuadrado"
            tamano="md"
          />
          <div className="min-w-0">
            <p className="truncate font-caption text-caption text-on-surface-variant">
              {membresia?.negocio.nombre}
            </p>
            <h1 className="truncate font-headline-md text-headline-md-mobile tracking-tight text-primary">
              Hola, {membresia?.nombre.split(" ")[0]}
            </h1>
          </div>
        </div>
        <MenuAcciones
          trigger={
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center text-primary"
              aria-label="Menú de cuenta"
            >
              <Icon name="more_vert" className="text-[24px]" />
            </button>
          }
        >
          <MenuAccionesItem icono="logout" destructivo onClick={handleLogout}>
            Cerrar sesión
          </MenuAccionesItem>
        </MenuAcciones>
      </header>

      <div className="flex">
        {/* Sidebar — solo desktop */}
        <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-outline-variant/40 bg-background lg:flex">
          {/* Identidad del negocio */}
          <div className="flex items-center gap-3 px-5 pb-2 pt-6">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-extrabold text-white">T</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-label-md text-label-md font-bold text-primary">
                {membresia?.negocio.nombre ?? "Turnio"}
              </p>
            
            </div>
          </div>

          <Separator className="mx-5 my-3" />

          {/* Navegación */}
          <nav className="flex-1 space-y-0.5 px-3" aria-label="Navegación principal">
            {navegacion.map(({ to, etiqueta, icono }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 font-body-md text-body-md transition-all",
                    isActive
                      ? "bg-menta/8 font-semibold text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Indicador lateral */}
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full transition-all",
                        isActive ? "bg-menta opacity-100" : "opacity-0",
                      )}
                    />
                    {/* Icono con container en activo */}
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                        isActive
                          ? "bg-menta/15 text-menta"
                          : "text-on-surface-variant group-hover:text-on-surface",
                      )}
                    >
                      <Icon name={icono} filled={isActive} className="text-[20px]" />
                    </span>
                    <span>{etiqueta}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer — usuario + logout */}
          <div className="px-3 pb-4">
            <Separator className="mx-2 mb-3" />
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
              <Avatar
                nombre={membresia?.nombre ?? "U"}
                tamano="sm"
                forma="circular"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-on-surface">
                  {membresia?.nombre}
                </p>
                <p className="truncate text-[11px] text-on-surface-variant">
                  {membresia?.email}
                </p>
              </div>
              <MenuAcciones
                trigger={
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center text-primary"
                    aria-label="Menú de cuenta"
                  >
                    <Icon name="more_vert" className="text-[22px]" />
                  </button>
                }
              >
                <MenuAccionesItem icono="logout" destructivo onClick={handleLogout}>
                  Cerrar sesión
                </MenuAccionesItem>
              </MenuAcciones>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-margin-mobile pb-28 pt-6 md:px-margin-desktop lg:pb-8 lg:pt-8">
          <div className="mx-auto max-w-5xl animate-aparecer">{children}</div>
        </main>
      </div>

      {/* BottomNavBar móvil */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-outline-variant/40 bg-white/95 px-2 pb-4 pt-1.5 backdrop-blur-md safe-bottom lg:hidden"
      >
        {navegacion.map(({ to, etiqueta, icono }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "tactile relative flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-on-surface-variant",
              )
            }
          >
            {({ isActive }) => (
              <>
                {/* Indicador superior */}
                <span
                  className={cn(
                    "absolute -top-1.5 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full transition-all",
                    isActive ? "bg-menta opacity-100" : "opacity-0",
                  )}
                />
                {/* Ícono con container en activo */}
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                    isActive && "bg-menta/10",
                  )}
                >
                  <Icon name={icono} filled={isActive} className="text-[22px]" />
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    isActive && "text-primary",
                  )}
                >
                  {etiqueta}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
