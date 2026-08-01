import { cn } from "./cn";
import { Icon } from "./Icon";

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function primerDiaSemana(anio: number, mes: number): number {
  const d = new Date(anio, mes, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

/** La grilla de mes (navegación + días), compartida por `DateTimePicker`
 * (fecha y hora, para agendar citas) y `DatePicker` (solo fecha, para
 * saltar a cualquier día en la Agenda). El selector de hora es cosa de
 * cada uno — acá no hay nada de eso. */
export function CalendarioMes({
  mesVista,
  anioVista,
  onCambiarMes,
  diaSeleccionado,
  mesSeleccionado,
  anioSeleccionado,
  onSeleccionarDia,
  onIrAHoy,
}: {
  mesVista: number;
  anioVista: number;
  onCambiarMes: (mes: number, anio: number) => void;
  /** -1 si no hay nada seleccionado todavía. */
  diaSeleccionado: number;
  mesSeleccionado: number;
  anioSeleccionado: number;
  onSeleccionarDia: (dia: number) => void;
  onIrAHoy: () => void;
}) {
  const hoy = new Date();

  function mesAnterior() {
    if (mesVista === 0) onCambiarMes(11, anioVista - 1);
    else onCambiarMes(mesVista - 1, anioVista);
  }

  function mesSiguiente() {
    if (mesVista === 11) onCambiarMes(0, anioVista + 1);
    else onCambiarMes(mesVista + 1, anioVista);
  }

  const totalDias = diasEnMes(anioVista, mesVista);
  const primerDia = primerDiaSemana(anioVista, mesVista);

  return (
    <div>
      {/* Navegación del mes */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={mesAnterior}
          aria-label="Mes anterior"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-container-low"
        >
          <Icon name="chevron_left" className="text-[20px]" />
        </button>
        <span className="font-label-md text-label-md text-primary">
          {MESES[mesVista]} {anioVista}
        </span>
        <button
          type="button"
          onClick={mesSiguiente}
          aria-label="Mes siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-surface-container-low"
        >
          <Icon name="chevron_right" className="text-[20px]" />
        </button>
      </div>

      {/* Cabecera de días */}
      <div className="mb-1 grid grid-cols-7 text-center font-caption text-caption text-on-surface-variant">
        {DIAS_SEMANA.map((d) => (
          <span key={d} className="py-1">{d}</span>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: primerDia }).map((_, i) => (
          <span key={`vacio-${i}`} />
        ))}
        {Array.from({ length: totalDias }).map((_, i) => {
          const dia = i + 1;
          const esHoy =
            dia === hoy.getDate() && mesVista === hoy.getMonth() && anioVista === hoy.getFullYear();
          const esSeleccionado =
            dia === diaSeleccionado && mesVista === mesSeleccionado && anioVista === anioSeleccionado;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onSeleccionarDia(dia)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
                esSeleccionado
                  ? "bg-menta font-bold text-white"
                  : esHoy
                    ? "bg-menta/10 font-semibold text-menta"
                    : "text-on-surface hover:bg-surface-container-low",
              )}
            >
              {dia}
            </button>
          );
        })}
      </div>

      {/* Botón Hoy */}
      <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-3">
        <button
          type="button"
          onClick={onIrAHoy}
          className="font-caption text-caption text-menta hover:underline"
        >
          Hoy
        </button>
      </div>
    </div>
  );
}
