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
    consecuencia:
      "Cobra las cuentas pendientes, abre y cierra la caja del día, y registra los gastos del local.",
  },
  puede_ver_reportes: {
    etiqueta: "Ver cuánto vende el negocio",
    corto: "Ver ventas",
    consecuencia:
      "El histórico de cajas cerradas de cualquier día, sin necesitar poder cobrar. El resto de reportes sigue en camino.",
  },
  puede_editar_precios: {
    etiqueta: "Poner los precios",
    corto: "Precios",
    consecuencia: "Crear servicios y cambiar cuánto cuestan.",
  },
  puede_editar_comisiones: {
    etiqueta: "Definir comisiones",
    corto: "Comisiones",
    consecuencia:
      "Cuánto se lleva cada empleado por cada servicio — no requiere poder cambiar los precios.",
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
  puede_editar_negocio: {
    etiqueta: "Cambiar cómo se ve el negocio",
    corto: "Perfil",
    consecuencia:
      "El nombre, la dirección, el logo y las fotos que ven los clientes en el enlace del negocio.",
  },
  puede_anular_venta: {
    etiqueta: "Anular cuentas y devolver plata",
    corto: "Anular",
    consecuencia:
      "Deshace un cobro ya hecho: devuelve plata al cliente o anula la cuenta completa, siempre con un motivo. Va aparte de cobrar a propósito — cobrar es el día a día, deshacer un cobro conviene que quede en menos manos.",
  },
};

/** Los permisos agrupados por área del negocio.
 *
 * Con diez interruptores, la lista plana dejó de escanearse: quien
 * busca "¿puede tocar la plata?" no debería leerlos todos.
 *
 * "Servicios realizados" era un área propia mientras existió el circuito
 * de validación; con el rediseño del módulo de dinero (2026-08-07) su
 * única capacidad desapareció y la que la reemplaza (`puede_anular_venta`)
 * pertenece de lleno a "Dinero".
 */
export const GRUPOS: Array<{ area: string; capacidades: Capacidad[] }> = [
  {
    area: "Dinero",
    capacidades: [
      "puede_cobrar",
      "puede_ver_reportes",
      "puede_editar_precios",
      "puede_editar_comisiones",
      "puede_anular_venta",
    ],
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
  {
    // Área propia y no dentro de "Equipo": lo que el cliente ve del
    // negocio (nombre, logo, fotos) no es organización interna, y quien
    // administra al equipo no es necesariamente quien decide la cara
    // pública del local.
    area: "Perfil del negocio",
    capacidades: ["puede_editar_negocio"],
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
    descripcion: "Arranca en los cobros pendientes y la agenda del local.",
  },
  operativo: {
    etiqueta: "Operativo",
    descripcion: "Arranca en su día: sus citas y su horario.",
  },
};
