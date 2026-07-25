import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import type { HorarioTrabajoInput } from "../../api/types";
import { conReintentoDeAuth } from "../../auth/refresh";
import { Button } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Icon } from "../../ui/Icon";
import { Input, Select } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { Switch } from "../../ui/Switch";
import { useToast } from "../../ui/Toast";

type MiembroNegocio = components["schemas"]["MiembroNegocio"];
type HorarioTrabajo = components["schemas"]["HorarioTrabajo"];

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Una franja de trabajo dentro de un día. `id` presente = ya existe en
 * el backend; ausente = hay que crearla. */
interface Franja {
  id?: number;
  inicio: string;
  fin: string;
}

interface DiaEditable {
  activo: boolean;
  franjas: Franja[];
}

/** Plantillas para el caso común, que es lo que hace lento el alta hoy:
 * la mayoría de barberías trabaja el mismo rango casi todos los días. */
const PLANTILLAS: Array<{ etiqueta: string; dias: number[]; inicio: string; fin: string }> = [
  { etiqueta: "Lun a Vie · 9–18", dias: [0, 1, 2, 3, 4], inicio: "09:00", fin: "18:00" },
  { etiqueta: "Lun a Sáb · 8–20", dias: [0, 1, 2, 3, 4, 5], inicio: "08:00", fin: "20:00" },
  { etiqueta: "Mar a Sáb · 10–19", dias: [1, 2, 3, 4, 5], inicio: "10:00", fin: "19:00" },
];

function vacio(): DiaEditable[] {
  return Array.from({ length: 7 }, () => ({ activo: false, franjas: [] }));
}

/** Agrupa los horarios que ya existen en el backend por día. */
function desdeHorarios(horarios: HorarioTrabajo[], miembroId: number): DiaEditable[] {
  const semana = vacio();
  for (const horario of horarios) {
    if (horario.miembro !== miembroId) continue;
    const dia = semana[horario.dia_semana];
    if (!dia) continue;
    dia.activo = true;
    dia.franjas.push({
      id: horario.id,
      inicio: horario.hora_inicio.slice(0, 5),
      fin: horario.hora_fin.slice(0, 5),
    });
  }
  for (const dia of semana) {
    dia.franjas.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }
  return semana;
}

/** Editor del horario semanal completo de un empleado.
 *
 * Reemplaza al formulario anterior, que creaba **un bloque a la vez**:
 * dejar listo a un barbero de lunes a sábado eran seis envíos separados.
 * Acá se edita la semana entera y se guarda de una.
 *
 * Se mantiene la posibilidad de varias franjas por día (el caso del
 * descanso de mediodía, que el diseño original resolvía creando dos
 * bloques el mismo día) — por eso cada día es una lista, no un rango
 * único. */
export function ModalHorarioSemanal({
  abierto,
  onCerrar,
  empleados,
  horarios,
  onCambio,
}: {
  abierto: boolean;
  onCerrar: () => void;
  empleados: MiembroNegocio[];
  horarios: HorarioTrabajo[];
  onCambio: () => Promise<void>;
}) {
  const { mostrar } = useToast();
  const [miembroId, setMiembroId] = useState<number>(empleados[0]?.id ?? 0);
  const [semana, setSemana] = useState<DiaEditable[]>(vacio);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Al abrir, o al cambiar de empleado, se recarga lo que ya tiene
  // guardado ese empleado. `horarios` viene del padre y es estable entre
  // recargas, así que no hay riesgo de pisar edición en curso.
  useEffect(() => {
    if (!abierto) return;
    setSemana(desdeHorarios(horarios, miembroId));
    setError(null);
  }, [abierto, miembroId, horarios]);

  function actualizarDia(indice: number, cambio: Partial<DiaEditable>) {
    setSemana((actual) =>
      actual.map((dia, i) => (i === indice ? { ...dia, ...cambio } : dia)),
    );
  }

  function actualizarFranja(indiceDia: number, indiceFranja: number, cambio: Partial<Franja>) {
    setSemana((actual) =>
      actual.map((dia, i) =>
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
      franjas: activo && dia.franjas.length === 0 ? [{ inicio: "09:00", fin: "18:00" }] : dia.franjas,
    });
  }

  function aplicarPlantilla(plantilla: (typeof PLANTILLAS)[number]) {
    setSemana(() =>
      Array.from({ length: 7 }, (_, indice) => {
        const incluido = plantilla.dias.includes(indice);
        return {
          activo: incluido,
          franjas: incluido ? [{ inicio: plantilla.inicio, fin: plantilla.fin }] : [],
        };
      }),
    );
    setError(null);
  }

  function validar(): string | null {
    const algunDia = semana.some((dia) => dia.activo && dia.franjas.length > 0);
    if (!algunDia) return "Activa al menos un día con su horario.";

    for (const [indice, dia] of semana.entries()) {
      if (!dia.activo) continue;
      for (const franja of dia.franjas) {
        if (!franja.inicio || !franja.fin) {
          return `Completa las horas de ${DIAS_SEMANA[indice]}.`;
        }
        if (franja.inicio >= franja.fin) {
          return `En ${DIAS_SEMANA[indice]}, la hora de inicio debe ser anterior a la de fin.`;
        }
      }
      // Franjas del mismo día que se pisan entre sí.
      const ordenadas = [...dia.franjas].sort((a, b) => a.inicio.localeCompare(b.inicio));
      for (let i = 1; i < ordenadas.length; i += 1) {
        if (ordenadas[i].inicio < ordenadas[i - 1].fin) {
          return `En ${DIAS_SEMANA[indice]} hay dos franjas que se cruzan.`;
        }
      }
    }
    return null;
  }

  async function guardar(evento: FormEvent) {
    evento.preventDefault();

    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setGuardando(true);

    const previos = horarios.filter((horario) => horario.miembro === miembroId);
    const idsQueSiguen = new Set(
      semana.flatMap((dia) =>
        dia.activo ? dia.franjas.map((franja) => franja.id).filter(Boolean) : [],
      ),
    );

    // El contrato no tiene endpoint de escritura en lote (ver duda
    // abierta en ROADMAP-FRONTEND.md); se resuelve con N llamadas.
    const operaciones: Array<Promise<{ error?: unknown }>> = [];

    for (const previo of previos) {
      if (!idsQueSiguen.has(previo.id)) {
        operaciones.push(
          conReintentoDeAuth(() =>
            apiClient.DELETE("/api/agenda/horarios/{id}/", {
              params: { path: { id: previo.id } },
            }),
          ),
        );
      }
    }

    for (const [indice, dia] of semana.entries()) {
      if (!dia.activo) continue;
      for (const franja of dia.franjas) {
        const cuerpo: HorarioTrabajoInput = {
          miembro: miembroId,
          dia_semana: indice as HorarioTrabajoInput["dia_semana"],
          hora_inicio: `${franja.inicio}:00`,
          hora_fin: `${franja.fin}:00`,
        };

        if (franja.id === undefined) {
          operaciones.push(
            conReintentoDeAuth(() =>
              apiClient.POST("/api/agenda/horarios/", { body: cuerpo as HorarioTrabajo }),
            ),
          );
        } else {
          const original = previos.find((previo) => previo.id === franja.id);
          const cambio =
            original &&
            (original.hora_inicio.slice(0, 5) !== franja.inicio ||
              original.hora_fin.slice(0, 5) !== franja.fin);
          if (cambio) {
            operaciones.push(
              conReintentoDeAuth(() =>
                apiClient.PATCH("/api/agenda/horarios/{id}/", {
                  params: { path: { id: franja.id as number } },
                  body: cuerpo,
                }),
              ),
            );
          }
        }
      }
    }

    const resultados = await Promise.all(operaciones);
    setGuardando(false);

    const fallidos = resultados.filter((resultado) => resultado.error).length;
    if (fallidos > 0) {
      setError(
        `Quedaron ${fallidos} ${fallidos === 1 ? "cambio" : "cambios"} sin guardar. Revisa el horario y reintenta.`,
      );
      await onCambio();
      return;
    }

    mostrar("exito", "Horario actualizado.");
    await onCambio();
    onCerrar();
  }

  const empleado = empleados.find((item) => item.id === miembroId);

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Horario semanal"
      descripcion="Define de una vez la semana completa. Sin horario cargado, un empleado no puede recibir citas."
    >
      <form className="space-y-md" onSubmit={guardar}>
        <Select
          label="Empleado"
          value={miembroId}
          onChange={(e) => setMiembroId(Number(e.target.value))}
        >
          {empleados.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </Select>

        <div>
          <p className="mb-2 font-label-md text-label-md text-on-surface-variant">
            Aplicar un horario típico
          </p>
          <div className="hide-scrollbar -mx-md flex gap-2 overflow-x-auto px-md">
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
                  label={`Trabaja el ${DIAS_SEMANA[indice]}`}
                  checked={dia.activo}
                  onChange={(valor) => alternarDia(indice, valor)}
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

                  {/* El caso del almuerzo: dos franjas el mismo día. */}
                  <button
                    type="button"
                    onClick={() =>
                      actualizarDia(indice, {
                        franjas: [...dia.franjas, { inicio: "14:00", fin: "18:00" }],
                      })
                    }
                    className="flex items-center gap-1 font-caption text-caption text-secondary hover:underline"
                  >
                    <Icon name="add" className="text-[16px]" />
                    Agregar descanso (partir el día)
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {error && (
          <p role="alert" className="flex items-start gap-xs font-caption text-caption text-error">
            <Icon name="error" className="shrink-0 text-[18px]" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
          <Button type="button" variante="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardando}>
            Guardar horario{empleado ? ` de ${empleado.nombre.split(" ")[0]}` : ""}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
