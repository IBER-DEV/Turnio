import type { ReactNode } from "react";

import { cn } from "./cn";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { NombreIcono } from "./Icon";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-outline-variant bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-pulse rounded-lg", className)} />;
}

export function SkeletonLista({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      {Array.from({ length: filas }).map((_, indice) => (
        <div
          key={indice}
          className="flex items-center gap-4 rounded-2xl border border-outline-variant/40 bg-white p-4"
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

export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  accionSecundaria,
}: {
  icono: NombreIcono;
  titulo: string;
  descripcion: string;
  accion?: { etiqueta: string; onClick: () => void };
  accionSecundaria?: { etiqueta: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-md rounded-2xl border border-dashed border-outline-variant bg-surface-container-low/50 px-md py-xl text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-menta/10">
        <Icon name={icono} className="text-[32px] text-menta" />
      </span>
      <div className="space-y-1">
        <h3 className="font-headline-md text-headline-md-mobile text-primary">{titulo}</h3>
        <p className="mx-auto max-w-sm font-body-md text-body-md text-on-surface-variant">
          {descripcion}
        </p>
      </div>
      {(accion || accionSecundaria) && (
        <div className="flex flex-col gap-xs sm:flex-row">
          {accion && (
            <Button icono="add" onClick={accion.onClick}>
              {accion.etiqueta}
            </Button>
          )}
          {accionSecundaria && (
            <Button variante="ghost" onClick={accionSecundaria.onClick}>
              {accionSecundaria.etiqueta}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

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
      className="flex flex-col items-center gap-md rounded-2xl border border-error/20 bg-error-container px-md py-lg text-center"
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
