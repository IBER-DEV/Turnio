import type { components } from "../api/schema";

type Cargo = components["schemas"]["Cargo"];

/** Los flags `puede_*` de un cargo, derivados del schema del backend. */
export type Capacidad = Extract<keyof Cargo, `puede_${string}`>;

/** El discriminador de dominio que manda el backend (`mi-membresia.tipo`). */
export type TipoDeUsuario = components["schemas"]["TipoEnum"];

/** Cómo se le explica cada permiso a quien tiene el negocio.
 *
 * `etiqueta` dice lo que la persona **hace** en el local, no el nombre
 * del campo: "Poner los precios", no "puede_editar_precios".
 * `consecuencia` responde la pregunta que sigue siempre —"¿y eso qué
 * significa en la práctica?"— incluyendo, cuando importa, qué pasa si
 * está apagado. Y `corto` es una o dos palabras para los resúmenes,
 * donde la etiqueta completa no cabe y no hace falta.
 *
 * El tipo es `Record<Capacidad, …>` a propósito: `Capacidad` se deriva
 * del schema, así que si el backend agrega una capacidad esto deja de
 * compilar hasta que alguien decida cómo se le explica al usuario. Una
 * capacidad sin traducir sería un interruptor sin nombre.
 */
export const DEFINICIONES: Record<
  Capacidad,
  { etiqueta: string; corto: string; consecuencia: string; proximamente?: boolean }
> = {
  puede_cobrar: {
    etiqueta: "Cobrarle a los clientes",
    corto: "Cobrar",
    consecuencia: "Recibe pagos y cierra la caja del día.",
    proximamente: true,
  },
  puede_ver_reportes: {
    etiqueta: "Ver cuánto vende el negocio",
    corto: "Ver ventas",
    consecuencia: "Ingresos, servicios más pedidos y comisiones.",
    proximamente: true,
  },
  puede_editar_precios: {
    etiqueta: "Poner los precios",
    corto: "Precios",
    consecuencia: "Crear servicios y cambiar cuánto cuestan.",
  },
  puede_gestionar_agenda: {
    etiqueta: "Agendar para todo el equipo",
    corto: "Agendar",
    consecuencia:
      "Crear, mover y cancelar citas de cualquier compañero. Las suyas siempre las puede manejar.",
  },
  puede_ver_agenda_completa: {
    etiqueta: "Ver la agenda completa",
    corto: "Agenda completa",
    consecuencia:
      "Si está apagado, solo ve sus propias citas — no los clientes de sus compañeros.",
  },
  puede_configurar_horarios: {
    etiqueta: "Decidir los horarios",
    corto: "Horarios",
    consecuencia: "A qué hora abre el local y qué días trabaja cada quien.",
  },
  puede_gestionar_empleados: {
    etiqueta: "Agregar gente y dar permisos",
    corto: "Equipo",
    consecuencia: "Da de alta compañeros y define los cargos del negocio.",
  },
};

/** Los permisos agrupados por área del negocio.
 *
 * Con siete interruptores, la lista plana dejó de escanearse: quien
 * busca "¿puede tocar la plata?" no debería leer los siete.
 */
export const GRUPOS: Array<{ area: string; capacidades: Capacidad[] }> = [
  {
    area: "Dinero",
    capacidades: ["puede_cobrar", "puede_ver_reportes", "puede_editar_precios"],
  },
  {
    area: "Agenda",
    capacidades: [
      "puede_gestionar_agenda",
      "puede_ver_agenda_completa",
      "puede_configurar_horarios",
    ],
  },
  {
    area: "Equipo",
    capacidades: ["puede_gestionar_empleados"],
  },
];

/** Todas las capacidades, en el orden en que se muestran. */
export const CAPACIDADES: Capacidad[] = GRUPOS.flatMap((grupo) => grupo.capacidades);

/** Cómo se le presenta al dueño cada tipo de usuario al crear un cargo. */
export const TIPOS: Record<TipoDeUsuario, { etiqueta: string; descripcion: string }> = {
  administracion: {
    etiqueta: "Administración",
    descripcion: "Entra a la consola completa del negocio.",
  },
  recepcion: {
    etiqueta: "Recepción",
    descripcion: "Arranca en la agenda del local y la caja del día.",
  },
  operativo: {
    etiqueta: "Operativo",
    descripcion: "Arranca en su día: sus citas y su horario.",
  },
};
