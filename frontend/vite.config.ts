/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

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
