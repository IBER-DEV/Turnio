import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { Badge, Card, EstadoError, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { MenuAcciones, MenuAccionesItem } from "../ui/MenuAcciones";
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
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
            <Icon name="group" className="text-[20px] text-primary" />
          </span>
          <div>
            <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
              Equipo
            </h1>
            <p className="text-[12px] text-on-surface-variant">
              {empleados.length} {empleados.length === 1 ? "miembro" : "miembros"}
            </p>
          </div>
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
          <ul className="flex-1 space-y-2">
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
                      "group flex w-full items-center gap-3 rounded-xl border bg-white p-3.5 text-left transition-all",
                      activo
                        ? "border-menta/40 bg-menta/3 shadow-card-soft"
                        : "border-outline-variant/60 hover:border-menta/30 hover:shadow-card-soft",
                      !empleado.activo && "opacity-60",
                    )}
                  >
                    <Avatar nombre={empleado.nombre} tamano="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-label-md text-label-md text-on-surface">
                        {empleado.nombre}
                      </p>
                      <p className="truncate text-[11px] text-menta">
                        {empleado.especialidad || "Sin especialidad"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!empleado.activo && (
                        <Badge className="bg-surface-container text-on-surface-variant">
                          Inactivo
                        </Badge>
                      )}
                      {esAdmin && (
                        <Badge className="bg-primary/8 text-primary">
                          Admin
                        </Badge>
                      )}
                      <Icon
                        name="chevron_right"
                        className={cn(
                          "text-[18px] transition-all",
                          activo ? "text-menta" : "text-on-surface-variant opacity-0 group-hover:opacity-100",
                        )}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Panel de permisos */}
          {seleccionado && (
            <Card className="w-full self-start rounded-2xl p-5 shadow-card-soft md:sticky md:top-8 md:w-[380px]">
              {/* Header con avatar */}
              <div className="mb-5 flex items-center gap-4">
                <Avatar nombre={seleccionado.nombre} tamano="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-label-md text-label-md font-bold text-on-surface">
                    {seleccionado.nombre}
                  </h2>
                  <p className="truncate text-[11px] font-medium text-menta">
                    {seleccionado.especialidad || "Sin especialidad"}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                    {seleccionado.email}
                  </p>
                </div>
                {puedeGestionar && seleccionado.email !== membresia?.email && (
                  <MenuAcciones
                    trigger={
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-primary"
                        aria-label="Acciones de empleado"
                      >
                        <Icon name="more_vert" className="text-[22px]" />
                      </button>
                    }
                  >
                    <MenuAccionesItem
                      icono={seleccionado.activo ? "person_off" : "person_check"}
                      destructivo={seleccionado.activo}
                      onClick={() => setPorDesactivar(seleccionado)}
                    >
                      {seleccionado.activo ? "Desactivar" : "Reactivar"}
                    </MenuAccionesItem>
                  </MenuAcciones>
                )}
              </div>

              <h3 className="mb-4 border-b border-outline-variant/60 pb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Permisos
              </h3>

              <div className="space-y-4">
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
                <p className="mt-5 rounded-lg bg-surface-container-low p-3 text-[11px] text-on-surface-variant">
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
