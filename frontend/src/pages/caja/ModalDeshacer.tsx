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

export type ModoDeshacer = "devolver" | "anular";

const TEXTOS: Record<
  ModoDeshacer,
  { titulo: string; descripcion: string; boton: string; placeholderMotivo: string }
> = {
  devolver: {
    titulo: "Devolver plata",
    descripcion: "La cuenta sigue existiendo; solo sale la plata que devuelves.",
    boton: "Devolver",
    placeholderMotivo: "Ej: el cliente no quedó conforme con el corte",
  },
  anular: {
    titulo: "Anular cuenta",
    descripcion: "La cuenta deja de existir para el negocio y no se vuelve a cobrar.",
    boton: "Anular cuenta",
    placeholderMotivo: "Ej: se cobró al cliente equivocado",
  },
};

/** Deshacer dinero: devolver una parte, o anular la cuenta entera.
 *
 * Las dos comparten modal porque comparten lo que importa explicarle a
 * quien las usa: **no borran nada**. El cobro original se queda en el
 * libro y se agrega un movimiento de signo contrario, así que el cierre
 * de ayer sigue siendo cierto y el de hoy refleja que salió plata. Es la
 * garantía que sostiene todo el módulo (`CONTRATO.md` 5.13), y decirlo
 * en la UI evita que alguien busque un botón de "borrar" que no existe.
 *
 * Las dos exigen motivo — es lo único que después explica el movimiento
 * en el histórico.
 */
export function ModalDeshacer({
  venta,
  modo,
  onCerrar,
  onListo,
}: {
  venta: Venta | null;
  modo: ModoDeshacer;
  onCerrar: () => void;
  onListo: (venta: Venta) => void;
}) {
  const { mostrar } = useToast();
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (venta) {
      setMonto(venta.total_pagado);
      // El método del primer pago es el default razonable: lo normal es
      // devolver por donde entró.
      setMetodo((venta.pagos[0]?.metodo_pago as MetodoPago) ?? "efectivo");
      setMotivo("");
      setError(null);
    }
  }, [venta]);

  if (!venta) return null;

  const textos = TEXTOS[modo];
  const cobrado = aNumero(venta.total_pagado);

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    if (!venta) return;
    setError(null);

    if (!motivo.trim()) {
      setError("Explica por qué. Queda en el histórico y es lo que después lo justifica.");
      return;
    }
    if (modo === "devolver") {
      if (aNumero(monto) <= 0) {
        setError("El monto debe ser mayor a cero.");
        return;
      }
      if (aNumero(monto) > cobrado) {
        setError(`No puedes devolver más de ${formatearMoneda(venta.total_pagado)}.`);
        return;
      }
    }

    setGuardando(true);
    const respuesta = await conReintentoDeAuth(() =>
      modo === "devolver"
        ? apiClient.POST("/api/caja/ventas/{id}/devolver/", {
            params: { path: { id: venta.id } },
            body: { monto, metodo_pago: metodo, motivo: motivo.trim() },
          })
        : apiClient.POST("/api/caja/ventas/{id}/anular/", {
            params: { path: { id: venta.id } },
            // `metodo_devolucion` solo aplica si había plata cobrada; el
            // backend lo ignora si no.
            body: { motivo: motivo.trim(), metodo_devolucion: metodo },
          }),
    );
    setGuardando(false);

    if (respuesta.error || !respuesta.data) {
      setError(
        cobrado > 0
          ? "No se pudo. Devolver plata necesita la caja abierta — ábrela e intenta de nuevo."
          : "No se pudo. Intenta de nuevo.",
      );
      return;
    }

    mostrar("exito", modo === "devolver" ? "Devolución registrada." : "Cuenta anulada.");
    onListo(respuesta.data);
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={textos.titulo}
      descripcion={`${venta.nombre_cliente} · ${formatearMoneda(venta.total)}`}
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <p className="flex items-start gap-2 rounded-xl bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">
          <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
          {textos.descripcion} El cobro original no se borra: queda registrado junto con este
          movimiento, para que el cierre de ese día siga cuadrando.
        </p>

        {modo === "anular" && cobrado > 0 && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-tertiary-container px-3 py-2 font-caption text-caption text-on-tertiary-container"
          >
            <Icon name="warning" className="mt-0.5 shrink-0 text-[18px]" />
            Ya se cobraron {formatearMoneda(venta.total_pagado)}: al anular se devuelven, así que
            hace falta la caja abierta.
          </p>
        )}

        {modo === "devolver" && (
          <Input
            label="¿Cuánto devuelves?"
            type="number"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            ayuda={`Se cobraron ${formatearMoneda(venta.total_pagado)} en total.`}
            required
          />
        )}

        {(modo === "devolver" || cobrado > 0) && (
          <SelectCustom
            label="¿Cómo se le devuelve?"
            valor={metodo}
            onChange={(valor) => setMetodo(valor as MetodoPago)}
            ayuda={
              METODOS_PAGO[metodo].efectivo
                ? "Sale del cajón, así que descuenta del arqueo del cierre."
                : "No sale del cajón: no afecta el arqueo."
            }
          >
            {ORDEN_METODOS_PAGO.map((valor) => (
              <SelectItem key={valor} value={valor}>
                {METODOS_PAGO[valor].etiqueta}
              </SelectItem>
            ))}
          </SelectCustom>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="motivo-deshacer" className="font-label-md text-label-md text-on-surface">
            ¿Por qué?
          </label>
          <textarea
            id="motivo-deshacer"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder={textos.placeholderMotivo}
            required
            className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3 font-body-md text-body-md text-on-surface outline-hidden transition-all placeholder:text-outline focus:border-menta focus:ring-2 focus:ring-menta/20"
          />
        </div>

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
          <Button type="submit" variante="danger" cargando={guardando}>
            {textos.boton}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
