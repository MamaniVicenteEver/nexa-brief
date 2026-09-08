import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/shared/lib/utils";
import "./Button.css";

const buttonVariants = cva("nr-btn", {
  variants: {
    variant: {
      pick: "nr-btn--pick",
      seg: "nr-btn--seg",
      "accent-solid": "nr-btn--accent-solid",
    },
  },
  defaultVariants: { variant: "pick" },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Estado seleccionado — se traduce a `.is-active`, mismo convenio que
   * `.nr-tab.is-active`/`.nr-fan-slider__tab.is-active` en el resto de la app. */
  active?: boolean;
}

/**
 * Extrae `PickButton`/`SegButton` (antes definidos ad-hoc dentro de
 * render-editor.tsx) a un único componente compartido — reemplaza también
 * el botón "● Grabar" (antes `.pill-btn` suelto) vía `variant="accent-solid"`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, active, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant }), active && "is-active", className)}
      {...props}
    />
  );
});
