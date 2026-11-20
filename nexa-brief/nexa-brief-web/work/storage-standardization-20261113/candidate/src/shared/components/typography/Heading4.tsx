import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** DESIGN-SYSTEM.md §3 — numbered step titles. */
export function Heading4({ className, ...props }: ComponentPropsWithoutRef<"h4">) {
  return (
    <h4
      className={cn(
        "font-nb-sans font-bold text-nb-ink text-[15.5px] tracking-[-0.015em]",
        className,
      )}
      {...props}
    />
  );
}
