import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import { ESTILO_ESTADO_CAJA } from "../../ui/EstadoCaja";
import { Badge, Card, EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { Modal } from "../../ui/Modal";
import { formatearMoneda } from "../../ui/moneda";
import { cn } from "../../ui/cn";
import { FiltroPeriodo } from "../../ui/FiltroPeriodo";
import { paraQuery, rangoDe } from "../../ui/periodos";
import type { Periodo } from "../../ui/periodos";
import { ESTILO_MOVIMIENTO, aNumero, etiquetaMetodo, formatearHora } from "./dinero";

type CajaLista = components["schemas"]["CajaLista"];
type CajaDetalle = components["schemas"]["CajaDetalle"];

const formatearFechaHora = formatearHora;

/** El resultado del arqueo de una caja ya cerrada.
 *
 * Es lo primero que se muestra en el detalle —antes que los totales—
 * porque es la pregunta que trae a alguien a mirar una caja de la semana
 * pasada: "¿ese día cuadró?". Una caja sin `diferencia` es una que se
 * abrió y todavía no se cerró.
 */
function ResultadoArqueo({ caja }: { caja: CajaDetalle }) {
  if (caja.diferencia === null) return null;

  const diferencia = aNumero(caja.diferencia);
  const cuadra = diferencia === 0;

  return (
    <div
      className={
        cuadra
          ? "rounded-xl bg-completada/10 p-4 text-completada"
          : "rounded-xl bg-error/10 p-4 text-error"
      }
    >
      <div className="flex items-center gap-2 font-label-md text-label-md">
        <Icon name={cuadra ? "check_circle" : "warning"} className="shrink-0 text-[20px]" />
        {cuadra
          ? "El cajón cuadró exacto"
          : diferencia < 0
            ? `Faltaron ${formatearMoneda(String(Math.abs(diferencia)))}`
            : `Sobraron ${formatearMoneda(String(diferencia))}`}
      </div>
      <p className="mt-1 font-caption text-caption opacity-80">
        Esperado {formatearMoneda(caja.efectivo_esperado ?? "0")} · contado{" "}
        {formatearMoneda(caja.efectivo_contado ?? "0")}
      </p>
    </div>
  );
}

export function CajaHistorial() {
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [referencia, setReferencia] = useState(new Date());
  const [cajas, setCajas] = useState<CajaLista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [detalle, setDetalle] = useState<CajaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    const rango = paraQuery(rangoDe(periodo, referencia));
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/caja/", { params: { query: rango } }),
    );

    if (errorRespuesta) {
      setError(true);
    } else {
      setCajas(data ?? []);
    }
    setCargando(false);
  }, [periodo, referencia]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function verDetalle(caja: CajaLista) {
    setCargandoDetalle(true);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/caja/{id}/", { params: { path: { id: caja.id } } }),
    );
    setCargandoDetalle(false);
    if (errorRespuesta || !data) return;
    setDetalle(data);
  }

  return (
    <div className="space-y-6">
      <FiltroPeriodo
        periodo={periodo}
        referencia={referencia}
        onCambiarPeriodo={setPeriodo}
        onCambiarReferencia={setReferencia}
      />

      {cargando ? (
        <SkeletonLista filas={3} />
      ) : error ? (
        <EstadoError mensaje="No pudimos cargar el histórico." onReintentar={cargar} />
      ) : cajas.length === 0 ? (
        <EstadoVacio
          icono="point_of_sale"
          titulo="Sin cajas en este período"
          descripcion="No hay cajas abiertas ni cerradas en el rango elegido. Prueba con otro."
        />
      ) : (
        <ul className="space-y-2">
          {cajas.map((caja) => {
            const estilo = ESTILO_ESTADO_CAJA[caja.estado];
            return (
              <li key={caja.id}>
                <button type="button" onClick={() => verDetalle(caja)} className="w-full text-left">
                  <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-menta/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-label-md text-label-md text-on-surface">
                          {formatearFechaHora(caja.abierta_en)}
                        </p>
                        <Badge className={estilo.badge}>{estilo.etiqueta}</Badge>
                      </div>
                      <p className="truncate text-[12px] text-on-surface-variant">
                        Abrió {caja.abierta_por_nombre}
                        {caja.cerrada_por_nombre && ` · Cerró ${caja.cerrada_por_nombre}`}
                      </p>
                      {/* El descuadre se ve sin abrir el detalle: es lo
                          único de una caja pasada que puede exigir una
                          acción, y esconderlo detrás de un clic lo
                          convierte en algo que nadie revisa. */}
                      {caja.diferencia !== null && aNumero(caja.diferencia) !== 0 && (
                        <p className="mt-0.5 flex items-center gap-1 font-caption text-caption text-error">
                          <Icon name="warning" className="text-[14px]" />
                          {aNumero(caja.diferencia) < 0 ? "Faltaron" : "Sobraron"}{" "}
                          {formatearMoneda(String(Math.abs(aNumero(caja.diferencia))))}
                        </p>
                      )}
                    </div>
                    <Icon name="chevron_right" className="shrink-0 text-outline" />
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        abierto={detalle !== null || cargandoDetalle}
        onCerrar={() => setDetalle(null)}
        titulo="Detalle de caja"
        descripcion={detalle ? formatearFechaHora(detalle.abierta_en) : undefined}
      >
        {cargandoDetalle || !detalle ? (
          <SkeletonLista filas={3} />
        ) : (
          <div className="space-y-4">
            <ResultadoArqueo caja={detalle} />

            <div className="rounded-xl border border-outline-variant p-4">
              <div className="flex items-center justify-between font-body-md text-body-md">
                <span className="text-on-surface-variant">Cobrado</span>
                <span className="tabular-nums text-on-surface">
                  {formatearMoneda(detalle.resumen.total_ingresos)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-body-md text-body-md">
                <span className="text-on-surface-variant">Gastos</span>
                <span className="tabular-nums text-on-surface">
                  {formatearMoneda(detalle.resumen.total_egresos)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-body-md text-body-md">
                <span className="text-on-surface-variant">Devoluciones</span>
                <span className="tabular-nums text-on-surface">
                  {formatearMoneda(detalle.resumen.total_devoluciones)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-outline-variant pt-2 font-label-md text-label-md">
                <span className="text-on-surface">Neto</span>
                <span className="tabular-nums text-primary">
                  {formatearMoneda(detalle.resumen.neto)}
                </span>
              </div>
            </div>

            {Object.keys(detalle.resumen.por_metodo_pago).length > 0 && (
              <div>
                <p className="mb-2 font-label-md text-label-md text-on-surface">Por método</p>
                <ul className="space-y-1">
                  {Object.entries(detalle.resumen.por_metodo_pago).map(([metodo, monto]) => (
                    <li
                      key={metodo}
                      className="flex items-center justify-between font-body-md text-body-md"
                    >
                      <span className="text-on-surface-variant">{etiquetaMetodo(metodo)}</span>
                      <span className="tabular-nums text-on-surface">
                        {formatearMoneda(monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detalle.resumen.comisiones_por_empleado.length > 0 && (
              <div>
                <p className="mb-2 font-label-md text-label-md text-on-surface">Comisiones</p>
                <ul className="space-y-1">
                  {detalle.resumen.comisiones_por_empleado.map((fila) => (
                    <li
                      key={fila.empleado}
                      className="flex items-center justify-between font-body-md text-body-md"
                    >
                      <span className="text-on-surface-variant">{fila.empleado_nombre}</span>
                      <span className="text-on-surface">{formatearMoneda(fila.monto)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detalle.nota_cierre && (
              <p className="rounded-lg bg-surface-container-low px-3 py-2 font-caption text-caption text-on-surface-variant">
                {detalle.nota_cierre}
              </p>
            )}

            <div>
              <p className="mb-2 font-label-md text-label-md text-on-surface">
                Movimientos ({detalle.movimientos.length})
              </p>
              <ul className="space-y-1.5">
                {detalle.movimientos.map((movimiento) => (
                  <li
                    key={movimiento.id}
                    className="flex items-center justify-between font-body-md text-body-md"
                  >
                    <span className="truncate text-on-surface-variant">{movimiento.concepto}</span>
                    <span className={cn("tabular-nums", ESTILO_MOVIMIENTO[movimiento.tipo].color)}>
                      {ESTILO_MOVIMIENTO[movimiento.tipo].signo}
                      {formatearMoneda(movimiento.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
