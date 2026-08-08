import { useState } from "react";

import { usePermisos } from "../../permisos/usePermisos";
import { Icon } from "../../ui/Icon";
import { ToggleGroup, ToggleGroupItem } from "../../ui/ToggleGroup";
import { CajaHistorial } from "./CajaHistorial";
import { CajaHoy } from "./CajaHoy";
import { CobrosPendientes } from "./CobrosPendientes";

type Vista = "cobros" | "hoy" | "historial";

/** Caja es del negocio como un todo, no de una persona, así que es una
 * sola pantalla con tres vistas.
 *
 * "Cobros" es la primera y la que abre por defecto: es lo que recepción
 * tiene enfrente cuando el cliente se para a pagar, y la razón por la
 * que alguien abre esta sección veinte veces al día. "Hoy" (el estado
 * del cajón) e "Historial" se miran una o dos veces.
 *
 * `recargar` es un contador y no un callback: cobrar en la primera vista
 * cambia los totales de la segunda, pero montarlas juntas para
 * mantenerlas sincronizadas costaría cargar las tres siempre. Cambiar la
 * `key` fuerza el remontaje de la vista que se abre después de un cobro,
 * que es exactamente lo que hace falta y nada más.
 */
export function CajaPage() {
  const { puede } = usePermisos();
  const [vista, setVista] = useState<Vista>("cobros");
  const [recargar, setRecargar] = useState(0);

  const puedeVerHistorico = puede("puede_cobrar") || puede("puede_ver_reportes");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-menta/8">
            <Icon name="point_of_sale" className="text-[20px] text-menta" />
          </span>
          <div>
            <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
              Caja
            </h1>
            <p className="text-[12px] text-on-surface-variant">
              Lo que falta cobrar, lo que entró y lo que salió
            </p>
          </div>
        </div>
        <ToggleGroup valor={vista} onChange={(valor) => setVista(valor as Vista)}>
          <ToggleGroupItem value="cobros">Cobros</ToggleGroupItem>
          <ToggleGroupItem value="hoy">Hoy</ToggleGroupItem>
          {puedeVerHistorico && <ToggleGroupItem value="historial">Historial</ToggleGroupItem>}
        </ToggleGroup>
      </header>

      {vista === "cobros" && (
        <CobrosPendientes key={`cobros-${recargar}`} onCambio={() => setRecargar((n) => n + 1)} />
      )}
      {vista === "hoy" && (
        <CajaHoy key={`hoy-${recargar}`} onCambio={() => setRecargar((n) => n + 1)} />
      )}
      {vista === "historial" && <CajaHistorial />}
    </div>
  );
}
