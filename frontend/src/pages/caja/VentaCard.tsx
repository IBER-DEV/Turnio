import type { ReactNode } from "react";

import { Badge, Card } from "../../ui/Feedback";
import { ESTILO_ESTADO_VENTA } from "../../ui/EstadoVenta";
import { Icon } from "../../ui/Icon";
import { formatearMoneda } from "../../ui/moneda";
import { aNumero, empleadosDe, formatearHora } from "./dinero";
import type { Venta } from "./dinero";

/** Una cuenta, como se ve en la cola de cobro y en "Mi trabajo".
 *
 * Muestra los empleados de los **items**, no un "responsable" de la
 * venta: la venta no tiene ese campo, y una cuenta puede pasar por dos
 * manos (ver `CONTRATO.md` 5.13).
 *
 * `acciones` lo pone quien la usa: la cola de cobro pinta "Cobrar", "Mi
 * trabajo" no pinta nada. Así la tarjeta no necesita saber quién la mira
 * ni qué capacidades tiene.
 */
export function VentaCard({ venta, acciones }: { venta: Venta; acciones?: ReactNode }) {
  const estilo = ESTILO_ESTADO_VENTA[venta.estado];
  const pagado = aNumero(venta.total_pagado);
  const pendiente = aNumero(venta.saldo_pendiente);
  const empleados = empleadosDe(venta);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-label-md text-label-md text-on-surface">
              {venta.nombre_cliente}
            </p>
            <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
            {venta.cita !== null && (
              // Distingue la cuenta que nació de una cita de la que se
              // creó a mano en el mostrador. Para recepción importa:
              // sabe si el cliente estaba agendado o llegó de sorpresa.
              <span
                className="flex items-center gap-1 font-caption text-caption text-on-surface-variant"
                title="Viene de una cita agendada"
              >
                <Icon name="calendar_today" className="text-[14px]" />
                Con cita
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-on-surface-variant">
            {empleados.join(", ")} · {formatearHora(venta.creado_en)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-label-md text-label-md text-on-surface">
            {formatearMoneda(venta.total)}
          </p>
          {/* El saldo solo aparece cuando difiere del total: en una
              cuenta sin abonos repetiría el número de arriba, y en una
              pagada diría "$0" sin aportar nada. */}
          {pagado > 0 && pendiente > 0 && (
            <p className="font-caption text-caption text-confirmada">
              Falta {formatearMoneda(venta.saldo_pendiente)}
            </p>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-t border-outline-variant/50 pt-3">
        {venta.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-on-surface-variant">
              {item.cantidad && item.cantidad > 1 ? `${item.cantidad}× ` : ""}
              {item.descripcion}
              <span className="text-outline"> · {item.empleado_nombre}</span>
            </span>
            <span className="shrink-0 tabular-nums text-on-surface">
              {formatearMoneda(item.subtotal)}
            </span>
          </li>
        ))}
      </ul>

      {venta.estado === "anulada" && venta.motivo_anulacion && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">
          <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
          {venta.motivo_anulacion}
        </p>
      )}

      {acciones && <div className="mt-3 flex flex-wrap gap-2">{acciones}</div>}
    </Card>
  );
}
