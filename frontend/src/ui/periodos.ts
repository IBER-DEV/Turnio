export type Periodo = "dia" | "semana" | "mes";

const MESES_CORTOS = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function medianoche(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

/** Lunes de la semana de `fecha` — mismo criterio que `DiaSemana.LUNES = 0`
 * en el backend y que `DIAS_CORTOS` en `AgendaPage` (empieza en lunes). */
function inicioDeSemana(fecha: Date): Date {
  const dia = medianoche(fecha);
  const diasDesdeLunes = (dia.getDay() + 6) % 7;
  dia.setDate(dia.getDate() - diasDesdeLunes);
  return dia;
}

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/** El rango [desde, hasta] (ambos inclusive) que cubre `referencia` según
 * el período elegido. */
export function rangoDe(periodo: Periodo, referencia: Date): RangoFechas {
  if (periodo === "dia") {
    const desde = medianoche(referencia);
    return { desde, hasta: desde };
  }
  if (periodo === "semana") {
    const desde = inicioDeSemana(referencia);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + 6);
    return { desde, hasta };
  }
  const desde = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const hasta = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0);
  return { desde, hasta };
}

/** Mueve `referencia` un período hacia adelante (o atrás, con `-1`). */
export function moverPeriodo(periodo: Periodo, referencia: Date, direccion: 1 | -1): Date {
  const siguiente = new Date(referencia);
  if (periodo === "dia") siguiente.setDate(siguiente.getDate() + direccion);
  else if (periodo === "semana") siguiente.setDate(siguiente.getDate() + direccion * 7);
  else siguiente.setMonth(siguiente.getMonth() + direccion);
  return siguiente;
}

function paraApi(fecha: Date): string {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, "0");
  const dd = String(fecha.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** `fecha_desde`/`fecha_hasta` en el formato que espera la API
 * (`CONTRATO.md` 5.13/5.14): `YYYY-MM-DD`, inclusive en ambos extremos. */
export function paraQuery(rango: RangoFechas): { fecha_desde: string; fecha_hasta: string } {
  return { fecha_desde: paraApi(rango.desde), fecha_hasta: paraApi(rango.hasta) };
}

/** Cómo se le muestra el rango a la persona, según el período. */
export function etiquetaDe(periodo: Periodo, rango: RangoFechas): string {
  if (periodo === "dia") {
    return rango.desde.toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  }
  if (periodo === "semana") {
    const mismoMes = rango.desde.getMonth() === rango.hasta.getMonth();
    const inicio = `${rango.desde.getDate()}${mismoMes ? "" : ` ${MESES_CORTOS[rango.desde.getMonth()]}`}`;
    const fin = `${rango.hasta.getDate()} ${MESES_CORTOS[rango.hasta.getMonth()]}`;
    return `${inicio} – ${fin}`;
  }
  return rango.desde.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}
