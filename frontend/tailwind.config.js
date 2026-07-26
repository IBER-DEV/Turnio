/**
 * **Este archivo es la fuente de verdad del sistema de diseño.**
 *
 * Rediseño 2026-07-26: alineado con la landing page de Turnio.
 * Paleta Indigo + Menta, Plus Jakarta Sans, sombras slate-tinted,
 * radios más generosos. El objetivo es que no haya ruptura visual
 * entre la landing (marketing) y el producto.
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
        background: "#f8fafc",
        surface: "#f8fafc",
        "surface-dim": "#e2e8f0",
        "surface-bright": "#ffffff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f1f5f9",
        "surface-container": "#e2e8f0",
        "surface-container-high": "#cbd5e1",
        "surface-container-highest": "#94a3b8",
        "on-surface": "#334155",
        "on-surface-variant": "#64748b",
        "inverse-surface": "#0f172a",
        "inverse-on-surface": "#f1f5f9",

        primary: "#1e1b4b",
        "on-primary": "#ffffff",
        "primary-container": "#312e81",
        "on-primary-container": "#c7d2fe",
        "inverse-primary": "#a5b4fc",

        secondary: "#10b981",
        "on-secondary": "#ffffff",
        "secondary-container": "#10b981",
        "on-secondary-container": "#ffffff",
        "secondary-hover": "#059669",

        tertiary: "#f59e0b",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#fef3c7",
        "on-tertiary-container": "#92400e",

        error: "#ef4444",
        "on-error": "#ffffff",
        "error-container": "#fef2f2",
        "on-error-container": "#991b1b",

        outline: "#94a3b8",
        "outline-variant": "#e2e8f0",
        "surface-tint": "#64748b",

        menta: "#10b981",
        "menta-oscura": "#059669",
        indigo: "#1e1b4b",
        pizarra: "#0f172a",
        texto: "#334155",
        "texto-suave": "#64748b",

        agendada: "#f59e0b",
        confirmada: "#3b82f6",
        completada: "#10b981",
        cancelada: "#ef4444",
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
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
        "margin-mobile": "1.25rem",
        "margin-desktop": "2.5rem",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        "display-lg": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg": ["Plus Jakarta Sans", "sans-serif"],
        "headline-lg-mobile": ["Plus Jakarta Sans", "sans-serif"],
        "headline-md": ["Plus Jakarta Sans", "sans-serif"],
        "body-lg": ["Plus Jakarta Sans", "sans-serif"],
        "body-md": ["Plus Jakarta Sans", "sans-serif"],
        "label-md": ["Plus Jakarta Sans", "sans-serif"],
        caption: ["Plus Jakarta Sans", "sans-serif"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "700" }],
        "headline-md-mobile": ["20px", { lineHeight: "1.3", fontWeight: "700" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "label-md": ["14px", { lineHeight: "1.4", letterSpacing: "0.02em", fontWeight: "600" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      boxShadow: {
        suave: "0 1px 3px rgba(15, 23, 42, 0.06)",
        card: "0 4px 16px rgba(15, 23, 42, 0.08)",
        "card-soft": "0 2px 8px rgba(15, 23, 42, 0.05)",
        elevada: "0 20px 45px -15px rgba(30, 27, 75, 0.2)",
        nav: "0 -1px 12px rgba(15, 23, 42, 0.06)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "slide-up": {
          from: { transform: "translate(-50%, 100%)" },
          to: { transform: "translate(-50%, 0)" },
        },
        "slide-down": {
          from: { transform: "translate(-50%, 0)" },
          to: { transform: "translate(-50%, 100%)" },
        },
        "zoom-in": {
          from: { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "zoom-out": {
          from: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
          to: { opacity: "0", transform: "translate(-50%, -50%) scale(0.96)" },
        },
        "slide-in-top": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-bottom": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        aparecer: {
          from: { opacity: "0", transform: "translateY(10px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "fade-out": "fade-out 150ms ease-in",
        "slide-up": "slide-up 250ms cubic-bezier(0.32, 0.72, 0, 1)",
        "slide-down": "slide-down 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        "zoom-in": "zoom-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "zoom-out": "zoom-out 150ms ease-in",
        "slide-in-top": "slide-in-top 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in-bottom": "slide-in-bottom 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        aparecer: "aparecer 450ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
