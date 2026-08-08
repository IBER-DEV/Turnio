import { describe, expect, it } from "vitest";

import { etiquetaDe, moverPeriodo, paraQuery, rangoDe } from "./periodos";

// Martes 28 de julio de 2026.
const MARTES = new Date(2026, 6, 28);

describe("rangoDe", () => {
  it("día: desde y hasta son el mismo día", () => {
    const rango = rangoDe("dia", MARTES);
    expect(paraQuery(rango)).toEqual({ fecha_desde: "2026-07-28", fecha_hasta: "2026-07-28" });
  });

  it("semana: empieza en lunes y termina en domingo", () => {
    const rango = rangoDe("semana", MARTES);
    expect(paraQuery(rango)).toEqual({ fecha_desde: "2026-07-27", fecha_hasta: "2026-08-02" });
  });

  it("semana: un lunes es el inicio de su propia semana", () => {
    const lunes = new Date(2026, 6, 27);
    const rango = rangoDe("semana", lunes);
    expect(paraQuery(rango)).toEqual({ fecha_desde: "2026-07-27", fecha_hasta: "2026-08-02" });
  });

  it("mes: cubre del día 1 al último día del mes", () => {
    const rango = rangoDe("mes", MARTES);
    expect(paraQuery(rango)).toEqual({ fecha_desde: "2026-07-01", fecha_hasta: "2026-07-31" });
  });

  it("mes: respeta meses de 28/29/30 días", () => {
    const febrero2028 = new Date(2028, 1, 10); // bisiesto
    expect(paraQuery(rangoDe("mes", febrero2028)).fecha_hasta).toBe("2028-02-29");
  });
});

describe("moverPeriodo", () => {
  it("día: avanza y retrocede un día", () => {
    expect(paraQuery(rangoDe("dia", moverPeriodo("dia", MARTES, 1)))).toEqual({
      fecha_desde: "2026-07-29",
      fecha_hasta: "2026-07-29",
    });
    expect(paraQuery(rangoDe("dia", moverPeriodo("dia", MARTES, -1)))).toEqual({
      fecha_desde: "2026-07-27",
      fecha_hasta: "2026-07-27",
    });
  });

  it("semana: avanza siete días, cruzando de mes si hace falta", () => {
    const siguiente = moverPeriodo("semana", MARTES, 1);
    expect(paraQuery(rangoDe("semana", siguiente))).toEqual({
      fecha_desde: "2026-08-03",
      fecha_hasta: "2026-08-09",
    });
  });

  it("mes: cruza de diciembre a enero del año siguiente", () => {
    const diciembre = new Date(2026, 11, 15);
    const siguiente = moverPeriodo("mes", diciembre, 1);
    expect(paraQuery(rangoDe("mes", siguiente))).toEqual({
      fecha_desde: "2027-01-01",
      fecha_hasta: "2027-01-31",
    });
  });
});

describe("etiquetaDe", () => {
  it("no revienta con ninguno de los tres períodos", () => {
    for (const periodo of ["dia", "semana", "mes"] as const) {
      expect(etiquetaDe(periodo, rangoDe(periodo, MARTES)).length).toBeGreaterThan(0);
    }
  });
});
