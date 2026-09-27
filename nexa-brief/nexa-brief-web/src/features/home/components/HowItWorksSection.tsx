import { Clapperboard, Music2, Send, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { formatDurationShort, type PublicStats } from "@/features/stats";

interface Step {
  key: "input" | "ai" | "render" | "publish";
  Icon: typeof Music2;
  tech: string[];
  /** Dato real que respalda el paso (null → se muestra solo el texto). */
  metric: string | null;
}

/** El flujo completo de punta a punta: qué entra, qué hace la IA, cómo se
 * renderiza y dónde se publica — cada paso con un dato real del sistema.
 * Reemplaza a PurposeSection ("Por ahora, un proyecto personal"). */
export async function HowItWorksSection({ stats }: { stats: PublicStats | null }) {
  const t = await getTranslations("howItWorks");
  const catalog = stats?.catalog;
  const avg = stats?.performance.avgGenerationSeconds;

  const steps: Step[] = [
    {
      key: "input",
      Icon: Music2,
      tech: ["MP3", "URL", t("techLibrary")],
      metric: catalog?.templates
        ? t("metricTemplates", { count: catalog.templates, lyric: catalog.lyricTemplates })
        : null,
    },
    {
      key: "ai",
      Icon: Sparkles,
      tech: ["Gemini", "DeepSeek", "Whisper"],
      metric: t("metricAi"),
    },
    {
      key: "render",
      Icon: Clapperboard,
      tech: ["Remotion", "HyperFrames", "FFmpeg"],
      metric: avg ? t("metricRender", { time: formatDurationShort(avg) }) : null,
    },
    {
      key: "publish",
      Icon: Send,
      tech: ["YouTube", "TikTok", "Facebook"],
      metric: stats?.publications.total
        ? t("metricPublish", {
            count: stats.publications.total,
            channels: stats.channels.total,
          })
        : null,
    },
  ];

  return (
    <section className="nexa-home-how relative z-[5] px-6 pt-[90px] pb-[40px] md:px-10">
      <div className="mx-auto max-w-[1280px]">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="nb-eyebrow justify-center">{t("eyebrow")}</p>
          <h2 className="mt-3.5 font-nb-sans text-[clamp(28px,3.6vw,46px)] leading-[1.04] font-extrabold tracking-[-0.035em] text-nb-ink">
            {t("headingLine1")}{" "}
            <span className="font-nb-editorial font-medium tracking-[-0.01em] italic">
              {t("headingEm")}
            </span>
          </h2>
          <p className="mt-4 text-[15.5px] leading-[1.65] text-nb-ink-soft">{t("body")}</p>
        </div>

        <ol className="relative mt-14 grid gap-4 md:grid-cols-4">
          {/* Línea que conecta los pasos (solo desktop) */}
          <span
            aria-hidden
            className="absolute top-[34px] right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-nb-line to-transparent md:block"
          />
          {steps.map(({ key, Icon, tech, metric }, index) => (
            <li
              key={key}
              className="relative flex flex-col rounded-[24px] bg-nb-surface p-6 shadow-[0_22px_40px_-22px_rgba(40,30,10,0.22),0_8px_16px_-8px_rgba(40,30,10,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]"
            >
              <div className="flex items-center justify-between">
                <span className="relative z-[1] flex size-11 items-center justify-center rounded-2xl bg-nb-ink text-[#fafaf7] shadow-[0_10px_18px_-8px_rgba(0,0,0,0.45)]">
                  <Icon className="size-5" />
                </span>
                <span className="font-nb-code text-[12px] font-semibold text-nb-mute">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 text-[17px] leading-[1.25] font-bold tracking-[-0.02em] text-nb-ink">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="mt-2 text-[13.5px] leading-[1.55] text-nb-ink-soft">
                {t(`steps.${key}.body`)}
              </p>
              <div className="mt-4 mb-5 flex flex-wrap gap-1.5">
                {tech.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-nb-bg-2 px-2.5 py-1 text-[11px] font-semibold text-nb-ink-soft"
                  >
                    {name}
                  </span>
                ))}
              </div>
              {metric && (
                <p className="mt-auto flex items-center gap-2 border-t border-nb-line pt-4 text-[12.5px] font-semibold text-nb-green-dark">
                  <span className="size-1.5 shrink-0 rounded-full bg-nb-green-dark" />
                  {metric}
                </p>
              )}
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-8 max-w-[640px] text-center text-[13px] leading-[1.6] text-nb-mute">
          {t("note")}
        </p>
      </div>
    </section>
  );
}
