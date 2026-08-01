import type { ServicioInput } from "../api/types";

/** Catálogo semilla de servicios, para que un negocio nuevo no arranque
 * con una pantalla vacía y tenga que teclear su carta entera.
 *
 * Se investigó (2026-07-25) si existía una API pública de catálogo de
 * servicios de barbería/salón para no mantener esto a mano: **no
 * existe**. Lo único disponible son APIs propietarias de plataformas
 * competidoras (Vagaro, Phorest), que no son usables acá. Mantenerlo
 * como dato local además tiene dos ventajas: los nombres son los que se
 * usan en Colombia (no traducciones del inglés) y los precios están en
 * COP con órdenes de magnitud realistas.
 *
 * Son **valores de arranque, no verdad**: el usuario los edita al
 * agregarlos y después desde la pantalla de Servicios. Los precios son
 * referencias de mercado medio y envejecen — si alguien reporta que
 * están muy lejos de la realidad, se actualizan acá y ya. */
export interface ServicioSugerido {
  nombre: string;
  categoria: string;
  /** En COP, sin separadores. */
  precio: string;
  duracion_minutos: number;
  descripcion: string;
  imagen?: string;
}

export const CATEGORIAS_CATALOGO = [
  "Barbería",
  "Peluquería",
  "Uñas",
  "Estética",
] as const;

export const IMAGENES_CATEGORIA_DEFAULT: Record<string, string> = {
  Barbería: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80",
  Peluquería: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=600&q=80",
  Uñas: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80",
  Estética: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80",
};

export function obtenerImagenServicio(servicio: { nombre: string; categoria?: string; imagen?: string }): string {
  if (servicio.imagen) return servicio.imagen;
  const nombreNorm = servicio.nombre.toLowerCase();
  
  if (nombreNorm.includes("barba") || nombreNorm.includes("afeitado") || nombreNorm.includes("delineado")) {
    return "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("corte") && (servicio.categoria === "Barbería" || nombreNorm.includes("niño") || nombreNorm.includes("máquina"))) {
    return "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("tinte") || nombreNorm.includes("mechas") || nombreNorm.includes("balayage") || nombreNorm.includes("canas")) {
    return "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("cepillado") || nombreNorm.includes("peinado") || nombreNorm.includes("keratina")) {
    return "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("pedicure")) {
    return "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("manicure") || nombreNorm.includes("uñas") || nombreNorm.includes("esmaltado")) {
    return "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("cejas") || nombreNorm.includes("pestañas")) {
    return "https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("masaje")) {
    return "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80";
  }
  if (nombreNorm.includes("facial") || nombreNorm.includes("limpieza") || nombreNorm.includes("depilación")) {
    return "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80";
  }

  if (servicio.categoria && IMAGENES_CATEGORIA_DEFAULT[servicio.categoria]) {
    return IMAGENES_CATEGORIA_DEFAULT[servicio.categoria];
  }
  return IMAGENES_CATEGORIA_DEFAULT.Barbería;
}

export const CATALOGO_SERVICIOS: ServicioSugerido[] = [
  // --- Barbería ---
  {
    nombre: "Corte de cabello",
    categoria: "Barbería",
    precio: "25000",
    duracion_minutos: 30,
    descripcion: "Corte clásico con tijera y máquina.",
  },
  {
    nombre: "Corte + barba",
    categoria: "Barbería",
    precio: "35000",
    duracion_minutos: 45,
    descripcion: "Corte completo con perfilado de barba.",
  },
  {
    nombre: "Perfilado de barba",
    categoria: "Barbería",
    precio: "15000",
    duracion_minutos: 20,
    descripcion: "Delineado y arreglo de barba.",
  },
  {
    nombre: "Afeitado con toalla caliente",
    categoria: "Barbería",
    precio: "20000",
    duracion_minutos: 30,
    descripcion: "Afeitado clásico a navaja con toalla caliente.",
  },
  {
    nombre: "Corte a máquina",
    categoria: "Barbería",
    precio: "18000",
    duracion_minutos: 20,
    descripcion: "Corte rápido a una sola altura.",
  },
  {
    nombre: "Corte niño",
    categoria: "Barbería",
    precio: "20000",
    duracion_minutos: 30,
    descripcion: "Corte para menores de 12 años.",
  },
  {
    nombre: "Line up / delineado",
    categoria: "Barbería",
    precio: "10000",
    duracion_minutos: 15,
    descripcion: "Retoque de contornos entre cortes.",
  },
  {
    nombre: "Camuflaje de canas",
    categoria: "Barbería",
    precio: "45000",
    duracion_minutos: 60,
    descripcion: "Coloración para difuminar canas.",
  },

  // --- Peluquería ---
  {
    nombre: "Corte dama",
    categoria: "Peluquería",
    precio: "35000",
    duracion_minutos: 45,
    descripcion: "Corte y terminado.",
  },
  {
    nombre: "Cepillado",
    categoria: "Peluquería",
    precio: "30000",
    duracion_minutos: 45,
    descripcion: "Lavado y cepillado con secador.",
  },
  {
    nombre: "Tinte de raíz",
    categoria: "Peluquería",
    precio: "70000",
    duracion_minutos: 90,
    descripcion: "Retoque de color en raíz.",
  },
  {
    nombre: "Mechas / balayage",
    categoria: "Peluquería",
    precio: "180000",
    duracion_minutos: 180,
    descripcion: "Decoloración por mechones y matizado.",
  },
  {
    nombre: "Keratina",
    categoria: "Peluquería",
    precio: "150000",
    duracion_minutos: 120,
    descripcion: "Alisado y tratamiento con keratina.",
  },
  {
    nombre: "Hidratación capilar",
    categoria: "Peluquería",
    precio: "45000",
    duracion_minutos: 45,
    descripcion: "Tratamiento de hidratación profunda.",
  },
  {
    nombre: "Peinado de evento",
    categoria: "Peluquería",
    precio: "60000",
    duracion_minutos: 60,
    descripcion: "Recogido o peinado para ocasión especial.",
  },

  // --- Uñas ---
  {
    nombre: "Manicure tradicional",
    categoria: "Uñas",
    precio: "20000",
    duracion_minutos: 40,
    descripcion: "Limpieza, limado y esmaltado.",
  },
  {
    nombre: "Pedicure tradicional",
    categoria: "Uñas",
    precio: "25000",
    duracion_minutos: 50,
    descripcion: "Limpieza, limado y esmaltado de pies.",
  },
  {
    nombre: "Semipermanente manos",
    categoria: "Uñas",
    precio: "35000",
    duracion_minutos: 60,
    descripcion: "Esmaltado semipermanente con cabina.",
  },
  {
    nombre: "Uñas acrílicas",
    categoria: "Uñas",
    precio: "70000",
    duracion_minutos: 120,
    descripcion: "Aplicación de uñas esculpidas en acrílico.",
  },
  {
    nombre: "Retiro de esmaltado",
    categoria: "Uñas",
    precio: "10000",
    duracion_minutos: 20,
    descripcion: "Retiro de semipermanente o acrílico.",
  },

  // --- Estética ---
  {
    nombre: "Limpieza facial profunda",
    categoria: "Estética",
    precio: "60000",
    duracion_minutos: 60,
    descripcion: "Extracción, exfoliación y mascarilla.",
  },
  {
    nombre: "Diseño de cejas",
    categoria: "Estética",
    precio: "15000",
    duracion_minutos: 20,
    descripcion: "Depilación y diseño de cejas.",
  },
  {
    nombre: "Cejas con henna",
    categoria: "Estética",
    precio: "30000",
    duracion_minutos: 45,
    descripcion: "Diseño y tinte de cejas con henna.",
  },
  {
    nombre: "Pestañas pelo a pelo",
    categoria: "Estética",
    precio: "90000",
    duracion_minutos: 120,
    descripcion: "Extensión de pestañas una a una.",
  },
  {
    nombre: "Depilación axilas",
    categoria: "Estética",
    precio: "15000",
    duracion_minutos: 20,
    descripcion: "Depilación con cera.",
  },
  {
    nombre: "Depilación piernas",
    categoria: "Estética",
    precio: "40000",
    duracion_minutos: 45,
    descripcion: "Depilación completa con cera.",
  },
  {
    nombre: "Masaje relajante",
    categoria: "Estética",
    precio: "70000",
    duracion_minutos: 60,
    descripcion: "Masaje corporal de relajación.",
  },
];

/** Convierte una sugerencia del catálogo en el body que espera
 * `POST /api/servicios/`. La comisión queda en 0: depende del acuerdo
 * de cada negocio con su equipo, no hay default sensato. */
export function sugerenciaAServicio(sugerido: ServicioSugerido): ServicioInput {
  return {
    nombre: sugerido.nombre,
    descripcion: sugerido.descripcion,
    categoria: sugerido.categoria,
    precio: sugerido.precio,
    duracion_minutos: sugerido.duracion_minutos,
    porcentaje_comision: "0",
    activo: true,
  };
}
