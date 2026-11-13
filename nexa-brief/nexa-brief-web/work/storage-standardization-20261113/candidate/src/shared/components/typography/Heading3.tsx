import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** DESIGN-SYSTEM.md §3 — card titles. `sm` matches the smaller template-card H3. */
const heading3Variants = cva("font-nb-sans font-bold text-nb-ink tracking-[-0.02em]", {
  variants: {
    size: {
      default: "text-[20px]",
      sm: "text-[19px]",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type Heading3Props = ComponentPropsWithoutRef<"h3"> & VariantProps<typeof heading3Variants>;

export function Heading3({ className, size, ...props }: Heading3Props) {
  return <h3 className={cn(heading3Variants({ size }), className)} {...props} />;
}
