import { describe, expect, it } from "vitest";

import { franjasDeEmpleado, franjasDelEquipo, tieneHorarioPropio } from "./horarioEfectivo";

/** El schema tipa el día como unión de literales, no como `number`. */
type Dia = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const LUNES: Dia = 0;
const SABADO: Dia = 5;

function negocio(dia: Dia, desde: string, hasta: string) {
  return { id: dia + 100, dia_semana: dia, hora_inicio: desde, hora_fin: hasta };
}

function propio(miembro: number, dia: Dia, desde: string, hasta: string) {
  return { id: miembro * 10 + dia, miembro, dia_semana: dia, hora_inicio: desde, hora_fin: hasta };
}

describe("franjasDeEmpleado", () => {
  it("hereda el horario del negocio cuando el empleado no tiene uno propio", () => {
    const horarioNegocio = [negocio(LUNES, "09:00:00", "18:00:00")];

    expect(franjasDeEmpleado(1, [], horarioNegocio)).toEqual(horarioNegocio);
  });

  it("usa el horario propio en lugar del negocio cuando existe", () => {
    const horarioNegocio = [negocio(LUNES, "09:00:00", "18:00:00")];
    const horarios = [propio(1, SABADO, "09:00:00", "14:00:00")];

    expect(franjasDeEmpleado(1, horarios, horarioNegocio)).toEqual(horarios);
  });

  it("no hereda día por día: tener horario propio un solo día vacía los demás", () => {
    // El caso que se rompe si se filtra por día antes de decidir si hereda:
    // el de 'solo sábados' aparecería disponible el lunes.
    const horarioNegocio = [negocio(LUNES, "09:00:00", "18:00:00")];
    const horarios = [propio(1, SABADO, "09:00:00", "14:00:00")];

    const delLunes = franjasDeEmpleado(1, horarios, horarioNegocio).filter(
      (franja) => franja.dia_semana === LUNES,
    );

    expect(delLunes).toEqual([]);
  });

  it("no confunde el horario propio de otro empleado con el suyo", () => {
    const horarioNegocio = [negocio(LUNES, "09:00:00", "18:00:00")];
    const horarios = [propio(2, SABADO, "09:00:00", "14:00:00")];

    expect(franjasDeEmpleado(1, horarios, horarioNegocio)).toEqual(horarioNegocio);
  });
});

describe("franjasDelEquipo", () => {
  it("no repite la franja del negocio una vez por empleado que la hereda", () => {
    const horarioNegocio = [negocio(LUNES, "09:00:00", "18:00:00")];

    expect(franjasDelEquipo([1, 2, 3], [], horarioNegocio)).toHaveLength(1);
  });

  it("suma la franja del que trabaja distinto a la del resto", () => {
    const horarioNegocio = [negocio(LUNES, "09:00:00", "18:00:00")];
    const horarios = [propio(2, SABADO, "09:00:00", "14:00:00")];

    const franjas = franjasDelEquipo([1, 2], horarios, horarioNegocio);

    expect(franjas).toHaveLength(2);
    expect(franjas.map((franja) => franja.dia_semana).sort()).toEqual([LUNES, SABADO]);
  });

  it("sin horario de negocio ni propio, no hay disponibilidad que pintar", () => {
    expect(franjasDelEquipo([1, 2], [], [])).toEqual([]);
  });
});

describe("tieneHorarioPropio", () => {
  it("distingue al que es excepción del que hereda", () => {
    const horarios = [propio(2, SABADO, "09:00:00", "14:00:00")];

    expect(tieneHorarioPropio(2, horarios)).toBe(true);
    expect(tieneHorarioPropio(1, horarios)).toBe(false);
  });
});
