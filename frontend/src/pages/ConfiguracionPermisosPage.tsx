import { useEffect, useState } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../auth/AuthContext";
import { conReintentoDeAuth } from "../auth/refresh";
import { Avatar } from "../ui/Avatar";
import { EstadoError, SkeletonLista } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { SelectCustom, SelectItem } from "../ui/SelectCustom";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { Tooltip } from "../ui/Tooltip";
import { DEFINICIONES, GRUPOS, type Capacidad } from "../permisos/catalogo";
import { motivoBloqueo } from "../permisos/reglas";
import { ROLES, capacidadesDe, etiquetaDeRol, rolDe } from "../permisos/roles";

type MiembroNegocio = components["schemas"]["MiembroNegocio"];

function ChipPronto() {
  return (
    <span className="shrink-0 rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
      Pronto
    </span>
  );
}

/** Permisos del equipo, en lenguaje de negocio.
 *
 * Vive aparte de Equipo (que es el alta y la baja de gente) porque el
 * dueño entra acá a una pregunta distinta: "¿quién puede qué?". En
 * pantalla ancha se muestra como matriz para poder compararlo de un
 * vistazo; en teléfono eso no cabe, así que se elige a una persona y se
 * ven sus permisos agrupados por área.
 */
export function ConfiguracionPermisosPage() {
  const { membresia, refrescarMembresia } = useAuth();
  const { mostrar } = useToast();
  const puedoGestionarEquipo = membresia?.puede_gestionar_empleados ?? false;

  const [empleados, setEmpleados] = useState<MiembroNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [enfocadoId, setEnfocadoId] = useState<number | null>(null);

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
      setEnfocadoId((actual) => actual ?? data[0]?.id ?? null);
    }
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(empleado: MiembroNegocio, cambios: Partial<MiembroNegocio>) {
    // Optimista: mover un interruptor y esperar al servidor para verlo
    // moverse se siente roto, sobre todo al ajustar varios seguidos.
    const previos = empleados;
    setEmpleados((actual) =>
      actual.map((item) => (item.id === empleado.id ? { ...item, ...cambios } : item)),
    );

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PATCH("/api/negocios/empleados/{id}/", {
        params: { path: { id: empleado.id } },
        body: cambios,
      }),
    );

    if (errorRespuesta) {
      setEmpleados(previos);
      mostrar("error", "No se pudo guardar el cambio.");
      return;
    }
    // Si el cambio fue sobre uno mismo el backend lo rechaza, pero por si
    // acaso cambian los permisos propios de otra forma, se refresca.
    if (empleado.id === membresia?.id) await refrescarMembresia();
  }

  function aplicarRol(empleado: MiembroNegocio, rolId: string) {
    const rol = ROLES.find((item) => item.id === rolId);
    if (!rol) return;
    const capacidades = capacidadesDe(rol);

    // Solo se mandan los que realmente cambian y que uno puede tocar: si
    // el rol enciende algo que quien edita no tiene, el backend rechazaría
    // el request entero y no se aplicaría nada.
    const permitidos = Object.entries(capacidades).filter(([campo, valor]) => {
      const capacidad = campo as Capacidad;
      if (Boolean(empleado[capacidad]) === valor) return false;
      return (
        motivoBloqueo({
          capacidad,
          yo: { ...membresia, id: membresia?.id ?? -1 },
          objetivo: empleado,
          puedoGestionarEquipo,
        }) === null
      );
    });

    if (permitidos.length === 0) {
      mostrar("info", "No hay nada que cambiar con ese tipo de empleado.");
      return;
    }
    guardar(empleado, Object.fromEntries(permitidos));
  }

  const enfocado = empleados.find((empleado) => empleado.id === enfocadoId) ?? null;

  /** Un interruptor de permiso, con su bloqueo y el porqué. */
  function Interruptor({
    empleado,
    capacidad,
    soloControl = false,
  }: {
    empleado: MiembroNegocio;
    capacidad: Capacidad;
    soloControl?: boolean;
  }) {
    const definicion = DEFINICIONES[capacidad];
    const motivo = motivoBloqueo({
      capacidad,
      yo: { ...membresia, id: membresia?.id ?? -1 },
      objetivo: empleado,
      puedoGestionarEquipo,
    });

    const control = (
      <Switch
        label={definicion.etiqueta}
        descripcion={soloControl ? undefined : definicion.consecuencia}
        checked={Boolean(empleado[capacidad])}
        disabled={motivo !== null}
        soloControl={soloControl}
        onChange={(valor) => guardar(empleado, { [capacidad]: valor })}
      />
    );

    if (motivo === null) return control;
    return (
      <Tooltip contenido={motivo}>
        <span className="inline-flex cursor-not-allowed">{control}</span>
      </Tooltip>
    );
  }

  return (
    <div className="space-y-lg">
      <header>
        <h1 className="font-headline-md text-headline-md-mobile tracking-tight text-primary md:text-headline-md">
          Permisos del equipo
        </h1>
        <p className="mt-1 text-[13px] text-on-surface-variant">
          Elige un tipo de empleado para arrancar rápido y ajusta lo que quieras. Tu negocio, tus
          reglas.
        </p>
      </header>

      {!puedoGestionarEquipo && (
        <p className="flex items-start gap-xs rounded-lg bg-surface-container-low p-3 font-caption text-caption text-on-surface-variant">
          <Icon name="lock" className="shrink-0 text-[18px]" />
          Solo lectura: necesitas el permiso de agregar gente y dar permisos para cambiar algo acá.
        </p>
      )}

      {cargando ? (
        <SkeletonLista filas={4} />
      ) : error ? (
        <EstadoError
          mensaje="No pudimos cargar los permisos del equipo."
          onReintentar={cargar}
        />
      ) : (
        <>
          {/* ---------- Teléfono: una persona a la vez ---------- */}
          <div className="space-y-md lg:hidden">
            <SelectCustom
              label="Persona"
              valor={String(enfocadoId ?? "")}
              onChange={(valor) => setEnfocadoId(Number(valor))}
            >
              {empleados.map((empleado) => (
                <SelectItem key={empleado.id} value={String(empleado.id)}>
                  {empleado.nombre}
                </SelectItem>
              ))}
            </SelectCustom>

            {enfocado && (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-outline-variant/60 bg-white p-3.5">
                  <Avatar nombre={enfocado.nombre} tamano="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-label-md text-label-md text-on-surface">
                      {enfocado.nombre}
                    </p>
                    <p className="truncate text-[11px] text-menta">{etiquetaDeRol(enfocado)}</p>
                  </div>
                </div>

                <SelectCustom
                  label="Tipo de empleado"
                  ayuda="Precarga los permisos. Después puedes cambiar los que quieras."
                  valor={rolDe(enfocado).rol.id}
                  onChange={(valor) => aplicarRol(enfocado, valor)}
                  disabled={!puedoGestionarEquipo}
                >
                  {ROLES.map((rol) => (
                    <SelectItem key={rol.id} value={rol.id}>
                      {rol.nombre}
                    </SelectItem>
                  ))}
                </SelectCustom>

                {GRUPOS.map(({ area, capacidades }) => (
                  <section key={area}>
                    <h2 className="mb-3 border-b border-outline-variant/60 pb-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                      {area}
                    </h2>
                    <div className="space-y-4">
                      {capacidades.map((capacidad) => (
                        <div key={capacidad} className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <Interruptor empleado={enfocado} capacidad={capacidad} />
                          </div>
                          {DEFINICIONES[capacidad].proximamente && <ChipPronto />}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </>
            )}
          </div>

          {/* ---------- Pantalla ancha: la matriz completa ---------- */}
          <div className="hidden lg:block">
            <div className="overflow-x-auto rounded-2xl border border-outline-variant/60 bg-white">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Permisos de cada miembro del equipo, agrupados por área del negocio
                </caption>
                <thead>
                  <tr className="border-b border-outline-variant/60">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 min-w-[280px] bg-white p-4 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant"
                    >
                      Permiso
                    </th>
                    {empleados.map((empleado) => (
                      <th
                        key={empleado.id}
                        scope="col"
                        className="min-w-[150px] p-4 align-bottom"
                      >
                        <div className="flex flex-col items-center gap-1.5 text-center">
                          <Avatar nombre={empleado.nombre} tamano="sm" />
                          <span className="font-label-md text-label-md text-on-surface">
                            {empleado.nombre.split(" ")[0]}
                          </span>
                          <span className="text-[11px] text-menta">
                            {etiquetaDeRol(empleado)}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-outline-variant/60 bg-surface-container-low/40">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-surface-container-low/40 p-3 pl-4 font-label-md text-label-md text-on-surface-variant"
                    >
                      Tipo de empleado
                    </th>
                    {empleados.map((empleado) => (
                      <td key={empleado.id} className="p-3">
                        <SelectCustom
                          label={`Tipo de empleado de ${empleado.nombre}`}
                          etiquetaOculta
                          valor={rolDe(empleado).rol.id}
                          onChange={(valor) => aplicarRol(empleado, valor)}
                          disabled={!puedoGestionarEquipo || empleado.id === membresia?.id}
                        >
                          {ROLES.map((rol) => (
                            <SelectItem key={rol.id} value={rol.id}>
                              {rol.nombre}
                            </SelectItem>
                          ))}
                        </SelectCustom>
                      </td>
                    ))}
                  </tr>
                </thead>

                {GRUPOS.map(({ area, capacidades }) => (
                  <tbody key={area}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={empleados.length + 1}
                        className="sticky left-0 bg-surface-container-low/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant"
                      >
                        {area}
                      </th>
                    </tr>
                    {capacidades.map((capacidad) => (
                      <tr
                        key={capacidad}
                        className="border-t border-outline-variant/40 transition-colors hover:bg-surface-container-low/30"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-white p-4 font-normal"
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-label-md text-label-md text-on-surface">
                              {DEFINICIONES[capacidad].etiqueta}
                            </span>
                            {DEFINICIONES[capacidad].proximamente && <ChipPronto />}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-on-surface-variant">
                            {DEFINICIONES[capacidad].consecuencia}
                          </span>
                        </th>
                        {empleados.map((empleado) => (
                          <td key={empleado.id} className="p-4 text-center">
                            <span className="inline-flex justify-center">
                              <Interruptor
                                empleado={empleado}
                                capacidad={capacidad}
                                soloControl
                              />
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>

            <p className="mt-3 flex items-start gap-xs font-caption text-caption text-on-surface-variant">
              <Icon name="info" className="shrink-0 text-[16px] text-menta" />
              Los interruptores bloqueados explican por qué al pasar el cursor. No puedes cambiar
              tus propios permisos ni dar uno que tú no tengas.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
