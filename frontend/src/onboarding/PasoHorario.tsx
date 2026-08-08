import { useState } from "react";

import { apiClient } from "../api/client";
import type { components } from "../api/schema";
import { conReintentoDeAuth } from "../auth/refresh";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { cn } from "../ui/cn";

/** Los días como los numera el backend (`DiaSemana.LUNES = 0`).
 *
 * `DiaSemana` sale del schema y no es `number`: el backend expone la
 * unión `0 | 1 | ... | 6`, así que un día fuera de rango no compila en
 * vez de fallar con un 400 en tiempo de ejecución.
 */
type DiaSemana = components["schemas"]["FranjaHorario"]["dia_semana"];

const DIAS: Array<{ valor: DiaSemana; corto: string; largo: string }> = [
  { valor: 0, corto: "L", largo: "Lunes" },
  { valor: 1, corto: "M", largo: "Martes" },
  { valor: 2, corto: "X", largo: "Miércoles" },
  { valor: 3, corto: "J", largo: "Jueves" },
  { valor: 4, corto: "V", largo: "Viernes" },
  { valor: 5, corto: "S", largo: "Sábado" },
  { valor: 6, corto: "D", largo: "Domingo" },
];

interface Preset {
  etiqueta: string;
  detalle: string;
  dias: DiaSemana[];
  desde: string;
  hasta: string;
}

/** Los patrones que cubren casi todo local de barrio en Colombia.
 * Existen para que lo normal sea **un toque**, no configurar siete días.
 *
 * Cada preset dice **exactamente** lo que aplica. Hubo una versión con
 * un "sábado más corto" que en realidad ponía el mismo rango todos los
 * días —el paso maneja un solo rango— y una etiqueta que miente es peor
 * que no ofrecer el atajo: quien confía en ella publica un horario que
 * no es el suyo y se entera cuando le caiga un cliente a deshora.
 */
const PRESETS: Preset[] = [
  {
    etiqueta: "Lunes a sábado",
    detalle: "9:00 a 19:00, corrido",
    dias: [0, 1, 2, 3, 4, 5],
    desde: "09:00",
    hasta: "19:00",
  },
  {
    etiqueta: "Solo entre semana",
    detalle: "Lunes a viernes, 9:00 a 18:00",
    dias: [0, 1, 2, 3, 4],
    desde: "09:00",
    hasta: "18:00",
  },
];

/** El horario de atención del negocio.
 *
 * **Es el paso que no se puede saltar**: sin franjas, el enlace público
 * no ofrece ni una hora y el negocio no puede recibir una sola reserva.
 *
 * Deliberadamente **más simple que el editor de Agenda**: un rango por
 * día, igual para todos los días marcados. No hay horario partido (cierre
 * de mediodía) ni horario por empleado, que sí existen en el modelo y se
 * ajustan después desde Agenda. Meter eso acá convertiría el primer
 * minuto en el producto en una hoja de cálculo — y el 90% de los locales
 * abre y cierra a la misma hora todos los días.
 */
export function PasoHorario({
  onListo,
  conEquipo,
}: {
  onListo: () => Promise<void>;
  /** Solo cambia el texto de ayuda: con equipo, conviene decir que el
   * horario se hereda. No se persiste en ninguna parte. */
  conEquipo: boolean;
}) {
  const [dias, setDias] = useState<DiaSemana[]>([0, 1, 2, 3, 4, 5]);
  const [desde, setDesde] = useState("09:00");
  const [hasta, setHasta] = useState("19:00");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function alternarDia(valor: DiaSemana) {
    setDias((actual) =>
      actual.includes(valor) ? actual.filter((d) => d !== valor) : [...actual, valor].sort(),
    );
  }

  function aplicarPreset(preset: Preset) {
    setDias(preset.dias);
    setDesde(preset.desde);
    setHasta(preset.hasta);
  }

  async function guardar() {
    setError(null);
    if (dias.length === 0) {
      setError("Marca al menos un día de atención.");
      return;
    }
    if (desde >= hasta) {
      setError("La hora de apertura tiene que ser anterior a la de cierre.");
      return;
    }

    setGuardando(true);
    const { error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.PUT("/api/agenda/horario-negocio/", {
        body: {
          franjas: dias.map((dia) => ({
            dia_semana: dia,
            hora_inicio: desde,
            hora_fin: hasta,
          })),
        },
      }),
    );
    setGuardando(false);

    if (errorRespuesta) {
      setError("No se pudo guardar el horario. Intenta de nuevo.");
      return;
    }
    await onListo();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.etiqueta}
            type="button"
            onClick={() => aplicarPreset(preset)}
            className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant bg-white px-4 py-3 text-left transition-colors hover:border-menta/40"
          >
            <span>
              <span className="block font-label-md text-label-md text-on-surface">
                {preset.etiqueta}
              </span>
              <span className="block font-caption text-caption text-on-surface-variant">
                {preset.detalle}
              </span>
            </span>
            <Icon name="chevron_right" className="shrink-0 text-outline" />
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-label-md text-label-md text-on-surface">¿Qué días abres?</p>
        <div className="flex flex-wrap gap-2">
          {DIAS.map((dia) => {
            const activo = dias.includes(dia.valor);
            return (
              <button
                key={dia.valor}
                type="button"
                onClick={() => alternarDia(dia.valor)}
                aria-pressed={activo}
                aria-label={dia.largo}
                className={cn(
                  "h-11 w-11 rounded-full border font-label-md text-label-md transition-colors",
                  activo
                    ? "border-menta bg-menta text-white"
                    : "border-outline-variant bg-white text-on-surface-variant hover:border-menta/40",
                )}
              >
                {dia.corto}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-2">
          <span className="font-label-md text-label-md text-on-surface">Abres</span>
          <input
            type="time"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-body-md text-body-md text-on-surface outline-hidden focus:border-menta focus:ring-2 focus:ring-menta/20"
          />
        </label>
        <label className="flex flex-1 flex-col gap-2">
          <span className="font-label-md text-label-md text-on-surface">Cierras</span>
          <input
            type="time"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-body-md text-body-md text-on-surface outline-hidden focus:border-menta focus:ring-2 focus:ring-menta/20"
          />
        </label>
      </div>

      <p className="flex items-start gap-2 font-caption text-caption text-on-surface-variant">
        <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
        {conEquipo
          ? "Este es el horario del local y todo tu equipo lo hereda. Si alguien trabaja distinto (medio tiempo, solo sábados), se lo ajustas después desde Agenda."
          : "Si un día abres distinto —el sábado más corto, o cierras al mediodía— lo ajustas después desde Agenda."}
      </p>

      {error && (
        <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
          <Icon name="error" className="shrink-0 text-[18px]" />
          {error}
        </p>
      )}

      <Button onClick={guardar} cargando={guardando} anchoCompleto>
        Continuar
      </Button>
    </div>
  );
}
