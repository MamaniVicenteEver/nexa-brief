import { ArrowUpRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import { formatCompact, type PublicStats } from "@/features/stats";
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
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.channelList.map((channel) => {
                const body = (
                  <>
                    <span className="relative shrink-0">
                      {channel.avatar ? (
                        // biome-ignore lint/performance/noImgElement: avatar remoto de la plataforma
                        <img
                          src={channel.avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="size-11 rounded-full object-cover ring-1 ring-nb-line"
                        />
                      ) : (
                        <PlatformIcon
                          platform={channel.platform}
                          className="size-11"
                          rounded="rounded-full"
                        />
                      )}
                      {channel.avatar && (
                        <PlatformIcon
                          platform={channel.platform}
                          className="absolute -right-1 -bottom-1 size-5 ring-2 ring-nb-surface"
                          rounded="rounded-full"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-nb-ink">
                        {channel.name}
                      </span>
                      <span className="text-[12px] text-nb-mute">
                        {PLATFORM_META[channel.platform].label} ·{" "}
                        {t("channelVideos", { count: channel.publishedCount })}
                      </span>
                    </span>
                    {channel.publicUrl && (
                      <ArrowUpRight className="size-4 shrink-0 text-nb-mute transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-nb-ink" />
                    )}
                  </>
                );
                const className =
                  "group flex items-center gap-3 rounded-2xl border border-nb-line bg-nb-bg/50 px-4 py-3 no-underline transition-colors";
                return (
                  <li key={`${channel.platform}:${channel.name}`}>
                    {channel.publicUrl ? (
                      <a
                        href={channel.publicUrl}
                        target="_blank"
                        rel="noreferrer"
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
