import { describe, expect, it } from "vitest";

import {
  PRESETS,
  avisoDeContraste,
  contraste,
  sirveComoTexto,
  textoSobre,
  variablesDeTema,
} from "./colores";

describe("contraste", () => {
  it("da los extremos conocidos de la escala WCAG", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contraste("#10b981", "#10b981")).toBeCloseTo(1, 5);
  });
});

describe("textoSobre", () => {
  it("pone letras oscuras encima de un color claro", () => {
    // El caso que motiva todo esto: el amarillo con letras blancas se ve
    // bien en la pantalla del dueño y no se lee en la calle.
    expect(textoSobre("#fde047")).toBe("#0f172a");
    expect(textoSobre("#ffffff")).toBe("#0f172a");
  });

  it("pone letras blancas encima de un color oscuro", () => {
    expect(textoSobre("#1e1b4b")).toBe("#ffffff");
    expect(textoSobre("#be123c")).toBe("#ffffff");
  });
});

describe("avisoDeContraste", () => {
  it("no molesta con un color que se lee bien", () => {
    expect(avisoDeContraste("#0369a1")).toBeNull();
  });

  it("avisa cuando el color es demasiado claro para leerse sobre blanco", () => {
    expect(avisoDeContraste("#fef08a")).toMatch(/muy claro/i);
  });

  it("avisa, más suave, cuando sirve de botón pero no de texto", () => {
    // 3.77 contra blanco: pasa el mínimo de interfaz, no el de texto.
    const aviso = avisoDeContraste("#059669");
    expect(aviso).not.toBeNull();
    expect(aviso).toMatch(/botones/i);
  });

  it("avisa también con la menta de Turnio, que no llega al mínimo", () => {
    // No es un caso de laboratorio: `#10b981` es el color del producto y
    // contra blanco da 2.54. El aviso tiene que ser honesto incluso
    // cuando el que queda mal es uno mismo (ver DECISIONES.md).
    expect(avisoDeContraste("#10b981")).not.toBeNull();
  });

  it("rechaza lo que no es un color", () => {
    expect(avisoDeContraste("rojo")).not.toBeNull();
    expect(avisoDeContraste("#12345")).not.toBeNull();
  });
});

describe("presets", () => {
  it("todos se leen bien sobre blanco: quien elige de la lista nunca ve un aviso", () => {
    for (const { nombre, hex } of PRESETS) {
      expect(sirveComoTexto(hex), nombre).toBe(true);
      expect(avisoDeContraste(hex), nombre).toBeNull();
    }
  });
});

describe("variablesDeTema", () => {
  it("sin color propio no pisa nada, y el default de Turnio queda en pie", () => {
    expect(variablesDeTema(null)).toEqual({});
    expect(variablesDeTema("")).toEqual({});
  });

  it("ignora un valor corrupto en vez de inyectarlo en el CSS", () => {
    // El backend ya valida el formato, pero esto es lo que se mete en un
    // atributo `style` de una página pública: no se confía y punto.
    expect(variablesDeTema("red; background: url(x)")).toEqual({});
  });

  it("redeclara los cuatro tokens que usan las utilidades de Tailwind", () => {
    const variables = variablesDeTema("#4f46e5");

    expect(variables["--color-acento"]).toBe("#4f46e5");
    expect(variables["--color-sobre-acento"]).toBe("#ffffff");
    expect(variables["--color-acento-fuerte"]).toContain("color-mix");
    expect(variables["--color-acento-suave"]).toContain("color-mix");
  });
});
