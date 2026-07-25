import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import type { HorarioTrabajoInput } from "../api/types";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";

type Cita = components["schemas"]["Cita"];
type Servicio = components["schemas"]["Servicio"];
type MiembroNegocio = components["schemas"]["MiembroNegocio"];
type HorarioTrabajo = components["schemas"]["HorarioTrabajo"];

const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

const CUALQUIERA_DISPONIBLE = "cualquiera";

const NUEVO_HORARIO: HorarioTrabajoInput = {
  miembro: 0,
  dia_semana: 0,
  hora_inicio: "09:00:00",
  hora_fin: "18:00:00",
};

interface NuevaCitaForm {
  servicio: number | "";
  empleado: number | typeof CUALQUIERA_DISPONIBLE;
  fecha_hora_inicio: string;
  nombre_cliente: string;
  telefono_cliente: string;
}

const NUEVA_CITA_VACIA: NuevaCitaForm = {
  servicio: "",
  empleado: CUALQUIERA_DISPONIBLE,
  fecha_hora_inicio: "",
  nombre_cliente: "",
  telefono_cliente: "",
};

// Transiciones válidas por estado (ver apps/agenda/services.py del backend).
type AccionCita = "confirmar" | "completar" | "cancelar";

const ACCIONES_POR_ESTADO: Record<string, Array<{ accion: AccionCita; etiqueta: string }>> = {
  agendada: [
    { accion: "confirmar", etiqueta: "Confirmar" },
    { accion: "cancelar", etiqueta: "Cancelar" },
  ],
  confirmada: [
    { accion: "completar", etiqueta: "Completar" },
    { accion: "cancelar", etiqueta: "Cancelar" },
  ],
  completada: [],
  cancelada: [],
};

export function AgendaPage() {
  const { membresia } = useAuth();
  const puedeGestionar = membresia?.puede_gestionar_agenda ?? false;

  const [empleados, setEmpleados] = useState<MiembroNegocio[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [horarios, setHorarios] = useState<HorarioTrabajo[]>([]);
  const [cargando, setCargando] = useState(true);

  const [nuevoHorario, setNuevoHorario] = useState<HorarioTrabajoInput>(NUEVO_HORARIO);
  const [errorHorario, setErrorHorario] = useState<string | null>(null);

  const [nuevaCita, setNuevaCita] = useState<NuevaCitaForm>(NUEVA_CITA_VACIA);
  const [errorCita, setErrorCita] = useState<string | null>(null);

  async function cargarTodo() {
    setCargando(true);
    const [empleadosResp, serviciosResp, citasResp, horariosResp] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/empleados/")),
      conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
      conReintentoDeAuth(() => apiClient.GET("/api/agenda/citas/")),
      conReintentoDeAuth(() => apiClient.GET("/api/agenda/horarios/")),
    ]);
    setEmpleados(empleadosResp.data ?? []);
    setServicios(serviciosResp.data ?? []);
    setCitas(citasResp.data ?? []);
    setHorarios(horariosResp.data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargarTodo();
  }, []);

  async function handleCrearHorario(evento: FormEvent) {
    evento.preventDefault();
    setErrorHorario(null);

    if (!nuevoHorario.miembro) {
      setErrorHorario("Elige un empleado.");
      return;
    }

    const { error } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/agenda/horarios/", {
        body: nuevoHorario as components["schemas"]["HorarioTrabajo"],
      }),
    );

    if (error) {
      setErrorHorario("No se pudo guardar el horario. Revisa que hora_inicio sea antes de hora_fin.");
      return;
    }

    setNuevoHorario(NUEVO_HORARIO);
    await cargarTodo();
  }

  async function handleBorrarHorario(horarioId: number) {
    const { error } = await conReintentoDeAuth(() =>
      apiClient.DELETE("/api/agenda/horarios/{id}/", { params: { path: { id: horarioId } } }),
    );
    if (!error) {
      await cargarTodo();
    }
  }

  async function handleCrearCita(evento: FormEvent) {
    evento.preventDefault();
    setErrorCita(null);

    if (!nuevaCita.servicio || !nuevaCita.fecha_hora_inicio || !nuevaCita.nombre_cliente) {
      setErrorCita("Completa servicio, fecha/hora y nombre del cliente.");
      return;
    }

    const { data, error } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/agenda/citas/", {
        body: {
          servicio: nuevaCita.servicio as number,
          empleado: nuevaCita.empleado === CUALQUIERA_DISPONIBLE ? null : nuevaCita.empleado,
          fecha_hora_inicio: new Date(nuevaCita.fecha_hora_inicio).toISOString(),
          nombre_cliente: nuevaCita.nombre_cliente,
          telefono_cliente: nuevaCita.telefono_cliente,
          notas: "",
        },
      }),
    );

    if (error || !data) {
      setErrorCita(
        "No se pudo agendar: probablemente no hay ningún empleado disponible en ese horario.",
      );
      return;
    }

    setNuevaCita(NUEVA_CITA_VACIA);
    await cargarTodo();
  }

  async function handleTransicion(
    citaId: number,
    accion: "confirmar" | "completar" | "cancelar",
  ) {
    const path = { id: citaId };
    const { error } = await conReintentoDeAuth(() => {
      if (accion === "confirmar") {
        return apiClient.POST("/api/agenda/citas/{id}/confirmar/", { params: { path } });
      }
      if (accion === "completar") {
        return apiClient.POST("/api/agenda/citas/{id}/completar/", { params: { path } });
      }
      return apiClient.POST("/api/agenda/citas/{id}/cancelar/", { params: { path } });
    });
    if (!error) {
      await cargarTodo();
    }
  }

  if (cargando) return <p>Cargando…</p>;

  return (
    <div>
      <h1>Agenda</h1>

      {puedeGestionar && (
        <section>
          <h2>Horario de un empleado</h2>
          <form className="formulario-inline" onSubmit={handleCrearHorario}>
            <label>
              Empleado
              <select
                value={nuevoHorario.miembro}
                onChange={(e) =>
                  setNuevoHorario({ ...nuevoHorario, miembro: Number(e.target.value) })
                }
                required
              >
                <option value={0} disabled>
                  Elige un empleado…
                </option>
                {empleados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre} ({empleado.email})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Día
              <select
                value={nuevoHorario.dia_semana}
                onChange={(e) =>
                  setNuevoHorario({
                    ...nuevoHorario,
                    dia_semana: Number(e.target.value) as HorarioTrabajoInput["dia_semana"],
                  })
                }
              >
                {DIAS_SEMANA.map((dia, indice) => (
                  <option key={dia} value={indice}>
                    {dia}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Desde
              <input
                type="time"
                value={nuevoHorario.hora_inicio.slice(0, 5)}
                onChange={(e) =>
                  setNuevoHorario({ ...nuevoHorario, hora_inicio: `${e.target.value}:00` })
                }
              />
            </label>
            <label>
              Hasta
              <input
                type="time"
                value={nuevoHorario.hora_fin.slice(0, 5)}
                onChange={(e) =>
                  setNuevoHorario({ ...nuevoHorario, hora_fin: `${e.target.value}:00` })
                }
              />
            </label>
            {errorHorario && <p className="mensaje-error">{errorHorario}</p>}
            <button type="submit">Guardar horario</button>
          </form>

          {horarios.length > 0 && (
            <table className="tabla">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Día</th>
                  <th>Desde</th>
                  <th>Hasta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {horarios.map((horario) => (
                  <tr key={horario.id}>
                    <td>
                      {empleados.find((empleado) => empleado.id === horario.miembro)?.nombre ??
                        "—"}
                    </td>
                    <td>{DIAS_SEMANA[horario.dia_semana]}</td>
                    <td>{horario.hora_inicio.slice(0, 5)}</td>
                    <td>{horario.hora_fin.slice(0, 5)}</td>
                    <td>
                      <button type="button" onClick={() => handleBorrarHorario(horario.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {puedeGestionar && (
        <section>
          <h2>Agendar cita</h2>
          <form className="formulario-inline" onSubmit={handleCrearCita}>
            <label>
              Servicio
              <select
                value={nuevaCita.servicio}
                onChange={(e) =>
                  setNuevaCita({ ...nuevaCita, servicio: Number(e.target.value) })
                }
                required
              >
                <option value="" disabled>
                  Elige un servicio…
                </option>
                {servicios.map((servicio) => (
                  <option key={servicio.id} value={servicio.id}>
                    {servicio.nombre} ({servicio.duracion_minutos} min)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Empleado
              <select
                value={nuevaCita.empleado}
                onChange={(e) =>
                  setNuevaCita({
                    ...nuevaCita,
                    empleado:
                      e.target.value === CUALQUIERA_DISPONIBLE
                        ? CUALQUIERA_DISPONIBLE
                        : Number(e.target.value),
                  })
                }
              >
                <option value={CUALQUIERA_DISPONIBLE}>Cualquiera disponible</option>
                {empleados.map((empleado) => (
                  <option key={empleado.id} value={empleado.id}>
                    {empleado.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha y hora
              <input
                type="datetime-local"
                value={nuevaCita.fecha_hora_inicio}
                onChange={(e) =>
                  setNuevaCita({ ...nuevaCita, fecha_hora_inicio: e.target.value })
                }
                required
              />
            </label>
            <label>
              Nombre del cliente
              <input
                value={nuevaCita.nombre_cliente}
                onChange={(e) => setNuevaCita({ ...nuevaCita, nombre_cliente: e.target.value })}
                required
              />
            </label>
            <label>
              Teléfono del cliente
              <input
                value={nuevaCita.telefono_cliente}
                onChange={(e) =>
                  setNuevaCita({ ...nuevaCita, telefono_cliente: e.target.value })
                }
              />
            </label>
            {errorCita && <p className="mensaje-error">{errorCita}</p>}
            <button type="submit">Agendar</button>
          </form>
        </section>
      )}

      <section>
        <h2>Citas</h2>
        {citas.length === 0 ? (
          <p>No hay citas agendadas todavía.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Servicio</th>
                <th>Empleado</th>
                <th>Fecha</th>
                <th>Estado</th>
                {puedeGestionar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {citas.map((cita) => (
                <tr key={cita.id}>
                  <td>{cita.nombre_cliente}</td>
                  <td>{cita.servicio_nombre}</td>
                  <td>{cita.empleado_nombre}</td>
                  <td>{new Date(cita.fecha_hora_inicio).toLocaleString()}</td>
                  <td>{cita.estado}</td>
                  {puedeGestionar && (
                    <td>
                      {ACCIONES_POR_ESTADO[cita.estado]?.map(({ accion, etiqueta }) => (
                        <button
                          key={accion}
                          type="button"
                          onClick={() => handleTransicion(cita.id, accion)}
                        >
                          {etiqueta}
                        </button>
                      ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
