import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import type { ChannelPlatform } from "@/features/channels/types";
import { formatDurationShort, type PublicStats } from "@/features/stats";

/** Material real del sistema que ilustra cada paso (un video de NodeHistory ya
 * producido y una plantilla de letras), servido por la API a través de /api/v1. */
const SAMPLE = {
  landscape: "/api/v1/explainer/files/nodehistory/muro-de-berlin/render/thumbnail-A.jpg",
  portrait: "/api/v1/templates/lyrics-night-journey/asset/card-poster.webp",
};

const PLATFORMS: ChannelPlatform[] = ["youtube", "tiktok", "facebook", "instagram"];
const PLATFORM_NAMES: Record<ChannelPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
};

type StepKey = "input" | "write" | "render" | "publish";
const STEPS: StepKey[] = ["input", "write", "render", "publish"];

/** El flujo de punta a punta mostrado con lo que realmente produce el sistema:
 * qué entra, qué texto escribe, qué video sale y dónde se publica. */
export async function HowItWorksSection({ stats }: { stats: PublicStats | null }) {
  const t = await getTranslations("howItWorks");
  const avg = stats?.performance.avgGenerationSeconds;
  const facts = [
    stats?.publications.total
      ? t("factPublications", { count: stats.publications.total, channels: stats.channels.total })
      : null,
    avg ? t("factRender", { time: formatDurationShort(avg) }) : null,
    stats?.catalog?.templates ? t("factTemplates", { count: stats.catalog.templates }) : null,
  ].filter((fact): fact is string => Boolean(fact));

  const visuals: Record<StepKey, React.ReactNode> = {
    input: (
      <div className="flex flex-col gap-2">
        <div className="rounded-[10px] border border-nb-line bg-nb-bg px-3 py-2.5">
          <p className="text-[10.5px] text-nb-mute">{t("sample.songLabel")}</p>
          <p className="mt-0.5 truncate text-[13px] font-semibold text-nb-ink">
            {t("sample.song")}
          </p>
        </div>
        <div className="rounded-[10px] border border-nb-line bg-nb-bg px-3 py-2.5">
          <p className="text-[10.5px] text-nb-mute">{t("sample.topicLabel")}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-semibold text-nb-ink">
            {t("sample.topic")}
          </p>
        </div>
      </div>
    ),
    write: (
      <div className="rounded-[10px] border border-nb-line bg-nb-bg px-3 py-3">
        <p className="flex items-center gap-1.5 text-[10.5px] text-nb-mute">
          <PlatformIcon platform="youtube" className="size-3.5" rounded="rounded-[4px]" />
          {t("sample.titleLabel")}
        </p>
        <p className="mt-1.5 text-[13px] leading-snug font-semibold text-nb-ink">
          {t("sample.title")}
        </p>
        <div className="mt-3 space-y-1.5" aria-hidden>
          <span className="block h-1.5 w-full rounded-full bg-nb-line" />
          <span className="block h-1.5 w-4/5 rounded-full bg-nb-line" />
        </div>
        <p className="mt-3 text-[11px] text-nb-ink-soft">{t("sample.tags")}</p>
      </div>
    ),
    render: (
      <div className="relative pr-8 pb-6">
        <div className="relative aspect-video overflow-hidden rounded-[10px] bg-nb-bg-2">
          <Image
            src={SAMPLE.landscape}
            alt=""
            fill
            sizes="260px"
            unoptimized
            className="object-cover"
          />
        </div>
        <div className="absolute right-0 bottom-0 aspect-[9/16] w-[30%] overflow-hidden rounded-[8px] bg-nb-bg-2 ring-4 ring-nb-surface">
          <Image
            src={SAMPLE.portrait}
            alt=""
            fill
            sizes="90px"
            unoptimized
            className="object-cover"
          />
        </div>
        <p className="absolute bottom-0 left-0 text-[10.5px] text-nb-mute">1080p · 16:9 · 9:16</p>
      </div>
    ),
    publish: (
      <ul className="flex flex-col gap-1.5">
        {PLATFORMS.map((platform) => (
          <li
            key={platform}
            className="flex items-center gap-2.5 rounded-[10px] border border-nb-line bg-nb-bg px-2.5 py-1.5"
          >
            <PlatformIcon platform={platform} className="size-6" rounded="rounded-[6px]" />
            <span className="flex-1 text-[12.5px] font-semibold text-nb-ink">
              {PLATFORM_NAMES[platform]}
            </span>
            <span className="text-[10.5px] font-medium text-nb-green-dark">
              {platform === "instagram" ? t("sample.scheduled") : t("sample.published")}
            </span>
          </li>
        ))}
      </ul>
    ),
  };

  return (
    <section className="nexa-home-how relative z-[5] px-6 pt-[90px] pb-[40px] md:px-10">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-5 md:grid-cols-2 md:items-end md:gap-16">
          <h2 className="font-nb-sans text-[clamp(28px,3.4vw,44px)] leading-[1.05] font-extrabold tracking-[-0.035em] text-nb-ink">
            {t("heading")}
          </h2>
          <p className="max-w-[500px] text-[15px] leading-[1.65] text-nb-ink-soft">{t("body")}</p>
        </div>

        <ol className="mt-12 grid overflow-hidden rounded-[22px] border border-nb-line bg-nb-surface sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((key, index) => (
            <li
              key={key}
              className="flex flex-col gap-5 border-nb-line p-6 not-last:border-b sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:not-last:border-r"
            >
              <p className="text-[12px] font-medium text-nb-mute">
                {index + 1} · {t(`steps.${key}.label`)}
              </p>
              <div className="min-h-[150px]">{visuals[key]}</div>
              <div className="mt-auto">
                <h3 className="text-[16px] leading-[1.3] font-bold tracking-[-0.015em] text-nb-ink">
                  {t(`steps.${key}.title`)}
                </h3>
                <p className="mt-1.5 text-[13px] leading-[1.55] text-nb-ink-soft">
                  {t(`steps.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        {facts.length > 0 && (
          <p className="mt-6 text-center text-[13px] text-nb-mute">{facts.join("   ·   ")}</p>
        )}
      </div>
    </section>
  );
}
