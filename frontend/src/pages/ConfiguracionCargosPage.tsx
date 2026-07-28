import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { EstadoError, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { Input } from "../ui/Input";
import { Modal, ModalConfirmacion } from "../ui/Modal";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { Tooltip } from "../ui/Tooltip";
import {
  CAPACIDADES,
  DEFINICIONES,
  GRUPOS,
  TIPOS,
  type Capacidad,
  type TipoDeUsuario,
} from "../permisos/catalogo";
import { usePermisos } from "../permisos/usePermisos";

type Cargo = components["schemas"]["Cargo"];

const NUEVO: Omit<Cargo, "id" | "miembros"> = {
  nombre: "",
  tipo: "operativo",
};

function ChipPronto() {
  return (
    <span className="shrink-0 rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
      Pronto
    </span>
  );
}

/** Los cargos del negocio: cuáles hay y qué puede hacer cada uno.
 *
 * Es la pantalla donde vive "su negocio, sus reglas": los tres cargos con
 * que arranca el negocio son un punto de partida, no un catálogo fijo. Se
 * renombran, se editan, se crean otros y se borran los que no se usen.
 *
 * A diferencia de la versión anterior de esta pantalla, no se editan
 * permisos persona por persona: se edita el cargo, y eso alcanza a todos
 * los que lo ocupan. Por eso cada tarjeta dice a cuánta gente afecta.
 */
export function ConfiguracionCargosPage() {
  const { membresia, refrescarMembresia } = useAuth();
  const { puede } = usePermisos();
  const { mostrar } = useToast();
  const puedoGestionar = puede("puede_gestionar_empleados");

  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  // Uno abierto a la vez: con varias tarjetas abiertas hay que hacer
  // scroll para comparar, que es lo contrario de lo que sirve acá.
  const [expandido, setExpandido] = useState<number | null>(null);

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [porBorrar, setPorBorrar] = useState<Cargo | null>(null);

  async function cargar() {
    setCargando(true);
    setError(false);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/negocios/cargos/"),
    );
    if (errorRespuesta || !data) setError(true);
    else setCargos(data);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(cargo: Cargo, cambios: Partial<Cargo>) {
    // Optimista: mover un interruptor y esperar al servidor para verlo
    // moverse se siente roto al ajustar varios seguidos.
    const previos = cargos;
    setCargos((actual) =>
      actual.map((item) => (item.id === cargo.id ? { ...item, ...cambios } : item)),
    );

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/cargos/{id}/", {
        params: { path: { id: cargo.id } },
        body: cambios,
      }),
    );

    if (errorRespuesta) {
      setCargos(previos);
      mostrar("error", "No se pudo guardar el cambio.");
      return;
    }
    // Si tocó su propio cargo, su sesión debe reflejarlo: la navegación
    // y las acciones se dibujan con esto.
    if (cargo.id === membresia?.cargo?.id) await refrescarMembresia();
  }

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setErrorFormulario(null);
    setGuardando(true);

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/negocios/cargos/", { body: nuevo as Cargo }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setErrorFormulario(
        "No se pudo crear. Revisa que el nombre no esté repetido y que no estés dando permisos que tú no tienes.",
      );
      return;
    }
    mostrar("exito", "Cargo creado.");
    setNuevo(NUEVO);
    setFormularioAbierto(false);
    await cargar();
  }

  async function borrar(cargo: Cargo) {
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.DELETE("/api/negocios/cargos/{id}/", { params: { path: { id: cargo.id } } }),
    );
    setPorBorrar(null);
    if (errorRespuesta) {
      mostrar("error", "No se pudo borrar. ¿Todavía hay gente con ese cargo?");
      return;
    }
    mostrar("exito", "Cargo eliminado.");
    await cargar();
  }

  /** Por qué un interruptor está bloqueado, o `null`. Espeja
   * `CONTRATO.md` 5.9/5.10; el backend responde 400 igual. */
  function motivoBloqueo(cargo: Cargo, capacidad: Capacidad): string | null {
    if (!puedoGestionar) return "Necesitas el permiso de agregar gente y dar permisos.";
    const encendiendo = !cargo[capacidad];
    if (cargo.id === membresia?.cargo?.id && encendiendo) {
      return "No puedes agregarle permisos al cargo que tú ocupas. Pídeselo a alguien más.";
    }
    // Quitar lo que uno no tiene sí se permite: reducir permisos ajenos
    // no amplía los propios.
    if (encendiendo && !puede(capacidad)) return "No puedes dar un permiso que tú no tienes.";
    return null;
  }

  return (
    <div className="space-y-lg">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md-mobile tracking-tight text-primary md:text-headline-md">
            Cargos
          </h1>
          <p className="mt-1 text-[13px] text-on-surface-variant">
            Los cargos de tu negocio y qué puede hacer cada uno. Tu negocio, tus reglas.
          </p>
        </div>
        {puedoGestionar && (
          <Button
            icono="add"
            className="shrink-0"
            onClick={() => {
              setNuevo(NUEVO);
              setErrorFormulario(null);
              setFormularioAbierto(true);
            }}
          >
            <span className="hidden sm:inline">Nuevo cargo</span>
          </Button>
        )}
      </header>

      {!puedoGestionar && (
        <p className="flex items-start gap-xs rounded-lg bg-surface-container-low p-3 font-caption text-caption text-on-surface-variant">
          <Icon name="lock" className="shrink-0 text-[18px]" />
          Solo lectura: necesitas el permiso de agregar gente y dar permisos para cambiar algo acá.
        </p>
      )}

      {cargando ? (
        <SkeletonLista filas={3} />
      ) : error ? (
        <EstadoError mensaje="No pudimos cargar los cargos." onReintentar={cargar} />
      ) : (
        <div className="grid items-start gap-md lg:grid-cols-2">
          {cargos.map((cargo) => {
            const esElMio = cargo.id === membresia?.cargo?.id;
            const abierto = expandido === cargo.id;
            const concedidas = CAPACIDADES.filter((capacidad) => cargo[capacidad]);
            const panelId = `permisos-cargo-${cargo.id}`;

            return (
              <section
                key={cargo.id}
                className="animate-slide-in-bottom overflow-hidden rounded-2xl border border-outline-variant/60 bg-white"
              >
                <div className="flex items-start justify-between gap-2 p-5 pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-label-md text-label-md font-bold text-on-surface">
                        {cargo.nombre}
                      </h2>
                      {esElMio && (
                        <span className="rounded-full bg-menta/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-menta">
                          El tuyo
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-on-surface-variant">
                      {TIPOS[cargo.tipo ?? "operativo"].descripcion}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-menta">
                      <Icon name="group" className="text-[14px]" />
                      {cargo.miembros === 0
                        ? "Nadie lo tiene todavía"
                        : `${cargo.miembros} ${cargo.miembros === 1 ? "persona" : "personas"}`}
                    </p>
                  </div>
                  {puedoGestionar && cargo.miembros === 0 && (
                    <Button
                      variante="ghost"
                      tamano="sm"
                      className="shrink-0 text-error"
                      aria-label={`Eliminar el cargo ${cargo.nombre}`}
                      onClick={() => setPorBorrar(cargo)}
                    >
                      <Icon name="delete" className="text-[18px]" />
                    </Button>
                  )}
                </div>

                {/* Resumen de lo que concede: lo que se ve sin abrir. Con
                    siete interruptores por cargo, mostrarlos todos de
                    entrada convierte la pantalla en un muro. */}
                <div className="px-5 pt-3">
                  {concedidas.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant">
                      Solo atiende y maneja sus propias citas.
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {concedidas.map((capacidad) => (
                        <li
                          key={capacidad}
                          className="rounded-full bg-menta/8 px-2 py-0.5 text-[11px] text-menta"
                        >
                          {DEFINICIONES[capacidad].corto}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setExpandido(abierto ? null : cargo.id)}
                  aria-expanded={abierto}
                  aria-controls={panelId}
                  className="tactile mt-3 flex w-full items-center justify-between gap-2 border-t border-outline-variant/50 px-5 py-3 text-left transition-colors hover:bg-surface-container-low"
                >
                  <span className="font-caption text-caption text-menta">
                    {abierto
                      ? "Ocultar permisos"
                      : puedoGestionar
                        ? "Ver y cambiar permisos"
                        : "Ver permisos"}
                  </span>
                  <Icon
                    name="keyboard_arrow_down"
                    className={cn(
                      "shrink-0 text-[20px] text-menta transition-transform",
                      abierto && "rotate-180",
                    )}
                  />
                </button>

                {abierto && (
                  <div id={panelId} className="animate-fade-in px-5 pb-5">
                    {cargo.miembros > 0 && puedoGestionar && (
                      <p className="mb-4 flex items-start gap-xs rounded-lg bg-surface-container-low p-2.5 text-[11px] text-on-surface-variant">
                        <Icon name="info" className="shrink-0 text-[16px] text-menta" />
                        Lo que cambies acá aplica a las {cargo.miembros}{" "}
                        {cargo.miembros === 1 ? "persona" : "personas"} con este cargo.
                      </p>
                    )}

                    {GRUPOS.map(({ area, capacidades }) => (
                      <div key={area} className="mb-4 last:mb-0">
                        <h3 className="mb-2.5 border-b border-outline-variant/60 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                          {area}
                        </h3>
                        <div className="space-y-3.5">
                          {capacidades.map((capacidad) => {
                            const motivo = motivoBloqueo(cargo, capacidad);
                            const control = (
                              <Switch
                                label={DEFINICIONES[capacidad].etiqueta}
                                descripcion={DEFINICIONES[capacidad].consecuencia}
                                checked={Boolean(cargo[capacidad])}
                                disabled={motivo !== null}
                                onChange={(valor) => guardar(cargo, { [capacidad]: valor })}
                              />
                            );
                            return (
                              <div key={capacidad} className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  {motivo === null ? (
                                    control
                                  ) : (
                                    <Tooltip contenido={motivo}>
                                      <span className="inline-flex w-full cursor-not-allowed">
                                        {control}
                                      </span>
                                    </Tooltip>
                                  )}
                                </div>
                                {DEFINICIONES[capacidad].proximamente && <ChipPronto />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
        titulo="Nuevo cargo"
        descripcion="Ponle un nombre y decide con qué pantalla arranca la gente que lo tenga. Los permisos se ajustan después."
      >
        <form className="flex flex-col gap-md" onSubmit={crear}>
          <Input
            label="Nombre del cargo"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            placeholder="Ej: Barbero de silla alquilada"
            required
          />

          <fieldset>
            <legend className="mb-2 font-label-md text-label-md text-on-surface">
              ¿Con qué arranca al entrar?
            </legend>
            <div className="space-y-2">
              {(Object.keys(TIPOS) as TipoDeUsuario[]).map((tipo) => {
                const elegido = nuevo.tipo === tipo;
                return (
                  <label
                    key={tipo}
                    className={cn(
                      "tactile flex cursor-pointer items-start gap-2 rounded-xl border p-3 transition-colors",
                      elegido
                        ? "border-menta bg-menta/5"
                        : "border-outline-variant bg-white hover:bg-surface-container-low",
                    )}
                  >
                    <input
                      type="radio"
                      name="tipo-de-cargo"
                      className="sr-only"
                      checked={elegido}
                      onChange={() => setNuevo({ ...nuevo, tipo })}
                    />
                    <Icon
                      name={elegido ? "check_circle" : "person"}
                      className={cn("mt-0.5 text-[18px]", elegido ? "text-menta" : "text-outline")}
                    />
                    <span className="min-w-0">
                      <span className="block font-label-md text-label-md text-on-surface">
                        {TIPOS[tipo].etiqueta}
                      </span>
                      <span className="block text-[11px] text-on-surface-variant">
                        {TIPOS[tipo].descripcion}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

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
              Crear cargo
            </Button>
          </div>
        </form>
      </Modal>

      <ModalConfirmacion
        abierto={porBorrar !== null}
        titulo="¿Eliminar este cargo?"
        mensaje={`El cargo "${porBorrar?.nombre}" desaparecerá. No lo tiene nadie, así que no afecta a ningún miembro del equipo.`}
        etiquetaConfirmar="Sí, eliminar"
        onCancelar={() => setPorBorrar(null)}
        onConfirmar={() => porBorrar && borrar(porBorrar)}
      />
    </div>
  );
}
