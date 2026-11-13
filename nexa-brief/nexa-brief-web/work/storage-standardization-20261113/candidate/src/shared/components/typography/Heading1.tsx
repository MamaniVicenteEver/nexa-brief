import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * "H1 de sección" — DESIGN-SYSTEM.md §3. The unique animated hero H1 on
 * the home page is NOT this component (see features/home/components/Hero,
 * it has its own bespoke word-stagger markup) — this is the reusable H1
 * used on every other page's page-hero.
 */
export function Heading1({ className, ...props }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={cn(
        "font-nb-sans font-extrabold text-nb-ink",
        "text-[clamp(32px,5vw,60px)] leading-[1.05] tracking-[-0.03em]",
        className,
      )}
      {...props}
    />
  );
}
