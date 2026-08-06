import { describe, expect, it } from "vitest";

import { formatearMoneda } from "./moneda";

describe("formatearMoneda", () => {
  it("formatea un número o un string numérico como pesos colombianos", () => {
    expect(formatearMoneda(20000)).toMatch(/20\.000|20,000/);
    expect(formatearMoneda("20000")).toMatch(/20\.000|20,000/);
  });

  it("una entrada no numérica no explota: devuelve el valor tal cual", () => {
    // `resumen.por_metodo_pago` u otro campo del contrato podría llegar
    // vacío o con basura ante un bug del backend; que la pantalla de
    // Caja muestre texto crudo es preferible a que la página entera
    // reviente en un `NaN` formateado.
    expect(formatearMoneda("no-numero")).toBe("no-numero");
  });
});
