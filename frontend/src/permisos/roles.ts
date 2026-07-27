import { CAPACIDADES, type Capacidad } from "./catalogo";

/** Un tipo de empleado: un punto de partida, no una jaula.
 *
 * Los roles viven **solo acá, en el frontend**, y no se guardan en
 * ningún lado. Elegir uno precarga interruptores; a partir de ahí el
 * dueño mueve lo que quiera y el rol deja de aplicar. Esa es la
 * diferencia entre "tipo de empleado" y un rol de verdad: acá la fuente
 * de verdad siguen siendo las capacidades de cada membresía.
 *
 * Se decidió así (2026-07-26) para que "su negocio, sus reglas" fuera
 * literal: si el rol se guardara, habría que resolver qué pasa con los
 * empleados ya asignados cuando el rol cambia, y el dueño terminaría
 * peleando con una plantilla en vez de configurando a su gente.
 */
export interface Rol {
  id: string;
  nombre: string;
  descripcion: string;
  capacidades: Capacidad[];
}

export const ROLES: Rol[] = [
  {
    id: "barbero",
    nombre: "Barbero o estilista",
    descripcion: "Atiende y maneja sus propias citas. No ve las de los demás.",
    capacidades: [],
  },
  {
    id: "recepcion",
    nombre: "Recepción",
    descripcion: "Agenda para todo el equipo y cobra. No toca horarios ni precios.",
    capacidades: ["puede_gestionar_agenda", "puede_ver_agenda_completa", "puede_cobrar"],
  },
  {
    id: "encargado",
    nombre: "Encargado",
    descripcion: "Maneja el día a día completo del local, salvo el equipo.",
    capacidades: [
      "puede_cobrar",
      "puede_ver_reportes",
      "puede_editar_precios",
      "puede_gestionar_agenda",
      "puede_ver_agenda_completa",
      "puede_configurar_horarios",
    ],
  },
  {
    id: "administrador",
    nombre: "Administrador",
    descripcion: "Puede hacer todo, incluido dar permisos a otros.",
    capacidades: [...CAPACIDADES],
  },
];

/** Las capacidades de un rol, como objeto listo para mandar al backend. */
export function capacidadesDe(rol: Rol): Record<Capacidad, boolean> {
  return Object.fromEntries(
    CAPACIDADES.map((capacidad) => [capacidad, rol.capacidades.includes(capacidad)]),
  ) as Record<Capacidad, boolean>;
}

/** Qué tipo de empleado es alguien, mirando sus capacidades reales.
 *
 * Como el rol no se guarda, se deduce: se busca el que coincida exacto y,
 * si ninguno lo hace, se reporta el más parecido junto con cuántos
 * interruptores lo separan. Eso permite mostrar "Recepción · 2 cambios"
 * en vez de un "Personalizado" que no dice nada.
 *
 * Empatan por el primero de `ROLES`, que está ordenado de menos a más
 * permisos: ante la duda se describe a alguien por el rol más acotado,
 * que es la lectura prudente.
 */
export function rolDe(miembro: Partial<Record<Capacidad, boolean>>): {
  rol: Rol;
  cambios: number;
} {
  let mejor = { rol: ROLES[0], cambios: Number.POSITIVE_INFINITY };
  for (const rol of ROLES) {
    const cambios = CAPACIDADES.filter(
      (capacidad) => Boolean(miembro[capacidad]) !== rol.capacidades.includes(capacidad),
    ).length;
    if (cambios < mejor.cambios) mejor = { rol, cambios };
  }
  return mejor;
}

/** "Recepción" o "Recepción · 2 cambios", para mostrar de un vistazo. */
export function etiquetaDeRol(miembro: Partial<Record<Capacidad, boolean>>): string {
  const { rol, cambios } = rolDe(miembro);
  if (cambios === 0) return rol.nombre;
  return `${rol.nombre} · ${cambios} ${cambios === 1 ? "cambio" : "cambios"}`;
}
