import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** Contenedor común de cada bloque del dashboard: título, acción opcional y cuerpo. */
export function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[24px] bg-nb-surface p-5 shadow-[0_22px_40px_-24px_rgba(40,30,10,0.22),0_8px_16px_-8px_rgba(40,30,10,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] md:p-6",
        className,
      )}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.015em] text-nb-ink">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-nb-mute no-underline hover:text-nb-ink"
          >
            {action.label}
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-nb-line px-4 py-6 text-center text-[12.5px] text-nb-mute">
      {children}
    </p>
  );
}
