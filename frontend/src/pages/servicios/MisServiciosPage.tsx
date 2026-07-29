import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { apiClient } from "../../api/client";
import { cuerpoMultipart } from "../../api/multipart";
import type { components } from "../../api/schema";
import { useAuth } from "../../auth/AuthContext";
import { conReintentoDeAuth } from "../../auth/refresh";
import { usePermisos } from "../../permisos/usePermisos";
import { Button } from "../../ui/Button";
import { Badge, Card, EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { ESTILO_ESTADO_REGISTRO } from "../../ui/EstadoRegistroServicio";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { SelectCustom, SelectItem } from "../../ui/SelectCustom";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { useToast } from "../../ui/Toast";
import { FiltroPeriodo } from "./FiltroPeriodo";
import { paraQuery, rangoDe } from "./filtrosPeriodo";
import type { Periodo } from "./filtrosPeriodo";

type RegistroServicio = components["schemas"]["RegistroServicio"];
type Servicio = components["schemas"]["Servicio"];
type MiembroEquipo = components["schemas"]["MiembroEquipo"];
type EstadoFiltro = "pendiente" | "aprobado" | "todos";

/** Mismo límite que aplica el backend (`CONTRATO.md` 5.13), duplicado a
 * propósito — ver la nota en `ConfiguracionNegocioPage.tsx`. */
const MAX_MB = 5;

function pesaDemasiado(archivo: File): boolean {
  return archivo.size > MAX_MB * 1024 * 1024;
}

/** Valor por defecto de `<input type="datetime-local">`: fecha y hora
 * locales, sin zona horaria, al minuto. */
function ahoraLocal(): string {
  const ahora = new Date();
  ahora.setSeconds(0, 0);
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 16);
}

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface FormularioRegistro {
  empleado: string;
  servicio: string;
  nombreCliente: string;
  telefonoCliente: string;
  fechaHoraLocal: string;
  observaciones: string;
}

function formularioVacio(): FormularioRegistro {
  return {
    empleado: "",
    servicio: "",
    nombreCliente: "",
    telefonoCliente: "",
    fechaHoraLocal: ahoraLocal(),
    observaciones: "",
  };
}

export function MisServiciosPage() {
  const { mostrar } = useToast();
  const { membresia } = useAuth();
  const { puede } = usePermisos();
  // Con esta capacidad, registrar es a nombre de alguien más: el
  // formulario exige elegir quién (ver `CONTRATO.md` 5.13). Sin ella,
  // sigue siendo siempre uno mismo, sin que el formulario lo pregunte.
  const puedeElegirEmpleado = puede("puede_aprobar_servicios");

  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [registros, setRegistros] = useState<RegistroServicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [referencia, setReferencia] = useState(new Date());
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [datos, setDatos] = useState<FormularioRegistro>(formularioVacio());
  const [evidencia, setEvidencia] = useState<File | null>(null);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const inputEvidencia = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    if (!membresia) return;
    setCargando(true);
    setError(false);
    const rango = paraQuery(rangoDe(periodo, referencia));
    const [serviciosResp, registrosResp, equipoResp] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
      conReintentoDeAuth(() =>
        apiClient.GET("/api/servicios/registros/", {
          params: {
            query: {
              ...rango,
              estado: estadoFiltro === "todos" ? undefined : estadoFiltro,
              // Siempre lo propio, aunque la capacidad dé visibilidad de
              // todo el negocio (esa vista completa es "Validar
              // servicios"; acá es siempre "lo mío").
              empleado: membresia.id,
            },
          },
        }),
      ),
      puedeElegirEmpleado
        ? conReintentoDeAuth(() => apiClient.GET("/api/negocios/equipo/"))
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (serviciosResp.error || registrosResp.error) {
      setError(true);
    } else {
      setServicios((serviciosResp.data ?? []).filter((servicio) => servicio.activo));
      setRegistros(registrosResp.data ?? []);
      setEquipo(equipoResp.data ?? []);
    }
    setCargando(false);
  }, [membresia, periodo, referencia, estadoFiltro, puedeElegirEmpleado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirFormulario() {
    setDatos(formularioVacio());
    setEvidencia(null);
    setErrorFormulario(null);
    setFormularioAbierto(true);
  }

  function elegirEvidencia(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;

    if (pesaDemasiado(archivo)) {
      mostrar("error", `Esa imagen pesa más de ${MAX_MB} MB. Elige una más liviana.`);
      return;
    }
    setEvidencia(archivo);
  }

  async function handleRegistrar(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);

    if (!datos.servicio) {
      setErrorFormulario("Elige qué servicio hiciste.");
      return;
    }
    if (puedeElegirEmpleado && !datos.empleado) {
      setErrorFormulario("Selecciona quién realizó el servicio.");
      return;
    }

    setGuardando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/servicios/registros/", {
        body: cuerpoMultipart<RegistroServicio>({
          empleado: puedeElegirEmpleado ? Number(datos.empleado) : undefined,
          servicio: Number(datos.servicio),
          nombre_cliente: datos.nombreCliente,
          telefono_cliente: datos.telefonoCliente,
          fecha_hora: new Date(datos.fechaHoraLocal).toISOString(),
          observaciones: datos.observaciones,
          evidencia: evidencia ?? undefined,
        }),
      }),
    );
    setGuardando(false);

    if (errorRespuesta || !data) {
      setErrorFormulario(
        "No se pudo registrar. Revisa que la fecha no sea futura y que el cliente esté completo.",
      );
      return;
    }

    mostrar("exito", "Servicio registrado. Queda pendiente hasta que alguien lo valide.");
    setFormularioAbierto(false);
    // No se antepone a mano: el nuevo registro puede caer fuera del
    // período o estado que se está mirando ahora mismo (o, si se
    // registró a nombre de otro barbero, ni siquiera es "propio").
    await cargar();
  }

  if (cargando) {
    return <SkeletonLista filas={4} />;
  }

  if (error) {
    return (
      <EstadoError
        mensaje="No pudimos cargar tus servicios. Revisa tu conexión."
        onReintentar={cargar}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
            <Icon name="add_task" className="text-[20px] text-primary" />
          </span>
          <div>
            <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
              Mis servicios
            </h1>
            <p className="text-[12px] text-on-surface-variant">
              Lo que registras queda pendiente hasta que alguien lo valida
            </p>
          </div>
        </div>
        <Button icono="add" onClick={abrirFormulario} className="shrink-0">
          <span className="hidden sm:inline">Registrar</span>
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FiltroPeriodo
          periodo={periodo}
          referencia={referencia}
          onCambiarPeriodo={setPeriodo}
          onCambiarReferencia={setReferencia}
        />
        <ToggleGroup valor={estadoFiltro} onChange={(valor) => setEstadoFiltro(valor as EstadoFiltro)}>
          <ToggleGroupItem value="pendiente">Pendientes</ToggleGroupItem>
          <ToggleGroupItem value="aprobado">Completados</ToggleGroupItem>
          <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {registros.length === 0 ? (
        <EstadoVacio
          icono="add_task"
          titulo="Nada acá"
          descripcion="No hay servicios registrados en este período y filtro. Prueba con otro, o registra uno nuevo."
          accion={{ etiqueta: "Registrar servicio", onClick: abrirFormulario }}
        />
      ) : (
        <ul className="space-y-3">
          {registros.map((registro) => {
            const estilo = ESTILO_ESTADO_REGISTRO[registro.estado];
            return (
              <li key={registro.id}>
                <Card className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-label-md text-label-md text-on-surface">
                        {registro.servicio_nombre}
                      </p>
                      <p className="truncate text-[12px] text-on-surface-variant">
                        {registro.nombre_cliente} · {formatearFechaHora(registro.fecha_hora)}
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
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        titulo="Registrar servicio"
        descripcion="Queda pendiente hasta que alguien con permiso lo revise."
      >
        <form className="flex flex-col gap-6" onSubmit={handleRegistrar}>
          {puedeElegirEmpleado && (
            <SelectCustom
              label="¿Quién realizó el servicio?"
              valor={datos.empleado}
              onChange={(valor) => setDatos({ ...datos, empleado: valor })}
              placeholder="Elige un integrante del equipo…"
              ayuda="Queda asociado a esta persona, no a quien lo registra."
            >
              {equipo.map((miembro) => (
                <SelectItem key={miembro.id} value={String(miembro.id)}>
                  {miembro.nombre}
                </SelectItem>
              ))}
            </SelectCustom>
          )}

          <SelectCustom
            label="¿Qué servicio hiciste?"
            valor={datos.servicio}
            onChange={(valor) => setDatos({ ...datos, servicio: valor })}
            placeholder="Elige un servicio…"
          >
            {servicios.map((servicio) => (
              <SelectItem key={servicio.id} value={String(servicio.id)}>
                {servicio.nombre}
              </SelectItem>
            ))}
          </SelectCustom>

          <Input
            label="Cliente"
            value={datos.nombreCliente}
            onChange={(e) => setDatos({ ...datos, nombreCliente: e.target.value })}
            placeholder="Ej: Carlos Gómez"
            required
          />
          <Input
            label="Teléfono (opcional)"
            type="tel"
            value={datos.telefonoCliente}
            onChange={(e) => setDatos({ ...datos, telefonoCliente: e.target.value })}
            placeholder="3001112233"
          />
          <Input
            label="Fecha y hora"
            type="datetime-local"
            value={datos.fechaHoraLocal}
            max={ahoraLocal()}
            onChange={(e) => setDatos({ ...datos, fechaHoraLocal: e.target.value })}
            ayuda="No puede ser una fecha futura: el servicio ya tuvo que ocurrir."
            required
          />

          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface">
              Observaciones (opcional)
            </label>
            <textarea
              value={datos.observaciones}
              onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })}
              rows={3}
              placeholder="Cualquier detalle que ayude a validar el servicio"
              className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-body-md text-body-md text-on-surface outline-hidden transition-all placeholder:text-outline focus:border-menta focus:ring-2 focus:ring-menta/20"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-md text-label-md text-on-surface">
              Evidencia fotográfica (opcional)
            </label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variante="secondary"
                tamano="sm"
                icono="photo_camera"
                onClick={() => inputEvidencia.current?.click()}
              >
                {evidencia ? "Cambiar foto" : "Tomar o elegir foto"}
              </Button>
              {evidencia && (
                <span className="truncate font-caption text-caption text-on-surface-variant">
                  {evidencia.name}
                </span>
              )}
            </div>
            <input
              ref={inputEvidencia}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={elegirEvidencia}
              aria-label="Elegir evidencia fotográfica"
            />
          </div>

          {errorFormulario && (
            <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
              <Icon name="error" className="shrink-0 text-[18px]" />
              {errorFormulario}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variante="ghost"
              onClick={() => setFormularioAbierto(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando}>
              Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
