import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Badge, EstadoError, SkeletonLista } from "../ui/Feedback";
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
      {/* Saludo contextual — solo en desktop (mobile tiene el header) */}
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

      {/* Métricas del día */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-3">
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

      {/* Banner Section */}
      <section className="relative overflow-hidden rounded-2xl bg-[#1E1B4B] p-8 text-white shadow-md">
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
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
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
