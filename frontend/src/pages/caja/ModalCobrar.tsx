import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import { conReintentoDeAuth } from "../../auth/refresh";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { SelectCustom, SelectItem } from "../../ui/SelectCustom";
import { formatearMoneda } from "../../ui/moneda";
import { useToast } from "../../ui/Toast";
import { aNumero, METODOS_PAGO, ORDEN_METODOS_PAGO } from "./dinero";
import type { MetodoPago, Venta } from "./dinero";

/** Cobrar una cuenta. Un cobro por método: el pago mixto son dos pasadas
 * por este modal sobre la misma venta, que es también como lo modela el
 * backend (`CONTRATO.md` 5.13).
 *
 * El monto arranca en el saldo pendiente completo —el caso normal es
 * cobrar todo de una— y quien necesita partirlo lo baja. La alternativa
 * (arrancar vacío) obligaría a teclear el total en la operación más
 * frecuente del día.
 */
export function ModalCobrar({
  venta,
  onCerrar,
  onCobrada,
}: {
  venta: Venta | null;
  onCerrar: () => void;
  onCobrada: (venta: Venta) => void;
}) {
  const { mostrar } = useToast();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Se resetea con la venta y no al abrir/cerrar: si recepción cobra dos
  // cuentas seguidas, la segunda no debe heredar el monto de la primera.
  useEffect(() => {
    if (venta) {
      setMonto(venta.saldo_pendiente);
      setMetodo("efectivo");
      setError(null);
    }
  }, [venta]);

  if (!venta) return null;

  const saldo = aNumero(venta.saldo_pendiente);
  const montoNumerico = aNumero(monto);
  const quedaria = saldo - montoNumerico;

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (!venta) return;
    setError(null);

    if (montoNumerico <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }
    if (montoNumerico > saldo) {
      setError(`No puedes cobrar más de ${formatearMoneda(venta.saldo_pendiente)}.`);
      return;
    }

    setGuardando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/ventas/{id}/cobrar/", {
        params: { path: { id: venta.id } },
        body: { monto, metodo_pago: metodo },
      }),
    );
    setGuardando(false);

    if (errorRespuesta || !data) {
      // El backend rechaza por reglas que la UI no puede anticipar del
      // todo (la caja se cerró en otra pestaña, otra persona cobró la
      // misma cuenta entremedio). Se muestra en el formulario, no como
      // toast: el usuario sigue adentro y puede corregir.
      setError(
        "No se pudo cobrar. Revisa que la caja siga abierta y que nadie más haya cobrado esta cuenta.",
      );
      return;
    }

    mostrar(
      "exito",
      data.estado === "pagada"
        ? `Cobrado ${formatearMoneda(monto)}. Cuenta saldada.`
        : `Abono de ${formatearMoneda(monto)} registrado.`,
    );
    onCobrada(data);
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Cobrar"
      descripcion={`${venta.nombre_cliente} · ${formatearMoneda(venta.total)}`}
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-outline-variant p-4">
          <ul className="space-y-1">
            {venta.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 font-body-md text-body-md">
                <span className="min-w-0 truncate text-on-surface-variant">
                  {item.cantidad && item.cantidad > 1 ? `${item.cantidad}× ` : ""}
                  {item.descripcion}
                </span>
                <span className="shrink-0 tabular-nums text-on-surface">
                  {formatearMoneda(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-outline-variant pt-2 font-label-md text-label-md">
            <span className="text-on-surface">Por cobrar</span>
            <span className="text-primary">{formatearMoneda(venta.saldo_pendiente)}</span>
          </div>
        </div>

        <SelectCustom
          label="¿Con qué paga?"
          valor={metodo}
          onChange={(valor) => setMetodo(valor as MetodoPago)}
          ayuda={
            METODOS_PAGO[metodo].efectivo
              ? "Entra al cajón, así que cuenta para el arqueo del cierre."
              : "No pasa por el cajón: se concilia contra el extracto de su plataforma."
          }
        >
          {ORDEN_METODOS_PAGO.map((valor) => (
            <SelectItem key={valor} value={valor}>
              {METODOS_PAGO[valor].etiqueta}
            </SelectItem>
          ))}
        </SelectCustom>

        <Input
          label="Monto"
          type="number"
          min="0.01"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          ayuda={
            quedaria > 0
              ? `Quedarían ${formatearMoneda(String(quedaria))} pendientes — puedes cobrarlos con otro método.`
              : undefined
          }
          required
        />

        {error && (
          <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
            <Icon name="error" className="shrink-0 text-[18px]" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" icono="payments" cargando={guardando}>
            Cobrar {formatearMoneda(monto || "0")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
