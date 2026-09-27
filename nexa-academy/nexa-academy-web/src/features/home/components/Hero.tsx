import { getTranslations } from "next-intl/server";

/**
 * index-monax.html `.hero` — the animated headline. The prototype used
 * GSAP for the word-by-word stagger; here it's pure CSS (`.nb-word-mask`,
 * `.nb-scale-in` in globals.css), computed server-side via inline
 * `animationDelay`, so this ships zero client JS.
 */
export async function Hero() {
  const t = await getTranslations("hero");

  return (
    <section className="nexa-home-hero relative z-[5] px-6 pt-[110px] pb-10 text-center md:px-10 md:pt-[130px]">
      <h1 className="nexa-home-hero__title mx-auto max-w-[1300px] font-nb-sans text-[clamp(48px,8vw,130px)] font-extrabold leading-none tracking-[-0.045em] text-nb-ink">
        <div className="nexa-home-hero__title-row flex flex-wrap items-center justify-center gap-3 py-1 md:gap-7">
          <span className="nexa-home-hero__word-mask nb-word-mask">
            <span className="nexa-home-hero__word" style={{ animationDelay: "0.3s" }}>
              {t("word1")}
            </span>
          </span>
          <span className="nexa-home-hero__word-mask nb-word-mask">
            <span className="nexa-home-hero__word" style={{ animationDelay: "0.4s" }}>
              {t("word2")}
            </span>
          </span>
        </div>

        <div className="nexa-home-hero__title-row flex flex-wrap items-center justify-center gap-3 py-1 md:gap-7">
          <span
            className="nexa-home-hero__inline-pill nb-inline-pill nb-scale-in"
            style={{ animationDelay: "0.5s" }}
            aria-hidden
          />
          <span className="nexa-home-hero__word-mask nb-word-mask">
            <span className="nexa-home-hero__word" style={{ animationDelay: "0.55s" }}>
              {t("word3")}
            </span>
          </span>
          <span className="nexa-home-hero__word-mask nb-word-mask">
            <span className="nexa-home-hero__word" style={{ animationDelay: "0.65s" }}>
              {t("word4")}
            </span>
          </span>
          <span
            className="nexa-home-hero__idea-pill nb-idea-pill nb-scale-in"
            style={{ animationDelay: "0.7s" }}
          >
            <span className="nexa-home-hero__idea-copy text-left font-nb-sans text-[clamp(11px,1.2vw,18px)] font-semibold leading-[1.15] tracking-[-0.015em] text-nb-ink">
              {t("ideaPillLine1")}
              <br />
              {t("ideaPillLine2")}
            </span>
            <span className="nexa-home-hero__idea-leaf nb-idea-pill-leaf" aria-hidden />
          </span>
        </div>

        <div className="nexa-home-hero__title-row flex flex-wrap items-center justify-center gap-3 py-1 md:gap-7">
          <span className="nexa-home-hero__word-mask nb-word-mask">
            <span className="nexa-home-hero__word" style={{ animationDelay: "0.75s" }}>
              {t("word5")}
            </span>
          </span>
          <span className="nexa-home-hero__word-mask nb-word-mask">
            <span className="nexa-home-hero__word" style={{ animationDelay: "0.85s" }}>
              {t("word6")}
            </span>
          </span>
        </div>
      </h1>
    </section>
  );
}
