// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Sitio estático con CERO JavaScript de framework.
//
// No hay integración de React a propósito: las dos piezas interactivas
// (el teléfono 3D y el demostrador de permisos) están hechas con
// `<script>` inline sobre marcado que ya llega renderizado. Traer React
// para eso costaba 58 kB gzip de runtime frente a 1,4 kB de script
// propio — en una landing cuyo visitante llega de Google con datos
// móviles, esa diferencia es el LCP.
//
// Si en algún momento hace falta una isla de verdad compleja, se vuelve
// a agregar `@astrojs/react` y se hidrata solo esa.
export default defineConfig({
  vite: { plugins: [tailwindcss()] },
});
