import * as Popover from "@radix-ui/react-popover";
import { useCallback, useMemo, useState } from "react";

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

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatearFechaCorta(date: Date): string {
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${dias[date.getDay()]} ${date.getDate()} ${MESES[date.getMonth()]?.slice(0, 3)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function generarSlots(): string[] {
  const slots: string[] = [];
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${pad(h)}:${pad(m)}`);
    }
  }
  return slots;
}

const SLOTS_HORA = generarSlots();

export function DateTimePicker({
  label,
  valor,
  onChange,
  error,
  required = false,
}: {
  label: string;
  valor: string;
  onChange: (isoString: string) => void;
  error?: string;
  required?: boolean;
}) {
  const fecha = useMemo(() => {
    if (!valor) return new Date();
    return new Date(valor);
  }, [valor]);

  const [mesVista, setMesVista] = useState(fecha.getMonth());
  const [anioVista, setAnioVista] = useState(fecha.getFullYear());
  const [abierto, setAbierto] = useState(false);

  const diaSeleccionado = valor ? fecha.getDate() : -1;
  const mesSeleccionado = valor ? fecha.getMonth() : -1;
  const anioSeleccionado = valor ? fecha.getFullYear() : -1;
  const horaSeleccionada = valor ? `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}` : "";

  const hoy = useMemo(() => new Date(), []);

  const mesAnterior = useCallback(() => {
    if (mesVista === 0) {
      setMesVista(11);
      setAnioVista((a) => a - 1);
    } else {
      setMesVista((m) => m - 1);
    }
  }, [mesVista]);

  const mesSiguiente = useCallback(() => {
    if (mesVista === 11) {
      setMesVista(0);
      setAnioVista((a) => a + 1);
    } else {
      setMesVista((m) => m + 1);
    }
  }, [mesVista]);

  function seleccionarDia(dia: number) {
    const h = valor ? fecha.getHours() : 9;
    const m = valor ? fecha.getMinutes() : 0;
    const nueva = new Date(anioVista, mesVista, dia, h, m);
    emitir(nueva);
  }

  function seleccionarHora(slot: string) {
    const [h, m] = slot.split(":").map(Number);
    const d = valor ? new Date(valor) : new Date();
    if (!valor) {
      d.setHours(h, m, 0, 0);
    } else {
      d.setHours(h, m, 0, 0);
    }
    emitir(d);
  }

  function emitir(d: Date) {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    onChange(iso);
  }

  function irAHoy() {
    setMesVista(hoy.getMonth());
    setAnioVista(hoy.getFullYear());
  }

  const totalDias = diasEnMes(anioVista, mesVista);
  const primerDia = primerDiaSemana(anioVista, mesVista);

  return (
    <div className="flex flex-col gap-xs">
      <label className="font-label-md text-label-md text-on-surface">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex w-full items-center justify-between rounded-xl border bg-white py-3 pl-4 pr-3 font-body-md text-body-md outline-none transition-all",
              "focus:border-menta focus:ring-2 focus:ring-menta/20",
              error ? "border-error" : "border-outline-variant",
              !valor && "text-outline",
            )}
          >
            <span>{valor ? formatearFechaCorta(fecha) : "Selecciona fecha y hora"}</span>
            <Icon name="calendar_today" className="text-[20px] text-outline" />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            sideOffset={6}
            align="start"
            className={cn(
              "z-[70] w-[340px] rounded-xl border border-outline-variant bg-white p-4 shadow-elevada",
              "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
            )}
          >
            {/* Navegación del mes */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={mesAnterior}
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
                  dia === hoy.getDate() &&
                  mesVista === hoy.getMonth() &&
                  anioVista === hoy.getFullYear();
                const esSeleccionado =
                  dia === diaSeleccionado &&
                  mesVista === mesSeleccionado &&
                  anioVista === anioSeleccionado;
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => seleccionarDia(dia)}
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
                onClick={irAHoy}
                className="font-caption text-caption text-menta hover:underline"
              >
                Hoy
              </button>
            </div>

            {/* Selector de hora */}
            <div className="mt-3 border-t border-outline-variant pt-3">
              <p className="mb-2 font-caption text-caption text-on-surface-variant">Hora</p>
              <div className="hide-scrollbar grid max-h-[140px] grid-cols-4 gap-1 overflow-y-auto">
                {SLOTS_HORA.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => seleccionarHora(slot)}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-center font-caption text-caption transition-colors",
                      horaSeleccionada === slot
                        ? "bg-menta font-bold text-white"
                        : "text-on-surface hover:bg-menta/10",
                    )}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && (
        <p className="flex items-center gap-xs font-caption text-caption text-error">
          <Icon name="error" className="text-[18px]" />
          {error}
        </p>
      )}
    </div>
  );
}
