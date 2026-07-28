import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

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
import { SelectCustom, SelectItem } from "../ui/SelectCustom";
import { useToast } from "../ui/Toast";
import { usePermisos } from "../permisos/usePermisos";
import { CAPACIDADES, DEFINICIONES, TIPOS } from "../permisos/catalogo";

type MiembroNegocio = components["schemas"]["MiembroNegocio"];
type EmpleadoAlta = components["schemas"]["EmpleadoAlta"];
type Cargo = components["schemas"]["Cargo"];

const NUEVO_VACIO: EmpleadoAlta = {
  email: "",
  nombre: "",
  password: "",
  especialidad: "",
  cargo: null,
};

export function EmpleadosPage() {
  const { membresia, refrescarMembresia } = useAuth();
  const { mostrar } = useToast();
  const { puede } = usePermisos();
  const puedeGestionar = puede("puede_gestionar_empleados");

  const [empleados, setEmpleados] = useState<MiembroNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [nuevo, setNuevo] = useState<EmpleadoAlta>(NUEVO_VACIO);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porDesactivar, setPorDesactivar] = useState<MiembroNegocio | null>(null);

  async function cargar() {
    setCargando(true);
    setError(false);
    const [empleadosResp, cargosResp] = await Promise.all([
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/empleados/")),
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/cargos/")),
    ]);
    if (empleadosResp.error || !empleadosResp.data) {
      setError(true);
    } else {
      setEmpleados(empleadosResp.data);
      setSeleccionadoId((actual) => actual ?? empleadosResp.data[0]?.id ?? null);
      setCargos(cargosResp.data ?? []);
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
    <div className="space-y-6">
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
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Lista de empleados */}
          <ul className="flex-1 space-y-2">
            {empleados.map((empleado) => {
              const activo = empleado.id === seleccionadoId;
              const esAdmin = empleado.cargo_detalle?.tipo === "administracion";

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

              {/* Se asigna un cargo, no permisos sueltos: lo que puede
                  hacer sale del cargo (ver CONTRATO.md 5.10). Los
                  permisos de cada cargo se editan en Cargos. */}
              <h3 className="mb-3 border-b border-outline-variant/60 pb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                Cargo
              </h3>

              <SelectCustom
                label="Cargo"
                etiquetaOculta
                valor={String(seleccionado.cargo ?? "")}
                onChange={(valor) => actualizarEmpleado(seleccionado, { cargo: Number(valor) })}
                disabled={!puedeGestionar || seleccionado.id === membresia?.id}
              >
                {cargos.map((cargo) => (
                  <SelectItem key={cargo.id} value={String(cargo.id)}>
                    {cargo.nombre}
                  </SelectItem>
                ))}
              </SelectCustom>

              {seleccionado.id === membresia?.id && puedeGestionar && (
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  No puedes cambiarte el cargo a ti mismo. Pídeselo a alguien más del equipo.
                </p>
              )}

              <ul className="mt-4 space-y-1.5">
                {CAPACIDADES.filter((capacidad) => seleccionado.cargo_detalle?.[capacidad]).map(
                  (capacidad) => (
                    <li
                      key={capacidad}
                      className="flex items-start gap-1.5 text-[12px] text-on-surface"
                    >
                      <Icon name="check" className="shrink-0 text-[16px] text-menta" />
                      {DEFINICIONES[capacidad].etiqueta}
                    </li>
                  ),
                )}
                {CAPACIDADES.every((capacidad) => !seleccionado.cargo_detalle?.[capacidad]) && (
                  <li className="text-[12px] text-on-surface-variant">
                    Solo atiende y maneja sus propias citas.
                  </li>
                )}
              </ul>

              {puedeGestionar && (
                <Link
                  to="/configuracion/cargos"
                  className="mt-4 flex items-center gap-1 font-caption text-caption text-menta hover:underline"
                >
                  <Icon name="settings" className="text-[16px]" />
                  Editar los permisos de los cargos
                </Link>
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
        <form className="flex flex-col gap-6" onSubmit={handleCrear}>
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
              ¿Qué cargo va a tener?
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {cargos.map((cargo) => {
                const elegido = cargo.id === nuevo.cargo;
                return (
                  <label
                    key={cargo.id}
                    className={cn(
                      "tactile cursor-pointer rounded-xl border p-3 transition-colors",
                      elegido
                        ? "border-menta bg-menta/5"
                        : "border-outline-variant bg-white hover:bg-surface-container-low",
                    )}
                  >
                    <input
                      type="radio"
                      name="cargo-del-empleado"
                      className="sr-only"
                      checked={elegido}
                      onChange={() => setNuevo({ ...nuevo, cargo: cargo.id })}
                    />
                    <span className="flex items-center gap-1.5">
                      <Icon
                        name={elegido ? "check_circle" : "person"}
                        className={cn("text-[18px]", elegido ? "text-menta" : "text-outline")}
                      />
                      <span className="font-label-md text-label-md text-on-surface">
                        {cargo.nombre}
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] text-on-surface-variant">
                      {TIPOS[cargo.tipo ?? "operativo"].descripcion}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 flex items-start gap-2 font-caption text-caption text-on-surface-variant">
              <Icon name="info" className="shrink-0 text-[16px] text-menta" />
              ¿Ninguno le queda? Crea uno nuevo en{" "}
              <Link to="/configuracion/cargos" className="font-semibold text-menta underline">
                Cargos
              </Link>
              .
            </p>
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
