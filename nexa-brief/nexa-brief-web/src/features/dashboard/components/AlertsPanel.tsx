import { CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { DashboardAlert } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function hrefFor(alert: DashboardAlert): string {
  if (alert.kind === "reauth" || alert.kind === "token_expiring") return "/canales";
  if (alert.jobId) return `/biblioteca/${alert.jobId}`;
  return "/biblioteca?tab=fallidos";
}

/** Solo aparece si hay algo que resolver. */
export function AlertsPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const t = useTranslations("dashboard.alerts");
  if (alerts.length === 0) return null;
  return (
    <section className="rounded-[24px] border border-nb-accent-coral/25 bg-nb-accent-coral/[0.06] p-4 md:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-nb-ink">
        <CircleAlert className="size-4 text-nb-accent-coral" />
        {t("title", { count: alerts.length })}
      </h2>
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <li key={`${alert.kind}-${alert.jobId}-${alert.platform}-${alert.accountAlias}`}>
            <Link
              href={hrefFor(alert)}
              className="flex items-start gap-3 rounded-2xl bg-nb-surface/80 px-4 py-3 no-underline transition-colors hover:bg-nb-surface"
            >
              <TriangleAlert
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  alert.level === "error" ? "text-nb-accent-coral" : "text-nb-accent-amber",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-nb-ink">
                  {t(`kinds.${alert.kind}`, {
                    platform: alert.platform ? PLATFORM_META[alert.platform].label : "",
                    account: alert.accountAlias ?? "",
                    title: alert.title ?? "",
                  })}
                </span>
                {alert.detail && (
                  <span className="mt-0.5 block truncate text-[11.5px] text-nb-mute">
                    {alert.detail}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-nb-ink-soft">
                {t("resolve")} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
