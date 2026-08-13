import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate, type NavigateFunction } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../ui/Avatar";
import { cn } from "../ui/cn";
import { Icon } from "../ui/Icon";
import { MenuAcciones, MenuAccionesItem, MenuAccionesSeparator } from "../ui/MenuAcciones";
import type { ItemNav } from "../permisos/shell";
import { usePermisos } from "../permisos/usePermisos";

/** La barra inferior, en sus dos formas: con botón de agendar (tres
 *  columnas, el botón exacto en el centro) y sin él (una sola fila). El
 *  `grid` es el default; la variante sin botón lo pisa con `flex`. */
const CLASES_BARRA =
  "fixed bottom-0 left-0 z-50 grid w-full grid-cols-[1fr_auto_1fr] items-stretch border-t border-outline-variant/40 bg-white/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden";

/** Una entrada de la barra inferior. Función suelta y no componente para
 *  poder pasarla directo a `.map()` en los dos grupos sin repetir el
 *  cuerpo del `NavLink`. */
function itemDeBarra({ to, etiqueta, icono }: ItemNav) {
  return (
    <NavLink
      key={to}
      to={to}
      end={to === "/"}
      viewTransition
      className={({ isActive }) =>
        cn(
          "tactile flex min-w-14 flex-1 flex-col items-center justify-start gap-1 py-1 transition-colors",
          isActive ? "text-menta" : "text-on-surface-variant",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon name={icono} filled={isActive} className="text-[24px]" />
          <span className="text-[10px] font-semibold leading-none">{etiqueta}</span>
        </>
      )}
    </NavLink>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { membresia, logout } = useAuth();
  // La navegación ya no se arma acá: sale del shell del tipo de usuario
  // (ver permisos/shell.ts). El Layout solo la dibuja.
  const { shell, puede } = usePermisos();
  const navegacion = shell.navegacion;
  // La barra inferior de móvil tiene un presupuesto de espacio que la
  // barra lateral de desktop no tiene: los ajustes ocasionales van al
  // menú de cuenta en vez de robarle sitio a la agenda.
  const navegacionPrincipal = navegacion.filter((item) => !item.secundaria);
  const navegacionSecundaria = navegacion.filter((item) => item.secundaria);
  const navigate = useNavigate();
  // Dónde se parte la lista para dejar el botón de agendar en el medio.
  // `Math.ceil` para que con un número impar de entradas la mitad más
  // grande quede a la izquierda, que es donde está Inicio.
  const puedeAgendar = puede("puede_gestionar_agenda");
  const centroBarra = Math.ceil(navegacionPrincipal.length / 2);
  // Título de la TopAppBar de escritorio: se deriva de la navegación en
  // vez de que cada página lo declare — un solo lugar que ya conoce la
  // ruta de todas las pantallas (permisos/shell.ts).
  const { pathname } = useLocation();
  const esInicio = pathname === "/";
  const paginaActual =
    navegacion.find((item) => item.to === pathname) ??
    navegacion.find((item) => item.to !== "/" && pathname.startsWith(item.to));

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Header móvil — icono de grilla (abre el menú de cuenta, que no
          tiene entrada propia en la navegación) + wordmark + campana.

          Va en indigo y no en blanco **para que todas las pantallas
          empiecen con el mismo material que la portada de Inicio**. Con
          el header blanco, Inicio era la única pantalla con un bloque
          indigo arriba y el resto arrancaba en blanco: al navegar entre
          secciones, la parte de arriba de la app cambiaba de color y se
          leía como si fueran dos apps distintas. Los botones repiten el
          círculo `bg-white/15` de la portada por lo mismo.

          En Inicio no se dibuja: la portada ya lleva dentro el saludo y
          el botón de cuenta, y una barra encima le robaría el sangrado
          completo hasta el borde superior. */}
      <header
        className={cn(
          "sticky top-0 z-40 h-14 w-full items-center justify-between bg-primary px-4 safe-top lg:hidden",
          esInicio ? "hidden" : "flex",
        )}
      >
        <MenuAcciones
          trigger={
            <button
              type="button"
              className="tactile flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
              aria-label="Menú de cuenta"
            >
              <Icon name="grid_view" className="text-[20px]" />
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

        {/* El wordmark se queda en menta y no pasa a blanco: es la marca,
            y sobre el indigo mantiene contraste de sobra al tamaño al que
            se dibuja. */}
        <span className="font-headline-lg text-headline-lg tracking-tight text-menta">
          Turnio
        </span>

        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <Icon name="notifications" className="text-[20px]" />
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

          {/* `px-5` = `--spacing-margin-mobile`: el mismo margen lateral
              que usan las tarjetas del mockup. Inicio arranca pegado al
              borde superior (`pt-0`) para que su portada sangre hasta la
              barra de estado; las demás pantallas conservan su respiro.
              `pb-32` y no `pb-28`: el botón flotante de la barra inferior
              sobresale y taparía la última fila de la lista. */}
          <main
            className={cn(
              "min-w-0 flex-1 px-5 pb-32 md:px-8 lg:px-10 lg:pb-8 lg:pt-8",
              esInicio ? "pt-0" : "pt-6",
            )}
          >
            <div className="mx-auto max-w-6xl animate-aparecer">{children}</div>
          </main>
        </div>
      </div>

      {/* BottomNavBar móvil — barra plana de iconos con el botón de
          agendar flotando en el centro, por encima del borde. Agendar es
          la acción que más se repite en el día y hasta ahora vivía dentro
          de la Agenda: sacarla acá la deja a un toque desde cualquier
          pantalla.

          El centrado del botón es **estructural**, no un cálculo de
          índices: tres columnas (`1fr auto 1fr`) dejan el botón exacto en
          la mitad de la barra sin importar cuántas entradas caigan a cada
          lado. La primera versión lo insertaba en la mitad de la lista, y
          con cinco entradas quedaba tres a la izquierda y dos a la
          derecha — el botón terminaba corrido y se notaba. Que las dos
          mitades tengan además el mismo número de entradas es cosa de
          `shell.ts`, que dejó `Equipo` como secundaria justamente por
          esto; pero si algún día vuelven a ser impares, el botón sigue
          centrado y solo se reparten distinto los iconos.

          Sin el botón (quien no puede agendar) la barra vuelve a ser una
          sola fila: dos grupos con distinto número de entradas alrededor
          de un hueco vacío se verían descuadrados sin motivo. */}
      {puedeAgendar ? (
        <nav aria-label="Navegación principal" className={CLASES_BARRA}>
          <div className="flex items-stretch justify-around">
            {navegacionPrincipal.slice(0, centroBarra).map(itemDeBarra)}
          </div>
          <BotonAgendar navigate={navigate} />
          <div className="flex items-stretch justify-around">
            {navegacionPrincipal.slice(centroBarra).map(itemDeBarra)}
          </div>
        </nav>
      ) : (
        <nav aria-label="Navegación principal" className={cn(CLASES_BARRA, "flex justify-around")}>
          {navegacionPrincipal.map(itemDeBarra)}
        </nav>
      )}
    </div>
  );
}

/** El botón de agendar que flota en el centro de la barra inferior.
 *
 * Sobresale de la barra con `translate`, que no ocupa espacio en el
 * layout: las entradas de navegación siguen repartiéndose el ancho como
 * si el botón estuviera dentro de la fila, y no hay que compensar el
 * desplazamiento con márgenes negativos en los vecinos.
 *
 * Navega a la Agenda con `?nueva=1`, que es la señal que esa pantalla
 * lee para abrir el formulario ya montado (ver `AgendaPage`). Se hace
 * por la URL y no por estado compartido porque el formulario vive dentro
 * de la Agenda y necesita sus datos —servicios, equipo, horarios— ya
 * cargados: duplicarlo acá sería duplicar esas cinco peticiones.
 */
function BotonAgendar({ navigate }: { navigate: NavigateFunction }) {
  return (
    <button
      type="button"
      onClick={() => navigate("/agenda?nueva=1")}
      aria-label="Agendar cita"
      className="tactile flex h-14 w-14 shrink-0 -translate-y-6 items-center justify-center self-start rounded-full bg-secondary text-on-secondary shadow-lg shadow-secondary/30 transition-colors hover:bg-secondary-hover"
    >
      <Icon name="add" className="text-[28px]" />
    </button>
  );
}
