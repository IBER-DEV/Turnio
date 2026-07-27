import type { Capacidad } from "./catalogo";

/** Por qué un interruptor está bloqueado, o `null` si se puede tocar.
 *
 * Espeja las reglas del backend (`CONTRATO.md` 5.9). No es la barrera de
 * seguridad —el backend responde `400`— pero sin esto la UI ofrece
 * acciones que van a rebotar, que es la peor combinación: el usuario cree
 * que puede y se entera al guardar.
 *
 * Devolver el motivo en vez de un booleano permite explicarlo donde
 * ocurre, que es la mitad del punto de este rediseño.
 */
export function motivoBloqueo({
  capacidad,
  yo,
  objetivo,
  puedoGestionarEquipo,
}: {
  capacidad: Capacidad;
  yo: Partial<Record<Capacidad, boolean>> & { id: number };
  objetivo: Partial<Record<Capacidad, boolean>> & { id: number };
  puedoGestionarEquipo: boolean;
}): string | null {
  if (!puedoGestionarEquipo) {
    return "Necesitas el permiso de agregar gente y dar permisos.";
  }
  if (yo.id === objetivo.id) {
    return "No puedes cambiar tus propios permisos. Pídeselo a alguien más del equipo.";
  }
  // Quitar lo que uno no tiene sí se permite: reducir permisos ajenos no
  // amplía los propios. Solo se bloquea encender.
  if (!yo[capacidad] && !objetivo[capacidad]) {
    return "No puedes dar un permiso que tú no tienes.";
  }
  return null;
}
