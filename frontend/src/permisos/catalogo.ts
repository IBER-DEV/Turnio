import type { Capacidad } from "../components/RutaProtegida";

export type { Capacidad };

/** Cómo se le explica cada permiso a quien tiene el negocio.
 *
 * `etiqueta` dice lo que la persona **hace** en el local, no el nombre
 * del campo: "Poner los precios", no "puede_editar_precios". Y
 * `consecuencia` responde la pregunta que sigue siempre —"¿y eso qué
 * significa en la práctica?"— incluyendo, cuando importa, qué pasa si
 * está apagado.
 *
 * El tipo es `Record<Capacidad, …>` a propósito: `Capacidad` se deriva
 * del schema del backend, así que si allá nace una capacidad nueva esto
 * deja de compilar hasta que alguien decida cómo se le explica al
 * usuario. Una capacidad sin traducir sería un interruptor sin nombre.
 */
export const DEFINICIONES: Record<
  Capacidad,
  { etiqueta: string; consecuencia: string; proximamente?: boolean }
> = {
  puede_cobrar: {
    etiqueta: "Cobrarle a los clientes",
    consecuencia: "Recibe pagos y cierra la caja del día.",
    proximamente: true,
  },
  puede_ver_reportes: {
    etiqueta: "Ver cuánto vende el negocio",
    consecuencia: "Ingresos, servicios más pedidos y comisiones.",
    proximamente: true,
  },
  puede_editar_precios: {
    etiqueta: "Poner los precios",
    consecuencia: "Crear servicios y cambiar cuánto cuestan.",
  },
  puede_gestionar_agenda: {
    etiqueta: "Agendar para todo el equipo",
    consecuencia:
      "Crear, mover y cancelar citas de cualquier compañero. Las suyas siempre las puede manejar.",
  },
  puede_ver_agenda_completa: {
    etiqueta: "Ver la agenda completa",
    consecuencia:
      "Si está apagado, solo ve sus propias citas — no los clientes de sus compañeros.",
  },
  puede_configurar_horarios: {
    etiqueta: "Decidir los horarios",
    consecuencia: "A qué hora abre el local y qué días trabaja cada quien.",
  },
  puede_gestionar_empleados: {
    etiqueta: "Agregar gente y dar permisos",
    consecuencia: "Da de alta compañeros y cambia lo que cada uno puede hacer.",
  },
};

/** Los permisos agrupados por área del negocio.
 *
 * Con siete interruptores, la lista plana dejó de escanearse: quien
 * busca "¿puede tocar la plata?" no debería leer los siete. El orden
 * dentro de cada área va de lo más común a lo más delicado.
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
