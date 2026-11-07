import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AgendaEvent, AgendaStatus } from "../lib/agenda";

const TONES: Record<AgendaStatus, string> = {
  planned: "bg-stone-100 text-stone-600",
  scheduled: "bg-blue-50 text-blue-700",
  queued: "bg-amber-50 text-amber-800",
  active: "bg-amber-50 text-amber-800",
  ready: "bg-nb-green/20 text-nb-green-dark",
  done: "bg-nb-green/20 text-nb-green-dark",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-stone-100 text-stone-500",
};
const PHASES = new Set([
  "guion",
  "voice",
  "transcribe",
  "storyboard",
  "finishing",
  "capturing",
  "encoding",
  "publishing",
  "creating",
  "recording",
  "review",
  "ready",
]);

export function AgendaStatusBadge({ event }: { event: AgendaEvent }) {
  const t = useTranslations("schedule.dashboard");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        TONES[event.status],
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full bg-current",
          event.status === "active" && "motion-safe:animate-pulse",
        )}
      />
      {t(`statuses.${event.status}`)}
    </span>
  );
}

export function AgendaPhase({ event }: { event: AgendaEvent }) {
  const t = useTranslations("schedule.dashboard");
  if (event.status === "active" && event.phase && PHASES.has(event.phase))
    return <>{t(`phases.${event.phase}`)}</>;
  if (event.status === "ready") return <>{t("preparedHint")}</>;
  if (event.status === "scheduled") return <>{t("scheduledHint")}</>;
  if (event.status === "queued") return <>{t("queuedHint")}</>;
  return null;
}
