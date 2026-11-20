import { ArrowUpRight, CircleUserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import { formatCompact, type PublicStats } from "@/features/stats";
import { publicChannelPlatform } from "@/features/stats/public-channel";
import { StatCounter } from "./StatCounter";

/** Prueba de que el sistema ya funciona: cifras reales y los canales que ya
 * publica solo, con enlace a cada uno. Si el backend no responde (stats null)
 * la sección no se renderiza — nunca números inventados. */
export async function LiveNumbersSection({ stats }: { stats: PublicStats | null }) {
  if (!stats || stats.videos.total === 0) return null;
  const t = await getTranslations("liveNumbers");
  const locale = await getLocale();

  const numbers = [
    { key: "videos", value: stats.videos.total },
    { key: "publications", value: stats.publications.total },
    { key: "channels", value: stats.channels.total },
    { key: "templates", value: stats.catalog.templates },
    { key: "minutes", value: Math.round(stats.videos.videoSeconds / 60) },
  ] as const;

  return (
    <section className="nexa-home-live relative z-[5] px-6 pt-[70px] pb-[40px] md:px-10">
      <div className="mx-auto max-w-[1280px] rounded-[32px] bg-nb-surface/70 p-6 shadow-[0_30px_60px_-30px_rgba(40,30,10,0.25),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur md:p-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.2em] text-nb-mute uppercase">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-nb-green-dark opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-nb-green-dark" />
              </span>
              {t("eyebrow")}
            </p>
            <h2 className="mt-3 font-nb-sans text-[clamp(26px,3.2vw,40px)] leading-[1.05] font-extrabold tracking-[-0.03em] text-nb-ink">
              {t("heading")}
            </h2>
          </div>
          <p className="max-w-[360px] text-[13.5px] leading-[1.55] text-nb-ink-soft">{t("body")}</p>
        </div>

        <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-5">
          {numbers.map(({ key, value }) => (
            <div key={key} className="border-l border-nb-line pl-4">
              <dt className="text-[12.5px] font-semibold text-nb-mute">{t(`labels.${key}`)}</dt>
              <dd className="mt-1 font-nb-sans text-[clamp(34px,4vw,52px)] leading-none font-extrabold tracking-[-0.04em] text-nb-ink tabular-nums">
                {value >= 10_000 ? formatCompact(value, locale) : <StatCounter target={value} />}
              </dd>
            </div>
          ))}
        </dl>

        {stats.channelList.length > 0 && (
          <div className="mt-10 border-t border-nb-line pt-7">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-nb-mute uppercase">
              {t("channelsTitle")}
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
              {stats.channelList.map((channel) => {
                const platform = publicChannelPlatform(channel.publicUrl);
                const body = (
                  <>
                    <span className="shrink-0">
                      {platform ? (
                        <PlatformIcon
                          platform={platform}
                          className="size-8 sm:size-11"
                          rounded="rounded-full"
                        />
                      ) : (
                        <CircleUserRound className="size-8 text-nb-mute sm:size-11" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[12px] leading-snug font-bold text-nb-ink sm:truncate sm:text-[14px]">
                        {channel.name}
                      </span>
                      {platform && (
                        <span className="text-[11px] text-nb-mute sm:text-[12px]">
                          {PLATFORM_META[platform].label}
                        </span>
                      )}
                    </span>
                    {channel.publicUrl && (
                      <ArrowUpRight className="absolute top-2 right-2 size-3 shrink-0 sm:static sm:size-4 text-nb-mute transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-nb-ink" />
                    )}
                  </>
                );
                const className =
                  "group relative flex h-full min-h-24 flex-col items-start justify-center gap-2 rounded-2xl border border-nb-line bg-nb-bg/50 px-3 py-3 no-underline transition-colors sm:min-h-0 sm:flex-row sm:items-center sm:justify-start sm:gap-3 sm:px-4";
                return (
                  <li key={`${channel.publicUrl ?? "unlinked"}:${channel.name}`}>
                    {channel.publicUrl ? (
                      <a
                        href={channel.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={channel.name}
                        className={`${className} hover:border-nb-ink/30 hover:bg-nb-surface`}
                      >
                        {body}
                      </a>
                    ) : (
                      <div className={className}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
