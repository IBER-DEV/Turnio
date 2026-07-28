import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";

import { cn } from "./cn";
import { Icon } from "./Icon";
import type { NombreIcono } from "./Icon";

export function MenuAcciones({ children, trigger }: { children: ReactNode; trigger: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          className={cn(
            "z-70 min-w-[180px] overflow-hidden rounded-xl border border-outline-variant bg-white p-1.5 shadow-elevada",
            "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
          )}
        >
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export function MenuAccionesItem({
  children,
  icono,
  destructivo = false,
  disabled = false,
  onClick,
  className,
}: {
  children: ReactNode;
  icono?: NombreIcono;
  destructivo?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <DropdownMenuPrimitive.Item
      disabled={disabled}
      onSelect={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 font-body-md text-body-md outline-hidden transition-colors",
        "data-highlighted:bg-menta/8",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        destructivo
          ? "text-error data-highlighted:bg-error/8 data-highlighted:text-error"
          : "text-on-surface data-highlighted:text-primary",
        className,
      )}
    >
      {icono && (
        <Icon
          name={icono}
          className={cn("text-[20px]", destructivo ? "text-error" : "text-menta")}
        />
      )}
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function MenuAccionesSeparator() {
  return <DropdownMenuPrimitive.Separator className="my-1 h-px bg-outline-variant" />;
}

export function MenuAccionesLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="px-3 py-1.5 font-caption text-caption font-semibold uppercase tracking-wider text-on-surface-variant">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}
