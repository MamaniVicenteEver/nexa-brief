import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PlatformIcon } from "@/features/channels/components/PlatformIcon";
import { PLATFORM_META } from "@/features/channels/constants/platforms";
import type { PublicStats } from "@/features/stats";
import { Link } from "@/i18n/navigation";

/** Cierre: invitación + la misma prueba en miniatura (publicaciones reales por
 * plataforma). Sin stats, el panel derecho muestra las 3 plataformas sin cifras. */
export async function CtaSection({ stats }: { stats: PublicStats | null }) {
  const t = await getTranslations("cta");
  const byPlatform = stats?.publications.byPlatform ?? [];
  const max = Math.max(1, ...byPlatform.map((p) => p.total));
  const platforms = byPlatform.length
    ? byPlatform
    : (["youtube", "tiktok", "facebook"] as const).map((platform) => ({
        platform,
        total: 0,
        last7Days: 0,
      }));

  return (
    <section className="nexa-home-cta relative z-[5] px-6 pt-[50px] pb-[70px] md:px-10">
      <div className="nexa-home-cta__panel nb-cta-panel mx-auto grid max-w-[1280px] items-center gap-12 overflow-hidden rounded-[36px] bg-nb-ink p-8 text-[#f4f0eb] shadow-[0_40px_80px_-30px_rgba(20,12,0,0.45),0_16px_32px_-12px_rgba(20,12,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-3px_8px_rgba(0,0,0,0.5)] md:grid-cols-[1.25fr_1fr] md:p-16">
        <div className="relative z-[1]">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-white/45 uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="mt-4 font-nb-sans text-[clamp(34px,4.4vw,62px)] leading-[0.98] font-extrabold tracking-[-0.04em]">
            {t("headingLine1")}
            <br />
            <em className="nb-cta-gradient-text font-bold not-italic">{t("headingEm")}</em>
          </h2>
          <p className="mt-6 max-w-[460px] text-[15px] leading-[1.6] text-white/65">{t("body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/acceso"
              className="inline-flex items-center gap-2.5 rounded-full bg-[#fafaf7] px-7 py-3.5 font-nb-sans text-sm font-semibold text-nb-ink no-underline shadow-[0_16px_26px_-10px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5"
            >
              {t("button")}
              <ArrowUpRight className="size-4" />
            </Link>
            <Link
              href="/plantillas"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3.5 text-sm font-semibold text-white/85 no-underline transition-colors hover:bg-white/10"
            >
              {t("secondary")}
            </Link>
          </div>
        </div>

        <div className="relative z-[1] rounded-[26px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <p className="text-[12px] font-semibold text-white/55">{t("panelTitle")}</p>
          <ul className="mt-5 flex flex-col gap-4">
            {platforms.map(({ platform, total }) => (
              <li key={platform} className="flex items-center gap-3">
                <PlatformIcon platform={platform} className="size-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold">{PLATFORM_META[platform].label}</span>
                    {stats && (
                      <span className="font-nb-sans text-[18px] font-extrabold tabular-nums">
                        {total}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-nb-accent-gold via-nb-accent-amber to-nb-accent-coral"
                      style={{ width: stats ? `${Math.max(6, (total / max) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[11.5px] leading-[1.5] text-white/40">{t("panelNote")}</p>
        </div>
      </div>
    </section>
  );
}
