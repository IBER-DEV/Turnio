import { useState } from "react";

import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** El final del onboarding: su enlace.
 *
 * Es el paso que le da sentido a los tres anteriores. Todo el MVP existe
 * para reemplazar "llámame o escríbeme por WhatsApp" por un enlace que el
 * dueño pega en su bio de Instagram, así que terminar el onboarding en un
 * panel vacío sería enterrar lo único que hay que hacer con el producto
 * el primer día.
 *
 * Como la pantalla de bienvenida, se compone entera y va fuera del marco
 * del wizard: acá no se pide nada, se celebra y se entrega una cosa. Por
 * eso no lleva barra de progreso —el progreso ya terminó— y el botón vive
 * pegado abajo en vez de al final del contenido.
 *
 * El enlace se arma con `window.location.origin` y no con un dominio
 * fijo: en desarrollo eso lo deja funcionando desde la IP de la red
 * local (probar en un celular es parte del ciclo normal en una app
 * Capacitor), y en producción resuelve al dominio real sin configurar
 * nada.
 */
export function PasoEnlace({
  slug,
  nombre,
  onTerminar,
}: {
  slug: string;
  nombre: string;
  onTerminar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const enlace = `${window.location.origin}/${slug}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // `navigator.clipboard` falla sin HTTPS o sin permiso del usuario
      // —el caso normal al probar por IP en el celular—. No es un error
      // que valga interrumpir: el enlace está a la vista y se puede
      // seleccionar a mano, así que solo no se confirma el copiado.
      setCopiado(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background">
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {/* El visto. Dos círculos concéntricos y un tercero que late
            detrás — el halo es lo que lo convierte en un momento y no en
            un icono de estado. El bloque global de `prefers-reduced-
            motion` de `index.css` apaga las tres animaciones de esta
            pantalla sin que haya que repetirlo acá. */}
        <div className="mb-8 animate-zoom-in">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-menta/20">
            <div
              className="absolute inset-0 animate-ping rounded-full bg-menta/10"
              style={{ animationDuration: "3s" }}
              aria-hidden
            />
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-menta text-white">
              <Icon name="check" filled className="text-[40px]" />
            </div>
          </div>
        </div>

        <div className="mb-10 animate-slide-up text-center">
          <h1 className="mb-3 font-headline-lg text-headline-lg-mobile text-on-surface">
            ¡Todo listo, {nombre.split(" ")[0]}!
          </h1>
          <p className="mx-auto max-w-[280px] font-body-md text-body-md text-on-surface-variant">
            Tu negocio está configurado y listo para recibir reservas.
          </p>
        </div>

        <div className="w-full animate-slide-up rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-5 shadow-sm">
          <h2 className="mb-3 font-caption text-caption font-semibold uppercase tracking-wide text-on-surface-variant">
            Tu enlace de reservas
          </h2>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-3">
              <p className="truncate font-body-md text-body-md text-menta">{enlace}</p>
            </div>
            <button
              type="button"
              onClick={copiar}
              aria-label={copiado ? "Enlace copiado" : "Copiar enlace"}
              className="tactile flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-high text-on-surface-variant transition-colors hover:bg-surface-container-highest/40"
            >
              <Icon name={copiado ? "check" : "content_copy"} className="text-[22px]" />
            </button>
          </div>
        </div>
      </main>

      {/* El botón vive pegado al borde inferior y fuera del scroll: es la
          única salida de esta pantalla, y tiene que estar bajo el pulgar
          sin importar cuánto mida el teléfono. */}
      <div className="w-full animate-slide-up bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Button tamano="lg" anchoCompleto onClick={onTerminar} className="h-14">
          Ir a mi negocio
        </Button>
      </div>
    </div>
  );
}
