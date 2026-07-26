import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { Button } from "./Button";
import { cn } from "./cn";
import { Icon } from "./Icon";

export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  className,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={abierto} onOpenChange={(open) => !open && onCerrar()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-[60] bg-pizarra/50 backdrop-blur-sm",
            "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
          )}
        />
        <Dialog.Content
          onOpenAutoFocus={(evento) => {
            evento.preventDefault();
            (evento.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            "fixed bottom-0 left-1/2 z-[60] max-h-[90dvh] w-full max-w-[480px] -translate-x-1/2",
            "overflow-y-auto rounded-t-3xl bg-white p-md shadow-elevada safe-bottom",
            "focus:outline-none",
            "sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down",
            "sm:data-[state=open]:animate-zoom-in sm:data-[state=closed]:animate-zoom-out",
            className,
          )}
        >
          <div className="mb-md flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-headline-md text-headline-md text-primary">
                {titulo}
              </Dialog.Title>
              {descripcion ? (
                <Dialog.Description className="mt-1 font-body-md text-body-md text-on-surface-variant">
                  {descripcion}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar"
                className="tactile shrink-0 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
              >
                <Icon name="close" />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalConfirmacion({
  abierto,
  titulo,
  mensaje,
  etiquetaConfirmar = "Confirmar",
  destructivo = true,
  cargando = false,
  onConfirmar,
  onCancelar,
}: {
  abierto: boolean;
  titulo: string;
  mensaje: string;
  etiquetaConfirmar?: string;
  destructivo?: boolean;
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  return (
    <Modal abierto={abierto} onCerrar={onCancelar} titulo={titulo} descripcion={mensaje}>
      <div className="flex flex-col-reverse gap-xs sm:flex-row sm:justify-end">
        <Button variante="ghost" onClick={onCancelar} disabled={cargando}>
          Cancelar
        </Button>
        <Button
          variante={destructivo ? "danger" : "primary"}
          cargando={cargando}
          onClick={onConfirmar}
        >
          {etiquetaConfirmar}
        </Button>
      </div>
    </Modal>
  );
}
