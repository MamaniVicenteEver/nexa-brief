import { CalendarClock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import type { UpcomingPublication } from "@/features/stats";
import { Link } from "@/i18n/navigation";
import { EmptyNote, Panel } from "./Panel";

export function UpcomingPanel({ upcoming }: { upcoming: UpcomingPublication[] }) {
  const t = useTranslations("dashboard.upcoming");
  const locale = useLocale();
  return (
    <Panel title={t("title")} action={{ label: t("schedule"), href: "/programacion" }}>
      {upcoming.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((item) => (
            <li key={item.entryId}>
              <Link
                href={`/biblioteca/${item.jobId}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 no-underline hover:bg-nb-ink/[0.04]"
              >
                <PlatformIcon platform={item.platform} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-nb-ink">
                    {item.title}
                  </span>
                  <span className="text-[11.5px] text-nb-mute">@{item.accountAlias}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-semibold text-nb-ink-soft">
                  <CalendarClock className="size-3.5" />
                  {new Date(item.scheduledAt).toLocaleString(locale, {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
