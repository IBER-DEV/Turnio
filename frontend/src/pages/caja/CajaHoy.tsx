import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiClient } from "../../api/client";
import { conReintentoDeAuth } from "../../auth/refresh";
import { usePermisos } from "../../permisos/usePermisos";
import { Button } from "../../ui/Button";
import { ESTILO_ESTADO_CAJA } from "../../ui/EstadoCaja";
import { Badge, Card, EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { Input } from "../../ui/Input";
import { Modal } from "../../ui/Modal";
import { formatearMoneda } from "../../ui/moneda";
import { useToast } from "../../ui/Toast";
import { cn } from "../../ui/cn";
import { ModalCierre } from "./ModalCierre";
import { ModalEgreso } from "./ModalEgreso";
import { CATEGORIAS_EGRESO, ESTILO_MOVIMIENTO, etiquetaMetodo, formatearHora } from "./dinero";
import type { CajaDetalle, MovimientoCaja } from "./dinero";

/** La caja del día: cuánto entró, cuánto salió, y si el cajón cuadra.
 *
 * Ya **no** se registran ingresos desde acá. Un ingreso nace de cobrar
 * una cuenta (pestaña "Cobros"), porque la plata que entra siempre tiene
 * una venta que la explica — esa es la regla que ordena todo el módulo.
 * Lo que sí vive acá es lo que no tiene contraparte en una venta: abrir,
 * registrar un gasto, y cerrar contando el efectivo.
 */
export function CajaHoy({ onCambio }: { onCambio?: () => void }) {
  const { mostrar } = useToast();
  const { puede } = usePermisos();
  const puedeVerHistorico = puede("puede_ver_reportes");

  const [caja, setCaja] = useState<CajaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [abrirAbierto, setAbrirAbierto] = useState(false);
  const [saldoInicial, setSaldoInicial] = useState("");
  const [abriendo, setAbriendo] = useState(false);

  const [egresoAbierto, setEgresoAbierto] = useState(false);
  const [cierreAbierto, setCierreAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    const actual = await conReintentoDeAuth(() => apiClient.GET("/api/caja/actual/"));

    if (actual.response.status === 404) {
      // No hay caja abierta — es el estado normal de "todavía no arrancó
      // el día", no un error.
      setCaja(null);
    } else if (actual.error || !actual.data) {
      setError(true);
      setCargando(false);
      return;
    } else {
      setCaja(actual.data);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleAbrir(evento: FormEvent) {
    evento.preventDefault();
    setAbriendo(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.POST("/api/caja/abrir/", {
        body: { saldo_inicial: saldoInicial.trim() === "" ? "0" : saldoInicial },
      }),
    );
    setAbriendo(false);

    if (errorRespuesta || !data) {
      mostrar("error", "No se pudo abrir la caja.");
      return;
    }
    setCaja(data);
    setAbrirAbierto(false);
    setSaldoInicial("");
    mostrar("exito", "Caja abierta.");
    onCambio?.();
  }

  if (cargando) return <SkeletonLista filas={4} />;

  if (error) {
    return (
      <EstadoError mensaje="No pudimos cargar la caja. Revisa tu conexión." onReintentar={cargar} />
    );
  }

  if (!caja) {
    return (
      <>
        <EstadoVacio
          icono="point_of_sale"
          titulo="Todavía no abriste la caja"
          descripcion="Ábrela para poder cobrar las cuentas del día y registrar los gastos del local."
          accion={{ etiqueta: "Abrir caja", onClick: () => setAbrirAbierto(true) }}
        />
        <Modal
          abierto={abrirAbierto}
          onCerrar={() => setAbrirAbierto(false)}
          titulo="Abrir caja"
          descripcion="Con cuánto efectivo arrancas el día."
        >
          <form className="flex flex-col gap-6" onSubmit={handleAbrir}>
            <Input
              label="Base del cajón (opcional)"
              type="number"
              min="0"
              step="0.01"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="0"
              ayuda="El efectivo que ya está en el cajón antes de vender nada. Se usa para el arqueo del cierre."
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variante="ghost"
                onClick={() => setAbrirAbierto(false)}
                disabled={abriendo}
              >
                Cancelar
              </Button>
              <Button type="submit" cargando={abriendo}>
                Abrir caja
              </Button>
            </div>
          </form>
        </Modal>
      </>
    );
  }

  const { resumen } = caja;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className={ESTILO_ESTADO_CAJA.abierta.badge}>
            {ESTILO_ESTADO_CAJA.abierta.etiqueta}
          </Badge>
          <span className="font-caption text-caption text-on-surface-variant">
            Desde {formatearHora(caja.abierta_en)} · {caja.abierta_por_nombre}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            icono="shopping_cart"
            tamano="sm"
            variante="secondary"
            onClick={() => setEgresoAbierto(true)}
          >
            Registrar gasto
          </Button>
          <Button icono="lock" tamano="sm" onClick={() => setCierreAbierto(true)}>
            Cerrar caja
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="font-caption text-caption text-on-surface-variant">Cobrado</p>
          <p className="mt-1 text-lg font-bold text-completada">
            {formatearMoneda(resumen.total_ingresos)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-caption text-caption text-on-surface-variant">Gastos</p>
          <p className="mt-1 text-lg font-bold text-error">
            {formatearMoneda(resumen.total_egresos)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-caption text-caption text-on-surface-variant">Devoluciones</p>
          <p className="mt-1 text-lg font-bold text-error">
            {formatearMoneda(resumen.total_devoluciones)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-caption text-caption text-on-surface-variant">
            Debería haber en el cajón
          </p>
          <p className="mt-1 text-lg font-bold text-primary">
            {formatearMoneda(resumen.efectivo_esperado)}
          </p>
        </Card>
      </div>

      {Object.keys(resumen.por_metodo_pago).length > 0 && (
        <Card className="p-4">
          <p className="mb-2 font-label-md text-label-md text-on-surface">Cobrado por método</p>
          <ul className="space-y-1.5">
            {Object.entries(resumen.por_metodo_pago).map(([metodo, monto]) => (
              <li key={metodo} className="flex items-center justify-between text-body-md">
                <span className="text-on-surface-variant">{etiquetaMetodo(metodo)}</span>
                <span className="font-label-md tabular-nums text-on-surface">
                  {formatearMoneda(monto)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {resumen.comisiones_por_empleado.length > 0 && (
        <Card className="p-4">
          <p className="mb-1 font-label-md text-label-md text-on-surface">Comisiones del día</p>
          <p className="mb-2 font-caption text-caption text-on-surface-variant">
            Solo de cuentas ya pagadas — una cuenta a medio cobrar todavía no genera comisión.
          </p>
          <ul className="space-y-1.5">
            {resumen.comisiones_por_empleado.map((fila) => (
              <li key={fila.empleado} className="flex items-center justify-between text-body-md">
                <span className="text-on-surface-variant">{fila.empleado_nombre}</span>
                <span className="font-label-md tabular-nums text-on-surface">
                  {formatearMoneda(fila.monto)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {resumen.ventas_sin_cobrar > 0 && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-tertiary-container px-3 py-2 font-caption text-caption text-on-tertiary-container"
        >
          <Icon name="info" className="mt-0.5 shrink-0 text-[18px]" />
          {resumen.ventas_sin_cobrar === 1
            ? "Hay 1 cuenta sin cobrar en la pestaña de Cobros."
            : `Hay ${resumen.ventas_sin_cobrar} cuentas sin cobrar en la pestaña de Cobros.`}
        </p>
      )}

      {caja.movimientos.length === 0 ? (
        <EstadoVacio
          icono="point_of_sale"
          titulo="Sin movimientos todavía"
          descripcion="Cobra una cuenta desde la pestaña de Cobros, o registra un gasto del local."
        />
      ) : (
        <div>
          <p className="mb-2 font-label-md text-label-md text-on-surface">
            Movimientos del día ({caja.movimientos.length})
          </p>
          <ul className="space-y-2">
            {caja.movimientos.map((movimiento: MovimientoCaja) => {
              const estilo = ESTILO_MOVIMIENTO[movimiento.tipo];
              return (
                <li key={movimiento.id}>
                  <Card className="flex items-center justify-between gap-3 p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          estilo.fondo,
                        )}
                      >
                        <Icon name={estilo.icono} className="text-[18px]" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-label-md text-label-md text-on-surface">
                          {movimiento.concepto}
                        </p>
                        <p className="truncate text-[12px] text-on-surface-variant">
                          {formatearHora(movimiento.creado_en)} ·{" "}
                          {etiquetaMetodo(movimiento.metodo_pago)}
                          {movimiento.categoria && ` · ${CATEGORIAS_EGRESO[movimiento.categoria]}`}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-label-md text-label-md tabular-nums",
                        estilo.color,
                      )}
                    >
                      {estilo.signo}
                      {formatearMoneda(movimiento.monto)}
                    </span>
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!puedeVerHistorico && (
        <p className="font-caption text-caption text-on-surface-variant">
          Con permiso para ver reportes también verías el histórico de cajas de otros días.
        </p>
      )}

      <ModalEgreso
        abierto={egresoAbierto}
        onCerrar={() => setEgresoAbierto(false)}
        onRegistrado={() => {
          cargar();
          onCambio?.();
        }}
      />

      <ModalCierre
        caja={caja}
        abierto={cierreAbierto}
        onCerrar={() => setCierreAbierto(false)}
        onCerrada={() => {
          setCierreAbierto(false);
          cargar();
          onCambio?.();
        }}
      />
    </div>
  );
}
