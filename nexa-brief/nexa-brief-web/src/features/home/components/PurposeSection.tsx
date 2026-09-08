import { getTranslations } from "next-intl/server";
import { Eyebrow } from "@/shared/components/typography/Eyebrow";
import { Heading2 } from "@/shared/components/typography/Heading2";

/**
 * index-monax.html `.purpose` — "Por ahora, un proyecto personal". The
 * honest, first-person framing (not a sales pitch) — see
 * DESIGN-SYSTEM.md §7 on brand vocabulary.
 */
export async function PurposeSection() {
  const t = await getTranslations("purpose");

  return (
    <section className="nexa-home-purpose relative z-[5] px-6 pt-[90px] pb-[70px] md:px-10">
      <div className="nexa-home-purpose__content mx-auto max-w-[760px] text-center">
        <Eyebrow className="nexa-home-purpose__eyebrow justify-center">{t("eyebrow")}</Eyebrow>
        <Heading2 className="nexa-home-purpose__title my-3.5">
          {t("headingLine1")}
          <br />
          {t("headingLine2")}
        </Heading2>
        <p className="nexa-home-purpose__description text-[16px] leading-[1.7] text-nb-ink-soft">
          {t.rich("body", {
            em: (chunks) => (
              <em className="nexa-home-purpose__emphasis font-semibold text-nb-ink not-italic">
                {chunks}
              </em>
            ),
          })}
        </p>
        <div className="nexa-home-purpose__chips mt-6 flex flex-wrap justify-center gap-2">
          <span className="nexa-home-purpose__chip nexa-home-purpose__chip--first rounded-full bg-nb-bg-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-nb-ink-soft">
            {t("chip1")}
          </span>
          <span className="nexa-home-purpose__chip nexa-home-purpose__chip--second rounded-full bg-nb-bg-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-nb-ink-soft">
            {t("chip2")}
          </span>
          <span className="nexa-home-purpose__chip nexa-home-purpose__chip--third rounded-full bg-nb-bg-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-nb-ink-soft">
            {t("chip3")}
          </span>
        </div>
      </div>
    </section>
  );
}
