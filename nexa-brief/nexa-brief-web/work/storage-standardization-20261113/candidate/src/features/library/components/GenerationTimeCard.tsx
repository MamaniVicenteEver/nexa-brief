"use client";

import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { stageLabel } from "@/features/history/components/stage-labels";
import { useJobHistory } from "@/features/history/hooks/useJobHistory";
import { cn } from "@/lib/utils";
import { formatElapsed } from "../library-status";

interface StageSpan {
  stage: string;
  seconds: number;
}

/** Cada evento del historial marca el FIN de una etapa: su duración es la
 * diferencia con el evento anterior (el primero, con la creación del job). */
function toSpans(createdAt: string, events: { stage: string; createdAt: string }[]): StageSpan[] {
  const sorted = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let previous = new Date(createdAt).getTime();
  return sorted.map((event) => {
    const at = new Date(event.createdAt).getTime();
    const span = { stage: event.stage, seconds: Math.max(0, (at - previous) / 1000) };
    previous = at;
    return span;
  });
}

export function GenerationTimeCard({
  jobId,
  createdAt,
  generationSeconds,
}: {
  jobId: string;
  createdAt: string;
  generationSeconds: number | null;
}) {
  const t = useTranslations("library.detail");
  const { data: timeline } = useJobHistory(jobId);

  if (generationSeconds === null) return null;

  // Solo las etapas de generación: publicar después no cuenta.
  const spans = toSpans(createdAt, timeline?.events ?? []).filter(
    (s) => s.stage !== "publishing" && s.stage !== "published",
  );
  const visible = spans.filter((s) => s.seconds >= 1);
  const slowest = visible.reduce<StageSpan | null>(
    (max, s) => (!max || s.seconds > max.seconds ? s : max),
    null,
  );

  return (
    <div className="rounded-2xl bg-nb-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.05em] text-nb-mute uppercase">
          <Timer className="size-3.5" />
          {t("generationTitle")}
        </p>
        <p className="text-[15px] font-extrabold tracking-[-0.01em] text-nb-ink tabular-nums">
          {formatElapsed(generationSeconds)}
        </p>
      </div>

      {visible.length > 0 && (
        <ul className="mt-3.5 flex flex-col gap-2">
          {visible.map((span) => {
            const pct = Math.max(2, (span.seconds / generationSeconds) * 100);
            const isSlowest = span === slowest;
            return (
              <li key={span.stage} className="grid grid-cols-[120px_1fr_84px] items-center gap-3">
                <span
                  className={cn(
                    "truncate text-[12px]",
                    isSlowest ? "font-semibold text-nb-ink" : "text-nb-ink-soft",
                  )}
                >
                  {span.stage === "pending" ? t("generationQueue") : stageLabel(span.stage)}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-nb-bg-2">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      isSlowest ? "bg-nb-accent-amber" : "bg-nb-green-dark/60",
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </span>
                <span className="text-right text-[11.5px] text-nb-mute tabular-nums">
                  {formatElapsed(span.seconds)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
