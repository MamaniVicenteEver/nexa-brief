import { getTranslations } from "next-intl/server";

/**
 * index-monax.html `.tech-trust` — an infinite marquee of the real tools
 * behind the pipeline. Proper nouns, so not translated. Each wordmark
 * keeps its own distinct typography (DESIGN-SYSTEM.md §3) — no two share
 * the same font/weight/case, mirroring how real brand logos differ.
 * Pure CSS marquee (`.nb-marquee-track` in globals.css) — no JS.
 */
const TECH_ITEMS = [
  { name: "Gemini", className: "font-nb-editorial text-[27px] italic font-medium" },
  { name: "DeepSeek", className: "font-nb-tech text-[34px] font-bold uppercase tracking-[0.04em]" },
  { name: "Playwright", className: "font-nb-code text-[15px] font-semibold" },
  { name: "FFmpeg", className: "font-nb-code text-[13px] font-bold uppercase tracking-[0.03em]" },
  { name: "Remotion", className: "font-nb-editorial text-[24px] italic font-semibold" },
  { name: "FastAPI", className: "font-nb-tech text-[19px] font-semibold" },
  {
    name: "AWS Lambda",
    className: "font-nb-tech text-[15px] font-bold uppercase tracking-[0.03em]",
  },
  { name: "YouTube", className: "font-nb-sans text-[31px] font-extrabold tracking-[-0.01em]" },
  { name: "TikTok", className: "font-nb-sans text-[22px] font-black tracking-[-0.03em]" },
  { name: "Facebook", className: "font-nb-sans text-[20px] font-bold" },
  { name: "Next.js", className: "font-nb-sans text-[17px] font-extrabold tracking-[-0.03em]" },
] as const;

export async function TechMarquee() {
  const t = await getTranslations("techTrust");
  const items = [...TECH_ITEMS, ...TECH_ITEMS];

  return (
    <section className="nexa-home-tech-marquee relative z-[5] py-0">
      <p className="nexa-home-tech-marquee__eyebrow mb-[15px] bg-transparent text-center font-nb-tech text-[clamp(20px,2.8vw,30px)] font-bold tracking-[-0.02em] text-nb-ink">
        {t("eyebrow")}
      </p>
      <div className="nexa-home-tech-marquee__viewport relative overflow-hidden bg-nb-ink py-2">
        <div className="nexa-home-tech-marquee__track nb-marquee-track flex w-max items-baseline gap-14 bg-transparent">
          {items.map((item, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: static duplicated list for a seamless loop
              key={`${item.name}-${i}`}
              aria-hidden={i >= TECH_ITEMS.length}
              className={`nexa-home-tech-marquee__item whitespace-nowrap text-white/45 transition-colors hover:text-white/95 ${item.className}`}
            >
              {item.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
