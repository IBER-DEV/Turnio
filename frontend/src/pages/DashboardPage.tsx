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

export function DashboardPage() {
  const { membresia } = useAuth();
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

  // Accesos directos: solo los que las capacidades del usuario permiten.
  // El tipo va sobre el literal, no sobre el resultado de `.filter()`:
  // ahí TypeScript ya perdió el tipado contextual e infiere `string`.
  const todosLosAccesos: Array<{
    visible: boolean;
    etiqueta: string;
    icono: NombreIcono;
    to: string;
  }> = [
    {
      visible: membresia.puede_gestionar_agenda,
      etiqueta: "Agregar Cita",
      icono: "person_add",
      to: "/agenda",
    },
    {
      visible: membresia.puede_editar_precios,
      etiqueta: "Nuevo Servicio",
      icono: "content_cut",
      to: "/servicios",
    },
    {
      visible: membresia.puede_gestionar_empleados,
      etiqueta: "Gestionar Equipo",
      icono: "group_add",
      to: "/empleados",
    },
  ];
  const accesos = todosLosAccesos.filter((acceso) => acceso.visible);

  return (
    <div className="space-y-md">
      {/* Resumen del día */}
      <section className="grid grid-cols-2 gap-4">
        <Card className="flex flex-col items-center p-4 text-center shadow-card-soft">
          <span className="font-display-lg text-display-lg text-primary">
            {cargando ? "—" : pendientes}
          </span>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
            Pendientes
          </p>
        </Card>
        <div className="flex flex-col items-center rounded-xl border border-outline-variant bg-secondary-container p-4 text-center shadow-card-soft">
          <span className="font-display-lg text-display-lg text-on-secondary-container">
            {cargando ? "—" : completadas}
          </span>
          <p className="font-label-md text-label-md uppercase tracking-wider text-on-secondary-container opacity-80">
            Completadas
          </p>
        </div>
      </section>

      {/* Acción destacada */}
      <section>
        <button
          type="button"
          onClick={() => navigate("/agenda")}
          className="tactile group relative flex h-32 w-full flex-col justify-end overflow-hidden rounded-2xl bg-primary p-6 text-left text-on-primary shadow-lg"
        >
          <div className="relative z-10 flex w-full items-end justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold">Ver Agenda de Hoy</h2>
              <p className="font-body-md text-body-md opacity-80">
                {cargando
                  ? "Cargando tus turnos…"
                  : citasHoy.length === 0
                    ? "No tienes turnos para hoy"
                    : `Tienes ${citasHoy.length} ${citasHoy.length === 1 ? "turno" : "turnos"} hoy`}
              </p>
            </div>
            <Icon name="calendar_today" className="text-[32px]" />
          </div>
        </button>
      </section>

      {/* Accesos según capacidades */}
      {accesos.length > 0 && (
        <section
          className={cn(
            "grid gap-4",
            accesos.length === 1 ? "grid-cols-1" : "grid-cols-2",
            accesos.length === 3 && "md:grid-cols-3",
          )}
        >
          {accesos.map(({ etiqueta, icono, to }) => (
            <Link
              key={to}
              to={to}
              className="tactile flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-4 text-center"
            >
              <Icon name={icono} className="text-[24px] text-secondary" />
              <span className="font-label-md text-label-md text-on-surface">{etiqueta}</span>
            </Link>
          ))}
        </section>
      )}

      {/* Actividad reciente */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md-mobile text-primary">
            Próximas citas de hoy
          </h3>
          <Link to="/agenda" className="font-label-md text-label-md text-secondary hover:underline">
            Ver todo
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
          <Card className="p-md text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              No hay citas agendadas para hoy.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {citasHoy.slice(0, 5).map((cita) => {
              const estilo = ESTILO_ESTADO[cita.estado];
              return (
                <Card key={cita.id} className="flex items-center gap-4 p-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-highest">
                    <Icon name="person" className="text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-label-md text-label-md text-primary">
                      {cita.nombre_cliente}
                    </p>
                    <p className="truncate font-caption text-caption text-on-surface-variant">
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
