import { useMemo } from "react";

import type { components } from "../../api/schema";
import { cn } from "../../ui/cn";
import { ESTILO_ESTADO } from "../../ui/EstadoCita";
import type { Franja } from "./horarioEfectivo";

type Cita = components["schemas"]["Cita"];

const DIAS_CORTOS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
/** Alto en px de una hora de la grilla. Define la escala de todo. */
const ALTO_HORA = 56;

/** Minutos desde medianoche, en hora local. */
function minutosDelDia(fechaIso: string): number {
  const fecha = new Date(fechaIso);
  return fecha.getHours() * 60 + fecha.getMinutes();
}

function mismoDia(fechaIso: string, dia: Date): boolean {
  const fecha = new Date(fechaIso);
  return (
    fecha.getFullYear() === dia.getFullYear() &&
    fecha.getMonth() === dia.getMonth() &&
    fecha.getDate() === dia.getDate()
  );
}

function hhmm(fechaIso: string): string {
  return new Date(fechaIso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

/** Reparte en columnas las citas que se solapan dentro de un mismo día,
 * para que dos barberos a la misma hora no queden una encima de la otra. */
function conColumnas(citas: Cita[]): Array<{ cita: Cita; columna: number; total: number }> {
  const ordenadas = [...citas].sort(
    (a, b) => minutosDelDia(a.fecha_hora_inicio) - minutosDelDia(b.fecha_hora_inicio),
  );

  const resultado: Array<{ cita: Cita; columna: number; total: number }> = [];
  let grupo: Cita[] = [];
  let finDelGrupo = -1;

  function cerrarGrupo() {
    grupo.forEach((cita, indice) => {
      resultado.push({ cita, columna: indice, total: grupo.length });
    });
    grupo = [];
    finDelGrupo = -1;
  }

  for (const cita of ordenadas) {
    const inicio = minutosDelDia(cita.fecha_hora_inicio);
    const fin = minutosDelDia(cita.fecha_hora_fin);
    if (grupo.length > 0 && inicio >= finDelGrupo) cerrarGrupo();
    grupo.push(cita);
    finDelGrupo = Math.max(finDelGrupo, fin);
  }
  if (grupo.length > 0) cerrarGrupo();

  return resultado;
}

/** Vista de semana en grilla horaria, al estilo de un calendario clásico.
 *
 * Convive con la vista de lista en vez de reemplazarla: en un teléfono
 * (que es el caso principal de esta app) siete columnas quedan
 * ilegibles, así que la lista sigue siendo el default en móvil y esta
 * vista es la de pantallas anchas. */
export function VistaSemana({
  dias,
  citas,
  horarios,
  diaSeleccionado,
  onSeleccionarDia,
  onAbrirCita,
}: {
  dias: Date[];
  citas: Cita[];
  /** Franjas ya resueltas por el llamador: propias del empleado o
   * heredadas del negocio (ver `horarioEfectivo.ts`). */
  horarios: Franja[];
  diaSeleccionado: Date;
  onSeleccionarDia: (dia: Date) => void;
  onAbrirCita: (cita: Cita) => void;
}) {
  // El rango horario visible sale de los horarios cargados: mostrar
  // 00:00–23:00 siempre sería casi todo espacio muerto.
  const [horaDesde, horaHasta] = useMemo(() => {
    const minutos = [
      ...horarios.map((horario) => Number(horario.hora_inicio.slice(0, 2))),
      ...horarios.map((horario) => Math.ceil(Number(horario.hora_fin.slice(0, 2)))),
      ...citas.map((cita) => new Date(cita.fecha_hora_inicio).getHours()),
      ...citas.map((cita) => new Date(cita.fecha_hora_fin).getHours() + 1),
    ];
    if (minutos.length === 0) return [7, 20];
    return [Math.max(0, Math.min(...minutos)), Math.min(24, Math.max(...minutos))];
  }, [horarios, citas]);

  const horas = Array.from({ length: Math.max(1, horaHasta - horaDesde) }, (_, i) => horaDesde + i);
  const altoTotal = horas.length * ALTO_HORA;
  const hoy = new Date();

  return (
    <div className="overflow-x-auto rounded-2xl border border-outline-variant bg-white">
      <div className="min-w-[720px]">
        {/* Encabezado de días */}
        <div className="sticky top-0 z-10 flex border-b border-outline-variant bg-white">
          <div className="w-[56px] shrink-0" />
          {dias.map((dia) => {
            const esHoy = dia.toDateString() === hoy.toDateString();
            const activo = dia.toDateString() === diaSeleccionado.toDateString();
            return (
              <button
                key={dia.toISOString()}
                type="button"
                onClick={() => onSeleccionarDia(dia)}
                aria-pressed={activo}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors",
                  activo ? "bg-menta/10" : "hover:bg-surface-container-low",
                )}
              >
                <span className="font-label-md text-[10px] uppercase text-on-surface-variant">
                  {DIAS_CORTOS[(dia.getDay() + 6) % 7]}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full font-label-md text-label-md",
                    esHoy ? "bg-menta text-white" : "text-on-surface",
                  )}
                >
                  {dia.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grilla */}
        <div className="relative flex" style={{ height: altoTotal }}>
          {/* Columna de horas */}
          <div className="w-[56px] shrink-0">
            {horas.map((hora) => (
              <div
                key={hora}
                className="relative border-b border-outline-variant/40"
                style={{ height: ALTO_HORA }}
              >
                <span className="absolute -top-2 right-2 font-caption text-[10px] text-on-surface-variant">
                  {String(hora).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const indiceDia = (dia.getDay() + 6) % 7;
            const delDia = citas.filter((cita) => mismoDia(cita.fecha_hora_inicio, dia));
            const ubicadas = conColumnas(delDia);
            const franjas = horarios.filter((horario) => horario.dia_semana === indiceDia);

            return (
              <div
                key={dia.toISOString()}
                className="relative flex-1 border-l border-outline-variant/40"
              >
                {/* Franjas de trabajo como fondo: deja ver de un vistazo
                    cuándo hay alguien disponible y cuándo no. */}
                {franjas.map((franja) => {
                  const inicio = Number(franja.hora_inicio.slice(0, 2)) * 60 +
                    Number(franja.hora_inicio.slice(3, 5));
                  const fin =
                    Number(franja.hora_fin.slice(0, 2)) * 60 + Number(franja.hora_fin.slice(3, 5));
                  return (
                    <div
                      key={`${franja.dia_semana}-${franja.hora_inicio}-${franja.hora_fin}`}
                      aria-hidden="true"
                      className="absolute inset-x-0 bg-surface-container-low/60"
                      style={{
                        top: ((inicio - horaDesde * 60) / 60) * ALTO_HORA,
                        height: ((fin - inicio) / 60) * ALTO_HORA,
                      }}
                    />
                  );
                })}

                {/* Líneas de hora */}
                {horas.map((hora) => (
                  <div
                    key={hora}
                    aria-hidden="true"
                    className="border-b border-outline-variant/40"
                    style={{ height: ALTO_HORA }}
                  />
                ))}

                {/* Citas */}
                {ubicadas.map(({ cita, columna, total }) => {
                  const inicio = minutosDelDia(cita.fecha_hora_inicio);
                  const fin = minutosDelDia(cita.fecha_hora_fin);
                  const estilo = ESTILO_ESTADO[cita.estado];
                  const alto = Math.max(18, ((fin - inicio) / 60) * ALTO_HORA - 2);

                  return (
                    <button
                      key={cita.id}
                      type="button"
                      onClick={() => onAbrirCita(cita)}
                      title={`${hhmm(cita.fecha_hora_inicio)} · ${cita.servicio_nombre} · ${cita.nombre_cliente}`}
                      className={cn(
                        "absolute overflow-hidden rounded border-l-[3px] px-1.5 py-0.5 text-left transition-shadow hover:z-10 hover:shadow-card",
                        estilo.bloque,
                        estilo.borde,
                      )}
                      style={{
                        top: ((inicio - horaDesde * 60) / 60) * ALTO_HORA + 1,
                        height: alto,
                        left: `calc(${(columna / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                      }}
                    >
                      <span
                        className={cn(
                          "block truncate font-label-md text-[11px] leading-tight",
                          estilo.titulo,
                        )}
                      >
                        {cita.nombre_cliente}
                      </span>
                      {alto > 30 && (
                        <span
                          className={cn("block truncate text-[10px] leading-tight", estilo.texto)}
                        >
                          {cita.servicio_nombre}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
