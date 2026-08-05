import { useState } from "react";

import { Icon } from "../../ui/Icon";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { CajaHistorial } from "./CajaHistorial";
import { CajaHoy } from "./CajaHoy";

type Vista = "hoy" | "historial";

/** Caja es del negocio como un todo, no de una persona — a diferencia de
 * "Servicios realizados" (que sí separa "lo mío" de "lo de todos" en dos
 * rutas), acá alcanza con una sola pantalla y un toggle interno entre el
 * día de hoy y el histórico. */
export function CajaPage() {
  const [vista, setVista] = useState<Vista>("hoy");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-menta/8">
            <Icon name="point_of_sale" className="text-[20px] text-menta" />
          </span>
          <div>
            <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
              Caja
            </h1>
            <p className="text-[12px] text-on-surface-variant">
              Lo que entra, lo que sale, y cuánto le toca a cada quien
            </p>
          </div>
        </div>
        <ToggleGroup valor={vista} onChange={(valor) => setVista(valor as Vista)}>
          <ToggleGroupItem value="hoy">Hoy</ToggleGroupItem>
          <ToggleGroupItem value="historial">Historial</ToggleGroupItem>
        </ToggleGroup>
      </header>

      {vista === "hoy" ? <CajaHoy /> : <CajaHistorial />}
    </div>
  );
}
