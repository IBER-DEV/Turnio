import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { components } from "../../api/schema";
import { conReintentoDeAuth } from "../../auth/refresh";
import { usePermisos } from "../../permisos/usePermisos";
import { Button } from "../../ui/Button";
import { EstadoError, EstadoVacio, SkeletonLista } from "../../ui/Feedback";
import { Icon } from "../../ui/Icon";
import { formatearMoneda } from "../../ui/moneda";
import { ModalCobrar } from "./ModalCobrar";
import { ModalDeshacer } from "./ModalDeshacer";
import type { ModoDeshacer } from "./ModalDeshacer";
import { ModalVenta } from "./ModalVenta";
import { VentaCard } from "./VentaCard";
import { aNumero } from "./dinero";
import type { Venta } from "./dinero";

type Servicio = components["schemas"]["Servicio"];
// `MiembroEquipo` (de `/api/negocios/equipo/`) y **no** `MiembroNegocio`
// (de `/api/negocios/empleados/`): el segundo es la vista de gestión y
// exige `puede_gestionar_empleados` incluso para leer, que recepción no
// tiene. Con el endpoint equivocado la respuesta era 403 y el selector
// de "¿quién lo hizo?" quedaba vacío justo para quien más lo usa. La
// regla está en `CONTRATO.md` 5.4: si solo necesitas nombres, `/equipo/`.
type Empleado = components["schemas"]["MiembroEquipo"];

/** La cola de cobro: lo que el negocio hizo y todavía no cobró.
 *
 * Es la pantalla que reemplaza al viejo "validar servicios". La
 * diferencia no es cosmética: antes había que aprobar un registro y
 * **después** cobrarlo en otra pantalla; ahora cobrar es aprobar, y la
 * cuenta llega sola desde la cita que el empleado completó.
 *
 * Trae las cuentas `pendiente` y `parcial` en dos llamadas y no una
 * porque el filtro `?estado=` del backend acepta un solo valor. Es más
 * barato que traerlas todas y filtrar en el cliente: en un negocio con
 * meses de historia, "todas" crece sin techo y esta lista no.
 */
export function CobrosPendientes({ onCambio }: { onCambio?: () => void }) {
  const { puede } = usePermisos();
  const puedeCobrar = puede("puede_cobrar");
  const puedeAnular = puede("puede_anular_venta");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [cobrando, setCobrando] = useState<Venta | null>(null);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState<{ venta: Venta; modo: ModoDeshacer } | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(false);
    const [pendientes, parciales, serviciosResp, empleadosResp] = await Promise.all([
      conReintentoDeAuth(() =>
        apiClient.GET("/api/caja/ventas/", { params: { query: { estado: "pendiente" } } }),
      ),
      conReintentoDeAuth(() =>
        apiClient.GET("/api/caja/ventas/", { params: { query: { estado: "parcial" } } }),
      ),
      conReintentoDeAuth(() => apiClient.GET("/api/servicios/")),
      conReintentoDeAuth(() => apiClient.GET("/api/negocios/equipo/")),
    ]);

    if (pendientes.error || parciales.error) {
      setError(true);
      setCargando(false);
      return;
    }

    // Las parciales primero: ya tienen plata puesta, así que son las que
    // más urge terminar de cobrar antes de cerrar el día.
    setVentas([...(parciales.data ?? []), ...(pendientes.data ?? [])]);
    setServicios(serviciosResp.data ?? []);
    setEmpleados((empleadosResp.data ?? []).filter((empleado) => empleado.activo));
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /** Saca de la lista lo que dejó de estar por cobrar, o lo actualiza si
   * sigue con saldo (un abono parcial). Evita recargar todo por un cobro
   * — en el mostrador, con el cliente esperando, el refresco completo se
   * nota. */
  function reemplazar(venta: Venta) {
    setVentas((actual) =>
      venta.estado === "pendiente" || venta.estado === "parcial"
        ? actual.map((otra) => (otra.id === venta.id ? venta : otra))
        : actual.filter((otra) => otra.id !== venta.id),
    );
    setCobrando(null);
    setDeshaciendo(null);
    onCambio?.();
  }

  if (cargando) return <SkeletonLista filas={3} />;

  if (error) {
    return (
      <EstadoError
        mensaje="No pudimos cargar los cobros pendientes. Revisa tu conexión."
        onReintentar={cargar}
      />
    );
  }

  const totalPorCobrar = ventas.reduce((suma, venta) => suma + aNumero(venta.saldo_pendiente), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {ventas.length > 0 ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            <strong className="text-on-surface">{ventas.length}</strong>{" "}
            {ventas.length === 1 ? "cuenta" : "cuentas"} por cobrar ·{" "}
            <strong className="text-primary">{formatearMoneda(String(totalPorCobrar))}</strong>
          </p>
        ) : (
          <span />
        )}
        {puedeCobrar && (
          <Button icono="add" tamano="sm" variante="secondary" onClick={() => setNuevaAbierta(true)}>
            Cuenta sin cita
          </Button>
        )}
      </div>

      {ventas.length === 0 ? (
        <EstadoVacio
          icono="receipt_long"
          titulo="Nada por cobrar"
          descripcion="Cuando un empleado marque una cita como terminada, la cuenta aparece acá lista para cobrar."
          accion={
            puedeCobrar
              ? { etiqueta: "Abrir cuenta sin cita", onClick: () => setNuevaAbierta(true) }
              : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {ventas.map((venta) => (
            <li key={venta.id} className="animate-slide-in-bottom">
              <VentaCard
                venta={venta}
                acciones={
                  <>
                    {puedeCobrar && (
                      <Button
                        icono="payments"
                        tamano="sm"
                        className="flex-1"
                        onClick={() => setCobrando(venta)}
                      >
                        Cobrar {formatearMoneda(venta.saldo_pendiente)}
                      </Button>
                    )}
                    {puedeAnular && (
                      <Button
                        variante="danger"
                        tamano="sm"
                        onClick={() => setDeshaciendo({ venta, modo: "anular" })}
                      >
                        Anular
                      </Button>
                    )}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {!puedeCobrar && (
        <p className="flex items-start gap-2 font-caption text-caption text-on-surface-variant">
          <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
          Ves lo que está por cobrarse, pero cobrar necesita el permiso de caja.
        </p>
      )}

      <ModalCobrar venta={cobrando} onCerrar={() => setCobrando(null)} onCobrada={reemplazar} />

      <ModalDeshacer
        venta={deshaciendo?.venta ?? null}
        modo={deshaciendo?.modo ?? "anular"}
        onCerrar={() => setDeshaciendo(null)}
        onListo={reemplazar}
      />

      <ModalVenta
        abierto={nuevaAbierta}
        servicios={servicios}
        empleados={empleados}
        onCerrar={() => setNuevaAbierta(false)}
        onCreada={(venta) => {
          setVentas((actual) => [venta, ...actual]);
          onCambio?.();
        }}
      />
    </div>
  );
}
