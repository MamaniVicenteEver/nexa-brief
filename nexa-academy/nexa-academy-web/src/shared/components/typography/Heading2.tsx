import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/** DESIGN-SYSTEM.md §3 — "H2 grande" (purpose/CTA) vs "H2 mediano" (row headings). */
const heading2Variants = cva("font-nb-sans font-extrabold text-nb-ink", {
  variants: {
    size: {
      lg: "text-[clamp(30px,4.5vw,52px)] leading-[1.05] tracking-[-0.03em]",
      md: "text-[clamp(24px,3.4vw,40px)] leading-[1.05] tracking-[-0.03em]",
    },
  },
  defaultVariants: {
    size: "lg",
  },
});

type Heading2Props = ComponentPropsWithoutRef<"h2"> & VariantProps<typeof heading2Variants>;

export function Heading2({ className, size, ...props }: Heading2Props) {
  return <h2 className={cn(heading2Variants({ size }), className)} {...props} />;
}
