import type { components } from "../../api/schema";

export type MetodoPago = components["schemas"]["MetodoPagoEnum"];
export type CategoriaEgreso = components["schemas"]["CategoriaEgresoEnum"];
export type Venta = components["schemas"]["Venta"];
export type VentaItem = components["schemas"]["VentaItem"];
export type CajaDetalle = components["schemas"]["CajaDetalle"];
export type MovimientoCaja = components["schemas"]["MovimientoCaja"];

/** Los métodos con que se cobra, en el orden en que se ofrecen.
 *
 * `efectivo` va primero porque es el que más se usa en un local
 * colombiano y porque es el único que entra al arqueo del cajón — el
 * resto se concilia contra el extracto de su plataforma
 * (`CONTRATO.md` 5.14).
 *
 * `Record` completo y no una lista suelta: `MetodoPago` sale del schema,
 * así que si el backend agrega un método esto **deja de compilar** hasta
 * que alguien decida cómo se llama en la UI. Mismo criterio que
 * `permisos/catalogo.ts`.
 */
export const METODOS_PAGO: Record<MetodoPago, { etiqueta: string; efectivo: boolean }> = {
  efectivo: { etiqueta: "Efectivo", efectivo: true },
  tarjeta: { etiqueta: "Tarjeta", efectivo: false },
  nequi: { etiqueta: "Nequi", efectivo: false },
  daviplata: { etiqueta: "Daviplata", efectivo: false },
  bre_b: { etiqueta: "Bre-B", efectivo: false },
  otro: { etiqueta: "Otro", efectivo: false },
};

export const ORDEN_METODOS_PAGO = Object.keys(METODOS_PAGO) as MetodoPago[];

export function etiquetaMetodo(metodo: string): string {
  return METODOS_PAGO[metodo as MetodoPago]?.etiqueta ?? metodo;
}

/** Las categorías de gasto, en el orden en que se ofrecen: primero las
 * que un local usa a diario, `otros` al final. */
export const CATEGORIAS_EGRESO: Record<CategoriaEgreso, string> = {
  insumos: "Insumos",
  nomina: "Nómina",
  comisiones: "Comisiones",
  arriendo: "Arriendo",
  servicios_publicos: "Servicios públicos",
  transporte: "Transporte",
  mantenimiento: "Mantenimiento",
  otros: "Otros",
};

export const ORDEN_CATEGORIAS = Object.keys(CATEGORIAS_EGRESO) as CategoriaEgreso[];

/** Cómo se pinta cada tipo de movimiento en el libro del día.
 *
 * `devolucion` tiene entrada propia y no comparte la de `egreso` a
 * propósito: sale plata en los dos casos, pero para el dueño "le devolví
 * a un cliente" y "compré shampoo" son hechos distintos — es la misma
 * distinción que el backend hace con un tipo aparte.
 */
export const ESTILO_MOVIMIENTO: Record<
  MovimientoCaja["tipo"],
  { icono: "add_circle" | "cancel" | "undo"; color: string; fondo: string; signo: string }
> = {
  ingreso: {
    icono: "add_circle",
    color: "text-completada",
    fondo: "bg-completada/15 text-completada",
    signo: "",
  },
  egreso: {
    icono: "cancel",
    color: "text-error",
    fondo: "bg-error/15 text-error",
    signo: "− ",
  },
  devolucion: {
    icono: "undo",
    color: "text-error",
    fondo: "bg-cancelada/15 text-cancelada",
    signo: "− ",
  },
};

export function formatearHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Los montos viajan como string decimal (`"20000.00"`) porque así los
 * serializa DRF. Compararlos o restarlos como texto es un bug esperando
 * a pasar, así que todo cálculo pasa por acá. */
export function aNumero(monto: string): number {
  const numero = Number(monto);
  return Number.isNaN(numero) ? 0 : numero;
}

/** Quiénes atendieron en una venta, sin repetidos.
 *
 * La venta **no** tiene un campo `empleado`: quién hizo el trabajo es de
 * cada línea, porque una cuenta puede pasar por dos manos (uno corta,
 * otro hace la barba). Ver `CONTRATO.md` 5.13.
 */
export function empleadosDe(venta: Venta): string[] {
  return [...new Set(venta.items.map((item) => item.empleado_nombre))];
}
