const MONEDA = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** El mismo formato que ya se repetía suelto en `ServiciosPage.tsx`,
 * `ModalCatalogo.tsx` y `publico/secciones.tsx` — Caja es el cuarto
 * lugar que lo necesita, el punto en que valía la pena extraerlo. Los
 * usos existentes no se migraron en esta tanda; nada urge hacerlo. */
export function formatearMoneda(valor: string | number): string {
  const numero = typeof valor === "string" ? Number(valor) : valor;
  return Number.isNaN(numero) ? String(valor) : MONEDA.format(numero);
}
