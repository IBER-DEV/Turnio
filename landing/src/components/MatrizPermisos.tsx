import { useState } from "react";

/**
 * Matriz de capacidades interactiva: el visitante mueve los switches de
 * un empleado simulado y ve, en la pantalla de al lado, qué deja de
 * aparecerle a esa persona.
 *
 * Las cinco capacidades son las reales del modelo `MiembroNegocio`
 * (ver `../CONTRATO.md` sección 5). No hay roles fijos tipo
 * "Admin/Empleado": eso es justamente lo que se está vendiendo acá.
 *
 * `puede_cobrar` se muestra atenuada y marcada como próxima porque el
 * módulo de caja es Fase 3 y todavía no existe — la capacidad ya está
 * en el modelo, pero no hay nada que habilitar con ella todavía.
 */

interface Capacidad {
  campo: string;
  etiqueta: string;
  descripcion: string;
  /** La capacidad existe en el modelo, pero su módulo aún no. */
  proxima?: boolean;
}

const CAPACIDADES: Capacidad[] = [
  {
    campo: "puede_gestionar_agenda",
    etiqueta: "Gestionar la agenda",
    descripcion: "Agendar citas y definir horarios de todo el equipo.",
  },
  {
    campo: "puede_editar_precios",
    etiqueta: "Editar precios",
    descripcion: "Modificar el catálogo de servicios y sus tarifas.",
  },
  {
    campo: "puede_gestionar_empleados",
    etiqueta: "Gestionar el equipo",
    descripcion: "Agregar personas y cambiar sus permisos.",
  },
  {
    campo: "puede_cobrar",
    etiqueta: "Cobrar",
    descripcion: "Registrar pagos de citas y cerrar caja.",
    proxima: true,
  },
  {
    campo: "puede_ver_reportes",
    etiqueta: "Ver reportes",
    descripcion: "Ingresos del negocio y estadísticas.",
    proxima: true,
  },
];

const INICIAL: Record<string, boolean> = {
  puede_gestionar_agenda: true,
  puede_editar_precios: false,
  puede_gestionar_empleados: false,
  puede_cobrar: false,
  puede_ver_reportes: false,
};

export function MatrizPermisos() {
  const [permisos, setPermisos] = useState(INICIAL);

  function alternar(campo: string) {
    setPermisos((actual) => ({ ...actual, [campo]: !actual[campo] }));
  }

  const activas = Object.values(permisos).filter(Boolean).length;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
      {/* Panel de switches */}
      <div className="rounded-2xl border border-borde bg-superficie p-6 shadow-tarjeta md:p-8">
        <div className="mb-6 flex items-center gap-4 border-b border-borde pb-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo text-sm font-extrabold text-white">
            MG
          </span>
          <div className="min-w-0">
            <p className="text-base font-extrabold text-indigo">Mateo Gómez</p>
            <p className="text-sm text-texto-suave">Barbero · Fade y diseño</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-lienzo px-3 py-1 text-xs font-bold text-texto-suave">
            {activas}/5 activas
          </span>
        </div>

        <ul className="space-y-1">
          {CAPACIDADES.map((capacidad) => {
            const activo = permisos[capacidad.campo];
            return (
              <li key={capacidad.campo}>
                <label
                  className={`flex cursor-pointer items-start gap-4 rounded-xl p-3 transition-colors hover:bg-lienzo ${
                    capacidad.proxima ? "opacity-70" : ""
                  }`}
                >
                  <button
                    type="button"
                    role="switch"
                    aria-checked={activo}
                    onClick={() => alternar(capacidad.campo)}
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                      activo ? "bg-menta" : "bg-slate-300"
                    }`}
                  >
                    <span className="sr-only">{capacidad.etiqueta}</span>
                    <span
                      className={`block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                        activo ? "translate-x-[22px]" : "translate-x-[2px]"
                      }`}
                    ></span>
                  </button>

                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-indigo">{capacidad.etiqueta}</span>
                      {capacidad.proxima && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Próximamente
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-texto-suave">
                      {capacidad.descripcion}
                    </span>
                    <code className="mt-1 block font-mono text-[10px] text-slate-400">
                      {capacidad.campo}
                    </code>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Pantalla resultante — tokens reales de la app */}
      <div className="mx-auto w-full max-w-[260px]">
        <div className="rounded-[2rem] border-[6px] border-slate-900 bg-slate-900 shadow-elevada">
          <div className="overflow-hidden rounded-[1.5rem] bg-app-surface">
            <div className="bg-app-surface px-4 pb-3 pt-5">
              <p className="text-[9px] font-medium text-app-on-surface-variant">Lo que ve Mateo</p>
              <p className="text-[13px] font-extrabold tracking-tight text-app-primary">
                Su Turnio
              </p>
            </div>

            <div className="space-y-2 px-4 pb-4">
              {permisos.puede_gestionar_agenda ? (
                <Modulo titulo="Agenda" detalle="Agendar y mover citas" activo />
              ) : (
                <Modulo titulo="Agenda" detalle="Solo ve sus propias citas" />
              )}

              {permisos.puede_editar_precios && (
                <Modulo titulo="Servicios" detalle="Editar precios y duración" activo />
              )}
              {permisos.puede_gestionar_empleados && (
                <Modulo titulo="Equipo" detalle="Agregar y dar permisos" activo />
              )}
              {permisos.puede_cobrar && (
                <Modulo titulo="Caja" detalle="Registrar pagos" activo proxima />
              )}
              {permisos.puede_ver_reportes && (
                <Modulo titulo="Reportes" detalle="Ingresos del negocio" activo proxima />
              )}

              {!permisos.puede_editar_precios &&
                !permisos.puede_gestionar_empleados &&
                !permisos.puede_cobrar &&
                !permisos.puede_ver_reportes && (
                  <p className="rounded-lg border border-dashed border-app-outline-variant px-3 py-4 text-center text-[9px] leading-relaxed text-app-on-surface-variant">
                    Mateo no ve precios, ni reportes,
                    <br />
                    ni puede tocar al resto del equipo.
                  </p>
                )}
            </div>

            <div className="flex items-center justify-around border-t border-app-outline-variant bg-app-surface px-3 py-2">
              <span className="rounded-xl bg-app-primary-fixed px-2 py-1 text-[8px] font-bold text-app-primary">
                Inicio
              </span>
              <span className="px-2 py-1 text-[8px] font-bold text-app-on-surface-variant">
                Agenda
              </span>
              {permisos.puede_editar_precios && (
                <span className="px-2 py-1 text-[8px] font-bold text-app-on-surface-variant">
                  Servicios
                </span>
              )}
              {permisos.puede_gestionar_empleados && (
                <span className="px-2 py-1 text-[8px] font-bold text-app-on-surface-variant">
                  Equipo
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-texto-suave">
          Mueve los switches y mira cómo cambia
          <br />
          lo que esta persona puede ver.
        </p>
      </div>
    </div>
  );
}

function Modulo({
  titulo,
  detalle,
  activo = false,
  proxima = false,
}: {
  titulo: string;
  detalle: string;
  activo?: boolean;
  proxima?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 transition-all ${
        activo
          ? "border-app-outline-variant bg-app-surface-lowest"
          : "border-app-outline-variant/50 bg-app-surface-low/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-app-primary">{titulo}</p>
        {proxima && (
          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-bold uppercase text-amber-700">
            Pronto
          </span>
        )}
      </div>
      <p className="text-[9px] text-app-on-surface-variant">{detalle}</p>
    </div>
  );
}
