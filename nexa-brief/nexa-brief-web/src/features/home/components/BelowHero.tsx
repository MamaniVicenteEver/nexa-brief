import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StatCounter } from "./StatCounter";
import { VideoModalProvider, VideoModalTrigger } from "./VideoModal";

const ORB_POSITIONS = [
  { color: "nb-orb-purple", style: { width: "18%", top: "12%", left: "18%" } },
  { color: "nb-orb-gold", style: { width: "14%", top: "18%", right: "22%" } },
  { color: "nb-orb-peach", style: { width: "22%", top: "38%", right: "8%" } },
  { color: "nb-orb-red", style: { width: "12%", bottom: "26%", left: "30%" } },
  { color: "nb-orb-sky", style: { width: "16%", bottom: "12%", left: "12%" } },
  { color: "nb-orb-tan", style: { width: "12%", top: "30%", left: "42%" } },
  { color: "nb-orb-cream", style: { width: "13%", bottom: "18%", right: "33%" } },
] as const;

export async function BelowHero() {
  const t = await getTranslations("belowHero");

  return (
    <section className="nexa-home-below-hero relative z-[5] mx-auto grid max-w-[1400px] gap-8 px-6 pt-8 md:grid-cols-[1fr_1.6fr_1fr] md:px-10">
      <VideoModalProvider videoSrc="/videos/sample-publication.mp4">
        {/* LEFT */}
        <div className="nexa-home-below-hero__column nexa-home-below-hero__column--left flex flex-col gap-9 md:pt-20">
          <div className="nexa-home-below-hero__motor-copy">
            <h3 className="nexa-home-below-hero__motor-title mb-3 font-nb-sans text-[22px] font-bold tracking-[-0.025em] text-nb-ink">
              {t("motorTitle")}
            </h3>
            <p className="nexa-home-below-hero__motor-description mb-4 max-w-[240px] text-[13px] leading-[1.55] text-nb-ink-soft">
              {t("motorDesc")}
            </p>
            <Link
              href="/nosotros"
              className="nexa-home-below-hero__motor-link text-[12px] font-semibold tracking-[0.08em] text-nb-ink no-underline uppercase underline-offset-4 hover:underline"
            >
              {t("verPipeline")}
            </Link>
          </div>
          <div className="nexa-home-below-hero__mini-card rounded-[20px] bg-nb-bg-2 p-3.5 shadow-[0_14px_24px_-10px_rgba(40,30,10,0.18),0_5px_10px_-3px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className="nexa-home-below-hero__mini-card-media relative mb-3.5 h-[140px] overflow-hidden rounded-[16px]">
              <Image
                src="/images/templates/lyrics.png"
                alt=""
                fill
                sizes="240px"
                priority
                className="nexa-home-below-hero__mini-card-image object-cover"
              />
            </div>
            <div className="nexa-home-below-hero__mini-card-label text-sm font-semibold tracking-[-0.01em] text-nb-ink">
              {t("miniCardLabel")}
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div className="nexa-home-below-hero__column nexa-home-below-hero__column--center relative self-start overflow-hidden">
          <div className="nexa-home-below-hero__try-wrap absolute top-[30px] left-1/2 z-10 -translate-x-1/2">
            <VideoModalTrigger className="nexa-home-below-hero__try-button nb-btn-pill px-[34px] py-[14px] font-nb-sans text-sm font-medium">
              {t("tryPill")}
            </VideoModalTrigger>
          </div>

          <div
            className="nexa-home-below-hero__visual relative aspect-[1/0.95] w-full cursor-pointer overflow-hidden rounded-[28px] shadow-[0_40px_70px_-20px_rgba(60,40,30,0.45),0_18px_32px_-10px_rgba(60,40,30,0.25),0_6px_12px_-3px_rgba(60,40,30,0.15),inset_0_2px_0_rgba(255,255,255,0.3),inset_0_-4px_8px_rgba(80,40,30,0.2)]"
            style={{
              background: "linear-gradient(160deg, #e8e0ce 0%, #c8b89e 100%)",
            }}
          >
            {ORB_POSITIONS.map((orb) => (
              <div
                key={orb.color}
                className={`nexa-home-below-hero__orb nb-orb aspect-square ${orb.color}`}
                style={orb.style}
                aria-hidden
              />
            ))}
            <VideoModalTrigger
              aria-label={t("tryPill")}
              className="nexa-home-below-hero__play-button absolute top-1/2 left-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition-transform hover:scale-110"
            >
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, parent button already has aria-label */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <polygon points="6 4 20 12 6 20" />
              </svg>
            </VideoModalTrigger>
          </div>
        </div>
      </VideoModalProvider>

      {/* RIGHT */}
      <div className="nexa-home-below-hero__column nexa-home-below-hero__column--right flex flex-col gap-9 md:pt-20">
        <div className="nexa-home-below-hero__channel-summary flex items-center gap-3.5">
          <div className="nexa-home-below-hero__channel-icons flex">
            <span className="nexa-home-below-hero__channel-icon nexa-home-below-hero__channel-icon--youtube nb-chan-icon nb-chan-icon-yt">
              YT
            </span>
            <span className="nexa-home-below-hero__channel-icon nexa-home-below-hero__channel-icon--tiktok nb-chan-icon nb-chan-icon-tt">
              TT
            </span>
            <span className="nexa-home-below-hero__channel-icon nexa-home-below-hero__channel-icon--facebook nb-chan-icon nb-chan-icon-fb">
              FB
            </span>
          </div>
          <div className="nexa-home-below-hero__channel-label text-[13px] font-medium text-nb-ink">
            {t("connectText")}
          </div>
        </div>

        <div className="nexa-home-below-hero__stat flex flex-col gap-1.5 text-left">
          <div className="nexa-home-below-hero__stat-value flex items-baseline gap-1 font-nb-sans text-[36px] font-extrabold tracking-[-0.04em] text-nb-ink">
            <StatCounter target={128} />
            <small className="nexa-home-below-hero__stat-suffix text-[0.55em] font-bold text-nb-ink-soft">
              +
            </small>
          </div>
          <p className="nexa-home-below-hero__stat-description max-w-[200px] text-[13px] leading-[1.45] text-nb-ink-soft">
            {t("statSuffix")}
          </p>
        </div>

        <div className="nexa-home-below-hero__accent-card self-start rounded-[20px] bg-nb-bg-2 p-3.5 shadow-[0_14px_24px_-10px_rgba(40,30,10,0.18),0_5px_10px_-3px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]">
          <div
            className="nexa-home-below-hero__accent-orb nb-orb-purple h-[130px] w-[100px] rounded-[60px]"
            aria-hidden
          />
        </div>
      </div>
    </section>
  );
}
