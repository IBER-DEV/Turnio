import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { Switch } from "../../ui/Switch";
import { Tabs, TabsContent, TabsLista, TabsTrigger } from "../../ui/Tabs";
import { useToast } from "../../ui/Toast";
import { tieneHorarioPropio } from "./horarioEfectivo";

type MiembroEquipo = components["schemas"]["MiembroEquipo"];
type HorarioNegocio = components["schemas"]["HorarioNegocio"];
type HorarioTrabajo = components["schemas"]["HorarioTrabajo"];

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Una franja de trabajo dentro de un día. */
interface Franja {
  inicio: string;
  fin: string;
}

interface DiaEditable {
  activo: boolean;
  franjas: Franja[];
}

/** Plantillas para el caso común: la mayoría de barberías abre el mismo
 * rango casi todos los días. */
const PLANTILLAS: Array<{ etiqueta: string; dias: number[]; inicio: string; fin: string }> = [
  { etiqueta: "Lun a Vie · 9–18", dias: [0, 1, 2, 3, 4], inicio: "09:00", fin: "18:00" },
  { etiqueta: "Lun a Sáb · 8–20", dias: [0, 1, 2, 3, 4, 5], inicio: "08:00", fin: "20:00" },
  { etiqueta: "Mar a Sáb · 10–19", dias: [1, 2, 3, 4, 5], inicio: "10:00", fin: "19:00" },
];

function vacio(): DiaEditable[] {
  return Array.from({ length: 7 }, () => ({ activo: false, franjas: [] }));
}

/** Agrupa por día un conjunto de franjas ya guardadas en el backend. */
function desdeFranjas(
  franjas: Array<{ dia_semana: number; hora_inicio: string; hora_fin: string }>,
): DiaEditable[] {
  const semana = vacio();
  for (const franja of franjas) {
    const dia = semana[franja.dia_semana];
    if (!dia) continue;
    dia.activo = true;
    dia.franjas.push({
      inicio: franja.hora_inicio.slice(0, 5),
      fin: franja.hora_fin.slice(0, 5),
    });
  }
  for (const dia of semana) {
    dia.franjas.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }
  return semana;
}

/** Convierte la semana editada al body que espera el backend. */
function aFranjasApi(semana: DiaEditable[]) {
  return semana.flatMap((dia, indice) =>
    dia.activo
      ? dia.franjas.map((franja) => ({
          dia_semana: indice as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          hora_inicio: `${franja.inicio}:00`,
          hora_fin: `${franja.fin}:00`,
        }))
      : [],
  );
}

function validar(semana: DiaEditable[]): string | null {
  if (!semana.some((dia) => dia.activo && dia.franjas.length > 0)) {
    return "Activa al menos un día con su horario.";
  }

  for (const [indice, dia] of semana.entries()) {
    if (!dia.activo) continue;
    for (const franja of dia.franjas) {
      if (!franja.inicio || !franja.fin) return `Completa las horas de ${DIAS_SEMANA[indice]}.`;
      if (franja.inicio >= franja.fin) {
        return `En ${DIAS_SEMANA[indice]}, la hora de inicio debe ser anterior a la de fin.`;
      }
    }
    const ordenadas = [...dia.franjas].sort((a, b) => a.inicio.localeCompare(b.inicio));
    for (let i = 1; i < ordenadas.length; i += 1) {
      if (ordenadas[i].inicio < ordenadas[i - 1].fin) {
        return `En ${DIAS_SEMANA[indice]} hay dos franjas que se cruzan.`;
      }
    }
  }
  return null;
}

/** Editor de una semana: siete días, cada uno con sus franjas.
 *
 * Es el mismo control para el horario del negocio y para el de un
 * empleado — lo único que cambia es qué se hace con el resultado. */
function EditorSemana({
  semana,
  onCambiar,
}: {
  semana: DiaEditable[];
  onCambiar: (siguiente: DiaEditable[]) => void;
}) {
  function actualizarDia(indice: number, cambio: Partial<DiaEditable>) {
    onCambiar(semana.map((dia, i) => (i === indice ? { ...dia, ...cambio } : dia)));
  }

  function actualizarFranja(indiceDia: number, indiceFranja: number, cambio: Partial<Franja>) {
    onCambiar(
      semana.map((dia, i) =>
        i === indiceDia
          ? {
              ...dia,
              franjas: dia.franjas.map((franja, j) =>
                j === indiceFranja ? { ...franja, ...cambio } : franja,
              ),
            }
          : dia,
      ),
    );
  }

  function alternarDia(indice: number, activo: boolean) {
    // Al encender un día sin franjas se le pone una por defecto, para que
    // el usuario no tenga que hacer dos gestos.
    const dia = semana[indice];
    actualizarDia(indice, {
      activo,
      franjas:
        activo && dia.franjas.length === 0 ? [{ inicio: "09:00", fin: "18:00" }] : dia.franjas,
    });
  }

  function aplicarPlantilla(plantilla: (typeof PLANTILLAS)[number]) {
    onCambiar(
      Array.from({ length: 7 }, (_, indice) => {
        const incluido = plantilla.dias.includes(indice);
        return {
          activo: incluido,
          franjas: incluido ? [{ inicio: plantilla.inicio, fin: plantilla.fin }] : [],
        };
      }),
    );
  }

  return (
    <>
      <div>
        <p className="mb-2 font-label-md text-label-md text-on-surface-variant">
          Aplicar un horario típico
        </p>
        <div className="hide-scrollbar -mx-6 flex gap-2 overflow-x-auto px-6">
          {PLANTILLAS.map((plantilla) => (
            <button
              key={plantilla.etiqueta}
              type="button"
              onClick={() => aplicarPlantilla(plantilla)}
              className="tactile shrink-0 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-caption text-caption text-on-surface transition-colors hover:bg-surface-container"
            >
              {plantilla.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {semana.map((dia, indice) => (
          <li
            key={DIAS_SEMANA[indice]}
            className={cn(
              "rounded-lg border p-3 transition-colors",
              dia.activo
                ? "border-outline-variant bg-surface-container-lowest"
                : "border-outline-variant/50 bg-surface-container-low/40",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "font-label-md text-label-md",
                  dia.activo ? "text-primary" : "text-on-surface-variant",
                )}
              >
                {DIAS_SEMANA[indice]}
              </span>
              <Switch
                label={`Abre el ${DIAS_SEMANA[indice]}`}
                checked={dia.activo}
                onChange={(valor) => alternarDia(indice, valor)}
                soloControl
              />
            </div>

            {dia.activo && (
              <div className="animate-fade-in mt-3 space-y-2">
                {dia.franjas.map((franja, indiceFranja) => (
                  <div key={indiceFranja} className="flex items-end gap-2">
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <Input
                        label="Desde"
                        type="time"
                        value={franja.inicio}
                        onChange={(e) =>
                          actualizarFranja(indice, indiceFranja, { inicio: e.target.value })
                        }
                      />
                      <Input
                        label="Hasta"
                        type="time"
                        value={franja.fin}
                        onChange={(e) =>
                          actualizarFranja(indice, indiceFranja, { fin: e.target.value })
                        }
                      />
                    </div>
                    {dia.franjas.length > 1 && (
                      <Button
                        type="button"
                        variante="ghost"
                        className="mb-1 px-2 text-error"
                        aria-label={`Quitar franja de ${DIAS_SEMANA[indice]}`}
                        onClick={() =>
                          actualizarDia(indice, {
                            franjas: dia.franjas.filter((_, j) => j !== indiceFranja),
                          })
                        }
                      >
                        <Icon name="delete" />
                      </Button>
                    )}
                  </div>
                ))}

                {/* El caso del cierre de mediodía: dos franjas el mismo día. */}
                <button
                  type="button"
                  onClick={() =>
                    actualizarDia(indice, {
                      franjas: [...dia.franjas, { inicio: "14:00", fin: "18:00" }],
                    })
                  }
                  className="flex items-center gap-1 font-caption text-caption text-menta hover:underline"
                >
                  <Icon name="add" className="text-[16px]" />
                  Agregar descanso (partir el día)
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function MensajeError({ texto }: { texto: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
      <Icon name="error" className="shrink-0 text-[18px]" />
      {texto}
    </p>
  );
}

/** Horarios del negocio y sus excepciones.
 *
 * El horario **del negocio** es la pestaña por defecto porque es el caso
 * real: el local abre a una hora y el equipo entero trabaja esa hora.
 * Antes esta pantalla obligaba a elegir un empleado y cargarle la semana
 * a mano, uno por uno, repitiendo el mismo dato tantas veces como
 * empleados hubiera — y dejando a cada empleado nuevo sin disponibilidad
 * hasta que alguien se acordara.
 *
 * La segunda pestaña cubre al que trabaja distinto (medio tiempo, solo
 * sábados, turno de tarde). Es deliberadamente el camino secundario.
 */
export function ModalHorarioSemanal({
  abierto,
  onCerrar,
  empleados,
  horarioNegocio,
  horarios,
  onCambio,
}: {
  abierto: boolean;
  onCerrar: () => void;
  empleados: MiembroEquipo[];
  horarioNegocio: HorarioNegocio[];
  horarios: HorarioTrabajo[];
  onCambio: () => Promise<void>;
}) {
  const { mostrar } = useToast();
  const [pestana, setPestana] = useState("negocio");

  const [semanaNegocio, setSemanaNegocio] = useState<DiaEditable[]>(vacio);
  const [semanaEmpleado, setSemanaEmpleado] = useState<DiaEditable[]>(vacio);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setSemanaNegocio(desdeFranjas(horarioNegocio));
    setError(null);
  }, [abierto, horarioNegocio]);

  // Al elegir empleados se precarga el horario del primero que ya tenga
  // uno propio; si ninguno lo tiene, se arranca del horario del negocio,
  // que es de donde se parte para hacer una excepción.
  useEffect(() => {
    if (!abierto) return;
    const conPropio = seleccionados.find((id) => tieneHorarioPropio(id, horarios));
    setSemanaEmpleado(
      conPropio !== undefined
        ? desdeFranjas(horarios.filter((horario) => horario.miembro === conPropio))
        : desdeFranjas(horarioNegocio),
    );
    setError(null);
  }, [abierto, seleccionados, horarios, horarioNegocio]);

  function alternarEmpleado(id: number) {
    setSeleccionados((actual) =>
      actual.includes(id) ? actual.filter((otro) => otro !== id) : [...actual, id],
    );
  }

  async function guardarNegocio(evento: FormEvent) {
    evento.preventDefault();
    const problema = validar(semanaNegocio);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setGuardando(true);

    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PUT("/api/agenda/horario-negocio/", {
        body: { franjas: aFranjasApi(semanaNegocio) },
      }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError("No se pudo guardar el horario. El anterior quedó intacto.");
      return;
    }
    mostrar("exito", "Horario del negocio actualizado.");
    await onCambio();
    onCerrar();
  }

  async function enviarHorarioPropio(franjas: ReturnType<typeof aFranjasApi>, exito: string) {
    setGuardando(true);
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PUT("/api/agenda/horarios/semana/", {
        body: { miembros: seleccionados, franjas },
      }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError("No se pudo guardar el horario. El anterior quedó intacto.");
      return;
    }
    mostrar("exito", exito);
    await onCambio();
    onCerrar();
  }

  async function guardarEmpleados(evento: FormEvent) {
    evento.preventDefault();
    if (seleccionados.length === 0) {
      setError("Elige al menos un empleado.");
      return;
    }
    const problema = validar(semanaEmpleado);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    await enviarHorarioPropio(
      aFranjasApi(semanaEmpleado),
      seleccionados.length === 1
        ? "Horario propio actualizado."
        : `Horario aplicado a ${seleccionados.length} empleados.`,
    );
  }

  // Lista vacía = quitar la excepción y volver a heredar (ver CONTRATO.md 5.7).
  async function volverAHeredar() {
    if (seleccionados.length === 0) {
      setError("Elige al menos un empleado.");
      return;
    }
    setError(null);
    await enviarHorarioPropio([], "Vuelven al horario del negocio.");
  }

  const seleccionConPropio = seleccionados.filter((id) => tieneHorarioPropio(id, horarios));

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Horarios"
      descripcion="El horario del negocio rige para todo el equipo. Solo carga un horario aparte para quien trabaje distinto."
    >
      <Tabs valor={pestana} onChange={setPestana} className="space-y-6">
        <TabsLista className="w-full">
          <TabsTrigger value="negocio" className="flex-1 gap-1.5">
            <Icon name="storefront" className="text-[18px]" />
            Todo el negocio
          </TabsTrigger>
          <TabsTrigger value="empleado" className="flex-1 gap-1.5">
            <Icon name="group" className="text-[18px]" />
            Excepciones
          </TabsTrigger>
        </TabsLista>

        <TabsContent value="negocio">
          <form className="space-y-6" onSubmit={guardarNegocio}>
            <p className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 font-caption text-caption text-on-surface-variant">
              <Icon name="info" className="shrink-0 text-[18px] text-menta" />
              Este es el horario en que atiende el local. Todo el equipo trabaja estas horas, y los
              empleados nuevos las toman automáticamente.
            </p>

            <EditorSemana semana={semanaNegocio} onCambiar={setSemanaNegocio} />

            {error && pestana === "negocio" && <MensajeError texto={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variante="ghost" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="submit" cargando={guardando}>
                Guardar horario del negocio
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="empleado">
          <form className="space-y-6" onSubmit={guardarEmpleados}>
            <p className="flex items-start gap-2 rounded-lg bg-surface-container-low p-3 font-caption text-caption text-on-surface-variant">
              <Icon name="info" className="shrink-0 text-[18px] text-menta" />
              Solo para quien no trabaja el horario del local: medio tiempo, solo sábados, turno de
              tarde. Puedes marcar varios si comparten turno.
            </p>

            <fieldset>
              <legend className="mb-2 font-label-md text-label-md text-on-surface-variant">
                ¿Quiénes trabajan distinto?
              </legend>
              <div className="flex flex-wrap gap-2">
                {empleados.map((empleado) => {
                  const marcado = seleccionados.includes(empleado.id);
                  const propio = tieneHorarioPropio(empleado.id, horarios);
                  return (
                    <label
                      key={empleado.id}
                      className={cn(
                        "tactile flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 font-caption text-caption transition-colors",
                        marcado
                          ? "border-menta bg-menta text-white"
                          : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={marcado}
                        onChange={() => alternarEmpleado(empleado.id)}
                      />
                      {marcado && <Icon name="check" className="text-[16px]" />}
                      {empleado.nombre}
                      {propio && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[11px] leading-none",
                            marcado ? "bg-white/25" : "bg-surface-container text-on-surface-variant",
                          )}
                          title="Ya tiene un horario propio distinto al del negocio"
                        >
                          propio
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {seleccionados.length > 0 && (
              <div className="animate-fade-in space-y-6">
                <EditorSemana semana={semanaEmpleado} onCambiar={setSemanaEmpleado} />

                {seleccionConPropio.length > 0 && (
                  <button
                    type="button"
                    onClick={volverAHeredar}
                    disabled={guardando}
                    className="flex items-center gap-1 font-caption text-caption text-menta hover:underline disabled:opacity-50"
                  >
                    <Icon name="storefront" className="text-[16px]" />
                    Quitar la excepción y volver al horario del negocio
                  </button>
                )}
              </div>
            )}

            {error && pestana === "empleado" && <MensajeError texto={error} />}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variante="ghost" onClick={onCerrar} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="submit" cargando={guardando} disabled={seleccionados.length === 0}>
                Guardar excepción
                {seleccionados.length > 1 ? ` (${seleccionados.length})` : ""}
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
