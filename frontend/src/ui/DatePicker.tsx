import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import type { ReactNode } from "react";

import { CalendarioMes } from "./CalendarioMes";
import { cn } from "./cn";

/** Selector de un día cualquiera, sin hora — para saltar a una fecha
 * fuera del rango que ya se ve en pantalla (p. ej. la tira de 7 días de
 * `AgendaPage`). Para fecha+hora de una cita, ver `DateTimePicker`. */
export function DatePicker({
  valor,
  onChange,
  trigger,
}: {
  valor: Date;
  onChange: (fecha: Date) => void;
  /** El disparador visual (botón/ícono) — quien lo usa decide cómo se ve. */
  trigger: ReactNode;
}) {
  const [mesVista, setMesVista] = useState(valor.getMonth());
  const [anioVista, setAnioVista] = useState(valor.getFullYear());
  const [abierto, setAbierto] = useState(false);

  function seleccionarDia(dia: number) {
    onChange(new Date(anioVista, mesVista, dia));
    setAbierto(false);
  }

  function irAHoy() {
    const hoy = new Date();
    setMesVista(hoy.getMonth());
    setAnioVista(hoy.getFullYear());
  }

  return (
    <Popover.Root
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        // Reabrir siempre arranca mostrando el mes del día seleccionado,
        // no el último que se estuvo mirando.
        if (v) {
          setMesVista(valor.getMonth());
          setAnioVista(valor.getFullYear());
        }
      }}
    >
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          collisionPadding={12}
          className={cn(
            "z-70 w-75 rounded-xl border border-outline-variant bg-white p-4 shadow-elevada",
            // El contenido nunca se sale del viewport: Radix calcula el
            // espacio disponible según hacia dónde tuvo que voltear el
            // popover (arriba o abajo del disparador) y lo expone en esta
            // variable. Sin esto, un popover que se abre hacia arriba por
            // falta de espacio abajo puede terminar cortado contra el
            // borde superior de la pantalla.
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
            diaSeleccionado={valor.getDate()}
            mesSeleccionado={valor.getMonth()}
            anioSeleccionado={valor.getFullYear()}
            onSeleccionarDia={seleccionarDia}
            onIrAHoy={irAHoy}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
