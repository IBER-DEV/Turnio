import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Badge, Card, EstadoError, SkeletonLista } from "../ui/Feedback";
import { ESTILO_ESTADO } from "../ui/EstadoCita";
import { Icon } from "../ui/Icon";
import type { NombreIcono } from "../ui/Icon";
import { cn } from "../ui/cn";
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
    <div className="space-y-lg">
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
      <section className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center rounded-2xl border border-outline-variant bg-white p-4 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
            <Icon name="event_note" className="text-[20px] text-primary" />
          </span>
          <span className="mt-2 text-2xl font-bold text-primary">
            {cargando ? "—" : totalHoy}
          </span>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Hoy
          </p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-agendada/30 bg-agendada/5 p-4 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-agendada/10">
            <Icon name="schedule" className="text-[20px] text-agendada" />
          </span>
          <span className="mt-2 text-2xl font-bold text-agendada">
            {cargando ? "—" : pendientes}
          </span>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Pendientes
          </p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-menta/30 bg-menta/5 p-4 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-menta/10">
            <Icon name="check_circle" className="text-[20px] text-menta" />
          </span>
          <span className="mt-2 text-2xl font-bold text-menta">
            {cargando ? "—" : completadas}
          </span>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Completadas
          </p>
        </div>
      </section>

      {/* CTA principal */}
      <section>
        <button
          type="button"
          onClick={() => navigate("/agenda")}
          className="tactile group relative flex w-full items-center gap-5 overflow-hidden rounded-2xl bg-primary p-6 text-left text-white shadow-card transition-shadow hover:shadow-elevada"
        >
          <div className="absolute inset-0 bg-linear-to-br from-primary via-primary-container/60 to-primary opacity-90" />
          <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
            <Icon name="calendar_today" className="text-[24px] text-white" />
          </div>
          <div className="relative z-10 min-w-0 flex-1">
            <h2 className="font-label-md text-label-md font-bold text-white/90">
              Agenda de hoy
            </h2>
            <p className="mt-0.5 font-body-md text-body-md text-white/70">
              {cargando
                ? "Cargando…"
                : totalHoy === 0
                  ? "Día libre — sin turnos agendados"
                  : `${pendientes} por atender, ${completadas} listos`}
            </p>
          </div>
          <Icon
            name="arrow_forward"
            className="relative z-10 text-[22px] text-white/50 transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </section>

      {/* Accesos rápidos */}
      {accesos.length > 0 && (
        <section>
          <h3 className="mb-3 font-label-md text-label-md text-on-surface-variant">
            Accesos rápidos
          </h3>
          <div
            className={cn(
              "grid gap-3",
              accesos.length === 1 ? "grid-cols-1" : "grid-cols-2",
              accesos.length === 3 && "md:grid-cols-3",
            )}
          >
            {accesos.map(({ etiqueta, descripcion, icono, to }) => (
              <Link
                key={to}
                to={to}
                className="tactile group flex items-center gap-3 rounded-2xl border border-outline-variant bg-white p-4 transition-all hover:border-menta/30 hover:shadow-card-soft"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-menta/8 transition-colors group-hover:bg-menta/15">
                  <Icon name={icono} className="text-[20px] text-menta" />
                </span>
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface">{etiqueta}</p>
                  <p className="truncate text-[11px] text-on-surface-variant">{descripcion}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Próximas citas de hoy */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-label-md text-label-md text-on-surface-variant">
            Próximas citas
          </h3>
          <Link
            to="/agenda"
            className="flex items-center gap-1 font-label-md text-label-md text-menta transition-colors hover:text-menta-oscura"
          >
            Ver todo
            <Icon name="arrow_forward" className="text-[16px]" />
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
          <Card className="p-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-low">
                <Icon name="event_available" className="text-[24px] text-on-surface-variant" />
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Sin citas para hoy. ¡Día libre!
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {citasHoy.slice(0, 5).map((cita) => {
              const estilo = ESTILO_ESTADO[cita.estado];
              return (
                <Card
                  key={cita.id}
                  className="flex items-center gap-3 p-3.5 transition-shadow hover:shadow-card-soft"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-low">
                    <Icon name="person" className="text-[20px] text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-label-md text-label-md text-on-surface">
                      {cita.nombre_cliente}
                    </p>
                    <p className="truncate text-[12px] text-on-surface-variant">
                      {cita.servicio_nombre} ·{" "}
                      {new Date(cita.fecha_hora_inicio).toLocaleTimeString("es-CO", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
