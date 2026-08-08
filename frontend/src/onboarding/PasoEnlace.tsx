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
 * El enlace se arma con `window.location.origin` y no con un dominio
 * fijo: en desarrollo eso lo deja funcionando desde la IP de la red
 * local (probar en un celular es parte del ciclo normal en una app
 * Capacitor), y en producción resuelve al dominio real sin configurar
 * nada.
 */
export function PasoEnlace({ slug, onTerminar }: { slug: string; onTerminar: () => void }) {
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-menta/5 p-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-menta/15">
          <Icon name="link" className="text-[24px] text-menta" />
        </span>
        <p className="break-all font-label-md text-label-md text-primary">{enlace}</p>
      </div>

      <Button icono={copiado ? "check" : "content_copy"} onClick={copiar} anchoCompleto>
        {copiado ? "Copiado" : "Copiar mi enlace"}
      </Button>

      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant p-4">
        <p className="font-label-md text-label-md text-on-surface">Qué hacer con él</p>
        <ul className="flex flex-col gap-2 font-body-md text-body-md text-on-surface-variant">
          <li className="flex items-start gap-2">
            <Icon name="check_circle" className="mt-0.5 shrink-0 text-[16px] text-menta" />
            Pégalo en tu bio de Instagram o WhatsApp Business.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check_circle" className="mt-0.5 shrink-0 text-[16px] text-menta" />
            Mándaselo a un cliente en vez de coordinar la cita por chat.
          </li>
          <li className="flex items-start gap-2">
            <Icon name="check_circle" className="mt-0.5 shrink-0 text-[16px] text-menta" />
            Tus clientes reservan sin descargar nada ni crear una cuenta.
          </li>
        </ul>
      </div>

      <Button variante="secondary" onClick={onTerminar} anchoCompleto>
        Ir a mi negocio
      </Button>
    </div>
  );
}
