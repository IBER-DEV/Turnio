import { useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import { conReintentoDeAuth } from "../../auth/refresh";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { formatearMoneda } from "../../ui/moneda";
import { useToast } from "../../ui/Toast";
import { aNumero, etiquetaMetodo } from "./dinero";
import type { CajaDetalle } from "./dinero";

/** El arqueo: contar el cajón y ver si cuadra.
 *
 * Lo que hace útil a esta pantalla es que **solo cuenta efectivo**. Una
 * transferencia por Nequi nunca estuvo en el cajón, así que sumarla al
 * esperado haría que toda caja con pagos digitales cerrara con un
 * faltante enorme y perfectamente normal — la forma más rápida de que el
 * dueño deje de mirar el arqueo. Lo digital se concilia aparte, contra
 * el extracto de cada plataforma, y por eso se lista abajo sin
 * diferencia asociada.
 *
 * La diferencia se calcula **en vivo mientras se teclea**, antes de
 * enviar nada: quien cuenta mal se da cuenta ahí, no después de cerrar.
 */
export function ModalCierre({
  caja,
  abierto,
  onCerrar,
  onCerrada,
}: {
  caja: CajaDetalle;
  abierto: boolean;
  onCerrar: () => void;
  onCerrada: () => void;
}) {
  const { mostrar } = useToast();
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const { resumen } = caja;
  const esperado = aNumero(resumen.efectivo_esperado);
  const hayConteo = contado.trim() !== "";
  const diferencia = aNumero(contado) - esperado;

  // Los métodos que no pasan por el cajón, para conciliar aparte.
  const digitales = Object.entries(resumen.por_metodo_pago).filter(
    ([metodo]) => metodo !== "efectivo",
  );

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (!hayConteo) {
      setError("Cuenta el efectivo del cajón antes de cerrar.");
      return;
    }

    setGuardando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/cerrar/", {
        body: { efectivo_contado: contado, nota_cierre: nota },
      }),
    );
    setGuardando(false);

    if (errorRespuesta || !data) {
      setError("No se pudo cerrar la caja. Intenta de nuevo.");
      return;
    }

    mostrar(
      diferencia === 0 ? "exito" : "info",
      diferencia === 0
        ? "Caja cerrada y cuadrada."
        : `Caja cerrada con ${diferencia < 0 ? "faltante" : "sobrante"} de ${formatearMoneda(String(Math.abs(diferencia)))}.`,
    );
    setContado("");
    setNota("");
    onCerrada();
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Cerrar caja"
      descripcion="Cuenta el efectivo del cajón y compara con lo que el sistema esperaba."
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-outline-variant p-4">
          <p className="mb-2 font-label-md text-label-md text-on-surface">Efectivo del cajón</p>
          <dl className="space-y-1 font-body-md text-body-md">
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Base con que abriste</dt>
              <dd className="tabular-nums text-on-surface">
                {formatearMoneda(resumen.saldo_inicial)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Cobrado en efectivo</dt>
              <dd className="tabular-nums text-completada">
                + {formatearMoneda(resumen.ingresos_efectivo)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Gastos en efectivo</dt>
              <dd className="tabular-nums text-error">
                − {formatearMoneda(resumen.egresos_efectivo)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Devoluciones en efectivo</dt>
              <dd className="tabular-nums text-error">
                − {formatearMoneda(resumen.devoluciones_efectivo)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-outline-variant pt-2 font-label-md text-label-md">
              <dt className="text-on-surface">Debería haber</dt>
              <dd className="tabular-nums text-primary">
                {formatearMoneda(resumen.efectivo_esperado)}
              </dd>
            </div>
          </dl>
        </div>

        <Input
          label="¿Cuánto contaste?"
          type="number"
          min="0"
          step="0.01"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          placeholder="0"
          ayuda="Solo el efectivo que hay en el cajón, en billetes y monedas."
          required
        />

        {hayConteo && (
          <div
            role="status"
            className={
              diferencia === 0
                ? "flex items-center gap-2 rounded-xl bg-completada/10 px-4 py-3 font-label-md text-label-md text-completada"
                : "flex items-center gap-2 rounded-xl bg-error/10 px-4 py-3 font-label-md text-label-md text-error"
            }
          >
            <Icon
              name={diferencia === 0 ? "check_circle" : "warning"}
              className="shrink-0 text-[20px]"
            />
            {diferencia === 0
              ? "Cuadra exacto."
              : diferencia < 0
                ? `Faltan ${formatearMoneda(String(Math.abs(diferencia)))}.`
                : `Sobran ${formatearMoneda(String(diferencia))}.`}
          </div>
        )}

        {digitales.length > 0 && (
          <div className="rounded-xl bg-surface-container-low p-4">
            <p className="mb-2 font-label-md text-label-md text-on-surface">
              Cobros que no pasaron por el cajón
            </p>
            <ul className="space-y-1 font-body-md text-body-md">
              {digitales.map(([metodo, monto]) => (
                <li key={metodo} className="flex justify-between gap-3">
                  <span className="text-on-surface-variant">{etiquetaMetodo(metodo)}</span>
                  <span className="tabular-nums text-on-surface">{formatearMoneda(monto)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-caption text-caption text-on-surface-variant">
              Estos se revisan contra el extracto de cada plataforma, no contra el cajón.
            </p>
          </div>
        )}

        {resumen.ventas_sin_cobrar > 0 && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-tertiary-container px-3 py-2 font-caption text-caption text-on-tertiary-container"
          >
            <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
            {resumen.ventas_sin_cobrar === 1
              ? "Queda 1 cuenta sin cobrar. Puedes cerrar igual: sigue pendiente mañana."
              : `Quedan ${resumen.ventas_sin_cobrar} cuentas sin cobrar. Puedes cerrar igual: siguen pendientes mañana.`}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="nota-cierre"
            className="font-label-md text-label-md text-on-surface"
          >
            Nota (opcional)
          </label>
          <textarea
            id="nota-cierre"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder={
              diferencia !== 0 && hayConteo
                ? "¿Sabes a qué se debe la diferencia?"
                : "Cualquier detalle sobre el cierre del día"
            }
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
          <Button type="submit" icono="lock" cargando={guardando}>
            Cerrar caja
          </Button>
        </div>
      </form>
    </Modal>
  );
}
