import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

import { cn } from "./cn";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({
  children,
  contenido,
  lado = "top",
  className,
}: {
  children: ReactNode;
  contenido: string;
  lado?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={lado}
          sideOffset={6}
          className={cn(
            "z-[80] rounded-lg bg-pizarra px-3 py-1.5 font-caption text-caption text-white shadow-elevada",
            "animate-fade-in data-[state=closed]:animate-fade-out",
            className,
          )}
        >
          {contenido}
          <TooltipPrimitive.Arrow className="fill-pizarra" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
