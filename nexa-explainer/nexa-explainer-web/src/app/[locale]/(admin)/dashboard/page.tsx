import { getTranslations } from "next-intl/server";
import { getNiches } from "@/features/create-video/api/niches-service";
import { Link } from "@/i18n/navigation";
import { auth } from "../../../../../auth";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await auth();
  const niches = await getNiches().catch(() => []);
  const activeCount = niches.filter((n) => n.active).length;

  const tiles = [
    {
      value: String(activeCount),
      label: t("activeCategories"),
      meta: t("activeCategoriesMeta"),
    },
    { value: String(niches.length), label: t("totalCategories"), meta: t("totalCategoriesMeta") },
    { value: session?.user?.email ?? "—", label: t("currentSession"), meta: t("currentSessionMeta") },
  ];

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-10 pt-[92px] pb-4.5">
        <h1 className="font-nb-sans text-[clamp(20px,2.4vw,26px)] font-extrabold tracking-[-0.02em] whitespace-nowrap text-nb-ink">
          {t("heading")}
        </h1>
      </div>

      <div className="relative z-5 mx-auto mt-12.5 grid max-w-[1100px] grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 px-10">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[22px] bg-nb-surface p-6.5 shadow-[0_22px_40px_-16px_rgba(40,30,10,0.18),0_8px_16px_-4px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]"
          >
            <div className="font-nb-sans text-[40px] font-extrabold tracking-[-0.03em] text-nb-ink">
              {tile.value}
            </div>
            <div className="mt-1.5 text-[13.5px] font-semibold text-nb-ink-soft">{tile.label}</div>
            <div className="mt-3 border-t border-nb-line pt-3 text-xs text-nb-mute">
              {tile.meta}
            </div>
          </div>
        ))}
      </div>

      <div className="nb-glass-panel relative z-5 mx-auto mt-11.5 mb-25 max-w-[820px] px-5 py-1.5">
        <div className="flex items-center justify-between px-3.5 pt-4.5 pb-2">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-nb-ink">
            {t("recentActivity")}
          </h2>
        </div>
        <div className="px-3.5 pt-2 pb-6 text-sm text-nb-mute">
          {t("recentActivityBodyBefore")}{" "}
          <Link
            href="/crear-video"
            className="font-semibold text-nb-ink underline underline-offset-2"
          >
            {t("crearVideoLink")}
          </Link>
          {t("recentActivityBodyAfter")}
        </div>
      </div>

      <section className="px-10 pt-1.5 pb-[70px]">
        <div className="nb-cta-panel mx-auto grid max-w-[1280px] items-center gap-12.5 rounded-[36px] bg-nb-ink p-15 text-[#f4f0eb] shadow-[0_40px_80px_-30px_rgba(20,12,0,0.45),0_16px_32px_-12px_rgba(20,12,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-3px_8px_rgba(0,0,0,0.5)] md:grid-cols-[1.5fr_1fr]">
          <h2 className="relative z-1 font-nb-sans text-[clamp(32px,4vw,60px)] leading-none font-extrabold tracking-[-0.035em]">
            {t("ctaHeadingLine1")}
            <br />
            <em className="nb-cta-gradient-text font-bold not-italic">{t("ctaHeadingEm")}</em>
          </h2>
          <div className="relative z-1">
            <p className="mb-6 text-[15px] leading-[1.55] text-white/65">{t("ctaBody")}</p>
            <Link
              href="/crear-video"
              className="inline-flex items-center gap-3 rounded-full bg-[#fafaf7] px-8 py-3.5 font-nb-sans text-sm font-semibold text-nb-ink no-underline shadow-[0_16px_26px_-10px_rgba(0,0,0,0.4),0_5px_10px_-2px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
            >
              {t("crearVideoLink")}
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, link already has visible text */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
