import * as Popover from "@radix-ui/react-popover";
import { useEffect, useMemo, useRef, useState } from "react";

import { CalendarioMes } from "./CalendarioMes";
import { cn } from "./cn";
import { Icon } from "./Icon";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

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
  const slotsRef = useRef<HTMLDivElement>(null);
  const slotActivoRef = useRef<HTMLButtonElement>(null);

  const diaSeleccionado = valor ? fecha.getDate() : -1;
  const mesSeleccionado = valor ? fecha.getMonth() : -1;
  const anioSeleccionado = valor ? fecha.getFullYear() : -1;
  const horaSeleccionada = valor ? `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}` : "";

  function seleccionarDia(dia: number) {
    const h = valor ? fecha.getHours() : 9;
    const m = valor ? fecha.getMinutes() : 0;
    const nueva = new Date(anioVista, mesVista, dia, h, m);
    emitir(nueva);
  }

  function seleccionarHora(slot: string) {
    const [h, m] = slot.split(":").map(Number);
    const d = valor ? new Date(valor) : new Date();
    d.setHours(h, m, 0, 0);
    emitir(d);
  }

  function seleccionarHoraManual(horaStr: string) {
    if (!horaStr) return;
    const [h, m] = horaStr.split(":").map(Number);
    const d = valor ? new Date(valor) : new Date();
    d.setHours(h, m, 0, 0);
    emitir(d);
  }

  // Auto-scroll al slot seleccionado cuando se abre el popover
  useEffect(() => {
    if (abierto && slotActivoRef.current && slotsRef.current) {
      slotActivoRef.current.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [abierto]);

  function emitir(d: Date) {
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    onChange(iso);
  }

  function irAHoy() {
    const hoy = new Date();
    setMesVista(hoy.getMonth());
    setAnioVista(hoy.getFullYear());
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-label-md text-label-md text-on-surface">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      <Popover.Root open={abierto} onOpenChange={setAbierto}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex w-full items-center justify-between rounded-xl border bg-white py-3 pl-4 pr-3 font-body-md text-body-md outline-hidden transition-all",
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
            collisionPadding={12}
            className={cn(
              "z-70 w-[340px] rounded-xl border border-outline-variant bg-white p-4 shadow-elevada",
              // El contenido nunca se sale del viewport: Radix calcula el
              // espacio disponible según hacia dónde tuvo que voltear el
              // popover (arriba o abajo del disparador) y lo expone en
              // esta variable. Sin esto, un popover que se abre hacia
              // arriba por falta de espacio abajo puede terminar cortado
              // contra el borde superior de la pantalla — que era
              // exactamente el bug: se veía el mes apenas asomado.
              "max-h-(--radix-popover-content-available-height) overflow-y-auto",
              "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
            )}
          >
            <CalendarioMes
              mesVista={mesVista}
              anioVista={anioVista}
              onCambiarMes={(mes, anio) => {
                setMesVista(mes);
                setAnioVista(anio);
              }}
              diaSeleccionado={diaSeleccionado}
              mesSeleccionado={mesSeleccionado}
              anioSeleccionado={anioSeleccionado}
              onSeleccionarDia={seleccionarDia}
              onIrAHoy={irAHoy}
            />

            {/* Selector de hora */}
            <div className="mt-3 border-t border-outline-variant pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-caption text-caption text-on-surface-variant">Hora</p>
                {/* Input manual: permite escribir la hora directamente */}
                <input
                  type="time"
                  value={horaSeleccionada}
                  onChange={(e) => seleccionarHoraManual(e.target.value)}
                  className="rounded-lg border border-outline-variant bg-white px-2 py-1 font-caption text-caption text-on-surface outline-hidden focus:border-menta focus:ring-2 focus:ring-menta/20"
                />
              </div>
              <div
                ref={slotsRef}
                className="hide-scrollbar grid max-h-[200px] grid-cols-4 gap-1 overflow-y-auto"
              >
                {SLOTS_HORA.map((slot) => {
                  const activo = horaSeleccionada === slot;
                  return (
                    <button
                      key={slot}
                      ref={activo ? slotActivoRef : undefined}
                      type="button"
                      onClick={() => seleccionarHora(slot)}
                      className={cn(
                        "rounded-lg px-2 py-2 text-center font-caption text-caption transition-colors",
                        activo
                          ? "bg-menta font-bold text-white"
                          : "text-on-surface hover:bg-menta/10",
                      )}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && (
        <p className="flex items-center gap-2 font-caption text-caption text-error">
          <Icon name="error" className="text-[18px]" />
          {error}
        </p>
      )}
    </div>
  );
}
