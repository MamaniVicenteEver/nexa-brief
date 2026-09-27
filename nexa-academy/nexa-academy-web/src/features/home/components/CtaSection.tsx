import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** index-monax.html `.cta-section` — the closing dark CTA panel. */
export async function CtaSection() {
  const t = await getTranslations("cta");

  return (
    <section className="nexa-home-cta relative z-[5] px-6 pt-5 pb-[70px] md:px-10">
      <div className="nexa-home-cta__panel nb-cta-panel mx-auto grid max-w-[1280px] items-center gap-[50px] rounded-[36px] bg-nb-ink p-10 text-[#f4f0eb] shadow-[0_40px_80px_-30px_rgba(20,12,0,0.45),0_16px_32px_-12px_rgba(20,12,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-3px_8px_rgba(0,0,0,0.5)] md:grid-cols-[1.5fr_1fr] md:p-20">
        <h2 className="nexa-home-cta__title relative z-[1] font-nb-sans text-[clamp(32px,4vw,60px)] leading-none font-extrabold tracking-[-0.035em]">
          {t("headingLine1")}
          <br />
          <em className="nexa-home-cta__title-emphasis nb-cta-gradient-text font-bold not-italic">
            {t("headingEm")}
          </em>
        </h2>
        <div className="nexa-home-cta__content relative z-[1]">
          <p className="nexa-home-cta__description mb-6 text-[15px] leading-[1.55] text-white/65">
            {t("body")}
          </p>
          <Link
            href="/acceso"
            className="nexa-home-cta__button inline-flex items-center gap-3 rounded-full bg-[#fafaf7] px-8 py-3.5 font-nb-sans text-sm font-semibold text-nb-ink no-underline shadow-[0_16px_26px_-10px_rgba(0,0,0,0.4),0_5px_10px_-2px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5"
          >
            {t("button")}
            {/** biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, link already has visible text */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="nexa-home-cta__button-icon"
              aria-hidden
            >
              <line x1="7" y1="17" x2="17" y2="7" />
              <polyline points="7 7 17 7 17 17" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
