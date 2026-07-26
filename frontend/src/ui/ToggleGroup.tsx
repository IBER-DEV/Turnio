import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";

import { cn } from "./cn";

export function ToggleGroup({
  valor,
  onChange,
  children,
  className,
}: {
  valor: string;
  onChange: (valor: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={valor}
      onValueChange={(val) => {
        if (val) onChange(val);
      }}
      className={cn("hide-scrollbar flex gap-2 overflow-x-auto", className)}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
}

export function ToggleGroupItem({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ToggleGroupPrimitive.Item
      value={value}
      className={cn(
        "tactile shrink-0 rounded-full px-5 py-2.5 font-label-md text-label-md outline-none transition-colors",
        "data-[state=on]:bg-menta data-[state=on]:text-white data-[state=on]:shadow-suave",
        "data-[state=off]:bg-surface-container-low data-[state=off]:text-on-surface-variant",
        "focus-visible:ring-2 focus-visible:ring-menta/40 focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}
