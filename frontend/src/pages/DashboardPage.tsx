import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../ui/Avatar";
import { Badge, EstadoError, SkeletonLista } from "../ui/Feedback";
import { MenuAcciones, MenuAccionesItem, MenuAccionesSeparator } from "../ui/MenuAcciones";
import { ESTILO_ESTADO } from "../ui/EstadoCita";
import { Icon } from "../ui/Icon";
import type { NombreIcono } from "../ui/Icon";
import { usePermisos } from "../permisos/usePermisos";

type Cita = components["schemas"]["Cita"];

function esHoy(fechaIso: string): boolean {
  const fecha = new Date(fechaIso);
  const hoy = new Date();
  return (
    fecha.getFullYear() === hoy.getFullYear() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getDate() === hoy.getDate()
  );
}

function saludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Buenos días";
  if (hora < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardPage() {
  const { membresia } = useAuth();
  const { puede } = usePermisos();
  const navigate = useNavigate();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  async function cargar() {
    setCargando(true);
    setError(false);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/agenda/citas/"),
    );
    if (errorRespuesta || !data) {
      setError(true);
    } else {
      setCitas(data);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  if (!membresia) return null;

  const citasHoy = citas.filter((cita) => esHoy(cita.fecha_hora_inicio));
  const pendientes = citasHoy.filter(
    (cita) => cita.estado === "agendada" || cita.estado === "confirmada",
  ).length;
  const completadas = citasHoy.filter((cita) => cita.estado === "completada").length;
  const totalHoy = citasHoy.length;

  const todosLosAccesos: Array<{
    visible: boolean;
    etiqueta: string;
    descripcion: string;
    icono: NombreIcono;
    to: string;
  }> = [
    {
      visible: puede("puede_gestionar_agenda"),
      etiqueta: "Agendar cita",
      descripcion: "Programa un nuevo turno",
      icono: "person_add",
      to: "/agenda",
    },
    {
      visible: puede("puede_editar_precios"),
      etiqueta: "Nuevo servicio",
      descripcion: "Amplía tu catálogo",
      icono: "content_cut",
      to: "/servicios",
    },
    {
      visible: puede("puede_gestionar_empleados"),
      etiqueta: "Gestionar equipo",
      descripcion: "Quién trabaja y en qué cargo",
      icono: "group_add",
      to: "/empleados",
    },
    {
      visible: puede("puede_gestionar_empleados"),
      etiqueta: "Cargos",
      descripcion: "Qué puede hacer cada cargo",
      icono: "settings",
      to: "/configuracion/cargos",
    },
  ];
  const accesos = todosLosAccesos.filter((acceso) => acceso.visible);

  return (
    <div className="space-y-8">
      {/* --- Móvil ------------------------------------------------------
          El teléfono no recibe la misma pantalla que el escritorio
          encogida: recibe una portada que ocupa el borde superior de
          lado a lado con el dato del día, y debajo dos tarjetas. La
          diferencia no es cosmética — en escritorio la cuadrícula de
          métricas se lee de un vistazo porque hay ancho, y en un
          teléfono se convierte en tres tarjetas apiladas que empujan
          todo lo demás fuera de la pantalla. */}
      <div className="space-y-4 lg:hidden">
        <Portada
          nombre={membresia.nombre}
          totalHoy={totalHoy}
          pendientes={pendientes}
          completadas={completadas}
          cargando={cargando}
        />
        <EquipoDelDia citasHoy={citasHoy} />
        <TurnosDeHoy
          citasHoy={citasHoy}
          cargando={cargando}
          error={error}
          onReintentar={cargar}
        />
      </div>

      {/* Saludo contextual — solo en desktop (mobile tiene la portada) */}
      <header className="hidden lg:block">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">
          {saludo()}, {membresia.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          {new Date().toLocaleDateString("es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
          {" — "}
          {cargando
            ? "cargando tu agenda…"
            : totalHoy === 0
              ? "no hay turnos para hoy"
              : `${totalHoy} ${totalHoy === 1 ? "turno" : "turnos"} hoy`}
        </p>
      </header>

      {/* Métricas del día — solo escritorio: en móvil el mismo dato
          vive en la portada, en una sola línea en vez de tres tarjetas. */}
      <section className="hidden gap-6 lg:grid lg:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100/60 text-emerald-600">
            <Icon name="event_available" className="text-[24px]" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hoy</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {cargando ? "—" : totalHoy}{" "}
              <span className="text-xs font-normal text-slate-500">turnos</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100/70 text-amber-600">
            <Icon name="schedule" className="text-[24px]" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Pendientes</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {cargando ? "—" : pendientes}{" "}
              <span className="text-xs font-normal text-slate-500">por atender</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs transition-transform hover:-translate-y-0.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Icon name="check_circle" className="text-[24px]" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Completados</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {cargando ? "—" : completadas}{" "}
              <span className="text-xs font-normal text-slate-500">hoy</span>
            </p>
          </div>
        </div>
      </section>

      {/* Banner Section — solo escritorio (la portada lo reemplaza en móvil) */}
      <section className="relative hidden overflow-hidden rounded-2xl bg-primary p-8 text-white shadow-md lg:block">
        <div className="relative z-10 max-w-xl">
          <span className="mb-3 inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
            Sincronizado
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">¡Día despejado!</h2>
          <p className="mt-2 text-sm text-slate-300">
            {cargando
              ? "Cargando tu información..."
              : totalHoy === 0
                ? "Tu agenda para hoy está bajo control. Tienes tiempo libre para organizar tu catálogo de servicios."
                : `Tienes ${pendientes} turnos pendientes por atender y ${completadas} completados hoy.`}
          </p>
          <button
            type="button"
            onClick={() => navigate("/agenda")}
            className="mt-6 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-95 hover:bg-emerald-600"
          >
            Ver Agenda Completa
          </button>
        </div>
        <div className="absolute -bottom-10 -right-10 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
      </section>

      {/* Grid 2 Columnas (Accesos Rápidos + Próximos Turnos) */}
      <div className="hidden gap-8 lg:grid lg:grid-cols-3">
        {/* Accesos Rápidos (2x2) */}
        {accesos.length > 0 && (
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Accesos Rápidos</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {accesos.map(({ etiqueta, descripcion, icono, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="group flex flex-col items-start rounded-xl border border-slate-200/80 bg-white p-6 text-left shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5"
                >
                  <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-emerald-600 transition-transform group-hover:scale-110">
                    <Icon name={icono} className="text-[28px]" />
                  </div>
                  <span className="text-base font-bold text-slate-900">{etiqueta}</span>
                  <p className="mt-1 text-xs text-slate-500">{descripcion}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Próximos Turnos Column */}
        <div className="flex flex-col rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs lg:col-span-1">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Próximos Turnos</h3>
            <Link to="/agenda" className="text-xs font-bold text-emerald-600 hover:underline">
              Ver todos
            </Link>
          </div>

          {cargando ? (
            <SkeletonLista />
          ) : error ? (
            <EstadoError
              mensaje="No pudimos cargar tus citas. Revisa tu conexión."
              onReintentar={cargar}
            />
          ) : citasHoy.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Icon name="calendar_month" className="text-[36px]" />
              </div>
              <p className="font-bold text-slate-900 text-sm">No hay más turnos hoy</p>
              <p className="mt-1 text-xs text-slate-500 px-4">
                Relájate o aprovecha para organizar tu semana. ¡Buen trabajo!
              </p>
              <button
                type="button"
                onClick={() => navigate("/agenda")}
                className="mt-6 w-full rounded-xl border border-emerald-500 py-2.5 text-xs font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
              >
                Ir a la Agenda
              </button>
            </div>
          ) : (
            <div className="flex-1 space-y-3">
              {citasHoy.slice(0, 4).map((cita) => {
                const estilo = ESTILO_ESTADO[cita.estado];
                return (
                  <div
                    key={cita.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {cita.nombre_cliente}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {cita.servicio_nombre} · {new Date(cita.fecha_hora_inicio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => navigate("/agenda")}
                className="mt-4 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Ver todos los turnos
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Pantalla de Inicio en móvil.

   Las tres piezas de abajo solo existen bajo `lg`. Comparten una
   gramática: una portada indigo a sangre completa que lleva el dato del
   día y las acciones, y debajo tarjetas blancas de esquinas suaves, cada
   una con un título y una lista horizontal o vertical.

   Van envueltas en su propio contenedor `space-y-4 lg:hidden` en vez
   de llevar cada una su margen y su `lg:hidden`. No es solo comodidad:
   el `space-y-8` de la página aplica `margin-block-end` al hermano
   *anterior*, no `margin-block-start` al siguiente, así que un `mt-4`
   en la tarjeta no le habría ganado a nada — habría quedado el respiro
   de escritorio entre dos tarjetas de teléfono.
   ------------------------------------------------------------------ */

/** La portada: saludo, el turno del día en grande y la bandeja de
 *  acciones incrustada en el borde inferior.
 *
 *  Sangra fuera del `px-5` del `main` con `-mx-5` (el mismo valor, o
 *  aparece una franja de fondo a los lados) y se come el `pt` de la
 *  barra de estado ella misma, para que el degradado empiece en el
 *  pixel cero de la pantalla y no debajo del notch.
 */
function Portada({
  nombre,
  totalHoy,
  pendientes,
  completadas,
  cargando,
}: {
  nombre: string;
  totalHoy: number;
  pendientes: number;
  completadas: number;
  cargando: boolean;
}) {
  const fecha = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <section className="-mx-5 rounded-b-3xl bg-linear-to-b from-primary to-primary-container px-5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] text-white">
      {/* Primera fila: **la misma** que el encabezado del resto de
          pantallas (menú de cuenta / wordmark / campana), con la misma
          altura y el mismo margen lateral. Antes la portada tenía el
          saludo acá y el wordmark no aparecía por ningún lado, así que
          Inicio era la única pantalla sin la marca y la línea superior
          cambiaba de contenido al navegar. Ahora el borde de arriba es
          idéntico en todas y la portada simplemente sigue hacia abajo
          con lo suyo. */}
      <div className="flex h-10 items-center justify-between">
        <MenuCuenta />
        <span className="font-headline-lg text-headline-lg tracking-tight text-menta">
          Turnio
        </span>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
          <Icon name="notifications" className="text-[20px]" />
        </span>
      </div>

      <div className="mt-4 min-w-0">
        <p className="text-[11px] font-medium text-white/60">{saludo()}</p>
        <p className="truncate text-[20px] font-extrabold leading-tight">
          {nombre.split(" ")[0]}
        </p>
      </div>

      {/* El dato por el que se abre la app. Tres líneas centradas: la
          fecha, el número, y de qué se compone. */}
      <div className="mt-6 text-center">
        <p className="text-[13px] text-white/70">{fecha}</p>
        <p className="mt-1 text-[34px] font-extrabold leading-none tracking-tight">
          {cargando ? "—" : totalHoy}{" "}
          <span className="text-[17px] font-semibold text-white/80">
            {totalHoy === 1 ? "turno" : "turnos"}
          </span>
        </p>
        <p className="mt-2 text-[13px] text-white/70">
          {cargando
            ? "Cargando tu agenda…"
            : totalHoy === 0
              ? "Nada agendado todavía"
              : `${pendientes} por atender · ${completadas} completados`}
        </p>
      </div>

      <BandejaAcciones />
    </section>
  );
}

/** El botón redondo de la esquina de la portada. Es el mismo menú de
 *  cuenta que el resto de pantallas tiene en su barra superior — acá esa
 *  barra no se dibuja, así que sin esto no habría forma de cerrar sesión
 *  ni de llegar a los ajustes desde Inicio. */
function MenuCuenta() {
  const { logout } = useAuth();
  const { shell } = usePermisos();
  const navigate = useNavigate();
  const secundarias = shell.navegacion.filter((item) => item.secundaria);

  return (
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
      {secundarias.map(({ to, etiqueta, icono }) => (
        <MenuAccionesItem key={to} icono={icono} onClick={() => navigate(to)}>
          {etiqueta}
        </MenuAccionesItem>
      ))}
      {secundarias.length > 0 && <MenuAccionesSeparator />}
      <MenuAccionesItem
        icono="logout"
        destructivo
        onClick={() => {
          logout();
          navigate("/login");
        }}
      >
        Cerrar sesión
      </MenuAccionesItem>
    </MenuAcciones>
  );
}

/** La tarjeta blanca de cuatro accesos incrustada en el pie de la
 *  portada. Cuatro y no más: es lo que cabe en una fila sin que la
 *  etiqueta se parta en dos líneas a 360px de ancho.
 *
 *  Los candidatos van en orden de cuántas veces al día se tocan, y se
 *  toman los primeros cuatro que la persona pueda usar — así un empleado
 *  sin caja no ve una casilla vacía, ve su cuarta acción corrida. */
function BandejaAcciones() {
  const { puede } = usePermisos();
  const candidatos: Array<{
    visible: boolean;
    etiqueta: string;
    icono: NombreIcono;
    to: string;
  }> = [
    {
      visible: puede("puede_gestionar_agenda"),
      etiqueta: "Agendar",
      icono: "add",
      to: "/agenda?nueva=1",
    },
    { visible: puede("puede_cobrar"), etiqueta: "Cobrar", icono: "point_of_sale", to: "/caja" },
    { visible: true, etiqueta: "Agenda", icono: "calendar_today", to: "/agenda" },
    {
      visible: puede("puede_gestionar_empleados"),
      etiqueta: "Equipo",
      icono: "group",
      to: "/empleados",
    },
    {
      visible: puede("puede_editar_precios"),
      etiqueta: "Servicios",
      icono: "content_cut",
      to: "/servicios",
    },
    {
      visible: puede("puede_editar_negocio"),
      etiqueta: "Perfil",
      icono: "storefront",
      to: "/configuracion/negocio",
    },
  ];
  const acciones = candidatos.filter((accion) => accion.visible).slice(0, 4);

  return (
    <div className="mt-6 grid grid-cols-4 gap-2 rounded-2xl bg-white p-4 shadow-sm">
      {acciones.map(({ etiqueta, icono, to }) => (
        <Link key={to} to={to} className="tactile flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 text-primary">
            <Icon name={icono} className="text-[22px]" />
          </span>
          <span className="text-[11px] font-semibold text-on-surface">{etiqueta}</span>
        </Link>
      ))}
    </div>
  );
}

/** La fila horizontal de empleados con su carga del día.
 *
 *  Está acá y no en la Agenda porque responde a la pregunta que el dueño
 *  se hace al abrir la app —"¿cómo va cada uno hoy?"— y hoy solo se puede
 *  contestar filtrando la agenda empleado por empleado.
 *
 *  Los nombres salen de las citas del día y no de `GET /api/negocios/
 *  equipo/`: es el dato que esta pantalla ya cargó. Traer el equipo
 *  completo agregaría una segunda petición para mostrar, en la mayoría
 *  de negocios, las mismas dos o tres personas — y quien no tiene citas
 *  hoy no aporta nada a una fila que habla de la carga de hoy.
 */
function EquipoDelDia({ citasHoy }: { citasHoy: Cita[] }) {
  const { puede } = usePermisos();
  const porEmpleado = new Map<number, { nombre: string; turnos: number }>();
  for (const cita of citasHoy) {
    const actual = porEmpleado.get(cita.empleado);
    porEmpleado.set(cita.empleado, {
      nombre: cita.empleado_nombre,
      turnos: (actual?.turnos ?? 0) + 1,
    });
  }
  const equipo = [...porEmpleado.entries()].sort((a, b) => b[1].turnos - a[1].turnos);
  const puedeGestionarEquipo = puede("puede_gestionar_empleados");

  // Sin citas y sin permiso para invitar a nadie, la tarjeta quedaría
  // vacía: mejor no dibujarla y que la lista de turnos suba.
  if (equipo.length === 0 && !puedeGestionarEquipo) return null;

  return (
    <section className="rounded-2xl border border-outline-variant bg-white p-4">
      <h2 className="text-[16px] font-extrabold text-on-surface">Quién atiende hoy</h2>
      <div className="mt-4 flex gap-4 overflow-x-auto hide-scrollbar">
        {puedeGestionarEquipo && (
          <Link to="/empleados" className="tactile flex w-16 shrink-0 flex-col items-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-outline text-on-surface-variant">
              <Icon name="add" className="text-[22px]" />
            </span>
            <span className="mt-2 text-[12px] font-semibold text-on-surface">Agregar</span>
          </Link>
        )}
        {equipo.map(([id, { nombre, turnos }]) => (
          <div key={id} className="flex w-16 shrink-0 flex-col items-center">
            <Avatar nombre={nombre} tamano="lg" forma="circular" />
            <span className="mt-2 w-full truncate text-center text-[12px] font-semibold text-on-surface">
              {nombre.split(" ")[0]}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {turnos} {turnos === 1 ? "turno" : "turnos"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** La lista de turnos del día: la última tarjeta y la que más se mira.
 *
 *  Cinco filas y no todas: pasadas cinco, la lista deja de leerse de un
 *  vistazo y "Ver todos" hace mejor trabajo que el scroll. */
function TurnosDeHoy({
  citasHoy,
  cargando,
  error,
  onReintentar,
}: {
  citasHoy: Cita[];
  cargando: boolean;
  error: boolean;
  onReintentar: () => void;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold text-on-surface">Turnos de hoy</h2>
        <Link to="/agenda" className="text-[12px] font-semibold text-secondary">
          Ver todos
        </Link>
      </div>

      {cargando ? (
        <div className="mt-4">
          <SkeletonLista />
        </div>
      ) : error ? (
        <div className="mt-4">
          <EstadoError
            mensaje="No pudimos cargar tus citas. Revisa tu conexión."
            onReintentar={onReintentar}
          />
        </div>
      ) : citasHoy.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[14px] font-bold text-on-surface">Hoy no hay turnos</p>
          <p className="mt-1 text-[12px] text-on-surface-variant">
            Comparte tu enlace para que tus clientes reserven solos.
          </p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-outline-variant">
          {citasHoy.slice(0, 5).map((cita) => {
            const estilo = ESTILO_ESTADO[cita.estado];
            return (
              <li key={cita.id} className="flex items-center gap-3 py-3">
                <Avatar nombre={cita.nombre_cliente} tamano="lg" forma="circular" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-on-surface">
                    {cita.nombre_cliente}
                  </p>
                  <p className="truncate text-[12px] text-on-surface-variant">
                    {cita.servicio_nombre} · {cita.empleado_nombre.split(" ")[0]}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold text-on-surface">
                    {new Date(cita.fecha_hora_inicio).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[11px] font-semibold text-on-surface-variant">
                    {estilo.etiqueta}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
