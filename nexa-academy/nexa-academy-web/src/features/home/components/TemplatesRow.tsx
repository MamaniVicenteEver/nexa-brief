import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const TEMPLATES = [
  { id: "image-bg", key: "imageBg", src: "/images/templates/image-bg.png", wide: false },
  { id: "subject-png", key: "subjectPng", src: "/images/templates/subject-png.png", wide: false },
  {
    id: "landscape-scene",
    key: "landscapeScene",
    src: "/images/templates/landscape-scene.png",
    wide: true,
  },
  {
    id: "video-motion",
    key: "videoMotion",
    src: "/images/templates/video-motion.png",
    wide: false,
  },
  { id: "lyrics", key: "lyrics", src: "/images/templates/lyrics.png", wide: false },
] as const;

export async function TemplatesRow() {
  const t = await getTranslations("templatesRow");

  return (
    <section className="nexa-home-templates relative z-[5] px-6 pt-[70px] pb-8 md:px-10">
      <div className="nexa-home-templates__header mx-auto mb-[30px] max-w-[1280px]">
        <h2 className="nexa-home-templates__title font-nb-sans text-[clamp(24px,3.4vw,40px)] font-extrabold tracking-[-0.03em] text-nb-ink md:whitespace-nowrap">
          {t("heading")}
        </h2>
      </div>

      <div className="nexa-home-templates__grid nb-templates-grid mx-auto max-w-[1280px] pb-4">
        {TEMPLATES.map((tpl) => (
          <Link
            key={tpl.id}
            href="/plantillas"
            className={`nexa-home-templates__card flex flex-col no-underline ${tpl.wide ? "nexa-home-templates__card--wide nb-templates-grid-item-wide" : ""}`}
          >
            <div className="nexa-home-templates__card-media relative min-h-0 flex-1 overflow-hidden rounded-[22px] bg-nb-bg-2 shadow-[0_18px_34px_-16px_rgba(40,30,10,0.2),0_10px_20px_-8px_rgba(40,30,10,0.4)] transition-transform hover:-translate-y-1">
              <Image
                src={tpl.src}
                alt={t(tpl.key)}
                fill
                sizes="(max-width: 700px) 33vw, 220px"
                className="nexa-home-templates__card-image object-cover"
              />
            </div>
            <div className="nexa-home-templates__card-caption mt-3 flex flex-shrink-0 items-center gap-2 text-[13.5px] font-semibold text-nb-ink-soft">
              <span className="nexa-home-templates__card-marker h-1.5 w-1.5 flex-shrink-0 rounded-full bg-nb-green-dark" />
              <span className="nexa-home-templates__card-label">{t(tpl.key)}</span>
            </div>
          </Link>
        ))}

        <Link
          href="/plantillas"
          className="nexa-home-templates__all-link flex items-center justify-center rounded-[22px] border-[1.5px] border-dashed border-nb-line p-5 text-center font-nb-sans text-sm font-bold text-nb-ink-soft no-underline"
        >
          <span className="nexa-home-templates__all-label">
            {t("seeAllLine1")}
            <br />
            {t("seeAllLine2")}
          </span>
        </Link>
      </div>
    </section>
  );
}
