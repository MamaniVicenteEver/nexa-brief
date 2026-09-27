import { cn } from "@/lib/utils";

export type ProgressTone = "active" | "waiting" | "success" | "error";

const FILL: Record<ProgressTone, string> = {
  active: "bg-nb-green-dark",
  waiting: "bg-nb-accent-amber",
  success: "bg-nb-green-dark",
  error: "bg-red-500",
};

/** Horizontal bar that fills left→right. `value` null = indeterminate (sliding segment). */
export function ProgressBar({
  value,
  tone = "active",
  label,
  className,
}: {
  value: number | null;
  tone?: ProgressTone;
  /** Accessible name, e.g. "Progreso del video". */
  label: string;
  className?: string;
}) {
  const clamped = value === null ? null : Math.min(100, Math.max(0, value));
  const animated = tone === "active" && clamped !== null && clamped < 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped === null ? undefined : Math.round(clamped)}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-nb-ink/10", className)}
    >
      {clamped === null ? (
        <span
          className={cn(
            "nb-progress-indeterminate absolute inset-y-0 w-1/3 rounded-full",
            FILL[tone],
          )}
        />
      ) : (
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
            FILL[tone],
            animated && "nb-progress-stripes",
          )}
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}
