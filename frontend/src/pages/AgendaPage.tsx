import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import type { HorarioTrabajoInput } from "../api/types";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { ACCIONES_POR_ESTADO, ESTILO_ESTADO } from "../ui/EstadoCita";
import { Badge, EstadoError, EstadoVacio, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input, Select } from "../ui/Input";
import { Modal, ModalConfirmacion } from "../ui/Modal";
import { useToast } from "../ui/Toast";

type Cita = components["schemas"]["Cita"];
type Servicio = components["schemas"]["Servicio"];
type MiembroNegocio = components["schemas"]["MiembroNegocio"];
type HorarioTrabajo = components["schemas"]["HorarioTrabajo"];
type AccionCita = "confirmar" | "completar" | "cancelar";

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_CORTOS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
const CUALQUIERA = "cualquiera";

/** Los 7 días desde hoy, para el selector horizontal del diseño. */
function proximosDias(cantidad = 7): Date[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Array.from({ length: cantidad }, (_, indice) => {
    const dia = new Date(hoy);
    dia.setDate(hoy.getDate() + indice);
    return dia;
  });
}

function mismoDia(fechaIso: string, dia: Date): boolean {
  const fecha = new Date(fechaIso);
  return (
    fecha.getFullYear() === dia.getFullYear() &&
    fecha.getMonth() === dia.getMonth() &&
    fecha.getDate() === dia.getDate()
  );
}

function hora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

/** `datetime-local` necesita 'YYYY-MM-DDTHH:mm' en hora local. */
function paraInputFechaHora(dia: Date, horaTexto = "09:00"): string {
  const yyyy = dia.getFullYear();
  const mm = String(dia.getMonth() + 1).padStart(2, "0");
  const dd = String(dia.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${horaTexto}`;
}

const HORARIO_VACIO: HorarioTrabajoInput = {
  miembro: 0,
  dia_semana: 0,
  hora_inicio: "09:00:00",
  hora_fin: "18:00:00",
};

export function AgendaPage() {
  const { membresia } = useAuth();
  const { mostrar } = useToast();
  const puedeGestionar = membresia?.puede_gestionar_agenda ?? false;

  const dias = useMemo(() => proximosDias(), []);
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(dias[0]);
  const [empleadoFiltro, setEmpleadoFiltro] = useState<number | "todos">("todos");

  const [citas, setCitas] = useState<Cita[]>([]);
  const [empleados, setEmpleados] = useState<MiembroNegocio[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [horarios, setHorarios] = useState<HorarioTrabajo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [citaAbierta, setCitaAbierta] = useState<number | null>(null);
  const [formularioCita, setFormularioCita] = useState(false);
  const [panelHorarios, setPanelHorarios] = useState(false);
  const [porCancelar, setPorCancelar] = useState<Cita | null>(null);
  const [horarioPorBorrar, setHorarioPorBorrar] = useState<HorarioTrabajo | null>(null);

  async function cargar() {
    setCargando(true);
    setError(false);
    const [citasResp, empleadosResp, serviciosResp, horariosResp] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/agenda/citas/")),
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/empleados/")),
      conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
      conReintentoDeAuth(() => apiClient.GET("/api/agenda/horarios/")),
    ]);

    if (citasResp.error || !citasResp.data) {
      setError(true);
      setCargando(false);
      return;
    }

    setCitas(citasResp.data);
    setEmpleados(empleadosResp.data ?? []);
    setServicios(serviciosResp.data ?? []);
    setHorarios(horariosResp.data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const citasVisibles = citas
    .filter((cita) => mismoDia(cita.fecha_hora_inicio, diaSeleccionado))
    .filter((cita) => empleadoFiltro === "todos" || cita.empleado === empleadoFiltro)
    .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

  async function transicionar(cita: Cita, accion: AccionCita) {
    const path = { id: cita.id };
    const respuesta = await conReintentoDeAuth(() => {
      if (accion === "confirmar")
        return apiClient.POST("/api/agenda/citas/{id}/confirmar/", { params: { path } });
      if (accion === "completar")
        return apiClient.POST("/api/agenda/citas/{id}/completar/", { params: { path } });
      return apiClient.POST("/api/agenda/citas/{id}/cancelar/", { params: { path } });
    });

    if (respuesta.error || !respuesta.data) {
      mostrar("error", "No se pudo actualizar la cita.");
      return;
    }

    setCitas((actual) =>
      actual.map((item) => (item.id === cita.id ? (respuesta.data as Cita) : item)),
    );
    mostrar(
      "exito",
      accion === "confirmar"
        ? "Cita confirmada."
        : accion === "completar"
          ? "Cita completada."
          : "Cita cancelada.",
    );
  }

  return (
    <div className="space-y-md">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-primary md:text-headline-lg">
            Agenda
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Calendario por empleado y estado de cada cita.
          </p>
        </div>
        {puedeGestionar && (
          <div className="flex shrink-0 gap-2">
            <Button
              variante="secondary"
              icono="schedule"
              onClick={() => setPanelHorarios(true)}
              aria-label="Gestionar horarios"
            >
              <span className="hidden sm:inline">Horarios</span>
            </Button>
            <Button
              icono="add"
              onClick={() => setFormularioCita(true)}
              aria-label="Agendar cita"
            >
              <span className="hidden sm:inline">Agendar</span>
            </Button>
          </div>
        )}
      </header>

      {/* Filtro por empleado */}
      <div className="hide-scrollbar -mx-margin-mobile flex gap-2 overflow-x-auto px-margin-mobile md:mx-0 md:px-0">
        <button
          type="button"
          onClick={() => setEmpleadoFiltro("todos")}
          className={cn(
            "tactile shrink-0 rounded-full px-5 py-2.5 font-label-md text-label-md transition-colors",
            empleadoFiltro === "todos"
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant",
          )}
        >
          Todos
        </button>
        {empleados.map((empleado) => (
          <button
            key={empleado.id}
            type="button"
            onClick={() => setEmpleadoFiltro(empleado.id)}
            className={cn(
              "tactile shrink-0 rounded-full px-5 py-2.5 font-label-md text-label-md transition-colors",
              empleadoFiltro === empleado.id
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant",
            )}
          >
            {empleado.nombre}
          </button>
        ))}
      </div>

      {/* Selector de día */}
      <div className="hide-scrollbar -mx-margin-mobile flex gap-3 overflow-x-auto px-margin-mobile pb-1 md:mx-0 md:px-0">
        {dias.map((dia) => {
          const activo = dia.toDateString() === diaSeleccionado.toDateString();
          const indiceDia = (dia.getDay() + 6) % 7; // JS: domingo=0 → lunes=0
          return (
            <button
              key={dia.toISOString()}
              type="button"
              onClick={() => setDiaSeleccionado(dia)}
              aria-pressed={activo}
              className={cn(
                "tactile flex h-[88px] w-[76px] shrink-0 flex-col items-center justify-center rounded-xl border transition-colors",
                activo
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant bg-surface-container-lowest text-on-surface",
              )}
            >
              <span className="font-label-md text-caption uppercase opacity-70">
                {DIAS_CORTOS[indiceDia]}
              </span>
              <span className="font-headline-md text-headline-md font-bold">{dia.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Timeline de citas */}
      {cargando ? (
        <SkeletonLista />
      ) : error ? (
        <EstadoError
          mensaje="No pudimos cargar la agenda. Revisa tu conexión."
          onReintentar={cargar}
        />
      ) : citasVisibles.length === 0 ? (
        <EstadoVacio
          icono="event_available"
          titulo="Sin citas este día"
          descripcion="No hay turnos agendados para el día y empleado seleccionados."
          accion={
            puedeGestionar ? { etiqueta: "Agendar cita", onClick: () => setFormularioCita(true) } : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {citasVisibles.map((cita) => {
            const estilo = ESTILO_ESTADO[cita.estado];
            const acciones = ACCIONES_POR_ESTADO[cita.estado];
            const abierta = citaAbierta === cita.id;

            return (
              <li key={cita.id} className="flex gap-3">
                <span className="w-[52px] shrink-0 pt-3 text-right font-label-md text-caption text-on-surface-variant opacity-70">
                  {hora(cita.fecha_hora_inicio)}
                </span>

                <div
                  className={cn(
                    "flex-1 rounded-lg border-l-4 p-3 transition-all",
                    estilo.bloque,
                    estilo.borde,
                    abierta && "ring-2 ring-primary/20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setCitaAbierta(abierta ? null : cita.id)}
                    aria-expanded={abierta}
                    className="flex w-full items-start justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <h3 className={cn("font-label-md text-label-md", estilo.titulo)}>
                        {cita.servicio_nombre}
                      </h3>
                      <p className={cn("truncate font-caption text-caption", estilo.texto)}>
                        {cita.nombre_cliente} · {cita.empleado_nombre}
                      </p>
                    </div>
                    <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
                  </button>

                  {abierta && (
                    <div className="mt-3 space-y-3 border-t border-outline-variant/40 pt-3">
                      <p className="font-caption text-caption text-on-surface-variant">
                        {hora(cita.fecha_hora_inicio)} – {hora(cita.fecha_hora_fin)}
                        {cita.telefono_cliente && ` · ${cita.telefono_cliente}`}
                      </p>

                      {puedeGestionar && acciones.length > 0 ? (
                        <div className="flex gap-2">
                          {acciones.map(({ accion, etiqueta, icono }) => (
                            <Button
                              key={accion}
                              variante={accion === "cancelar" ? "danger" : "accent"}
                              icono={icono}
                              className="flex-1"
                              onClick={() => {
                                if (accion === "cancelar") setPorCancelar(cita);
                                else transicionar(cita, accion);
                              }}
                            >
                              {etiqueta}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="font-caption text-caption text-on-surface-variant">
                          {acciones.length === 0
                            ? "Esta cita ya no admite cambios de estado."
                            : "No tienes permiso para gestionar la agenda."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formularioCita && (
        <ModalNuevaCita
          servicios={servicios}
          empleados={empleados}
          diaSeleccionado={diaSeleccionado}
          onCerrar={() => setFormularioCita(false)}
          onCreada={async () => {
            setFormularioCita(false);
            mostrar("exito", "Cita agendada.");
            await cargar();
          }}
        />
      )}

      {panelHorarios && (
        <ModalHorarios
          empleados={empleados}
          horarios={horarios}
          onCerrar={() => setPanelHorarios(false)}
          onCambio={cargar}
          onPedirBorrado={setHorarioPorBorrar}
        />
      )}

      <ModalConfirmacion
        abierto={porCancelar !== null}
        titulo="¿Cancelar esta cita?"
        mensaje={`La cita de ${porCancelar?.nombre_cliente} quedará cancelada. Esta acción no se puede deshacer.`}
        etiquetaConfirmar="Sí, cancelar"
        onCancelar={() => setPorCancelar(null)}
        onConfirmar={async () => {
          if (porCancelar) await transicionar(porCancelar, "cancelar");
          setPorCancelar(null);
        }}
      />

      <ModalConfirmacion
        abierto={horarioPorBorrar !== null}
        titulo="¿Eliminar este bloque de horario?"
        mensaje="El empleado dejará de tener disponibilidad en esa franja para nuevas citas."
        etiquetaConfirmar="Eliminar"
        onCancelar={() => setHorarioPorBorrar(null)}
        onConfirmar={async () => {
          if (!horarioPorBorrar) return;
          const { error: errorRespuesta } = await conReintentoDeAuth(() =>
            apiClient.DELETE("/api/agenda/horarios/{id}/", {
              params: { path: { id: horarioPorBorrar.id } },
            }),
          );
          setHorarioPorBorrar(null);
          if (errorRespuesta) {
            mostrar("error", "No se pudo eliminar el horario.");
            return;
          }
          mostrar("exito", "Horario eliminado.");
          await cargar();
        }}
      />
    </div>
  );
}

function ModalNuevaCita({
  servicios,
  empleados,
  diaSeleccionado,
  onCerrar,
  onCreada,
}: {
  servicios: Servicio[];
  empleados: MiembroNegocio[];
  diaSeleccionado: Date;
  onCerrar: () => void;
  onCreada: () => void;
}) {
  const serviciosActivos = servicios.filter((servicio) => servicio.activo);
  const [servicio, setServicio] = useState<number | "">(serviciosActivos[0]?.id ?? "");
  const [empleado, setEmpleado] = useState<number | typeof CUALQUIERA>(CUALQUIERA);
  const [fechaHora, setFechaHora] = useState(paraInputFechaHora(diaSeleccionado));
  const [nombreCliente, setNombreCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!servicio) {
      setError("Elige un servicio.");
      return;
    }

    setGuardando(true);
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/agenda/citas/", {
        body: {
          servicio: servicio as number,
          empleado: empleado === CUALQUIERA ? null : empleado,
          fecha_hora_inicio: new Date(fechaHora).toISOString(),
          nombre_cliente: nombreCliente,
          telefono_cliente: telefonoCliente,
          notas: "",
        },
      }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError(
        "No hay disponibilidad en ese horario. Prueba otra hora, u otro empleado, y verifica que tenga horario cargado ese día.",
      );
      return;
    }

    onCreada();
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Agendar cita"
      descripcion="Si no eliges empleado, se asigna automáticamente el primero disponible."
    >
      {serviciosActivos.length === 0 ? (
        <EstadoVacio
          icono="content_cut"
          titulo="No hay servicios activos"
          descripcion="Necesitas al menos un servicio activo para poder agendar una cita."
        />
      ) : (
        <form className="flex flex-col gap-md" onSubmit={handleSubmit}>
          <Select
            label="Servicio"
            value={servicio}
            onChange={(e) => setServicio(Number(e.target.value))}
            required
          >
            {serviciosActivos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} ({item.duracion_minutos} min)
              </option>
            ))}
          </Select>

          <Select
            label="Empleado"
            value={empleado}
            onChange={(e) =>
              setEmpleado(e.target.value === CUALQUIERA ? CUALQUIERA : Number(e.target.value))
            }
            ayuda="«Cualquiera disponible» deja que el sistema elija por ti."
          >
            <option value={CUALQUIERA}>✨ Cualquiera disponible</option>
            {empleados.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre}
              </option>
            ))}
          </Select>

          <Input
            label="Fecha y hora"
            type="datetime-local"
            value={fechaHora}
            onChange={(e) => setFechaHora(e.target.value)}
            required
          />

          <Input
            label="Nombre del cliente"
            value={nombreCliente}
            onChange={(e) => setNombreCliente(e.target.value)}
            placeholder="Ej: María González"
            required
          />

          <Input
            label="Teléfono del cliente"
            type="tel"
            value={telefonoCliente}
            onChange={(e) => setTelefonoCliente(e.target.value)}
            placeholder="+57 300 000 0000"
          />

          {error && (
            <p role="alert" className="flex items-start gap-xs font-caption text-caption text-error">
              <Icon name="error" className="shrink-0 text-[18px]" />
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
            <Button type="button" variante="ghost" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando}>
              Agendar
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ModalHorarios({
  empleados,
  horarios,
  onCerrar,
  onCambio,
  onPedirBorrado,
}: {
  empleados: MiembroNegocio[];
  horarios: HorarioTrabajo[];
  onCerrar: () => void;
  onCambio: () => Promise<void>;
  onPedirBorrado: (horario: HorarioTrabajo) => void;
}) {
  const { mostrar } = useToast();
  const [datos, setDatos] = useState<HorarioTrabajoInput>({
    ...HORARIO_VACIO,
    miembro: empleados[0]?.id ?? 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!datos.miembro) {
      setError("Elige un empleado.");
      return;
    }
    if (datos.hora_inicio >= datos.hora_fin) {
      setError("La hora de inicio debe ser anterior a la de fin.");
      return;
    }

    setGuardando(true);
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/agenda/horarios/", { body: datos as HorarioTrabajo }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError("No se pudo guardar el horario.");
      return;
    }

    mostrar("exito", "Horario agregado.");
    await onCambio();
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Horarios de trabajo"
      descripcion="Disponibilidad semanal de cada empleado. Para un descanso al mediodía, crea dos bloques el mismo día."
    >
      <div className="space-y-md">
        <form className="space-y-md rounded-xl bg-surface-container-low p-4" onSubmit={handleSubmit}>
          <Select
            label="Empleado"
            value={datos.miembro}
            onChange={(e) => setDatos({ ...datos, miembro: Number(e.target.value) })}
            required
          >
            {empleados.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.nombre}
              </option>
            ))}
          </Select>

          <Select
            label="Día"
            value={datos.dia_semana}
            onChange={(e) =>
              setDatos({
                ...datos,
                dia_semana: Number(e.target.value) as HorarioTrabajoInput["dia_semana"],
              })
            }
          >
            {DIAS_SEMANA.map((dia, indice) => (
              <option key={dia} value={indice}>
                {dia}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Desde"
              type="time"
              value={datos.hora_inicio.slice(0, 5)}
              onChange={(e) => setDatos({ ...datos, hora_inicio: `${e.target.value}:00` })}
              required
            />
            <Input
              label="Hasta"
              type="time"
              value={datos.hora_fin.slice(0, 5)}
              onChange={(e) => setDatos({ ...datos, hora_fin: `${e.target.value}:00` })}
              required
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-xs font-caption text-caption text-error">
              <Icon name="error" className="text-[18px]" />
              {error}
            </p>
          )}

          <Button type="submit" icono="add" anchoCompleto cargando={guardando}>
            Agregar bloque
          </Button>
        </form>

        <div>
          <h3 className="mb-2 font-label-md text-label-md text-on-surface-variant">
            Bloques cargados
          </h3>
          {horarios.length === 0 ? (
            <p className="rounded-lg bg-surface-container-low p-4 text-center font-body-md text-body-md text-on-surface-variant">
              Todavía no hay horarios. Sin ellos, no se puede agendar ninguna cita.
            </p>
          ) : (
            <ul className="space-y-2">
              {horarios.map((horario) => {
                const empleado = empleados.find((item) => item.id === horario.miembro);
                return (
                  <li
                    key={horario.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-label-md text-label-md text-primary">
                        {empleado?.nombre ?? "Empleado"}
                      </p>
                      <p className="font-caption text-caption text-on-surface-variant">
                        {DIAS_SEMANA[horario.dia_semana]} · {horario.hora_inicio.slice(0, 5)} –{" "}
                        {horario.hora_fin.slice(0, 5)}
                      </p>
                    </div>
                    <Button
                      variante="ghost"
                      onClick={() => onPedirBorrado(horario)}
                      aria-label="Eliminar bloque de horario"
                      className="px-2 text-error"
                    >
                      <Icon name="delete" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
