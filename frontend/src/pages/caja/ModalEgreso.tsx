import { useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import { conReintentoDeAuth } from "../../auth/refresh";
import { Button } from "../../ui/Button";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { SelectCustom, SelectItem } from "../../ui/SelectCustom";
import { useToast } from "../../ui/Toast";
import { CATEGORIAS_EGRESO, METODOS_PAGO, ORDEN_CATEGORIAS, ORDEN_METODOS_PAGO } from "./dinero";
import type { CategoriaEgreso, MetodoPago } from "./dinero";

/** Registrar un gasto del local: insumos, arriendo, el domicilio.
 *
 * Deliberadamente **no** sirve para devolverle plata a un cliente: eso
 * es una devolución, se hace desde la cuenta y queda con su propio tipo
 * de movimiento. Mezclarlas haría que el reporte de gastos mienta
 * (`CONTRATO.md` 5.14).
 */
export function ModalEgreso({
  abierto,
  onCerrar,
  onRegistrado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  onRegistrado: () => void;
}) {
  const { mostrar } = useToast();
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [categoria, setCategoria] = useState<CategoriaEgreso>("insumos");
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function cerrar() {
    setMonto("");
    setConcepto("");
    setCategoria("insumos");
    setMetodo("efectivo");
    setError(null);
    onCerrar();
  }

  async function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setError(null);

    if (Number(monto) <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }
    if (!concepto.trim()) {
      setError("Escribe en qué se gastó.");
      return;
    }

    setGuardando(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/egresos/", {
        body: {
          monto,
          concepto: concepto.trim(),
          categoria,
          metodo_pago: metodo,
        },
      }),
    );
    setGuardando(false);

    if (errorRespuesta || !data) {
      setError("No se pudo registrar. Revisa que la caja siga abierta.");
      return;
    }

    mostrar("exito", "Gasto registrado.");
    cerrar();
    onRegistrado();
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={cerrar}
      titulo="Registrar gasto"
      descripcion="Plata que sale del negocio y no es una devolución a un cliente."
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Input
          label="¿En qué se gastó?"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej: Compra de shampoo, proveedor XYZ"
          required
        />

        <SelectCustom
          label="Categoría"
          valor={categoria}
          onChange={(valor) => setCategoria(valor as CategoriaEgreso)}
          ayuda="Sirve para que el reporte de gastos separe insumos de arriendo."
        >
          {ORDEN_CATEGORIAS.map((valor) => (
            <SelectItem key={valor} value={valor}>
              {CATEGORIAS_EGRESO[valor]}
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
          placeholder="50000"
          required
        />

        <SelectCustom
          label="¿Con qué se pagó?"
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

        {error && (
          <p role="alert" className="flex items-start gap-2 font-caption text-caption text-error">
            <Icon name="error" className="shrink-0 text-[18px]" />
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="ghost" onClick={cerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" cargando={guardando}>
            Registrar gasto
          </Button>
        </div>
      </form>
    </Modal>
  );
}
