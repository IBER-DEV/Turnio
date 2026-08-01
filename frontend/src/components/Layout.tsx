import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../ui/Avatar";
import { cn } from "../ui/cn";
import { Icon } from "../ui/Icon";
import { MenuAcciones, MenuAccionesItem, MenuAccionesSeparator } from "../ui/MenuAcciones";
import { usePermisos } from "../permisos/usePermisos";

export function Layout({ children }: { children: ReactNode }) {
  const { membresia, logout } = useAuth();
  // La navegación ya no se arma acá: sale del shell del tipo de usuario
  // (ver permisos/shell.ts). El Layout solo la dibuja.
  const { shell } = usePermisos();
  const navegacion = shell.navegacion;
  // La barra inferior de móvil tiene un presupuesto de espacio que la
  // barra lateral de desktop no tiene: los ajustes ocasionales van al
  // menú de cuenta en vez de robarle sitio a la agenda.
  const navegacionPrincipal = navegacion.filter((item) => !item.secundaria);
  const navegacionSecundaria = navegacion.filter((item) => item.secundaria);
  const navigate = useNavigate();
  // Título de la TopAppBar de escritorio: se deriva de la navegación en
  // vez de que cada página lo declare — un solo lugar que ya conoce la
  // ruta de todas las pantallas (permisos/shell.ts).
  const { pathname } = useLocation();
  const paginaActual =
    navegacion.find((item) => item.to === pathname) ??
    navegacion.find((item) => item.to !== "/" && pathname.startsWith(item.to));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header — visible siempre en mobile, simplificado en desktop.
          Calcado del mockup: icono de grilla (abre el menú de cuenta, ya
          que acá no hay un ítem de menú aparte para eso) + wordmark
          "Turnio" centrado + campana decorativa. El saludo personalizado
          que había acá antes no tiene equivalente en el mockup — vive en
          el contenido de Inicio (`DashboardPage`), no en el chrome. */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-outline-variant/30 bg-background/90 px-4 backdrop-blur-md safe-top lg:hidden">
        <MenuAcciones
          trigger={
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-600"
              aria-label="Menú de cuenta"
            >
              <Icon name="grid_view" className="text-[24px]" />
            </button>
          }
        >
          {navegacionSecundaria.map(({ to, etiqueta, icono }) => (
            <MenuAccionesItem key={to} icono={icono} onClick={() => navigate(to)}>
              {etiqueta}
            </MenuAccionesItem>
          ))}
          {navegacionSecundaria.length > 0 && <MenuAccionesSeparator />}
          <MenuAccionesItem icono="logout" destructivo onClick={handleLogout}>
            Cerrar sesión
          </MenuAccionesItem>
        </MenuAcciones>

        <span className="font-headline-lg text-headline-lg tracking-tight text-emerald-600">
          Turnio
        </span>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center text-emerald-600">
          <Icon name="notifications" className="text-[24px]" />
        </span>
      </header>

      <div className="flex">
        {/* Sidebar — solo desktop */}
        <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-r border-slate-200/80 bg-white lg:flex">
          {/* Wordmark de Turnio — calcado del mockup (texto plano, sin
              badge). Misma altura (`h-14`) y alineación vertical
              (`items-center`) que la TopAppBar de la derecha, para que
              "Turnio" y el título de sección queden en la misma línea.
              El nombre del negocio no desaparece: vive en el pie de la
              barra, junto al usuario, que es donde ya se lee su cuenta y
              su negocio juntos. */}
          <div className="flex h-14 items-center px-6">
            <span className="font-headline-lg text-headline-lg tracking-tight text-emerald-600">
              Turnio
            </span>
          </div>

          {/* Navegación — el activo es una "pestaña" pegada al borde
              izquierdo (borde de 4px + esquinas redondeadas solo a la
              derecha), no una píldora flotante: así se ve en los mockups
              de Stitch y evita el salto de layout al activarse porque el
              borde transparente ya reserva el espacio en el inactivo. */}
          <nav className="mt-3 flex flex-1 flex-col gap-2 px-3" aria-label="Navegación principal">
            {navegacion.map(({ to, etiqueta, icono }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                viewTransition
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-r-xl border-l-4 px-3.5 py-3 font-body-md text-body-md transition-all",
                    isActive
                      ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                      : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={icono}
                      filled={isActive}
                      className={cn("text-[20px]", isActive ? "text-emerald-600" : "text-slate-500")}
                    />
                    <span>{etiqueta}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Footer — negocio + usuario + logout */}
          <div className="px-3 pb-4">
            <p className="truncate px-3 pb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {membresia?.negocio.nombre}
            </p>
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

        <div className="flex min-w-0 flex-1 flex-col">
          {/* TopAppBar — solo desktop (mobile ya tiene su propio header
              arriba). Título de sección + iconos de búsqueda/notificación
              decorativos (no hay funcionalidad detrás todavía, calcado
              del mockup tal cual). */}
          <header className="sticky top-0 z-30 hidden h-14 border-b border-outline-variant/30 bg-background/90 px-8 backdrop-blur-sm lg:flex lg:items-center lg:justify-between">
            <h1 className="font-headline-md text-headline-md text-primary">
              {paginaActual?.etiqueta ?? "Turnio"}
            </h1>
            <div className="flex items-center gap-1 text-on-surface-variant">
              <span className="flex h-9 w-9 items-center justify-center rounded-full">
                <Icon name="search" className="text-[22px]" />
              </span>
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full">
                <Icon name="notifications" className="text-[22px]" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-error" />
              </span>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 lg:px-10 lg:pb-8 lg:pt-8">
            <div className="mx-auto max-w-6xl animate-aparecer">{children}</div>
          </main>
        </div>
      </div>

      {/* BottomNavBar móvil — una sola píldora envuelve icono+etiqueta en
          el activo (sin indicador superior aparte), calcado del mockup:
          esquinas superiores redondeadas en el propio contenedor. */}
      <nav
        aria-label="Navegación principal"
        className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-xl border-t border-outline-variant/40 bg-white/95 px-2 pb-4 pt-1.5 backdrop-blur-md safe-bottom lg:hidden"
      >
        {navegacionPrincipal.map(({ to, etiqueta, icono }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            viewTransition
            className={({ isActive }) =>
              cn(
                "tactile flex min-w-14 flex-col items-center gap-0.5 rounded-full px-4 py-1.5 transition-colors",
                isActive ? "bg-emerald-500/15 text-emerald-700" : "text-on-surface-variant",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={icono} filled={isActive} className="text-[22px]" />
                <span className={cn("text-[10px] font-semibold", isActive && "text-emerald-700")}>
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
