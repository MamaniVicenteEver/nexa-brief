import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const COLLAGE_IMAGES = [
  {
    src: "/images/templates/image-bg.png",
    width: "30%",
    top: "3%",
    left: "1%",
    rotate: "-6deg",
    z: 3,
  },
  {
    src: "/images/templates/subject-png.png",
    width: "27%",
    top: "1%",
    left: "33%",
    rotate: "4deg",
    z: 2,
  },
  {
    src: "/images/templates/landscape-scene.png",
    width: "32%",
    top: "-2%",
    left: "60%",
    rotate: "-3deg",
    z: 4,
  },
  {
    src: "/images/templates/video-motion.png",
    width: "28%",
    top: "32%",
    left: "-5%",
    rotate: "5deg",
    z: 2,
  },
  {
    src: "/images/templates/lyrics.png",
    width: "30%",
    top: "34%",
    left: "25%",
    rotate: "-8deg",
    z: 5,
  },
  {
    src: "/images/templates/image-bg.png",
    width: "27%",
    top: "30%",
    left: "56%",
    rotate: "7deg",
    z: 3,
  },
  {
    src: "/images/templates/subject-png.png",
    width: "27%",
    top: "63%",
    left: "3%",
    rotate: "3deg",
    z: 2,
  },
  {
    src: "/images/templates/landscape-scene.png",
    width: "29%",
    top: "66%",
    left: "33%",
    rotate: "-5deg",
    z: 4,
  },
  {
    src: "/images/templates/video-motion.png",
    width: "31%",
    top: "61%",
    left: "62%",
    rotate: "6deg",
    z: 2,
  },
] as const;

interface AccesoShellProps {
  title: string;
  subtitle: string;
  toggleQuestion: string;
  toggleLabel: string;
  toggleHref: "/acceso" | "/login";
  children: ReactNode;
}

export async function AccesoShell({
  title,
  subtitle,
  toggleQuestion,
  toggleLabel,
  toggleHref,
  children,
}: AccesoShellProps) {
  const t = await getTranslations("access");

  return (
    <div className="flex min-h-screen flex-col-reverse md:flex-row md:overflow-hidden">
      {/* LEFT — form panel */}
      <div className="flex min-h-screen w-full flex-col bg-nb-ink px-6 py-8 md:w-1/4 md:min-w-[340px] md:overflow-y-auto md:px-8.5 md:py-10">
        <Link
          href="/"
          className="mb-10 font-nb-sans text-[26px] font-bold tracking-[-0.03em] text-[#fafaf7] no-underline"
        >
          Nexa <em className="font-nb-editorial font-medium not-italic italic">Brief</em>
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <h1 className="mb-2.5 font-nb-sans text-[27px] font-extrabold tracking-[-0.03em] text-[#fafaf7]">
            {title}
          </h1>
          <p className="mb-6.5 text-[13.5px] leading-[1.6] text-[#fafaf7]/62">{subtitle}</p>

          {children}

          <div className="mt-5 text-[13px] text-[#fafaf7]/60">
            {toggleQuestion}{" "}
            <Link
              href={toggleHref}
              className="font-bold text-[#fafaf7] underline underline-offset-[3px]"
            >
              {toggleLabel}
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-white/12 pt-6">
          <p className="mb-1 text-[11.5px] text-[#fafaf7]/42">{t("contactLabel")}</p>
          <p className="mb-3.5 text-sm font-bold text-[#fafaf7]">{t("contactName")}</p>
          <div className="flex items-center gap-2.5">
            <a
              href="mailto:evermamanivicente@gmail.com"
              aria-label="Correo"
              className="flex size-9 items-center justify-center rounded-full border border-white/14 bg-white/6 text-[#fafaf7]/70 transition-colors hover:border-nb-green hover:text-[#fafaf7]"
            >
              {/** biome-ignore lint/a11y/noSvgWithoutTitle: decorative icon, parent link has aria-label */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
                <path d="m3 6.5 9 6.5 9-6.5" />
              </svg>
            </a>
          </div>
        </div>

        <Link
          href="/"
          className="mt-5.5 text-xs text-[#fafaf7]/40 no-underline hover:text-[#fafaf7]/70"
        >
          {t("backHome")}
        </Link>
      </div>

      {/* RIGHT — template collage */}
      <div className="relative flex min-h-[280px] w-full items-end overflow-hidden bg-nb-ink p-7.5 md:min-h-screen md:w-3/4 md:p-15">
        <div className="absolute -inset-[4%]">
          {COLLAGE_IMAGES.map((img, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static decorative collage, order never changes
              key={i}
              className="absolute aspect-video overflow-hidden rounded-2xl shadow-[0_24px_46px_-18px_rgba(0,0,0,0.6),0_10px_20px_-8px_rgba(0,0,0,0.4)] [filter:saturate(0.85)] max-md:hidden"
              style={{
                width: img.width,
                top: img.top,
                left: img.left,
                transform: `rotate(${img.rotate})`,
                zIndex: img.z,
              }}
            >
              <Image src={img.src} alt="" fill sizes={img.width} className="object-cover" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 z-[6] bg-[linear-gradient(180deg,rgba(13,13,16,0.55)_0%,rgba(13,13,16,0.35)_38%,rgba(13,13,16,0.88)_100%)]" />
        <div className="relative z-[7] max-w-[460px] text-[#fafaf7]">
          <span className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-[13px] font-semibold backdrop-blur-[10px]">
            {t("visualBadge")}
            <span className="h-2 w-4 shrink-0 rounded-full bg-[linear-gradient(90deg,var(--color-nb-green),var(--color-nb-accent-gold))]" />
          </span>
          <h2 className="mb-3.5 font-nb-editorial text-[clamp(30px,3.2vw,44px)] leading-[1.1] font-medium italic max-md:text-[26px]">
            {t("visualHeadingLine1")}
            <br />
            {t("visualHeadingEm")}
          </h2>
          <p className="text-[15px] leading-[1.6] text-[#fafaf7]/72 max-md:hidden">
            {t("visualBody")}
          </p>
        </div>
      </div>
    </div>
  );
}
