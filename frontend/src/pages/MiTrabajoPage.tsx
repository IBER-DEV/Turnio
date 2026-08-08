import { useCallback, useEffect, useMemo, useState } from "react";

import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { conReintentoDeAuth } from "../auth/refresh";
import { Card, EstadoError, EstadoVacio, SkeletonLista } from "../ui/Feedback";
import { FiltroPeriodo } from "../ui/FiltroPeriodo";
import { Icon } from "../ui/Icon";
import { formatearMoneda } from "../ui/moneda";
import { paraQuery, rangoDe } from "../ui/periodos";
import type { Periodo } from "../ui/periodos";
import { VentaCard } from "./caja/VentaCard";
import { aNumero } from "./caja/dinero";
import type { Venta } from "./caja/dinero";

/** Lo que hice y cuánto me toca.
 *
 * Reemplaza a "Mis servicios", que era un **formulario**: el empleado
 * registraba a mano cada trabajo para que alguien se lo aprobara. Ese
 * paso desapareció —la cuenta la genera sola la cita al completarse— así
 * que lo que queda es lo que el barbero de verdad quería de esa
 * pantalla: ver su día y su comisión.
 *
 * Sin `puede_cobrar` el backend ya acota el listado a las ventas donde
 * uno es el empleado de alguna línea; con la capacidad devolvería las de
 * todo el negocio, así que **siempre** se manda el propio id explícito.
 * Es el mismo criterio que ya usaba "Mis servicios": esta pantalla es lo
 * mío incluso para el dueño, que en "Caja" ve el resto.
 */
export function MiTrabajoPage() {
  const { membresia } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [referencia, setReferencia] = useState(new Date());
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    if (!membresia) return;
    setCargando(true);
    setError(false);
    const { data, error: errorRespuesta } = await conReintentoDeAuth(() =>
      apiClient.GET("/api/caja/ventas/", {
        params: {
          query: { ...paraQuery(rangoDe(periodo, referencia)), empleado: membresia.id },
        },
      }),
    );

    if (errorRespuesta) {
      setError(true);
    } else {
      setVentas(data ?? []);
    }
    setCargando(false);
  }, [membresia, periodo, referencia]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Mi comisión y mi producción del período.
   *
   * Se calcula **solo sobre mis líneas**: en una cuenta que hicimos entre
   * dos, la mitad del otro no es mía. Y se separa lo ya cobrado de lo que
   * todavía está por cobrar, porque la comisión se devenga cuando la
   * cuenta queda saldada — mostrarlas juntas prometería plata que
   * todavía no existe.
   */
  const resumen = useMemo(() => {
    const mias = ventas
      .filter((venta) => venta.estado !== "anulada")
      .flatMap((venta) =>
        venta.items
          .filter((item) => item.empleado === membresia?.id)
          .map((item) => ({ item, pagada: venta.estado === "pagada" })),
      );

    const comision = (subtotal: string, porcentaje: string) =>
      (aNumero(subtotal) * aNumero(porcentaje)) / 100;

    return {
      servicios: mias.length,
      producido: mias.reduce((suma, { item }) => suma + aNumero(item.subtotal), 0),
      comisionGanada: mias
        .filter(({ pagada }) => pagada)
        .reduce((suma, { item }) => suma + comision(item.subtotal, item.porcentaje_comision), 0),
      comisionPendiente: mias
        .filter(({ pagada }) => !pagada)
        .reduce((suma, { item }) => suma + comision(item.subtotal, item.porcentaje_comision), 0),
    };
  }, [ventas, membresia]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8">
          <Icon name="add_task" className="text-[20px] text-primary" />
        </span>
        <div>
          <h1 className="font-headline-md text-headline-md-mobile font-bold text-primary md:text-headline-md">
            Mi trabajo
          </h1>
          <p className="text-[12px] text-on-surface-variant">
            Lo que hiciste y cuánto te corresponde
          </p>
        </div>
      </header>

      <FiltroPeriodo
        periodo={periodo}
        referencia={referencia}
        onCambiarPeriodo={setPeriodo}
        onCambiarReferencia={setReferencia}
      />

      {cargando ? (
        <SkeletonLista filas={3} />
      ) : error ? (
        <EstadoError mensaje="No pudimos cargar tu trabajo." onReintentar={cargar} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="font-caption text-caption text-on-surface-variant">Servicios</p>
              <p className="mt-1 text-lg font-bold text-primary">{resumen.servicios}</p>
            </Card>
            <Card className="p-4">
              <p className="font-caption text-caption text-on-surface-variant">Produjiste</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {formatearMoneda(String(resumen.producido))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="font-caption text-caption text-on-surface-variant">Tu comisión</p>
              <p className="mt-1 text-lg font-bold text-completada">
                {formatearMoneda(String(resumen.comisionGanada))}
              </p>
            </Card>
            <Card className="p-4">
              <p className="font-caption text-caption text-on-surface-variant">
                Pendiente de cobro
              </p>
              <p className="mt-1 text-lg font-bold text-confirmada">
                {formatearMoneda(String(resumen.comisionPendiente))}
              </p>
            </Card>
          </div>

          {resumen.comisionPendiente > 0 && (
            <p className="flex items-start gap-2 font-caption text-caption text-on-surface-variant">
              <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
              La comisión se cuenta cuando el cliente termina de pagar. Lo pendiente ya está hecho,
              pero todavía no se ha cobrado.
            </p>
          )}

          {ventas.length === 0 ? (
            <EstadoVacio
              icono="add_task"
              titulo="Nada en este período"
              descripcion="Cuando marques una cita como terminada, aparece acá con lo que te corresponde."
            />
          ) : (
            <ul className="space-y-3">
              {ventas.map((venta) => (
                <li key={venta.id}>
                  <VentaCard venta={venta} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
