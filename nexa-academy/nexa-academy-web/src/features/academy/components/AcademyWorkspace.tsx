"use client";

import { BookOpen, Calculator, ChevronRight, FlaskConical, Landmark, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

const PILOTS = [
  {
    id: "english",
    titleKey: "englishTitle",
    descriptionKey: "englishDescription",
    metadataKey: "englishMetadata",
    videoUrl: "http://127.0.0.1:8100/renders/english-04-fish-30s.mp4",
    sourcePath: "nexa-academy-hyperframes/index.html",
  },
  {
    id: "mathematics",
    titleKey: "mathematicsTitle",
    descriptionKey: "mathematicsDescription",
    metadataKey: "mathematicsMetadata",
    videoUrl: "http://127.0.0.1:8100/renders/mathematics-division-60s.mp4",
    sourcePath: "nexa-academy-hyperframes/mathematics-division.html",
  },
] as const;

const CATEGORIES = [
  {
    id: "english",
    icon: BookOpen,
    titleKey: "englishCategory",
    descriptionKey: "englishCategoryDescription",
  },
  {
    id: "mathematics",
    icon: Calculator,
    titleKey: "mathematicsCategory",
    descriptionKey: "mathematicsCategoryDescription",
  },
  {
    id: "history",
    icon: Landmark,
    titleKey: "historyCategory",
    descriptionKey: "historyCategoryDescription",
  },
  {
    id: "science",
    icon: FlaskConical,
    titleKey: "scienceCategory",
    descriptionKey: "scienceCategoryDescription",
  },
] as const;

export function AcademyWorkspace() {
  const t = useTranslations("academyWorkspace");

  return (
    <div className="mx-auto max-w-[1280px] px-6 pb-24 pt-32 md:px-10">
      <section className="max-w-[900px]">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-nb-mute">
          NEXA ACADEMY
        </p>
        <h1 className="font-nb-sans text-[clamp(36px,6vw,78px)] font-extrabold leading-[0.94] tracking-[-0.055em] text-nb-ink">
          {t("heading")}
        </h1>
        <p className="mt-7 max-w-[720px] text-lg leading-8 text-nb-ink-soft">{t("intro")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/academia"
            className="nb-btn-pill inline-flex items-center gap-2 px-6 py-3.5 text-sm font-bold no-underline"
          >
            {t("planButton")}
            <ChevronRight className="size-4" />
          </Link>
          <a
            href="#pilots"
            className="inline-flex items-center gap-2 rounded-full border border-nb-line px-6 py-3.5 text-sm font-semibold text-nb-ink-soft no-underline transition-colors hover:border-nb-ink"
          >
            {t("reviewButton")}
          </a>
        </div>
      </section>

      <section className="mt-20" aria-labelledby="academy-categories">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-nb-mute">01</p>
            <h2
              id="academy-categories"
              className="mt-2 text-3xl font-bold tracking-[-0.03em] text-nb-ink"
            >
              {t("categoriesHeading")}
            </h2>
          </div>
          <span className="hidden text-sm text-nb-mute md:block">{t("categoriesNote")}</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.id}
                href={`/academy/${category.id}`}
                className="group rounded-[24px] bg-nb-surface p-6 no-underline shadow-[0_18px_34px_-16px_rgba(40,30,10,0.16),0_6px_14px_-4px_rgba(40,30,10,0.07),inset_0_1px_0_rgba(255,255,255,0.7)] transition-transform hover:-translate-y-0.5"
              >
                <div className="flex items-start justify-between gap-5">
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-nb-bg-2 text-nb-ink">
                    <Icon className="size-5" />
                  </span>
                  <ChevronRight className="size-5 text-nb-mute transition-transform group-hover:translate-x-1" />
                </div>
                <h3 className="mt-8 text-2xl font-bold tracking-[-0.025em] text-nb-ink">
                  {t(category.titleKey)}
                </h3>
                <p className="mt-2 max-w-[450px] text-sm leading-6 text-nb-ink-soft">
                  {t(category.descriptionKey)}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="pilots" className="mt-20 scroll-mt-28" aria-labelledby="academy-pilots">
        <div className="mb-6 max-w-[760px]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-nb-mute">02</p>
          <h2
            id="academy-pilots"
            className="mt-2 text-3xl font-bold tracking-[-0.03em] text-nb-ink"
          >
            {t("pilotsHeading")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-nb-ink-soft">{t("pilotsDescription")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {PILOTS.map((pilot) => (
            <article
              key={pilot.id}
              className="overflow-hidden rounded-[24px] bg-nb-surface p-4.5 shadow-[0_18px_34px_-16px_rgba(40,30,10,0.16),0_6px_14px_-4px_rgba(40,30,10,0.07),inset_0_1px_0_rgba(255,255,255,0.7)]"
            >
              <div className="relative overflow-hidden rounded-[18px] bg-black">
                {/* biome-ignore lint/a11y/useMediaCaption: subtitles are burned into the pilot video for review */}
                <video
                  className="aspect-video w-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  src={pilot.videoUrl}
                />
                <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                  <Play className="size-3" />
                  {t("pilotPreview")}
                </span>
              </div>
              <div className="px-1 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-2xl font-bold tracking-[-0.025em] text-nb-ink">
                    {t(pilot.titleKey)}
                  </h3>
                  <span className="rounded-full bg-nb-bg-2 px-3 py-1 text-[11px] font-semibold text-nb-ink-soft">
                    {t(pilot.metadataKey)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-nb-ink-soft">{t(pilot.descriptionKey)}</p>
                <p className="mt-3 font-mono text-[11px] text-nb-mute">{pilot.sourcePath}</p>
                <a
                  href={pilot.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm font-bold text-nb-ink underline underline-offset-4"
                >
                  {t("openVideo")}
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-[28px] bg-nb-ink px-6 py-8 text-white md:px-10 md:py-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">03</p>
        <div className="mt-3 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-[650px]">
            <h2 className="text-3xl font-bold tracking-[-0.03em]">{t("feedbackHeading")}</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">{t("feedbackDescription")}</p>
          </div>
          <Link
            href="/academia"
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-6 py-3.5 text-sm font-bold text-nb-ink no-underline"
          >
            {t("feedbackButton")}
          </Link>
        </div>
      </section>
    </div>
  );
}
