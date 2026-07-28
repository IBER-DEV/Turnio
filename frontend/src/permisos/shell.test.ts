import { describe, expect, it } from "vitest";

import { CAPACIDADES, DEFINICIONES, GRUPOS, TIPOS, type TipoDeUsuario } from "./catalogo";
import { SHELLS, shellDe } from "./shell";

const TODO = Object.fromEntries(CAPACIDADES.map((capacidad) => [capacidad, true]));
const NADA = {};

describe("catálogo", () => {
  it("agrupa todas las capacidades, sin dejar ninguna suelta", () => {
    // `DEFINICIONES` es Record<Capacidad, …>, así que una capacidad nueva
    // en el backend rompe la compilación. Esto atrapa el otro despiste:
    // definirla y olvidar ponerla en un grupo, con lo cual no se
    // renderiza en ninguna parte.
    const enGrupos = GRUPOS.flatMap((grupo) => grupo.capacidades);

    expect([...enGrupos].sort()).toEqual(Object.keys(DEFINICIONES).sort());
  });

  it("no repite una capacidad en dos grupos", () => {
    const enGrupos = GRUPOS.flatMap((grupo) => grupo.capacidades);

    expect(new Set(enGrupos).size).toBe(enGrupos.length);
  });

  it("traduce todos los tipos que manda el backend", () => {
    for (const tipo of Object.keys(SHELLS) as TipoDeUsuario[]) {
      expect(TIPOS[tipo]?.etiqueta).toBeTruthy();
    }
  });

  it("cada permiso tiene forma corta y cabe en un chip", () => {
    // El resumen de la tarjeta de cargo se arma con `corto`. Una cadena
    // vacía dejaría un chip fantasma y una larga rompería la fila.
    for (const capacidad of CAPACIDADES) {
      const { corto } = DEFINICIONES[capacidad];
      expect(corto.trim()).not.toBe("");
      expect(corto.length).toBeLessThanOrEqual(16);
    }
  });
});

describe("shellDe", () => {
  it("manda a administración al panel y a los demás a su agenda", () => {
    expect(shellDe("administracion", TODO).inicio).toBe("/");
    expect(shellDe("recepcion", TODO).inicio).toBe("/agenda");
    expect(shellDe("operativo", NADA).inicio).toBe("/agenda");
  });

  it("le deja al operativo solo lo suyo", () => {
    const rutas = shellDe("operativo", NADA).navegacion.map((item) => item.to);

    expect(rutas).toEqual(["/", "/agenda"]);
  });

  it("oculta las secciones de gestión a quien no las puede usar", () => {
    // El tipo decide la forma, pero la capacidad sigue mandando dentro de
    // ella: un recepción sin gestionar equipo no ve Equipo ni Cargos.
    const rutas = shellDe("recepcion", NADA).navegacion.map((item) => item.to);

    expect(rutas).not.toContain("/empleados");
    expect(rutas).not.toContain("/configuracion/cargos");
  });

  it("las muestra a quien sí puede", () => {
    const rutas = shellDe("recepcion", TODO).navegacion.map((item) => item.to);

    expect(rutas).toContain("/empleados");
    expect(rutas).toContain("/configuracion/cargos");
  });

  it("sin tipo cae en el shell más acotado", () => {
    // Si algo falla al resolver la membresía, mostrar de menos es la
    // falla segura: de más sería enseñar secciones que dan 403.
    expect(shellDe(undefined, NADA).navegacion.map((item) => item.to)).toEqual([
      "/",
      "/agenda",
    ]);
  });

  it("todo shell arranca en una ruta que él mismo tiene", () => {
    // Un inicio fuera de la navegación deja al usuario en una pantalla a
    // la que después no puede volver.
    for (const tipo of Object.keys(SHELLS) as TipoDeUsuario[]) {
      const shell = shellDe(tipo, TODO);
      expect(shell.navegacion.map((item) => item.to)).toContain(shell.inicio);
    }
  });
});
