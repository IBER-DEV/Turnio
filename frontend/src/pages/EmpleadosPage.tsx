import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { Badge, Card, EstadoError, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { Modal, ModalConfirmacion } from "../ui/Modal";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";

type MiembroNegocio = components["schemas"]["MiembroNegocio"];
type EmpleadoAlta = components["schemas"]["EmpleadoAlta"];
type Capacidad = keyof EmpleadoAlta & keyof MiembroNegocio;

/** Cada capacidad se explica en términos de lo que habilita, no con el
 * nombre técnico del campo: quien administra el negocio no tiene por
 * qué traducir `puede_editar_precios` a "puede tocar el catálogo". */
const CAPACIDADES: Array<{ campo: Capacidad; etiqueta: string; descripcion: string }> = [
  {
    campo: "puede_cobrar",
    etiqueta: "Puede cobrar",
    descripcion: "Permite registrar pagos de citas.",
  },
  {
    campo: "puede_ver_reportes",
    etiqueta: "Puede ver reportes",
    descripcion: "Estadísticas de ingresos del negocio.",
  },
  {
    campo: "puede_editar_precios",
    etiqueta: "Puede editar precios",
    descripcion: "Modificar el catálogo de servicios.",
  },
  {
    campo: "puede_gestionar_empleados",
    etiqueta: "Puede gestionar el equipo",
    descripcion: "Agregar empleados y cambiar sus permisos.",
  },
  {
    campo: "puede_gestionar_agenda",
    etiqueta: "Puede gestionar la agenda",
    descripcion: "Agendar citas y definir horarios.",
  },
];

const NUEVO_VACIO: EmpleadoAlta = {
  email: "",
  nombre: "",
  password: "",
  especialidad: "",
  puede_cobrar: false,
  puede_ver_reportes: false,
  puede_editar_precios: false,
  puede_gestionar_empleados: false,
  puede_gestionar_agenda: false,
};

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function EmpleadosPage() {
  const { membresia, refrescarMembresia } = useAuth();
  const { mostrar } = useToast();
  const puedeGestionar = membresia?.puede_gestionar_empleados ?? false;

  const [empleados, setEmpleados] = useState<MiembroNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [nuevo, setNuevo] = useState<EmpleadoAlta>(NUEVO_VACIO);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porDesactivar, setPorDesactivar] = useState<MiembroNegocio | null>(null);

  async function cargar() {
    setCargando(true);
    setError(false);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/negocios/empleados/"),
    );
    if (errorRespuesta || !data) {
      setError(true);
    } else {
      setEmpleados(data);
      setSeleccionadoId((actual) => actual ?? data[0]?.id ?? null);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  const seleccionado = empleados.find((empleado) => empleado.id === seleccionadoId) ?? null;

  async function actualizarEmpleado(empleado: MiembroNegocio, cambios: Partial<MiembroNegocio>) {
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/empleados/{id}/", {
        params: { path: { id: empleado.id } },
        body: cambios,
      }),
    );

    if (errorRespuesta || !data) {
      mostrar("error", "No se pudo guardar el cambio.");
      return;
    }

    setEmpleados((actual) => actual.map((item) => (item.id === empleado.id ? data : item)));
    mostrar("exito", "Permisos actualizados.");

    // Si el usuario se editó a sí mismo, su propia sesión debe reflejar
    // las nuevas capacidades (la UI se gatea con ellas).
    if (empleado.email === membresia?.email) {
      await refrescarMembresia();
    }
  }

  async function handleCrear(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/negocios/empleados/", { body: nuevo }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setErrorFormulario(
        "No se pudo crear. Verifica que el email no esté registrado y que la contraseña sea segura (mínimo 8 caracteres, no solo números).",
      );
      return;
    }

    mostrar("exito", "Empleado agregado al equipo.");
    setNuevo(NUEVO_VACIO);
    setFormularioAbierto(false);
    await cargar();
  }

  return (
    <div className="space-y-md">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg-mobile text-primary md:text-headline-lg">
            Equipo
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Administra tu personal y sus permisos.
          </p>
        </div>
        {puedeGestionar && (
          <Button
            icono="person_add"
            onClick={() => {
              setNuevo(NUEVO_VACIO);
              setErrorFormulario(null);
              setFormularioAbierto(true);
            }}
            className="shrink-0"
          >
            <span className="hidden sm:inline">Agregar</span>
          </Button>
        )}
      </header>

      {cargando ? (
        <SkeletonLista />
      ) : error ? (
        <EstadoError
          mensaje="No pudimos cargar el equipo. Revisa tu conexión."
          onReintentar={cargar}
        />
      ) : (
        <div className="flex flex-col gap-lg md:flex-row">
          {/* Lista de empleados */}
          <ul className="flex-1 space-y-3">
            {empleados.map((empleado) => {
              const activo = empleado.id === seleccionadoId;
              const esAdmin =
                empleado.puede_gestionar_empleados &&
                empleado.puede_editar_precios &&
                empleado.puede_cobrar &&
                empleado.puede_gestionar_agenda &&
                empleado.puede_ver_reportes;

              return (
                <li key={empleado.id} className="animate-slide-in-bottom">
                  <button
                    type="button"
                    onClick={() => setSeleccionadoId(empleado.id)}
                    aria-pressed={activo}
                    className={cn(
                      "group w-full rounded-xl border bg-surface-container-lowest p-4 text-left transition-all hover:shadow-card-soft",
                      activo
                        ? "border-2 border-primary ring-2 ring-primary-container"
                        : "border-outline-variant",
                      !empleado.activo && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container-highest font-label-md text-label-md text-primary">
                          {iniciales(empleado.nombre)}
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate font-label-md text-label-md text-primary">
                            {empleado.nombre}
                          </h2>
                          <p className="truncate font-caption text-caption text-secondary">
                            {empleado.especialidad || "Sin especialidad"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!empleado.activo && (
                          <Badge className="bg-surface-container text-on-surface-variant">
                            Inactivo
                          </Badge>
                        )}
                        {esAdmin && (
                          <Badge className="bg-surface-container text-on-surface-variant">
                            Admin
                          </Badge>
                        )}
                        <Icon
                          name="chevron_right"
                          className="text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Panel de permisos */}
          {seleccionado && (
            <Card className="w-full self-start rounded-2xl p-md shadow-card-soft md:sticky md:top-24 md:w-[380px]">
              <div className="mb-md flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-headline-md text-headline-md text-primary">
                    {seleccionado.nombre}
                  </h2>
                  <p className="truncate font-caption text-caption text-secondary">
                    {seleccionado.especialidad || "Sin especialidad"}
                  </p>
                  <p className="mt-1 truncate font-caption text-caption text-on-surface-variant">
                    {seleccionado.email}
                  </p>
                </div>
                {puedeGestionar && seleccionado.email !== membresia?.email && (
                  <button
                    type="button"
                    onClick={() => setPorDesactivar(seleccionado)}
                    aria-label={seleccionado.activo ? "Desactivar empleado" : "Reactivar empleado"}
                    className="shrink-0 rounded-full p-2 text-error transition-colors hover:bg-error-container"
                  >
                    <Icon name={seleccionado.activo ? "person_off" : "person_check"} />
                  </button>
                )}
              </div>

              <h3 className="border-b border-outline-variant pb-2 font-label-md text-label-md text-on-surface-variant">
                Capacidades (Permisos)
              </h3>

              <div className="mt-md space-y-md">
                {CAPACIDADES.map(({ campo, etiqueta, descripcion }) => (
                  <Switch
                    key={campo}
                    label={etiqueta}
                    descripcion={descripcion}
                    checked={Boolean(seleccionado[campo])}
                    disabled={!puedeGestionar}
                    onChange={(valor) => actualizarEmpleado(seleccionado, { [campo]: valor })}
                  />
                ))}
              </div>

              {!puedeGestionar && (
                <p className="mt-md rounded-lg bg-surface-container-low p-3 font-caption text-caption text-on-surface-variant">
                  Solo lectura: no tienes la capacidad de gestionar el equipo.
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      <Modal
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        titulo="Agregar al equipo"
        descripcion="Define sus datos de acceso y qué podrá hacer dentro del negocio."
      >
        <form className="flex flex-col gap-md" onSubmit={handleCrear}>
          <Input
            label="Nombre completo"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder="Ej: Ana Martínez"
            required
          />
          <Input
            label="Especialidad"
            value={nuevo.especialidad}
            onChange={(e) => setNuevo({ ...nuevo, especialidad: e.target.value })}
            placeholder="Ej: Barbera, Estilista Senior…"
            ayuda="Solo informativo, no afecta permisos."
          />
          <Input
            label="Email"
            type="email"
            value={nuevo.email}
            onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
            placeholder="ana@tu-negocio.com"
            autoComplete="off"
            required
          />
          <Input
            label="Contraseña"
            type="password"
            value={nuevo.password}
            onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            ayuda="Podrá cambiarla luego junto a ti; hoy no hay recuperación por email."
            required
          />

          <div>
            <h3 className="mb-3 border-b border-outline-variant pb-2 font-label-md text-label-md text-on-surface-variant">
              Capacidades
            </h3>
            <div className="space-y-md">
              {CAPACIDADES.map(({ campo, etiqueta, descripcion }) => (
                <Switch
                  key={campo}
                  label={etiqueta}
                  descripcion={descripcion}
                  checked={Boolean(nuevo[campo])}
                  onChange={(valor) => setNuevo({ ...nuevo, [campo]: valor })}
                />
              ))}
            </div>
          </div>

          {errorFormulario && (
            <p role="alert" className="flex items-start gap-xs font-caption text-caption text-error">
              <Icon name="error" className="shrink-0 text-[18px]" />
              {errorFormulario}
            </p>
          )}

          <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
            <Button
              type="button"
              variante="ghost"
              onClick={() => setFormularioAbierto(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" cargando={guardando}>
              Agregar
            </Button>
          </div>
        </form>
      </Modal>

      <ModalConfirmacion
        abierto={porDesactivar !== null}
        titulo={porDesactivar?.activo ? "¿Desactivar a este empleado?" : "¿Reactivar a este empleado?"}
        mensaje={
          porDesactivar?.activo
            ? `${porDesactivar?.nombre} no podrá entrar a Turnio ni recibir citas nuevas. Sus citas ya agendadas no se modifican.`
            : `${porDesactivar?.nombre} volverá a tener acceso y podrá recibir citas.`
        }
        etiquetaConfirmar={porDesactivar?.activo ? "Desactivar" : "Reactivar"}
        destructivo={porDesactivar?.activo ?? true}
        onCancelar={() => setPorDesactivar(null)}
        onConfirmar={async () => {
          if (porDesactivar) {
            await actualizarEmpleado(porDesactivar, { activo: !porDesactivar.activo });
          }
          setPorDesactivar(null);
        }}
      />
    </div>
  );
}
