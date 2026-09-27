import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import { type ChannelDetail, formatDurationShort, relativeTime } from "@/features/stats";
import { cn } from "@/lib/utils";
import { EmptyNote, Panel } from "./Panel";

function TokenBadge({ channel }: { channel: ChannelDetail }) {
  const t = useTranslations("dashboard.channels");
  if (channel.status !== "ok") {
    return <span className="text-[11px] font-semibold text-nb-accent-coral">{t("reauth")}</span>;
  }
  if (channel.hasRefreshToken || channel.expiresInSeconds === null) {
    return <span className="text-[11px] font-semibold text-nb-green-dark">{t("active")}</span>;
  }
  return (
    <span className="text-[11px] font-semibold text-nb-accent-amber">
      {t("expiresIn", { time: formatDurationShort(channel.expiresInSeconds) })}
    </span>
  );
}

export function ChannelsPanel({ channels }: { channels: ChannelDetail[] }) {
  const t = useTranslations("dashboard.channels");
  const locale = useLocale();
  return (
    <Panel
      title={t("title", { count: channels.length })}
      action={{ label: t("manage"), href: "/canales" }}
    >
      {channels.length === 0 ? (
        <EmptyNote>{t("empty")}</EmptyNote>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {channels.map((channel) => (
            <li
              key={`${channel.platform}:${channel.alias}`}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-nb-line bg-nb-bg/40 p-4",
                channel.status !== "ok" && "border-nb-accent-coral/40",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="relative shrink-0">
                  {channel.avatar ? (
                    // biome-ignore lint/performance/noImgElement: avatar remoto de la plataforma
                    <img
                      src={channel.avatar}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="size-10 rounded-full object-cover ring-1 ring-nb-line"
                    />
                  ) : (
                    <PlatformIcon
                      platform={channel.platform}
                      className="size-10"
                      rounded="rounded-full"
                    />
                  )}
                  {channel.avatar && (
                    <PlatformIcon
                      platform={channel.platform}
                      className="absolute -right-1 -bottom-1 size-4.5 ring-2 ring-nb-surface"
                      rounded="rounded-full"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-nb-ink">
                    {channel.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-nb-mute">
                    {PLATFORM_META[channel.platform].label} · @{channel.alias}
                    {channel.label && ` · ${channel.label}`}
                  </span>
                </span>
                {channel.publicUrl && (
                  <a
                    href={channel.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={t("openChannel")}
                    aria-label={t("openChannel")}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-nb-mute hover:bg-nb-ink/[0.05] hover:text-nb-ink"
                  >
                    <ArrowUpRight className="size-4" />
                  </a>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-nb-line pt-3 text-[11px] text-nb-mute">
                <span>
                  <span className="block font-nb-sans text-[18px] font-extrabold text-nb-ink tabular-nums">
                    {channel.publishedCount}
                  </span>
                  {t("videos")}
                </span>
                <span>
                  <span className="block truncate text-[12.5px] font-semibold text-nb-ink">
                    {channel.lastPublishedAt ? relativeTime(channel.lastPublishedAt, locale) : "—"}
                  </span>
                  {t("lastPost")}
                </span>
                <span>
                  <span className="block">
                    <TokenBadge channel={channel} />
                  </span>
                  {t("token")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
