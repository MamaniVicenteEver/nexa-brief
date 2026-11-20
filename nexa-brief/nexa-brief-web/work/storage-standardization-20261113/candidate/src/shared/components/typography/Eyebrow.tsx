import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cn } from "@/lib/utils";

type EyebrowProps<T extends ElementType = "div"> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className">;

/** DESIGN-SYSTEM.md §3 — small uppercase label with the signature dot. */
export function Eyebrow<T extends ElementType = "div">({
  as,
  className,
  ...props
}: EyebrowProps<T>) {
  const Component = as ?? "div";
  return <Component className={cn("nb-eyebrow", className)} {...props} />;
}
