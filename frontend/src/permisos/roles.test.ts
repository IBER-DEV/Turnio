import { describe, expect, it } from "vitest";

import { CAPACIDADES, DEFINICIONES, GRUPOS } from "./catalogo";
import { ROLES, capacidadesDe, etiquetaDeRol, rolDe } from "./roles";
import { motivoBloqueo } from "./reglas";

const BARBERO = ROLES.find((rol) => rol.id === "barbero")!;
const RECEPCION = ROLES.find((rol) => rol.id === "recepcion")!;
const ADMIN = ROLES.find((rol) => rol.id === "administrador")!;

describe("catálogo", () => {
  it("agrupa todas las capacidades, sin dejar ninguna suelta", () => {
    // Si el backend agrega una capacidad, `DEFINICIONES` deja de compilar
    // por ser Record<Capacidad, …>; esto atrapa el otro despiste, que es
    // definirla y olvidar ponerla en un grupo — con lo cual no se
    // renderiza en ninguna parte.
    const enGrupos = GRUPOS.flatMap((grupo) => grupo.capacidades);

    expect([...enGrupos].sort()).toEqual(Object.keys(DEFINICIONES).sort());
  });

  it("no repite una capacidad en dos grupos", () => {
    const enGrupos = GRUPOS.flatMap((grupo) => grupo.capacidades);

    expect(new Set(enGrupos).size).toBe(enGrupos.length);
  });
});

describe("rolDe", () => {
  it("reconoce un rol exacto sin marcar cambios", () => {
    const { rol, cambios } = rolDe(capacidadesDe(RECEPCION));

    expect(rol.id).toBe("recepcion");
    expect(cambios).toBe(0);
  });

  it("reconoce al barbero, que es el que no tiene ninguna capacidad", () => {
    const { rol, cambios } = rolDe({});

    expect(rol.id).toBe("barbero");
    expect(cambios).toBe(0);
  });

  it("reporta el rol más cercano y cuántos interruptores lo separan", () => {
    const casi = { ...capacidadesDe(RECEPCION), puede_editar_precios: true };

    const { rol, cambios } = rolDe(casi);

    expect(rol.id).toBe("recepcion");
    expect(cambios).toBe(1);
  });

  it("el administrador tiene absolutamente todas las capacidades", () => {
    expect([...ADMIN.capacidades].sort()).toEqual([...CAPACIDADES].sort());
  });

  it("ante empate describe con el rol más acotado", () => {
    // ROLES va de menos a más permisos, así que el desempate no puede
    // depender del orden de iteración por accidente.
    const { rol } = rolDe({});

    expect(ROLES.indexOf(rol)).toBe(0);
  });
});

describe("etiquetaDeRol", () => {
  it("no dice 'cambios' cuando el rol calza exacto", () => {
    expect(etiquetaDeRol(capacidadesDe(BARBERO))).toBe("Barbero o estilista");
  });

  it("singulariza un solo cambio", () => {
    const uno = { ...capacidadesDe(RECEPCION), puede_editar_precios: true };

    expect(etiquetaDeRol(uno)).toBe("Recepción · 1 cambio");
  });

  it("pluraliza varios, contra el rol realmente más cercano", () => {
    // Un barbero al que le dieron caja y precios: sigue estando más cerca
    // de "barbero" (2 interruptores) que de "recepción" (3), aunque tenga
    // dos permisos de más.
    const dos = { puede_cobrar: true, puede_editar_precios: true };

    expect(etiquetaDeRol(dos)).toBe("Barbero o estilista · 2 cambios");
  });
});

describe("motivoBloqueo", () => {
  const yo = { id: 1, puede_gestionar_agenda: true };
  const otro = { id: 2 };

  it("deja pasar lo que uno sí tiene", () => {
    expect(
      motivoBloqueo({
        capacidad: "puede_gestionar_agenda",
        yo,
        objetivo: otro,
        puedoGestionarEquipo: true,
      }),
    ).toBeNull();
  });

  it("bloquea cambiarse los permisos a uno mismo", () => {
    const motivo = motivoBloqueo({
      capacidad: "puede_gestionar_agenda",
      yo,
      objetivo: yo,
      puedoGestionarEquipo: true,
    });

    expect(motivo).toMatch(/tus propios permisos/);
  });

  it("bloquea dar un permiso que uno no tiene", () => {
    const motivo = motivoBloqueo({
      capacidad: "puede_editar_precios",
      yo,
      objetivo: otro,
      puedoGestionarEquipo: true,
    });

    expect(motivo).toMatch(/no tienes/);
  });

  it("permite QUITAR un permiso que uno no tiene", () => {
    // Reducir permisos ajenos no amplía los propios. Bloquearlo dejaría a
    // un administrador sin poder frenar a alguien con más que él.
    const conElPermiso = { id: 2, puede_editar_precios: true };

    expect(
      motivoBloqueo({
        capacidad: "puede_editar_precios",
        yo,
        objetivo: conElPermiso,
        puedoGestionarEquipo: true,
      }),
    ).toBeNull();
  });

  it("bloquea todo si no se gestiona el equipo", () => {
    const motivo = motivoBloqueo({
      capacidad: "puede_gestionar_agenda",
      yo,
      objetivo: otro,
      puedoGestionarEquipo: false,
    });

    expect(motivo).toMatch(/agregar gente/);
  });
});
