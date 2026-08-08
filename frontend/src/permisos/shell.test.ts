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
  it("manda a administración al panel, a recepción a los cobros y al operativo a su agenda", () => {
    expect(shellDe("administracion", TODO).inicio).toBe("/");
    // Recepción entra a la cola de cobro: es lo que tiene enfrente
    // cuando el cliente se para a pagar.
    expect(shellDe("recepcion", TODO).inicio).toBe("/caja");
    expect(shellDe("operativo", NADA).inicio).toBe("/agenda");
  });

  it("un inicio que la persona no puede abrir cae en la primera entrada que sí", () => {
    // `RutaProtegida` redirige a `shell.inicio` cuando alguien entra
    // donde no le toca. Si ese inicio fuera a su vez prohibido, se
    // rebotaría contra sí mismo para siempre: un recepción sin
    // `puede_cobrar` quedaría en un bucle de redirecciones a /caja.
    const shell = shellDe("recepcion", NADA);

    expect(shell.inicio).not.toBe("/caja");
    expect(shell.navegacion.map((item) => item.to)).toContain(shell.inicio);
  });

  it("le deja al operativo solo lo suyo", () => {
    const rutas = shellDe("operativo", NADA).navegacion.map((item) => item.to);

    expect(rutas).toEqual(["/", "/agenda", "/mi-trabajo"]);
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

  it("el perfil del negocio solo aparece con su capacidad", () => {
    expect(shellDe("administracion", NADA).navegacion.map((item) => item.to)).not.toContain(
      "/configuracion/negocio",
    );
    expect(shellDe("administracion", TODO).navegacion.map((item) => item.to)).toContain(
      "/configuracion/negocio",
    );
  });

  it("Caja es principal y solo aparece con puede_cobrar", () => {
    // Es el momento de conversión del producto (cerrar el día): a
    // propósito no es secundaria, a diferencia de Cargos.
    expect(shellDe("administracion", NADA).navegacion.map((item) => item.to)).not.toContain(
      "/caja",
    );
    const conCaja = shellDe("administracion", { puede_cobrar: true }).navegacion;
    expect(conCaja.map((item) => item.to)).toContain("/caja");
    expect(conCaja.find((item) => item.to === "/caja")?.secundaria).not.toBe(true);
  });

  it("Cargos le cedió su lugar principal a Caja", () => {
    const rutas = shellDe("administracion", TODO).navegacion;
    expect(rutas.find((item) => item.to === "/configuracion/cargos")?.secundaria).toBe(true);
  });

  it("la barra inferior de móvil no pasa de cinco entradas", () => {
    // Es un presupuesto de espacio real, no una preferencia: por encima
    // de cinco, los rótulos se pisan en un teléfono angosto. Lo que sobra
    // se marca `secundaria` y vive en el menú de cuenta (ver Layout).
    for (const tipo of Object.keys(SHELLS) as TipoDeUsuario[]) {
      const principales = shellDe(tipo, TODO).navegacion.filter((item) => !item.secundaria);
      expect(principales.length).toBeLessThanOrEqual(5);
    }
  });

  it("sin tipo cae en el shell más acotado", () => {
    // Si algo falla al resolver la membresía, mostrar de menos es la
    // falla segura: de más sería enseñar secciones que dan 403.
    expect(shellDe(undefined, NADA).navegacion.map((item) => item.to)).toEqual([
      "/",
      "/agenda",
      "/mi-trabajo",
    ]);
  });

  it("todo shell arranca en una ruta que él mismo tiene, tenga o no capacidades", () => {
    // Un inicio fuera de la navegación deja al usuario en una pantalla a
    // la que después no puede volver — o, peor, en un bucle de
    // redirecciones (ver `shellDe`). Se verifica con **y sin**
    // capacidades: el caso que rompía era justamente el de sin.
    for (const tipo of Object.keys(SHELLS) as TipoDeUsuario[]) {
      for (const capacidades of [TODO, NADA]) {
        const shell = shellDe(tipo, capacidades);
        expect(shell.navegacion.map((item) => item.to)).toContain(shell.inicio);
      }
    }
  });
});
