import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import { Button } from "../../ui/Button";
import { Badge, Card, EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { ESTILO_ESTADO_REGISTRO } from "../../ui/EstadoRegistroServicio";
import { Icon } from "../../ui/Icon";
import { Modal, ModalConfirmacion } from "../../ui/Modal";
import { SelectCustom, SelectItem } from "../../ui/SelectCustom";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { useToast } from "../../ui/Toast";
import { FiltroPeriodo } from "./FiltroPeriodo";
import { paraQuery, rangoDe } from "./filtrosPeriodo";
import type { Periodo } from "./filtrosPeriodo";

type RegistroServicio = components["schemas"]["RegistroServicio"];
type MiembroEquipo = components["schemas"]["MiembroEquipo"];

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Completados" es cómo el dueño del negocio piensa en un servicio ya
// validado, aunque el valor que viaja a la API siga siendo `aprobado`
// (`CONTRATO.md` 5.13) — cambiar el enum del backend por esto no valía
// la pena, es solo cómo se nombra en esta pantalla.
type Filtro = "pendiente" | "aprobado" | "todos";
const TODOS_LOS_EMPLEADOS = "todos";

export function ValidarServiciosPage() {
  const { mostrar } = useToast();

  const [filtro, setFiltro] = useState<Filtro>("pendiente");
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [referencia, setReferencia] = useState(new Date());
  const [empleadoFiltro, setEmpleadoFiltro] = useState(TODOS_LOS_EMPLEADOS);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [registros, setRegistros] = useState<RegistroServicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [porAprobar, setPorAprobar] = useState<RegistroServicio | null>(null);
  const [aprobando, setAprobando] = useState(false);
  const [porRechazar, setPorRechazar] = useState<RegistroServicio | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [errorRechazo, setErrorRechazo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    const rango = paraQuery(rangoDe(periodo, referencia));
    const [registrosResp, equipoResp] = await Promise.all([
      conReintentoDeAuth(() =>
        apiClient.GET("/api/servicios/registros/", {
          params: {
            query: {
              ...rango,
              estado: filtro === "todos" ? undefined : filtro,
              empleado: empleadoFiltro === TODOS_LOS_EMPLEADOS ? undefined : Number(empleadoFiltro),
            },
          },
        }),
      ),
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/equipo/")),
    ]);

    if (registrosResp.error) {
      setError(true);
    } else {
      setRegistros(registrosResp.data ?? []);
      setEquipo(equipoResp.data ?? []);
    }
    setCargando(false);
  }, [filtro, periodo, referencia, empleadoFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function aprobar() {
    if (!porAprobar) return;
    setAprobando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/servicios/registros/{id}/aprobar/", {
        params: { path: { id: porAprobar.id } },
      }),
    );
    setAprobando(false);
    setPorAprobar(null);

    if (errorRespuesta || !data) {
      mostrar("error", "No se pudo aprobar. Puede que ya lo hayan revisado.");
      return;
    }
    aplicarActualizacion(data);
    mostrar("exito", "Servicio aprobado.");
  }

  function abrirRechazo(registro: RegistroServicio) {
    setPorRechazar(registro);
    setMotivoRechazo("");
    setErrorRechazo(null);
  }

  async function rechazar(evento: FormEvent) {
    evento.preventDefault();
    if (!porRechazar) return;
    if (!motivoRechazo.trim()) {
      setErrorRechazo("Explica por qué se rechaza.");
      return;
    }

    setRechazando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/servicios/registros/{id}/rechazar/", {
        params: { path: { id: porRechazar.id } },
        body: { motivo: motivoRechazo.trim() },
      }),
    );
    setRechazando(false);

    if (errorRespuesta || !data) {
      setErrorRechazo("No se pudo rechazar. Puede que ya lo hayan revisado.");
      return;
    }
    aplicarActualizacion(data);
    mostrar("exito", "Servicio rechazado.");
    setPorRechazar(null);
  }

  /** Tras revisar, el registro sale de la lista si ya no coincide con el
   * filtro de estado que se está mirando (ej. se aprobó uno mientras se
   * miraba "Pendientes"), y se actualiza en su lugar si sigue
   * coincidiendo (ej. mirando "Todos"). */
  function aplicarActualizacion(actualizado: RegistroServicio) {
    const sigueCoincidiendo = filtro === "todos" || actualizado.estado === filtro;
    setRegistros((actuales) =>
      sigueCoincidiendo
        ? actuales.map((registro) => (registro.id === actualizado.id ? actualizado : registro))
        : actuales.filter((registro) => registro.id !== actualizado.id),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
          <Icon name="fact_check" className="text-[20px] text-primary" />
        </span>
        <div>
          <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
            Validar servicios
          </h1>
          <p className="text-[12px] text-on-surface-variant">
            Lo que el equipo dice haber hecho, antes de que cuente
          </p>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltroPeriodo
          periodo={periodo}
          referencia={referencia}
          onCambiarPeriodo={setPeriodo}
          onCambiarReferencia={setReferencia}
        />
        <div className="flex flex-wrap items-center gap-3">
          {equipo.length > 0 && (
            <SelectCustom
              label="Barbero"
              etiquetaOculta
              valor={empleadoFiltro}
              onChange={setEmpleadoFiltro}
              className="w-[180px]"
            >
              <SelectItem value={TODOS_LOS_EMPLEADOS}>Todo el equipo</SelectItem>
              {equipo.map((miembro) => (
                <SelectItem key={miembro.id} value={String(miembro.id)}>
                  {miembro.nombre}
                </SelectItem>
              ))}
            </SelectCustom>
          )}
          <ToggleGroup valor={filtro} onChange={(valor) => setFiltro(valor as Filtro)}>
            <ToggleGroupItem value="pendiente">Pendientes</ToggleGroupItem>
            <ToggleGroupItem value="aprobado">Completados</ToggleGroupItem>
            <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {cargando ? (
        <SkeletonLista filas={4} />
      ) : error ? (
        <EstadoError
          mensaje="No pudimos cargar los registros. Revisa tu conexión."
          onReintentar={cargar}
        />
      ) : registros.length === 0 ? (
        <EstadoVacio
          icono="fact_check"
          titulo={filtro === "pendiente" ? "No hay nada pendiente" : "Nada acá"}
          descripcion={
            filtro === "pendiente"
              ? "Cuando el equipo registre un servicio en este período, aparece acá para que lo revises."
              : "No hay servicios en este período y filtro. Prueba con otro."
          }
        />
      ) : (
        <ul className="space-y-3">
          {registros.map((registro) => {
            const estilo = ESTILO_ESTADO_REGISTRO[registro.estado];
            return (
              <li key={registro.id}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    {registro.evidencia && (
                      <img
                        src={registro.evidencia}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-label-md text-label-md text-on-surface">
                            {registro.servicio_nombre}
                          </p>
                          <p className="truncate text-[12px] text-on-surface-variant">
                            {registro.empleado_nombre} · {registro.nombre_cliente}
                          </p>
                          <p className="text-[12px] text-on-surface-variant">
                            {formatearFechaHora(registro.fecha_hora)}
                          </p>
                        </div>
                        <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
                      </div>
                      {registro.observaciones && (
                        <p className="mt-2 font-caption text-caption text-on-surface-variant">
                          {registro.observaciones}
                        </p>
                      )}
                      {registro.estado === "rechazado" && registro.motivo_rechazo && (
                        <p className="mt-2 flex items-start gap-2 rounded-lg bg-error-container px-3 py-2 font-caption text-caption text-on-error-container">
                          <Icon name="error" className="mt-0.5 shrink-0 text-[16px]" />
                          {registro.motivo_rechazo}
                        </p>
                      )}
                      {registro.estado === "pendiente" && (
                        <div className="mt-3 flex gap-2">
                          <Button
                            tamano="sm"
                            icono="check_circle"
                            onClick={() => setPorAprobar(registro)}
                          >
                            Aprobar
                          </Button>
                          <Button
                            tamano="sm"
                            variante="danger"
                            icono="cancel"
                            onClick={() => abrirRechazo(registro)}
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <ModalConfirmacion
        abierto={porAprobar !== null}
        titulo="¿Aprobar este servicio?"
        mensaje={
          porAprobar
            ? `Confirmas que ${porAprobar.empleado_nombre} hizo "${porAprobar.servicio_nombre}" a ${porAprobar.nombre_cliente}. Queda en tu historial.`
            : ""
        }
        etiquetaConfirmar="Aprobar"
        destructivo={false}
        cargando={aprobando}
        onCancelar={() => setPorAprobar(null)}
        onConfirmar={aprobar}
      />

      <Modal
        abierto={porRechazar !== null}
        onCerrar={() => setPorRechazar(null)}
        titulo="Rechazar este servicio"
        descripcion={
          porRechazar
            ? `${porRechazar.empleado_nombre} podrá ver el motivo en su propio historial.`
            : undefined
        }
      >
        <form className="flex flex-col gap-4" onSubmit={rechazar}>
          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface" htmlFor="motivo-rechazo">
              Motivo del rechazo
            </label>
            <textarea
              id="motivo-rechazo"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={3}
              placeholder="Ej: No coincide con el servicio cobrado en caja."
              className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-body-md text-body-md text-on-surface outline-hidden transition-all placeholder:text-outline focus:border-menta focus:ring-2 focus:ring-menta/20"
              required
            />
          </div>

          {errorRechazo && (
            <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
              <Icon name="error" className="shrink-0 text-[18px]" />
              {errorRechazo}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variante="ghost"
              onClick={() => setPorRechazar(null)}
              disabled={rechazando}
            >
              Cancelar
            </Button>
            <Button type="submit" variante="danger" cargando={rechazando}>
              Rechazar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
