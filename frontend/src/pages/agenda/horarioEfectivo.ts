import type { components } from "../../api/schema";

type HorarioNegocio = components["schemas"]["HorarioNegocio"];
type HorarioTrabajo = components["schemas"]["HorarioTrabajo"];

/** Lo mínimo que necesita quien pinta una franja: sin `id` ni `miembro`. */
export interface Franja {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

/** Franjas que rigen para un empleado.
 *
 * Espeja la regla del backend (ver CONTRATO.md 5.7): el horario del
 * negocio es el que manda y todo empleado lo hereda; tener **al menos
 * una** franja propia en la semana convierte al empleado en excepción y
 * entonces su horario propio reemplaza al del negocio en todos los días,
 * no solo en los que cargó.
 *
 * Está duplicada acá a propósito: el backend es la autoridad al agendar,
 * pero la grilla semanal tiene que pintar la disponibilidad sin
 * preguntarle. Si la regla cambia allá, cambia acá.
 */
export function franjasDeEmpleado(
  miembroId: number,
  horariosPropios: HorarioTrabajo[],
  horarioNegocio: HorarioNegocio[],
): Franja[] {
  const propias = horariosPropios.filter((horario) => horario.miembro === miembroId);
  return propias.length > 0 ? propias : horarioNegocio;
}

/** ¿Este empleado es una excepción, o trabaja el horario del local? */
export function tieneHorarioPropio(miembroId: number, horariosPropios: HorarioTrabajo[]): boolean {
  return horariosPropios.some((horario) => horario.miembro === miembroId);
}

/** Unión de las franjas vigentes de varios empleados, sin repetidas.
 *
 * Es lo que se pinta cuando la agenda no está filtrada por empleado: la
 * banda de "hay alguien atendiendo" del equipo completo.
 */
export function franjasDelEquipo(
  miembrosIds: number[],
  horariosPropios: HorarioTrabajo[],
  horarioNegocio: HorarioNegocio[],
): Franja[] {
  const vistas = new Map<string, Franja>();
  for (const miembroId of miembrosIds) {
    for (const franja of franjasDeEmpleado(miembroId, horariosPropios, horarioNegocio)) {
      vistas.set(`${franja.dia_semana}-${franja.hora_inicio}-${franja.hora_fin}`, {
        dia_semana: franja.dia_semana,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
      });
    }
  }
  return [...vistas.values()];
}
