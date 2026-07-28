import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";

import { cn } from "./cn";

export function Tabs({
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
    <TabsPrimitive.Root
      value={valor}
      onValueChange={onChange}
      className={className}
    >
      {children}
    </TabsPrimitive.Root>
  );
}

type VarianteLista = "pill" | "underline";

export function TabsLista({
  children,
  variante = "pill",
  className,
}: {
  children: ReactNode;
  variante?: VarianteLista;
  className?: string;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center",
        variante === "pill" && "gap-0 rounded-xl border border-outline-variant bg-white p-1",
        variante === "underline" && "gap-4 border-b border-outline-variant",
        className,
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  variante = "pill",
  className,
}: {
  value: string;
  children: ReactNode;
  variante?: VarianteLista;
  className?: string;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        "inline-flex items-center justify-center font-label-md text-label-md transition-all outline-hidden",
        variante === "pill" && [
          "rounded-lg px-4 py-1.5",
          "data-[state=active]:bg-menta data-[state=active]:text-white data-[state=active]:shadow-suave",
          "data-[state=inactive]:text-on-surface-variant data-[state=inactive]:hover:bg-surface-container-low",
        ],
        variante === "underline" && [
          "border-b-2 border-transparent px-1 pb-2.5 pt-1",
          "data-[state=active]:border-menta data-[state=active]:text-primary",
          "data-[state=inactive]:text-on-surface-variant data-[state=inactive]:hover:text-primary",
        ],
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content value={value} className={cn("outline-hidden", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
