import { Icon } from "../../ui/Icon";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { etiquetaDe, moverPeriodo, rangoDe } from "./filtrosPeriodo";
import type { Periodo } from "./filtrosPeriodo";

/** Selector de período (día/semana/mes) + navegación hacia
 * atrás/adelante, compartido entre `MisServiciosPage` y
 * `ValidarServiciosPage` — ambas necesitan exactamente el mismo cálculo
 * de rango, así que vive una sola vez acá en vez de repetirse. */
export function FiltroPeriodo({
  periodo,
  referencia,
  onCambiarPeriodo,
  onCambiarReferencia,
}: {
  periodo: Periodo;
  referencia: Date;
  onCambiarPeriodo: (periodo: Periodo) => void;
  onCambiarReferencia: (referencia: Date) => void;
}) {
  const rango = rangoDe(periodo, referencia);
  const esHoy = rangoDe(periodo, new Date()).desde.getTime() === rango.desde.getTime();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup valor={periodo} onChange={(valor) => onCambiarPeriodo(valor as Periodo)}>
        <ToggleGroupItem value="dia">Día</ToggleGroupItem>
        <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
        <ToggleGroupItem value="mes">Mes</ToggleGroupItem>
      </ToggleGroup>

      <div className="flex items-center gap-1 rounded-full border border-outline-variant bg-white py-1 pl-1 pr-3">
        <button
          type="button"
          onClick={() => onCambiarReferencia(moverPeriodo(periodo, referencia, -1))}
          aria-label="Período anterior"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          <Icon name="chevron_left" className="text-[18px]" />
        </button>
        <span className="min-w-[110px] text-center font-label-md text-label-md capitalize text-on-surface">
          {etiquetaDe(periodo, rango)}
        </span>
        <button
          type="button"
          onClick={() => onCambiarReferencia(moverPeriodo(periodo, referencia, 1))}
          aria-label="Período siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low"
        >
          <Icon name="chevron_right" className="text-[18px]" />
        </button>
      </div>

      {!esHoy && (
        <button
          type="button"
          onClick={() => onCambiarReferencia(new Date())}
          className="font-caption text-caption text-menta hover:underline"
        >
          Hoy
        </button>
      )}
    </div>
  );
}
