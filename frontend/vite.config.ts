/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Los tests corren con la zona horaria del negocio, no con la de la
// máquina. Varias pruebas del perfil público comparan horas ya
// formateadas ("09:00"), y el backend fija `TIME_ZONE = America/Bogota`:
// sin esto, la suite pasa en un portátil colombiano y falla en CI, que
// corre en UTC. Va en el ámbito del módulo —no en `test.env`— para que
// esté puesta antes de que Node arranque los workers y cachee la zona.
process.env.TZ = "America/Bogota";

// https://vite.dev/config/
export default defineConfig({
  // Tailwind vía plugin de Vite y no PostCSS: es el camino recomendado en
  // v4, es más rápido, y es el que ya usaba `landing/`. Tener los dos
  // proyectos con el mismo pipeline es la mitad de poder compartir tokens.
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // El bundle de Material Symbols no aporta nada en tests y es pesado.
    css: false,
  },
});
