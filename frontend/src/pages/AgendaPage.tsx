import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { ACCIONES_POR_ESTADO, ESTILO_ESTADO } from "../ui/EstadoCita";
import type { AccionCita } from "../ui/EstadoCita";
import { formatearMoneda } from "../ui/moneda";
import { Badge, EstadoError, EstadoVacio, SkeletonLista } from "../ui/Feedback";
import { DatePicker } from "../ui/DatePicker";
import { DateTimePicker } from "../ui/DateTimePicker";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { Modal, ModalConfirmacion } from "../ui/Modal";
import { SelectCustom, SelectItem } from "../ui/SelectCustom";
import { Tabs, TabsLista, TabsTrigger } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import { usePermisos } from "../permisos/usePermisos";
import { ModalHorarioSemanal } from "./agenda/ModalHorarioSemanal";
import { franjasDeEmpleado, franjasDelEquipo } from "./agenda/horarioEfectivo";
import { VistaSemana } from "./agenda/VistaSemana";

type Cita = components["schemas"]["Cita"];
type Servicio = components["schemas"]["Servicio"];
type MiembroEquipo = components["schemas"]["MiembroEquipo"];
type HorarioNegocio = components["schemas"]["HorarioNegocio"];
type HorarioTrabajo = components["schemas"]["HorarioTrabajo"];

const DIAS_CORTOS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

/** Qué se le dice a la persona después de cada transición. `completar`
 * no está acá porque su mensaje incluye el total de la cuenta recién
 * creada, que solo se conoce con la respuesta en la mano. */
const MENSAJE_TRANSICION: Record<Exclude<AccionCita, "completar">, string> = {
  confirmar: "Cita confirmada.",
  "en-atencion": "Cliente en atención.",
  cancelar: "Cita cancelada.",
  "no-show": "Marcada como no asistió.",
};
const CUALQUIERA = "cualquiera";

/** 7 días desde `inicio`, para el selector horizontal del diseño.
 *
 * `inicio` es un parámetro y no siempre "hoy" para que el ícono de
 * calendario pueda recentrar la tira alrededor de una fecha elegida
 * fuera del rango visible — si no, una cita agendada a más de una
 * semana quedaba inalcanzable: no había forma de seleccionar ese día. */
function proximosDias(inicio: Date, cantidad = 7): Date[] {
  const base = new Date(inicio);
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: cantidad }, (_, indice) => {
    const dia = new Date(base);
    dia.setDate(base.getDate() + indice);
    return dia;
  });
}

function inicioDeHoy(): Date {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
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

export function AgendaPage() {
  const { membresia } = useAuth();
  const { mostrar } = useToast();
  const { puede } = usePermisos();
  const puedeGestionar = puede("puede_gestionar_agenda");
  const puedeConfigurarHorarios = puede("puede_configurar_horarios");
  // Sin esto el backend solo devuelve las citas propias, así que filtrar
  // por compañero no tiene nada que filtrar (ver CONTRATO.md 5.8).
  const veAgendaCompleta = puede("puede_ver_agenda_completa");

  const [inicioVentana, setInicioVentana] = useState<Date>(inicioDeHoy);
  const dias = useMemo(() => proximosDias(inicioVentana), [inicioVentana]);
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(inicioDeHoy);
  const [empleadoFiltro, setEmpleadoFiltro] = useState<number | "todos">("todos");

  const [citas, setCitas] = useState<Cita[]>([]);
  const [empleados, setEmpleados] = useState<MiembroEquipo[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [horarios, setHorarios] = useState<HorarioTrabajo[]>([]);
  const [horarioNegocio, setHorarioNegocio] = useState<HorarioNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [citaAbierta, setCitaAbierta] = useState<number | null>(null);
  const [formularioCita, setFormularioCita] = useState(false);
  const [panelHorarios, setPanelHorarios] = useState(false);
  const [porCancelar, setPorCancelar] = useState<Cita | null>(null);
  const [vista, setVista] = useState<"lista" | "semana">("lista");

  async function cargar() {
    setCargando(true);
    setError(false);
    const [citasResp, empleadosResp, serviciosResp, horariosResp, horarioNegocioResp] =
      await Promise.all([
        conReintentoDeAuth(() => apiClient.GET("/api/agenda/citas/")),
        conReintentoDeAuth(() => apiClient.GET("/api/negocios/equipo/")),
        conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
        conReintentoDeAuth(() => apiClient.GET("/api/agenda/horarios/")),
        conReintentoDeAuth(() => apiClient.GET("/api/agenda/horario-negocio/")),
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
    setHorarioNegocio(horarioNegocioResp.data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  /** Saltar a cualquier fecha (desde el `DatePicker`): recentra la tira
   * de 7 días para que arranque ahí, no solo mueve la selección — si no,
   * el día elegido podría seguir sin tener pastilla visible. */
  function irAFecha(fecha: Date) {
    const normalizada = new Date(fecha);
    normalizada.setHours(0, 0, 0, 0);
    setInicioVentana(normalizada);
    setDiaSeleccionado(normalizada);
  }

  const citasVisibles = citas
    .filter((cita) => mismoDia(cita.fecha_hora_inicio, diaSeleccionado))
    .filter((cita) => empleadoFiltro === "todos" || cita.empleado === empleadoFiltro)
    .sort((a, b) => a.fecha_hora_inicio.localeCompare(b.fecha_hora_inicio));

  // La banda de disponibilidad de la grilla ya no sale directo de
  // `horarios`: la mayoría de los empleados no tiene horario propio y
  // hereda el del negocio (ver CONTRATO.md 5.7).
  const franjasVisibles = useMemo(() => {
    // Quien solo ve sus citas ve también solo su propia disponibilidad:
    // pintar la banda del equipo entero contradiría la lista de al lado.
    if (!veAgendaCompleta) {
      return membresia ? franjasDeEmpleado(membresia.id, horarios, horarioNegocio) : [];
    }
    return empleadoFiltro === "todos"
      ? franjasDelEquipo(
          empleados.map((empleado) => empleado.id),
          horarios,
          horarioNegocio,
        )
      : franjasDeEmpleado(empleadoFiltro, horarios, horarioNegocio);
  }, [veAgendaCompleta, membresia, empleadoFiltro, empleados, horarios, horarioNegocio]);

  async function transicionar(cita: Cita, accion: AccionCita) {
    const path = { id: cita.id };

    // `completar` es la única que no es un cambio de estado a secas:
    // genera la cuenta por cobrar, y por eso responde `{cita, venta}` en
    // vez de la cita sola. Se separa acá arriba para no tener que
    // desambiguar la forma de la respuesta más abajo.
    if (accion === "completar") {
      const { data, error } = await conReintentoDeAuth(() =>
        apiClient.POST("/api/agenda/citas/{id}/completar/", { params: { path } }),
      );
      if (error || !data) {
        mostrar("error", "No se pudo completar la cita.");
        return;
      }
      setCitas((actual) => actual.map((item) => (item.id === cita.id ? data.cita : item)));
      // El monto sale de la venta, no del precio del catálogo: la venta
      // congeló el suyo al crearse y son dos números que pueden diferir.
      mostrar(
        "exito",
        `Listo. Quedó una cuenta de ${formatearMoneda(data.venta.total)} por cobrar en caja.`,
      );
      return;
    }

    const respuesta = await conReintentoDeAuth(() => {
      if (accion === "confirmar")
        return apiClient.POST("/api/agenda/citas/{id}/confirmar/", { params: { path } });
      if (accion === "en-atencion")
        return apiClient.POST("/api/agenda/citas/{id}/en-atencion/", { params: { path } });
      if (accion === "no-show")
        return apiClient.POST("/api/agenda/citas/{id}/no-show/", { params: { path } });
      return apiClient.POST("/api/agenda/citas/{id}/cancelar/", { params: { path } });
    });

    if (respuesta.error || !respuesta.data) {
      mostrar("error", "No se pudo actualizar la cita.");
      return;
    }

    setCitas((actual) =>
      actual.map((item) => (item.id === cita.id ? (respuesta.data as Cita) : item)),
    );
    mostrar("exito", MENSAJE_TRANSICION[accion]);
  }

  return (
    <div className="space-y-6">
      {/* El título "Agenda" ya lo muestra la TopAppBar de escritorio
          (Layout.tsx); acá solo se repite en mobile, que no tiene esa
          barra. El subtítulo con el conteo del día se queda siempre. */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 lg:hidden">
            <Icon name="calendar_today" className="text-[20px] text-primary" />
          </span>
          <div>
            <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary lg:hidden">
              Agenda
            </h1>
            <p className="text-[12px] text-on-surface-variant">
              {citasVisibles.length} {citasVisibles.length === 1 ? "cita" : "citas"} · {diaSeleccionado.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
        </div>
        {(puedeConfigurarHorarios || puedeGestionar) && (
          <div className="flex shrink-0 gap-2">
            {puedeConfigurarHorarios && (
              <Button
                variante="secondary"
                icono="schedule"
                onClick={() => setPanelHorarios(true)}
                aria-label="Gestionar horarios"
              >
                <span className="hidden sm:inline">Horarios</span>
              </Button>
            )}
            {puedeGestionar && (
              <Button
                icono="add"
                onClick={() => setFormularioCita(true)}
                aria-label="Agendar cita"
              >
                <span className="hidden sm:inline">Agendar</span>
              </Button>
            )}
          </div>
        )}
      </header>

      {/* Filtro por empleado tipo Segmented Control */}
      {veAgendaCompleta && (
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setEmpleadoFiltro("todos")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0",
              empleadoFiltro === "todos"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            Todos
          </button>
          {empleados.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => setEmpleadoFiltro(emp.id)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shrink-0",
                empleadoFiltro === emp.id
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {emp.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Selector de vista */}
      <div className="hidden justify-end lg:flex">
        <Tabs valor={vista} onChange={(val) => setVista(val as "lista" | "semana")}>
          <TabsLista variante="pill">
            <TabsTrigger value="lista" variante="pill">Lista</TabsTrigger>
            <TabsTrigger value="semana" variante="pill">Semana</TabsTrigger>
          </TabsLista>
        </Tabs>
      </div>

      {/* Selector de día. La tira solo cubre 7 días — el ícono de
          calendario abre un selector completo para saltar a cualquier
          fecha (así aparecen citas agendadas con más anticipación, que
          antes no había forma de alcanzar). */}
      <div
        className={cn(
          "flex items-center gap-2",
          vista === "semana" && "lg:hidden",
        )}
      >
        <div className="hide-scrollbar -mx-margin-mobile flex flex-1 gap-2.5 overflow-x-auto px-margin-mobile pb-1 md:mx-0 md:px-0">
          {dias.map((dia) => {
            const activo = dia.toDateString() === diaSeleccionado.toDateString();
            const indiceDia = (dia.getDay() + 6) % 7;
            const tieneCitas = citas.some((c) => mismoDia(c.fecha_hora_inicio, dia));
            return (
              <button
                key={dia.toISOString()}
                type="button"
                onClick={() => setDiaSeleccionado(dia)}
                aria-pressed={activo}
                className={cn(
                  "tactile relative flex h-19 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-all",
                  activo
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200 font-semibold"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300",
                )}
              >
                <span className={cn("text-[10px] font-bold uppercase tracking-wider", !activo && "text-slate-400")}>
                  {DIAS_CORTOS[indiceDia]}
                </span>
                <span className="text-xl font-extrabold">{dia.getDate()}</span>
                {tieneCitas && !activo && (
                  <span className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>

        <DatePicker
          valor={diaSeleccionado}
          onChange={irAFecha}
          trigger={
            <button
              type="button"
              aria-label="Ir a una fecha"
              className="flex h-19 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-emerald-300 hover:text-emerald-600"
            >
              <Icon name="calendar_month" className="text-[22px]" />
            </button>
          }
        />
      </div>

      {/* Grilla semanal: solo en pantallas anchas y si está elegida. */}
      {vista === "semana" && !cargando && !error && (
        <div className="hidden lg:block">
          <VistaSemana
            dias={dias}
            citas={
              empleadoFiltro === "todos"
                ? citas
                : citas.filter((cita) => cita.empleado === empleadoFiltro)
            }
            horarios={franjasVisibles}
            diaSeleccionado={diaSeleccionado}
            onSeleccionarDia={setDiaSeleccionado}
            onAbrirCita={(cita) => {
              setDiaSeleccionado(new Date(cita.fecha_hora_inicio));
              setCitaAbierta(cita.id);
              setVista("lista");
            }}
          />
        </div>
      )}

      {/* Timeline de citas */}
      <div className={cn(vista === "semana" && "lg:hidden")}>
      {cargando ? (
        <SkeletonLista />
      ) : error ? (
        <EstadoError
          mensaje="No pudimos cargar la agenda. Revisa tu conexión."
          onReintentar={cargar}
        />
      ) : citasVisibles.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl px-6 py-14 text-center">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle,rgba(16,185,129,0.12)_0%,rgba(16,185,129,0)_70%)]" />
          <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
            <div className="absolute inset-0 scale-150 rounded-full bg-emerald-500/10" />
            <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full border border-slate-200/60 bg-white shadow-lg">
              <Icon name="calendar_today" filled className="text-[48px] text-emerald-500" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Sin citas para este día</h3>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            No hay turnos agendados en la fecha seleccionada. Puedes programar una cita manualmente.
          </p>
          {puedeGestionar && (
            <button
              type="button"
              onClick={() => setFormularioCita(true)}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-8 py-4 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 active:scale-95"
            >
              <Icon name="add" className="text-[18px]" />
              Agendar cita
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {citasVisibles.map((cita) => {
            const estilo = ESTILO_ESTADO[cita.estado];
            const acciones = ACCIONES_POR_ESTADO[cita.estado];
            const abierta = citaAbierta === cita.id;
            const puedeTransicionar = puedeGestionar || cita.empleado === membresia?.id;

            return (
              <li key={cita.id} className="animate-slide-in-bottom">
                <div
                  className={cn(
                    "rounded-xl border bg-white transition-all",
                    abierta ? "border-menta/30 shadow-card-soft" : "border-outline-variant/60 hover:shadow-card-soft",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setCitaAbierta(abierta ? null : cita.id)}
                    aria-expanded={abierta}
                    className="flex w-full items-center gap-3 p-3.5 text-left"
                  >
                    {/* Hora */}
                    <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-container-low">
                      <span className="text-[11px] font-bold leading-tight text-primary">
                        {hora(cita.fecha_hora_inicio).split(":")[0]}
                      </span>
                      <span className="text-[10px] leading-tight text-on-surface-variant">
                        :{hora(cita.fecha_hora_inicio).split(":")[1]}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-label-md text-label-md text-on-surface">
                        {cita.nombre_cliente}
                      </p>
                      <p className="truncate text-[12px] text-on-surface-variant">
                        {cita.servicio_nombre} · {cita.empleado_nombre}
                      </p>
                    </div>

                    <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
                  </button>

                  {abierta && (
                    <div className="animate-fade-in border-t border-outline-variant/40 px-3.5 pb-3.5 pt-3">
                      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <Icon name="schedule" className="text-[14px]" />
                          {hora(cita.fecha_hora_inicio)} – {hora(cita.fecha_hora_fin)}
                        </span>
                        {cita.telefono_cliente && (
                          <span className="flex items-center gap-1">
                            <Icon name="call" className="text-[14px]" />
                            {cita.telefono_cliente}
                          </span>
                        )}
                      </div>

                      {/* La cuenta que generó esta cita, si ya se
                          completó. Es el único punto donde la agenda
                          habla de dinero, y a propósito solo informa: se
                          cobra en Caja, no acá. */}
                      {cita.venta_estado && (
                        <p className="mb-3 flex items-center gap-1.5 font-caption text-caption text-on-surface-variant">
                          <Icon name="receipt_long" className="text-[14px]" />
                          {cita.venta_estado === "pagada"
                            ? "Cuenta cobrada."
                            : cita.venta_estado === "anulada"
                              ? "La cuenta se anuló."
                              : "Quedó una cuenta por cobrar en Caja."}
                        </p>
                      )}

                      {puedeTransicionar && acciones.length > 0 ? (
                        // `flex-wrap` y no una sola fila: desde que
                        // `confirmada` ofrece cuatro acciones, en un
                        // teléfono angosto no caben sin quedar en botones
                        // de dos letras que se tocan mal.
                        <div className="flex flex-wrap gap-2">
                          {acciones.map(({ accion, etiqueta, icono }) => (
                            <Button
                              key={accion}
                              variante={
                                accion === "cancelar" || accion === "no-show"
                                  ? "danger"
                                  : accion === "completar"
                                    ? "primary"
                                    : "accent"
                              }
                              icono={icono}
                              tamano="sm"
                              className="min-w-[calc(50%-0.25rem)] flex-1"
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
                        <p className="text-[12px] text-on-surface-variant">
                          {acciones.length === 0
                            ? "Esta cita ya no admite cambios de estado."
                            : "Solo puedes cambiar el estado de tus propias citas."}
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
      </div>

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

      <ModalHorarioSemanal
        abierto={panelHorarios}
        onCerrar={() => setPanelHorarios(false)}
        empleados={empleados}
        horarioNegocio={horarioNegocio}
        horarios={horarios}
        onCambio={cargar}
      />

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
  empleados: MiembroEquipo[];
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
        <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
          <SelectCustom
            label="Servicio"
            valor={servicio ? String(servicio) : ""}
            onChange={(val) => setServicio(Number(val))}
            placeholder="Elige un servicio"
          >
            {serviciosActivos.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {item.nombre} ({item.duracion_minutos} min)
              </SelectItem>
            ))}
          </SelectCustom>

          <SelectCustom
            label="Empleado"
            valor={String(empleado)}
            onChange={(val) =>
              setEmpleado(val === CUALQUIERA ? CUALQUIERA : Number(val))
            }
            ayuda="«Cualquiera disponible» deja que el sistema elija por ti."
          >
            <SelectItem value={CUALQUIERA}>✨ Cualquiera disponible</SelectItem>
            {empleados.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {item.nombre}
              </SelectItem>
            ))}
          </SelectCustom>

          <DateTimePicker
            label="Fecha y hora"
            valor={fechaHora}
            onChange={(val) => setFechaHora(val)}
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
            <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
              <Icon name="error" className="shrink-0 text-[18px]" />
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
