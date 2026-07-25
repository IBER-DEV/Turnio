import { useEffect, useRef, useState } from "react";

/**
 * Pantalla simulada de la agenda de Turnio, con la máquina de estados
 * real corriendo en bucle.
 *
 * Todo lo de acá adentro usa los tokens `app-*` (los de
 * `../frontend/tailwind.config.js`), no la paleta de marketing: quien
 * mira esto tiene que reconocer la app cuando se registre.
 *
 * Las transiciones respetan la máquina de estados del backend
 * (`TRANSICIONES_VALIDAS` en `apps/agenda/services.py`):
 *   agendada   → confirmada | cancelada
 *   confirmada → completada | cancelada
 *   completada → (nada, terminal)
 *   cancelada  → (nada, terminal)
 * Por eso la demo nunca muestra "Completar" sobre una cita agendada:
 * sería una acción que el producto real rechaza con 400.
 */

type Estado = "agendada" | "confirmada" | "completada";

const ESTILO_ESTADO: Record<
  Estado,
  { etiqueta: string; bloque: string; borde: string; badge: string; titulo: string }
> = {
  agendada: {
    etiqueta: "Agendada",
    bloque: "bg-app-surface-variant",
    borde: "border-app-primary-fixed-dim",
    badge: "bg-app-surface-variant text-app-primary-fixed-dim",
    titulo: "text-app-primary",
  },
  confirmada: {
    etiqueta: "Confirmada",
    bloque: "bg-app-secondary-fixed/40",
    borde: "border-app-secondary-container",
    badge: "bg-app-secondary-fixed text-app-on-secondary-fixed-variant",
    titulo: "text-app-on-secondary-fixed",
  },
  completada: {
    etiqueta: "Completada",
    bloque: "bg-green-50",
    borde: "border-green-500",
    badge: "bg-green-100 text-green-700",
    titulo: "text-green-900",
  },
};

/** Acciones válidas desde cada estado, igual que en el panel real. */
const SIGUIENTE: Record<Estado, { accion: string; estado: Estado } | null> = {
  agendada: { accion: "Confirmar", estado: "confirmada" },
  confirmada: { accion: "Completar", estado: "completada" },
  completada: null,
};

export function TelefonoDemo() {
  const [estado, setEstado] = useState<Estado>("agendada");
  const [pulsando, setPulsando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // La demo solo arranca cuando el teléfono está a la vista: animar algo
  // que nadie está mirando solo gasta batería.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    const observador = new IntersectionObserver(
      ([entrada]) => setCorriendo(entrada.isIntersecting),
      { threshold: 0.4 },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  useEffect(() => {
    if (!corriendo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const siguiente = SIGUIENTE[estado];
    // Al llegar al final se deja ver el resultado y se reinicia el ciclo.
    const espera = siguiente ? 2200 : 2800;

    const temporizador = setTimeout(() => {
      if (!siguiente) {
        setEstado("agendada");
        return;
      }
      setPulsando(true);
      setTimeout(() => {
        setEstado(siguiente.estado);
        setPulsando(false);
      }, 320);
    }, espera);

    return () => clearTimeout(temporizador);
  }, [estado, corriendo]);

  const estilo = ESTILO_ESTADO[estado];
  const siguiente = SIGUIENTE[estado];

  return (
    <div ref={contenedor} className="relative mx-auto w-full max-w-[300px]">
      {/* Halo de marca detrás del equipo */}
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-full bg-menta/20 blur-3xl"
      ></div>

      {/* Carcasa */}
      <div className="rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 shadow-elevada">
        <div className="relative overflow-hidden rounded-[2rem] bg-app-surface">
          {/* Notch */}
          <div className="absolute left-1/2 top-0 z-20 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-slate-900"></div>

          {/* Barra superior de la app */}
          <div className="flex items-center gap-2.5 bg-app-surface px-4 pb-3 pt-7">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-app-primary bg-app-surface-highest text-[11px] font-bold text-app-primary">
              MG
            </span>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-medium text-app-on-surface-variant">
                Barbería El Corte Real
              </p>
              <p className="truncate text-[13px] font-extrabold tracking-tight text-app-primary">
                Hola, Mateo
              </p>
            </div>
          </div>

          {/* Selector de día */}
          <div className="flex gap-1.5 px-4 pb-3">
            {["LUN", "MAR", "MIÉ"].map((dia, indice) => (
              <div
                key={dia}
                className={`flex h-11 flex-1 flex-col items-center justify-center rounded-lg border text-[8px] font-bold ${
                  indice === 0
                    ? "border-app-primary bg-app-primary text-app-on-primary"
                    : "border-app-outline-variant bg-app-surface-lowest text-app-on-surface"
                }`}
              >
                <span className="opacity-70">{dia}</span>
                <span className="text-[13px] font-extrabold">{24 + indice}</span>
              </div>
            ))}
          </div>

          {/* Cita en vivo */}
          <div className="min-h-[188px] px-4 pb-5">
            <div className="flex gap-2">
              <span className="w-9 shrink-0 pt-2.5 text-right text-[9px] font-semibold text-app-on-surface-variant opacity-70">
                3:30
              </span>

              <div
                className={`flex-1 rounded-lg border-l-4 p-2.5 transition-all duration-500 ${estilo.bloque} ${estilo.borde}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`truncate text-[11px] font-bold ${estilo.titulo}`}>
                      Corte + Barba
                    </p>
                    <p className="truncate text-[9px] text-app-on-surface-variant">
                      Andrés Rojas · Mateo G.
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide transition-colors duration-500 ${estilo.badge}`}
                  >
                    {estilo.etiqueta}
                  </span>
                </div>

                <div className="mt-2.5 border-t border-app-outline-variant/40 pt-2.5">
                  {siguiente ? (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        className={`flex-1 rounded-md px-2 py-1.5 text-[9px] font-bold transition-transform duration-200 ${
                          pulsando ? "scale-95" : "scale-100"
                        } bg-app-secondary-container text-app-on-secondary-fixed-variant`}
                      >
                        {siguiente.accion}
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-hidden="true"
                        className="rounded-md border border-app-error px-2 py-1.5 text-[9px] font-bold text-app-error"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1 text-[9px] font-semibold text-green-700">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                        <path
                          fillRule="evenodd"
                          d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
                          clipRule="evenodd"></path>
                      </svg>
                      Servicio completado
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Cita de fondo, para que no se vea una agenda vacía */}
            <div className="mt-2 flex gap-2 opacity-50">
              <span className="w-9 shrink-0 pt-2.5 text-right text-[9px] font-semibold text-app-on-surface-variant">
                4:15
              </span>
              <div className="flex-1 rounded-lg border-l-4 border-app-primary-fixed-dim bg-app-surface-variant p-2.5">
                <p className="truncate text-[11px] font-bold text-app-primary">Corte clásico</p>
                <p className="truncate text-[9px] text-app-on-surface-variant">
                  Julián Pérez · Cualquiera disponible
                </p>
              </div>
            </div>
          </div>

          {/* Barra inferior */}
          <div className="flex items-center justify-around border-t border-app-outline-variant bg-app-surface px-3 py-2">
            {["Inicio", "Agenda", "Servicios", "Equipo"].map((etiqueta, indice) => (
              <span
                key={etiqueta}
                className={`rounded-xl px-2 py-1 text-[8px] font-bold ${
                  indice === 1
                    ? "bg-app-primary-fixed text-app-primary"
                    : "text-app-on-surface-variant"
                }`}
              >
                {etiqueta}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Dedo simulado: aparece justo cuando "toca" el botón */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-[38%] left-1/2 h-10 w-10 rounded-full border-2 border-menta bg-menta/30 transition-all duration-300 ${
          pulsando ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      ></div>

      <p className="sr-only">
        Demostración animada: una cita pasa de agendada a confirmada y luego a completada.
      </p>
    </div>
  );
}
