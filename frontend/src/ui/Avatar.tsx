import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "./cn";

type Tamano = "sm" | "md" | "lg";
type Forma = "circular" | "cuadrado";

const TAMANOS: Record<Tamano, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-label-md",
  lg: "h-12 w-12 text-label-md",
};

const FORMAS: Record<Forma, string> = {
  circular: "rounded-full",
  cuadrado: "rounded-xl",
};

const FALLBACK_FORMAS: Record<Forma, string> = {
  circular: "bg-menta/10 text-primary",
  cuadrado: "bg-primary text-white",
};

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  nombre,
  imagen,
  tamano = "md",
  forma = "circular",
  className,
}: {
  nombre: string;
  imagen?: string;
  tamano?: Tamano;
  forma?: Forma;
  className?: string;
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden font-bold",
        TAMANOS[tamano],
        FORMAS[forma],
        className,
      )}
    >
      {imagen && (
        <AvatarPrimitive.Image
          src={imagen}
          alt={nombre}
          className="h-full w-full object-cover"
        />
      )}
      <AvatarPrimitive.Fallback
        className={cn(
          "flex h-full w-full items-center justify-center",
          FALLBACK_FORMAS[forma],
        )}
        delayMs={imagen ? 300 : 0}
      >
        {iniciales(nombre)}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
