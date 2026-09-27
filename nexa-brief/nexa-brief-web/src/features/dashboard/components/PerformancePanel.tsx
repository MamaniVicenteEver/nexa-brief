import { Timer } from "lucide-react";
import { useTranslations } from "next-intl";
import { stageLabel } from "@/features/history/components/stage-labels";
import { formatDurationShort, type PerformanceStats } from "@/features/stats";
import { EmptyNote, Panel } from "./Panel";

export function PerformancePanel({ performance }: { performance: PerformanceStats }) {
  const t = useTranslations("dashboard.performance");
  const top = performance.stages.slice(0, 4);
  const max = Math.max(1, ...top.map((s) => s.avgSeconds));
  return (
    <Panel title={t("title")}>
      {performance.avgGenerationSeconds === null ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <Timer className="size-4 self-center text-nb-mute" />
            <span className="font-nb-sans text-[28px] leading-none font-extrabold tracking-[-0.03em] text-nb-ink">
              {formatDurationShort(performance.avgGenerationSeconds)}
            </span>
            <span className="text-[12px] text-nb-mute">
              {t("average", { count: performance.sampleSize })}
            </span>
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            {top.map((stage, index) => (
              <li
                key={stage.stage}
                className="grid grid-cols-[124px_1fr_56px] items-center gap-2.5 text-[12px]"
              >
                <span className={index === 0 ? "font-semibold text-nb-ink" : "text-nb-ink-soft"}>
                  {stageLabel(stage.stage)}
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-nb-bg-2">
                  <span
                    className={`block h-full rounded-full ${index === 0 ? "bg-nb-accent-amber" : "bg-nb-green-dark/60"}`}
                    style={{ width: `${Math.max(4, (stage.avgSeconds / max) * 100)}%` }}
                  />
                </span>
                <span className="text-right text-nb-mute tabular-nums">
                  {formatDurationShort(stage.avgSeconds)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
