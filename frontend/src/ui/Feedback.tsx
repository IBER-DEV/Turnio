import type { ReactNode } from "react";

import { cn } from "./cn";
import { Button } from "./Button";
import { Icon } from "./Icon";

/** Tarjeta base: superficie blanca + borde suave (nivel 1 de elevación). */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-lowest",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Badge "soft pill": fondo de baja opacidad + texto de alto contraste. */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-pulse rounded", className)} />;
}

/** Skeleton de lista: 3 filas con avatar + dos líneas (diseño del
 * dashboard). Se usa en cualquier pantalla que cargue una lista. */
export function SkeletonLista({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }).map((_, indice) => (
        <div
          key={indice}
          className="flex items-center gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4"
        >
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2 opacity-60" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Estado vacío: icono en terracota, mensaje y acción sugerida
 * (DESIGN.md § Empty States). */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  accion?: { etiqueta: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-md rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50 px-md py-xl text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary-fixed">
        <Icon name={icono} className="text-[32px] text-secondary" />
      </span>
      <div className="space-y-1">
        <h3 className="font-headline-md text-headline-md-mobile text-primary">{titulo}</h3>
        <p className="mx-auto max-w-sm font-body-md text-body-md text-on-surface-variant">
          {descripcion}
        </p>
      </div>
      {accion && (
        <Button icono="add" onClick={accion.onClick}>
          {accion.etiqueta}
        </Button>
      )}
    </div>
  );
}

/** Estado de error con reintento: mensaje específico, no un texto rojo
 * suelto (ver plan-accion.md § 0.3). */
export function EstadoError({
  mensaje,
  onReintentar,
}: {
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-md rounded-2xl border border-error/30 bg-error-container/40 px-md py-lg text-center"
    >
      <Icon name="error" className="text-[32px] text-error" />
      <p className="font-body-md text-body-md text-on-error-container">{mensaje}</p>
      {onReintentar && (
        <Button variante="secondary" icono="refresh" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
