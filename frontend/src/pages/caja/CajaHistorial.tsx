import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import { ESTILO_ESTADO_CAJA } from "../../ui/EstadoCaja";
import { Badge, Card, EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { Modal } from "../../ui/Modal";
import { formatearMoneda } from "../../ui/moneda";
import { FiltroPeriodo } from "../servicios/FiltroPeriodo";
import { paraQuery, rangoDe } from "../servicios/filtrosPeriodo";
import type { Periodo } from "../servicios/filtrosPeriodo";

type CajaLista = components["schemas"]["CajaLista"];
type CajaDetalle = components["schemas"]["CajaDetalle"];

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
            <div className="rounded-xl border border-outline-variant p-4">
              <div className="flex items-center justify-between font-body-md text-body-md">
                <span className="text-on-surface-variant">Ingresos</span>
                <span className="text-on-surface">
                  {formatearMoneda(detalle.resumen.total_ingresos)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between font-body-md text-body-md">
                <span className="text-on-surface-variant">Egresos</span>
                <span className="text-on-surface">
                  {formatearMoneda(detalle.resumen.total_egresos)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-outline-variant pt-2 font-label-md text-label-md">
                <span className="text-on-surface">Neto</span>
                <span className="text-primary">{formatearMoneda(detalle.resumen.neto)}</span>
              </div>
            </div>

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
                    <span
                      className={
                        movimiento.tipo === "ingreso" ? "text-completada" : "text-error"
                      }
                    >
                      {movimiento.tipo === "egreso" ? "− " : ""}
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
