import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { Button } from "./Button";
import { Icon } from "./Icon";

/** Modal accesible: cierra con Escape, bloquea el scroll de fondo y
 * mueve el foco dentro al abrirse. */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function alPresionarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }

    document.addEventListener("keydown", alPresionarTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    contenedor.current?.focus();

    return () => {
      document.removeEventListener("keydown", alPresionarTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-primary/40 p-0 backdrop-blur-sm sm:items-center sm:p-margin-mobile">
      {/* Capa de cierre al tocar fuera. El contenido va aparte para que
          el click dentro no burbujee hasta acá. */}
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onCerrar}
      />
      <div
        ref={contenedor}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}
        className="relative z-10 max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-surface-container-lowest p-md shadow-card safe-bottom sm:rounded-2xl"
      >
        <div className="mb-md flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-titulo" className="font-headline-md text-headline-md text-primary">
              {titulo}
            </h2>
            {descripcion && (
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Confirmación explícita para acciones destructivas o irreversibles
 * (cancelar una cita, desactivar un empleado, borrar un horario). */
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
