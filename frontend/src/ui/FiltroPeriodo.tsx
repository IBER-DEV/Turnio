import { Icon } from "./Icon";
import { ToggleGroup, ToggleGroupItem } from "./ToggleGroup";
import { etiquetaDe, moverPeriodo, rangoDe } from "./periodos";
import type { Periodo } from "./periodos";

/** Selector de período (día/semana/mes) + navegación hacia
 * atrás/adelante.
 *
 * Vivía en `pages/servicios/` cuando sus dos consumidores eran las
 * pantallas de registro de servicios. Con el rediseño del módulo de
 * dinero (2026-08-07) esas pantallas desaparecieron y lo siguen usando
 * el histórico de caja y "Mi trabajo", que no son de la misma sección —
 * así que se mudó a `ui/`, que es donde vive lo compartido. */
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
