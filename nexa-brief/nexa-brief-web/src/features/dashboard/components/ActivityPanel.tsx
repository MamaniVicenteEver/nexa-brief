import { CheckCircle2, Send, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import { type ActivityItem, relativeTime } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { EmptyNote, Panel } from "./Panel";

const ICONS = {
  video_ready: { Icon: CheckCircle2, className: "bg-nb-green/25 text-nb-green-dark" },
  video_failed: { Icon: XCircle, className: "bg-nb-accent-coral/15 text-nb-accent-coral" },
  published: { Icon: Send, className: "bg-nb-accent-blue/15 text-nb-accent-blue" },
} as const;

export function ActivityPanel({ activity }: { activity: ActivityItem[] }) {
  const t = useTranslations("dashboard.activity");
  const locale = useLocale();
  return (
    <Panel title={t("title")} action={{ label: t("history"), href: "/historial" }}>
      {activity.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <ol className="relative flex flex-col">
          {activity.map((item) => {
            const { Icon, className } = ICONS[item.kind];
            const label = t(`kinds.${item.kind}`, {
              platform: item.platform ? PLATFORM_META[item.platform].label : "",
            });
            const content = (
              <>
                <span
                  className={cn(
                    "relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full",
                    className,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold text-nb-mute">{label}</span>
                  <span className="block truncate text-[13.5px] font-semibold text-nb-ink">
                    {item.title}
                  </span>
                </span>
                <time dateTime={item.at} className="shrink-0 text-[11.5px] text-nb-mute">
                  {relativeTime(item.at, locale)}
                </time>
              </>
            );
            const rowClass =
              "flex items-center gap-3 rounded-xl px-2 py-2.5 no-underline hover:bg-nb-ink/[0.04]";
            return (
              <li key={`${item.kind}-${item.at}-${item.jobId ?? item.url}-${item.platform}`}>
                {item.kind === "published" && item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className={rowClass}>
                    {content}
                  </a>
                ) : item.jobId ? (
                  <Link href={`/biblioteca/${item.jobId}`} className={rowClass}>
                    {content}
                  </Link>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
