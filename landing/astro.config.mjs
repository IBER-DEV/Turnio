// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Sitio estático: la landing no necesita servidor. Astro envía cero JS
// por defecto y solo hidrata las dos islas interactivas (demo del
// teléfono y matriz de permisos), que es justo lo contrario a la SPA
// del panel — ver `../frontend/CLAUDE.md` para por qué viven separadas.
export default defineConfig({
  integrations: [react()],
  vite: { plugins: [tailwindcss()] },
});
