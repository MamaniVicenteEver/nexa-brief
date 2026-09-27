import { CheckCircle2, Clock3, Film, Loader2, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { VideoStats } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const KPIS = [
  { key: "total", tab: "todos", Icon: Film, tone: "text-nb-ink" },
  { key: "ready", tab: "pendientes", Icon: Clock3, tone: "text-nb-accent-amber" },
  { key: "published", tab: "publicados", Icon: CheckCircle2, tone: "text-nb-green-dark" },
  { key: "processing", tab: "proceso", Icon: Loader2, tone: "text-nb-accent-blue" },
  { key: "failed", tab: "fallidos", Icon: TriangleAlert, tone: "text-nb-accent-coral" },
] as const;

/** Cada número abre la Biblioteca en la pestaña correspondiente. */
export function KpiRow({ videos }: { videos: VideoStats }) {
  const t = useTranslations("dashboard.kpis");
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {KPIS.map(({ key, tab, Icon, tone }) => {
        const value = videos[key];
        const highlight = (key === "ready" || key === "failed") && value > 0;
        return (
          <Link
            key={key}
            href={`/biblioteca?tab=${tab}`}
            className={cn(
              "group rounded-[20px] bg-nb-surface p-4.5 no-underline shadow-[0_18px_30px_-22px_rgba(40,30,10,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:ring-nb-line",
              highlight && "ring-nb-line",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-nb-mute">{t(key)}</span>
              <Icon
                className={cn("size-4", tone, key === "processing" && value > 0 && "animate-spin")}
              />
            </span>
            <span className="mt-2 block font-nb-sans text-[34px] leading-none font-extrabold tracking-[-0.04em] text-nb-ink tabular-nums">
              {value}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
