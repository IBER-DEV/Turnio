/**
 * **Este archivo es la fuente de verdad del sistema de diseño.**
 *
 * Los tokens se extrajeron de los mockups de UI/UX que se generaron a
 * partir de `diseno-ui-ux-prompt.md`; esos mockups ya se borraron del
 * repo a propósito, una vez volcados acá, para no mantener dos copias
 * del mismo sistema que se desincronizarían.
 *
 * Regla: no inventar valores sueltos en los componentes. Si hace falta
 * un color, espaciado o tamaño que no está, se agrega acá con nombre
 * semántico y se usa por ese nombre — nunca un `#hex` o un `[13px]`
 * incrustado en un `className`.
 */
import tailwindcssAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f8f9ff",
        "surface-dim": "#cbdbf5",
        "surface-bright": "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#45474c",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",
        outline: "#75777d",
        "outline-variant": "#c5c6cd",
        "surface-tint": "#545f73",
        primary: "#091426",
        "on-primary": "#ffffff",
        "primary-container": "#1e293b",
        "on-primary-container": "#8590a6",
        "inverse-primary": "#bcc7de",
        secondary: "#904d00",
        "on-secondary": "#ffffff",
        "secondary-container": "#fe932c",
        "on-secondary-container": "#663500",
        tertiary: "#330002",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#5a0007",
        "on-tertiary-container": "#ff524f",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "primary-fixed": "#d8e3fb",
        "primary-fixed-dim": "#bcc7de",
        "on-primary-fixed": "#111c2d",
        "on-primary-fixed-variant": "#3c475a",
        "secondary-fixed": "#ffdcc3",
        "secondary-fixed-dim": "#ffb77d",
        "on-secondary-fixed": "#2f1500",
        "on-secondary-fixed-variant": "#6e3900",
        "tertiary-fixed": "#ffdad7",
        "tertiary-fixed-dim": "#ffb3ad",
        "on-tertiary-fixed": "#410004",
        "on-tertiary-fixed-variant": "#930013",
        background: "#f8f9ff",
        "on-background": "#0b1c30",
        "surface-variant": "#d3e4fe",
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px",
      },
      spacing: {
        base: "4px",
        xs: "0.5rem",
        sm: "1rem",
        md: "1.5rem",
        lg: "2rem",
        xl: "3rem",
        gutter: "1rem",
        "margin-mobile": "1rem",
        "margin-desktop": "2.5rem",
      },
      fontFamily: {
        "display-lg": ["Montserrat", "sans-serif"],
        "headline-lg": ["Montserrat", "sans-serif"],
        "headline-lg-mobile": ["Montserrat", "sans-serif"],
        "headline-md": ["Montserrat", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "label-md": ["Inter", "sans-serif"],
        caption: ["Inter", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        "headline-lg-mobile": ["24px", { lineHeight: "1.2", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "headline-md-mobile": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "1.4", letterSpacing: "0.05em", fontWeight: "600" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      boxShadow: {
        // Nivel 2 del sistema de elevación: sombra media con tinte azul
        // del primario, en vez de un gris neutro.
        card: "0 4px 12px rgba(33, 49, 69, 0.08)",
        "card-soft": "0 4px 12px rgba(33, 49, 69, 0.05)",
        nav: "0 -1px 12px rgba(33, 49, 69, 0.08)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        // Hoja inferior en móvil.
        "slide-up": {
          from: { transform: "translate(-50%, 100%)" },
          to: { transform: "translate(-50%, 0)" },
        },
        "slide-down": {
          from: { transform: "translate(-50%, 0)" },
          to: { transform: "translate(-50%, 100%)" },
        },
        // Diálogo centrado en escritorio.
        "zoom-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "zoom-out": {
          from: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          to: { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
        },
        // Entrada de toasts y de filas de lista.
        "slide-in-top": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-bottom": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        // Curvas cortas: el objetivo es dar continuidad espacial, no
        // hacer esperar. Nada por encima de 250ms en interacciones.
        "fade-in": "fade-in 150ms ease-out",
        "fade-out": "fade-out 150ms ease-in",
        "slide-up": "slide-up 250ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-down": "slide-down 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        "zoom-in": "zoom-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "zoom-out": "zoom-out 150ms ease-in",
        "slide-in-top": "slide-in-top 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-bottom": "slide-in-bottom 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
