import { Drawer } from "vaul";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "./cn";

/** Bottom sheet arrastrable, sobre Vaul.
 *
 * No es lo mismo que `Modal`: `Modal` (Radix Dialog) ya *parece* una
 * hoja en móvil por CSS (`animate-slide-up`), pero se cierra con un
 * botón o el fondo — no se puede arrastrar. Vaul construye encima del
 * mismo Radix Dialog y agrega el gesto real: arrastrar hacia abajo para
 * cerrar, con rubber-banding. Es el idioma nativo de un bottom sheet en
 * un teléfono, que es donde vive esta pantalla.
 *
 * Se usa para flujos donde ese gesto importa (reservar, en el perfil
 * público). Los formularios de gestión del panel siguen en `Modal`: ahí
 * el usuario es staff en un escritorio la mitad del tiempo, y arrastrar
 * no es el gesto esperado.
 */
export function Hoja({
  abierta,
  onCerrar,
  titulo,
  descripcion,
  children,
  className,
  style,
}: {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  className?: string;
  /** Variables CSS para el contenido de la hoja.
   *
   * Hace falta porque Vaul monta la hoja en un **portal**, colgada del
   * `body`: queda fuera del árbol del perfil público y por lo tanto
   * fuera del alcance del color que ese contenedor declara. Sin esto, la
   * hoja de reserva sería la única parte del perfil con el color de
   * Turnio en vez del color del negocio. */
  style?: CSSProperties;
}) {
  return (
    <Drawer.Root open={abierta} onOpenChange={(open) => !open && onCerrar()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-60 bg-pizarra/50 backdrop-blur-xs" />
        <Drawer.Content
          style={style}
          className={cn(
            "fixed inset-x-0 bottom-0 z-60 flex max-h-[92dvh] flex-col",
            "rounded-t-3xl bg-white shadow-elevada outline-hidden safe-bottom",
            "mx-auto w-full sm:max-w-120",
            className,
          )}
        >
          <Drawer.Handle className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-outline-variant" />
          <div className="flex items-start justify-between gap-4 px-6 pt-4">
            <div>
              <Drawer.Title className="font-headline-md text-headline-md text-primary">
                {titulo}
              </Drawer.Title>
              {descripcion ? (
                <Drawer.Description className="mt-1 font-body-md text-body-md text-on-surface-variant">
                  {descripcion}
                </Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{titulo}</Drawer.Description>
              )}
            </div>
          </div>
          <div className="overflow-y-auto px-6 pb-6 pt-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
