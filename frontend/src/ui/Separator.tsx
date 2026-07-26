import * as SeparatorPrimitive from "@radix-ui/react-separator";

import { cn } from "./cn";

export function Separator({
  className,
  orientacion = "horizontal",
  decorativo = true,
}: {
  className?: string;
  orientacion?: "horizontal" | "vertical";
  decorativo?: boolean;
}) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorativo}
      orientation={orientacion}
      className={cn(
        "shrink-0 bg-outline-variant",
        orientacion === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
