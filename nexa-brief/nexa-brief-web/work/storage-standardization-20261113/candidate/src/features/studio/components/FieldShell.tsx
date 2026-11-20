import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Encabezado + cuerpo de cada bloque del formulario de requisitos. */
export function FieldShell({
  title,
  hint,
  badge,
  children,
  className,
}: {
  title: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-bold tracking-[-0.01em] text-nb-ink">{title}</h3>
          {hint && <p className="mt-0.5 text-[11.5px] leading-snug text-nb-mute">{hint}</p>}
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex w-fit gap-0.5 rounded-full border border-nb-line bg-nb-surface p-0.75",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors",
            value === option.value
              ? "bg-nb-ink text-nb-surface"
              : "text-nb-ink-soft hover:bg-nb-bg-2",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
